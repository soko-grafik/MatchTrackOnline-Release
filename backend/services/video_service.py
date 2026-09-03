import subprocess
import os
import time
from sqlalchemy.orm import Session
from db.session import SessionLocal, BASE_DIR
from models import VideoChunk

# Dynamic path to FFmpeg
FFMPEG_PATH = os.environ.get("FFMPEG_PATH")
if not FFMPEG_PATH:
    default_1blu_path = "/hp/bv/aa/oe/.local/bin/ffmpeg"
    FFMPEG_PATH = default_1blu_path if os.path.exists(default_1blu_path) else "ffmpeg"

# Dynamic path to FFprobe
FFPROBE_PATH = os.environ.get("FFPROBE_PATH")
if not FFPROBE_PATH:
    if FFMPEG_PATH != "ffmpeg" and os.path.exists(FFMPEG_PATH):
        FFPROBE_PATH = FFMPEG_PATH.replace("ffmpeg", "ffprobe")
    else:
        FFPROBE_PATH = "ffprobe"

def get_video_duration(video_path):
    """Ermittelt die Dauer eines Videos in Sekunden mit ffprobe."""
    command = [
        FFPROBE_PATH,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting video duration: {e}")
        return 0.0
