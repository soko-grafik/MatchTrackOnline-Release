from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from typing import Optional, List
from db.session import get_db
from models import User, UserRole, Team
from sqlalchemy import func
from core.security import get_password_hash, verify_password, create_access_token
from services.notification_service import notify_admin_new_registration

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "TRAINER"
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    team_id: Optional[str] = None

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: UserRole
    is_approved: bool
    first_name: Optional[str] = None
    last_name: Optional[str] = None

@router.post("/register", response_model=UserOut)
@router.post("/register/", response_model=UserOut)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    clean_username = user.username.strip() if user.username else ""
    clean_email = user.email.strip().lower() if user.email else ""
    clean_first_name = user.first_name.strip() if user.first_name else ""
    clean_last_name = user.last_name.strip() if user.last_name else ""

    if not clean_username:
        raise HTTPException(status_code=400, detail="Bitte gib einen Benutzernamen ein.")
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Bitte gib eine gültige E-Mail-Adresse ein.")
    if not user.password or len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Das Passwort muss mindestens 6 Zeichen lang sein.")

    # Check if user already exists (case-insensitive)
    db_user = db.query(User).filter(
        (User.username == clean_username) | (func.lower(User.username) == clean_username.lower())
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Dieser Benutzername ist bereits vergeben.")

    db_email = db.query(User).filter(
        (User.email == clean_email) | (func.lower(User.email) == clean_email.lower())
    ).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse wird bereits verwendet.")

    role_upper = user.role.upper() if user.role else "TRAINER"
    role_enum = UserRole[role_upper] if role_upper in UserRole.__members__ else UserRole.TRAINER

    hashed_password = get_password_hash(user.password)
    new_user = User(
        id=str(uuid.uuid4()),
        username=clean_username,
        email=clean_email,
        hashed_password=hashed_password,
        role=role_enum,
        first_name=clean_first_name,
        last_name=clean_last_name,
        is_approved=0 # Registrierungen müssen manuell freigeschaltet werden
    )
    if user.team_id:
        team = db.query(Team).filter(Team.id == user.team_id).first()
        if team:
            new_user.teams.append(team)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Admin benachrichtigen
    try:
        notify_admin_new_registration(new_user, db)
    except Exception as e:
        print(f"Error sending admin notification: {e}")
    
    # Manually convert is_approved integer to boolean for Pydantic
    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "role": new_user.role,
        "is_approved": bool(new_user.is_approved),
        "first_name": new_user.first_name,
        "last_name": new_user.last_name
    }

@router.post("/login")
@router.post("/login/")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    login_id = form_data.username.strip()
    user = db.query(User).filter(
        (User.username == login_id) | (User.email == login_id)
    ).first()
    
    if not user:
        user = db.query(User).filter(
            (func.lower(User.username) == login_id.lower()) | (func.lower(User.email) == login_id.lower())
        ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dein Account wurde noch nicht vom Administrator freigeschaltet."
        )

    user.last_login = datetime.utcnow()
    db.commit()

    # Aktivität protokollieren
    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=user.id,
            activity_type="LOGIN",
            details={"username": user.username, "role": str(user.role)}
        )
    except Exception as act_err:
        print(f"[Auth] Activity log error: {act_err}")

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    access_token = create_access_token(
        data={"sub": user.username, "role": role_str}
    )
    return {"access_token": access_token, "token_type": "bearer"}

from fastapi import Request
import secrets
from datetime import datetime, timedelta
from services.notification_service import send_email

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Erstellt ein Passwort-Reset-Token und sendet eine E-Mail an den Benutzer (sichere Variante zur Verhinderung von Enumeration).
    """
    email_addr = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email_addr)).first()
    
    # Generic success message to prevent user enumeration
    success_msg = {"status": "success", "message": "Wenn die E-Mail-Adresse registriert ist, wurde ein Link zum Zurücksetzen des Passworts versendet."}
    
    if not user:
        return success_msg
        
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    
    # Determine link URL based on the referer/origin or fallback to a standard domain
    origin = request.headers.get("origin")
    if not origin:
        origin = request.headers.get("referer")
    if not origin:
        origin = "https://matchtrack.de"
    else:
        # Strip trailing slash if present
        origin = origin.rstrip("/")
        
    reset_link = f"{origin}/reset-password?token={token}"
    
    subject = "MatchTracker: Passwort zurücksetzen"
    body = (
        f"Hallo {user.first_name or user.username},\n\n"
        f"Du hast das Zurücksetzen deines Passworts für deinen MatchTracker-Account angefordert.\n"
        f"Bitte klicke auf den folgenden Link, um ein neues Passwort zu vergeben:\n\n"
        f"{reset_link}\n\n"
        f"Dieser Link ist für 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail bitte.\n\n"
        f"Dein MatchTracker System"
    )
    
    try:
        send_email(user.email, subject, body, db)
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        # We still return success to keep user enumeration protection, or we can log it.
        
    return success_msg

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Überprüft das Token und setzt das Passwort neu.
    """
    user = db.query(User).filter(
        User.reset_token == payload.token,
        User.reset_token_expires_at > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Der Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.")
        
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Das Passwort muss mindestens 6 Zeichen lang sein.")
        
    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    
    return {"status": "success", "message": "Dein Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden."}
