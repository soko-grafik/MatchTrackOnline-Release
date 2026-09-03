import os
import cv2
import numpy as np
import subprocess
import uuid
import json
import time
from datetime import datetime
from sqlalchemy.orm import Session

from db.session import SessionLocal, UPLOAD_DIR, BASE_DIR
from models import VideoStitchJob, Match, VideoChunk, MatchEvent, SystemSettings
from services.video_service import FFMPEG_PATH, FFPROBE_PATH

# Geschwindigkeits-/Qualitätsstufen für die (nachträgliche) KI-Highlight-Erkennung.
# "fast" analysiert wenige, grobe Frames für ein schnelles Ergebnis; "slow" tastet dichter
# ab, nutzt eine höhere YOLO-Inferenzauflösung und ein größeres Modell für die beste Präzision,
# und erzwingt einen frischen Scan statt (ggf. mit "fast" erzeugte) alte Tracking-Daten wiederzuverwenden.
HIGHLIGHT_SPEED_PRESETS = {
    "fast":   {"sample_fps": 1.0, "min_stride": 8, "imgsz": 384, "model_name": "yolov8n.pt", "conf": 0.30, "allow_instant_reuse": True},
    "normal": {"sample_fps": 2.0, "min_stride": 5, "imgsz": 480, "model_name": "yolov8n.pt", "conf": 0.25, "allow_instant_reuse": True},
    "slow":   {"sample_fps": 5.0, "min_stride": 2, "imgsz": 640, "model_name": "yolov8s.pt", "conf": 0.20, "allow_instant_reuse": False},
}

def get_highlight_speed_preset(speed: str) -> dict:
    return HIGHLIGHT_SPEED_PRESETS.get((speed or "normal").lower(), HIGHLIGHT_SPEED_PRESETS["normal"])

def run_yolo_detection_on_frame(frame, model=None, imgsz: int = 480, conf: float = 0.25):
    """
    Führt optimierte Objekterkennung auf einem Frame aus.
    Erkennt gezielt: Ball (class 32), Personen/Spieler (class 0).
    """
    ball_boxes = []
    player_boxes = []

    # 1. Option: Ultralytics YOLOv8 mit Klassenfilter und reduzierter Inferenzauflösung
    if model is not None:
        try:
            results = model(frame, imgsz=imgsz, classes=[0, 32], verbose=False, conf=conf)
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    xyxy = box.xyxy[0].tolist()
                    if cls_id == 32: # sports ball
                        ball_boxes.append((xyxy, conf))
                    elif cls_id == 0: # person
                        player_boxes.append((xyxy, conf))
            return ball_boxes, player_boxes
        except Exception:
            pass
            
    # 2. Fallback: Schnelle Bildverarbeitungs-Heuristik (Kontur- & Farberkennung für Ball & Spieler)
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (480, int(480 * (h / w))))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    
    # Spieler-Blobs (Geringe Auflösung)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    scale_x = w / 480.0
    scale_y = h / float(small.shape[0])
    
    for c in contours:
        area = cv2.contourArea(c)
        if 15 < area < 400:
            x, y, bw, bh = cv2.boundingRect(c)
            xyxy = [x * scale_x, y * scale_y, (x + bw) * scale_x, (y + bh) * scale_y]
            player_boxes.append((xyxy, 0.6))
            
    return ball_boxes, player_boxes

def detect_match_events_from_tracking(
    tracking_history: list,
    fps: float,
    pano_width: int,
    pano_height: int,
    db: Session,
    match_id: str,
    sample_fps: float = 2.0
):
    """
    Erkennt automatisch Tore, Ecken, Elfmeter und Großchancen aus den Bewegungsdaten.
    `sample_fps` ist die Abtastrate, mit der `tracking_history` erzeugt wurde (siehe
    HIGHLIGHT_SPEED_PRESETS) - das Cluster-Lookahead-Fenster wird darauf skaliert, damit
    es bei jeder Geschwindigkeitsstufe dieselbe Zeitspanne (5-20s) im echten Video abdeckt.
    Kann mehrfach fuer dasselbe Match laufen (Button ist nicht mehr ausgeblendet, sobald
    bereits Highlights existieren) - bestehende Events (manuell oder aus frueheren Laeufen)
    werden dabei nie ueberschrieben/dupliziert, siehe `blocked_times_ms` unten.
    """
    detected_events = []
    skipped_existing = 0
    min_event_distance_frames = int(fps * 30) # Mindestens 30s zwischen gleichen Events
    last_event_frame = -min_event_distance_frames
    lookahead_start = max(1, round(5 * sample_fps))
    lookahead_end = max(lookahead_start + 1, round(20 * sample_fps))

    # Bereits vorhandene Events (egal ob manuell oder aus einem frueheren KI-Lauf) - eine
    # neu erkannte Aktion in der Naehe eines bereits vorhandenen Zeitpunkts wird uebersprungen
    # statt dort ein weiteres/doppeltes Event anzulegen.
    existing_protection_window_ms = 30000
    blocked_times_ms = [t for (t,) in db.query(MatchEvent.video_time_ms).filter(MatchEvent.match_id == match_id).all() if t is not None]

    def is_blocked(candidate_ms: int) -> bool:
        return any(abs(candidate_ms - t) < existing_protection_window_ms for t in blocked_times_ms)

    # Spielfeld-Zonen (32:9 Panorama)
    left_goal_x = pano_width * 0.04
    right_goal_x = pano_width * 0.96
    goal_y_top = pano_height * 0.35
    goal_y_bottom = pano_height * 0.65
    
    left_corner_x = pano_width * 0.06
    right_corner_x = pano_width * 0.94
    
    left_penalty_x = pano_width * 0.11
    right_penalty_x = pano_width * 0.89
    
    edge_margin = max(5, round(7.5 * sample_fps))
    for i in range(edge_margin, len(tracking_history) - edge_margin):
        curr = tracking_history[i]
        f_idx = curr['frame']
        ball_pos = curr.get('ball')
        players = curr.get('players', [])
        
        if f_idx - last_event_frame < min_event_distance_frames:
            continue
            
        video_time_ms = int((f_idx / fps) * 1000)
        
        # 1. Tor-Erkennung (Ball im Torbereich + nachfolgende Jubel-Clusterbildung)
        if ball_pos:
            bx, by = ball_pos
            is_in_left_goal = (bx < left_goal_x) and (goal_y_top <= by <= goal_y_bottom)
            is_in_right_goal = (bx > right_goal_x) and (goal_y_top <= by <= goal_y_bottom)
            
            if is_in_left_goal or is_in_right_goal:
                # Prüfen, ob in den nächsten 5-20 Sekunden ein Cluster entsteht
                future_frames = tracking_history[min(i+lookahead_start, len(tracking_history)-1) : min(i+lookahead_end, len(tracking_history))]
                cluster_formed = any(f.get('cluster_density', 0) > 6 for f in future_frames) or len(players) > 10
                
                if cluster_formed:
                    goal_time_ms = max(0, video_time_ms - 4000) # 4s vor dem Treffer ansetzen
                    last_event_frame = f_idx
                    if is_blocked(goal_time_ms):
                        skipped_existing += 1
                        continue
                    side = "Rechtes Tor" if is_in_right_goal else "Linkes Tor"
                    new_evt = MatchEvent(
                        id=str(uuid.uuid4()),
                        match_id=match_id,
                        event_type="goal",
                        video_time_ms=goal_time_ms,
                        details={"title": "⚽ Tor", "note": f"KI-erkanntes Tor ({side})", "auto_detected": True}
                    )
                    db.add(new_evt)
                    blocked_times_ms.append(goal_time_ms)
                    detected_events.append(("goal", video_time_ms))
                    continue
                    
        # 2. Eckball-Erkennung (Ball in der Ecke + viele Spieler im Strafraum)
        if ball_pos:
            bx, by = ball_pos
            is_in_corner = (bx < left_corner_x or bx > right_corner_x) and (by < pano_height * 0.2 or by > pano_height * 0.8)
            box_players = [p for p in players if (p[0] < pano_width * 0.25 or p[0] > pano_width * 0.75)]
            
            if is_in_corner and len(box_players) >= 6:
                last_event_frame = f_idx
                if is_blocked(video_time_ms):
                    skipped_existing += 1
                    continue
                new_evt = MatchEvent(
                    id=str(uuid.uuid4()),
                    match_id=match_id,
                    event_type="corner",
                    video_time_ms=video_time_ms,
                    details={"title": "🚩 Eckball", "note": "KI-erkannter Eckball", "auto_detected": True}
                )
                db.add(new_evt)
                blocked_times_ms.append(video_time_ms)
                detected_events.append(("corner", video_time_ms))
                continue
                
        # 3. Torgefährliche Szene / Konter (Hohe Ballgeschwindigkeit in Strafraumnähe)
        ball_speed = curr.get('ball_speed', 0.0)
        if ball_pos and ball_speed > 25.0:
            bx, by = ball_pos
            in_danger_zone = (bx < pano_width * 0.2 or bx > pano_width * 0.8)
            if in_danger_zone:
                highlight_time_ms = max(0, video_time_ms - 3000)
                last_event_frame = f_idx
                if is_blocked(highlight_time_ms):
                    skipped_existing += 1
                    continue
                new_evt = MatchEvent(
                    id=str(uuid.uuid4()),
                    match_id=match_id,
                    event_type="highlight",
                    video_time_ms=highlight_time_ms,
                    details={"title": "⚡ Torszene / Konter", "note": "KI-erkannte Großchance / schneller Angriff", "auto_detected": True}
                )
                db.add(new_evt)
                blocked_times_ms.append(highlight_time_ms)
                detected_events.append(("highlight", video_time_ms))
                continue

    db.commit()
    print(f"[EventAI] Automatically generated {len(detected_events)} match events ({skipped_existing} übersprungen, da bereits ein Event zu dieser Zeit existiert).")
    return detected_events, skipped_existing

def process_tracking_and_reframing(
    job_id: str,
    master_panorama_path: str,
    output_16_9_path: str,
    output_mode: str = "DYNAMIC_16_9",
    detect_events_auto: bool = True,
    progress_callback=None
) -> dict:
    """
    Führt YOLOv8 Tracking auf dem 32:9 Panorama aus, berechnet sanftes Pan & Scan für 16:9
    und erzeugt automatische Match-Events.
    """
    cap = cv2.VideoCapture(master_panorama_path)
    if not cap.isOpened():
        print(f"[Tracker] Failed to open master panorama {master_panorama_path}")
        return {}
        
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    pano_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 3840
    pano_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
    
    # 16:9 Zielfenster (z.B. 1920x1080)
    crop_w = int(pano_w / 2) # 1920 px
    crop_h = pano_h          # 1080 px
    
    # YOLO Modell initialisieren (Ultralytics wenn vorhanden, sonst intelligenter Fallback)
    yolo_model = None
    try:
        from ultralytics import YOLO
        yolo_model = YOLO("yolov8n.pt")
        print("[Tracker] Ultralytics YOLOv8n initialized.")
    except Exception as e:
        print(f"[Tracker] Using lightweight vision heuristic (YOLO import optional): {e}")

    # Schrittweite für Inferenz (z.B. alle 5 Frames = 6 FPS Inferenz für geringe Serverlast)
    sample_step = 5
    sampled_tracking = []
    
    curr_frame_idx = 0
    report_interval = max(30, int(fps * 6))
    
    prev_ball_pos = None
    
    while True:
        ret, frame = cap.read()
        if not ret: break
        
        if curr_frame_idx % sample_step == 0:
            ball_boxes, player_boxes = run_yolo_detection_on_frame(frame, yolo_model)
            
            # Ball-Zentrum
            ball_pos = None
            if ball_boxes:
                b_best = max(ball_boxes, key=lambda x: x[1])[0]
                ball_pos = ((b_best[0] + b_best[2]) / 2.0, (b_best[1] + b_best[3]) / 2.0)
                
            # Spieler-Zentren
            p_centers = []
            for (p_box, _) in player_boxes:
                p_centers.append(((p_box[0] + p_box[2]) / 2.0, (p_box[1] + p_box[3]) / 2.0))
                
            # Spieler-Cluster-Mittelpunkt
            player_cluster_x = pano_w * 0.5
            if p_centers:
                player_cluster_x = float(np.mean([p[0] for p in p_centers]))
                
            # Ball-Geschwindigkeit
            ball_speed = 0.0
            if ball_pos and prev_ball_pos:
                dist = np.sqrt((ball_pos[0] - prev_ball_pos[0])**2 + (ball_pos[1] - prev_ball_pos[1])**2)
                ball_speed = dist / (sample_step / fps)
            if ball_pos:
                prev_ball_pos = ball_pos
                
            # Ziel-Kamera-X (Gewichteter Schwerpunkt)
            if ball_pos:
                target_x = 0.60 * ball_pos[0] + 0.40 * player_cluster_x
            else:
                target_x = player_cluster_x
                
            sampled_tracking.append({
                'frame': curr_frame_idx,
                'target_x': target_x,
                'ball': ball_pos,
                'players': p_centers,
                'cluster_density': len(p_centers),
                'ball_speed': ball_speed
            })
            
        curr_frame_idx += 1
        
        if progress_callback and (curr_frame_idx % report_interval == 0):
            perc = min(70.0, 40.0 + (curr_frame_idx / total_frames) * 30.0)
            progress_callback(perc, f"YOLOv8 Tracking & Analyse (Frame {curr_frame_idx}/{total_frames})...")

    cap.release()
    
    # 2. Glättung & Lead-the-Play Trajektorie für 16:9 Pan & Scan mit dynamischem Zoom
    # Ziel-Ausgabeformat: Immer strikt 16:9 (verhindert schwarze Ränder bei 16:9 Originalen)
    out_h = pano_h
    out_w = int(out_h * (16.0 / 9.0))
    
    # Wenn das Original-Video schmaler ist als 16:9, dann Breite als Limit nehmen
    if out_w > pano_w:
        out_w = pano_w
        out_h = int(out_w * (9.0 / 16.0))
    
    full_camera_rects = []
    if sampled_tracking:
        alpha_x = 0.04 # Weicheres Damping (EMA) für Panning
        alpha_z = 0.02 # Sehr sanftes Damping für Zoom
        
        current_cam_x = pano_w * 0.5
        current_zoom_h = float(out_h)
        
        sample_indices = [s['frame'] for s in sampled_tracking]
        target_xs = [s['target_x'] for s in sampled_tracking]
        
        # Zoom-Ziele berechnen basierend auf Spieler-Verteilung & Ball-Tempo
        target_zooms = []
        for s in sampled_tracking:
            p_centers = s.get('players', [])
            if p_centers:
                xs = [p[0] for p in p_centers]
                spread = max(xs) - min(xs)
            else:
                spread = pano_w * 0.3
                
            min_h = out_h * 0.55 # Max Zoom (55% der zulässigen Bildhöhe)
            max_h = out_h        # Min Zoom (Maximal erlaubte 16:9 Höhe)
            
            # Map spread to zoom
            t_h = min_h + (spread - pano_w * 0.1) / (pano_w * 0.3) * (max_h - min_h)
            
            # Rauszoomen wenn der Ball schnell ist
            if s.get('ball_speed', 0) > 15.0:
                t_h += (s['ball_speed'] - 15.0) * 12
                
            t_h = max(min_h, min(max_h, t_h))
            target_zooms.append(t_h)
        
        all_target_xs = np.interp(np.arange(total_frames), sample_indices, target_xs)
        all_target_zooms = np.interp(np.arange(total_frames), sample_indices, target_zooms)
        
        for t in range(total_frames):
            raw_target_x = all_target_xs[t]
            raw_target_z = all_target_zooms[t]
            
            # Vorausschau (Lead-the-Play): Richtung antizipieren
            if t < total_frames - 10:
                lookahead = all_target_xs[t+10] - raw_target_x
                raw_target_x += lookahead * 0.4
                
            current_cam_x = alpha_x * raw_target_x + (1.0 - alpha_x) * current_cam_x
            current_zoom_h = alpha_z * raw_target_z + (1.0 - alpha_z) * current_zoom_h
            
            # 16:9 Querformat strikt beibehalten
            dyn_crop_h = int(current_zoom_h)
            dyn_crop_w = int(dyn_crop_h * (16.0 / 9.0))
            
            # Zentriert in der Höhe
            crop_y = int((pano_h - dyn_crop_h) / 2.0)
            
            # Clamping: Das Fenster darf nicht über die linken/rechten Ränder hinauslaufen
            min_center = dyn_crop_w / 2.0
            max_center = pano_w - (dyn_crop_w / 2.0)
            
            if max_center < min_center:
                clamped_center_x = pano_w / 2.0
            else:
                clamped_center_x = max(min_center, min(max_center, current_cam_x))
            
            crop_x = int(clamped_center_x - (dyn_crop_w / 2.0))
            full_camera_rects.append((crop_x, crop_y, dyn_crop_w, dyn_crop_h))
    else:
        full_camera_rects = [(int((pano_w - out_w) / 2.0), int((pano_h - out_h) / 2.0), out_w, out_h)] * total_frames
        
    # 3. Automatische Match-Events speichern
    db = SessionLocal()
    try:
        job = db.query(VideoStitchJob).filter(VideoStitchJob.id == job_id).first()
        if job and job.match_id and detect_events_auto:
            detect_match_events_from_tracking(sampled_tracking, fps, pano_w, pano_h, db, job.match_id)
    except Exception as e:
        print(f"[Tracker] Error detecting events: {e}")
    finally:
        db.close()
        
    # 4. FFmpeg: 16:9 Dynamic Cam Video zuschneiden und codieren
    if output_mode in ["DYNAMIC_16_9", "DUAL"]:
        if progress_callback:
            progress_callback(75.0, "FFmpeg Pan & Scan Rendering mit Zoom (16:9 Broadcast)...")
            
        render_dynamic_crop_video(master_panorama_path, output_16_9_path, full_camera_rects, out_w, out_h, fps)
        
    return {
        "frames_processed": total_frames,
        "sample_points": len(sampled_tracking)
    }

def render_dynamic_crop_video(
    input_video: str,
    output_video: str,
    camera_rects: list,
    out_w: int,
    out_h: int,
    fps: float
):
    """
    Rendert das dynamisch geführte 16:9 Video aus dem 32:9 Panorama mit Zoom.
    Nutzt FFmpeg Pipe für maximale Performance.
    """
    cap = cv2.VideoCapture(input_video)
    if not cap.isOpened(): return False
    
    total_frames = len(camera_rects)
    
    # FFmpeg Subprocess zum direkten Encodieren via stdin Pipe (Fixe Output-Größe)
    cmd = [
        FFMPEG_PATH, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "-",
        "-i", input_video, # Ton aus Master Panorama übernehmen
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-map", "0:v:0", "-map", "1:a:0?",
        "-shortest",
        output_video
    ]
    
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    for idx in range(total_frames):
        ret, frame = cap.read()
        if not ret: break
        
        crop_x, crop_y, crop_w, crop_h = camera_rects[idx]
        
        # Sicherstellen, dass crop_x/crop_y/w/h innerhalb des Bildes liegen
        fh, fw = frame.shape[:2]
        crop_x = max(0, min(fw - crop_w, crop_x))
        crop_y = max(0, min(fh - crop_h, crop_y))
        
        cropped = frame[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
        
        # Frame auf die Ziel-Auflösung (z.B. 1920x1080) skalieren, falls gezoomt wurde
        if crop_w != out_w or crop_h != out_h:
            cropped = cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
            
        try:
            proc.stdin.write(cropped.tobytes())
        except Exception:
            break
            
    cap.release()
    try:
        proc.stdin.close()
        proc.wait()
    except Exception:
        pass
        
    return os.path.exists(output_video)

# ==============================================================================
# Highlight Detection Job State Tracker
# ==============================================================================

HIGHLIGHT_JOBS = {}

def get_highlight_job_status(match_id: str) -> dict:
    """Gibt den aktuellen Status der KI-Highlight-Erkennung für ein Match zurück."""
    job = HIGHLIGHT_JOBS.get(match_id)
    if not job:
        return {
            "has_job": False,
            "status": "IDLE",
            "progress": 0.0,
            "current_step_text": "",
            "events_detected": 0,
            "error_message": None
        }
    return {
        "has_job": True,
        "status": job.get("status", "IDLE"),
        "progress": job.get("progress", 0.0),
        "current_step_text": job.get("current_step_text", ""),
        "events_detected": job.get("events_detected", 0),
        "error_message": job.get("error_message", None),
        "updated_at": job.get("updated_at")
    }

def update_highlight_job_status(match_id: str, status: str, progress: float, step_text: str = "", events_detected: int = 0, error: str = None):
    """Aktualisiert den Status und Fortschritt eines Highlight-Jobs im Speicher."""
    HIGHLIGHT_JOBS[match_id] = {
        "status": status,
        "progress": round(float(progress), 1),
        "current_step_text": step_text,
        "events_detected": events_detected,
        "error_message": error,
        "updated_at": time.time()
    }
    print(f"[Highlights][{match_id}] {status} ({round(float(progress), 1)}%): {step_text}")

def generate_highlights_for_existing_match(match_id: str, speed: str = "normal"):
    """
    Analysiert ein existierendes Match-Video und generiert automatisch KI-Highlights (Tore, Ecken, Elfmeter, Großchancen).
    `speed` waehlt eine der HIGHLIGHT_SPEED_PRESETS ("fast"/"normal"/"slow") und steuert damit
    Abtastrate, YOLO-Inferenzauflösung/-Modell und ob vorhandene Tracking-Daten wiederverwendet
    werden dürfen (bei "slow" erzwungen deaktiviert, um immer einen frischen High-Quality-Scan
    zu erzwingen statt ggf. mit "fast" erzeugte grobe Daten zu übernehmen):
    1. Schneller Abruf: Wiederverwendung vorhandener Tracking-Daten (falls vorliegend und erlaubt) in < 1s.
    2. Turbo Video-Scanning: Schnelles Frame-Skipping via cap.grab() und gezielte YOLOv8-Inferenz.
    """
    preset = get_highlight_speed_preset(speed)
    db: Session = SessionLocal()
    update_highlight_job_status(match_id, "PROCESSING", 2.0, f"Initialisiere KI-Videoanalyse & Modell ({speed})...")
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            msg = f"Match {match_id} nicht in Datenbank gefunden."
            print(f"[Highlights] {msg}")
            update_highlight_job_status(match_id, "FAILED", 0.0, msg, error=msg)
            return False

        # Finde Videopfad
        chunk = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).first()
        video_rel = chunk.video_path if chunk and chunk.video_path else None
        if not video_rel and match.video_left_path:
            video_rel = match.video_left_path

        if not video_rel:
            msg = f"Kein Video für Match {match_id} vorhanden."
            print(f"[Highlights] {msg}")
            update_highlight_job_status(match_id, "FAILED", 0.0, msg, error=msg)
            return False

        # Absoluter Pfad ermitteln
        clean_rel = video_rel.replace("uploads/", "").replace("uploads\\", "").replace("backend/", "")
        video_abs = os.path.join(UPLOAD_DIR, clean_rel)
        if not os.path.exists(video_abs):
            video_abs = os.path.join(BASE_DIR, video_rel)
        if not os.path.exists(video_abs):
            msg = f"Videodatei nicht gefunden: {video_abs}"
            print(f"[Highlights] {msg}")
            update_highlight_job_status(match_id, "FAILED", 0.0, msg, error=msg)
            return False

        # ----------------------------------------------------------------------
        # 1. Sofort-Modus: Prüfe, ob Tracking-Daten bereits vorhanden sind
        # ----------------------------------------------------------------------
        tracking_candidates = []
        if chunk and chunk.tracking_path:
            clean_track = chunk.tracking_path.replace("uploads/", "").replace("uploads\\", "").replace("backend/", "").lstrip("/\\")
            tracking_candidates.extend([
                os.path.join(UPLOAD_DIR, clean_track),
                os.path.join(BASE_DIR, chunk.tracking_path.lstrip("/\\")),
            ])
        match_folder = os.path.join(UPLOAD_DIR, match_id)
        tracking_candidates.append(os.path.join(match_folder, "tracking.jsonl"))

        existing_tracking_file = next((f for f in tracking_candidates if os.path.exists(f) and os.path.getsize(f) > 50), None) if preset["allow_instant_reuse"] else None

        if existing_tracking_file:
            update_highlight_job_status(match_id, "PROCESSING", 30.0, "Lade vorhandene Spielverfolgungs-Daten (Turbo-Modus < 1s)...")
            try:
                sampled_tracking = []
                with open(existing_tracking_file, 'r', encoding='utf-8') as tf:
                    for line in tf:
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        p_list = []
                        for p in data.get('players', []):
                            if isinstance(p, (list, tuple)) and len(p) >= 2:
                                p_list.append((float(p[0]), float(p[1])))
                            elif isinstance(p, dict) and 'x' in p and 'y' in p:
                                p_list.append((float(p['x']), float(p['y'])))
                        b_pos = None
                        if data.get('ball') and isinstance(data['ball'], (list, tuple)) and len(data['ball']) >= 2:
                            b_pos = (float(data['ball'][0]), float(data['ball'][1]))
                        
                        sampled_tracking.append({
                            'frame': data.get('frame', 0),
                            'ball': b_pos,
                            'players': p_list,
                            'cluster_density': len(p_list),
                            'ball_speed': float(data.get('ball_speed', 0.0))
                        })

                if len(sampled_tracking) > 10:
                    update_highlight_job_status(match_id, "PROCESSING", 80.0, f"Analysiere {len(sampled_tracking)} Tracking-Punkte auf Spielaktionen...")
                    cap_meta = cv2.VideoCapture(video_abs)
                    fps = cap_meta.get(cv2.CAP_PROP_FPS) or 25.0
                    width = int(cap_meta.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
                    height = int(cap_meta.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
                    cap_meta.release()

                    detected_events, skipped_existing = detect_match_events_from_tracking(sampled_tracking, fps, width, height, db, match_id)
                    db.commit()
                    evt_count = len(detected_events) if detected_events else 0
                    success_text = f"Highlights in Rekordzeit generiert! {evt_count} neue Spielaktionen erkannt."
                    if skipped_existing:
                        success_text += f" ({skipped_existing} bestehende Highlights unverändert übersprungen)"
                    update_highlight_job_status(match_id, "COMPLETED", 100.0, success_text, events_detected=evt_count)
                    print(f"[Highlights] Sofort-Erkennung aus Tracking-File für Match {match_id} abgeschlossen ({evt_count} neue Events, {skipped_existing} übersprungen).")
                    return True
            except Exception as e_track:
                print(f"[Highlights] Tracking-File Re-Use fehlgeschlagen ({e_track}), wechsle zu Turbo-Video-Scan...")

        # ----------------------------------------------------------------------
        # 2. Turbo-Video-Scan: Abtastrate/Auflösung/Modell je nach Geschwindigkeitsstufe
        # ----------------------------------------------------------------------
        cap = cv2.VideoCapture(video_abs)
        if not cap.isOpened():
            msg = f"Kann Videodatei nicht öffnen: {video_abs}"
            print(f"[Highlights] {msg}")
            update_highlight_job_status(match_id, "FAILED", 0.0, msg, error=msg)
            return False

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

        update_highlight_job_status(match_id, "PROCESSING", 5.0, f"Lade KI-Erkennungsmodell {preset['model_name']} ({width}x{height} @ {int(fps)} FPS, Stufe: {speed})...")

        # Lade YOLOv8 mit automatischer Hardware-Beschleunigung (GPU/CPU); bei "slow" ein
        # groesseres, praeziseres Modell - faellt bei Download-/Ladefehlern auf yolov8n zurueck.
        yolo_model = None
        try:
            from ultralytics import YOLO
            import torch
            try:
                yolo_model = YOLO(preset["model_name"])
            except Exception as model_err:
                print(f"[Highlights] Modell {preset['model_name']} nicht verfügbar ({model_err}), Fallback auf yolov8n.pt.")
                yolo_model = YOLO("yolov8n.pt")
            if torch.cuda.is_available():
                yolo_model.to('cuda')
                print("[Highlights] YOLOv8 nutzt CUDA GPU-Beschleunigung! 🚀")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                yolo_model.to('mps')
            else:
                torch.set_num_threads(min(8, os.cpu_count() or 4))
        except Exception as ye:
            print(f"[Highlights] YOLOv8 Init Info: {ye}")

        # Abtastrate aus der gewählten Geschwindigkeitsstufe (fast=1 FPS grob, normal=2 FPS
        # wie bisher, slow=5 FPS für maximale Präzision).
        sample_stride = max(preset["min_stride"], int(fps / preset["sample_fps"]))
        # Normalisiert die Ball-Verschiebung pro Sample auf "Pixel/Sekunde bei 2 FPS Referenz",
        # damit der ball_speed-Schwellwert in detect_match_events_from_tracking (>25.0) bei
        # jeder Abtastrate gleich kalibriert bleibt (siehe HIGHLIGHT_SPEED_PRESETS-Kommentar).
        speed_calibration_factor = preset["sample_fps"] / 2.0
        sampled_tracking = []
        curr_frame = 0
        last_ball_pos = None
        report_interval = max(25, int(fps * 3))

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            ball_boxes, player_boxes = run_yolo_detection_on_frame(frame, yolo_model, imgsz=preset["imgsz"], conf=preset["conf"])
            p_centers = [((b[0][0] + b[0][2]) / 2.0, (b[0][1] + b[0][3]) / 2.0) for b in player_boxes]
            ball_pos = None
            ball_speed = 0.0

            if ball_boxes:
                bb = ball_boxes[0][0]
                ball_pos = ((bb[0] + bb[2]) / 2.0, (bb[1] + bb[3]) / 2.0)
                if last_ball_pos:
                    dx = ball_pos[0] - last_ball_pos[0]
                    dy = ball_pos[1] - last_ball_pos[1]
                    ball_speed = np.sqrt(dx*dx + dy*dy) * speed_calibration_factor
                last_ball_pos = ball_pos

            sampled_tracking.append({
                'frame': curr_frame,
                'ball': ball_pos,
                'players': p_centers,
                'cluster_density': len(p_centers),
                'ball_speed': ball_speed
            })

            curr_frame += 1

            # Überspringe die Zwischen-Frames mit schnellem cap.grab() statt cap.read()
            for _ in range(sample_stride - 1):
                if not cap.grab():
                    break
                curr_frame += 1

            if total_frames > 0 and (curr_frame % report_interval < sample_stride or curr_frame >= total_frames):
                perc = min(90.0, 5.0 + (curr_frame / float(total_frames)) * 85.0)
                update_highlight_job_status(
                    match_id,
                    "PROCESSING",
                    perc,
                    f"Turbo-KI-Tracking: Frame {curr_frame} / {total_frames} ({int(perc)}%)"
                )

        cap.release()

        # Events erkennen und eintragen
        update_highlight_job_status(match_id, "PROCESSING", 92.0, "Analysiere Spielzüge auf Tore, Ecken & Großchancen...")
        detected_events, skipped_existing = detect_match_events_from_tracking(sampled_tracking, fps, width, height, db, match_id, sample_fps=preset["sample_fps"])
        db.commit()

        success_text = f"Highlights erfolgreich generiert! {evt_count} neue Spielaktionen erkannt."
        if skipped_existing:
            success_text += f" ({skipped_existing} bestehende Highlights unverändert übersprungen)"
        update_highlight_job_status(match_id, "COMPLETED", 100.0, success_text, events_detected=evt_count)
        print(f"[Highlights] Automatische Turbo-Highlight-Erkennung für Match {match_id} abgeschlossen ({evt_count} neue Events, {skipped_existing} übersprungen).")
        return True
    except Exception as e:
        err_msg = f"Fehler bei Highlight-Erkennung: {str(e)}"
        print(f"[Highlights] {err_msg}")
        update_highlight_job_status(match_id, "FAILED", 0.0, err_msg, error=str(e))
        return False
    finally:
        db.close()



