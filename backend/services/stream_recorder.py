import os
import sys
import time
import signal
import subprocess
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from db.session import SessionLocal, UPLOAD_DIR
from models import LivestreamRecording

# Globaler State für aktive Aufnahme
_active_recording_process: Optional[subprocess.Popen] = None
_active_recording_id: Optional[str] = None
_active_recording_start_time: Optional[float] = None
_active_recording_path: Optional[str] = None
_active_save_permanently: bool = True

def get_recordings_dir() -> str:
    rec_dir = os.path.join(UPLOAD_DIR, "recordings")
    os.makedirs(rec_dir, exist_ok=True)
    return rec_dir

def get_active_recording_status() -> Dict[str, Any]:
    global _active_recording_process, _active_recording_id, _active_recording_start_time, _active_recording_path, _active_save_permanently
    
    is_active = False
    file_size = 0
    duration = 0.0

    if _active_recording_process is not None:
        if _active_recording_process.poll() is None:
            is_active = True
            if _active_recording_start_time:
                duration = round(time.time() - _active_recording_start_time, 1)
            if _active_recording_path and os.path.exists(_active_recording_path):
                file_size = os.path.getsize(_active_recording_path)
        else:
            # Prozess unerwartet beendet
            finalize_recording()

    return {
        "is_recording": is_active,
        "recording_id": _active_recording_id,
        "duration_seconds": duration,
        "file_size_bytes": file_size,
        "file_path": _active_recording_path,
        "save_permanently": _active_save_permanently
    }

def start_recording(
    stream_key: str = "stitched", 
    title: Optional[str] = None, 
    save_permanently: bool = True
) -> Dict[str, Any]:
    global _active_recording_process, _active_recording_id, _active_recording_start_time, _active_recording_path, _active_save_permanently

    current_status = get_active_recording_status()
    if current_status["is_recording"]:
        return {
            "success": False,
            "message": "Eine Aufnahme läuft bereits.",
            "status": current_status
        }

    rec_dir = get_recordings_dir()
    rec_id = f"rec_{uuid.uuid4().hex[:12]}"
    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_name = f"matchtrack_live_{timestamp_str}_{stream_key}.mp4"
    file_path = os.path.join(rec_dir, file_name)

    rec_title = title.strip() if title and title.strip() else f"Livestream Aufnahme {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}"

    input_url = f"http://127.0.0.1:8888/live/{stream_key}/index.m3u8"

    cmd = [
        "ffmpeg", "-nostdin", "-y",
        "-fflags", "+genpts",
        "-reconnect", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_streamed", "1",
        "-i", input_url,
        "-c", "copy",
        "-movflags", "+faststart",
        file_path
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )
        
        _active_recording_process = proc
        _active_recording_id = rec_id
        _active_recording_start_time = time.time()
        _active_recording_path = file_path
        _active_save_permanently = save_permanently

        # In DB speichern
        with SessionLocal() as db:
            rec = LivestreamRecording(
                id=rec_id,
                title=rec_title,
                file_path=file_path,
                file_size_bytes=0,
                duration_seconds=0.0,
                mode=stream_key,
                status="RECORDING",
                save_permanently=save_permanently
            )
            db.add(rec)
            db.commit()

        return {
            "success": True,
            "message": "Aufnahme gestartet.",
            "recording_id": rec_id,
            "file_path": file_path,
            "save_permanently": save_permanently
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Fehler beim Starten der Aufnahme: {e}"
        }

def stop_recording(discard: Optional[bool] = None) -> Dict[str, Any]:
    global _active_recording_process, _active_recording_id, _active_recording_start_time, _active_recording_path

    if _active_recording_process is None:
        return {"success": False, "message": "Keine aktive Aufnahme vorhanden."}

    proc = _active_recording_process

    try:
        if sys.platform == "win32":
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            proc.send_signal(signal.SIGINT)
        
        proc.wait(timeout=4)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

    return finalize_recording(discard=discard)

def finalize_recording(discard: Optional[bool] = None) -> Dict[str, Any]:
    global _active_recording_process, _active_recording_id, _active_recording_start_time, _active_recording_path, _active_save_permanently

    rec_id = _active_recording_id
    file_path = _active_recording_path
    start_time = _active_recording_start_time
    save_perm = _active_save_permanently

    duration = round(time.time() - start_time, 1) if start_time else 0.0
    file_size = os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0

    should_discard = discard if discard is not None else (not save_perm)

    if rec_id:
        try:
            with SessionLocal() as db:
                rec = db.query(LivestreamRecording).filter(LivestreamRecording.id == rec_id).first()
                if rec:
                    if should_discard:
                        # Datei sofort physisch von der Festplatte löschen
                        if file_path and os.path.exists(file_path):
                            try:
                                os.remove(file_path)
                            except Exception as del_err:
                                print(f"[StreamRecorder] Datei konnte nicht gelöscht werden: {del_err}")
                        db.delete(rec)
                        db.commit()
                        rec_id = None
                    else:
                        rec.status = "COMPLETED"
                        rec.duration_seconds = duration
                        rec.file_size_bytes = file_size
                        rec.updated_at = datetime.utcnow()
                        db.commit()
        except Exception as err:
            print(f"[StreamRecorder] DB finalize error: {err}")

    # Reset State
    _active_recording_process = None
    _active_recording_id = None
    _active_recording_start_time = None
    _active_recording_path = None
    _active_save_permanently = True

    if should_discard:
        return {
            "success": True,
            "message": "Aufnahme beendet und Datei wie gewünscht automatisch vom Server gelöscht (Speicher geschont).",
            "discarded": True
        }

    return {
        "success": True,
        "message": "Aufnahme erfolgreich beendet und dauerhaft auf Server gespeichert.",
        "recording_id": rec_id,
        "file_size_bytes": file_size,
        "duration_seconds": duration,
        "file_path": file_path,
        "discarded": False
    }
