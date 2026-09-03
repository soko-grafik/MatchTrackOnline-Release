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
    params: { 'k1': float, 'k2': float } für slider
            { 'points': [{'x': float, 'y': float}, ...] } für corners (4 Punkte)
    """
    cap = cv2.VideoCapture(video_path_abs)
    if not cap.isOpened():
        raise Exception("Could not open video file")

    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS)
    
    # Define codec and create VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path_abs, fourcc, fps, (width, height))

    if method == 'slider':
        k1 = params.get('k1', 0.0)
        k2 = params.get('k2', 0.0)
        # Simplified fisheye correction via remapping
        # For a real implementation, we'd use cv2.undistort with proper K and D
        # but since we don't have calibration, we use a simpler model.
        
        # Build map
        map_x, map_y = np.zeros((height, width), np.float32), np.zeros((height, width), np.float32)
        center_x, center_y = width / 2, height / 2
        
        for y in range(height):
            for x in range(width):
                # Normalized coordinates from -1 to 1
                nx = (x - center_x) / center_x
                ny = (y - center_y) / center_y
                r = np.sqrt(nx**2 + ny**2)
                
                # Distortion factor
                f = 1 + k1 * r**2 + k2 * r**4
                
                # Map back to image coordinates
                map_x[y, x] = nx * f * center_x + center_x
                map_y[y, x] = ny * f * center_y + center_y

    elif method == 'corners':
        src_pts = np.array([[p['x'] * width, p['y'] * height] for p in params['points']], dtype=np.float32)
        # Destination points: rectangle covering the whole frame
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
