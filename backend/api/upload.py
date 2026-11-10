from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException, status, Request, Header, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import threading
import uuid

from db.session import get_db, UPLOAD_DIR, BASE_DIR
from models import VideoChunk, Match, User, Team, SystemSettings, UserRole, StitchingStatus
from .dependencies import require_admin, require_trainer
from core.security import get_password_hash
from services.thumbnail_service import generate_thumbnail
from services.notification_service import notify_subscribers, notify_users_new_video
from services.hls_service import generate_hls_playlist

router = APIRouter()

STAGING_ROOT = os.path.join(UPLOAD_DIR, "_staging")
os.makedirs(STAGING_ROOT, exist_ok=True)

_SESSION_ASYNC_LOCKS: Dict[str, asyncio.Lock] = {}
_SESSION_LOCK_MUTEX = threading.Lock()


def _get_session_async_lock(upload_id: str) -> asyncio.Lock:
    with _SESSION_LOCK_MUTEX:
        if upload_id not in _SESSION_ASYNC_LOCKS:
            _SESSION_ASYNC_LOCKS[upload_id] = asyncio.Lock()
        return _SESSION_ASYNC_LOCKS[upload_id]



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
    current_user: User = Depends(require_admin)
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


# ==============================================================================
# Resumable Chunked Upload Session API (MatchTrack-Stitcher Desktop Integration)
# ==============================================================================

ALLOWED_STREAM_TYPES = {"16x9", "32x9", "tracking"}
DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024  # 16 MB
MIN_CHUNK_SIZE = 1 * 1024 * 1024       # 1 MB
MAX_CHUNK_SIZE = 64 * 1024 * 1024      # 64 MB


class UploadSessionInitPayload(BaseModel):
    match_id: Optional[str] = None
    name: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    category: Optional[str] = "Punktspiel"
    age_group: Optional[str] = None
    recording_date: Optional[str] = None
    video_quality: Optional[str] = None
    is_password_protected: Optional[bool] = False
    password: Optional[str] = None
    skip_conversion: Optional[bool] = False
    notify_team_members: Optional[bool] = True
    notify_user_ids: Optional[str] = None
    streams: Dict[str, int]  # e.g. {"16x9": 1548293120, "32x9": 3291823104, "tracking": 452100}
    chunk_size_bytes: Optional[int] = DEFAULT_CHUNK_SIZE


def _validate_uuid_id(val: str, field_name: str = "id") -> str:
    """Validiert strikt eine UUID-Zeichenkette gegen Path-Traversal."""
    try:
        parsed = uuid.UUID(str(val).strip())
        return str(parsed)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültiges Format für {field_name} (UUID erforderlich)."
        )


def _check_team_upload_permission(user: User, team_id: Optional[str]):
    """Prüft, ob ein Nicht-Admin-Benutzer Berechtigung für die angegebene Mannschaft besitzt."""
    user_role_str = str(user.role.value if hasattr(user.role, "value") else user.role).upper()
    if user_role_str == UserRole.ADMIN.value:
        return
    if not team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bitte wähle eine dir zugewiesene Mannschaft für den Upload aus."
        )
    assigned_team_ids = {t.id for t in (user.teams or [])}
    requested_ids = [tid.strip() for tid in team_id.split(",") if tid.strip()]
    for req_tid in requested_ids:
        if req_tid not in assigned_team_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Keine Upload-Berechtigung für Mannschaft '{req_tid}'."
            )


def _load_session_manifest(upload_id: str, current_user: User) -> tuple[str, str, dict]:
    clean_upload_id = _validate_uuid_id(upload_id, "upload_id")
    session_dir = os.path.join(STAGING_ROOT, clean_upload_id)
    manifest_path = os.path.join(session_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        raise HTTPException(status_code=404, detail="Upload-Session nicht gefunden oder abgelaufen.")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    user_role_str = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role).upper()
    if manifest.get("user_id") != current_user.id and user_role_str != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Upload-Session.")

    return session_dir, manifest_path, manifest


def _save_session_manifest(manifest_path: str, manifest: dict):
    tmp_path = manifest_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    os.replace(tmp_path, manifest_path)


def _verify_video_container_ffprobe(file_path: str) -> bool:
    """Prüft mit ffprobe, ob die hochgeladene Datei ein gültiger Videocontainer mit Videospur ist."""
    if not os.path.exists(file_path) or os.path.getsize(file_path) < 1024:
        return False
    # Falls ffprobe auf dem System nicht installiert ist, prüfen wir zumindest die MP4 'ftyp' Magic Bytes
    if shutil.which("ffprobe") is None:
        try:
            with open(file_path, "rb") as f:
                header = f.read(32)
            return b"ftyp" in header or b"moov" in header or b"mdat" in header
        except Exception:
            return False

    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,width,height",
            "-of", "json",
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=20, check=False)
        if res.returncode != 0:
            return False
        info = json.loads(res.stdout or "{}")
        streams = info.get("streams", [])
        return len(streams) > 0 and bool(streams[0].get("codec_name"))
    except Exception:
        return False


@router.post("/session/init")
async def init_upload_session(
    payload: UploadSessionInitPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    """
    Initialisiert eine mehrteilige (Chunked/Resumable) Upload-Session für den MatchTrack-Stitcher.
    Prüft Berechtigungen, Stream-Spezifikationen und freien Server-Speicherplatz.
    """
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Spielname darf nicht leer sein.")

    if not payload.streams:
        raise HTTPException(status_code=400, detail="Mindestens ein Stream muss für den Upload angegeben werden.")

    for s_type, s_size in payload.streams.items():
        if s_type not in ALLOWED_STREAM_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Ungültiger stream_type '{s_type}'. Erlaubt: {sorted(ALLOWED_STREAM_TYPES)}"
            )
        if s_size <= 0:
            raise HTTPException(status_code=400, detail=f"Ungültige Dateigröße für Stream '{s_type}'.")

    if "16x9" not in payload.streams and "32x9" not in payload.streams:
        raise HTTPException(
            status_code=400,
            detail="Mindestens ein Video-Stream ('16x9' oder '32x9') muss hochgeladen werden."
        )

    _check_team_upload_permission(current_user, payload.team_id)

    # Ziel-Match prüfen oder neue UUID generieren
    if payload.match_id:
        match_id = _validate_uuid_id(payload.match_id, "match_id")
        existing_match = db.query(Match).filter(Match.id == match_id).first()
        if existing_match and existing_match.team_id:
            _check_team_upload_permission(current_user, existing_match.team_id)
    else:
        match_id = str(uuid.uuid4())

    # Speicherplatz-Prüfung (mindestens Upload-Größe + 512 MB Puffer frei)
    total_upload_bytes = sum(payload.streams.values())
    try:
        disk = shutil.disk_usage(UPLOAD_DIR)
        required_free = total_upload_bytes + (512 * 1024 * 1024)
        if disk.free < required_free:
            free_gb = disk.free / (1024 ** 3)
            req_gb = required_free / (1024 ** 3)
            raise HTTPException(
                status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
                detail=f"Nicht genügend freier Speicherplatz auf dem Server ({free_gb:.1f} GB frei, {req_gb:.1f} GB benötigt)."
            )
    except HTTPException:
        raise
    except Exception:
        pass

    chunk_size = int(payload.chunk_size_bytes or DEFAULT_CHUNK_SIZE)
    chunk_size = max(MIN_CHUNK_SIZE, min(MAX_CHUNK_SIZE, chunk_size))

    upload_id = str(uuid.uuid4())
    session_dir = os.path.join(STAGING_ROOT, upload_id)
    os.makedirs(session_dir, exist_ok=True)

    manifest = {
        "upload_id": upload_id,
        "match_id": match_id,
        "user_id": current_user.id,
        "username": current_user.username,
        "name": payload.name.strip(),
        "team_id": payload.team_id,
        "team_name": payload.team_name,
        "category": payload.category or "Punktspiel",
        "age_group": payload.age_group,
        "recording_date": payload.recording_date,
        "video_quality": payload.video_quality,
        "is_password_protected": bool(payload.is_password_protected),
        "password": payload.password if payload.is_password_protected else None,
        "skip_conversion": bool(payload.skip_conversion),
        "notify_team_members": bool(payload.notify_team_members),
        "notify_user_ids": payload.notify_user_ids,
        "chunk_size_bytes": chunk_size,
        "streams": payload.streams,
        "received_chunks": {k: [] for k in payload.streams.keys()},
        "created_at": datetime.utcnow().isoformat()
    }

    manifest_path = os.path.join(session_dir, "manifest.json")
    _save_session_manifest(manifest_path, manifest)

    # Pre-create empty .part files to allow safe concurrent chunk uploads across multiple worker threads
    for s_type in payload.streams.keys():
        part_file = os.path.join(session_dir, f"{s_type}.part")
        if not os.path.exists(part_file):
            with open(part_file, "wb") as pf:
                pass

    return {
        "status": "initialized",
        "upload_id": upload_id,
        "match_id": match_id,
        "chunk_size_bytes": chunk_size
    }


@router.put("/session/{upload_id}/part")
@router.post("/session/{upload_id}/part")
async def upload_session_part(
    upload_id: str,
    request: Request,
    stream_type: str = Query(..., description="Stream-Typ: '16x9', '32x9' oder 'tracking'"),
    chunk_index: int = Query(..., ge=0, description="0-basierter Chunk-Index"),
    offset: Optional[int] = Query(None, ge=0, description="Optionaler Byte-Offset"),
    x_chunk_sha256: Optional[str] = Header(None, alias="X-Chunk-SHA256"),
    current_user: User = Depends(require_trainer)
):
    """
    Nimmt einen einzelnen Binär-Chunk (application/octet-stream) entgegen,
    prüft dessen SHA-256-Prüfsumme und schreibt ihn an die exakte Position der .part-Datei.
    Vollständig threadsicher für parallele Multi-Stream-Uploads aus mehreren Client-Threads.
    """
    session_dir, manifest_path, manifest = _load_session_manifest(upload_id, current_user)

    if stream_type not in manifest.get("streams", {}):
        raise HTTPException(status_code=400, detail=f"Stream '{stream_type}' ist in dieser Session nicht registriert.")

    expected_total_size = int(manifest["streams"][stream_type])
    chunk_size = int(manifest.get("chunk_size_bytes", DEFAULT_CHUNK_SIZE))
    write_offset = offset if offset is not None else (chunk_index * chunk_size)

    # 1. Empfange Chunk-Bytes über das Netzwerk parallel ohne Lock
    body_bytes = await request.body()
    if not body_bytes:
        raise HTTPException(status_code=400, detail="Leerer Chunk-Body empfangen.")

    if write_offset + len(body_bytes) > expected_total_size:
        raise HTTPException(
            status_code=400,
            detail=f"Chunk überschreitet deklarierte Gesamtgröße für Stream '{stream_type}'."
        )

    # 2. SHA-256 Hash-Validierung parallel ohne Lock
    if x_chunk_sha256:
        actual_hash = hashlib.sha256(body_bytes).hexdigest().lower()
        if actual_hash != x_chunk_sha256.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"SHA-256 Prüfsummenfehler bei Chunk {chunk_index} ({stream_type})."
            )

    part_file_path = os.path.join(session_dir, f"{stream_type}.part")

    # 3. Schreiben auf Festplatte & Manifest-Aktualisierung mit Session-Lock
    async with _get_session_async_lock(upload_id):
        if not os.path.exists(part_file_path):
            with open(part_file_path, "wb") as f_init:
                pass
        with open(part_file_path, "r+b") as f:
            f.seek(write_offset)
            f.write(body_bytes)

        # Aktuelles Manifest frisch einlesen um Concurrency-Konflikte zu vermeiden
        _, fresh_manifest_path, fresh_manifest = _load_session_manifest(upload_id, current_user)
        received_list = fresh_manifest.get("received_chunks", {}).get(stream_type, [])
        if chunk_index not in received_list:
            received_list.append(chunk_index)
            received_list.sort()
            fresh_manifest["received_chunks"][stream_type] = received_list
            _save_session_manifest(fresh_manifest_path, fresh_manifest)

        current_file_size = os.path.getsize(part_file_path)

    return {
        "status": "ok",
        "stream_type": stream_type,
        "chunk_index": chunk_index,
        "chunk_bytes": len(body_bytes),
        "file_bytes_written": current_file_size,
        "expected_total_bytes": expected_total_size
    }


@router.get("/session/{upload_id}/status")
async def get_upload_session_status(
    upload_id: str,
    current_user: User = Depends(require_trainer)
):
    """
    Gibt den aktuellen Fortschritt und alle bereits bestätigten Chunks einer Upload-Session zurück.
    Ermöglicht nahtloses Fortsetzen (Resume) nach Verbindungsabbrüchen.
    """
    session_dir, _, manifest = _load_session_manifest(upload_id, current_user)
    stream_progress = {}
    for s_type, expected_bytes in manifest.get("streams", {}).items():
        part_path = os.path.join(session_dir, f"{s_type}.part")
        written_bytes = os.path.getsize(part_path) if os.path.exists(part_path) else 0
        stream_progress[s_type] = {
            "expected_bytes": expected_bytes,
            "written_bytes": written_bytes,
            "received_chunks": manifest.get("received_chunks", {}).get(s_type, []),
            "complete": written_bytes == expected_bytes
        }

    return {
        "status": "active",
        "upload_id": manifest["upload_id"],
        "match_id": manifest["match_id"],
        "chunk_size_bytes": manifest["chunk_size_bytes"],
        "streams": stream_progress
    }


@router.post("/session/{upload_id}/complete")
async def complete_upload_session(
    upload_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    """
    Finalisiert die Upload-Session:
    1. Prüft Vollständigkeit aller registrierten Streams und validiert Videodateien via ffprobe.
    2. Legt das Match in der Datenbank an (oder aktualisiert ein bestehendes Match).
    3. Verschiebt Standard- (16:9), Panorama- (32:9 / 8:3) und Tracking-Dateien in den Match-Ordner.
    4. Startet Thumbnail-Generierung, HLS-Streaming-Aufbereitung und Team-Benachrichtigungen.
    """
    session_dir, _, manifest = _load_session_manifest(upload_id, current_user)
    match_id = manifest["match_id"]
    streams_spec: Dict[str, int] = manifest.get("streams", {})

    # 1. Prüfe Dateivollständigkeit & Video-Container-Integrität
    for s_type, expected_bytes in streams_spec.items():
        part_path = os.path.join(session_dir, f"{s_type}.part")
        if not os.path.exists(part_path):
            raise HTTPException(status_code=400, detail=f"Stream-Datei '{s_type}' fehlt auf dem Server.")
        actual_bytes = os.path.getsize(part_path)
        if actual_bytes != expected_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Stream '{s_type}' ist unvollständig ({actual_bytes} von {expected_bytes} Bytes empfangen)."
            )
        if s_type in ("16x9", "32x9"):
            if not _verify_video_container_ffprobe(part_path):
                raise HTTPException(
                    status_code=422,
                    detail=f"Die hochgeladene Datei für '{s_type}' ist kein gültiger Videocontainer."
                )

    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # 2. Team-Name und Aufnahmedatum auflösen
    team_id = manifest.get("team_id")
    eff_team_name = manifest.get("team_name")
    eff_age_group = manifest.get("age_group")
    if team_id:
        team_ids = [tid.strip() for tid in team_id.split(",") if tid.strip()]
        if team_ids:
            matched_teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
            if matched_teams:
                if not eff_team_name:
                    team_map = {t.id: t.name for t in matched_teams}
                    ordered_names = [team_map[tid] for tid in team_ids if tid in team_map]
                    eff_team_name = ", ".join(ordered_names)
                if not eff_age_group and matched_teams[0].age_group:
                    eff_age_group = matched_teams[0].age_group

    rec_date_dt = None
    raw_rec_date = manifest.get("recording_date")
    if raw_rec_date:
        try:
            clean_date = str(raw_rec_date).replace("Z", "+00:00")
            rec_date_dt = datetime.fromisoformat(clean_date)
        except Exception:
            rec_date_dt = datetime.utcnow()
    else:
        rec_date_dt = datetime.utcnow()

    eff_video_quality = manifest.get("video_quality") or (settings.default_video_quality if settings else "1080p")

    # 3. Match in Datenbank anlegen oder aktualisieren
    match = db.query(Match).filter(Match.id == match_id).first()
    is_new_match = False
    if not match:
        is_new_match = True
        match = Match(
            id=match_id,
            name=manifest["name"],
            team_name=eff_team_name,
            team_id=team_id,
            category=manifest.get("category") or "Punktspiel",
            age_group=eff_age_group,
            recording_date=rec_date_dt,
            video_quality=eff_video_quality,
            stitching_status=StitchingStatus.NONE,
            stitching_time_offset=0
        )
        db.add(match)
    else:
        if manifest.get("name"):
            match.name = manifest["name"]
        if eff_team_name is not None:
            match.team_name = eff_team_name
        if team_id is not None:
            match.team_id = team_id
        if manifest.get("category"):
            match.category = manifest["category"]
        if eff_age_group is not None:
            match.age_group = eff_age_group
        if raw_rec_date:
            match.recording_date = rec_date_dt
        if eff_video_quality:
            match.video_quality = eff_video_quality
        match.stitching_status = StitchingStatus.NONE

    if manifest.get("is_password_protected") and manifest.get("password"):
        plain_pw = str(manifest["password"]).strip()
        match.is_password_protected = True
        match.hashed_password = get_password_hash(plain_pw)
        match.plain_password = plain_pw

    db.commit()
    db.refresh(match)

    # 4. Dateien aus Staging in den Match-Ordner verschieben & VideoChunks registrieren
    match_folder = os.path.join(UPLOAD_DIR, match_id)
    os.makedirs(match_folder, exist_ok=True)

    existing_chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
    should_hls = bool(settings.module_hls_enabled and settings.auto_hls_conversion)
    skip_conversion = bool(manifest.get("skip_conversion", False))
    chunks_created: List[VideoChunk] = []

    tracking_db_path = None
    if "tracking" in streams_spec:
        tracking_part = os.path.join(session_dir, "tracking.part")
        tracking_target = os.path.join(match_folder, "tracking.jsonl")
        shutil.move(tracking_part, tracking_target)
        tracking_db_path = f"uploads/{match_id}/tracking.jsonl"

    # Standard 16:9 Stream
    if "16x9" in streams_spec:
        old_std_chunks = [c for c in existing_chunks if "panorama_32x9" not in (c.video_path or "")]
        for old_c in old_std_chunks:
            if old_c.video_path:
                old_abs = os.path.join(BASE_DIR, old_c.video_path.replace("backend/", "", 1))
                if os.path.exists(old_abs):
                    try:
                        os.remove(old_abs)
                    except Exception:
                        pass
            db.delete(old_c)

        fn_16x9 = f"raw_{uuid.uuid4().hex[:8]}_standard_16x9.mp4"
        target_16x9_abs = os.path.join(match_folder, fn_16x9)
        shutil.move(os.path.join(session_dir, "16x9.part"), target_16x9_abs)
        size_16x9_mb = max(1, int(os.path.getsize(target_16x9_abs) / (1024 * 1024)))

        chunk_16x9 = VideoChunk(
            match_id=match_id,
            video_path=f"uploads/{match_id}/{fn_16x9}",
            tracking_path=tracking_db_path,
            file_size_mb=size_16x9_mb,
            conversion_status="processing" if should_hls else "pending",
            conversion_progress=0
        )
        db.add(chunk_16x9)
        db.commit()
        db.refresh(chunk_16x9)
        chunks_created.append(chunk_16x9)

    # Panorama Stream (32:9 / 8:3 / 21:10)
    if "32x9" in streams_spec:
        old_pano_chunks = [c for c in existing_chunks if "panorama_32x9" in (c.video_path or "")]
        for old_c in old_pano_chunks:
            if old_c.video_path:
                old_abs = os.path.join(BASE_DIR, old_c.video_path.replace("backend/", "", 1))
                if os.path.exists(old_abs):
                    try:
                        os.remove(old_abs)
                    except Exception:
                        pass
            db.delete(old_c)

        fn_32x9 = "panorama_32x9.mp4"
        target_32x9_abs = os.path.join(match_folder, fn_32x9)
        if os.path.exists(target_32x9_abs):
            try:
                os.remove(target_32x9_abs)
            except Exception:
                pass
        shutil.move(os.path.join(session_dir, "32x9.part"), target_32x9_abs)
        size_32x9_mb = max(1, int(os.path.getsize(target_32x9_abs) / (1024 * 1024)))

        chunk_32x9 = VideoChunk(
            match_id=match_id,
            video_path=f"uploads/{match_id}/{fn_32x9}",
            tracking_path=tracking_db_path if "16x9" not in streams_spec else None,
            file_size_mb=size_32x9_mb,
            conversion_status="processing" if should_hls else "pending",
            conversion_progress=0
        )
        db.add(chunk_32x9)
        db.commit()
        db.refresh(chunk_32x9)
        chunks_created.append(chunk_32x9)

    # Staging-Verzeichnis aufräumen
    shutil.rmtree(session_dir, ignore_errors=True)
    with _SESSION_LOCK_MUTEX:
        _SESSION_ASYNC_LOCKS.pop(upload_id, None)

    # Cache invalidieren
    try:
        from services.cache_service import backend_cache
        backend_cache.clear()
    except Exception:
        pass

    # 5. Hintergrund-Tasks starten (Thumbnail, HLS, Benachrichtigungen)
    background_tasks.add_task(generate_thumbnail, match_id)

    if should_hls:
        for ch in chunks_created:
            background_tasks.add_task(generate_hls_playlist, ch.id, None, skip_conversion)

    # Team-Benachrichtigungen bei neuem Match auslösen
    if is_new_match and manifest.get("notify_team_members", True):
        notify_ids = []
        if manifest.get("notify_user_ids"):
            notify_ids = [u.strip() for u in str(manifest["notify_user_ids"]).split(",") if u.strip()]
        elif team_id:
            team_ids = [tid.strip() for tid in team_id.split(",") if tid.strip()]
            if team_ids:
                teams_objs = db.query(Team).filter(Team.id.in_(team_ids)).all()
                member_ids = set()
                for t_obj in teams_objs:
                    for trainer_user in (t_obj.trainers or []):
                        if getattr(trainer_user, "notify_on_new_video", True):
                            member_ids.add(trainer_user.id)
                notify_ids = list(member_ids)
        if notify_ids:
            background_tasks.add_task(notify_users_new_video, notify_ids, match_id, match.name, db)

    return {
        "status": "success",
        "message": f"Match '{match.name}' erfolgreich angelegt und verarbeitet.",
        "match_id": match_id,
        "match_name": match.name,
        "streams_uploaded": list(streams_spec.keys()),
        "match_path": f"/match/{match_id}"
    }


@router.delete("/session/{upload_id}")
async def cancel_upload_session(
    upload_id: str,
    current_user: User = Depends(require_trainer)
):
    """Bricht eine aktive Upload-Session ab und löscht alle temporären .part-Dateien."""
    session_dir, _, _ = _load_session_manifest(upload_id, current_user)
    shutil.rmtree(session_dir, ignore_errors=True)
    with _SESSION_LOCK_MUTEX:
        _SESSION_ASYNC_LOCKS.pop(upload_id, None)
    return {"status": "cancelled", "upload_id": upload_id}