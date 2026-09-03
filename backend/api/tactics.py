from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime
import uuid
import os
import base64

from db.session import get_db, UPLOAD_DIR
from models import UserTacticsPreference, TacticsBoard, TacticsFormationPreset, User, UserRole, Team
from api.dependencies import get_current_user, require_trainer, get_optional_user, require_module_access


router = APIRouter()
require_tactics_access = require_module_access("TACTICS")

TACTICS_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "tactics")
os.makedirs(TACTICS_UPLOAD_DIR, exist_ok=True)


# --- Helper for Thumbnail Saving ---
def save_thumbnail_base64(data_url: Optional[str], board_id: str) -> Optional[str]:
    if not data_url or not isinstance(data_url, str) or not data_url.startswith("data:image"):
        return None
    try:
        header, encoded = data_url.split(",", 1)
        image_data = base64.b64decode(encoded)
        filename = f"tactics_thumb_{board_id}_{int(datetime.utcnow().timestamp())}.png"
        filepath = os.path.join(TACTICS_UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(image_data)
        return f"uploads/tactics/{filename}"
    except Exception as e:
        print(f"Fehler beim Speichern des Taktik-Thumbnails: {e}")
        return None


# --- Pydantic Schemas ---

class UserTacticsPreferenceSchema(BaseModel):
    default_pitch_type: str = "full_horizontal"
    default_pitch_style: str = "grass_classic"
    home_team_colors: Optional[Dict[str, Any]] = {
        "primary": "#3b82f6",
        "secondary": "#ffffff",
        "goalkeeper": "#10b981",
        "text": "#ffffff"
    }
    away_team_colors: Optional[Dict[str, Any]] = {
        "primary": "#ef4444",
        "secondary": "#ffffff",
        "goalkeeper": "#f59e0b",
        "text": "#ffffff"
    }
    neutral_colors: Optional[Dict[str, Any]] = {
        "referee": "#eab308",
        "joker": "#a855f7"
    }
    default_player_label_mode: str = "number"
    default_tool: str = "select"
    laser_fade_seconds: float = 1.5
    animation_speed: float = 1.0
    auto_chain_lines: bool = False
    show_tactical_grid: bool = False
    custom_settings: Optional[Dict[str, Any]] = {}

    class Config:
        orm_mode = True
        from_attributes = True


class TacticsBoardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "Allgemein"
    team_id: Optional[str] = None
    pitch_type: str = "full_horizontal"
    pitch_style: str = "grass_classic"
    is_shared: bool = False
    frames_data: List[Dict[str, Any]] = []
    thumbnail_data: Optional[str] = None # Base64 Data URL


class TacticsBoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    team_id: Optional[str] = None
    pitch_type: Optional[str] = None
    pitch_style: Optional[str] = None
    is_shared: Optional[bool] = None
    frames_data: Optional[List[Dict[str, Any]]] = None
    thumbnail_data: Optional[str] = None


class TacticsBoardResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    team_id: Optional[str]
    team_name: Optional[str] = None
    created_by_user_id: str
    created_by_username: Optional[str] = None
    pitch_type: str
    pitch_style: str
    is_shared: bool
    frames_data: List[Dict[str, Any]]
    thumbnail_path: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class TacticsFormationPresetCreate(BaseModel):
    name: str
    system_type: str = "11v11"
    player_count: int = 11
    positions_data: List[Dict[str, Any]]
    team_id: Optional[str] = None


class TacticsFormationPresetResponse(BaseModel):
    id: str
    name: str
    system_type: str
    player_count: int
    positions_data: List[Dict[str, Any]]
    user_id: Optional[str]
    team_id: Optional[str]
    is_default: bool
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# --- Built-in System Formations ---
BUILTIN_FORMATIONS = [
    {
        "id": "sys_11v11_433",
        "name": "4-3-3 Offensiv",
        "system_type": "11v11",
        "player_count": 11,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.25, "y": 0.15, "label": "LV"},
            {"id": "h3", "role": "LIV", "number": 4, "x": 0.22, "y": 0.38, "label": "IV"},
            {"id": "h4", "role": "RIV", "number": 5, "x": 0.22, "y": 0.62, "label": "IV"},
            {"id": "h5", "role": "RV", "number": 2, "x": 0.25, "y": 0.85, "label": "RV"},
            {"id": "h6", "role": "6er", "number": 6, "x": 0.36, "y": 0.50, "label": "DM"},
            {"id": "h7", "role": "8er L", "number": 8, "x": 0.50, "y": 0.32, "label": "ZM"},
            {"id": "h8", "role": "8er R", "number": 10, "x": 0.50, "y": 0.68, "label": "ZM"},
            {"id": "h9", "role": "LA", "number": 11, "x": 0.68, "y": 0.18, "label": "LA"},
            {"id": "h10", "role": "MS", "number": 9, "x": 0.72, "y": 0.50, "label": "ST"},
            {"id": "h11", "role": "RA", "number": 7, "x": 0.68, "y": 0.82, "label": "RA"}
        ]
    },
    {
        "id": "sys_11v11_4231",
        "name": "4-2-3-1",
        "system_type": "11v11",
        "player_count": 11,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.25, "y": 0.15, "label": "LV"},
            {"id": "h3", "role": "LIV", "number": 4, "x": 0.22, "y": 0.38, "label": "IV"},
            {"id": "h4", "role": "RIV", "number": 5, "x": 0.22, "y": 0.62, "label": "IV"},
            {"id": "h5", "role": "RV", "number": 2, "x": 0.25, "y": 0.85, "label": "RV"},
            {"id": "h6", "role": "DM L", "number": 6, "x": 0.38, "y": 0.38, "label": "DM"},
            {"id": "h7", "role": "DM R", "number": 8, "x": 0.38, "y": 0.62, "label": "DM"},
            {"id": "h8", "role": "LM", "number": 11, "x": 0.55, "y": 0.18, "label": "LM"},
            {"id": "h9", "role": "OM", "number": 10, "x": 0.55, "y": 0.50, "label": "OM"},
            {"id": "h10", "role": "RM", "number": 7, "x": 0.55, "y": 0.82, "label": "RM"},
            {"id": "h11", "role": "MS", "number": 9, "x": 0.72, "y": 0.50, "label": "ST"}
        ]
    },
    {
        "id": "sys_11v11_352",
        "name": "3-5-2",
        "system_type": "11v11",
        "player_count": 11,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LIV", "number": 4, "x": 0.22, "y": 0.25, "label": "IV"},
            {"id": "h3", "role": "ZIV", "number": 5, "x": 0.20, "y": 0.50, "label": "IV"},
            {"id": "h4", "role": "RIV", "number": 3, "x": 0.22, "y": 0.75, "label": "IV"},
            {"id": "h5", "role": "LM", "number": 11, "x": 0.45, "y": 0.12, "label": "LWB"},
            {"id": "h6", "role": "DM", "number": 6, "x": 0.36, "y": 0.50, "label": "DM"},
            {"id": "h7", "role": "ZM L", "number": 8, "x": 0.48, "y": 0.35, "label": "ZM"},
            {"id": "h8", "role": "ZM R", "number": 10, "x": 0.48, "y": 0.65, "label": "ZM"},
            {"id": "h9", "role": "RM", "number": 7, "x": 0.45, "y": 0.88, "label": "RWB"},
            {"id": "h10", "role": "ST L", "number": 9, "x": 0.70, "y": 0.38, "label": "ST"},
            {"id": "h11", "role": "ST R", "number": 19, "x": 0.70, "y": 0.62, "label": "ST"}
        ]
    },
    {
        "id": "sys_9v9_332",
        "name": "9er: 3-3-2",
        "system_type": "9v9",
        "player_count": 9,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.24, "y": 0.22, "label": "LV"},
            {"id": "h3", "role": "IV", "number": 4, "x": 0.22, "y": 0.50, "label": "IV"},
            {"id": "h4", "role": "RV", "number": 2, "x": 0.24, "y": 0.78, "label": "RV"},
            {"id": "h5", "role": "LM", "number": 11, "x": 0.46, "y": 0.22, "label": "LM"},
            {"id": "h6", "role": "ZM", "number": 6, "x": 0.44, "y": 0.50, "label": "ZM"},
            {"id": "h7", "role": "RM", "number": 7, "x": 0.46, "y": 0.78, "label": "RM"},
            {"id": "h8", "role": "ST L", "number": 9, "x": 0.68, "y": 0.36, "label": "ST"},
            {"id": "h9", "role": "ST R", "number": 10, "x": 0.68, "y": 0.64, "label": "ST"}
        ]
    },
    {
        "id": "sys_7v7_231",
        "name": "7er: 2-3-1 (Klassisch)",
        "system_type": "7v7",
        "player_count": 7,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.25, "y": 0.30, "label": "ABW"},
            {"id": "h3", "role": "RV", "number": 2, "x": 0.25, "y": 0.70, "label": "ABW"},
            {"id": "h4", "role": "LM", "number": 11, "x": 0.48, "y": 0.20, "label": "LM"},
            {"id": "h5", "role": "ZM", "number": 6, "x": 0.46, "y": 0.50, "label": "ZM"},
            {"id": "h6", "role": "RM", "number": 7, "x": 0.48, "y": 0.80, "label": "RM"},
            {"id": "h7", "role": "ST", "number": 9, "x": 0.70, "y": 0.50, "label": "ST"}
        ]
    },
    {
        "id": "sys_6v6_221",
        "name": "6er: 2-2-1 (Klassisch)",
        "system_type": "6v6",
        "player_count": 6,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LIV", "number": 3, "x": 0.25, "y": 0.32, "label": "ABW"},
            {"id": "h3", "role": "RIV", "number": 2, "x": 0.25, "y": 0.68, "label": "ABW"},
            {"id": "h4", "role": "LM", "number": 11, "x": 0.48, "y": 0.28, "label": "MF"},
            {"id": "h5", "role": "RM", "number": 7, "x": 0.48, "y": 0.72, "label": "MF"},
            {"id": "h6", "role": "ST", "number": 9, "x": 0.70, "y": 0.50, "label": "ST"}
        ]
    },
    {
        "id": "sys_6v6_131",
        "name": "6er: 1-3-1 (Offensiv)",
        "system_type": "6v6",
        "player_count": 6,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "IV", "number": 4, "x": 0.24, "y": 0.50, "label": "IV"},
            {"id": "h3", "role": "LM", "number": 11, "x": 0.48, "y": 0.20, "label": "LM"},
            {"id": "h4", "role": "ZM", "number": 6, "x": 0.46, "y": 0.50, "label": "ZM"},
            {"id": "h5", "role": "RM", "number": 7, "x": 0.48, "y": 0.80, "label": "RM"},
            {"id": "h6", "role": "ST", "number": 9, "x": 0.70, "y": 0.50, "label": "ST"}
        ]
    },
    {
        "id": "sys_6v6_212",
        "name": "6er: 2-1-2 (Ausgewogen)",
        "system_type": "6v6",
        "player_count": 6,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.25, "y": 0.32, "label": "ABW"},
            {"id": "h3", "role": "RV", "number": 2, "x": 0.25, "y": 0.68, "label": "ABW"},
            {"id": "h4", "role": "ZM", "number": 6, "x": 0.46, "y": 0.50, "label": "ZM"},
            {"id": "h5", "role": "ST L", "number": 9, "x": 0.70, "y": 0.36, "label": "ST"},
            {"id": "h6", "role": "ST R", "number": 10, "x": 0.70, "y": 0.64, "label": "ST"}
        ]
    },
    {
        "id": "sys_6v6_311",
        "name": "6er: 3-1-1 (Kompakt)",
        "system_type": "6v6",
        "player_count": 6,
        "is_default": True,
        "user_id": None,
        "team_id": None,
        "created_at": datetime.utcnow(),
        "positions_data": [
            {"id": "h1", "role": "TW", "number": 1, "x": 0.08, "y": 0.50, "label": "TW"},
            {"id": "h2", "role": "LV", "number": 3, "x": 0.24, "y": 0.20, "label": "LV"},
            {"id": "h3", "role": "IV", "number": 4, "x": 0.22, "y": 0.50, "label": "IV"},
            {"id": "h4", "role": "RV", "number": 2, "x": 0.24, "y": 0.80, "label": "RV"},
            {"id": "h5", "role": "ZM", "number": 6, "x": 0.46, "y": 0.50, "label": "ZM"},
            {"id": "h6", "role": "ST", "number": 9, "x": 0.70, "y": 0.50, "label": "ST"}
        ]
    }
]


# =============================================================================
# 1. USER TACTICS PREFERENCES (GET / PUT)
# =============================================================================

@router.get("/preferences", response_model=UserTacticsPreferenceSchema)
def get_user_preferences(
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Holt die persönlichen Taktiktafel-Vorlieben des Nutzers oder legt Standardwerte an."""
    pref = db.query(UserTacticsPreference).filter(UserTacticsPreference.user_id == current_user.id).first()
    if not pref:
        # Standard-Vorlieben initialisieren
        pref = UserTacticsPreference(
            user_id=current_user.id,
            default_pitch_type="full_horizontal",
            default_pitch_style="grass_classic",
            home_team_colors={
                "primary": "#3b82f6",
                "secondary": "#ffffff",
                "goalkeeper": "#10b981",
                "text": "#ffffff"
            },
            away_team_colors={
                "primary": "#ef4444",
                "secondary": "#ffffff",
                "goalkeeper": "#f59e0b",
                "text": "#ffffff"
            },
            neutral_colors={
                "referee": "#eab308",
                "joker": "#a855f7"
            },
            default_player_label_mode="number",
            default_tool="select",
            laser_fade_seconds=1.5,
            animation_speed=1.0,
            auto_chain_lines=False,
            show_tactical_grid=False,
            custom_settings={}
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.put("/preferences", response_model=UserTacticsPreferenceSchema)
def update_user_preferences(
    data: UserTacticsPreferenceSchema,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Speichert die persönlichen Taktiktafel-Vorlieben des Nutzers."""
    pref = db.query(UserTacticsPreference).filter(UserTacticsPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserTacticsPreference(user_id=current_user.id)
        db.add(pref)

    for field, value in data.dict().items():
        setattr(pref, field, value)

    pref.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pref)
    return pref


# =============================================================================
# 2. TACTICS BOARDS CRUD
# =============================================================================

@router.get("/boards", response_model=List[TacticsBoardResponse])
def get_tactics_boards(
    category: Optional[str] = Query(None),
    team_id: Optional[str] = Query(None),
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Gibt alle sichtbaren Taktiktafeln (eigene + fürs Team freigegebene + Admin-Sicht) zurück."""
    query = db.query(TacticsBoard)

    user_role = str(current_user.role).upper()
    is_admin = "ADMIN" in user_role

    if not is_admin:
        user_team_ids = [t.id for t in current_user.teams] if hasattr(current_user, "teams") else []
        # Filter: Eigene Tafeln ODER freigegebene Tafeln der eigenen Teams ODER globale geteilte
        query = query.filter(
            (TacticsBoard.created_by_user_id == current_user.id) |
            ((TacticsBoard.is_shared == True) & (TacticsBoard.team_id.in_(user_team_ids))) |
            ((TacticsBoard.is_shared == True) & (TacticsBoard.team_id == None))
        )

    if category and category != "Alle":
        query = query.filter(TacticsBoard.category == category)
    if team_id:
        query = query.filter(TacticsBoard.team_id == team_id)

    boards = query.order_by(TacticsBoard.updated_at.desc()).all()

    # Enhance response with username & team name
    result = []
    for b in boards:
        resp = TacticsBoardResponse.from_orm(b)
        if b.created_by:
            resp.created_by_username = b.created_by.first_name or b.created_by.username
        if b.team:
            resp.team_name = b.team.name
        result.append(resp)

    return result


@router.post("/boards", response_model=TacticsBoardResponse, status_code=status.HTTP_201_CREATED)
def create_tactics_board(
    data: TacticsBoardCreate,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Erstellt eine neue Taktiktafel / einen neuen Spielzug."""
    board_id = f"tb_{uuid.uuid4().hex[:12]}"
    thumb_path = save_thumbnail_base64(data.thumbnail_data, board_id)

    board = TacticsBoard(
        id=board_id,
        title=data.title,
        description=data.description,
        category=data.category,
        team_id=data.team_id,
        created_by_user_id=current_user.id,
        pitch_type=data.pitch_type,
        pitch_style=data.pitch_style,
        is_shared=data.is_shared,
        frames_data=data.frames_data or [],
        thumbnail_path=thumb_path,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(board)
    db.commit()
    db.refresh(board)

    # Aktivität protokollieren
    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=current_user.id,
            activity_type="CREATE_TACTICS",
            resource_type="tactics",
            resource_id=board_id,
            details={"title": board.title, "category": board.category}
        )
    except Exception:
        pass

    resp = TacticsBoardResponse.from_orm(board)
    resp.created_by_username = current_user.first_name or current_user.username
    if board.team:
        resp.team_name = board.team.name
    return resp


@router.get("/boards/{board_id}", response_model=TacticsBoardResponse)
def get_tactics_board(
    board_id: str,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Lädt eine einzelne Taktiktafel mit allen Animationsphasen."""
    board = db.query(TacticsBoard).filter(TacticsBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Taktiktafel nicht gefunden")

    resp = TacticsBoardResponse.from_orm(board)
    if board.created_by:
        resp.created_by_username = board.created_by.first_name or board.created_by.username
    if board.team:
        resp.team_name = board.team.name
    return resp


@router.put("/boards/{board_id}", response_model=TacticsBoardResponse)
def update_tactics_board(
    board_id: str,
    data: TacticsBoardUpdate,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Aktualisiert eine Taktiktafel (Metadaten, Phasen, Formation)."""
    board = db.query(TacticsBoard).filter(TacticsBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Taktiktafel nicht gefunden")

    # Berechtigungsprüfung
    user_role = str(current_user.role).upper()
    if "ADMIN" not in user_role and board.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung zum Bearbeiten dieser Tafel")

    if data.title is not None:
        board.title = data.title
    if data.description is not None:
        board.description = data.description
    if data.category is not None:
        board.category = data.category
    if data.team_id is not None:
        board.team_id = data.team_id
    if data.pitch_type is not None:
        board.pitch_type = data.pitch_type
    if data.pitch_style is not None:
        board.pitch_style = data.pitch_style
    if data.is_shared is not None:
        board.is_shared = data.is_shared
    if data.frames_data is not None:
        board.frames_data = data.frames_data
    if data.thumbnail_data is not None:
        thumb_path = save_thumbnail_base64(data.thumbnail_data, board.id)
        if thumb_path:
            board.thumbnail_path = thumb_path

    board.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(board)

    # Aktivität protokollieren
    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=current_user.id,
            activity_type="EDIT_TACTICS",
            resource_type="tactics",
            resource_id=board_id,
            details={"title": board.title}
        )
    except Exception:
        pass

    resp = TacticsBoardResponse.from_orm(board)
    if board.created_by:
        resp.created_by_username = board.created_by.first_name or board.created_by.username
    if board.team:
        resp.team_name = board.team.name
    return resp


@router.delete("/boards/{board_id}")
def delete_tactics_board(
    board_id: str,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Löscht eine Taktiktafel."""
    board = db.query(TacticsBoard).filter(TacticsBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Taktiktafel nicht gefunden")

    user_role = str(current_user.role).upper()
    is_admin = "ADMIN" in user_role
    if not is_admin and board.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung zum Löschen dieser Tafel")

    # Thumbnail ggf. bereinigen
    if board.thumbnail_path:
        clean_rel = board.thumbnail_path.replace("uploads/", "").replace("uploads\\", "")
        full_thumb_path = os.path.join(UPLOAD_DIR, clean_rel)
        if os.path.exists(full_thumb_path):
            try:
                os.remove(full_thumb_path)
            except Exception:
                pass

    db.delete(board)
    db.commit()
    return {"status": "success", "message": "Taktiktafel gelöscht"}


@router.post("/boards/{board_id}/duplicate", response_model=TacticsBoardResponse)
def duplicate_tactics_board(
    board_id: str,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Dupliziert eine Taktiktafel als eigene Arbeitskopie."""
    original = db.query(TacticsBoard).filter(TacticsBoard.id == board_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Taktiktafel nicht gefunden")

    new_id = f"tb_{uuid.uuid4().hex[:12]}"
    new_board = TacticsBoard(
        id=new_id,
        title=f"{original.title} (Kopie)",
        description=original.description,
        category=original.category,
        team_id=original.team_id,
        created_by_user_id=current_user.id,
        pitch_type=original.pitch_type,
        pitch_style=original.pitch_style,
        is_shared=False,
        frames_data=original.frames_data,
        thumbnail_path=original.thumbnail_path,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(new_board)
    db.commit()
    db.refresh(new_board)

    resp = TacticsBoardResponse.from_orm(new_board)
    resp.created_by_username = current_user.first_name or current_user.username
    if new_board.team:
        resp.team_name = new_board.team.name
    return resp


# =============================================================================
# 3. FORMATIONS PRESETS (System + Custom)
# =============================================================================

@router.get("/formations", response_model=List[TacticsFormationPresetResponse])
def get_formations(
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Liefert alle vordefinierten System-Formationen sowie benutzerdefinierte Formationen."""
    custom_presets = db.query(TacticsFormationPreset).filter(
        (TacticsFormationPreset.user_id == current_user.id) |
        (TacticsFormationPreset.is_default == True)
    ).all()

    result = []
    # 1. Built-in defaults
    for bf in BUILTIN_FORMATIONS:
        result.append(TacticsFormationPresetResponse(**bf))

    # 2. Custom database presets
    for cp in custom_presets:
        result.append(TacticsFormationPresetResponse.from_orm(cp))

    return result


@router.post("/formations", response_model=TacticsFormationPresetResponse, status_code=status.HTTP_201_CREATED)
def create_custom_formation(
    data: TacticsFormationPresetCreate,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Speichert eine eigene Formation als wiederverwendbares Preset."""
    preset_id = f"form_{uuid.uuid4().hex[:10]}"
    preset = TacticsFormationPreset(
        id=preset_id,
        name=data.name,
        system_type=data.system_type,
        player_count=data.player_count,
        positions_data=data.positions_data,
        user_id=current_user.id,
        team_id=data.team_id,
        is_default=False,
        created_at=datetime.utcnow()
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return TacticsFormationPresetResponse.from_orm(preset)


@router.delete("/formations/{formation_id}")
def delete_custom_formation(
    formation_id: str,
    current_user: User = Depends(require_tactics_access),
    db: Session = Depends(get_db)
):
    """Löscht ein benutzerdefiniertes Formations-Preset."""
    preset = db.query(TacticsFormationPreset).filter(TacticsFormationPreset.id == formation_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Formation nicht gefunden")

    user_role = str(current_user.role).upper()
    is_admin = "ADMIN" in user_role
    if not is_admin and preset.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung zum Löschen dieser Formation")

    db.delete(preset)
    db.commit()
    return {"status": "success", "message": "Formation gelöscht"}
