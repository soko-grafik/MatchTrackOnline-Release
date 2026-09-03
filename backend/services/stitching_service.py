import cv2
import numpy as np
import subprocess
import os
import shutil
import uuid
import time
from sqlalchemy.orm import Session
from db.session import SessionLocal, BASE_DIR
from models.models import Match, StitchingStatus, VideoChunk
from services.thumbnail_service import generate_thumbnail
from services.hls_service import generate_hls_playlist
from services.video_service import FFMPEG_PATH

def calculate_homography(img_left, img_right):
    """Berechnet die Homographie-Matrix zwischen zwei Bildern."""
    # Convert to grayscale
    gray_left = cv2.cvtColor(img_left, cv2.COLOR_BGR2GRAY)
    gray_right = cv2.cvtColor(img_right, cv2.COLOR_BGR2GRAY)

    # Initialize SIFT detector
    sift = cv2.SIFT_create()

    # Find keypoints and descriptors
    kp_left, des_left = sift.detectAndCompute(gray_left, None)
    kp_right, des_right = sift.detectAndCompute(gray_right, None)

    # Match descriptors
    bf = cv2.BFMatcher()
    matches = bf.knnMatch(des_right, des_left, k=2)

    # Apply ratio test
    good = []
    for m, n in matches:
        if m.distance < 0.75 * n.distance:
            good.append(m)

    if len(good) > 10:
        src_pts = np.float32([kp_right[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp_left[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

        H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        return H
    else:
        print("Not enough matches found to calculate homography.")
        return None

def run_stitching(match_id: str, stitching_offset: float = None, stitching_time_offset: float = None):
    """Führt das Video-Stitching für ein Match aus."""
    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or not match.video_left_path or not match.video_right_path:
            print(f"Match {match_id} not found or paths missing.")
            return

        match.stitching_status = StitchingStatus.PROCESSING
        
        # Falls Parameter nicht gesetzt, nimm Werte aus der DB (falls vorhanden)
        if stitching_time_offset is None and hasattr(match, 'stitching_time_offset'):
            stitching_time_offset = match.stitching_time_offset
            
        db.commit()

        video_left_abs = os.path.join(BASE_DIR, match.video_left_path.replace("backend/", "", 1))
        video_right_abs = os.path.join(BASE_DIR, match.video_right_path.replace("backend/", "", 1))
        match_folder = os.path.dirname(video_left_abs)

        # 1. Videoquellen öffnen
        cap_l = cv2.VideoCapture(video_left_abs)
        cap_r = cv2.VideoCapture(video_right_abs)
        
        fps = cap_l.get(cv2.CAP_PROP_FPS)
        h_l, w_l = int(cap_l.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(cap_l.get(cv2.CAP_PROP_FRAME_WIDTH))
        h_r, w_r = int(cap_r.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(cap_r.get(cv2.CAP_PROP_FRAME_WIDTH))

        # 1b. Zeitliche Synchronisierung anwenden (Frame Skipping)
        if stitching_time_offset:
            # Positive Offset: Cam R ist voraus -> Frames in Cam R überspringen
            # Negative Offset: Cam L ist voraus -> Frames in Cam L überspringen
            skip_frames_l = int(max(0, -stitching_time_offset) * fps)
            skip_frames_r = int(max(0, stitching_time_offset) * fps)
            
            if skip_frames_l > 0:
                print(f"Sync: Skipping {skip_frames_l} frames in Cam L")
                cap_l.set(cv2.CAP_PROP_POS_FRAMES, skip_frames_l)
            if skip_frames_r > 0:
                print(f"Sync: Skipping {skip_frames_r} frames in Cam R")
                cap_r.set(cv2.CAP_PROP_POS_FRAMES, skip_frames_r)

        # 1c. Homographie berechnen (nur wenn kein manueller Offset erzwungen wird)
        H = None
        if stitching_offset is None:
            # Automatisches SIFT Matching an der aktuellen (ggf. versetzten) Position
            current_frame_l = cap_l.get(cv2.CAP_PROP_POS_FRAMES)
            current_frame_r = cap_r.get(cv2.CAP_PROP_POS_FRAMES)
            
            # Gehe 5 Sekunden weiter für stabileres Matching
            cap_l.set(cv2.CAP_PROP_POS_FRAMES, current_frame_l + int(5 * fps))
            cap_r.set(cv2.CAP_PROP_POS_FRAMES, current_frame_r + int(5 * fps))
            
            ret1, frame_l = cap_l.read()
            ret2, frame_r = cap_r.read()
            if ret1 and ret2:
                H = calculate_homography(frame_l, frame_r)
            
            # Zurück zur (ggf. versetzten) Startposition
            cap_l.set(cv2.CAP_PROP_POS_FRAMES, current_frame_l)
            cap_r.set(cv2.CAP_PROP_POS_FRAMES, current_frame_r)

        # 2. Stitching Setup
        if H is not None:
            canvas_w = w_l * 2
            canvas_h = h_l
        else:
            # Side-by-Side Modus (Manual Offset)
            canvas_w = w_l + w_r 
            canvas_h = max(h_l, h_r)

        temp_filename = f"temp_stitched_{uuid.uuid4()}.mp4"
        temp_path_abs = os.path.join(match_folder, temp_filename)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_path_abs, fourcc, fps, (canvas_w, canvas_h))

        print(f"Starting frame-by-frame stitching for {match_id} (Mode: {'Warp' if H is not None else 'Side-by-Side'})...")
        frame_count = 0
        split_x = int(w_l * (stitching_offset / 100.0)) if stitching_offset else w_l // 2

        while True:
            ret1, f_l = cap_l.read()
            ret2, f_r = cap_r.read()
            if not ret1 or not ret2:
                break
            
            if H is not None:
                stitched_frame = cv2.warpPerspective(f_r, H, (canvas_w, canvas_h))
                stitched_frame[0:h_l, 0:w_l] = f_l
            else:
                # Simple Manual Join
                part_l = f_l[:, 0:split_x]
                part_r = f_r[:, split_x:]
                
                stitched_frame = np.hstack((part_l, part_r))
                if stitched_frame.shape[1] != canvas_w or stitched_frame.shape[0] != canvas_h:
                    stitched_frame = cv2.resize(stitched_frame, (canvas_w, canvas_h))

            out.write(stitched_frame)
            frame_count += 1
            if frame_count % 500 == 0:
                print(f"Processed {frame_count} frames...")

        cap_l.release()
        cap_r.release()
        out.release()

        # 3. Finales Encoding mit FFmpeg (Audio hinzufügen)
        final_filename = f"stitched_{uuid.uuid4()}.mp4"
        final_path_abs = os.path.join(match_folder, final_filename)
        
        print("Merging audio and finalizing encoding...")
        subprocess.run([
            FFMPEG_PATH, "-y",
            "-i", temp_path_abs,
            "-i", video_left_abs,
            "-c:v", "libx264",
            "-preset", "faster",
            "-crf", "23",
            "-c:a", "aac",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            final_path_abs
        ], check=True)

        # 4. Datenbank aktualisieren
        db_video_path = f"backend/uploads/{match_id}/{final_filename}"
        file_size_mb = int(os.path.getsize(final_path_abs) / (1024 * 1024))

        new_chunk = VideoChunk(
            match_id=match_id,
            video_path=db_video_path,
            file_size_mb=file_size_mb,
            conversion_status="processing",
            conversion_progress=0
        )
        db.add(new_chunk)
        
        match.stitching_status = StitchingStatus.DONE
        db.commit()
        db.refresh(new_chunk)

        # Trigger Thumbnail and HLS
        generate_thumbnail(match_id)
        generate_hls_playlist(new_chunk.id)

        # 5. Cleanup
        print("Cleaning up temporary files...")
        try:
            os.remove(temp_path_abs)
            os.remove(video_left_abs)
            os.remove(video_right_abs)
        except Exception as e:
            print(f"Error during cleanup: {e}")

        print(f"Stitching finished successfully for {match_id}")

    except Exception as e:
        print(f"Stitching failed for match {match_id}: {e}")
        db.rollback()
        match = db.query(Match).filter(Match.id == match_id).first()
        if match:
            match.stitching_status = StitchingStatus.ERROR
            db.commit()
    finally:
        db.close()
