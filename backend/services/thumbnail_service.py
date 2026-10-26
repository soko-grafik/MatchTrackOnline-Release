import os
import subprocess
import logging
import uuid
import base64
from typing import Optional
from sqlalchemy.orm import Session
from models import Match, VideoChunk
from db.session import ROOT_DIR, UPLOAD_DIR, SessionLocal
from services.video_service import FFMPEG_PATH

# Konfiguration
THUMBNAIL_TIME = "00:00:05"  # Zeitpunkt im Video für das Thumbnail
THUMBNAIL_FILENAME = "thumbnail.jpg"

# Logging einrichten
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_thumbnail(match_id: str):
    """
    Generiert ein Thumbnail für das angegebene Match.
    Nimmt das erste Video-Chunk des Matches als Quelle.
    """
    logger.info(f"Starte Thumbnail-Generierung für Match ID: {match_id}")

    db = SessionLocal()
    try:
        # Finde das Match und das erste Video-Chunk
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            logger.error(f"Match mit ID {match_id} nicht gefunden.")
            return

        first_chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).order_by(VideoChunk.created_at.asc()).first()
        if not first_chunk:
            logger.error(f"Keine Video-Chunks für Match ID {match_id} gefunden.")
            return

        clean_chunk_path = first_chunk.video_path.replace('backend/', '').lstrip('/')
        video_path_abs = os.path.join(ROOT_DIR, clean_chunk_path)

        match_folder_rel = os.path.dirname(clean_chunk_path) # z.B. uploads/match-123
        thumbnail_path_rel = os.path.join(match_folder_rel, THUMBNAIL_FILENAME).replace('\\', '/') # z.B. uploads/match-123/thumbnail.jpg
        thumbnail_path_abs = os.path.join(ROOT_DIR, thumbnail_path_rel)

        logger.info(f"Input Video (absolut): {video_path_abs}")
        logger.info(f"Output Thumbnail (absolut): {thumbnail_path_abs}")

        if not os.path.exists(video_path_abs):
            logger.error(f"Videodatei nicht gefunden: {video_path_abs}")
            return

        # FFmpeg-Befehl zum Extrahieren eines Frames
        command = [
            FFMPEG_PATH,
            "-i", video_path_abs,    # Input-Datei
            "-ss", THUMBNAIL_TIME,   # Zeitpunkt
            "-vframes", "1",         # Nur einen Frame extrahieren
            "-q:v", "2",             # Bildqualität (1-31, niedriger ist besser)
            "-y",                    # Überschreibe die Datei, falls sie existiert
            thumbnail_path_abs
        ]

        # Führe den Befehl aus
        subprocess.run(command, check=True, capture_output=True, text=True)

        # Speichere den relativen Pfad in der Datenbank
        match.thumbnail_path = thumbnail_path_rel
        db.commit()
        logger.info(f"Thumbnail erfolgreich für Match {match_id} generiert und in DB gespeichert: {thumbnail_path_rel}")

    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg-Fehler bei der Thumbnail-Generierung für Match {match_id}:")
        logger.error(f"Command: {' '.join(command)}")
        logger.error(f"Stderr: {e.stderr}")
    except Exception as e:
        logger.error(f"Ein unerwarteter Fehler ist aufgetreten: {e}")
    finally:
        db.close()


def offload_base64_thumbnail(data_uri: Optional[str], subfolder: str = "thumbnails", prefix: str = "thumb") -> Optional[str]:
    """
    Falls data_uri eine Base64 Data-URL (data:image/...) ist, wird das Bild dekodiert,
    als Datei unter uploads/{subfolder}/{prefix}_{uuid}.png gespeichert und der
    statische relative Pfad (/uploads/{subfolder}/{filename}) zurückgegeben.
    Bereits ausgelagerte Pfade oder None bleiben unverändert.
    """
    if not data_uri or not isinstance(data_uri, str) or not data_uri.startswith("data:image/"):
        return data_uri

    try:
        header, encoded = data_uri.split(",", 1)
        ext = "png"
        if "webp" in header.lower():
            ext = "webp"
        elif "jpeg" in header.lower() or "jpg" in header.lower():
            ext = "jpg"

        file_bytes = base64.b64decode(encoded)
        filename = f"{prefix}_{uuid.uuid4().hex[:12]}.{ext}"
        target_dir = os.path.join(UPLOAD_DIR, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, filename)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return f"/uploads/{subfolder}/{filename}"
    except Exception as e:
        print(f"[ThumbnailService] Fehler beim Auslagern der Base64-Vorschau: {e}")
        return data_uri
