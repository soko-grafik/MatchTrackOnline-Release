import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.session import get_db, UPLOAD_DIR
from models import User, Team
from api.dependencies import get_current_user, require_viewer
from core.security import verify_password, get_password_hash
from services.notification_service import send_email

router = APIRouter()

UPLOAD_AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
os.makedirs(UPLOAD_AVATAR_DIR, exist_ok=True)

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model_name: Optional[str] = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class UserPreferencesUpdate(BaseModel):
    notify_on_new_video: Optional[bool] = None
    notify_on_analysis: Optional[bool] = None

@router.get("/me")
async def get_my_profile(current_user: User = Depends(require_viewer), db: Session = Depends(get_db)):
    """
    Gibt das Profil des aktuell angemeldeten Benutzers zurück.
    """
    from sqlalchemy import select, text
    # Fetch team permissions (can_edit) for the current user
    user_team_rows = db.execute(text("SELECT team_id, can_edit FROM user_teams WHERE user_id = :uid"), {"uid": current_user.id}).fetchall()
    can_edit_map = {row[0]: bool(row[1]) if row[1] is not None else True for row in user_team_rows}
    
    user_teams = [
        {
            "id": t.id,
            "name": t.name,
            "age_group": t.age_group,
            "can_edit": can_edit_map.get(t.id, True)
        }
        for t in current_user.teams
    ]
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
        "avatar_path": current_user.avatar_path,
        "notify_on_new_video": current_user.notify_on_new_video if current_user.notify_on_new_video is not None else True,
        "notify_on_analysis": current_user.notify_on_analysis if current_user.notify_on_analysis is not None else True,
        "ai_provider": current_user.ai_provider or "OPENAI",
        "ai_api_key": current_user.ai_api_key or "",
        "ai_model_name": current_user.ai_model_name or "",
        "module_permissions": current_user.module_permissions or {},
        "teams": user_teams,
        "created_at": current_user.created_at
    }

@router.put("/me")
async def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """
    Aktualisiert Name, E-Mail oder KI-Einstellungen des Benutzers.
    """
    if profile_data.username and profile_data.username != current_user.username:
        existing_user = db.query(User).filter(User.username == profile_data.username, User.id != current_user.id).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Benutzername bereits vergeben.")
        current_user.username = profile_data.username

    if profile_data.email and profile_data.email != current_user.email:
        existing_email = db.query(User).filter(User.email == profile_data.email, User.id != current_user.id).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="E-Mail-Adresse bereits registriert.")
        current_user.email = profile_data.email

    if profile_data.first_name is not None:
        current_user.first_name = profile_data.first_name

    if profile_data.last_name is not None:
        current_user.last_name = profile_data.last_name

    if profile_data.ai_provider is not None:
        current_user.ai_provider = profile_data.ai_provider

    if profile_data.ai_api_key is not None:
        current_user.ai_api_key = profile_data.ai_api_key

    if profile_data.ai_model_name is not None:
        current_user.ai_model_name = profile_data.ai_model_name

    db.commit()
    db.refresh(current_user)

    return {"status": "success", "message": "Profil erfolgreich aktualisiert."}

@router.put("/me/password")
async def update_my_password(
    password_data: UserPasswordUpdate,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """
    Ändert das Passwort des Benutzers nach Überprüfung des aktuellen Passworts.
    """
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Das aktuelle Passwort ist nicht korrekt.")

    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Das neue Passwort muss mindestens 6 Zeichen lang sein.")

    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"status": "success", "message": "Passwort erfolgreich geändert."}

@router.put("/me/preferences")
async def update_my_preferences(
    pref_data: UserPreferencesUpdate,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """
    Speichert persönliche Benachrichtigungseinstellungen.
    """
    if pref_data.notify_on_new_video is not None:
        current_user.notify_on_new_video = pref_data.notify_on_new_video
    if pref_data.notify_on_analysis is not None:
        current_user.notify_on_analysis = pref_data.notify_on_analysis

    db.commit()
    return {"status": "success", "message": "Benachrichtigungseinstellungen gespeichert."}

@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    """
    Lädt ein Profilbild für den Benutzer hoch.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Bitte wählen Sie eine gültige Bilddatei aus (PNG/JPG).")

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_AVATAR_DIR, filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    rel_path = f"uploads/avatars/{filename}"
    current_user.avatar_path = rel_path
    db.commit()

    return {"status": "success", "avatar_path": rel_path}

class TeamRequest(BaseModel):
    team_id: str
    message: Optional[str] = None

@router.post("/me/team-request")
def request_team_assignment(
    payload: TeamRequest,
    current_user: User = Depends(require_viewer),
    db: Session = Depends(get_db)
):
    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")

    # Get admin emails to notify
    admins = db.query(User).filter(User.role == "ADMIN").all()
    if not admins:
         raise HTTPException(status_code=400, detail="Kein Administrator im System hinterlegt.")
    
    # Send email notification to each admin
    subject = f"MatchTracker: Team-Zuweisungsanfrage von {current_user.username}"
    body = (
        f"Hallo Admin,\n\n"
        f"Der Benutzer '{current_user.username}' ({current_user.email}) hat eine Zuweisungsanfrage "
        f"für das Team '{team.name}' (Altersklasse: {team.age_group or 'Keine'}) gesendet.\n"
    )
    if payload.message:
        body += f"\nNachricht des Benutzers:\n{payload.message}\n"
    
    body += "\nBitte schalte den Zugriff in der Benutzerverwaltung frei.\n\nDein MatchTracker System"

    errors = []
    for admin in admins:
        try:
            send_email(admin.email, subject, body, db)
        except Exception as e:
            errors.append(str(e))
    
    if len(errors) == len(admins) and admins:
        raise HTTPException(status_code=500, detail=f"E-Mail-Benachrichtigung an Admin fehlgeschlagen: {', '.join(errors)}")

    return {"status": "success", "message": "Anfrage erfolgreich an den Administrator gesendet."}
