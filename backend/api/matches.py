from fastapi import APIRouter, Depends, HTTPException, Body, status, Request, Response, BackgroundTasks
from sqlalchemy.orm import Session
from db.session import get_db
from models import Match, VideoChunk, MatchEvent, User, Subscription, HeatmapStatus, UserRole, Team, SystemSettings, VideoStitchJob, Player
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Union
from db.session import get_db, BASE_DIR, UPLOAD_DIR
import os
import json
from datetime import datetime
import traceback
import uuid
import secrets

from .dependencies import require_viewer, require_trainer, require_admin, get_current_user, get_optional_user
from services.notification_service import notify_subscribers
from services.tracker_service import get_highlight_job_status
from core.security import get_password_hash, verify_password

router = APIRouter()

# --- Pydantic Models ---

class MatchUpdate(BaseModel):
    name: Optional[str] = None
    team_name: Optional[str] = None
    team_id: Optional[str] = None
    category: Optional[str] = None
    age_group: Optional[str] = None
    video_quality: Optional[str] = None
    recording_date: Optional[datetime] = None

class MatchOut(BaseModel):
    id: str
    name: str
    team_name: Optional[str] = None
    team_id: Optional[str] = None
    category: Optional[str] = "Punktspiel"
    age_group: Optional[str] = None
    video_quality: Optional[str] = None
    recording_date: Optional[datetime] = None
    created_at: datetime
    share_token: Optional[str] = None
    thumbnail_path: Optional[str] = None
    is_password_protected: bool # NEU: Status des Passwortschutzes
    password: Optional[str] = None
    password_expires_at: Optional[datetime] = None # NEU: Ablaufdatum des Passwortschutzes
    heatmap_status: HeatmapStatus
    heatmap_path: Optional[str] = None
    events_count: int = 0
    
    # Farbanpassungen (NEU)

    video_brightness: int = 100
    video_contrast: int = 100
    video_saturation: int = 100
    video_hue: int = 0

    class Config:
        orm_mode = True
        use_enum_values = True

class MatchPasswordProtectionUpdate(BaseModel):
    is_protected: bool
    password: Optional[str] = None
    expires_at: Optional[datetime] = None

class MatchPasswordVerify(BaseModel):
    password: str

# --- Helper Functions ---

def _is_match_access_allowed(match: Match, current_user: Optional[User], request: Request) -> bool:
    """
    Checks if the user is allowed to access a match.
    - If the match is NOT password protected: Everyone has access.
    - If the user is logged in (has an account): Always has direct access without needing a match password.
    - External guests (without account): Must provide match password and password must not be expired.
    """
    if not match.is_password_protected:
        return True

    # All logged-in users with an account have direct access without needing a match password
    if current_user is not None:
        return True

    # Check if password has expired for external visitors
    if match.password_expires_at and datetime.utcnow() > match.password_expires_at:
        return False

    # Check for session cookie for unauthenticated users
    session_cookie_name = f"match_access_{match.id}"
    if request.cookies.get(session_cookie_name) == "granted":
        return True

    # Check X-Match-Password header
    pass_header = request.headers.get("X-Match-Password") or request.headers.get("x-match-password")
    if pass_header and match.hashed_password and verify_password(pass_header, match.hashed_password):
        return True

    # Check query parameter ?password=...
    pass_param = request.query_params.get("password")
    if pass_param and match.hashed_password and verify_password(pass_param, match.hashed_password):
        return True

    return False

# --- Endpoints ---

@router.get("")
@router.get("/")
async def get_matches(
    category: Optional[str] = None,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    try:
        query = db.query(Match)
        
        # Rechteprüfung für Trainer / Co-Trainer / Team-Admins: Nur Spiele ihrer zugewiesenen Teams sehen
        user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper() if current_user else ""
        if current_user and user_role_str in ["TRAINER", "CO_TRAINER", "TEAM_ADMIN"]:
            trainer_team_ids = [str(t.id) for t in current_user.teams]
            if trainer_team_ids:
                from sqlalchemy import or_
                # Match if any trainer team ID matches exactly or appears as part of a comma-separated list
                team_conditions = []
                for tid in trainer_team_ids:
                    team_conditions.append(Match.team_id == tid)
                    team_conditions.append(Match.team_id.like(f"{tid},%"))
                    team_conditions.append(Match.team_id.like(f"%,{tid},%"))
                    team_conditions.append(Match.team_id.like(f"%,{tid}"))
                    team_conditions.append(Match.team_id.like(f"%, {tid},%"))
                    team_conditions.append(Match.team_id.like(f"%, {tid}"))
                query = query.filter(or_(*team_conditions, Match.team_id == None))
            else:
                # Trainer ohne zugewiesene Teams sieht nur unzugeordnete Spiele
                query = query.filter(Match.team_id == None)
        
        # Filter nach Kategorie & Team
        if category and category != "ALL":
            query = query.filter(Match.category == category)
        if team_id and team_id != "ALL":
            # Also support comma-separated matching for team filter
            query = query.filter(Match.team_id.contains(team_id))

        matches = query.order_by(Match.created_at.desc()).all()

        # Für jedes Match prüfen, ob der User es abonniert hat
        result = []
        for match in matches:
            is_sub = False
            if current_user:
                sub = db.query(Subscription).filter(Subscription.match_id == match.id, Subscription.user_id == current_user.id).first()
                is_sub = sub is not None

            # Alle Video-Chunks des Spiels laden
            chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match.id).order_by(VideoChunk.created_at.asc()).all()
            first_chunk = chunks[0] if chunks else None
            file_size_mb = first_chunk.file_size_mb if first_chunk else None

            # Video-Typen (Panorama / Standard) ermitteln
            match_folder = os.path.join(UPLOAD_DIR, match.id)
            has_pano_file = os.path.exists(os.path.join(match_folder, "panorama_32x9.mp4"))
            has_32x9 = has_pano_file or any("panorama_32x9" in (c.video_path or "") for c in chunks)
            has_16x9 = any("panorama_32x9" not in (c.video_path or "") for c in chunks)
            if not has_16x9 and not has_32x9 and chunks:
                has_16x9 = True

            video_types = []
            if has_32x9:
                video_types.append("Panorama")
            if has_16x9:
                video_types.append("Standard")
            video_type_label = " | ".join(video_types) if video_types else None

            # Anzahl der MatchEvents ermitteln
            events_count = db.query(MatchEvent).filter(MatchEvent.match_id == match.id).count()

            # Team-Name auflösen (bei komma-getrennten team_ids direkt team_name nutzen)
            if match.team_id and "," in (match.team_id or ""):
                effective_team_name = match.team_name or match.team_id
            else:
                effective_team_name = match.team.name if match.team else match.team_name

            # Stitch-Job & Hintergrund-Status ermitteln
            stitch_info = None
            is_stitching = False
            try:
                stitch_job = db.query(VideoStitchJob).filter(VideoStitchJob.match_id == match.id).order_by(VideoStitchJob.created_at.desc()).first()
                if stitch_job:
                    status_str = str(stitch_job.status.value if hasattr(stitch_job.status, 'value') else stitch_job.status or '').upper()
                    is_stitching = status_str in ["PENDING", "SYNCING", "STITCHING", "TRACKING", "REFRAMING", "PROCESSING"]
                    stitch_info = {
                        "id": stitch_job.id,
                        "status": status_str,
                        "progress": stitch_job.progress,
                        "current_step_text": stitch_job.current_step_text,
                        "output_mode": stitch_job.output_mode
                    }
            except Exception as sj_err:
                print(f"[MatchList] StitchJob fetch error for match {match.id}: {sj_err}")

            hm_status_str = str(match.heatmap_status.value if hasattr(match.heatmap_status, 'value') else match.heatmap_status or '').upper()
            is_generating_heatmap = hm_status_str in ["QUEUED", "PROCESSING"]

            # Heatmap Job Status & Fortschritt
            try:
                from services.ai.heatmap_generator import get_heatmap_job_status
                hm_job = get_heatmap_job_status(match.id)
                hm_info = hm_job if (hm_job and hm_job.get("has_job")) else None
            except Exception:
                hm_info = None

            # KI-Highlights Job
            try:
                hl_status = get_highlight_job_status(match.id)
                is_detecting_highlights = bool(hl_status and hl_status.get("status") == "PROCESSING")
                hl_info = hl_status if (hl_status and hl_status.get("has_job")) else None
            except Exception:
                hl_info = None
                is_detecting_highlights = False

            # Wir konvertieren das SQLAlchemy Objekt in ein Dictionary, um is_subscribed hinzuzufügen
            match_dict = {
                "id": match.id,
                "name": match.name,
                "team_id": match.team_id,
                "team_name": effective_team_name,
                "category": getattr(match, 'category', 'Punktspiel') or 'Punktspiel',
                "age_group": getattr(match, 'age_group', None),
                "recording_date": match.recording_date,
                "video_quality": match.video_quality,
                "file_size_mb": file_size_mb,
                "has_panorama": has_32x9,
                "has_standard": has_16x9,
                "video_type": video_type_label,
                "video_types": video_types,
                "events_count": events_count,
                "created_at": match.created_at,
                "is_subscribed": is_sub,
                "thumbnail_path": match.thumbnail_path,
                "share_token": match.share_token,
                "is_password_protected": match.is_password_protected,
                "password": match.plain_password if (current_user and str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper() in ["ADMIN", "TEAM_ADMIN", "TRAINER", "CO_TRAINER"]) else None,
                "heatmap_status": match.heatmap_status,
                "heatmap_path": match.heatmap_path,
                "heatmap_progress": getattr(match, 'heatmap_progress', 0.0) or (hm_info.get('progress', 0.0) if hm_info else 0.0),
                "heatmap_step_text": getattr(match, 'heatmap_step_text', '') or (hm_info.get('current_step_text', '') if hm_info else ''),
                "heatmap_job": hm_info,
                "video_brightness": match.video_brightness,
                "video_contrast": match.video_contrast,
                "video_saturation": match.video_saturation,
                "video_hue": match.video_hue,
                "stitch_job": stitch_info,
                "is_stitching": is_stitching,
                "is_generating_heatmap": is_generating_heatmap,
                "highlight_job": hl_info,
                "is_detecting_highlights": is_detecting_highlights
            }

            result.append(match_dict)

        return result
    except Exception as e:
        # Fange jeden Fehler ab und gib ihn als JSON zurück, damit wir ihn im Frontend/Browser sehen können
        error_details = traceback.format_exc()
        print(f"[MatchesListError] Database or query error:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Database or query error: {str(e)}\n\nDetails:\n{error_details}")

@router.get("/{match_id}")
@router.get("/{match_id}/")
async def get_match(match_id: str, request: Request, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        # NEU: Passwortschutz-Logik
        is_expired = bool(match.password_expires_at and datetime.utcnow() > match.password_expires_at)
        if not _is_match_access_allowed(match, current_user, request):
            return {
                "password_protected": True,
                "match_id": match.id,
                "is_password_expired": is_expired,
                "password_expires_at": match.password_expires_at.isoformat() if match.password_expires_at else None
            }

        chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
        events = db.query(MatchEvent).filter(MatchEvent.match_id == match_id).all()

        # Aktivität protokollieren
        if current_user:
            try:
                from services.activity_service import log_user_activity
                log_user_activity(
                    db=db,
                    user_id=current_user.id,
                    activity_type="VIEW_MATCH",
                    resource_type="match",
                    resource_id=match_id,
                    details={"match_name": match.name}
                )
            except Exception:
                pass

        # Check if current user is subscribed
        is_subscribed = False
        if current_user:
            sub = db.query(Subscription).filter(Subscription.match_id == match_id, Subscription.user_id == current_user.id).first()
            is_subscribed = sub is not None

        user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper() if current_user else ""
        is_trainer_or_admin = user_role_str in ["ADMIN", "TEAM_ADMIN", "TRAINER", "CO_TRAINER"]

        # Team-Name auflösen
        if match.team_id and "," in (match.team_id or ""):
            effective_team_name = match.team_name or match.team_id
        else:
            effective_team_name = match.team.name if match.team else match.team_name

        # KI-Highlights Job
        try:
            hl_status = get_highlight_job_status(match.id)
            is_detecting_highlights = bool(hl_status and hl_status.get("status") == "PROCESSING")
            hl_info = hl_status if (hl_status and hl_status.get("has_job")) else None
        except Exception:
            hl_info = None
            is_detecting_highlights = False

        # Heatmap Job Status & Fortschritt
        try:
            from services.ai.heatmap_generator import get_heatmap_job_status
            hm_job = get_heatmap_job_status(match.id)
            hm_info = hm_job if (hm_job and hm_job.get("has_job")) else None
        except Exception:
            hm_info = None

        # Verfügbare Video-Streams & Aspect Ratio (16:9 & 32:9 Support)
        match_folder = os.path.join(UPLOAD_DIR, match_id)
        has_pano_file = os.path.exists(os.path.join(match_folder, "panorama_32x9.mp4"))

        pano_chunk = next((c for c in chunks if "panorama_32x9" in (c.video_path or "")), None)
        standard_chunk = next((c for c in chunks if "panorama_32x9" not in (c.video_path or "")), None)

        has_16x9 = standard_chunk is not None
        has_32x9 = has_pano_file or pano_chunk is not None

        available_streams = []
        if has_16x9 and standard_chunk:
            available_streams.append({
                "id": "16x9",
                "label": "📹 Standard",
                "video_path": standard_chunk.video_path,
                "hls_playlist_path": standard_chunk.hls_playlist_path,
                "aspect_ratio": "16:9",
                "is_default": True
            })

        if has_32x9:
            pano_video_path = pano_chunk.video_path if pano_chunk else f"uploads/{match_id}/panorama_32x9.mp4"
            pano_hls_path = pano_chunk.hls_playlist_path if pano_chunk else (
                f"uploads/{match_id}/hls/master.m3u8" if os.path.exists(os.path.join(match_folder, "hls", "master.m3u8")) else None
            )
            available_streams.append({
                "id": "32x9",
                "label": "🏟️ Panorama",
                "video_path": pano_video_path,
                "hls_playlist_path": pano_hls_path,
                "aspect_ratio": "32:9",
                "is_default": (not has_16x9)
            })

        if not available_streams and chunks:
            available_streams.append({
                "id": "16x9",
                "label": "📹 Standard",
                "video_path": chunks[0].video_path,
                "hls_playlist_path": chunks[0].hls_playlist_path,
                "aspect_ratio": "16:9",
                "is_default": True
            })

        aspect_ratio = "16:9" if has_16x9 else ("32:9" if has_32x9 else "16:9")

        video_types = []
        if has_32x9:
            video_types.append("Panorama")
        if has_16x9:
            video_types.append("Standard")
        video_type_label = " | ".join(video_types) if video_types else None

        match_dict = {
            "id": match.id,
            "name": match.name,
            "team_id": match.team_id,
            "team_name": effective_team_name,
            "category": getattr(match, 'category', 'Punktspiel') or 'Punktspiel',
            "age_group": getattr(match, 'age_group', None),
            "recording_date": match.recording_date.isoformat() if match.recording_date else None,
            "video_quality": match.video_quality,
            "aspect_ratio": aspect_ratio,
            "has_panorama": has_32x9,
            "has_standard": has_16x9,
            "video_type": video_type_label,
            "video_types": video_types,
            "created_at": match.created_at.isoformat() if match.created_at else None,
            "thumbnail_path": match.thumbnail_path,
            "share_token": match.share_token,
            "is_password_protected": match.is_password_protected,
            "password": match.plain_password if is_trainer_or_admin else None,
            "password_expires_at": match.password_expires_at.isoformat() if match.password_expires_at else None,
            "is_password_expired": is_expired,
            "heatmap_status": str(match.heatmap_status.value if hasattr(match.heatmap_status, 'value') else match.heatmap_status or 'none'),
            "heatmap_path": match.heatmap_path,
            "heatmap_progress": getattr(match, 'heatmap_progress', 0.0) or (hm_info.get('progress', 0.0) if hm_info else 0.0),
            "heatmap_step_text": getattr(match, 'heatmap_step_text', '') or (hm_info.get('current_step_text', '') if hm_info else ''),
            "heatmap_job": hm_info,
            "video_brightness": match.video_brightness,
            "video_contrast": match.video_contrast,
            "video_saturation": match.video_saturation,
            "video_hue": match.video_hue,
            "highlight_job": hl_info,
            "is_detecting_highlights": is_detecting_highlights,
            "available_streams": available_streams,
            "field_calibration": json.loads(match.field_calibration) if match.field_calibration else None,
        }

        chunks_list = []
        for c in chunks:
            chunks_list.append({
                "id": c.id,
                "match_id": c.match_id,
                "video_path": c.video_path,
                "hls_playlist_path": c.hls_playlist_path,
                "video_path_sd": c.video_path_sd,
                "video_path_hd": c.video_path_hd,
                "video_path_fhd": c.video_path_fhd,
                "conversion_status": c.conversion_status,
                "conversion_progress": c.conversion_progress,
                "tracking_path": c.tracking_path,
                "file_size_mb": c.file_size_mb,
                "created_at": c.created_at.isoformat() if c.created_at else None
            })

        events_list = []
        for e in events:
            events_list.append({
                "id": e.id,
                "match_id": e.match_id,
                "event_type": e.event_type,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "video_time_ms": e.video_time_ms,
                "details": e.details
            })

        return {
            "match": match_dict,
            "chunks": chunks_list,
            "events": events_list,
            "is_subscribed": is_subscribed,
            "password": match.plain_password if is_trainer_or_admin else None,
            "password_expires_at": match.password_expires_at.isoformat() if match.password_expires_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Database or query error: {str(e)}\n\nDetails:\n{error_details}")

@router.put("/{match_id}", response_model=MatchOut)
async def update_match_details(match_id: str, match_update: MatchUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_trainer)):
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        update_data = match_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(match, key, value)

        # If team_id contains comma-separated IDs, build team_name from all matched teams
        if "team_id" in update_data and update_data["team_id"]:
            team_ids = [tid.strip() for tid in update_data["team_id"].split(",") if tid.strip()]
            if team_ids:
                matched_teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
                if matched_teams and "team_name" not in update_data:
                    # Preserve original order from team_ids
                    team_map = {t.id: t.name for t in matched_teams}
                    ordered_names = [team_map[tid] for tid in team_ids if tid in team_map]
                    match.team_name = ", ".join(ordered_names)

        db.commit()
        db.refresh(match)
        return match
    except Exception as e:
        error_details = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Error updating match: {str(e)}\n\nDetails:\n{error_details}")

@router.put("/{match_id}/password-protection", response_model=MatchOut)
async def update_match_password_protection(
    match_id: str,
    protection_update: MatchPasswordProtectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trainer)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.is_password_protected = protection_update.is_protected
    if protection_update.is_protected:
        if protection_update.password:
            match.hashed_password = get_password_hash(protection_update.password)
            match.plain_password = protection_update.password
        match.password_expires_at = protection_update.expires_at
    else:
        match.hashed_password = None
        match.plain_password = None
        match.password_expires_at = None

    db.commit()
    db.refresh(match)
    return match

@router.post("/{match_id}/verify-password")
async def verify_match_password(
    match_id: str,
    password_verify: MatchPasswordVerify,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not match.is_password_protected or not match.hashed_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not password protected")

    # Check expiration
    if match.password_expires_at and datetime.utcnow() > match.password_expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Der Passwort-Zugriff für dieses Match ist abgelaufen.")

    if verify_password(password_verify.password, match.hashed_password):
        # Set a session cookie to grant access for this match
        session_cookie_name = f"match_access_{match.id}"
        response.set_cookie(key=session_cookie_name, value="granted", httponly=True, max_age=3600, samesite="Lax") # 1 hour access
        return {"status": "success", "message": "Password verified"}
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falsches Passwort. Bitte versuchen Sie es erneut.")


# Subscription Endpoints
@router.post("/{match_id}/subscribe")
async def subscribe_to_match(match_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_viewer)):
    existing = db.query(Subscription).filter(Subscription.match_id == match_id, Subscription.user_id == current_user.id).first()
    if existing:
        return {"status": "already_subscribed"}

    new_sub = Subscription(user_id=current_user.id, match_id=match_id)
    db.add(new_sub)
    db.commit()
    return {"status": "subscribed"}

@router.post("/{match_id}/unsubscribe")
async def unsubscribe_from_match(match_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_viewer)):
    sub = db.query(Subscription).filter(Subscription.match_id == match_id, Subscription.user_id == current_user.id).first()
    if sub:
        db.delete(sub)
        db.commit()
        return {"status": "unsubscribed"}
    return {"status": "not_subscribed"}

class EventCreate(BaseModel):
    event_type: str
    video_time_ms: int
    details: Dict[str, Any] = {}

class EventUpdate(BaseModel):
    details: Dict[str, Any]

@router.post("/{match_id}/events")
async def add_event(
    match_id: str,
    event: EventCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
         raise HTTPException(status_code=404, detail="Match not found")

    if not _is_match_access_allowed(match, current_user, request):
        raise HTTPException(status_code=401, detail="Access denied. Password required.")

    # Password guests are allowed to post comments/markers
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper() if current_user else ""
    is_trainer_or_admin = user_role_str in ["ADMIN", "TEAM_ADMIN", "TRAINER", "CO_TRAINER"]
    if not is_trainer_or_admin and event.event_type == "drawing":
        raise HTTPException(status_code=403, detail="Password guests are only allowed to post markers and comments.")

    new_event = MatchEvent(
        id=str(uuid.uuid4()),
        match_id=match_id,
        event_type=event.event_type,
        video_time_ms=event.video_time_ms,
        details=event.details
    )
    
    tagged_player_ids = event.details.get("tagged_player_ids", []) if isinstance(event.details, dict) else []
    if tagged_player_ids:
        players = db.query(Player).filter(Player.id.in_(tagged_player_ids)).all()
        new_event.tagged_players = players

    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    # Aktivität protokollieren
    if current_user:
        try:
            from services.activity_service import log_user_activity
            act_type = "CREATE_DRAWING" if event.event_type == "drawing" else "ADD_COMMENT"
            log_user_activity(
                db=db,
                user_id=current_user.id,
                activity_type=act_type,
                resource_type="match",
                resource_id=match_id,
                details={"event_type": event.event_type, "video_time_ms": event.video_time_ms}
            )
        except Exception:
            pass

    # Benachrichtigungen senden
    notify_subscribers(match_id, "created", new_event, db)

    return new_event

@router.put("/{match_id}/events/{event_id}")
async def update_event(match_id: str, event_id: str, event_update: EventUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_trainer)):
    event = db.query(MatchEvent).filter(MatchEvent.id == event_id, MatchEvent.match_id == match_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.details = event_update.details
    
    tagged_player_ids = event_update.details.get("tagged_player_ids", []) if isinstance(event_update.details, dict) else []
    if tagged_player_ids:
        players = db.query(Player).filter(Player.id.in_(tagged_player_ids)).all()
        event.tagged_players = players
    else:
        event.tagged_players = []

    db.commit()
    db.refresh(event)

    # Benachrichtigungen senden
    notify_subscribers(match_id, "updated", event, db)

    return event

@router.delete("/{match_id}/events/{event_id}")
async def delete_event(match_id: str, event_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_trainer)):
    event = db.query(MatchEvent).filter(MatchEvent.id == event_id, MatchEvent.match_id == match_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return {"status": "success", "message": f"Event {event_id} deleted"}

@router.get("/{match_id}/heatmap-status")
async def get_heatmap_status_endpoint(match_id: str, db: Session = Depends(get_db)):
    """
    Liefert den aktuellen Verarbeitungsstatus und die prozentuale Fortschrittsanzeige
    der KI-Heatmap-Generierung für ein Match zurück.
    """
    from services.ai.heatmap_generator import get_heatmap_job_status
    return get_heatmap_job_status(match_id)

@router.post("/{match_id}/generate-heatmap")
async def generate_heatmap(match_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if settings and not settings.module_heatmap_enabled:
        raise HTTPException(status_code=400, detail="Heatmap-Modul ist in den System-Einstellungen deaktiviert.")

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.heatmap_status in [HeatmapStatus.PROCESSING, HeatmapStatus.QUEUED, HeatmapStatus.DONE]:
        return {"status": "info", "message": f"Heatmap status is already {match.heatmap_status.value}"}

    match.heatmap_status = HeatmapStatus.QUEUED
    match.heatmap_progress = 0.0
    match.heatmap_step_text = "In Warteschlange..."
    db.commit()

    # Job-Status im Speicher initialisieren
    from services.ai.heatmap_generator import update_heatmap_job_status, run_heatmap_generation
    update_heatmap_job_status(match_id, "QUEUED", 0.0, "In Warteschlange...", force_db=True)

    # Hintergrundtask starten
    background_tasks.add_task(run_heatmap_generation, match_id)

    return {"status": "success", "message": "Heatmap-Generierung im Hintergrund gestartet."}

@router.delete("/{match_id}/heatmap")
async def delete_heatmap(match_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """
    Löscht die erstellte Heatmap für ein Match und setzt den Status zurück.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")

    try:
        if match.heatmap_path:
            full_path = os.path.join(BASE_DIR, match.heatmap_path.lstrip('/'))
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception as e:
                    print(f"Warnung beim Löschen der Heatmap-Datei ({full_path}): {e}")

        # Auch eventuelle VideoChunk tracking_path-Einträge zurücksetzen
        chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
        for chunk in chunks:
            if chunk.tracking_path:
                chunk_tracking_abs = os.path.join(BASE_DIR, chunk.tracking_path.lstrip('/'))
                if os.path.exists(chunk_tracking_abs):
                    try:
                        os.remove(chunk_tracking_abs)
                    except Exception:
                        pass
                chunk.tracking_path = None

        match.heatmap_path = None
        match.heatmap_status = HeatmapStatus.NONE
        match.heatmap_progress = 0.0
        match.heatmap_step_text = ""
        db.commit()

        # Job aus Cache entfernen
        from services.ai.heatmap_generator import HEATMAP_JOBS
        HEATMAP_JOBS.pop(match_id, None)

        return {"status": "success", "message": "Heatmap erfolgreich gelöscht."}
    except Exception as e:
        db.rollback()
        print(f"Fehler beim Löschen der Heatmap: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler beim Löschen der Heatmap: {str(e)}")


class BatchAssignMatchesPayload(BaseModel):
    match_ids: list[str]
    team_id: str
    category: Optional[str] = None

@router.get("/unassigned/list")
async def get_unassigned_matches(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """
    Liefert alle Alt-Videos/Spiele zurück, denen noch keine Mannschaft zugewiesen ist.
    """
    matches = db.query(Match).filter((Match.team_id == None) | (Match.team_id == "")).order_by(Match.created_at.desc()).all()
    return [{
        "id": m.id,
        "name": m.name,
        "team_name": m.team_name,
        "category": getattr(m, 'category', 'Punktspiel') or 'Punktspiel',
        "recording_date": m.recording_date.isoformat() if m.recording_date else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "thumbnail_path": m.thumbnail_path,
        "video_quality": m.video_quality
    } for m in matches]

@router.post("/batch-assign")
async def batch_assign_matches(
    payload: BatchAssignMatchesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Weist mehrere Spiele gleichzeitig per 1-Klick einer Mannschaft zu.
    """
    if not payload.match_ids:
        raise HTTPException(status_code=400, detail="Keine Spiel-IDs übergeben.")

    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Ausgewählte Mannschaft wurde nicht gefunden.")

    matches = db.query(Match).filter(Match.id.in_(payload.match_ids)).all()
    if not matches:
        raise HTTPException(status_code=404, detail="Keine passenden Spiele gefunden.")

    updated_count = 0
    for match in matches:
        match.team_id = team.id
        match.team_name = team.name
        if payload.category:
            match.category = payload.category
        updated_count += 1

    db.commit()

    return {
        "status": "success",
        "message": f"{updated_count} Spiel(e) erfolgreich '{team.name}' zugewiesen.",
        "updated_count": updated_count,
        "team_id": team.id,
        "team_name": team.name
    }



# --- Spielfeld-Kalibrierung & 2D-Homographie ---

class FieldCalibrationPoint(BaseModel):
    x: float
    y: float

class FieldCalibrationPayload(BaseModel):
    src_points: list[FieldCalibrationPoint]
    pitch_type: Optional[str] = "full"
    homography_matrix: Optional[list[float]] = None

@router.get("/{match_id}/calibration")
async def get_match_calibration(
    match_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden.")

    if not _is_match_access_allowed(match, current_user, request):
        raise HTTPException(status_code=401, detail="Passwort erforderlich.")

    calib = None
    if match.field_calibration:
        try:
            calib = json.loads(match.field_calibration)
        except Exception:
            pass

    return {
        "match_id": match_id,
        "field_calibration": calib
    }

@router.post("/{match_id}/calibration")
async def save_match_calibration(
    match_id: str,
    payload: FieldCalibrationPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden.")

    is_admin = current_user.role == UserRole.ADMIN
    is_trainer = current_user.role in [UserRole.TRAINER, UserRole.CO_TRAINER, UserRole.TEAM_ADMIN]
    if not (is_admin or is_trainer):
        raise HTTPException(status_code=403, detail="Keine Berechtigung zur Spielfeld-Kalibrierung.")

    calibration_dict = {
        "src_points": [{"x": p.x, "y": p.y} for p in payload.src_points],
        "pitch_type": payload.pitch_type or "full",
        "homography_matrix": payload.homography_matrix,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": current_user.name or current_user.email
    }
    match.field_calibration = json.dumps(calibration_dict)
    db.commit()

    # Optional: Falls bereits ein tracking.jsonl existiert, heatmap_2d.png aktualisieren
    try:
        chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).first()
        if chunk and chunk.video_path:
            video_path_rel = chunk.video_path.replace("backend/", "", 1) if chunk.video_path.startswith("backend/") else chunk.video_path
            video_dir_abs = os.path.dirname(os.path.join(BASE_DIR, video_path_rel))
            tracking_file = os.path.join(video_dir_abs, "tracking.jsonl")
            if os.path.exists(tracking_file):
                from services.ai.homography import compute_pitch_homography, transform_positions, generate_2d_pitch_heatmap_image
                positions = []
                with open(tracking_file, "r") as f_tr:
                    for line in f_tr:
                        l = line.strip()
                        if not l: continue
                        try:
                            item = json.loads(l)
                            for det in item.get("detections", []):
                                positions.append({
                                    "x": det.get("x", 0),
                                    "y": det.get("y", 0),
                                    "ground_x": det.get("ground_x", det.get("x", 0)),
                                    "ground_y": det.get("ground_y", det.get("y", 0))
                                })
                        except Exception:
                            pass

                if positions:
                    H = compute_pitch_homography(calibration_dict["src_points"], pitch_type=calibration_dict["pitch_type"])
                    if H is not None:
                        pitch_pts = transform_positions(positions, H)
                        heatmap_2d_abs = os.path.join(video_dir_abs, "heatmap_2d.png")
                        generate_2d_pitch_heatmap_image(pitch_pts, heatmap_2d_abs)
    except Exception as e_2d:
        print(f"[Calibration] 2D-Heatmap Update im Hintergrund fehlgeschlagen: {e_2d}")

    return {
        "status": "success",
        "message": "Spielfeld-Kalibrierung erfolgreich gespeichert.",
        "field_calibration": calibration_dict
    }


