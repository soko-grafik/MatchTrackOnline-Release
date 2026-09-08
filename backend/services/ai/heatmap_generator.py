import os
import time
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from models import Match, HeatmapStatus, VideoChunk
from db.session import SessionLocal, BASE_DIR
from .tracker import process_video_for_heatmap

logger = logging.getLogger(__name__)

# In-Memory Cache für latenzfreie Status- und Fortschrittsabfragen
HEATMAP_JOBS: Dict[str, Dict[str, Any]] = {}
_LAST_DB_SYNC: Dict[str, float] = {}

def get_heatmap_job_status(match_id: str) -> dict:
    """
    Gibt den aktuellen Verarbeitungsstatus und die prozentuale Fortschrittsanzeige
    der KI-Heatmap für ein Match zurück.
    """
    job = HEATMAP_JOBS.get(match_id)
    if job:
        return job

    # Fallback auf DB-Stand (z. B. nach Server-Neustart)
    db = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return {
                "has_job": False,
                "status": "NONE",
                "progress": 0.0,
                "current_step_text": "",
                "error_message": None
            }
        
        status_raw = str(match.heatmap_status.value if hasattr(match.heatmap_status, 'value') else match.heatmap_status or 'NONE').upper()
        progress = float(getattr(match, 'heatmap_progress', 0.0) or 0.0)
        step_text = getattr(match, 'heatmap_step_text', '') or ''
        
        if status_raw in ["DONE", "COMPLETED"]:
            progress = 100.0
            step_text = step_text or "Heatmap abgeschlossen"
        elif status_raw == "QUEUED":
            step_text = step_text or "In Warteschlange..."

        return {
            "has_job": status_raw in ["QUEUED", "PROCESSING"],
            "status": status_raw,
            "progress": round(progress, 1),
            "current_step_text": step_text,
            "error_message": None,
            "updated_at": time.time()
        }
    finally:
        db.close()

def update_heatmap_job_status(match_id: str, status: str, progress: float, step_text: str = "", error: str = None, force_db: bool = False):
    """
    Aktualisiert den Status und Fortschritt im Speicher sowie gedrosselt in der Datenbank.
    """
    now = time.time()
    rounded_prog = round(float(progress), 1)
    status_upper = status.upper()

    HEATMAP_JOBS[match_id] = {
        "has_job": status_upper in ["QUEUED", "PROCESSING"],
        "status": status_upper,
        "progress": rounded_prog,
        "current_step_text": step_text,
        "error_message": error,
        "updated_at": now
    }

    # DB-Sync: Bei Statusänderungen, Completion, Fehler oder alle 3 Sekunden
    last_sync = _LAST_DB_SYNC.get(match_id, 0.0)
    should_sync_db = force_db or (status_upper in ["DONE", "ERROR", "QUEUED"]) or (now - last_sync >= 3.0) or (rounded_prog >= 100.0)

    if should_sync_db:
        _LAST_DB_SYNC[match_id] = now
        db = SessionLocal()
        try:
            match = db.query(Match).filter(Match.id == match_id).first()
            if match:
                if status_upper in ["PROCESSING", "QUEUED", "DONE", "ERROR"]:
                    try:
                        match.heatmap_status = HeatmapStatus[status_upper]
                    except Exception:
                        pass
                match.heatmap_progress = rounded_prog
                match.heatmap_step_text = step_text
                db.commit()
        except Exception as sync_err:
            logger.warning(f"Fehler beim DB-Sync des Heatmap-Fortschritts für Match {match_id}: {sync_err}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()

def run_heatmap_generation(match_id: str):
    """
    Führt den echten KI-Tracker aus, um die Heatmap-Daten zu generieren, und meldet
    den Fortschritt kontinuierlich an Speicher und Datenbank.
    """
    logger.info(f"Initialisiere Heatmap-Job für Match {match_id}...")
    update_heatmap_job_status(match_id, "PROCESSING", 2.0, "Initialisiere KI-Videoanalyse & Modell...", force_db=True)

    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            logger.error(f"Match {match_id} nicht gefunden.")
            update_heatmap_job_status(match_id, "ERROR", 0.0, "Match nicht gefunden.", error="Match not found", force_db=True)
            return

        # Finde das erste Video-Chunk
        chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).order_by(VideoChunk.created_at.asc()).first()
        if not chunk:
            logger.error(f"Kein Video-Chunk für Match {match_id} gefunden.")
            update_heatmap_job_status(match_id, "ERROR", 0.0, "Kein Video für dieses Spiel gefunden.", error="No video chunk found", force_db=True)
            return

        # Pfade vorbereiten (relativ zum BASE_DIR)
        video_path_rel = chunk.video_path.replace("backend/", "", 1) if chunk.video_path.startswith("backend/") else chunk.video_path
        video_path_abs = os.path.join(BASE_DIR, video_path_rel)
        output_dir_abs = os.path.dirname(video_path_abs)
        video_chunk_id = chunk.id
    finally:
        db.close()

    # 2. KI-Tracking ausführen mit kontinuierlicher Fortschritts-Rückmeldung
    try:
        if not os.path.exists(video_path_abs):
            err_msg = f"Videodatei nicht gefunden: {video_path_abs}"
            logger.error(err_msg)
            update_heatmap_job_status(match_id, "ERROR", 0.0, "Videodatei nicht gefunden.", error=err_msg, force_db=True)
            return

        logger.info(f"Heatmap-Generierung für Match {match_id} gestartet (Video: {video_path_abs})")

        def progress_callback(pct: float, text: str):
            update_heatmap_job_status(match_id, "PROCESSING", pct, text)

        process_video_for_heatmap(video_path_abs, output_dir_abs, match_id=match_id, progress_callback=progress_callback)

        # 3. Pfade für DB vorbereiten (relativ zum Frontend)
        db = SessionLocal()
        try:
            match = db.query(Match).filter(Match.id == match_id).first()
            chunk = db.query(VideoChunk).filter(VideoChunk.id == video_chunk_id).first()

            match_folder_rel = os.path.dirname(chunk.video_path)
            heatmap_path_rel = os.path.join(match_folder_rel, "heatmap.png").replace("\\", "/")
            tracking_path_rel = os.path.join(match_folder_rel, "tracking.jsonl").replace("\\", "/")
            tracking_path_abs = os.path.join(output_dir_abs, "tracking.jsonl")

            # 2.5 Optional 2D-Spielfeld-Vogelperspektive vorrendern
            try:
                from .homography import compute_pitch_homography, transform_positions, generate_2d_pitch_heatmap_image
                import json
                
                # Positionen aus tracking.jsonl lesen
                positions_for_2d = []
                if os.path.exists(tracking_path_abs):
                    with open(tracking_path_abs, "r") as f_tr:
                        for line in f_tr:
                            line_str = line.strip()
                            if not line_str: continue
                            try:
                                data_item = json.loads(line_str)
                                for det in data_item.get("detections", []):
                                    positions_for_2d.append({
                                        "x": det.get("x", 0),
                                        "y": det.get("y", 0),
                                        "ground_x": det.get("ground_x", det.get("x", 0)),
                                        "ground_y": det.get("ground_y", det.get("y", 0))
                                    })
                            except Exception:
                                pass

                if positions_for_2d:
                    calib = None
                    if match and match.field_calibration:
                        try:
                            calib = json.loads(match.field_calibration)
                        except Exception:
                            pass
                    
                    src_pts = calib.get("src_points") if calib else None
                    p_type = calib.get("pitch_type", "full") if calib else "full"
                    if not src_pts:
                        src_pts = [
                            {"x": 0.10, "y": 0.20},
                            {"x": 0.90, "y": 0.20},
                            {"x": 0.98, "y": 0.92},
                            {"x": 0.02, "y": 0.92}
                        ]
                    
                    H = compute_pitch_homography(src_pts, pitch_type=p_type)
                    if H is not None:
                        pitch_pts = transform_positions(positions_for_2d, H)
                        heatmap_2d_abs = os.path.join(output_dir_abs, "heatmap_2d.png")
                        generate_2d_pitch_heatmap_image(pitch_pts, heatmap_2d_abs)
                        logger.info(f"2D-Spielfeld-Heatmap erfolgreich gespeichert: {heatmap_2d_abs}")
            except Exception as e_2d:
                logger.warning(f"2D-Spielfeld Heatmap Vorberechnung übersprungen: {e_2d}")

            if match:
                match.heatmap_path = heatmap_path_rel
                match.heatmap_status = HeatmapStatus.DONE
                match.heatmap_progress = 100.0
                match.heatmap_step_text = "Heatmap erfolgreich abgeschlossen."
            if chunk:
                chunk.tracking_path = tracking_path_rel

            db.commit()
            logger.info(f"Heatmap-Generierung für Match {match_id} erfolgreich abgeschlossen.")
            update_heatmap_job_status(match_id, "DONE", 100.0, "Heatmap erfolgreich abgeschlossen.", force_db=True)
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Fehler bei der Heatmap-Generierung für Match {match_id}: {e}")
        update_heatmap_job_status(match_id, "ERROR", 0.0, f"Fehler: {str(e)}", error=str(e), force_db=True)
