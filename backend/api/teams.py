from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from db.session import get_db
from models import Team, User, UserRole, Match
from .dependencies import require_viewer, require_admin, get_current_user, get_optional_user

router = APIRouter()

class TeamOut(BaseModel):
    id: str
    name: str
    age_group: Optional[str] = None
    can_edit: Optional[bool] = True
    created_at: datetime

    class Config:
        orm_mode = True

class TeamCreate(BaseModel):
    name: str
    age_group: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    age_group: Optional[str] = None

@router.get("", response_model=List[TeamOut])
@router.get("/", response_model=List[TeamOut])
def get_all_teams(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    """Gibt alle registrierten Mannschaften zurück (inklusive can_edit Rechte für den aktuellen User, falls angemeldet)."""
    from sqlalchemy import text
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper() if current_user else "VIEWER"
    all_teams = db.query(Team).order_by(Team.name.asc()).all()

    can_edit_map = {}
    if current_user:
        rows = db.execute(text("SELECT team_id, can_edit FROM user_teams WHERE user_id = :uid"), {"uid": current_user.id}).fetchall()
        can_edit_map = {r[0]: bool(r[1]) if r[1] is not None else False for r in rows}

    result = []
    for t in all_teams:
        default_edit = True if user_role_str == "ADMIN" and t.id not in can_edit_map else False
        result.append({
            "id": t.id,
            "name": t.name,
            "age_group": t.age_group,
            "can_edit": can_edit_map.get(t.id, default_edit),
            "created_at": t.created_at
        })
    return result

@router.get("/my", response_model=List[TeamOut])
def get_my_teams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Gibt nur die Mannschaften zurück, die dem aktuellen Trainer zugewiesen sind (Admins erhalten alle)."""
    from sqlalchemy import text
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
    
    rows = db.execute(text("SELECT team_id, can_edit FROM user_teams WHERE user_id = :uid"), {"uid": current_user.id}).fetchall()
    can_edit_map = {r[0]: bool(r[1]) if r[1] is not None else False for r in rows}

    teams_to_check = db.query(Team).order_by(Team.name.asc()).all() if user_role_str == "ADMIN" else current_user.teams
    result = []
    for t in teams_to_check:
        default_edit = True if user_role_str == "ADMIN" and t.id not in can_edit_map else False
        result.append({
            "id": t.id,
            "name": t.name,
            "age_group": t.age_group,
            "can_edit": can_edit_map.get(t.id, default_edit),
            "created_at": t.created_at
        })
    return result

@router.post("", response_model=TeamOut)
@router.post("/", response_model=TeamOut)
def create_team(team_in: TeamCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Erstellt eine neue Mannschaft (Nur Admin)."""
    existing = db.query(Team).filter(Team.name == team_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Eine Mannschaft mit dem Namen '{team_in.name}' existiert bereits."
        )
    
    team_id = f"team_{uuid.uuid4().hex[:10]}"
    team = Team(
        id=team_id,
        name=team_in.name,
        age_group=team_in.age_group
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

@router.put("/{team_id}", response_model=TeamOut)
def update_team(team_id: str, team_in: TeamUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Bearbeitet eine Mannschaft (Nur Admin)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mannschaft nicht gefunden.")
    
    if team_in.name is not None:
        # Prüfen, ob der neue Name bereits vergeben ist
        existing = db.query(Team).filter(Team.name == team_in.name, Team.id != team_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Name '{team_in.name}' wird bereits verwendet.")
        team.name = team_in.name

    if team_in.age_group is not None:
        team.age_group = team_in.age_group

    db.commit()
    db.refresh(team)
    return team

@router.delete("/{team_id}")
def delete_team(team_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Löscht eine Mannschaft (Nur Admin)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mannschaft nicht gefunden.")
    
    # Entferne Verknüpfung bei betroffenen Matches
    matches = db.query(Match).filter(Match.team_id == team_id).all()
    for m in matches:
        m.team_id = None
    
    db.delete(team)
    db.commit()
    return {"status": "success", "message": f"Mannschaft '{team.name}' wurde gelöscht."}
