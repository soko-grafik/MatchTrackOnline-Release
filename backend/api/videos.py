from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Query
from sqlalchemy.orm import Session
from db.session import get_db
from models import Match, User, SystemSettings, VideoStitchJob, StitchingStatus, Team
from .dependencies import require_admin
from services.fisheye_service import get_preview_frame, process_fisheye_correction_task
from typing import List, Optional, Dict
from pydantic import BaseModel

router = APIRouter()

class CorrectionPoint(BaseModel):
    x: float
    y: float

class FisheyeCorrectionParams(BaseModel):
    method: str  # 'slider' or 'corners'
    k1: Optional[float] = 0.0
    k2: Optional[float] = 0.0
    points: Optional[List[CorrectionPoint]] = None

class VideoAdjustments(BaseModel):
    brightness: int
    contrast: int
    saturation: int
    hue: int

@router.get("/{match_id}/preview")
async def get_video_preview(match_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """
    Gibt ein Vorschaubild (Base64) des Videos zurück.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    base64_image = get_preview_frame(match_id)
    if not base64_image:
        raise HTTPException(status_code=500, detail="Could not extract preview frame")
    
    return {"image": base64_image}

@router.post("/{match_id}/correct-fisheye")
async def correct_fisheye(
    match_id: str, 
    params: FisheyeCorrectionParams,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """
    Startet die Fisheye-Korrektur als Hintergrundtask.
    """
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if settings and not settings.module_fisheye_enabled:
        raise HTTPException(status_code=400, detail="Fisheye-Korrektur-Modul ist in den System-Einstellungen deaktiviert.")

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Validation
    if params.method == 'corners' and (not params.points or len(params.points) != 4):
        raise HTTPException(status_code=400, detail="4 points required for corner method")
    
    # Start background task
    background_tasks.add_task(
        process_fisheye_correction_task, 
        match_id, 
        params.method, 
        params.dict()
    )
    
    return {"status": "success", "message": "Fisheye correction started in background."}

# ---------------------------------------------------------------------------
# 🎥 Highlights & Video-Anpassungen Endpunkte
# ---------------------------------------------------------------------------

@router.post("/matches/{match_id}/detect-highlights")
async def trigger_detect_highlights(
    match_id: str,
    background_tasks: BackgroundTasks,
    speed: str = Query("normal"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Startet die nachträgliche KI-Highlight-Erkennung für ein existierendes Video.
    `speed` waehlt die Geschwindigkeits-/Qualitaetsstufe: "fast" (grob & schnell),
    "normal" (Standard) oder "slow" (dichteste Abtastung & groesseres Modell fuer die
    beste Praezision). Ungueltige Werte fallen auf "normal" zurueck.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")

    from services.tracker_service import generate_highlights_for_existing_match, update_highlight_job_status
    speed_normalized = speed.lower() if speed and speed.lower() in ("fast", "normal", "slow") else "normal"
    update_highlight_job_status(match_id, "PROCESSING", 1.0, f"Bereite KI-Analyse vor (Stufe: {speed_normalized})...")
    background_tasks.add_task(generate_highlights_for_existing_match, match_id, speed_normalized)

    return {"status": "started", "message": f"KI-Highlight-Erkennung ({speed_normalized}) im Hintergrund gestartet.", "speed": speed_normalized}

@router.get("/matches/{match_id}/highlight-status")
async def get_match_highlight_status(
    match_id: str,
    db: Session = Depends(get_db)
):
    """
    Gibt den aktuellen Live-Status und Fortschritt der KI-Highlight-Erkennung zurück.
    """
    from services.tracker_service import get_highlight_job_status
    return get_highlight_job_status(match_id)


@router.post("/{match_id}/adjustments")
async def update_video_adjustments(
    match_id: str,
    adjustments: VideoAdjustments,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Aktualisiert die Farbanpassungswerte des Videos.
    """
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if settings and not settings.module_video_color_enabled:
        raise HTTPException(status_code=400, detail="Video-Farbanpassungs-Modul ist in den System-Einstellungen deaktiviert.")

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match.video_brightness = adjustments.brightness
    match.video_contrast = adjustments.contrast
    match.video_saturation = adjustments.saturation
    match.video_hue = adjustments.hue
    
    db.commit()
    
    return {
        "status": "success", 
        "adjustments": {
            "brightness": match.video_brightness,
            "contrast": match.video_contrast,
            "saturation": match.video_saturation,
            "hue": match.video_hue
        }
    }


