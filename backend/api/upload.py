from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
import os
import shutil
import uuid

from db.session import get_db, UPLOAD_DIR
from models import VideoChunk, Match, User, Team, SystemSettings, UserRole
from .dependencies import require_team_admin
from services.thumbnail_service import generate_thumbnail
from services.notification_service import notify_subscribers, notify_users_new_video
from services.hls_service import generate_hls_playlist

router = APIRouter()

@router.post("/chunk")
async def upload_chunk(
    background_tasks: BackgroundTasks,
    match_id: str = Form(...),
    match_name: str = Form(None),
    team_name: str = Form(None),
    team_id: str = Form(None),
    category: str = Form("Punktspiel"),
    video_quality: str = Form(None),
    notify_user_ids: str = Form(None),
    timestamp: str = Form(None),
    video: UploadFile = File(...),
    tracking: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_admin)
):
    # If user is TEAM_ADMIN, verify that they are assigned to team_id
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
    if user_role_str == UserRole.TEAM_ADMIN.value:
        if not team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TeamAdmin muss eine zugewiesene Mannschaft beim Upload angeben."
            )
        assigned_team_ids = [t.id for t in current_user.teams]
        if team_id not in assigned_team_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Du bist nicht als TeamAdmin für diese Mannschaft berechtigt."
            )
    # System-Einstellungen laden
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()

    eff_video_quality = video_quality
    if not eff_video_quality and settings:
        eff_video_quality = settings.default_video_quality

    # Match-Ordner erstellen
    match_folder = os.path.join(UPLOAD_DIR, match_id)
    if not os.path.exists(match_folder):
        os.makedirs(match_folder, exist_ok=True)

    # Dateinamen generieren
    original_video_filename = f"raw_{uuid.uuid4()}_{video.filename}"
    tracking_filename = f"{uuid.uuid4()}_{tracking.filename}"

    original_video_path_abs = os.path.join(match_folder, original_video_filename)
    tracking_path_abs = os.path.join(match_folder, tracking_filename)

    # Dateien speichern
    with open(original_video_path_abs, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    with open(tracking_path_abs, "wb") as buffer:
        shutil.copyfileobj(tracking.file, buffer)

    final_video_filename = original_video_filename

    # Pfade für die Datenbank
    db_video_path = f"uploads/{match_id}/{final_video_filename}"
    db_tracking_path = f"uploads/{match_id}/{tracking_filename}"

    # Ist dies der erste Chunk für dieses Match?
    is_first_chunk = False

    # Resolution team_name from team_id if provided
    eff_team_name = team_name
    if team_id:
        team_obj = db.query(Team).filter(Team.id == team_id).first()
        if team_obj:
            eff_team_name = team_obj.name

    # Match in DB registrieren oder aktualisieren
    db_match = db.query(Match).filter(Match.id == match_id).first()
    if not db_match:
        db_match = Match(
            id=match_id,
            name=match_name if match_name else f"Match {match_id}",
            team_name=eff_team_name,
            team_id=team_id,
            category=category if category else "Punktspiel",
            video_quality=eff_video_quality
        )
        db.add(db_match)
        is_first_chunk = True
    else:
        # Falls Metadaten mitkommen, aktualisieren wir sie (z.B. beim ersten Chunk)
        if match_name:
            db_match.name = match_name
        if eff_team_name:
            db_match.team_name = eff_team_name
        if team_id:
            db_match.team_id = team_id
        if category:
            db_match.category = category
        if eff_video_quality:
            db_match.video_quality = eff_video_quality

        # Überprüfen, ob es wirklich der erste Chunk ist, auch wenn das Match schon existiert
        existing_chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).count()
        if existing_chunks == 0:
             is_first_chunk = True

    db.commit()

    should_hls = True
    if settings:
        should_hls = settings.module_hls_enabled and settings.auto_hls_conversion

    # Chunk registrieren
    db_chunk = VideoChunk(
        match_id=match_id,
        video_path=db_video_path,
        tracking_path=db_tracking_path,
        conversion_status="processing" if should_hls else "pending",
        conversion_progress=0
    )
    db.add(db_chunk)
    db.commit()
    db.refresh(db_chunk)

    # Wenn es der erste Chunk ist, generiere das Thumbnail im Hintergrund
    if is_first_chunk:
        background_tasks.add_task(generate_thumbnail, match_id)
        if notify_user_ids:
            user_id_list = [uid.strip() for uid in notify_user_ids.split(",") if uid.strip()]
            if user_id_list:
                effective_match_name = db_match.name if db_match.name else f"Match {match_id}"
                background_tasks.add_task(notify_users_new_video, user_id_list, match_id, effective_match_name, db)

    # Trigger HLS conversion in background if enabled in SystemSettings
    if should_hls:
        background_tasks.add_task(generate_hls_playlist, db_chunk.id)

    return {"status": "success", "chunk_id": db_chunk.id}