from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import uuid
import csv
import io
import re

from db.session import get_db
from models import Player, PlayerAttendance, PlayerEvaluation, Team, User, UserRole, CalendarEvent
from api.dependencies import get_current_user, require_trainer, require_viewer

router = APIRouter()

# --- Pydantic Schemas ---

class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = "D"
    dfb_id: Optional[str] = None
    jersey_number: Optional[int] = None
    position: Optional[str] = "Feldspieler"
    team_id: Optional[str] = None
    notes: Optional[str] = None

class PlayerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    dfb_id: Optional[str] = None
    jersey_number: Optional[int] = None
    position: Optional[str] = None
    team_id: Optional[str] = None
    notes: Optional[str] = None

class PlayerTransfer(BaseModel):
    team_id: str

class PlayerResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: Optional[str]
    nationality: Optional[str]
    dfb_id: Optional[str]
    jersey_number: Optional[int]
    position: Optional[str]
    team_id: Optional[str]
    team_name: Optional[str] = None
    notes: Optional[str]
    attendance_rate: Optional[float] = None
    latest_rating: Optional[float] = None
    latest_eval_date: Optional[datetime] = None
    is_present_last_training: Optional[bool] = False
    is_present_last_match: Optional[bool] = False
    last_training_date: Optional[datetime] = None
    last_match_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class AttendanceCreate(BaseModel):
    player_id: str
    event_id: Optional[int] = None
    event_date: Optional[datetime] = None
    event_type: str = "TRAINING" # TRAINING, MATCH
    status: str = "PRESENT" # PRESENT, ABSENT, EXCUSED
    absence_reason: Optional[str] = None # KRANKHEIT, PRIVATES, VERLETZUNG, SONSTIGES
    notes: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: int
    player_id: str
    event_id: Optional[int]
    event_date: datetime
    event_type: str
    status: str
    absence_reason: Optional[str]
    notes: Optional[str]

    class Config:
        orm_mode = True
        from_attributes = True

class EvaluationCreate(BaseModel):
    player_id: str
    evaluation_date: Optional[datetime] = None
    eval_year: Optional[int] = None
    eval_quarter: Optional[str] = None
    overall_notes: Optional[str] = None

    # 1. Technische Fähigkeiten (1-10)
    tech_ball_control: float = 5.0
    tech_dribbling: float = 5.0
    tech_passing: float = 5.0
    tech_shooting: float = 5.0
    tech_both_feet: float = 5.0

    # 2. Taktisches Grundverhalten (1-10)
    tact_intelligence: float = 5.0
    tact_space_creation: float = 5.0
    tact_transition: float = 5.0
    tact_one_on_one: float = 5.0

    # 3. Physische & Koordinative Aspekte (1-10)
    phys_speed: float = 5.0
    phys_agility: float = 5.0
    phys_mobility: float = 5.0

    # 4. Mentale & Soziale Faktoren (1-10)
    ment_teamwork: float = 5.0
    ment_attitude: float = 5.0
    ment_learning: float = 5.0
    ment_fairplay: float = 5.0

class EvaluationResponse(BaseModel):
    id: int
    player_id: str
    evaluation_date: datetime
    eval_year: Optional[int] = None
    eval_quarter: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_by_user_name: Optional[str] = None
    created_by_user_role: Optional[str] = None
    is_approved: bool = True
    approved_by_user_id: Optional[str] = None
    approved_by_user_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    overall_rating: float
    overall_notes: Optional[str]

    tech_ball_control: float
    tech_dribbling: float
    tech_passing: float
    tech_shooting: float
    tech_both_feet: float

    tact_intelligence: float
    tact_space_creation: float
    tact_transition: float
    tact_one_on_one: float

    phys_speed: float
    phys_agility: float
    phys_mobility: float

    ment_teamwork: float
    ment_attitude: float
    ment_learning: float
    ment_fairplay: float

    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


def check_player_edit_permission(user: User, team_id: Optional[str], db: Session):
    """
    Checks whether a user is allowed to create, edit, or delete a player or evaluation for a given team_id.
    Team permissions (can_edit = True/False) in user_teams apply to all roles including ADMIN.
    """
    if not team_id:
        return True

    user_role_str = str(user.role.value if hasattr(user.role, 'value') else user.role).upper()

    from sqlalchemy import text
    row = db.execute(
        text("SELECT can_edit FROM user_teams WHERE user_id = :uid AND team_id = :tid"),
        {"uid": user.id, "tid": team_id}
    ).fetchone()

    if not row:
        if user_role_str == "ADMIN":
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Du bist dieser Mannschaft nicht zugewiesen."
        )

    can_edit = bool(row[0]) if row[0] is not None else True
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung: Du hast für diese Mannschaft nur Leserechte."
        )

    return True

# --- Helper Functions ---

def calculate_overall_rating(eval_in: EvaluationCreate) -> float:
    ratings = [
        eval_in.tech_ball_control, eval_in.tech_dribbling, eval_in.tech_passing, eval_in.tech_shooting, eval_in.tech_both_feet,
        eval_in.tact_intelligence, eval_in.tact_space_creation, eval_in.tact_transition, eval_in.tact_one_on_one,
        eval_in.phys_speed, eval_in.phys_agility, eval_in.phys_mobility,
        eval_in.ment_teamwork, eval_in.ment_attitude, eval_in.ment_learning, eval_in.ment_fairplay
    ]
    return round(sum(ratings) / len(ratings), 1)


# --- Player Endpoints ---

@router.get("", response_model=List[PlayerResponse])
@router.get("/", response_model=List[PlayerResponse])
def get_players(
    team_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Player)
    if team_id and team_id != "ALL":
        query = query.filter(Player.team_id == team_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Player.first_name.ilike(pattern)) |
            (Player.last_name.ilike(pattern)) |
            (Player.dfb_id.ilike(pattern))
        )
    
    players = query.order_by(Player.last_name.asc(), Player.first_name.asc()).all()

    # Pre-fetch teams map
    teams = {t.id: t.name for t in db.query(Team).all()}

    result = []
    for p in players:
        # Calculate attendance rate
        total_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == p.id).count()
        present_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == p.id, PlayerAttendance.status == "PRESENT").count()
        attendance_rate = round((present_att / total_att) * 100, 1) if total_att > 0 else 100.0

        # Fetch latest approved rating & date
        latest_eval = db.query(PlayerEvaluation).filter(
            PlayerEvaluation.player_id == p.id,
            PlayerEvaluation.is_approved == True
        ).order_by(PlayerEvaluation.evaluation_date.desc()).first()
        latest_rating = latest_eval.overall_rating if latest_eval else None
        latest_eval_date = latest_eval.evaluation_date if latest_eval else None

        # Check if present at the last/most recent training and match
        last_att_training = db.query(PlayerAttendance).filter(
            PlayerAttendance.player_id == p.id,
            PlayerAttendance.event_type == "TRAINING"
        ).order_by(PlayerAttendance.event_date.desc()).first()

        last_att_match = db.query(PlayerAttendance).filter(
            PlayerAttendance.player_id == p.id,
            PlayerAttendance.event_type == "MATCH"
        ).order_by(PlayerAttendance.event_date.desc()).first()

        now_utc = datetime.utcnow()
        today_start = datetime(now_utc.year, now_utc.month, now_utc.day)

        is_present_today_training = False
        if last_att_training and last_att_training.event_date >= today_start and last_att_training.status == "PRESENT":
            is_present_today_training = True

        is_present_today_match = False
        if last_att_match and last_att_match.event_date >= today_start and last_att_match.status == "PRESENT":
            is_present_today_match = True

        p_res = PlayerResponse(
            id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            date_of_birth=p.date_of_birth,
            nationality=p.nationality,
            dfb_id=p.dfb_id,
            jersey_number=p.jersey_number,
            position=p.position,
            team_id=p.team_id,
            team_name=teams.get(p.team_id, "Keine Mannschaft") if p.team_id else "Keine Mannschaft",
            notes=p.notes,
            attendance_rate=attendance_rate,
            latest_rating=latest_rating,
            latest_eval_date=latest_eval_date,
            is_present_last_training=is_present_today_training,
            is_present_last_match=is_present_today_match,
            last_training_date=last_att_training.event_date if last_att_training else None,
            last_match_date=last_att_match.event_date if last_att_match else None,
            created_at=p.created_at
        )
        result.append(p_res)

    return result


@router.post("", response_model=PlayerResponse)
@router.post("/", response_model=PlayerResponse)
def create_player(
    player_in: PlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    check_player_edit_permission(current_user, player_in.team_id, db)
    player = Player(
        id=f"plr_{uuid.uuid4()}",
        first_name=player_in.first_name.strip(),
        last_name=player_in.last_name.strip(),
        date_of_birth=player_in.date_of_birth,
        nationality=player_in.nationality or "D",
        dfb_id=player_in.dfb_id,
        jersey_number=player_in.jersey_number,
        position=player_in.position or "Feldspieler",
        team_id=player_in.team_id,
        notes=player_in.notes
    )
    db.add(player)
    db.commit()
    db.refresh(player)

    team_name = None
    if player.team_id:
        t = db.query(Team).filter(Team.id == player.team_id).first()
        if t: team_name = t.name

    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        date_of_birth=player.date_of_birth,
        nationality=player.nationality,
        dfb_id=player.dfb_id,
        jersey_number=player.jersey_number,
        position=player.position,
        team_id=player.team_id,
        team_name=team_name,
        notes=player.notes,
        created_at=player.created_at
    )


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")
    
    team_name = None
    if player.team_id:
        t = db.query(Team).filter(Team.id == player.team_id).first()
        if t: team_name = t.name

    total_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == player.id).count()
    present_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == player.id, PlayerAttendance.status == "PRESENT").count()
    attendance_rate = round((present_att / total_att) * 100, 1) if total_att > 0 else 100.0

    latest_eval = db.query(PlayerEvaluation).filter(PlayerEvaluation.player_id == player.id).order_by(PlayerEvaluation.created_at.desc()).first()
    latest_rating = latest_eval.overall_rating if latest_eval else None

    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        date_of_birth=player.date_of_birth,
        nationality=player.nationality,
        dfb_id=player.dfb_id,
        jersey_number=player.jersey_number,
        position=player.position,
        team_id=player.team_id,
        team_name=team_name,
        notes=player.notes,
        attendance_rate=attendance_rate,
        latest_rating=latest_rating,
        created_at=player.created_at
    )


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: str,
    player_in: PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")

    check_player_edit_permission(current_user, player.team_id, db)
    if player_in.team_id and player_in.team_id != player.team_id:
        check_player_edit_permission(current_user, player_in.team_id, db)

    for key, value in player_in.dict(exclude_unset=True).items():
        setattr(player, key, value)

    db.commit()
    db.refresh(player)

    team_name = None
    if player.team_id:
        t = db.query(Team).filter(Team.id == player.team_id).first()
        if t: team_name = t.name

    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        date_of_birth=player.date_of_birth,
        nationality=player.nationality,
        dfb_id=player.dfb_id,
        jersey_number=player.jersey_number,
        position=player.position,
        team_id=player.team_id,
        team_name=team_name,
        notes=player.notes,
        created_at=player.created_at
    )


@router.put("/{player_id}/transfer", response_model=PlayerResponse)
def transfer_player(
    player_id: str,
    transfer_in: PlayerTransfer,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")

    check_player_edit_permission(current_user, player.team_id, db)
    check_player_edit_permission(current_user, transfer_in.team_id, db)

    target_team = db.query(Team).filter(Team.id == transfer_in.team_id).first()
    if not target_team:
        raise HTTPException(status_code=404, detail="Ziel-Mannschaft nicht gefunden")

    player.team_id = target_team.id
    db.commit()
    db.refresh(player)

    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        date_of_birth=player.date_of_birth,
        nationality=player.nationality,
        dfb_id=player.dfb_id,
        jersey_number=player.jersey_number,
        position=player.position,
        team_id=player.team_id,
        team_name=target_team.name,
        notes=player.notes,
        created_at=player.created_at
    )


@router.delete("/{player_id}")
def delete_player(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")
    
    check_player_edit_permission(current_user, player.team_id, db)

    db.delete(player)
    db.commit()
    return {"status": "success", "message": "Spieler gelöscht"}


# --- DFB.net CSV Import Endpoint ---

@router.post("/import-dfb-csv")
async def import_dfb_csv(
    team_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    check_player_edit_permission(current_user, team_id, db)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Ziel-Mannschaft nicht gefunden")

    contents = await file.read()
    # Decode file content (try utf-8, iso-8859-1, cp1252)
    text_content = None
    for enc in ['utf-8-sig', 'utf-8', 'iso-8859-1', 'cp1252']:
        try:
            text_content = contents.decode(enc)
            break
        except Exception:
            continue

    if not text_content:
        raise HTTPException(status_code=400, detail="Konnte die CSV-Datei nicht dekodieren.")

    lines = text_content.splitlines()
    if not lines:
        raise HTTPException(status_code=400, detail="Die CSV-Datei ist leer.")

    # Determine delimiter (semicolon or comma or tab)
    sample_line = lines[0]
    delimiter = ';' if ';' in sample_line else (',' if ',' in sample_line else '\t')

    reader = csv.reader(lines, delimiter=delimiter)
    header = [h.strip() for h in next(reader, [])]

    # Map column headers to index
    # Format: "Name Künstlername";"Vorname Rufname";"Geb.";"Nat.";"Passnummer"
    def find_idx(candidates):
        for candidate in candidates:
            for idx, col in enumerate(header):
                if candidate.lower() in col.lower():
                    return idx
        return -1

    idx_name = find_idx(["Name Künstlername", "Name", "Nachname"])
    idx_vorname = find_idx(["Vorname Rufname", "Vorname"])
    idx_geb = find_idx(["Geb.", "Geburtsdatum", "Geburtstag", "Geb"])
    idx_nat = find_idx(["Nat.", "Nationalität", "Nat"])
    idx_pass = find_idx(["Passnummer", "Pass-Nr", "DFB-ID", "Passnr"])

    if idx_name == -1 or idx_vorname == -1:
        raise HTTPException(status_code=400, detail=f"CSV-Format ungültig. Es müssen Spalten für Name und Vorname vorhanden sein. Erkannte Spalten: {', '.join(header)}")

    created_count = 0
    updated_count = 0

    for row in reader:
        if not row or len(row) <= max(idx_name, idx_vorname):
            continue

        raw_name = row[idx_name].strip()
        raw_vorname = row[idx_vorname].strip()

        if not raw_name and not raw_vorname:
            continue

        # Clean Geschlechtsangabe wie "(m)" oder "(w)" aus Vorname
        clean_vorname = re.sub(r'\s*\([mw]\)\s*', '', raw_vorname, flags=re.IGNORECASE).strip()
        clean_name = raw_name.strip()

        dob = row[idx_geb].strip() if idx_geb != -1 and idx_geb < len(row) else None
        nat = row[idx_nat].strip() if idx_nat != -1 and idx_nat < len(row) else "D"
        dfb_id = row[idx_pass].strip() if idx_pass != -1 and idx_pass < len(row) else None

        # Check existing player by dfb_id or name+team
        existing_player = None
        if dfb_id:
            existing_player = db.query(Player).filter(Player.dfb_id == dfb_id).first()
        if not existing_player:
            existing_player = db.query(Player).filter(
                Player.first_name.ilike(clean_vorname),
                Player.last_name.ilike(clean_name),
                Player.team_id == team_id
            ).first()

        if existing_player:
            existing_player.first_name = clean_vorname
            existing_player.last_name = clean_name
            if dob: existing_player.date_of_birth = dob
            if nat: existing_player.nationality = nat
            if dfb_id: existing_player.dfb_id = dfb_id
            existing_player.team_id = team_id
            updated_count += 1
        else:
            new_player = Player(
                id=f"plr_{uuid.uuid4()}",
                first_name=clean_vorname,
                last_name=clean_name,
                date_of_birth=dob,
                nationality=nat or "D",
                dfb_id=dfb_id,
                team_id=team_id,
                position="Feldspieler"
            )
            db.add(new_player)
            created_count += 1

    db.commit()
    return {
        "status": "success",
        "message": f"DFB.net Import abgeschlossen: {created_count} neu angelegt, {updated_count} aktualisiert.",
        "created": created_count,
        "updated": updated_count
    }


# --- Sync Birthdays to Organizer ---

@router.post("/sync-birthdays-to-organizer")
def sync_birthdays_to_organizer(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    players = db.query(Player).filter(Player.date_of_birth != None).all()
    created_events = 0
    updated_events = 0
    current_year = datetime.utcnow().year

    for p in players:
        if not p.date_of_birth:
            continue

        dob_day = None
        dob_month = None
        parts = [pt for pt in re.split(r'[.\-/]', p.date_of_birth.strip()) if pt]
        if len(parts) >= 2:
            try:
                if len(parts[0]) == 4: # YYYY-MM-DD
                    dob_month = int(parts[1])
                    dob_day = int(parts[2])
                else: # DD.MM.YYYY
                    dob_day = int(parts[0])
                    dob_month = int(parts[1])
            except ValueError:
                continue

        if not dob_day or not dob_month:
            continue

        try:
            bday_time = datetime(current_year, dob_month, dob_day, 9, 0, 0)
        except ValueError:
            continue

        title = f"🎂 Geburtstag: {p.first_name} {p.last_name}"

        existing_event = db.query(CalendarEvent).filter(
            CalendarEvent.title == title,
            CalendarEvent.event_type == "EVENT"
        ).first()

        if existing_event:
            existing_event.start_time = bday_time
            existing_event.end_time = datetime(current_year, dob_month, dob_day, 10, 0, 0)
            existing_event.team_id = p.team_id
            updated_events += 1
        else:
            new_event = CalendarEvent(
                title=title,
                event_type="EVENT",
                start_time=bday_time,
                end_time=datetime(current_year, dob_month, dob_day, 10, 0, 0),
                notes=f"Spieler-Geburtstag von {p.first_name} {p.last_name} ({p.date_of_birth}). Benachrichtigung aktiv.",
                team_id=p.team_id,
                created_by_user_id=current_user.id
            )
            db.add(new_event)
            created_events += 1

    db.commit()
    return {
        "status": "success",
        "message": f"Geburtstage in den Organizer übertragen ({created_events} neu, {updated_events} aktualisiert).",
        "created": created_events,
        "updated": updated_events
    }


@router.post("/{player_id}/toggle-today-attendance")
def toggle_today_attendance(
    player_id: str,
    event_type: str = Query("TRAINING"), # TRAINING or MATCH
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # Find attendance entry for THIS player, event_type and TODAY
    today_att = db.query(PlayerAttendance).filter(
        PlayerAttendance.player_id == player_id,
        PlayerAttendance.event_type == event_type,
        PlayerAttendance.event_date >= today_start
    ).order_by(PlayerAttendance.event_date.desc()).first()

    if today_att:
        if today_att.status == "PRESENT":
            today_att.status = "ABSENT"
            new_status = False
        else:
            today_att.status = "PRESENT"
            new_status = True
    else:
        new_att = PlayerAttendance(
            player_id=player_id,
            event_date=now,
            event_type=event_type,
            status="PRESENT"
        )
        db.add(new_att)
        new_status = True

    db.commit()

    # Recalculate rate
    total_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == player.id).count()
    present_att = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == player.id, PlayerAttendance.status == "PRESENT").count()
    attendance_rate = round((present_att / total_att) * 100, 1) if total_att > 0 else 100.0

    return {
        "status": "success",
        "event_type": event_type,
        "is_present": new_status,
        "attendance_rate": attendance_rate
    }

@router.get("/{player_id}/attendance", response_model=List[AttendanceResponse])
def get_player_attendance(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attendances = db.query(PlayerAttendance).filter(PlayerAttendance.player_id == player_id).order_by(PlayerAttendance.event_date.desc()).all()
    return attendances

@router.get("/{player_id}/tagged_events")
def get_player_tagged_events(player_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Holt alle MatchEvents, in denen der Spieler markiert wurde."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    events = player.tagged_in_events
    
    result = []
    for e in events:
        match = e.match
        result.append({
            "id": e.id,
            "match_id": e.match_id,
            "match_name": match.name if match else "Unbekanntes Match",
            "match_date": match.recording_date.isoformat() if match and match.recording_date else None,
            "event_type": e.event_type,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "video_time_ms": e.video_time_ms,
            "details": e.details
        })
        
    # Chronologisch absteigend sortieren (neueste zuerst)
    result.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return result

@router.post("/attendance", response_model=AttendanceResponse)
def record_attendance(
    att_in: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    att = PlayerAttendance(
        player_id=att_in.player_id,
        event_id=att_in.event_id,
        event_date=att_in.event_date or datetime.utcnow(),
        event_type=att_in.event_type,
        status=att_in.status,
        absence_reason=att_in.absence_reason,
        notes=att_in.notes
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


# --- Evaluation Endpoints (1-10 Matrix) ---

@router.get("/{player_id}/evaluations")
def get_player_evaluations(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    evals = db.query(PlayerEvaluation).filter(PlayerEvaluation.player_id == player_id).order_by(PlayerEvaluation.evaluation_date.asc()).all()
    users = {u.id: u for u in db.query(User).all()}

    res = []
    for ev in evals:
        c_user = users.get(ev.created_by_user_id)
        a_user = users.get(ev.approved_by_user_id)

        c_name = f"{c_user.first_name or ''} {c_user.last_name or ''}".strip() if c_user else (c_user.username if c_user else "Trainer")
        a_name = f"{a_user.first_name or ''} {a_user.last_name or ''}".strip() if a_user else (a_user.username if a_user else "Admin")

        item = {
            "id": ev.id,
            "player_id": ev.player_id,
            "evaluation_date": ev.evaluation_date,
            "eval_year": ev.eval_year,
            "eval_quarter": ev.eval_quarter,
            "created_by_user_id": ev.created_by_user_id,
            "created_by_user_name": c_name or "Trainer",
            "created_by_user_role": str(c_user.role.value) if c_user and hasattr(c_user.role, 'value') else "TRAINER",
            "is_approved": bool(ev.is_approved),
            "approved_by_user_id": ev.approved_by_user_id,
            "approved_by_user_name": a_name if ev.approved_by_user_id else None,
            "approved_at": ev.approved_at,
            "overall_rating": ev.overall_rating,
            "overall_notes": ev.overall_notes,

            "tech_ball_control": ev.tech_ball_control,
            "tech_dribbling": ev.tech_dribbling,
            "tech_passing": ev.tech_passing,
            "tech_shooting": ev.tech_shooting,
            "tech_both_feet": ev.tech_both_feet,

            "tact_intelligence": ev.tact_intelligence,
            "tact_space_creation": ev.tact_space_creation,
            "tact_transition": ev.tact_transition,
            "tact_one_on_one": ev.tact_one_on_one,

            "phys_speed": ev.phys_speed,
            "phys_agility": ev.phys_agility,
            "phys_mobility": ev.phys_mobility,

            "ment_teamwork": ev.ment_teamwork,
            "ment_attitude": ev.ment_attitude,
            "ment_learning": ev.ment_learning,
            "ment_fairplay": ev.ment_fairplay,
            "created_at": ev.created_at,
            "updated_at": ev.updated_at
        }
        res.append(item)
    return res


@router.post("/{player_id}/evaluations", response_model=EvaluationResponse)
def create_player_evaluation(
    player_id: str,
    eval_in: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Spieler nicht gefunden")

    check_player_edit_permission(current_user, player.team_id, db)

    overall = calculate_overall_rating(eval_in)
    eval_date = eval_in.evaluation_date or datetime.utcnow()

    is_admin = current_user.role in [UserRole.ADMIN, UserRole.TEAM_ADMIN]

    eval_obj = PlayerEvaluation(
        player_id=player_id,
        evaluation_date=eval_date,
        eval_year=eval_in.eval_year or eval_date.year,
        eval_quarter=eval_in.eval_quarter or f"Q{(eval_date.month - 1) // 3 + 1}",
        created_by_user_id=current_user.id,
        is_approved=is_admin,
        approved_by_user_id=current_user.id if is_admin else None,
        approved_at=datetime.utcnow() if is_admin else None,
        overall_rating=overall,
        overall_notes=eval_in.overall_notes,

        tech_ball_control=eval_in.tech_ball_control,
        tech_dribbling=eval_in.tech_dribbling,
        tech_passing=eval_in.tech_passing,
        tech_shooting=eval_in.tech_shooting,
        tech_both_feet=eval_in.tech_both_feet,

        tact_intelligence=eval_in.tact_intelligence,
        tact_space_creation=eval_in.tact_space_creation,
        tact_transition=eval_in.tact_transition,
        tact_one_on_one=eval_in.tact_one_on_one,

        phys_speed=eval_in.phys_speed,
        phys_agility=eval_in.phys_agility,
        phys_mobility=eval_in.phys_mobility,

        ment_teamwork=eval_in.ment_teamwork,
        ment_attitude=eval_in.ment_attitude,
        ment_learning=eval_in.ment_learning,
        ment_fairplay=eval_in.ment_fairplay
    )
    db.add(eval_obj)
    db.commit()
    db.refresh(eval_obj)

    # Aktivität protokollieren
    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=current_user.id,
            activity_type="EVALUATE_PLAYER",
            resource_type="player",
            resource_id=player_id,
            details={"player_name": f"{player.first_name} {player.last_name}", "rating": overall}
        )
    except Exception:
        pass

    return eval_obj


@router.put("/evaluations/{eval_id}", response_model=EvaluationResponse)
def update_player_evaluation(
    eval_id: int,
    eval_in: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    eval_obj = db.query(PlayerEvaluation).filter(PlayerEvaluation.id == eval_id).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")

    player = db.query(Player).filter(Player.id == eval_obj.player_id).first()
    if player:
        check_player_edit_permission(current_user, player.team_id, db)

    overall = calculate_overall_rating(eval_in)

    if eval_in.evaluation_date:
        eval_obj.evaluation_date = eval_in.evaluation_date
        eval_obj.eval_year = eval_in.eval_year or eval_in.evaluation_date.year
        eval_obj.eval_quarter = eval_in.eval_quarter or f"Q{(eval_in.evaluation_date.month - 1) // 3 + 1}"
    elif eval_in.eval_year and eval_in.eval_quarter:
        eval_obj.eval_year = eval_in.eval_year
        eval_obj.eval_quarter = eval_in.eval_quarter

    eval_obj.overall_rating = overall
    eval_obj.overall_notes = eval_in.overall_notes

    eval_obj.tech_ball_control = eval_in.tech_ball_control
    eval_obj.tech_dribbling = eval_in.tech_dribbling
    eval_obj.tech_passing = eval_in.tech_passing
    eval_obj.tech_shooting = eval_in.tech_shooting
    eval_obj.tech_both_feet = eval_in.tech_both_feet

    eval_obj.tact_intelligence = eval_in.tact_intelligence
    eval_obj.tact_space_creation = eval_in.tact_space_creation
    eval_obj.tact_transition = eval_in.tact_transition
    eval_obj.tact_one_on_one = eval_in.tact_one_on_one

    eval_obj.phys_speed = eval_in.phys_speed
    eval_obj.phys_agility = eval_in.phys_agility
    eval_obj.phys_mobility = eval_in.phys_mobility

    eval_obj.ment_teamwork = eval_in.ment_teamwork
    eval_obj.ment_attitude = eval_in.ment_attitude
    eval_obj.ment_learning = eval_in.ment_learning
    eval_obj.ment_fairplay = eval_in.ment_fairplay

    db.commit()
    db.refresh(eval_obj)
    return eval_obj


@router.post("/evaluations/{eval_id}/approve")
def approve_player_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.TEAM_ADMIN]:
        raise HTTPException(status_code=403, detail="Freigabe nur durch Admin oder Team-Admin gestattet.")

    eval_obj = db.query(PlayerEvaluation).filter(PlayerEvaluation.id == eval_id).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")

    player = db.query(Player).filter(Player.id == eval_obj.player_id).first()
    if player:
        check_player_edit_permission(current_user, player.team_id, db)

    eval_obj.is_approved = True
    eval_obj.approved_by_user_id = current_user.id
    eval_obj.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(eval_obj)
    return eval_obj


@router.delete("/evaluations/{eval_id}")
def delete_player_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    eval_obj = db.query(PlayerEvaluation).filter(PlayerEvaluation.id == eval_id).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")

    player = db.query(Player).filter(Player.id == eval_obj.player_id).first()
    if player:
        check_player_edit_permission(current_user, player.team_id, db)

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role_str not in [UserRole.ADMIN.value, UserRole.TEAM_ADMIN.value] and eval_obj.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Löschen nur durch den Ersteller, Admin oder Team-Admin gestattet.")

    db.delete(eval_obj)
    db.commit()
    return {"message": "Bewertung erfolgreich gelöscht"}
