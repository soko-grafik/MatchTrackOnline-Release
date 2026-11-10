import os
import subprocess
import logging
import glob
import time
import shutil
import threading
from typing import Optional
from collections import deque
from db.session import SessionLocal, BASE_DIR
from models import VideoChunk

logger = logging.getLogger(__name__)

# Lock für schwere Hintergrund-Transkodierungen (Phase 2 ABR & AutoRepair),
# damit ein neuer Upload in Phase 1 (Sofort-Wiedergabe) immer sofort volle CPU bekommt.
_abr_lock = threading.Lock()
_active_phase1_count = 0
_phase1_counter_lock = threading.Lock()
_active_processes: dict = {}
_cancelled_chunks: set = set()
_auto_repair_cancelled = False


def has_audio_stream(video_path: str, ffprobe_path: str) -> bool:
    """Prüft mit ffprobe, ob die Videodatei eine Audiospur besitzt."""
    try:
        cmd = [
            ffprobe_path, "-v", "error", "-select_streams", "a",
            "-show_entries", "stream=index", "-of", "csv=p=0", video_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        return len(result.stdout.strip()) > 0
    except Exception as e:
        logger.warning(f"Audio-Check fehlgeschlagen für {video_path}: {e}")
        return False


def get_video_stream_info(video_path: str, ffprobe_path: str) -> dict:
    """
    Ermittelt Codec, Pixel-Format (8-Bit vs. 10-Bit) und Auflösung des ersten Video-Streams.
    Wichtig: Browser/hls.js unterstützen in MPEG-TS (.ts) Segmenten KEIN HEVC/H.265
    und oft kein 10-Bit (yuv420p10le). Solche Videos führen im Player zu 'Nur Ton, kein Bild'.
    """
    info = {
        "codec_name": "unknown",
        "pix_fmt": "unknown",
        "width": 1920,
        "height": 1080,
        "is_panorama": False,
        "is_browser_h264_compatible": False,
    }
    try:
        cmd = [
            ffprobe_path, "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,pix_fmt,width,height",
            "-of", "default=noprint_wrappers=1:nokey=0", video_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        parsed = {}
        for line in result.stdout.strip().splitlines():
            if "=" in line:
                k, v = line.strip().split("=", 1)
                parsed[k.strip()] = v.strip()

        codec_name = parsed.get("codec_name", "unknown").lower()
        pix_fmt = parsed.get("pix_fmt", "unknown").lower()
        w = int(parsed.get("width", 1920) or 1920)
        h = int(parsed.get("height", 1080) or 1080)

        is_pano = (w / max(h, 1)) >= 2.3
        # Nur 8-Bit H.264 (yuv420p / yuvj420p) bis max. 4096px Breite ist in allen Browsern via HLS/MP4 garantiert bildfähig
        is_compatible = (
            codec_name == "h264"
            and pix_fmt in ("yuv420p", "yuvj420p")
            and w <= 4096
            and h <= 2304
        )
        info.update({
            "codec_name": codec_name,
            "pix_fmt": pix_fmt,
            "width": w,
            "height": h,
            "is_panorama": is_pano,
            "is_browser_h264_compatible": is_compatible,
        })
    except Exception as e:
        logger.warning(f"Stream-Info-Check fehlgeschlagen für {video_path}: {e}")
    return info


def get_video_dimensions(video_path: str, ffprobe_path: str) -> dict:
    """Ermittelt Breite, Höhe und ob es sich um ein 32:9 Panorama-Video handelt."""
    stream_info = get_video_stream_info(video_path, ffprobe_path)
    return {
        "width": stream_info["width"],
        "height": stream_info["height"],
        "is_panorama": stream_info["is_panorama"],
    }


def get_video_duration(video_path: str, ffprobe_path: str) -> float:
    """Ermittelt die Gesamtdauer des Videos in Sekunden mittels ffprobe."""
    try:
        cmd = [
            ffprobe_path, "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", video_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        val = result.stdout.strip()
        return float(val) if val else 0.0
    except Exception as e:
        logger.warning(f"Dauer-Check fehlgeschlagen für {video_path}: {e}")
        return 0.0


def _update_chunk_db_progress(chunk_id: Optional[int], progress: int, playlist_rel: Optional[str] = None):
    """Aktualisiert conversion_progress (und optional hls_playlist_path) eines Chunks in der DB."""
    if not chunk_id:
        return
    db_session = SessionLocal()
    try:
        chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if chunk:
            chunk.conversion_progress = max(int(chunk.conversion_progress or 0), int(progress))
            if playlist_rel and not chunk.hls_playlist_path:
                chunk.hls_playlist_path = playlist_rel
                logger.info(
                    f"Chunk {chunk_id}: Vorab-HLS-Stream ist ab sofort im Player abspielbar ({playlist_rel})!"
                )
            db_session.commit()
    except Exception as e:
        logger.debug(f"DB-Progress-Update fehlgeschlagen für Chunk {chunk_id}: {e}")
    finally:
        db_session.close()


def _run_ffmpeg_with_progress(
    ffmpeg_cmd: list,
    total_duration: float = 0.0,
    progress_callback=None,
    start_pct: float = 0.0,
    end_pct: float = 100.0,
    step_prefix: str = "Verarbeite Video",
    chunk_id: Optional[int] = None,
    early_hls_abs: Optional[str] = None,
    early_hls_rel: Optional[str] = None,
    early_seg_pattern: Optional[str] = None,
):
    """
    Führt ein FFmpeg-Kommando mit zusammengeführtem stdout/stderr aus.
    WICHTIG: Verhindert den klassischen subprocess.PIPE Deadlock auf stderr,
    da FFmpeg dauerhaft Statuszeilen auf stderr schreibt.
    Aktualisiert zudem regelmäßig die Datenbank und schaltet bei progressivem HLS
    den Stream frei, sobald die ersten Segmente auf der Festplatte liegen.
    """
    tail_lines = deque(maxlen=80)
    last_report_time = 0.0
    last_db_update_time = 0.0
    last_logged_bucket = -1
    early_hls_published = False

    process = subprocess.Popen(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1
    )
    if chunk_id is not None:
        _active_processes[chunk_id] = process

    span = max(1.0, end_pct - start_pct)
    try:
        for line in iter(process.stdout.readline, ''):
            if chunk_id is not None and chunk_id in _cancelled_chunks:
                logger.info(f"Chunk {chunk_id}: FFmpeg-Prozess wird auf Benutzeranforderung abgebrochen.")
                try:
                    process.terminate()
                except Exception:
                    pass
                break
            line_s = line.strip()
            if not line_s:
                continue
            tail_lines.append(line_s)

            # Prüfe bei progressiver HLS-Transkodierung, ob bereits mindestens 2 Segmente bereitstehen
            if not early_hls_published and early_hls_abs and early_hls_rel and early_seg_pattern:
                if os.path.exists(early_hls_abs) and len(glob.glob(early_seg_pattern)) >= 2:
                    early_hls_published = True
                    _update_chunk_db_progress(chunk_id, max(15, int(start_pct)), playlist_rel=early_hls_rel)

            if line_s.startswith("out_time_us="):
                try:
                    us_val = int(line_s.split("=")[1])
                    curr_sec = max(0.0, us_val / 1_000_000.0)
                    if total_duration > 0:
                        raw_pct = min(100.0, (curr_sec / total_duration) * 100.0)
                        scaled_pct = start_pct + (raw_pct / 100.0) * span
                        now = time.time()

                        if now - last_report_time >= 2.0:
                            last_report_time = now
                            if progress_callback:
                                progress_callback(
                                    round(scaled_pct, 1),
                                    f"{step_prefix}: {int(raw_pct)}% ({int(curr_sec)}s / {int(total_duration)}s)"
                                )

                        if chunk_id and (now - last_db_update_time >= 4.0):
                            last_db_update_time = now
                            _update_chunk_db_progress(chunk_id, int(scaled_pct))

                        bucket = int(raw_pct) // 10
                        if bucket > last_logged_bucket and bucket > 0:
                            last_logged_bucket = bucket
                            logger.info(
                                f"Chunk {chunk_id or '-'}: {step_prefix} {int(raw_pct)}% "
                                f"({int(curr_sec)}s / {int(total_duration)}s)"
                            )
                except Exception:
                    pass
            elif line_s.startswith("progress=end"):
                break
    finally:
        if chunk_id is not None:
            _active_processes.pop(chunk_id, None)

    process.wait()
    if chunk_id is not None and chunk_id in _cancelled_chunks:
        return
    if process.returncode != 0:
        err_log = "\n".join(tail_lines)
        logger.error(f"FFmpeg Fehler (Exit {process.returncode}):\n{err_log}")
        raise subprocess.CalledProcessError(process.returncode, ffmpeg_cmd, output=err_log, stderr=err_log)


def ensure_browser_compatible_mp4(
    video_path_abs: str,
    ffmpeg_path: str,
    ffprobe_path: str,
    total_duration: float = 0.0,
    progress_callback=None,
    chunk_id: Optional[int] = None
) -> bool:
    """
    Stellt sicher, dass eine MP4-Quelldatei in 8-Bit H.264 (yuv420p) vorliegt.
    Wird für Standalone-MP4-Normalisierungen (z.B. Stitcher/Tracker) genutzt.
    """
    stream_info = get_video_stream_info(video_path_abs, ffprobe_path)
    if stream_info["is_browser_h264_compatible"]:
        logger.info(
            f"Video ist bereits Browser-kompatibel (h264 / {stream_info['pix_fmt']} / "
            f"{stream_info['width']}x{stream_info['height']}): {video_path_abs}"
        )
        return True

    logger.info(
        f"Inkompatibler Video-Codec/Format erkannt "
        f"(codec={stream_info['codec_name']}, pix_fmt={stream_info['pix_fmt']}, "
        f"res={stream_info['width']}x{stream_info['height']}). "
        f"Normalisiere auf 8-Bit H.264 (yuv420p) für Browser-Wiedergabe..."
    )

    has_audio = has_audio_stream(video_path_abs, ffprobe_path)
    norm_tmp_path = f"{video_path_abs}.norm_h264.mp4"

    vf_filter = "scale='min(3840,iw)':-2,format=yuv420p"
    cmd = [
        ffmpeg_path, "-y",
        "-i", video_path_abs,
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-preset", "superfast",
        "-crf", "22",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
    ]
    if has_audio:
        cmd.extend(["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"])
    else:
        cmd.extend(["-an"])

    cmd.extend([
        "-movflags", "+faststart",
        "-progress", "pipe:1",
        "-nostats",
        norm_tmp_path
    ])

    exec_cmd = cmd if os.name == 'nt' else ["nice", "-n", "10"] + cmd

    try:
        if progress_callback:
            progress_callback(8.0, "Konvertiere Kamera-Codec (HEVC/10-Bit) in Browser-H.264...")
        _run_ffmpeg_with_progress(
            exec_cmd,
            total_duration=total_duration,
            progress_callback=progress_callback,
            start_pct=8.0,
            end_pct=55.0,
            step_prefix="Normalisiere Video-Codec (H.264 8-Bit)",
            chunk_id=chunk_id
        )
        if os.path.exists(norm_tmp_path) and os.path.getsize(norm_tmp_path) > 1024:
            shutil.move(norm_tmp_path, video_path_abs)
            logger.info(f"Video erfolgreich auf 8-Bit H.264 (yuv420p) normalisiert: {video_path_abs}")
            return True
    except Exception as e:
        logger.error(f"Fehler bei H.264-Normalisierung von {video_path_abs}: {e}")
        if os.path.exists(norm_tmp_path):
            try:
                os.remove(norm_tmp_path)
            except Exception:
                pass
    return False


def generate_hls_playlist(chunk_id: int, progress_callback=None, skip_transcoding: bool = False):
    """
    Konvertiert ein MP4-Video in eine ABR (Adaptive Bitrate) HLS-Playlist.
    Ablauf:
    1. Phase 1 (Sofort-Wiedergabe):
       - Ist das Quellvideo bereits 8-Bit H.264 (yuv420p), wird per Stream-Copy in Sekunden
         `_temp_hls.m3u8` erstellt.
       - Ist das Quellvideo HEVC/H.265 oder 10-Bit, wird progressiv in einen 8-Bit H.264
         `_temp_hls.m3u8` Event-Stream kodiert. Sobald die ersten 2 Segmente (~5 Sekunden!)
         vorliegen, wird `hls_playlist_path` in der DB gesetzt -> das Video ist SOFORT
         mit Bild & Ton im Browser abspielbar! Danach wird die MP4-Quelldatei verlustfrei
         per Stream-Copy aus den H.264-Segmenten aktualisiert.
    2. Phase 2 (ABR im Hintergrund):
       - Transkodiert SD (480p), HD (720p) und Originalqualität (v2 Stream-Copy) für
         adaptives Streaming und ersetzt `_temp_hls.m3u8` durch `master.m3u8`.
    """
    global _active_phase1_count
    _cancelled_chunks.discard(chunk_id)
    logger.info(f"Starte HLS-Konvertierung für Chunk ID: {chunk_id}")
    if progress_callback:
        progress_callback(5.0, "Initialisiere HLS Video-Pipeline...")

    # Schritt 1: Infos aus DB holen
    db_session = SessionLocal()
    try:
        chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if not chunk or not chunk.video_path:
            logger.error(f"Chunk {chunk_id} oder dessen video_path nicht gefunden.")
            return

        video_path_rel = chunk.video_path
        video_path_abs = os.path.join(BASE_DIR, video_path_rel.replace('backend/', '', 1))

        chunk.conversion_status = "processing"
        chunk.conversion_progress = 5
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

    from services.video_service import FFMPEG_PATH as ffmpeg_path, FFPROBE_PATH as ffprobe_path

    match_folder_abs = os.path.dirname(video_path_abs)
    base_filename = os.path.splitext(os.path.basename(video_path_abs))[0]
    match_folder_rel = os.path.dirname(video_path_rel)

    total_duration = get_video_duration(video_path_abs, ffprobe_path)
    stream_info = get_video_stream_info(video_path_abs, ffprobe_path)
    is_h264_ready = stream_info["is_browser_h264_compatible"]
    has_audio = has_audio_stream(video_path_abs, ffprobe_path)
    is_panorama = stream_info["is_panorama"]

    logger.info(
        f"Chunk {chunk_id}: Codec={stream_info['codec_name']} | PixFmt={stream_info['pix_fmt']} | "
        f"Audio={has_audio} | Dimensionen={stream_info['width']}x{stream_info['height']} | "
        f"Dauer={total_duration:.1f}s | H264-Ready={is_h264_ready}"
    )

    temp_playlist_filename = f"{base_filename}_temp_hls.m3u8"
    temp_playlist_path_abs = os.path.join(match_folder_abs, temp_playlist_filename)
    temp_playlist_path_rel = f"{match_folder_rel}/{temp_playlist_filename}"
    temp_seg_pattern = os.path.join(match_folder_abs, f"{base_filename}_temp_*.ts")

    # Alte Temp-Segmente vorab aufräumen
    try:
        if os.path.exists(temp_playlist_path_abs):
            os.remove(temp_playlist_path_abs)
        for old_seg in glob.glob(temp_seg_pattern):
            os.remove(old_seg)
    except Exception:
        pass

    # --- Phase 1: Schnelle / Progressive HLS-Generierung (Sofortige Verfügbarkeit) ---
    fast_success = False
    with _phase1_counter_lock:
        _active_phase1_count += 1

    try:
        if is_h264_ready:
            logger.info(
                f"Video ist bereits Browser-kompatibel (h264 / {stream_info['pix_fmt']} / "
                f"{stream_info['width']}x{stream_info['height']}): {video_path_abs}"
            )
            fast_command = [
                ffmpeg_path, "-y", "-i", video_path_abs,
                "-c:v", "copy",
                "-bsf:v", "h264_mp4toannexb",
            ]
            if has_audio:
                fast_command.extend(["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"])
            else:
                fast_command.extend(["-an"])

            fast_command.extend([
                "-start_number", "0",
                "-hls_time", "4",
                "-hls_list_size", "0",
                "-hls_segment_filename", os.path.join(match_folder_abs, f"{base_filename}_temp_%05d.ts"),
                "-progress", "pipe:1",
                "-nostats",
                "-f", "hls", temp_playlist_path_abs
            ])

            if progress_callback:
                progress_callback(15.0, "Erstelle schnellen HLS-Vorabstream (Sofort-Wiedergabe)...")
            logger.info(f"Führe schnelle HLS-Erstellung aus für Chunk {chunk_id}")
            _run_ffmpeg_with_progress(
                fast_command,
                total_duration=total_duration,
                progress_callback=progress_callback,
                start_pct=10.0,
                end_pct=55.0,
                step_prefix="Schnelle HLS-Segmentierung",
                chunk_id=chunk_id,
                early_hls_abs=temp_playlist_path_abs,
                early_hls_rel=temp_playlist_path_rel,
                early_seg_pattern=temp_seg_pattern,
            )
            fast_success = True
            logger.info(f"Schnelle HLS-Erstellung für Chunk {chunk_id} erfolgreich.")
        else:
            # HEVC / 10-Bit / Überbreite -> Direkt progressiv nach 8-Bit H.264 HLS transkodieren!
            # Dadurch ist das Video bereits nach ~5 Sekunden (sobald 2 Segmente existieren) im Browser mit Bild & Ton abspielbar!
            logger.info(
                f"Inkompatibler Video-Codec/Format erkannt "
                f"(codec={stream_info['codec_name']}, pix_fmt={stream_info['pix_fmt']}, "
                f"res={stream_info['width']}x{stream_info['height']}). "
                f"Starte progressive 8-Bit H.264 HLS-Kodierung für Sofort-Wiedergabe..."
            )
            vf_filter = "scale='min(3840,iw)':-2,format=yuv420p"
            prog_hls_cmd = [
                ffmpeg_path, "-y",
                "-i", video_path_abs,
                "-vf", vf_filter,
                "-c:v", "libx264",
                "-preset", "superfast",
                "-crf", "22",
                "-profile:v", "high",
                "-pix_fmt", "yuv420p",
                "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
            ]
            if has_audio:
                prog_hls_cmd.extend(["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"])
            else:
                prog_hls_cmd.extend(["-an"])

            prog_hls_cmd.extend([
                "-start_number", "0",
                "-hls_time", "4",
                "-hls_list_size", "0",
                "-hls_playlist_type", "event",
                "-hls_flags", "independent_segments",
                "-hls_segment_filename", os.path.join(match_folder_abs, f"{base_filename}_temp_%05d.ts"),
                "-progress", "pipe:1",
                "-nostats",
                "-f", "hls", temp_playlist_path_abs
            ])

            exec_prog_cmd = prog_hls_cmd if os.name == 'nt' else ["nice", "-n", "10"] + prog_hls_cmd

            if progress_callback:
                progress_callback(10.0, "Konvertiere HEVC/Kamera-Codec in Browser-H.264 Stream...")

            _run_ffmpeg_with_progress(
                exec_prog_cmd,
                total_duration=total_duration,
                progress_callback=progress_callback,
                start_pct=10.0,
                end_pct=55.0,
                step_prefix="Normalisiere HEVC -> H.264 Stream",
                chunk_id=chunk_id,
                early_hls_abs=temp_playlist_path_abs,
                early_hls_rel=temp_playlist_path_rel,
                early_seg_pattern=temp_seg_pattern,
            )
            fast_success = True
            logger.info(f"Progressive H.264 HLS-Erstellung für Chunk {chunk_id} abgeschlossen.")

            # Jetzt die MP4-Quelldatei extrem schnell (ohne erneutes Enkodieren!) per Stream-Copy
            # aus den fertigen H.264 HLS-Segmenten aktualisieren, damit auch MP4-Download & ABR v2 kompatibel sind.
            norm_tmp_path = f"{video_path_abs}.norm_h264.mp4"
            remux_cmd = [
                ffmpeg_path, "-y",
                "-i", temp_playlist_path_abs,
                "-c", "copy",
            ]
            if has_audio:
                remux_cmd.extend(["-bsf:a", "aac_adtstoasc"])
            remux_cmd.extend(["-movflags", "+faststart", norm_tmp_path])

            try:
                logger.info(f"Aktualisiere MP4-Quelldatei per Fast-Remux auf 8-Bit H.264 für Chunk {chunk_id}...")
                subprocess.run(remux_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
                if os.path.exists(norm_tmp_path) and os.path.getsize(norm_tmp_path) > 1024:
                    shutil.move(norm_tmp_path, video_path_abs)
                    is_h264_ready = True
                    logger.info(f"MP4-Quelldatei für Chunk {chunk_id} ist jetzt 8-Bit H.264 (yuv420p).")
            except Exception as remux_err:
                logger.warning(f"Fast-Remux der MP4-Quelldatei für Chunk {chunk_id} nicht möglich: {remux_err}")
                if os.path.exists(norm_tmp_path):
                    try:
                        os.remove(norm_tmp_path)
                    except Exception:
                        pass
    except Exception as e:
        logger.error(f"Fehler bei Phase-1 HLS-Generierung für Chunk {chunk_id}: {e}")
    finally:
        with _phase1_counter_lock:
            _active_phase1_count = max(0, _active_phase1_count - 1)

    # Wenn Phase 1 geklappt hat, in DB eintragen, damit das Video sofort abspielbar ist
    if fast_success:
        db_session = SessionLocal()
        try:
            chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
            if chunk:
                chunk.hls_playlist_path = temp_playlist_path_rel
                chunk.conversion_progress = 100 if skip_transcoding else 60
                if skip_transcoding:
                    chunk.conversion_status = "completed"
                db_session.commit()
        finally:
            db_session.close()

    if skip_transcoding or chunk_id in _cancelled_chunks:
        logger.info(f"Beende HLS-Generierung für Chunk {chunk_id} nach Phase 1 (skip={skip_transcoding}, cancelled={chunk_id in _cancelled_chunks}).")
        db_session = SessionLocal()
        try:
            chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
            if chunk:
                chunk.conversion_status = "completed"
                chunk.conversion_progress = 100
                db_session.commit()
        finally:
            db_session.close()
        if progress_callback:
            progress_callback(100.0, "Schneller HLS-Stream vollständig erstellt.")
        return

    # --- Phase 2: Transkodierung zu Adaptivem HLS (ABR) ---
    # Serialisiere Phase 2 über _abr_lock, damit nicht mehrere 3-Stream-Transkodierungen gleichzeitig die CPU überlasten
    with _abr_lock:
        if chunk_id in _cancelled_chunks:
            db_session = SessionLocal()
            try:
                chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
                if chunk:
                    chunk.conversion_status = "completed"
                    chunk.conversion_progress = 100
                    db_session.commit()
            finally:
                db_session.close()
            return
        abr_folder_name = f"{base_filename}_abr"
        abr_folder_abs = os.path.join(match_folder_abs, abr_folder_name)
        os.makedirs(abr_folder_abs, exist_ok=True)
        os.makedirs(os.path.join(abr_folder_abs, "v0"), exist_ok=True)
        os.makedirs(os.path.join(abr_folder_abs, "v1"), exist_ok=True)
        os.makedirs(os.path.join(abr_folder_abs, "v2"), exist_ok=True)

        master_playlist_path_rel = f"{match_folder_rel}/{abr_folder_name}/master.m3u8"

        low_bitrate = "700k" if is_panorama else "800k"
        med_bitrate = "1800k" if is_panorama else "2000k"
        high_bitrate = "4500k" if is_panorama else "4000k"

        if is_h264_ready:
            filter_complex = (
                "[0:v]format=yuv420p,split=2[v1][v2]; "
                "[v1]scale=854:-2[v1_out]; "
                "[v2]scale=1280:-2[v2_out]"
            )
        else:
            filter_complex = (
                "[0:v]format=yuv420p,split=3[v1][v2][v3]; "
                "[v1]scale=854:-2[v1_out]; "
                "[v2]scale=1280:-2[v2_out]; "
                "[v3]scale='min(3840,iw)':-2[v3_out]"
            )

        abr_command = [
            ffmpeg_path, "-y", "-threads", "2", "-i", video_path_abs,
            "-filter_complex", filter_complex,
            "-map", "[v1_out]",
            "-c:v:0", "libx264", "-preset:v:0", "superfast", "-profile:v:0", "main", "-pix_fmt:v:0", "yuv420p",
            "-b:v:0", low_bitrate, "-maxrate:v:0", "900k", "-bufsize:v:0", "1200k",
            "-g:v:0", "60", "-keyint_min:v:0", "60", "-sc_threshold:v:0", "0",
            "-map", "[v2_out]",
            "-c:v:1", "libx264", "-preset:v:1", "superfast", "-profile:v:1", "main", "-pix_fmt:v:1", "yuv420p",
            "-b:v:1", med_bitrate, "-maxrate:v:1", "2200k", "-bufsize:v:1", "3000k",
            "-g:v:1", "60", "-keyint_min:v:1", "60", "-sc_threshold:v:1", "0",
        ]

        if is_h264_ready:
            abr_command.extend([
                "-map", "0:v:0",
                "-c:v:2", "copy",
                "-bsf:v:2", "h264_mp4toannexb",
            ])
        else:
            abr_command.extend([
                "-map", "[v3_out]",
                "-c:v:2", "libx264", "-preset:v:2", "superfast", "-profile:v:2", "high", "-pix_fmt:v:2", "yuv420p",
                "-b:v:2", high_bitrate, "-maxrate:v:2", "5500k", "-bufsize:v:2", "7500k",
                "-g:v:2", "60", "-keyint_min:v:2", "60", "-sc_threshold:v:2", "0",
            ])

        if has_audio:
            abr_command.extend([
                "-map", "0:a:0", "-c:a:0", "aac", "-b:a:0", "64k", "-ac:a:0", "2", "-ar:a:0", "48000",
                "-map", "0:a:0", "-c:a:1", "aac", "-b:a:1", "128k", "-ac:a:1", "2", "-ar:a:1", "48000",
                "-map", "0:a:0", "-c:a:2", "aac", "-b:a:2", "128k", "-ac:a:2", "2", "-ar:a:2", "48000",
                "-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2"
            ])
        else:
            abr_command.extend([
                "-var_stream_map", "v:0 v:1 v:2"
            ])

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

        ffmpeg_cmd = abr_command if os.name == 'nt' else ["nice", "-n", "15"] + abr_command

        abr_success = False
        try:
            logger.info(f"Starte ABR HLS-Transkodierung für Chunk {chunk_id}...")
            if progress_callback:
                progress_callback(60.0, "Multi-Bitrate ABR Streams (1080p/720p/480p) werden kodiert...")

            _run_ffmpeg_with_progress(
                ffmpeg_cmd,
                total_duration=total_duration,
                progress_callback=progress_callback,
                start_pct=60.0,
                end_pct=98.0,
                step_prefix="Transkodiere ABR Streams",
                chunk_id=chunk_id
            )

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
                    chunk.hls_playlist_path = master_playlist_path_rel
                    chunk.conversion_status = "completed"
                    chunk.conversion_progress = 100
                    logger.info(f"Datenbank auf ABR Master-Playlist für Chunk {chunk_id} aktualisiert.")

                    if fast_success:
                        try:
                            if os.path.exists(temp_playlist_path_abs):
                                os.remove(temp_playlist_path_abs)
                            temp_segments = glob.glob(os.path.join(match_folder_abs, f"{base_filename}_temp_*.ts"))
                            for segment in temp_segments:
                                os.remove(segment)
                            logger.info(f"Temporäre HLS-Dateien für Chunk {chunk_id} erfolgreich gelöscht.")
                        except Exception as clean_err:
                            logger.error(f"Fehler bei Bereinigung temporärer HLS-Dateien: {clean_err}")
                else:
                    if fast_success:
                        chunk.conversion_status = "completed"
                        chunk.conversion_progress = 100
                        logger.warning(f"ABR fehlgeschlagen. Schnelles HLS als Fallback beibehalten für Chunk {chunk_id}.")
                    else:
                        chunk.conversion_status = "failed"

                db_session.commit()
        finally:
            db_session.close()


def inspect_and_repair_chunk_if_needed(chunk_id: int, force: bool = False) -> bool:
    """
    Prüft, ob ein VideoChunk oder dessen HLS-Segmente einen inkompatiblen Codec
    (z.B. HEVC / 10-Bit -> 'Nur Ton, kein Bild') aufweisen oder im Status 'processing'
    hängengeblieben sind, und startet bei Bedarf die Reparatur/Neukonvertierung.
    """
    from services.video_service import FFPROBE_PATH as ffprobe_path

    db_session = SessionLocal()
    try:
        chunk = db_session.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if not chunk or not chunk.video_path:
            return False
        video_path_rel = chunk.video_path
        hls_rel = chunk.hls_playlist_path
        status = chunk.conversion_status
    finally:
        db_session.close()

    video_path_abs = os.path.join(BASE_DIR, video_path_rel.replace('backend/', '', 1))
    if not os.path.exists(video_path_abs) or os.path.getsize(video_path_abs) < 1024:
        return False

    # Wenn gerade eine temporäre .norm_h264.mp4 geschrieben wird, läuft bereits eine Konvertierung für dieses Video!
    if not force and os.path.exists(f"{video_path_abs}.norm_h264.mp4"):
        return False

    needs_repair = force

    if not needs_repair:
        src_info = get_video_stream_info(video_path_abs, ffprobe_path)
        if not src_info["is_browser_h264_compatible"]:
            logger.info(
                f"[AutoRepair] Chunk {chunk_id} Quellvideo ist nicht Browser-H264-kompatibel "
                f"(codec={src_info['codec_name']}, pix_fmt={src_info['pix_fmt']}). Reparatur wird gestartet."
            )
            needs_repair = True

    if not needs_repair and hls_rel:
        hls_abs = os.path.join(BASE_DIR, hls_rel.replace('backend/', '', 1))
        if not os.path.exists(hls_abs):
            needs_repair = True
        elif hls_rel.endswith("_temp_hls.m3u8"):
            logger.info(f"[AutoRepair] Chunk {chunk_id} hing auf temporärer Playlist ({hls_rel}). Starte Reparatur.")
            needs_repair = True
        elif hls_rel.endswith("master.m3u8"):
            v2_seg = os.path.join(os.path.dirname(hls_abs), "v2", "fileSequence0.ts")
            if os.path.exists(v2_seg):
                seg_info = get_video_stream_info(v2_seg, ffprobe_path)
                if not seg_info["is_browser_h264_compatible"]:
                    logger.info(
                        f"[AutoRepair] Chunk {chunk_id} HLS v2-Segment ist inkompatibel "
                        f"(codec={seg_info['codec_name']}, pix_fmt={seg_info['pix_fmt']}). Starte Reparatur."
                    )
                    needs_repair = True

    if not needs_repair and status == "processing":
        needs_repair = True

    if needs_repair:
        generate_hls_playlist(chunk_id, skip_transcoding=False)
        return True

    return False


def cancel_match_hls_conversion(match_id: str) -> int:
    """
    Bricht laufende oder hängengebliebene HLS-Konvertierungen für ein einzelnes Match ab
    und setzt den Chunk-Status auf 'completed', damit der Eintrag aus der Queue verschwindet.
    """
    db_session = SessionLocal()
    cancelled_count = 0
    try:
        chunks = db_session.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()
        for ch in chunks:
            _cancelled_chunks.add(ch.id)
            proc = _active_processes.pop(ch.id, None)
            if proc is not None:
                try:
                    proc.terminate()
                except Exception:
                    pass
            if ch.conversion_status == "processing":
                ch.conversion_status = "completed"
                ch.conversion_progress = 100
                cancelled_count += 1
        db_session.commit()
    finally:
        db_session.close()
    logger.info(f"[HLS Cancel] Match {match_id}: {cancelled_count} HLS-Task(s) abgebrochen/bereinigt.")
    return cancelled_count


def cancel_all_hls_conversions() -> int:
    """
    Bricht ALLE laufenden und in 'processing' hängengebliebenen HLS-Konvertierungen ab,
    beendet aktive FFmpeg-Prozesse und leert die HLS-Queue.
    """
    global _auto_repair_cancelled
    _auto_repair_cancelled = True

    for cid, proc in list(_active_processes.items()):
        _cancelled_chunks.add(cid)
        try:
            proc.terminate()
        except Exception:
            pass
    _active_processes.clear()

    db_session = SessionLocal()
    cancelled_count = 0
    try:
        stuck_chunks = db_session.query(VideoChunk).filter(VideoChunk.conversion_status == "processing").all()
        for ch in stuck_chunks:
            _cancelled_chunks.add(ch.id)
            ch.conversion_status = "completed"
            ch.conversion_progress = 100
            cancelled_count += 1
        db_session.commit()
    finally:
        db_session.close()
    logger.info(f"[HLS Cancel All] Alle {cancelled_count} HLS-Konvertierungen abgebrochen und Queue geleert.")
    return cancelled_count


def scan_and_repair_all_incompatible_videos_async():
    """
    Bereinigt beim Server-Start verwaiste 'processing'-Einträge aus früheren Sitzungen,
    damit die Top-Bar-Queue nicht mit alten unvollständigen Jobs überflutet wird.
    """
    def _worker():
        time.sleep(2)
        try:
            db_session = SessionLocal()
            try:
                stale_chunks = db_session.query(VideoChunk).filter(VideoChunk.conversion_status == "processing").all()
                cleaned = 0
                for ch in stale_chunks:
                    if ch.id not in _active_processes:
                        ch.conversion_status = "completed"
                        ch.conversion_progress = 100
                        cleaned += 1
                if cleaned > 0:
                    db_session.commit()
                    logger.info(f"[AutoClean] {cleaned} verwaiste HLS-Tasks beim Start bereinigt.")
            finally:
                db_session.close()
        except Exception as outer_err:
            logger.error(f"[AutoClean] Fehler bei der Bereinigung verwaister HLS-Tasks: {outer_err}")

    t = threading.Thread(target=_worker, daemon=True, name="hls-auto-clean")
    t.start()
