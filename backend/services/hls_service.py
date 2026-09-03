import os
import subprocess
import logging
import glob
from sqlalchemy.orm import Session
from models import VideoChunk
from db.session import BASE_DIR, SessionLocal

# Logging einrichten
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def has_audio_stream(video_path_abs: str, ffprobe_path: str) -> bool:
    """Überprüft mit ffprobe, ob das Video eine Audiospur besitzt."""
    command = [
        ffprobe_path,
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path_abs
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        return "audio" in result.stdout.strip().lower()
    except Exception as e:
        logger.warning(f"Fehler bei der Audio-Erkennung für {video_path_abs}: {e}")
        return False

def get_video_dimensions(video_path_abs: str, ffprobe_path: str) -> dict:
    """Ermittelt Breite, Höhe und Aspect Ratio des Videos."""
    command = [
        ffprobe_path, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        video_path_abs
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        dims = result.stdout.strip().split('x')
        if len(dims) == 2:
            w, h = int(dims[0]), int(dims[1])
            is_panorama = (w / float(h)) >= 2.2 # e.g. 32:9 aspect ratio (~3.55)
            return {"width": w, "height": h, "is_panorama": is_panorama}
    except Exception as e:
        logger.warning(f"Konnte Videodimensionen für {video_path_abs} nicht ermitteln: {e}")
    return {"width": 1920, "height": 1080, "is_panorama": False}

def get_video_duration(video_path_abs: str, ffprobe_path: str) -> float:
    """Ermittelt die Gesamtdauer des Videos in Sekunden."""
    command = [
        ffprobe_path, "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path_abs
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"Konnte Videodauer für {video_path_abs} nicht ermitteln: {e}")
        return 0.0

def generate_hls_playlist(chunk_id: int, progress_callback=None, skip_transcoding: bool = False):
    """
    Konvertiert ein MP4-Video in eine ABR (Adaptive Bitrate) HLS-Playlist.
    Ablauf:
    1. Schnelle HLS-Erstellung via copy-Codec, damit das Video SOFORT abspielbar ist.
    2. Transkodierung im Hintergrund in SD (480p), HD (720p) und Originalqualität (1080p).
    3. Ablösung der temporären Playlist durch die Master-Playlist und Bereinigung der Temp-Dateien.
    """
    import time
    logger.info(f"Starte HLS-Konvertierung für Chunk ID: {chunk_id}")
    if progress_callback:
        progress_callback(5.0, "Initialisiere HLS Multi-Bitrate Pipeline...")

    # Schritt 1: Infos aus DB holen
    db_session = SessionLocal()
    try:
        chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if not chunk or not chunk.video_path:
            logger.error(f"Chunk {chunk_id} oder dessen video_path nicht gefunden.")
            return

        video_path_rel = chunk.video_path
        video_path_abs = os.path.join(BASE_DIR, video_path_rel.replace('backend/', '', 1))

        # Setze Status auf "processing"
        chunk.conversion_status = "processing"
        chunk.conversion_progress = 10
        db_session.commit()
    finally:
        db_session.close()

    if not os.path.exists(video_path_abs):
        logger.error(f"Videodatei nicht gefunden: {video_path_abs}")
        db_session = SessionLocal()
        try:
            chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
            if chunk:
                chunk.conversion_status = "failed"
                db_session.commit()
        finally:
            db_session.close()
        return

    # FFmpeg- und FFprobe-Pfade importieren
    from services.video_service import FFMPEG_PATH as ffmpeg_path, FFPROBE_PATH as ffprobe_path

    match_folder_abs = os.path.dirname(video_path_abs)
    base_filename = os.path.splitext(os.path.basename(video_path_abs))[0]

    # --- Phase 1: Schnelle HLS-Generierung (Sofortige Verfügbarkeit) ---
    temp_playlist_filename = f"{base_filename}_temp_hls.m3u8"
    temp_playlist_path_abs = os.path.join(match_folder_abs, temp_playlist_filename)
    
    match_folder_rel = os.path.dirname(video_path_rel)
    temp_playlist_path_rel = f"{match_folder_rel}/{temp_playlist_filename}"

    fast_command = [
        ffmpeg_path, "-y", "-i", video_path_abs, "-codec", "copy", "-start_number", "0",
        "-hls_time", "4", "-hls_list_size", "0",
        "-hls_segment_filename", os.path.join(match_folder_abs, f"{base_filename}_temp_%03d.ts"),
        "-f", "hls", temp_playlist_path_abs
    ]

    fast_success = False
    try:
        if progress_callback:
            progress_callback(10.0, "Erstelle schnellen HLS-Vorabstream (Sofort-Wiedergabe)...")
        logger.info(f"Führe schnelle HLS-Kopie aus für Chunk {chunk_id}")
        subprocess.run(fast_command, check=True, capture_output=True, text=True)
        fast_success = True
        logger.info(f"Schnelle HLS-Kopie für Chunk {chunk_id} erfolgreich.")
        if progress_callback:
            progress_callback(20.0, "Schneller Vorabstream bereit. Starte Multi-Bitrate ABR Rendering...")
    except Exception as e:
        logger.error(f"Fehler bei schneller HLS-Generierung für Chunk {chunk_id}: {e}")

    # Wenn die schnelle HLS-Generierung geklappt hat, in DB eintragen, damit User das Video sofort sieht
    if fast_success:
        db_session = SessionLocal()
        try:
            chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
            if chunk:
                chunk.hls_playlist_path = temp_playlist_path_rel
                chunk.conversion_progress = 100 if skip_transcoding else 30
                if skip_transcoding:
                    chunk.conversion_status = "completed"
                db_session.commit()
        finally:
            db_session.close()

    if skip_transcoding:
        logger.info(f"skip_transcoding aktiv: Beende HLS-Generierung für Chunk {chunk_id} nach Phase 1.")
        if progress_callback:
            progress_callback(100.0, "Schneller HLS-Stream (ohne Transkodierung) vollständig erstellt.")
        return

    # --- Phase 2: Transkodierung zu Adaptivem HLS (ABR) ---
    abr_folder_name = f"{base_filename}_abr"
    abr_folder_abs = os.path.join(match_folder_abs, abr_folder_name)
    os.makedirs(abr_folder_abs, exist_ok=True)
    os.makedirs(os.path.join(abr_folder_abs, "v0"), exist_ok=True)
    os.makedirs(os.path.join(abr_folder_abs, "v1"), exist_ok=True)
    os.makedirs(os.path.join(abr_folder_abs, "v2"), exist_ok=True)

    master_playlist_path_abs = os.path.join(abr_folder_abs, "master.m3u8")
    master_playlist_path_rel = f"{match_folder_rel}/{abr_folder_name}/master.m3u8"

    # Audiospur & Videodimensionen & Dauer ermitteln
    has_audio = has_audio_stream(video_path_abs, ffprobe_path)
    video_dims = get_video_dimensions(video_path_abs, ffprobe_path)
    total_duration = get_video_duration(video_path_abs, ffprobe_path)
    is_panorama = video_dims["is_panorama"]
    logger.info(f"Audiospur vorhanden für Chunk {chunk_id}: {has_audio} | Dimensionen: {video_dims['width']}x{video_dims['height']} (Dauer: {total_duration:.1f}s)")

    # Target bitrates based on aspect ratio
    low_bitrate = "700k" if is_panorama else "800k"
    med_bitrate = "1800k" if is_panorama else "2000k"

    # ABR FFmpeg-Kommando zusammenbauen
    # Begrenzung auf 2 CPU-Kerne mit '-threads 2'
    abr_command = [
        ffmpeg_path, "-y", "-threads", "2", "-i", video_path_abs,
        "-filter_complex", "[0:v]split=2[v1][v2]; [v1]scale=854:-2[v1_out]; [v2]scale=1280:-2[v2_out]"
    ]

    # Video Streams mappen
    abr_command.extend([
        "-map", "[v1_out]", "-c:v:0", "libx264", "-b:v:0", low_bitrate, "-maxrate:v:0", "900k", "-bufsize:v:0", "1200k", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-map", "[v2_out]", "-c:v:1", "libx264", "-b:v:1", med_bitrate, "-maxrate:v:1", "2200k", "-bufsize:v:1", "3000k", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-map", "0:v", "-c:v:2", "copy", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0"
    ])

    # Audio Streams mappen falls vorhanden
    if has_audio:
        abr_command.extend([
            "-map", "0:a", "-c:a:0", "aac", "-b:a:0", "64k",
            "-map", "0:a", "-c:a:1", "aac", "-b:a:1", "128k",
            "-map", "0:a", "-c:a:2", "copy",
            "-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2"
        ])
    else:
        abr_command.extend([
            "-var_stream_map", "v:0 v:1 v:2"
        ])

    # HLS-Muxer Optionen & Progress-Pipe hinzufügen
    abr_command.extend([
        "-progress", "pipe:1",
        "-nostats",
        "-f", "hls",
        "-hls_time", "4",
        "-hls_playlist_type", "vod",
        "-hls_segment_filename", os.path.join(abr_folder_abs, "v%v", "fileSequence%d.ts"),
        "-master_pl_name", "master.m3u8",
        os.path.join(abr_folder_abs, "v%v", "index.m3u8")
    ])

    # Ausführung mit niedriger Priorität auf dem VPS (via nice unter Linux/Unix)
    ffmpeg_cmd = abr_command if os.name == 'nt' else ["nice", "-n", "15"] + abr_command

    abr_success = False
    try:
        logger.info(f"Starte ABR HLS-Transkodierung für Chunk {chunk_id}...")
        if progress_callback:
            progress_callback(25.0, "Multi-Bitrate ABR Streams (1080p/720p/480p) werden kodiert...")

        last_report_time = 0.0
        process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        for line in iter(process.stdout.readline, ''):
            line_s = line.strip()
            if line_s.startswith("out_time_us="):
                try:
                    us_val = int(line_s.split("=")[1])
                    curr_sec = us_val / 1_000_000.0
                    if total_duration > 0:
                        raw_pct = min(100.0, (curr_sec / total_duration) * 100.0)
                        # Skaliere Phase 2 von 25% bis 98%
                        scaled_pct = 25.0 + (raw_pct / 100.0) * 73.0
                        now = time.time()
                        if now - last_report_time >= 2.0:
                            last_report_time = now
                            if progress_callback:
                                progress_callback(
                                    round(scaled_pct, 1),
                                    f"Transkodiere HLS Streams: {int(raw_pct)}% ({int(curr_sec)}s / {int(total_duration)}s)"
                                )
                except Exception:
                    pass
            elif line_s.startswith("progress=end"):
                break

        process.wait()
        if process.returncode != 0:
            stderr_out = process.stderr.read()
            logger.error(f"FFmpeg error: {stderr_out}")
            raise subprocess.CalledProcessError(process.returncode, ffmpeg_cmd, output=None, stderr=stderr_out)

        abr_success = True
        logger.info(f"ABR HLS-Transkodierung für Chunk {chunk_id} erfolgreich abgeschlossen.")
        if progress_callback:
            progress_callback(100.0, "HLS Multi-Bitrate Streams vollständig erstellt.")
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg-Fehler bei ABR HLS-Transkodierung für Chunk {chunk_id}: {e.stderr}")
    except Exception as e:
        logger.error(f"Unerwarteter Fehler bei ABR HLS-Transkodierung für Chunk {chunk_id}: {e}")

    # --- Phase 3: Update DB & Bereinigung ---
    db_session = SessionLocal()
    try:
        chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if chunk:
            if abr_success:
                # Update auf die neue ABR Master-Playlist
                chunk.hls_playlist_path = master_playlist_path_rel
                chunk.conversion_status = "completed"
                chunk.conversion_progress = 100
                logger.info(f"Datenbank auf ABR Master-Playlist für Chunk {chunk_id} aktualisiert.")
                
                # Temp-Dateien löschen
                if fast_success:
                    try:
                        if os.path.exists(temp_playlist_path_abs):
                            os.remove(temp_playlist_path_abs)
                        temp_segments = glob.glob(os.path.join(match_folder_abs, f"{base_filename}_temp_[0-9][0-9][0-9].ts"))
                        for segment in temp_segments:
                            os.remove(segment)
                        logger.info(f"Temporäre HLS-Dateien für Chunk {chunk_id} erfolgreich gelöscht.")
                    except Exception as clean_err:
                        logger.error(f"Fehler bei Bereinigung temporärer HLS-Dateien: {clean_err}")
            else:
                # Wenn ABR fehlgeschlagen ist, behalten wir die schnelle Playlist als Fallback
                if fast_success:
                    chunk.conversion_status = "completed" # Trotzdem verfügbar
                    chunk.conversion_progress = 100
                    logger.warning(f"ABR fehlgeschlagen. Schnelles HLS als Fallback beibehalten für Chunk {chunk_id}.")
                else:
                    chunk.conversion_status = "failed"
            
            db_session.commit()
    finally:
        db_session.close()
