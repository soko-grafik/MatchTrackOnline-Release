import cv2
import numpy as np
import os
import logging
import subprocess
from db.session import BASE_DIR, SessionLocal
from models import Match, VideoChunk
from services.video_service import FFMPEG_PATH

logger = logging.getLogger(__name__)

def get_preview_frame(match_id: str, timestamp: str = "00:00:05"):
    """
    Extrahierte einen Frame aus dem Video und gibt ihn als base64 zurück.
    """
    db = SessionLocal()
    try:
        first_chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).order_by(VideoChunk.created_at.asc()).first()
        if not first_chunk:
            return None

        video_path_abs = os.path.join(BASE_DIR, first_chunk.video_path.replace('backend/', ''))
        
        if not os.path.exists(video_path_abs):
            return None

        # Temp path for preview frame
        preview_path = os.path.join(BASE_DIR, "uploads", f"preview_{match_id}.jpg")
        
        command = [
            FFMPEG_PATH, "-ss", timestamp, "-i", video_path_abs,
            "-vframes", "1", "-q:v", "2", "-y", preview_path
        ]
        
        subprocess.run(command, check=True, capture_output=True)
        
        with open(preview_path, "rb") as image_file:
            import base64
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Cleanup
        if os.path.exists(preview_path):
            os.remove(preview_path)
            
        return encoded_string
    except Exception as e:
        logger.error(f"Error getting preview frame: {e}")
        return None
    finally:
        db.close()

def apply_fisheye_correction(video_path_abs: str, output_path_abs: str, method: str, params: dict):
    """
    Wendet die Fisheye-Korrektur auf ein Video an.
    method: 'slider' oder 'corners'
    params: {
        'k1': float, 'k2': float,
        'points': [{'x': float, 'y': float}, ...],
        'auto_crop': bool,
        'crop_percent': float  (0 to 50)
    }
    """
    cap = cv2.VideoCapture(video_path_abs)
    if not cap.isOpened():
        raise Exception("Could not open video file")

    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS)
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path_abs, fourcc, fps, (width, height))

    auto_crop = params.get('auto_crop', True)
    crop_percent = float(params.get('crop_percent', 0.0) or 0.0)

    # Determine zoom/scale factor
    # For slider method with negative distortion (barrel distortion correction),
    # auto-crop calculates how much the corners pulled in to eliminate black boundaries.
    zoom_factor = 1.0
    if method == 'slider':
        k1 = float(params.get('k1', 0.0) or 0.0)
        k2 = float(params.get('k2', 0.0) or 0.0)

        if auto_crop and crop_percent == 0.0:
            # Auto calculate required scale to crop black edges
            # Corner point is at normalized (1, 1), r^2 = 2
            # Edge center is at (1, 0), r^2 = 1
            # If k1 < 0, edges curve inwards. We zoom in so edge centers fill boundary.
            if k1 < 0:
                # Distortion factor at edge center
                f_edge = 1.0 + k1 * 1.0 + k2 * 1.0
                if f_edge > 0.01:
                    zoom_factor = max(1.0, 1.0 / f_edge)
        elif crop_percent > 0:
            zoom_factor = 1.0 + (crop_percent / 100.0)

        # High-performance vectorized map creation via np.meshgrid
        y_indices, x_indices = np.indices((height, width), dtype=np.float32)
        center_x, center_y = width / 2.0, height / 2.0

        # Apply zoom factor so zooming in samples a smaller field of view (removes borders)
        nx = ((x_indices - center_x) / center_x) / zoom_factor
        ny = ((y_indices - center_y) / center_y) / zoom_factor
        r2 = nx**2 + ny**2

        # Radial distortion
        f = 1.0 + k1 * r2 + k2 * (r2**2)

        map_x = (nx * f * center_x + center_x).astype(np.float32)
        map_y = (ny * f * center_y + center_y).astype(np.float32)

    elif method == 'corners':
        src_pts = np.array([[p['x'] * width, p['y'] * height] for p in params['points']], dtype=np.float32)

        # Apply optional crop zoom on corners destination
        if crop_percent > 0:
            margin_x = (width * (crop_percent / 100.0)) / 2.0
            margin_y = (height * (crop_percent / 100.0)) / 2.0
            dst_pts = np.array([
                [-margin_x, -margin_y],
                [width + margin_x, -margin_y],
                [width + margin_x, height + margin_y],
                [-margin_x, height + margin_y]
            ], dtype=np.float32)
        else:
            dst_pts = np.array([[0, 0], [width, 0], [width, height], [0, height]], dtype=np.float32)

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if method == 'slider':
            corrected = cv2.remap(frame, map_x, map_y, cv2.INTER_LINEAR)
        elif method == 'corners':
            corrected = cv2.warpPerspective(frame, M, (width, height))
        else:
            corrected = frame

        out.write(corrected)

    cap.release()
    out.release()

def process_fisheye_correction_task(match_id: str, method: str, params: dict):
    """
    BackgroundTask zum Korrigieren des Videos.
    """
    db = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match: return

        first_chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).order_by(VideoChunk.created_at.asc()).first()
        if not first_chunk: return

        video_path_abs = os.path.join(BASE_DIR, first_chunk.video_path.replace('backend/', ''))
        corrected_video_filename = f"corrected_{os.path.basename(video_path_abs)}"
        corrected_video_path_abs = os.path.join(os.path.dirname(video_path_abs), corrected_video_filename)
        
        # Apply correction
        apply_fisheye_correction(video_path_abs, corrected_video_path_abs, method, params)
        
        # Re-encode to ensure H.264 compatibility (OpenCV mp4v might not play in all browsers)
        final_video_path_abs = corrected_video_path_abs.replace(".mp4", "_final.mp4")
        subprocess.run([
            FFMPEG_PATH, "-i", corrected_video_path_abs, "-vcodec", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-y", final_video_path_abs
        ], check=True)
        
        # Update database and replace old video
        # In a real scenario, we might want to keep the original for a bit.
        # For now, let's swap.
        os.remove(video_path_abs)
        os.remove(corrected_video_path_abs)
        os.rename(final_video_path_abs, video_path_abs)
        
        # Regenerate HLS
        from services.hls_service import generate_hls_playlist
        generate_hls_playlist(first_chunk.id)
        
        # Update status (maybe add a column later or just use heatmap_status for now as a proxy?)
        # Let's just log success.
        logger.info(f"Fisheye correction completed for match {match_id}")

    except Exception as e:
        logger.error(f"Error in process_fisheye_correction_task: {e}")
    finally:
        db.close()
