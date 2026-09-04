from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from db.session import get_db
from models import CalendarEvent, PushSubscription, TrainingSession, Team, User, UserRole, Player, PlayerAttendance
from api.dependencies import get_current_user, require_trainer
from services.fussball_de_service import fetch_and_parse_fussball_de_team_matches

router = APIRouter()

# --- Pydantic Schemas ---

class CalendarEventCreate(BaseModel):
    title: str
    event_type: str = "TRAINING"  # MATCH, TRAINING, MEETING, EVENT
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    is_home: bool = True
    opponent: Optional[str] = None
    team_id: Optional[str] = None
    team_ids: Optional[List[str]] = None  # Mehrfachzuweisung; team_id bleibt als Primärteam
    training_session_id: Optional[int] = None
    reminder_minutes: Optional[int] = 30
    notes: Optional[str] = None
    repeat_weekly: bool = False
    repeat_until: Optional[datetime] = None

from api.training import SessionResponse

class CalendarEventResponse(BaseModel):
    id: int
    title: str
    event_type: str
    start_time: datetime
    end_time: datetime
    location: Optional[str]
    is_home: bool
    opponent: Optional[str]
    team_id: Optional[str]
    team_ids: List[str] = []
    fussball_de_match_id: Optional[str]
    training_session_id: Optional[int]
    training_session: Optional[SessionResponse] = None
    reminder_minutes: Optional[int] = 30
    notes: Optional[str]
    created_by_user_id: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class FussballDeImportRequest(BaseModel):
    url_or_team_id: str
    team_id: str

class CalendarMatchesCleanupRequest(BaseModel):
    team_id: Optional[str] = None
    only_fussball_de: bool = False

class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

class PushUnsubscribeRequest(BaseModel):
    endpoint: str

class EventPlayerAttendanceItem(BaseModel):
    player_id: str
    status: str = "PRESENT"  # PRESENT, ABSENT, EXCUSED
    absence_reason: Optional[str] = None  # KRANKHEIT, PRIVATES, VERLETZUNG, SONSTIGES
    notes: Optional[str] = None

class EventAttendanceSaveRequest(BaseModel):
    attendances: List[EventPlayerAttendanceItem]

class EventPlayerAttendanceInfo(BaseModel):
    player_id: str
    first_name: str
    last_name: str
    jersey_number: Optional[int] = None
    position: Optional[str] = None
    team_id: Optional[str] = None
    status: Optional[str] = None  # PRESENT, ABSENT, EXCUSED or None
    absence_reason: Optional[str] = None
    notes: Optional[str] = None
    updated_at: Optional[datetime] = None

class EventAttendanceOverviewResponse(BaseModel):
    event_id: int
    event_title: str
    event_type: str
    event_date: datetime
    total_players: int
    present_count: int
    absent_count: int
    excused_count: int
    players: List[EventPlayerAttendanceInfo]


# Helper to check if current user is admin or assigned trainer with edit permission for team_id
def check_team_access(user: User, team_id: Optional[str], db: Session):
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role.upper() == "ADMIN":
        return True
    if not team_id:
        return True
    
    from sqlalchemy import text
    row = db.execute(
        text("SELECT can_edit FROM user_teams WHERE user_id = :uid AND team_id = :tid"),
        {"uid": user.id, "tid": team_id}
    ).fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf den Kalender dieses Teams."
        )

    can_edit = bool(row[0]) if row[0] is not None else True
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Du hast für dieses Team nur Leserechte und darfst keine Termine anlegen, bearbeiten oder löschen."
        )
    return True


def resolve_team_ids(event_in) -> List[str]:
    """Selected teams, accepting the legacy single team_id from older clients."""
    if event_in.team_ids is not None:
        ids = [t for t in event_in.team_ids if t]
    elif event_in.team_id:
        ids = [event_in.team_id]
    else:
        ids = []
    # de-duplicate, keep order (first entry stays the primary team)
    seen = set()
    return [t for t in ids if not (t in seen or seen.add(t))]


def check_team_access_multi(user: User, team_ids: List[str], db: Session):
    """Editing an event requires edit rights on every team it is assigned to."""
    if not team_ids:
        return check_team_access(user, None, db)
    for tid in team_ids:
        check_team_access(user, tid, db)
    return True


def apply_event_teams(event_obj: CalendarEvent, team_ids: List[str], db: Session):
    """Sets the many-to-many assignment and keeps team_id as the primary team."""
    teams = db.query(Team).filter(Team.id.in_(team_ids)).all() if team_ids else []
    found = {t.id for t in teams}
    missing = [t for t in team_ids if t not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unbekannte Team-ID(s): {', '.join(missing)}")

    # Preserve the given order so team_ids[0] stays the primary team.
    event_obj.teams = sorted(teams, key=lambda t: team_ids.index(t.id))
    event_obj.team_id = team_ids[0] if team_ids else None


# --- Endpoints ---

@router.get("/events", response_model=List[CalendarEventResponse])
def get_events(
    team_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CalendarEvent)

    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    user_team_ids = [t.id for t in current_user.teams]

    # Filter per team access for non-admins. Matching runs over the assignment table
    # so an event is visible to every team it was assigned to, not just the first.
    if role.upper() != "ADMIN":
        if user_team_ids:
            query = query.filter(
                CalendarEvent.teams.any(Team.id.in_(user_team_ids)) | ~CalendarEvent.teams.any()
            )
        else:
            query = query.filter(~CalendarEvent.teams.any())

    if team_id:
        query = query.filter(CalendarEvent.teams.any(Team.id == team_id))
    if event_type:
        query = query.filter(CalendarEvent.event_type == event_type)

    return query.order_by(CalendarEvent.start_time.asc()).all()


@router.post("/events", response_model=List[CalendarEventResponse])
def create_event(
    event_in: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    from datetime import timedelta
    team_ids = resolve_team_ids(event_in)
    check_team_access_multi(current_user, team_ids, db)

    created_events = []
    curr_start = event_in.start_time
    duration = event_in.end_time - event_in.start_time
    until_date = event_in.repeat_until if (event_in.repeat_weekly and event_in.repeat_until) else event_in.start_time

    # Generate events for each week up to repeat_until
    while curr_start <= until_date:
        curr_end = curr_start + duration
        event_obj = CalendarEvent(
            title=event_in.title,
            event_type=event_in.event_type,
            start_time=curr_start,
            end_time=curr_end,
            location=event_in.location,
            is_home=event_in.is_home,
            opponent=event_in.opponent,
            training_session_id=event_in.training_session_id,
            reminder_minutes=event_in.reminder_minutes,
            notes=event_in.notes,
            created_by_user_id=current_user.id
        )
        apply_event_teams(event_obj, team_ids, db)
        db.add(event_obj)
        created_events.append(event_obj)

        if not event_in.repeat_weekly or not event_in.repeat_until:
            break

        curr_start += timedelta(days=7)

    db.commit()
    for ev in created_events:
        db.refresh(ev)

    try:
        from services.notification_service import notify_team_new_event
        notify_team_new_event(created_events, current_user, db)
    except Exception as push_err:
        print(f"Error triggering new event push: {push_err}")

    return created_events


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: int,
    event_in: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    event_obj = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")

    # Rights are needed on the current teams as well as on the new ones, so a user
    # cannot move an event out of a team they are not allowed to edit.
    check_team_access_multi(current_user, event_obj.team_ids, db)

    update_data = event_in.dict(exclude_unset=True)
    # team_ids is a read-only property and team_id is derived from it, so both are
    # applied through apply_event_teams() instead of setattr().
    new_team_ids = resolve_team_ids(event_in) if (
        update_data.get("team_ids") is not None or update_data.get("team_id") is not None
    ) else None
    update_data.pop("team_ids", None)
    update_data.pop("team_id", None)

    for field, value in update_data.items():
        setattr(event_obj, field, value)

    # Explizite Aktualisierung oder Entfernung des verknüpften Trainingsplans
    if "training_session_id" in event_in.__fields_set__:
        event_obj.training_session_id = event_in.training_session_id
        if event_in.training_session_id is None:
            event_obj.training_session = None

    if new_team_ids is not None:
        check_team_access_multi(current_user, new_team_ids, db)
        apply_event_teams(event_obj, new_team_ids, db)

    db.commit()
    db.refresh(event_obj)
    return event_obj


class LinkTrainingSessionRequest(BaseModel):
    training_session_id: Optional[int] = None

@router.put("/events/{event_id}/training-session", response_model=CalendarEventResponse)
def link_training_session(
    event_id: int,
    req: LinkTrainingSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    event_obj = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")

    check_team_access_multi(current_user, event_obj.team_ids, db)

    event_obj.training_session_id = req.training_session_id
    if req.training_session_id is None:
        event_obj.training_session = None

    db.commit()
    db.refresh(event_obj)
    return event_obj


@router.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    delete_following: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    event_obj = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")

    check_team_access_multi(current_user, event_obj.team_ids, db)

    deleted_count = 1
    if delete_following and event_obj.title and event_obj.team_id:
        # Delete this and all future events with matching title and team_id starting from start_time
        future_events = db.query(CalendarEvent).filter(
            CalendarEvent.team_id == event_obj.team_id,
            CalendarEvent.title == event_obj.title,
            CalendarEvent.start_time >= event_obj.start_time
        ).all()
        for fev in future_events:
            db.delete(fev)
        deleted_count = len(future_events)
    else:
        db.delete(event_obj)

    db.commit()
    return {"message": f"{deleted_count} Termin(e) erfolgreich gelöscht", "deleted_count": deleted_count}


@router.post("/import/fussball-de")
def import_from_fussball_de(
    payload: FussballDeImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    check_team_access(current_user, payload.team_id, db)

    team_obj = db.query(Team).filter(Team.id == payload.team_id).first() if payload.team_id else None
    team_name = team_obj.name if team_obj else None

    parsed_matches = fetch_and_parse_fussball_de_team_matches(payload.url_or_team_id, target_team_name=team_name)
    if not parsed_matches:
        return {"imported_count": 0, "message": "Keine neuen Spiele gefunden oder Import fehlgeschlagen."}

    imported_count = 0
    updated_count = 0
    for match in parsed_matches:
        # Dubletten-Check: 1. nach fussball_de_match_id
        existing = db.query(CalendarEvent).filter(CalendarEvent.fussball_de_match_id == match["fussball_de_match_id"]).first()
        
        # 2. Falls fussball_de_match_id abweicht, prüfe nach gleichem Spielzeitpunkt + Team
        if not existing and payload.team_id:
            existing = db.query(CalendarEvent).filter(
                CalendarEvent.event_type == "MATCH",
                CalendarEvent.start_time == match["start_time"],
                CalendarEvent.teams.any(Team.id == payload.team_id)
            ).first()

        # 3. Oder nach gleichem Spielzeitpunkt + Gegner
        if not existing and match.get("opponent"):
            existing = db.query(CalendarEvent).filter(
                CalendarEvent.event_type == "MATCH",
                CalendarEvent.start_time == match["start_time"],
                CalendarEvent.opponent == match["opponent"]
            ).first()

        if existing:
            # Anstoßzeit und Spieldaten bei bestehenden Terminen aktualisieren
            existing.start_time = match["start_time"]
            existing.end_time = match["end_time"]
            existing.title = match["title"]
            existing.opponent = match.get("opponent", match["away_team"])
            existing.is_home = match["is_home"]
            existing.location = match.get("location", existing.location)
            existing.fussball_de_match_id = match["fussball_de_match_id"]
            if payload.team_id:
                apply_event_teams(existing, [payload.team_id], db)
            updated_count += 1
            continue

        event_obj = CalendarEvent(
            title=match["title"],
            event_type="MATCH",
            start_time=match["start_time"],
            end_time=match["end_time"],
            location=match.get("location") or "Sportplatz",
            is_home=match["is_home"],
            opponent=match.get("opponent", match["away_team"]),
            reminder_minutes=1440,  # 1 Tag Standard-Push für Spieltermine
            fussball_de_match_id=match["fussball_de_match_id"],
            created_by_user_id=current_user.id
        )
        # Also fill the assignment table - listing filters run over it, so an
        # imported match would otherwise count as having no team at all.
        apply_event_teams(event_obj, [payload.team_id] if payload.team_id else [], db)
        db.add(event_obj)
        imported_count += 1

    db.commit()
    msg = f"{imported_count} neue(s) Spiel(e) importiert"
    if updated_count > 0:
        msg += f", {updated_count} Spiel(e) mit Anstoßzeit aktualisiert"
    msg += "."
    return {"imported_count": imported_count, "updated_count": updated_count, "message": msg}


@router.post("/events-cleanup/matches")
@router.delete("/events-cleanup/matches")
def cleanup_match_events(
    payload: Optional[CalendarMatchesCleanupRequest] = None,
    team_id: Optional[str] = Query(None),
    only_fussball_de: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    """Löscht alle Spieltermine aus dem Organizer (optional gefiltert nach Team oder fussball.de Import)."""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_admin = (role.upper() == "ADMIN")

    target_team_id = (payload.team_id if payload and payload.team_id else team_id)
    target_only_fussball_de = (payload.only_fussball_de if payload and payload.only_fussball_de is not None else only_fussball_de)

    if target_team_id:
        check_team_access(current_user, target_team_id, db)
    elif not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Administratoren können Spieltermine aller Teams gleichzeitig bereinigen."
        )

    query = db.query(CalendarEvent)
    if target_only_fussball_de:
        query = query.filter(CalendarEvent.fussball_de_match_id.isnot(None))
    else:
        query = query.filter(
            (CalendarEvent.event_type == "MATCH") | (CalendarEvent.fussball_de_match_id.isnot(None))
        )

    if target_team_id:
        query = query.filter(
            CalendarEvent.teams.any(Team.id == target_team_id) | (CalendarEvent.team_id == target_team_id)
        )

    events_to_delete = query.all()
    deleted_count = len(events_to_delete)
    for ev in events_to_delete:
        db.delete(ev)

    db.commit()
    return {
        "deleted_count": deleted_count,
        "message": f"{deleted_count} Spieltermin(e) erfolgreich gelöscht."
    }


@router.post("/push/subscribe")
def subscribe_push(
    payload: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Register/Update Push Subscription
    sub = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == payload.endpoint
    ).first()

    if not sub:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.p256dh,
            auth=payload.auth
        )
        db.add(sub)
    else:
        # Refresh the stored keys: a browser may rotate them while keeping the same
        # endpoint, and without this a row with stale keys could never be repaired.
        sub.p256dh = payload.p256dh
        sub.auth = payload.auth

    db.commit()

    return {"status": "success", "message": "Push-Benachrichtigungen aktiviert."}


@router.post("/push/unsubscribe")
def unsubscribe_push(
    payload: PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Removes this device's push registration. Idempotent."""
    deleted = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == payload.endpoint
    ).delete(synchronize_session=False)
    db.commit()

    return {
        "status": "success",
        "deleted_count": deleted,
        "message": "Push-Benachrichtigungen deaktiviert."
    }


import os
import json

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "AMI9ABKmCQ_dgj3Qomgbi4mZUIQhAkN-d-UVgLCVsec")
VAPID_CLAIMS = {"sub": "mailto:admin@matchtrack.de"}



@router.post("/push/test")
def send_test_push(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).all()
    if not subs:
        raise HTTPException(status_code=400, detail="Keine Push-Registrierung gefunden. Bitte verknüpfe Push-Benachrichtigungen zuerst!")

    payload = json.dumps({
        "title": "⚽ MatchTrack Test-Push",
        "body": f"Hallo {current_user.first_name or current_user.username}! Deine Push-Benachrichtigungen funktionieren einwandfrei.",
        "url": "/organizer"
    })

    sent_count = 0
    try:
        from pywebpush import webpush, WebPushException
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth
                        }
                    },
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS
                )
                sent_count += 1
            except Exception as ex:
                print("Push send error:", ex)
    except ImportError:
        pass

    return {
        "status": "success",
        "sent_count": sent_count,
        "message": f"Test-Push an {sent_count} Gerät(e) gesendet." if sent_count > 0 else "Test-Push ausgelöst."
    }


# --- Event Attendance Endpoints ---

@router.get("/events/{event_id}/attendance", response_model=EventAttendanceOverviewResponse)
def get_event_attendance(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event_obj = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")

    assigned_team_ids = event_obj.team_ids
    if not assigned_team_ids and event_obj.team_id:
        assigned_team_ids = [event_obj.team_id]

    player_query = db.query(Player)
    if assigned_team_ids:
        player_query = player_query.filter(Player.team_id.in_(assigned_team_ids))
    players = player_query.order_by(Player.jersey_number.asc(), Player.last_name.asc(), Player.first_name.asc()).all()

    existing_att_records = db.query(PlayerAttendance).filter(PlayerAttendance.event_id == event_id).all()
    att_by_player_id = {att.player_id: att for att in existing_att_records}

    player_infos = []
    present_cnt = 0
    absent_cnt = 0
    excused_cnt = 0

    for p in players:
        att = att_by_player_id.get(p.id)
        st = att.status if att else None
        if st == "PRESENT":
            present_cnt += 1
        elif st == "ABSENT":
            absent_cnt += 1
        elif st == "EXCUSED":
            excused_cnt += 1

        player_infos.append(EventPlayerAttendanceInfo(
            player_id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            jersey_number=p.jersey_number,
            position=p.position,
            team_id=p.team_id,
            status=st,
            absence_reason=att.absence_reason if att else None,
            notes=att.notes if att else None,
            updated_at=att.created_at if att else None
        ))

    return EventAttendanceOverviewResponse(
        event_id=event_obj.id,
        event_title=event_obj.title,
        event_type=event_obj.event_type,
        event_date=event_obj.start_time,
        total_players=len(players),
        present_count=present_cnt,
        absent_count=absent_cnt,
        excused_count=excused_cnt,
        players=player_infos
    )


@router.post("/events/{event_id}/attendance")
def save_event_attendance(
    event_id: int,
    payload: EventAttendanceSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    event_obj = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")

    assigned_team_ids = event_obj.team_ids
    if not assigned_team_ids and event_obj.team_id:
        assigned_team_ids = [event_obj.team_id]
    if assigned_team_ids:
        check_team_access_multi(current_user, assigned_team_ids, db)

    existing_att_records = db.query(PlayerAttendance).filter(PlayerAttendance.event_id == event_id).all()
    existing_by_player_id = {att.player_id: att for att in existing_att_records}

    for item in payload.attendances:
        status_upper = item.status.upper() if item.status else "PRESENT"
        if item.player_id in existing_by_player_id:
            att = existing_by_player_id[item.player_id]
            att.status = status_upper
            att.absence_reason = item.absence_reason if status_upper != "PRESENT" else None
            att.notes = item.notes
            att.event_date = event_obj.start_time
            att.event_type = event_obj.event_type
        else:
            new_att = PlayerAttendance(
                player_id=item.player_id,
                event_id=event_id,
                event_date=event_obj.start_time,
                event_type=event_obj.event_type,
                status=status_upper,
                absence_reason=item.absence_reason if status_upper != "PRESENT" else None,
                notes=item.notes
            )
            db.add(new_att)

    db.commit()

    return {
        "status": "success",
        "message": f"Anwesenheit für {len(payload.attendances)} Spieler erfolgreich aktualisiert.",
        "event_id": event_id
    }

