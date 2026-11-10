import os
import sys
import time
import signal
import subprocess
import json
import urllib.request
from typing import Optional, Dict, Any, Tuple

from db.session import SessionLocal
from models import SystemSettings

_stitch_process: Optional[subprocess.Popen] = None
_last_config_hash: Optional[str] = None

def get_current_stitch_config() -> Dict[str, Any]:
    with SessionLocal() as db:
        settings = db.query(SystemSettings).first()
        if not settings:
            return {
                "mode": "multi_cam",
                "stitch_delay": 8,
                "config": {"overlap_px": 320, "y_offset_px": 0, "feather_width_px": 80, "cam2_brightness": 0.0, "cam2_contrast": 1.0, "sync_offset_ms": 0}
            }
        
        cfg = getattr(settings, "livestream_stitch_config", None) or {}
        default_cfg = {
            "overlap_px": 320,
            "y_offset_px": 0,
            "feather_width_px": 80,
            "cam2_brightness": 0.0,
            "cam2_contrast": 1.0,
            "sync_offset_ms": 0
        }
        for k, v in default_cfg.items():
            if k not in cfg:
                cfg[k] = v

        return {
            "mode": getattr(settings, "livestream_mode", "multi_cam") or "multi_cam",
            "stitch_delay": getattr(settings, "livestream_stitch_delay", 8) or 8,
            "config": cfg
        }

def check_cams_active() -> Dict[str, bool]:
    cam1_active = False
    cam2_active = False

    try:
        req = urllib.request.Request("http://127.0.0.1:9997/v3/paths/list", headers={"User-Agent": "MatchTrackStitcher"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                for item in data.get("items", []):
                    if item.get("ready"):
                        raw_name = str(item.get("name", "")).strip().lower().split("/")[-1]
                        if raw_name in ["cam1", "osmo4"]:
                            cam1_active = True
                        elif raw_name == "cam2":
                            cam2_active = True
    except Exception:
        # Fallback auf HLS Port
        for probe in ["cam1", "osmo4"]:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:8888/live/{probe}/index.m3u8", timeout=0.4) as resp:
                    if resp.status == 200:
                        cam1_active = True
                        break
            except Exception:
                pass
        try:
            with urllib.request.urlopen("http://127.0.0.1:8888/live/cam2/index.m3u8", timeout=0.4) as resp:
                if resp.status == 200:
                    cam2_active = True
        except Exception:
            pass

    return {"cam1": cam1_active, "cam2": cam2_active}

def build_ffmpeg_filtergraph(cfg: Dict[str, Any]) -> Tuple[str, str]:
    overlap = max(0, min(int(cfg.get("overlap_px", 320)), 600))
    y_off = max(-100, min(int(cfg.get("y_offset_px", 0)), 100))
    brightness = max(-0.5, min(float(cfg.get("cam2_brightness", 0.0)), 0.5))
    contrast = max(0.5, min(float(cfg.get("cam2_contrast", 1.0)), 1.5))
    sync_offset_ms = int(cfg.get("sync_offset_ms", 0))

    parts = []
    v0_src = "[0:v]"
    v1_src = "[1:v]"
    audio_map = "0:a?"

    # 1. Zeitversatz (Sync-Offset) kompensieren
    if sync_offset_ms > 0:
        # Cam 2 kommt später an -> Cam 1 verzögern
        delay_sec = round(sync_offset_ms / 1000.0, 3)
        parts.append(f"[0:v]tpad=start_duration={delay_sec}:start_mode=clone[v0_timed]")
        v0_src = "[v0_timed]"
        parts.append(f"[0:a]adelay={sync_offset_ms}|{sync_offset_ms}[outa]")
        audio_map = "[outa]"
    elif sync_offset_ms < 0:
        # Cam 1 kommt später an -> Cam 2 verzögern
        delay_sec = round(abs(sync_offset_ms) / 1000.0, 3)
        parts.append(f"[1:v]tpad=start_duration={delay_sec}:start_mode=clone[v1_timed]")
        v1_src = "[v1_timed]"

    # 2. Helligkeit/Kontrast & Vertikaler Versatz für Cam 2
    v1_prep = f"{v1_src}eq=brightness={brightness}:contrast={contrast}"
    if y_off > 0:
        v1_prep += f",pad=iw:ih+{y_off}:0:{y_off}"
    elif y_off < 0:
        abs_y = abs(y_off)
        v1_prep += f",crop=iw:ih-{abs_y}:0:{abs_y}"
    v1_prep += "[v1_adj]"
    parts.append(v1_prep)

    # 3. Horizontaler Schnitt / Overlap (abgestimmt auf 80° Rig & 1080p De-Warp)
    half_overlap = overlap // 2
    parts.append(f"{v0_src}crop=iw-{half_overlap}:ih:0:0[v0_crop]")
    parts.append(f"[v1_adj]crop=iw-{half_overlap}:ih:{half_overlap}:0[v1_crop]")

    # 4. Zusammenfügen & Skalierung auf 2.5K Panorama (2560px) für flüssiges Streaming & VPS-Performance
    parts.append("[v0_crop][v1_crop]hstack=inputs=2,scale=2560:-2[outv]")

    filtergraph = "; ".join(parts)
    return filtergraph, audio_map

def start_stitching() -> bool:
    global _stitch_process, _last_config_hash

    stop_stitching()

    info = get_current_stitch_config()
    cfg = info["config"]
    filtergraph, audio_map = build_ffmpeg_filtergraph(cfg)
    _last_config_hash = json.dumps(cfg, sort_keys=True)

    input_cam1 = "http://127.0.0.1:8888/live/cam1/index.m3u8"
    input_cam2 = "http://127.0.0.1:8888/live/cam2/index.m3u8"
    output_rtmp = "rtmp://127.0.0.1:1935/live/stitched"

    cmd = [
        "ffmpeg", "-nostdin", "-y",
        "-fflags", "+genpts",
        "-reconnect", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_streamed", "1",
        "-i", input_cam1,
        "-i", input_cam2,
        "-filter_complex", filtergraph,
        "-map", "[outv]",
        "-map", audio_map,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "zerolatency",
        "-b:v", "3200k",
        "-maxrate", "3600k",
        "-bufsize", "7000k",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-f", "flv",
        output_rtmp
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        )
        _stitch_process = proc
        print(f"[LiveStitcher] Gestartet mit PID {proc.pid}")
        return True
    except Exception as e:
        print(f"[LiveStitcher] Start-Fehler: {e}")
        return False

def stop_stitching():
    global _stitch_process
    if _stitch_process is not None:
        try:
            if sys.platform == "win32":
                _stitch_process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                _stitch_process.send_signal(signal.SIGTERM)
            _stitch_process.wait(timeout=3)
        except Exception:
            try:
                _stitch_process.kill()
            except Exception:
                pass
        _stitch_process = None
        print("[LiveStitcher] Beendet.")

def is_stitching_active() -> bool:
    global _stitch_process
    return _stitch_process is not None and _stitch_process.poll() is None

def run_loop():
    """
    Dauerhafter Loop für Hintergrund-Daemon
    """
    print("🎬 MatchTrack Live Stitcher Daemon aktiv...")
    while True:
        try:
            info = get_current_stitch_config()
            mode = info["mode"]
            cfg = info["config"]
            cfg_hash = json.dumps(cfg, sort_keys=True)

            cams = check_cams_active()
            both_ready = cams["cam1"] and cams["cam2"]

            if mode == "stitched" and both_ready:
                if not is_stitching_active():
                    print("[LiveStitcher] Beide Kameras bereit. Starte Stitching...")
                    start_stitching()
                elif cfg_hash != _last_config_hash:
                    print("[LiveStitcher] Konfigurationsänderung erkannt. Starte neu...")
                    start_stitching()
            else:
                if is_stitching_active():
                    print("[LiveStitcher] Bedingungen nicht mehr erfüllt (Kamera weg oder Modus geändert). Stoppe Stitching.")
                    stop_stitching()

        except Exception as e:
            print(f"[LiveStitcher] Loop Fehler: {e}")

        time.sleep(2.5)

if __name__ == "__main__":
    run_loop()
