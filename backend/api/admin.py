import os
import glob
import shutil
import uuid
import subprocess
import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi.responses import Response

from db.session import get_db, BASE_DIR, UPLOAD_DIR
from models import User, UserRole, Match, VideoChunk, SystemSettings, HeatmapStatus, StitchingStatus, Team, MatchEvent, TacticsBoard, TrainingSession, PlayerEvaluation, UserActivityLog
from pydantic import BaseModel
from .dependencies import require_admin, require_trainer
from core.security import get_password_hash
from services.notification_service import notify_user_approved, notify_users_new_video
from services.thumbnail_service import generate_thumbnail
from services.hls_service import generate_hls_playlist
from services.stitching_service import run_stitching
from services.backup_service import generate_sql_dump, upload_to_ftp, run_ftp_backup_job

router = APIRouter()

class TeamOut(BaseModel):
    id: str
    name: str
    age_group: Optional[str] = None
    can_edit: Optional[bool] = True

    class Config:
        orm_mode = True

class TeamPermissionItem(BaseModel):
    team_id: str
    can_edit: bool = True

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: UserRole
    is_approved: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    teams: List[TeamOut] = []
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    module_permissions: Optional[dict] = {}

    class Config:
        orm_mode = True

class UserTeamsUpdate(BaseModel):
    team_ids: Optional[List[str]] = None
    teams: Optional[List[TeamPermissionItem]] = None

class RoleUpdate(BaseModel):
    role: UserRole

class ModulePermissionsUpdate(BaseModel):
    module_permissions: dict

class ApprovalUpdate(BaseModel):
    is_approved: bool

class SystemSettingsOut(BaseModel):
    module_stitching_enabled: bool
    module_heatmap_enabled: bool
    module_video_color_enabled: bool
    module_hls_enabled: bool
    module_fisheye_enabled: bool
    module_ai_assistant_enabled: Optional[bool] = True
    default_resolution: str
    default_video_quality: str
    default_storage_path: str
    auto_hls_conversion: bool
    auto_stitching: bool
    show_push_test_button: Optional[bool] = False
    show_match_cleanup_button: Optional[bool] = False
    smtp_enabled: Optional[bool] = False
    smtp_host: Optional[str] = "smtp.example.com"
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_sender_email: Optional[str] = "noreply@matchtrack.de"
    smtp_use_tls: Optional[bool] = True

    ftp_enabled: Optional[bool] = False
    ftp_host: Optional[str] = ""
    ftp_port: Optional[int] = 21
    ftp_user: Optional[str] = ""
    ftp_password: Optional[str] = ""
    ftp_path: Optional[str] = "/backups"
    ftp_auto_backup: Optional[bool] = False
    ftp_backup_schedule: Optional[str] = "DAILY"
    ftp_last_backup_at: Optional[datetime] = None
    ftp_last_backup_status: Optional[str] = "NO_BACKUP_YET"

    class Config:
        orm_mode = True

class SystemSettingsUpdate(BaseModel):
    module_stitching_enabled: Optional[bool] = None
    module_heatmap_enabled: Optional[bool] = None
    module_video_color_enabled: Optional[bool] = None
    module_hls_enabled: Optional[bool] = None
    module_fisheye_enabled: Optional[bool] = None
    module_ai_assistant_enabled: Optional[bool] = None
    default_resolution: Optional[str] = None
    default_video_quality: Optional[str] = None
    default_storage_path: Optional[str] = None
    auto_hls_conversion: Optional[bool] = None
    auto_stitching: Optional[bool] = None
    show_push_test_button: Optional[bool] = None
    show_match_cleanup_button: Optional[bool] = None
    smtp_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender_email: Optional[str] = None
    smtp_use_tls: Optional[bool] = None

    ftp_enabled: Optional[bool] = None
    ftp_host: Optional[str] = None
    ftp_port: Optional[int] = None
    ftp_user: Optional[str] = None
    ftp_password: Optional[str] = None
    ftp_path: Optional[str] = None
    ftp_auto_backup: Optional[bool] = None
    ftp_backup_schedule: Optional[str] = None

from .dependencies import require_admin, require_viewer

@router.get("/settings", response_model=SystemSettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(require_viewer)):
    settings = db.query(SystemSettings).first()
    if not settings:
        # Create default settings if not exist
        settings = SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=SystemSettingsOut)
def update_settings(settings_update: SystemSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)
    
    update_data = settings_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    return settings

class TestEmailRequest(BaseModel):
    email: Optional[str] = None
    smtp_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender_email: Optional[str] = None
    smtp_use_tls: Optional[bool] = None

@router.post("/test-email")
def send_test_email(payload: TestEmailRequest = TestEmailRequest(), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    target_email = payload.email if payload and payload.email else current_user.email
    if not target_email:
        raise HTTPException(status_code=400, detail="Keine Ziel-E-Mail-Adresse angegeben.")
    
    from services.notification_service import send_email
    subject = "MatchTracker: SMTP Test-E-Mail"
    body = f"Hallo {current_user.username},\n\nDies ist eine Test-E-Mail von deinem MatchTracker System.\nDeine SMTP-Konfiguration funktioniert einwandfrei!\n\nDein MatchTracker System"
    
    custom_cfg = None
    if payload and payload.smtp_host:
        custom_cfg = payload.dict(exclude_unset=True)

    try:
        send_email(target_email, subject, body, db, custom_cfg=custom_cfg)
        return {"status": "success", "message": "Thumbnails regeneration queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Database Backup Endpoints ---

@router.get("/backup/download-sql")
def download_sql_backup(current_user: User = Depends(require_admin)):
    """
    Generiert und streamed einen vollständigen SQLite SQL-Dump als Download-Datei.
    """
    try:
        sql_dump = generate_sql_dump()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"matchtrack_backup_{timestamp}.sql"

        return Response(
            content=sql_dump.encode('utf-8'),
            media_type="application/sql",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Erstellen des SQL-Dumps: {str(e)}")


@router.post("/backup/trigger-ftp")
def trigger_ftp_backup(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """
    Führt sofort ein manuelles FTP-Backup mit den in SystemSettings gespeicherten FTP-Zugangsdaten aus.
    """
    try:
        res = run_ftp_backup_job(db)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TestFtpRequest(BaseModel):
    host: str
    port: Optional[int] = 21
    user: str
    password: Optional[str] = ""
    path: Optional[str] = "/backups"


@router.post("/backup/test-ftp")
def test_ftp_connection(payload: TestFtpRequest, current_user: User = Depends(require_admin)):
    """
    Testet die FTP-Verbindung und Zugangsdaten.
    """
    try:
        test_content = f"-- MatchTrack FTP Test {datetime.utcnow().isoformat()}".encode('utf-8')
        upload_to_ftp(
            host=payload.host,
            port=payload.port or 21,
            user=payload.user,
            password=payload.password or "",
            remote_path=payload.path or "/backups",
            filename=".matchtrack_ftp_test.txt",
            content=test_content
        )
        return {"status": "success", "message": "FTP-Verbindung und Schreibrechte erfolgreich getestet!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"FTP-Verbindung fehlgeschlagen: {str(e)}")

class UserCreateAdmin(BaseModel):
    username: str
    email: str
    password: str
    role: UserRole = UserRole.TRAINER
    first_name: str
    last_name: str
    team_ids: List[str] = []

@router.post("/users", response_model=UserOut, status_code=201)
def admin_create_user(user: UserCreateAdmin, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Check if user already exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_email = db.query(User).filter(User.email == user.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = User(
        id=str(uuid.uuid4()),
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        is_approved=1 # Admins created users are auto-approved
    )
    if user.team_ids:
        teams = db.query(Team).filter(Team.id.in_(user.team_ids)).all()
        new_user.teams = teams

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    new_user.is_approved = bool(new_user.is_approved)
    return new_user

@router.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from sqlalchemy import text
    users = db.query(User).all()
    # Query all user_team permissions map
    ut_rows = db.execute(text("SELECT user_id, team_id, can_edit FROM user_teams")).fetchall()
    perm_map = {(row[0], row[1]): bool(row[2]) if row[2] is not None else True for row in ut_rows}

    result = []
    for u in users:
        teams_out = []
        for t in u.teams:
            teams_out.append({
                "id": t.id,
                "name": t.name,
                "age_group": t.age_group,
                "can_edit": perm_map.get((u.id, t.id), True)
            })
        
        user_dict = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_approved": bool(u.is_approved),
            "created_at": u.created_at,
            "last_login": u.last_login,
            "teams": teams_out,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "module_permissions": u.module_permissions or {}
        }
        result.append(user_dict)

    return result

@router.get("/online-stats")
def get_online_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """
    Liefert für Admins die Anzahl der aktuell aktiven Benutzer (Login/Aktivität in den letzten 15 Minuten).
    """
    cutoff = datetime.utcnow() - timedelta(minutes=15)
    online_users = db.query(User).filter(User.last_login >= cutoff).all()
    return {
        "online_count": len(online_users),
        "online_users": [
            {
                "id": u.id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "last_login": u.last_login
            }
            for u in online_users
        ]
    }

@router.put("/users/{user_id}/approve", response_model=UserOut)
def update_user_approval(user_id: str, approval: ApprovalUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    was_already_approved = bool(user_to_update.is_approved)
    user_to_update.is_approved = 1 if approval.is_approved else 0
    db.commit()
    db.refresh(user_to_update)

    if approval.is_approved and not was_already_approved:
        try:
            notify_user_approved(user_to_update, db)
        except Exception as e:
            print(f"Error sending approval notification: {e}")

    user_to_update.is_approved = bool(user_to_update.is_approved)
    return user_to_update

@router.put("/users/{user_id}/role", response_model=UserOut)
def update_user_role(user_id: str, role_update: RoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_update.id == current_user.id and role_update.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Admins cannot demote themselves.")

    user_to_update.role = role_update.role
    db.commit()
    db.refresh(user_to_update)
    return user_to_update

@router.put("/users/{user_id}/permissions", response_model=UserOut)
def update_user_module_permissions(
    user_id: str,
    perm_update: ModulePermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    user_to_update.module_permissions = perm_update.module_permissions
    db.commit()
    db.refresh(user_to_update)
    user_to_update.is_approved = bool(user_to_update.is_approved)
    return user_to_update

@router.put("/users/{user_id}/teams", response_model=UserOut)
def update_user_teams(user_id: str, teams_update: UserTeamsUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from sqlalchemy import text
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    # Determine teams and permissions
    perm_dict = {}
    if teams_update.teams is not None:
        target_team_ids = [item.team_id for item in teams_update.teams]
        perm_dict = {item.team_id: item.can_edit for item in teams_update.teams}
    elif teams_update.team_ids is not None:
        target_team_ids = teams_update.team_ids
        perm_dict = {tid: True for tid in target_team_ids}
    else:
        target_team_ids = []

    teams = db.query(Team).filter(Team.id.in_(target_team_ids)).all()
    user_to_update.teams = teams
    db.commit()

    # Update can_edit column in user_teams table for each assigned team
    for tid, can_edit in perm_dict.items():
        db.execute(
            text("UPDATE user_teams SET can_edit = :can_edit WHERE user_id = :uid AND team_id = :tid"),
            {"can_edit": 1 if can_edit else 0, "uid": user_id, "tid": tid}
        )
    db.commit()
    db.refresh(user_to_update)

    # Re-build output with permissions
    teams_out = []
    for t in user_to_update.teams:
        teams_out.append({
            "id": t.id,
            "name": t.name,
            "age_group": t.age_group,
            "can_edit": perm_dict.get(t.id, True)
        })

    user_dict = {
        "id": user_to_update.id,
        "username": user_to_update.username,
        "email": user_to_update.email,
        "role": user_to_update.role,
        "is_approved": bool(user_to_update.is_approved),
        "created_at": user_to_update.created_at,
        "last_login": user_to_update.last_login,
        "teams": teams_out,
        "first_name": user_to_update.first_name,
        "last_name": user_to_update.last_name,
        "module_permissions": user_to_update.module_permissions or {}
    }
    return user_dict

@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account.")

    db.delete(user_to_delete)
    db.commit()
    return {"status": "success", "message": f"User {user_id} deleted"}

@router.delete("/matches/{match_id}", status_code=204)
def delete_match(match_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match_folder = os.path.join(UPLOAD_DIR, match_id)
    db.delete(match)
    db.commit()

    if os.path.exists(match_folder):
        try:
            shutil.rmtree(match_folder)
        except Exception as e:
            print(f"ERROR: Failed to delete files for match {match_id}: {e}")

    return {"status": "success", "message": f"Match {match_id} and all data deleted"}

# --- Manual Match Upload for Admins ---

@router.post("/matches", status_code=201)
async def upload_full_match(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    team_name: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    category: Optional[str] = Form("Punktspiel"),
    age_group: Optional[str] = Form(None),
    recording_date: Optional[str] = Form(None),
    notify_user_ids: Optional[str] = Form(None), # Comma separated list of user IDs
    aspect_ratio: Optional[str] = Form("16:9"), # "16:9", "32:9", "dual"
    skip_conversion: Optional[bool] = Form(False),
    video_file: Optional[UploadFile] = File(None),
    video_file_16x9: Optional[UploadFile] = File(None),
    video_file_32x9: Optional[UploadFile] = File(None),
    tracking_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # 0. Load System Settings
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    match_id = str(uuid.uuid4())
    
    # 1. Metadaten vorbereiten
    rec_date_dt = None
    if recording_date:
        try:
            rec_date_dt = datetime.fromisoformat(recording_date)
        except Exception as e:
            print(f"Error parsing recording date: {e}")

    eff_team_name = team_name
    if team_id:
        team_ids = [tid.strip() for tid in team_id.split(",") if tid.strip()]
        if team_ids:
            matched_teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
            if matched_teams and not eff_team_name:
                team_map = {t.id: t.name for t in matched_teams}
                ordered_names = [team_map[tid] for tid in team_ids if tid in team_map]
                eff_team_name = ", ".join(ordered_names)

    # 2. Match SOFORT in der Datenbank anlegen
    new_match = Match(
        id=match_id,
        name=name,
        team_name=eff_team_name,
        team_id=team_id,
        category=category if category else "Punktspiel",
        age_group=age_group,
        recording_date=rec_date_dt,
        video_quality=settings.default_video_quality, # Use default from settings
        stitching_status="NONE",
        stitching_time_offset=0
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)

    try:
        # 3. Ordner und Pfade vorbereiten
        match_folder = os.path.join(UPLOAD_DIR, match_id)
        os.makedirs(match_folder, exist_ok=True)

        is_pano = aspect_ratio in ["panorama", "pano", "32:9", "32x9"]
        file_16x9 = video_file_16x9 or (video_file if not is_pano else None)
        file_32x9 = video_file_32x9 or (video_file if is_pano else None)

        if not file_16x9 and not file_32x9:
            raise HTTPException(status_code=400, detail="Mindestens eine Videodatei (Standard oder Panorama) muss hochgeladen werden.")

        chunks_created = []

        # 4. 16:9 Video verarbeiten
        if file_16x9:
            fn_16x9 = f"raw_{uuid.uuid4()}_{file_16x9.filename}"
            path_16x9_abs = os.path.join(match_folder, fn_16x9)
            with open(path_16x9_abs, "wb") as buffer:
                shutil.copyfileobj(file_16x9.file, buffer)

            size_16x9_mb = int(os.path.getsize(path_16x9_abs) / (1024 * 1024))
            chunk_16x9 = VideoChunk(
                match_id=match_id,
                video_path=f"uploads/{match_id}/{fn_16x9}",
                file_size_mb=size_16x9_mb,
                conversion_status="processing" if settings.auto_hls_conversion else "pending",
                conversion_progress=0
            )
            if tracking_file:
                tracking_filename = f"{uuid.uuid4()}_{tracking_file.filename}"
                tracking_path_abs = os.path.join(match_folder, tracking_filename)
                with open(tracking_path_abs, "wb") as buffer:
                    shutil.copyfileobj(tracking_file.file, buffer)
                chunk_16x9.tracking_path = f"uploads/{match_id}/{tracking_filename}"

            db.add(chunk_16x9)
            db.commit()
            db.refresh(chunk_16x9)
            chunks_created.append(chunk_16x9)

        # 5. 32:9 Video verarbeiten
        if file_32x9:
            fn_32x9 = "panorama_32x9.mp4"
            path_32x9_abs = os.path.join(match_folder, fn_32x9)
            with open(path_32x9_abs, "wb") as buffer:
                shutil.copyfileobj(file_32x9.file, buffer)

            size_32x9_mb = int(os.path.getsize(path_32x9_abs) / (1024 * 1024))
            chunk_32x9 = VideoChunk(
                match_id=match_id,
                video_path=f"uploads/{match_id}/{fn_32x9}",
                file_size_mb=size_32x9_mb,
                conversion_status="processing" if settings.auto_hls_conversion else "pending",
                conversion_progress=0
            )
            if tracking_file and not file_16x9:
                tracking_filename = f"{uuid.uuid4()}_{tracking_file.filename}"
                tracking_path_abs = os.path.join(match_folder, tracking_filename)
                with open(tracking_path_abs, "wb") as buffer:
                    shutil.copyfileobj(tracking_file.file, buffer)
                chunk_32x9.tracking_path = f"uploads/{match_id}/{tracking_filename}"

            db.add(chunk_32x9)
            db.commit()
            db.refresh(chunk_32x9)
            chunks_created.append(chunk_32x9)

        # 6. Thumbnail Generierung starten
        background_tasks.add_task(generate_thumbnail, match_id)
        
        # 7. HLS Konvertierung für alle Chunks anstoßen
        if settings.module_hls_enabled and settings.auto_hls_conversion:
            for ch in chunks_created:
                background_tasks.add_task(generate_hls_playlist, ch.id, None, skip_conversion)

        # 8. Benachrichtigungen senden
        if notify_user_ids:
            user_id_list = [uid.strip() for uid in notify_user_ids.split(",") if uid.strip()]
            if user_id_list:
                background_tasks.add_task(notify_users_new_video, user_id_list, match_id, name, db)

        return {"status": "success", "message": f"Match {match_id} created successfully.", "match_id": match_id}

    except Exception as e:
        error_msg = f"Fehler beim Verarbeiten der Dateien für Match {match_id}: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/matches/{match_id}/replace-video", status_code=200)
async def replace_match_video(
    match_id: str,
    background_tasks: BackgroundTasks,
    name: Optional[str] = Form(None),
    team_name: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    age_group: Optional[str] = Form(None),
    recording_date: Optional[str] = Form(None),
    aspect_ratio: Optional[str] = Form("16:9"),
    skip_conversion: Optional[bool] = Form(False),
    video_file: Optional[UploadFile] = File(None),
    video_file_16x9: Optional[UploadFile] = File(None),
    video_file_32x9: Optional[UploadFile] = File(None),
    tracking_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Ersetzt oder erweitert das Video eines existierenden Matches (16:9 Standard, 32:9 Panorama oder Dual).
    Unterstützt das gezielte Ersetzen einzelner Video-Perspektiven oder das nachträgliche Hinzufügen einer weiteren Perspektive.
    Aktualisiert gleichzeitig übergebene Match-Metadaten.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden.")

    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    try:
        # 1. Match-Metadaten aktualisieren falls übermittelt
        if name and name.strip():
            match.name = name.strip()
        if team_name is not None:
            match.team_name = team_name
        if team_id is not None:
            match.team_id = team_id
        if category is not None:
            match.category = category
        if age_group is not None:
            match.age_group = age_group
        if recording_date:
            try:
                clean_date = recording_date.replace("Z", "+00:00")
                match.recording_date = datetime.fromisoformat(clean_date)
            except Exception as de:
                print(f"Warnung: recording_date konnte nicht geparst werden ({recording_date}): {de}")

        match_folder = os.path.join(UPLOAD_DIR, match_id)
        os.makedirs(match_folder, exist_ok=True)

        is_pano = aspect_ratio in ["panorama", "pano", "32:9", "32x9"]
        file_16x9 = video_file_16x9 or (video_file if not is_pano else None)
        file_32x9 = video_file_32x9 or (video_file if is_pano else None)

        # Wenn weder Video noch Tracking hochgeladen wird, nur Metadaten speichern
        if not file_16x9 and not file_32x9 and not tracking_file:
            db.commit()
            return {"status": "success", "message": "Match-Metadaten erfolgreich aktualisiert.", "match_id": match_id}

        existing_chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
        chunks_created = []

        # 2. 16:9 Standard-Video ersetzen / anlegen
        if file_16x9:
            old_std_chunks = [c for c in existing_chunks if "panorama_32x9" not in (c.video_path or "")]
            for old_c in old_std_chunks:
                if old_c.video_path:
                    old_file_abs = os.path.join(BASE_DIR, old_c.video_path.replace('backend/', '', 1))
                    if os.path.exists(old_file_abs):
                        try:
                            os.remove(old_file_abs)
                        except Exception as e:
                            print(f"Fehler beim Löschen des alten Standard-Videos {old_file_abs}: {e}")
                    old_base = os.path.splitext(os.path.basename(old_file_abs))[0]
                    old_abr = os.path.join(match_folder, f"{old_base}_abr")
                    if os.path.exists(old_abr):
                        shutil.rmtree(old_abr, ignore_errors=True)
                    old_temp = os.path.join(match_folder, f"{old_base}_temp_hls.m3u8")
                    if os.path.exists(old_temp):
                        try:
                            os.remove(old_temp)
                        except Exception:
                            pass
                    for ts in glob.glob(os.path.join(match_folder, f"{old_base}_temp_*.ts")):
                        try:
                            os.remove(ts)
                        except Exception:
                            pass
                db.delete(old_c)

            fn_16x9 = f"raw_{uuid.uuid4()}_{file_16x9.filename}"
            path_16x9_abs = os.path.join(match_folder, fn_16x9)
            with open(path_16x9_abs, "wb") as buffer:
                shutil.copyfileobj(file_16x9.file, buffer)

            size_16x9_mb = int(os.path.getsize(path_16x9_abs) / (1024 * 1024))
            chunk_16x9 = VideoChunk(
                match_id=match_id,
                video_path=f"uploads/{match_id}/{fn_16x9}",
                file_size_mb=size_16x9_mb,
                conversion_status="processing" if settings.auto_hls_conversion else "pending",
                conversion_progress=0
            )
            if tracking_file:
                tracking_filename = f"{uuid.uuid4()}_{tracking_file.filename}"
                tracking_path_abs = os.path.join(match_folder, tracking_filename)
                with open(tracking_path_abs, "wb") as buffer:
                    shutil.copyfileobj(tracking_file.file, buffer)
                chunk_16x9.tracking_path = f"uploads/{match_id}/{tracking_filename}"

            db.add(chunk_16x9)
            db.commit()
            db.refresh(chunk_16x9)
            chunks_created.append(chunk_16x9)

        # 3. 32:9 Panorama-Video ersetzen / anlegen
        if file_32x9:
            old_pano_chunks = [c for c in existing_chunks if "panorama_32x9" in (c.video_path or "")]
            for old_c in old_pano_chunks:
                if old_c.video_path:
                    old_file_abs = os.path.join(BASE_DIR, old_c.video_path.replace('backend/', '', 1))
                    if os.path.exists(old_file_abs):
                        try:
                            os.remove(old_file_abs)
                        except Exception as e:
                            print(f"Fehler beim Löschen des alten Panorama-Videos {old_file_abs}: {e}")
                    old_base = os.path.splitext(os.path.basename(old_file_abs))[0]
                    old_abr = os.path.join(match_folder, f"{old_base}_abr")
                    if os.path.exists(old_abr):
                        shutil.rmtree(old_abr, ignore_errors=True)
                    old_temp = os.path.join(match_folder, f"{old_base}_temp_hls.m3u8")
                    if os.path.exists(old_temp):
                        try:
                            os.remove(old_temp)
                        except Exception:
                            pass
                    for ts in glob.glob(os.path.join(match_folder, f"{old_base}_temp_*.ts")):
                        try:
                            os.remove(ts)
                        except Exception:
                            pass
                db.delete(old_c)

            pano_fixed_path = os.path.join(match_folder, "panorama_32x9.mp4")
            if os.path.exists(pano_fixed_path):
                try:
                    os.remove(pano_fixed_path)
                except Exception:
                    pass

            fn_32x9 = "panorama_32x9.mp4"
            path_32x9_abs = os.path.join(match_folder, fn_32x9)
            with open(path_32x9_abs, "wb") as buffer:
                shutil.copyfileobj(file_32x9.file, buffer)

            size_32x9_mb = int(os.path.getsize(path_32x9_abs) / (1024 * 1024))
            chunk_32x9 = VideoChunk(
                match_id=match_id,
                video_path=f"uploads/{match_id}/{fn_32x9}",
                file_size_mb=size_32x9_mb,
                conversion_status="processing" if settings.auto_hls_conversion else "pending",
                conversion_progress=0
            )
            if tracking_file and not file_16x9:
                tracking_filename = f"{uuid.uuid4()}_{tracking_file.filename}"
                tracking_path_abs = os.path.join(match_folder, tracking_filename)
                with open(tracking_path_abs, "wb") as buffer:
                    shutil.copyfileobj(tracking_file.file, buffer)
                chunk_32x9.tracking_path = f"uploads/{match_id}/{tracking_filename}"

            db.add(chunk_32x9)
            db.commit()
            db.refresh(chunk_32x9)
            chunks_created.append(chunk_32x9)

        match.stitching_status = StitchingStatus.NONE
        db.commit()

        # 4. Hintergrundtasks starten
        if chunks_created:
            background_tasks.add_task(generate_thumbnail, match_id)
            if settings.module_hls_enabled and settings.auto_hls_conversion:
                for ch in chunks_created:
                    background_tasks.add_task(generate_hls_playlist, ch.id, None, skip_conversion)

        return {"status": "success", "message": "Video(s) & Match erfolgreich aktualisiert.", "match_id": match_id}

    except Exception as e:
        error_msg = f"Fehler beim Ersetzen/Aktualisieren des Videos für Match {match_id}: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)

@router.delete("/matches/{match_id}/streams/{stream_id}", status_code=200)
async def delete_match_stream(
    match_id: str,
    stream_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    """
    Löscht eine einzelne Videospur (Standard oder Panorama) aus einem Match.
    Entfernt die zugehörigen Dateien (Raw-Video, HLS-Segmentierung etc.) und DB-Einträge (VideoChunk),
    behält jedoch das Match, Events, Kommentare und die andere Videospur bei.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden.")

    is_pano = stream_id.lower() in ["32x9", "panorama", "pano", "32:9"]
    is_std = stream_id.lower() in ["16x9", "standard", "std", "16:9"]

    if not is_pano and not is_std:
        raise HTTPException(status_code=400, detail="Ungültiger stream_id. Erlaubt sind '16x9', 'standard', '32x9', 'panorama'.")

    match_folder = os.path.join(UPLOAD_DIR, match_id)
    chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()

    if is_std:
        std_chunks = [c for c in chunks if "panorama_32x9" not in (c.video_path or "")]
        for c in std_chunks:
            if c.video_path:
                file_abs = os.path.join(BASE_DIR, c.video_path.replace('backend/', '', 1))
                if os.path.exists(file_abs):
                    try:
                        os.remove(file_abs)
                    except Exception as e:
                        print(f"Fehler beim Löschen des Standard-Videos {file_abs}: {e}")

                base_name = os.path.splitext(os.path.basename(file_abs))[0]
                abr_dir = os.path.join(match_folder, f"{base_name}_abr")
                if os.path.exists(abr_dir):
                    shutil.rmtree(abr_dir, ignore_errors=True)
                temp_m3u8 = os.path.join(match_folder, f"{base_name}_temp_hls.m3u8")
                if os.path.exists(temp_m3u8):
                    try:
                        os.remove(temp_m3u8)
                    except Exception:
                        pass
                for ts in glob.glob(os.path.join(match_folder, f"{base_name}_temp_*.ts")):
                    try:
                        os.remove(ts)
                    except Exception:
                        pass
            db.delete(c)

    if is_pano:
        pano_chunks = [c for c in chunks if "panorama_32x9" in (c.video_path or "")]
        for c in pano_chunks:
            if c.video_path:
                file_abs = os.path.join(BASE_DIR, c.video_path.replace('backend/', '', 1))
                if os.path.exists(file_abs):
                    try:
                        os.remove(file_abs)
                    except Exception as e:
                        print(f"Fehler beim Löschen des Panorama-Videos {file_abs}: {e}")

                base_name = os.path.splitext(os.path.basename(file_abs))[0]
                abr_dir = os.path.join(match_folder, f"{base_name}_abr")
                if os.path.exists(abr_dir):
                    shutil.rmtree(abr_dir, ignore_errors=True)
                temp_m3u8 = os.path.join(match_folder, f"{base_name}_temp_hls.m3u8")
                if os.path.exists(temp_m3u8):
                    try:
                        os.remove(temp_m3u8)
                    except Exception:
                        pass
                for ts in glob.glob(os.path.join(match_folder, f"{base_name}_temp_*.ts")):
                    try:
                        os.remove(ts)
                    except Exception:
                        pass
            db.delete(c)

        pano_fixed_path = os.path.join(match_folder, "panorama_32x9.mp4")
        if os.path.exists(pano_fixed_path):
            try:
                os.remove(pano_fixed_path)
            except Exception:
                pass
        pano_abr = os.path.join(match_folder, "panorama_32x9_abr")
        if os.path.exists(pano_abr):
            shutil.rmtree(pano_abr, ignore_errors=True)

    db.commit()

    # Thumbnail aktualisieren, falls noch ein Video vorhanden ist
    remaining_chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
    has_remaining_pano = os.path.exists(os.path.join(match_folder, "panorama_32x9.mp4")) or any("panorama_32x9" in (c.video_path or "") for c in remaining_chunks)
    has_remaining_std = any("panorama_32x9" not in (c.video_path or "") for c in remaining_chunks)

    if has_remaining_std or has_remaining_pano:
        background_tasks.add_task(generate_thumbnail, match_id)

    stream_label = "Panorama" if is_pano else "Standard"
    return {
        "status": "success",
        "message": f"{stream_label}-Video erfolgreich gelöscht.",
        "match_id": match_id,
        "remaining_streams": {
            "has_16x9": has_remaining_std,
            "has_32x9": has_remaining_pano
        }
    }

@router.post("/regenerate-thumbnails", status_code=200)
async def regenerate_all_thumbnails(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Startet die Thumbnail-Generierung für alle Matches neu.
    Läuft im Hintergrund, damit der Request nicht blockiert.
    """
    matches = db.query(Match).all()

    for match in matches:
        background_tasks.add_task(generate_thumbnail, match.id)

    return {
        "status": "success",
        "message": f"Thumbnail generation started in background for {len(matches)} matches."
    }

@router.post("/matches/{match_id}/regenerate-thumbnail", status_code=200)
async def regenerate_single_thumbnail(
    match_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Startet die Thumbnail-Generierung für ein einzelnes Match neu.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    background_tasks.add_task(generate_thumbnail, match.id)

    return {
        "status": "success",
        "message": f"Thumbnail generation started in background for match {match_id}."
    }

# ==============================================================================
# Admin System Update Endpoints
# ==============================================================================

@router.get("/updates/check")
async def check_system_updates(current_user: User = Depends(require_admin)):
    """
    Führt 'git fetch' aus und vergleicht den lokalen Commit mit origin/main.
    """
    try:
        project_dir = os.path.abspath(os.path.join(BASE_DIR, ".."))
        release_url = "https://github.com/soko-grafik/MatchTrackOnline-Release.git"
        
        # Ensure origin points to MatchTrackOnline-Release
        subprocess.run(["git", "remote", "set-url", "origin", release_url], cwd=project_dir, capture_output=True, text=True, check=False)

        # Git fetch ausführen
        subprocess.run(["git", "fetch", "origin", "main"], cwd=project_dir, capture_output=True, text=True, check=False)

        # Lokalen Commit hash & Nachricht holen
        local_hash = subprocess.run(["git", "rev-parse", "HEAD"], cwd=project_dir, capture_output=True, text=True, check=False).stdout.strip()
        local_msg = subprocess.run(["git", "log", "-1", "--pretty=%B"], cwd=project_dir, capture_output=True, text=True, check=False).stdout.strip()

        # Remote Commit hash & Nachricht holen
        remote_hash = subprocess.run(["git", "rev-parse", "origin/main"], cwd=project_dir, capture_output=True, text=True, check=False).stdout.strip()
        remote_msg = subprocess.run(["git", "log", "-1", "origin/main", "--pretty=%B"], cwd=project_dir, capture_output=True, text=True, check=False).stdout.strip()

        # Anzahl der ausstehenden Commits
        behind_count_res = subprocess.run(["git", "rev-list", "--count", "HEAD..origin/main"], cwd=project_dir, capture_output=True, text=True, check=False)
        commits_behind = int(behind_count_res.stdout.strip()) if behind_count_res.stdout.strip().isdigit() else 0

        update_available = local_hash != remote_hash and commits_behind > 0

        return {
            "update_available": update_available,
            "commits_behind": commits_behind,
            "local_commit": local_hash[:7] if local_hash else "Unbekannt",
            "local_message": local_msg,
            "remote_commit": remote_hash[:7] if remote_hash else "Unbekannt",
            "remote_message": remote_msg,
            "checked_at": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "update_available": False,
            "error": str(e),
            "commits_behind": 0,
            "checked_at": datetime.now().isoformat()
        }

def run_admin_update_background():
    project_dir = os.path.abspath(os.path.join(BASE_DIR, ".."))
    backend_dir = os.path.abspath(BASE_DIR)
    script_path = os.path.join(backend_dir, "admin_update.sh")
    log_file = "/tmp/matchtrack_update.log"
    
    # Log-Datei leeren/erstellen
    with open(log_file, "w") as f:
        f.write(f"=== UPDATE PROZESS GESTARTET AT {datetime.now()} ===\n")

    if os.path.exists(script_path):
        os.chmod(script_path, 0o755)
        subprocess.Popen(["bash", script_path], cwd=backend_dir)
    else:
        # Fallback inline Bash execution
        cmd = f"cd '{project_dir}' && git remote set-url origin https://github.com/soko-grafik/MatchTrackOnline-Release.git && git fetch origin main && git reset --hard origin/main && cd web && npm install --silent && npm run build && pm2 reload all >> {log_file} 2>&1"
        subprocess.Popen(cmd, shell=True)

@router.post("/updates/apply")
async def apply_system_updates(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin)
):
    """
    Startet den Update-Prozess im Hintergrund via admin_update.sh.
    """
    background_tasks.add_task(run_admin_update_background)
    return {"status": "started", "message": "Update-Prozess wurde im Hintergrund gestartet."}

@router.get("/updates/status")
async def get_update_status(current_user: User = Depends(require_admin)):
    """
    Liest den aktuellen Fortschritt aus der Log-Datei /tmp/matchtrack_update.log aus.
    """
    log_file = "/tmp/matchtrack_update.log"
    if not os.path.exists(log_file):
        return {"status": "idle", "log": "Noch kein Update-Prozess gestartet."}

    try:
        with open(log_file, "r") as f:
            log_content = f.read()

        is_completed = "UPDATE COMPLETED SUCCESSFULLY" in log_content or "UPDATE ERFOLGREICH" in log_content
        is_error = "Error" in log_content and not is_completed

        status = "completed" if is_completed else ("error" if is_error else "running")

        return {
            "status": status,
            "log": log_content[-3000:] # Die letzten 3000 Zeichen des Logs
        }
    except Exception as e:
        return {"status": "error", "log": f"Fehler beim Lesen des Logfiles: {str(e)}"}

@router.get("/system/changelog")
async def get_system_changelog():
    """
    Gibt die letzten Git Commits und Build-Informationen für das Changelog-Popup zurück.
    Öffentlich erreichbar für alle angemeldeten Benutzer.
    """
    try:
        project_dir = os.path.abspath(os.path.join(BASE_DIR, ".."))
        
        # Die letzten 15 Commits im Format: Hash|Datum|Author|Message holen
        git_log_res = subprocess.run(
            ["git", "log", "-n", "15", "--pretty=format:%h|%cd|%an|%s", "--date=short"],
            cwd=project_dir, capture_output=True, text=True, check=False
        )

        commits = []
        if git_log_res.returncode == 0 and git_log_res.stdout.strip():
            lines = git_log_res.stdout.strip().split("\n")
            for line in lines:
                parts = line.split("|", 3)
                if len(parts) == 4:
                    commits.append({
                        "hash": parts[0],
                        "date": parts[1],
                        "author": parts[2],
                        "message": parts[3]
                    })

        # Aktueller Commit Hash
        current_hash_res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=project_dir, capture_output=True, text=True, check=False)
        current_hash = current_hash_res.stdout.strip() if current_hash_res.returncode == 0 else "HEAD"

        return {
            "current_hash": current_hash,
            "commits": commits,
            "fetched_at": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "current_hash": "HEAD",
            "commits": [],
            "error": str(e),
            "fetched_at": datetime.now().isoformat()
        }


# =============================================================================
# USER BEHAVIOR & ACTIVITY ANALYTICS (ADMIN ONLY)
# =============================================================================

@router.get("/users/stats/overview")
async def get_user_statistics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Gibt die plattformweiten Gesamt-Metriken und ein Ranking der aktivsten Nutzer zurück."""
    now = datetime.utcnow()
    day_1_ago = now - timedelta(days=1)
    day_7_ago = now - timedelta(days=7)
    day_30_ago = now - timedelta(days=30)

    total_users = db.query(User).count()
    approved_users = db.query(User).filter(User.is_approved == 1).count()

    # Aktive Nutzer (DAU, WAU, MAU)
    active_today = db.query(UserActivityLog.user_id).filter(UserActivityLog.created_at >= day_1_ago).distinct().count()
    active_7d = db.query(UserActivityLog.user_id).filter(UserActivityLog.created_at >= day_7_ago).distinct().count()
    active_30d = db.query(UserActivityLog.user_id).filter(UserActivityLog.created_at >= day_30_ago).distinct().count()

    # Modul-Zähler
    total_logins = db.query(UserActivityLog).filter(UserActivityLog.activity_type == "LOGIN").count()
    total_views = db.query(UserActivityLog).filter(UserActivityLog.activity_type == "VIEW_MATCH").count()
    total_comments = db.query(MatchEvent).filter(MatchEvent.event_type.notin_(["drawing", "goal", "corner", "penalty"])).count()
    total_drawings = db.query(MatchEvent).filter(MatchEvent.event_type == "drawing").count()
    total_tactics = db.query(TacticsBoard).count()
    total_trainings = db.query(TrainingSession).count()
    total_evaluations = db.query(PlayerEvaluation).count()

    # Watch-Time Aggregation (in Minuten)
    watch_time_logs = db.query(UserActivityLog).filter(UserActivityLog.activity_type == "WATCH_TIME").all()
    total_watch_seconds = sum([(l.details or {}).get("duration_seconds", 30) for l in watch_time_logs])
    total_watch_mins = int(total_watch_seconds / 60)

    # Modul-Aktivitäten-Verteilung
    video_actions = total_views + total_comments + total_drawings + len(watch_time_logs)
    tactics_actions = db.query(UserActivityLog).filter(UserActivityLog.activity_type.in_(["CREATE_TACTICS", "EDIT_TACTICS"])).count() or total_tactics
    training_actions = db.query(UserActivityLog).filter(UserActivityLog.activity_type == "CREATE_TRAINING").count() or total_trainings
    player_actions = db.query(UserActivityLog).filter(UserActivityLog.activity_type == "EVALUATE_PLAYER").count() or total_evaluations

    # Nutzer-Ranking zusammenstellen
    users = db.query(User).all()
    user_ranking = []

    for u in users:
        u_logs = db.query(UserActivityLog).filter(UserActivityLog.user_id == u.id).all()
        u_logins = sum(1 for l in u_logs if l.activity_type == "LOGIN")
        u_views = sum(1 for l in u_logs if l.activity_type == "VIEW_MATCH")
        u_watch_secs = sum([(l.details or {}).get("duration_seconds", 30) for l in u_logs if l.activity_type == "WATCH_TIME"])
        
        last_log = max([l.created_at for l in u_logs], default=u.last_login or u.created_at)

        user_ranking.append({
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "avatar_path": u.avatar_path,
            "is_approved": bool(u.is_approved),
            "total_actions": len(u_logs),
            "logins_count": u_logins,
            "views_count": u_views,
            "watch_time_mins": int(u_watch_secs / 60),
            "last_active": last_log.isoformat() if last_log else None,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })

    # Sortiere nach Gesamt-Aktivität absteigend
    user_ranking.sort(key=lambda x: (x["total_actions"], x["logins_count"]), reverse=True)

    return {
        "summary": {
            "total_users": total_users,
            "approved_users": approved_users,
            "active_today": active_today,
            "active_7d": active_7d,
            "active_30d": active_30d,
            "total_logins": total_logins,
            "total_views": total_views,
            "total_watch_time_mins": total_watch_mins,
            "total_comments": total_comments,
            "total_drawings": total_drawings,
            "total_tactics": total_tactics,
            "total_trainings": total_trainings,
            "total_evaluations": total_evaluations
        },
        "module_distribution": {
            "video_analysis": video_actions,
            "tactics": tactics_actions,
            "training": training_actions,
            "player_management": player_actions
        },
        "user_ranking": user_ranking
    }


@router.get("/users/{user_id}/stats")
async def get_single_user_statistics(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Gibt detaillierte Statistiken, 30-Tage Heatmap und Aktivitäts-Verteilung für einen einzelnen Benutzer zurück."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    now = datetime.utcnow()
    logs = db.query(UserActivityLog).filter(UserActivityLog.user_id == user_id).order_by(UserActivityLog.created_at.desc()).all()

    # Zähler
    logins_count = sum(1 for l in logs if l.activity_type == "LOGIN")
    views_count = sum(1 for l in logs if l.activity_type == "VIEW_MATCH")
    comments_count = sum(1 for l in logs if l.activity_type == "ADD_COMMENT")
    drawings_count = sum(1 for l in logs if l.activity_type == "CREATE_DRAWING")
    tactics_created = sum(1 for l in logs if l.activity_type == "CREATE_TACTICS") + db.query(TacticsBoard).filter(TacticsBoard.created_by_user_id == user_id).count()
    tactics_edited = sum(1 for l in logs if l.activity_type == "EDIT_TACTICS")
    trainings_created = sum(1 for l in logs if l.activity_type == "CREATE_TRAINING") + db.query(TrainingSession).filter(TrainingSession.created_by_user_id == user_id).count()
    evaluations_created = sum(1 for l in logs if l.activity_type == "EVALUATE_PLAYER") + db.query(PlayerEvaluation).filter(PlayerEvaluation.created_by_user_id == user_id).count()
    watch_seconds = sum([(l.details or {}).get("duration_seconds", 30) for l in logs if l.activity_type == "WATCH_TIME"])

    # 30-Tage Aktivitäts-Heatmap (Tag für Tag)
    heatmap_30d = []
    for day_offset in range(29, -1, -1):
        target_date = (now - timedelta(days=day_offset)).date()
        day_logs = [l for l in logs if l.created_at and l.created_at.date() == target_date]
        count = len(day_logs)
        level = 0
        if count >= 15: level = 4
        elif count >= 8: level = 3
        elif count >= 3: level = 2
        elif count >= 1: level = 1

        heatmap_30d.append({
            "date": target_date.strftime("%Y-%m-%d"),
            "display_date": target_date.strftime("%d.%m."),
            "day_name": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][target_date.weekday()],
            "count": count,
            "level": level
        })

    # Modul-Aufteilung
    module_breakdown = {
        "video": views_count + comments_count + drawings_count + sum(1 for l in logs if l.activity_type == "WATCH_TIME"),
        "tactics": tactics_created + tactics_edited,
        "training": trainings_created,
        "players": evaluations_created
    }

    # Zuletzt interagierte Matches
    match_ids = [l.resource_id for l in logs if l.resource_type == "match" and l.resource_id]
    recent_matches = []
    seen_match_ids = set()
    for mid in match_ids:
        if mid not in seen_match_ids:
            seen_match_ids.add(mid)
            m = db.query(Match).filter(Match.id == mid).first()
            if m:
                m_count = sum(1 for l in logs if l.resource_id == mid)
                recent_matches.append({
                    "id": m.id,
                    "name": m.name,
                    "interactions_count": m_count,
                    "thumbnail_path": m.thumbnail_path
                })
            if len(recent_matches) >= 5:
                break

    last_active = max([l.created_at for l in logs], default=user.last_login or user.created_at)

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            "avatar_path": user.avatar_path,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "teams": [{"id": t.id, "name": t.name} for t in user.teams]
        },
        "metrics": {
            "total_actions": len(logs),
            "logins_count": logins_count,
            "watch_time_mins": int(watch_seconds / 60),
            "views_count": views_count,
            "comments_count": comments_count,
            "drawings_count": drawings_count,
            "tactics_count": tactics_created + tactics_edited,
            "trainings_count": trainings_created,
            "evaluations_count": evaluations_created,
            "last_active": last_active.isoformat() if last_active else None
        },
        "heatmap_30d": heatmap_30d,
        "module_breakdown": module_breakdown,
        "recent_matches": recent_matches
    }


@router.get("/users/{user_id}/activity-logs")
async def get_user_activity_logs(
    user_id: str,
    page: int = 1,
    limit: int = 25,
    activity_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Gibt paginierte Aktivitäten-Logs für einen Benutzer zurück."""
    query = db.query(UserActivityLog).filter(UserActivityLog.user_id == user_id)
    if activity_type and activity_type != "ALL":
        query = query.filter(UserActivityLog.activity_type == activity_type)

    total_count = query.count()
    logs = query.order_by(UserActivityLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "logs": [
            {
                "id": l.id,
                "activity_type": l.activity_type,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "details": l.details,
                "ip_address": l.ip_address,
                "user_agent": l.user_agent,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs
        ]
    }