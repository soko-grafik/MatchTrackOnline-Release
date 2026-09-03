import os
import shutil
import subprocess
import time
import traceback
from datetime import datetime
from sqlalchemy.orm import Session

from db.session import SessionLocal, UPLOAD_DIR, BASE_DIR, ROOT_DIR
from models import VideoStitchJob, Match, VideoChunk, MatchEvent, StitchingStatus, SystemSettings
from services.stitch_service import compute_audio_offset, stitch_video_to_panorama
from services.tracker_service import process_tracking_and_reframing
from services.thumbnail_service import generate_thumbnail
from services.hls_service import generate_hls_playlist

def append_job_log(job_id: str, message: str, status: str = None, progress: float = None, step_text: str = None, error: str = None):
    """Fügt einen datierten Log-Eintrag in die DB ein und aktualisiert Status & Fortschritt."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(f"[StitchWorker] {log_line}")

    db = SessionLocal()
    try:
        job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
        if job:
            if status:
                job.status = status
            if progress is not None:
                job.progress = round(float(progress), 1)
            if step_text:
                job.current_step_text = step_text
            if error:
                job.error_message = error

            current_logs = job.detailed_logs or ""
            job.detailed_logs = (current_logs + "\n" + log_line).strip()
            db.commit()
    except Exception as e:
        print(f"[Worker] Error appending log for {job_id}: {e}")
    finally:
        db.close()

def resolve_file_path(rel_or_abs_path: str) -> str:
    """Findet zuverlässig die Videodatei im Dateisystem."""
    if not rel_or_abs_path:
        return ""
    if os.path.isabs(rel_or_abs_path) and os.path.exists(rel_or_abs_path):
        return rel_or_abs_path

    clean = rel_or_abs_path.replace("uploads/", "").replace("uploads\\", "").replace("backend/", "").lstrip("/\\")
    candidates = [
        os.path.join(UPLOAD_DIR, clean),
        os.path.join(ROOT_DIR, "uploads", clean),
        os.path.join(BASE_DIR, "uploads", clean),
        os.path.join(BASE_DIR, rel_or_abs_path.lstrip("/\\")),
        os.path.join(ROOT_DIR, rel_or_abs_path.lstrip("/\\")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

def execute_stitching_and_reframing_job(job_id: str):
    """
    Vollständige asynchrone Pipeline mit Live-Logging:
    1. Audio-Sync
    2. 32:9 Video-Stitching (OpenCV & FFmpeg)
    3. YOLOv8 Tracking & Pan & Scan (16:9) + Automatische Match-Events
    4. HLS Packaging & Chunk-Zuordnung
    5. Cleanup der Rohdateien
    """
    db = SessionLocal()
    job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
    if not job:
        print(f"[Worker] Job {job_id} not found in DB.")
        db.close()
        return

    match_id = job.match_id
    left_raw_path = job.left_video_path
    right_raw_path = job.right_video_path
    output_mode = job.output_mode or "DYNAMIC_16_9"
    detect_events_auto = job.detect_events_auto

    job_settings = job.settings_json or {}
    meow_settings = job_settings.get("meow_settings") or job_settings.get("manual_alignment") or {}
    manual_time_offset_ms = job_settings.get("manual_time_offset_ms")
    db.close()

    append_job_log(job_id, f"🚀 Starte 2-Kamera Video-Stitching Pipeline (Modus: {output_mode})...", status="PENDING", progress=2.0, step_text="Initialisiere Pipeline...")

    # Pfade auflösen
    left_path = resolve_file_path(left_raw_path)
    right_path = resolve_file_path(right_raw_path)

    append_job_log(job_id, f"📁 Quelle Links: {left_path} ({'gefunden' if os.path.exists(left_path) else 'NICHT GEFUNDEN!'})")
    append_job_log(job_id, f"📁 Quelle Rechts: {right_path} ({'gefunden' if os.path.exists(right_path) else 'NICHT GEFUNDEN!'})")

    match_folder = os.path.join(UPLOAD_DIR, match_id)
    os.makedirs(match_folder, exist_ok=True)

    master_32x9_path = os.path.join(match_folder, "panorama_32x9.mp4")
    broadcast_16x9_path = os.path.join(match_folder, "broadcast_16x9.mp4")

    has_rendered_target = (os.path.exists(broadcast_16x9_path) and os.path.getsize(broadcast_16x9_path) > 1024 * 100) or \
                          (os.path.exists(master_32x9_path) and os.path.getsize(master_32x9_path) > 1024 * 100)

    if not has_rendered_target and (not os.path.exists(left_path) or not os.path.exists(right_path)):
        err = f"Quelldateien fehlen: Links ({os.path.exists(left_path)}), Rechts ({os.path.exists(right_path)})"
        append_job_log(job_id, f"❌ FEHLER: {err}", status="FAILED", progress=100.0, step_text="Fehler: Quelldateien fehlen", error=err)
        return

    if os.path.exists(left_path) and os.path.exists(right_path):
        size_l_mb = round(os.path.getsize(left_path) / (1024 * 1024), 1)
        size_r_mb = round(os.path.getsize(right_path) / (1024 * 1024), 1)
        append_job_log(job_id, f"📊 Dateigrößen: Kamera Links = {size_l_mb} MB | Kamera Rechts = {size_r_mb} MB")

    def progress_callback(perc, text):
        append_job_log(job_id, text, status="PROCESSING", progress=perc, step_text=text)

    try:
        # Schritt 1: Zeit-Synchronisation (0 - 15%)
        offset_ms = 0
        if manual_time_offset_ms is not None and manual_time_offset_ms != 0:
            offset_ms = int(manual_time_offset_ms)
            append_job_log(job_id, f"🎯 Schritt 1/4: Manuelle Audio-/Zeitsynchronisation: {offset_ms} ms", status="SYNCING", progress=5.0, step_text="Manuelle Zeitsynchronisation...")

            db = SessionLocal()
            job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
            if job:
                job.audio_sync_offset_ms = offset_ms
                db.commit()
            db.close()
        elif not has_rendered_target and os.path.exists(left_path) and os.path.exists(right_path):
            append_job_log(job_id, "🎵 Schritt 1/4: Meow Audio-Synchronisation via Kreuzkorrelation...", status="SYNCING", progress=5.0, step_text="Audio-Synchronisation...")
            offset_ms = compute_audio_offset(left_path, right_path, match_folder)
            append_job_log(job_id, f"⏱️ Berechneter Audio-Versatz: {offset_ms} ms (Kamera 2 startet {abs(offset_ms)}ms {'später' if offset_ms >= 0 else 'früher'})")

            db = SessionLocal()
            job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
            if job:
                job.audio_sync_offset_ms = offset_ms
                db.commit()
            db.close()

        # Schritt 2: Meow Panorama Stitching & Multi-Band Blending (15 - 45%)
        if os.path.exists(master_32x9_path) and os.path.getsize(master_32x9_path) > 1024 * 100:
            pano_size_mb = round(os.path.getsize(master_32x9_path) / (1024 * 1024), 1)
            append_job_log(job_id, f"✅ Bestehendes 32:9 Panorama gefunden ({pano_size_mb} MB) - überspringe Stitching.", progress=45.0)
        else:
            mode_name = meow_settings.get("video_processing_type", "panoramaStitching")
            append_job_log(job_id, f"🤖 Schritt 2/4: Starte Meow Engine ({mode_name})...", status="STITCHING", progress=15.0, step_text="Meow Stitching...")
            ok_stitch = stitch_video_to_panorama(
                job_id, left_path, right_path, offset_ms, master_32x9_path, progress_callback,
                manual_alignment=meow_settings
            )

            if not ok_stitch or not os.path.exists(master_32x9_path):
                raise Exception("Fehler beim Erstellen des 32:9 Panoramas (Output-Datei nicht erstellt).")

            pano_size_mb = round(os.path.getsize(master_32x9_path) / (1024 * 1024), 1)
            append_job_log(job_id, f"✅ 32:9 Ultra-Wide Panorama erfolgreich erstellt ({pano_size_mb} MB).", progress=45.0)

        db = SessionLocal()
        job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
        if job:
            job.stitched_panorama_path = f"uploads/{match_id}/panorama_32x9.mp4"
            db.commit()
        db.close()

        # Schritt 3: YOLOv8 Tracking, 16:9 Dynamic Cam & Highlight-Erkennung (45 - 80%)
        if output_mode in ["DYNAMIC_16_9", "DUAL"]:
            if os.path.exists(broadcast_16x9_path) and os.path.getsize(broadcast_16x9_path) > 1024 * 100:
                bc_size_mb = round(os.path.getsize(broadcast_16x9_path) / (1024 * 1024), 1)
                append_job_log(job_id, f"✅ Bestehendes 16:9 Broadcast Video gefunden ({bc_size_mb} MB) - überspringe Rendering.", progress=80.0)
            else:
                append_job_log(job_id, "🤖 Schritt 3/4: Starte YOLOv8 Action Tracking & 16:9 Pan & Scan Reframing...", status="TRACKING", progress=48.0, step_text="YOLOv8 Action Tracking...")
                process_tracking_and_reframing(
                    job_id,
                    master_32x9_path,
                    broadcast_16x9_path,
                    output_mode=output_mode,
                    detect_events_auto=detect_events_auto,
                    progress_callback=progress_callback
                )

                if os.path.exists(broadcast_16x9_path):
                    bc_size_mb = round(os.path.getsize(broadcast_16x9_path) / (1024 * 1024), 1)
                    append_job_log(job_id, f"✅ 16:9 Dynamic Cam Video erfolgreich gerendert ({bc_size_mb} MB).", progress=80.0)

            db = SessionLocal()
            job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
            if job:
                job.reframed_broadcast_path = f"uploads/{match_id}/broadcast_16x9.mp4"
                db.commit()
            db.close()

        # Schritt 4: HLS Packaging & Zuordnung zu Match / VideoChunk (85 - 98%)
        append_job_log(job_id, "📦 Schritt 4/4: Erstelle HLS Multi-Bitrate Streams & Video-Chunks...", status="PACKAGING", progress=85.0, step_text="HLS Packaging 0%")

        db = SessionLocal()
        primary_video_rel = f"uploads/{match_id}/broadcast_16x9.mp4" if output_mode in ["DYNAMIC_16_9", "DUAL"] and os.path.exists(broadcast_16x9_path) else f"uploads/{match_id}/panorama_32x9.mp4"

        # Chunk erstellen oder aktualisieren
        chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).first()
        if not chunk:
            chunk = VideoChunk(
                match_id=match_id,
                video_path=primary_video_rel,
                conversion_status="completed",
                conversion_progress=100
            )
            db.add(chunk)
        else:
            chunk.video_path = primary_video_rel
            chunk.conversion_status = "completed"
            chunk.conversion_progress = 100

        # Match-Status aktualisieren
        match_obj = db.query(Match).filter(Match.id == match_id).first()
        if match_obj:
            match_obj.stitching_status = StitchingStatus.DONE

        db.commit()
        db.refresh(chunk)

        # HLS Generierung mit prozentualem Fortschritt
        def hls_progress_callback(sub_pct: float, text: str):
            # Mappe HLS-Fortschritt (0 - 100%) auf Gesamtpipeline-Fortschritt (85.0% - 98.0%)
            overall_progress = round(85.0 + (float(sub_pct) / 100.0) * 13.0, 1)
            append_job_log(
                job_id,
                f"📦 Schritt 4/4: {text}",
                status="PACKAGING",
                progress=overall_progress,
                step_text=f"HLS: {int(sub_pct)}%"
            )

        try:
            generate_hls_playlist(chunk.id, progress_callback=hls_progress_callback)
            append_job_log(job_id, "✅ HLS Streaming-Playlists generiert.", progress=98.0)
        except Exception as hls_err:
            append_job_log(job_id, f"⚠️ HLS Warnung: {hls_err}")

        # Thumbnail generieren
        try:
            generate_thumbnail(match_id)
            append_job_log(job_id, "✅ Match-Vorschaubild (Thumbnail) generiert.")
        except Exception as thumb_err:
            append_job_log(job_id, f"⚠️ Thumbnail Warnung: {thumb_err}")

        db.close()

        # Schritt 5: Cleanup der beiden großen Original-Rohdateien
        try:
            if os.path.exists(left_path):
                os.remove(left_path)
            if os.path.exists(right_path):
                os.remove(right_path)
            append_job_log(job_id, "🧹 Roh-Videodateien gelöscht (Speicherplatz freigegeben).")
        except Exception as clean_err:
            append_job_log(job_id, f"⚠️ Cleanup Hinweis: {clean_err}")

        # Fertiggestellt!
        append_job_log(job_id, "🎉 Alle Schritte erfolgreich abgeschlossen! Match steht bereit.", status="COMPLETED", progress=100.0, step_text="Abgeschlossen")

    except Exception as e:
        tb = traceback.format_exc()
        err_msg = f"{str(e)}\n\nTraceback:\n{tb}"
        print(f"[Worker] Fatal Error in job {job_id}:\n{tb}")
        append_job_log(job_id, f"❌ FEHLER: {str(e)}", status="FAILED", progress=100.0, step_text="Fehler bei der Verarbeitung", error=err_msg)
