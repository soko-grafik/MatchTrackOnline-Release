import os
import logging
from sqlalchemy.orm import Session
from models import Match, HeatmapStatus, VideoChunk
from db.session import SessionLocal, BASE_DIR
from .tracker import process_video_for_heatmap

logger = logging.getLogger(__name__)

def run_heatmap_generation(match_id: str):
    """
    Diese Funktion führt den echten KI-Tracker aus, um die Heatmap-Daten zu generieren.
    """
    # 1. Status auf "processing" setzen
    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            logger.error(f"Match {match_id} nicht gefunden.")
            return

        match.heatmap_status = HeatmapStatus.PROCESSING
        db.commit()
        
        # Finde das erste Video-Chunk
        chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).order_by(VideoChunk.created_at.asc()).first()
        if not chunk:
            logger.error(f"Kein Video-Chunk für Match {match_id} gefunden.")
            match.heatmap_status = HeatmapStatus.ERROR
            db.commit()
            return

        # Pfade vorbereiten
        # video_path in DB ist relativ zum Frontend (z.B. backend/uploads/...)
        video_path_rel = chunk.video_path.replace("backend/", "", 1) if chunk.video_path.startswith("backend/") else chunk.video_path
        video_path_abs = os.path.join(BASE_DIR, video_path_rel)
        output_dir_abs = os.path.dirname(video_path_abs)
        
        video_chunk_id = chunk.id # ID merken für später
    finally:
        db.close()

    # 2. KI-Tracking ausführen (Dauert lange - KEINE DB Verbindung offen halten)
    try:
        if not os.path.exists(video_path_abs):
            logger.error(f"Videodatei nicht gefunden: {video_path_abs}")
            _set_status(match_id, HeatmapStatus.ERROR)
            return

        logger.info(f"Heatmap-Generierung für Match {match_id} gestartet (Video: {video_path_abs})")
        process_video_for_heatmap(video_path_abs, output_dir_abs)
        
        # 3. Pfade für DB vorbereiten (relativ zum Frontend)
        # Wir brauchen hier nochmal kurz die DB um die Pfade zu speichern
        db = SessionLocal()
        try:
            match = db.query(Match).filter(Match.id == match_id).first()
            chunk = db.query(VideoChunk).filter(VideoChunk.id == video_chunk_id).first()
            
            match_folder_rel = os.path.dirname(chunk.video_path)
            heatmap_path_rel = os.path.join(match_folder_rel, "heatmap.png")
            tracking_path_rel = os.path.join(match_folder_rel, "tracking.jsonl")

            match.heatmap_path = heatmap_path_rel
            match.heatmap_status = HeatmapStatus.DONE
            chunk.tracking_path = tracking_path_rel
            
            db.commit()
            logger.info(f"Heatmap-Generierung für Match {match_id} erfolgreich abgeschlossen.")
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Fehler bei der Heatmap-Generierung für Match {match_id}: {e}")
        _set_status(match_id, HeatmapStatus.ERROR)

def _set_status(match_id: str, status: HeatmapStatus):
    db = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if match:
            match.heatmap_status = status
            db.commit()
    finally:
        db.close()
