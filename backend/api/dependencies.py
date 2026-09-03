from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Union, Dict, Any, Optional

from core.security import verify_token
from models import User, UserRole
from db.session import get_db

# Standard OAuth2 scheme, will raise 401 if no token or invalid token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# OAuth2 scheme that will NOT raise 401 automatically if no token is present
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

from sqlalchemy import func

def get_current_user_or_share_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Union[User, Dict[str, Any]]:
    """
    Diese Dependency prüft, ob das Token ein reguläres Benutzer-Token
    oder ein spezielles Token für ein geteiltes Match ist.
    Gibt entweder das User-Objekt oder das Token-Payload-Dictionary zurück.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(token, credentials_exception)
    except Exception as e:
        print(f"DEBUG: verify_token failed in get_current_user_or_share_token: {e}")
        raise credentials_exception

    # Check if it's a shared match token
    if "shared_match_id" in payload:
        return payload

    # If not, it must be a regular user token
    username: str = payload.get("sub")
    if username is None:
        print("DEBUG: Token has no 'sub' (username) and is not a share token.")
        raise credentials_exception

    user = db.query(User).filter(
        (User.username == username) | (func.lower(User.username) == username.lower())
    ).first()
    if user is None:
        print(f"DEBUG: User '{username}' found in token, but not in database.")
        raise credentials_exception
    return user

from datetime import datetime

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Normale Dependency für reguläre Endpunkte, die einen echten User erfordern."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    result = get_current_user_or_share_token(token, db)

    if isinstance(result, dict) and "shared_match_id" in result:
        raise credentials_exception

    # Update last_login activity timestamp (max once every 2 minutes to prevent DB thrashing)
    try:
        now = datetime.utcnow()
        if not result.last_login or (now - result.last_login).total_seconds() > 120:
            result.last_login = now
            db.commit()
    except Exception as e:
        print(f"DEBUG: Failed to update last_login: {e}")

    return result
    return result

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)) -> Optional[User]:
    """
    Dependency, die versucht, den aktuellen Benutzer zu erhalten, aber None zurückgibt,
    wenn kein Token vorhanden oder ungültig ist, anstatt eine HTTPException zu werfen.
    """
    if token is None:
        return None

    try:
        # Versuche, den Benutzer mit dem Token zu erhalten
        # Wir verwenden hier get_current_user_or_share_token, aber fangen die Exception ab
        result = get_current_user_or_share_token(token=token, db=db)

        if isinstance(result, dict) and "shared_match_id" in result:
            # Wenn es ein Share-Token ist, ignorieren wir es hier für die Benutzerauthentifizierung
            return None

        return result # Dies sollte ein User-Objekt sein
    except HTTPException:
        return None # Token war ungültig oder konnte nicht validiert werden
    except Exception as e:
        print(f"DEBUG: Unexpected error in get_optional_user: {e}")
        return None

def require_role(required_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
        req_role_strs = [str(r.value if hasattr(r, 'value') else r).upper() for r in required_roles]
        if user_role_str not in req_role_strs:
            print(f"DEBUG: User '{current_user.username}' (Role: {current_user.role}) denied access. Required: {required_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The user does not have enough privileges"
            )
        return current_user
    return role_checker

# Specific role requirements
require_viewer = require_role([UserRole.VIEWER, UserRole.CO_TRAINER, UserRole.TRAINER, UserRole.TEAM_ADMIN, UserRole.ADMIN])
require_trainer = require_role([UserRole.CO_TRAINER, UserRole.TRAINER, UserRole.TEAM_ADMIN, UserRole.ADMIN])
require_team_admin = require_role([UserRole.TEAM_ADMIN, UserRole.ADMIN])
require_admin = require_role([UserRole.ADMIN])


def require_module_access(module_name: str):
    def checker(current_user: User = Depends(get_current_user)):
        user_role = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
        if user_role in ["ADMIN", "TEAM_ADMIN"]:
            return current_user

        perms = current_user.module_permissions or {}
        default_access = True if user_role in ["TRAINER", "CO_TRAINER"] else (module_name == "MATCHES")
        has_access = perms.get(module_name, default_access)

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Kein Zugriff auf das Modul '{module_name}'."
            )
        return current_user
    return checker
