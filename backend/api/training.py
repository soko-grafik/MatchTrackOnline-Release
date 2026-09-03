from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from db.session import get_db
from models import TrainingExercise, TrainingSession, TrainingSessionExercise, User, UserRole
from api.dependencies import get_current_user, require_trainer


router = APIRouter()

# --- Pydantic Schemas ---

class ExerciseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    coaching_points: Optional[str] = None
    age_group: str = "Alle"
    focus_area: str = "Passspiel"
    min_players: int = 4
    max_players: Optional[int] = None
    duration_minutes: int = 15
    materials: Optional[List[str]] = []
    diagram_data: Optional[dict] = None
    thumbnail_path: Optional[str] = None

class ExerciseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    coaching_points: Optional[str]
    age_group: str
    focus_area: str
    min_players: int
    max_players: Optional[int]
    duration_minutes: int
    materials: Optional[List[str]]
    diagram_data: Optional[dict]
    thumbnail_path: Optional[str]
    created_by_user_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class SessionExerciseItem(BaseModel):
    exercise_id: int
    section_name: Optional[str] = None
    order_index: int = 0
    duration_override: Optional[int] = None

class SessionCreate(BaseModel):
    title: str
    methodology: str = "Trainingsphilosophie Deutschland"
    date: Optional[datetime] = None
    team_id: Optional[str] = None
    age_group: Optional[str] = None
    notes: Optional[str] = None
    is_shared: bool = False
    exercises: List[SessionExerciseItem] = []

class SessionExerciseResponse(BaseModel):
    id: int
    exercise_id: int
    section_name: Optional[str]
    order_index: int
    duration_override: Optional[int]
    exercise: Optional[ExerciseResponse]

    class Config:
        orm_mode = True
        from_attributes = True

class SessionResponse(BaseModel):
    id: int
    title: str
    methodology: str
    date: Optional[datetime]
    team_id: Optional[str]
    age_group: Optional[str]
    notes: Optional[str]
    is_shared: bool = False
    created_by_user_id: Optional[str]
    creator_name: Optional[str] = None
    created_at: datetime
    exercises: List[SessionExerciseResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True



# --- Exercise Endpoints ---

@router.get("/exercises", response_model=List[ExerciseResponse])
def get_exercises(
    age_group: Optional[str] = Query(None),
    focus_area: Optional[str] = Query(None),
    min_players: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TrainingExercise)
    if age_group and age_group != "all" and age_group != "Alle":
        query = query.filter(TrainingExercise.age_group == age_group)
    if focus_area and focus_area != "all" and focus_area != "Alle":
        query = query.filter(TrainingExercise.focus_area == focus_area)
    if min_players is not None:
        query = query.filter(TrainingExercise.min_players <= min_players)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (TrainingExercise.title.ilike(search_pattern)) |
            (TrainingExercise.description.ilike(search_pattern)) |
            (TrainingExercise.coaching_points.ilike(search_pattern))
        )
    return query.order_by(TrainingExercise.updated_at.desc()).all()


@router.post("/exercises", response_model=ExerciseResponse)
def create_exercise(
    exercise_in: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    exercise = TrainingExercise(
        title=exercise_in.title,
        description=exercise_in.description,
        coaching_points=exercise_in.coaching_points,
        age_group=exercise_in.age_group,
        focus_area=exercise_in.focus_area,
        min_players=exercise_in.min_players,
        max_players=exercise_in.max_players,
        duration_minutes=exercise_in.duration_minutes,
        materials=exercise_in.materials,
        diagram_data=exercise_in.diagram_data,
        thumbnail_path=exercise_in.thumbnail_path,
        created_by_user_id=current_user.id
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.get("/exercises/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercise = db.query(TrainingExercise).filter(TrainingExercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Übung nicht gefunden")
    return exercise


@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: int,
    exercise_in: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    exercise = db.query(TrainingExercise).filter(TrainingExercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Übung nicht gefunden")

    for field, value in exercise_in.dict(exclude_unset=True).items():
        setattr(exercise, field, value)

    exercise.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exercise)
    return exercise


@router.delete("/exercises/{exercise_id}")
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    exercise = db.query(TrainingExercise).filter(TrainingExercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Übung nicht gefunden")
    db.delete(exercise)
    db.commit()
    return {"message": "Übung erfolgreich gelöscht"}


# --- Session (Trainingsplan) Endpoints ---

@router.get("/sessions", response_model=List[SessionResponse])
def get_sessions(
    team_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TrainingSession)
    if team_id:
        query = query.filter(TrainingSession.team_id == team_id)
    
    sessions = query.order_by(TrainingSession.created_at.desc()).all()

    for s in sessions:
        if s.created_by:
            name_parts = [p for p in [s.created_by.first_name, s.created_by.last_name] if p]
            s.creator_name = " ".join(name_parts) if name_parts else s.created_by.username
        else:
            s.creator_name = "Trainer"

    return sessions


@router.post("/sessions", response_model=SessionResponse)
def create_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    session_obj = TrainingSession(
        title=session_in.title,
        methodology=session_in.methodology or "Trainingsphilosophie Deutschland",
        date=session_in.date,
        team_id=session_in.team_id,
        age_group=session_in.age_group,
        notes=session_in.notes,
        is_shared=session_in.is_shared,
        created_by_user_id=current_user.id
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)

    for item in session_in.exercises:
        ex_rel = TrainingSessionExercise(
            session_id=session_obj.id,
            exercise_id=item.exercise_id,
            section_name=item.section_name,
            order_index=item.order_index,
            duration_override=item.duration_override
        )
        db.add(ex_rel)
    
    db.commit()
    db.refresh(session_obj)

    # Aktivität protokollieren
    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=current_user.id,
            activity_type="CREATE_TRAINING",
            resource_type="training",
            resource_id=str(session_obj.id),
            details={"title": session_obj.title, "exercises_count": len(session_in.exercises)}
        )
    except Exception:
        pass

    return session_obj


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_obj = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Trainingsplan nicht gefunden")
    return session_obj


@router.put("/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    session_obj = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Trainingsplan nicht gefunden")

    session_obj.title = session_in.title
    session_obj.methodology = session_in.methodology or "Trainingsphilosophie Deutschland"
    session_obj.date = session_in.date
    session_obj.team_id = session_in.team_id
    session_obj.age_group = session_in.age_group
    session_obj.notes = session_in.notes
    session_obj.is_shared = session_in.is_shared

    # Lösche alte Übungen und füge neue hinzu
    db.query(TrainingSessionExercise).filter(TrainingSessionExercise.session_id == session_id).delete()
    
    for item in session_in.exercises:
        ex_rel = TrainingSessionExercise(
            session_id=session_obj.id,
            exercise_id=item.exercise_id,
            section_name=item.section_name,
            order_index=item.order_index,
            duration_override=item.duration_override
        )
        db.add(ex_rel)
    
    db.commit()
    db.refresh(session_obj)
    return session_obj


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    session_obj = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Trainingsplan nicht gefunden")
    db.delete(session_obj)
    db.commit()
    return {"message": "Trainingsplan erfolgreich gelöscht"}


@router.post("/sessions/{session_id}/toggle-share", response_model=SessionResponse)
def toggle_share_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    session_obj = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Trainingsplan nicht gefunden")
    
    session_obj.is_shared = not session_obj.is_shared
    db.commit()
    db.refresh(session_obj)

    if session_obj.created_by:
        name_parts = [p for p in [session_obj.created_by.first_name, session_obj.created_by.last_name] if p]
        session_obj.creator_name = " ".join(name_parts) if name_parts else session_obj.created_by.username
    else:
        session_obj.creator_name = "Trainer"

    return session_obj
