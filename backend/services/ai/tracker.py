import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv
import os
import json
import math
from typing import Tuple, List, Dict, Any, Optional

def extract_jersey_color(frame: np.ndarray, x1: float, y1: float, x2: float, y2: float) -> Tuple[str, Tuple[int, int, int]]:
    """
    Extrahiert die dominante Trikotfarbe aus dem oberen Brust-/Rumpfbereich des Spielers.
    Filtert Rasengrün heraus und liefert (Hex-String, RGB-Tupel) zurück.
    """
    fh, fw = frame.shape[:2]
    ix1, iy1 = max(0, int(x1)), max(0, int(y1))
    ix2, iy2 = min(fw, int(x2)), min(fh, int(y2))

    w = ix2 - ix1
    h = iy2 - iy1
    if w < 6 or h < 12:
        return ("#64748b", (100, 116, 139))

    # Trikotbereich: ca. 15% bis 48% der Höhe, 20% bis 80% der Breite
    jy1 = min(fh - 1, int(iy1 + 0.15 * h))
    jy2 = min(fh, int(iy1 + 0.48 * h))
    jx1 = min(fw - 1, int(ix1 + 0.20 * w))
    jx2 = min(fw, int(ix2 - 0.20 * w))

    if jy2 <= jy1 or jx2 <= jx1:
        return ("#64748b", (100, 116, 139))

    crop = frame[jy1:jy2, jx1:jx2]
    if crop.size == 0:
        return ("#64748b", (100, 116, 139))

    try:
        # HSV Farbraum zur Maskierung von Rasengrün (Hue ~32..85)
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        grass_mask = cv2.inRange(hsv, np.array([30, 40, 30]), np.array([88, 255, 255]))
        valid_pixels = crop[grass_mask == 0]

        if len(valid_pixels) < 12:
            valid_pixels = crop.reshape(-1, 3)

        # Median BGR berechnen
        med_b = float(np.median(valid_pixels[:, 0]))
        med_g = float(np.median(valid_pixels[:, 1]))
        med_r = float(np.median(valid_pixels[:, 2]))

        r, g, b = int(med_r), int(med_g), int(med_b)
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        return (hex_color, (r, g, b))
    except Exception:
        return ("#64748b", (100, 116, 139))

class SimpleCentroidTracker:
    """
    Robuster Fallback-Tracker für stabile Spieler-IDs über aufeinanderfolgende Frames.
    """
    def __init__(self, max_distance: float = 0.08, max_disappeared: int = 15):
        self.next_id = 1
        self.objects: Dict[int, Tuple[float, float]] = {} # id -> (norm_x, norm_y)
        self.disappeared: Dict[int, int] = {}
        self.max_distance = max_distance
        self.max_disappeared = max_disappeared

    def update(self, detections: List[Tuple[float, float]]) -> List[int]:
        if len(detections) == 0:
            for obj_id in list(self.disappeared.keys()):
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    del self.objects[obj_id]
                    del self.disappeared[obj_id]
            return []

        if len(self.objects) == 0:
            assigned_ids = []
            for det in detections:
                obj_id = self.next_id
                self.next_id += 1
                self.objects[obj_id] = det
                self.disappeared[obj_id] = 0
                assigned_ids.append(obj_id)
            return assigned_ids

        # Matche bestehende Objekte mit neuen Detektionen nach euklidischem Abstand
        obj_ids = list(self.objects.keys())
        obj_pts = [self.objects[oid] for oid in obj_ids]

        assigned_ids = [-1] * len(detections)
        used_objs = set()

        for d_idx, (dx, dy) in enumerate(detections):
            best_dist = float("inf")
            best_oid = None

            for o_idx, oid in enumerate(obj_ids):
                if oid in used_objs:
                    continue
                ox, oy = obj_pts[o_idx]
                dist = math.hypot(dx - ox, dy - oy)
                if dist < best_dist and dist < self.max_distance:
                    best_dist = dist
                    best_oid = oid

            if best_oid is not None:
                assigned_ids[d_idx] = best_oid
                self.objects[best_oid] = (dx, dy)
                self.disappeared[best_oid] = 0
                used_objs.add(best_oid)
            else:
                # Neues Objekt
                new_id = self.next_id
                self.next_id += 1
                self.objects[new_id] = (dx, dy)
                self.disappeared[new_id] = 0
                assigned_ids[d_idx] = new_id

        # Prüfe nicht gematchte existierende Objekte
        for oid in obj_ids:
            if oid not in used_objs:
                self.disappeared[oid] = self.disappeared.get(oid, 0) + 1
                if self.disappeared[oid] > self.max_disappeared:
                    del self.objects[oid]
                    del self.disappeared[oid]

        return assigned_ids

def classify_team_by_color(
    rgb: Tuple[int, int, int], 
    home_centroid: Optional[Tuple[float, float, float]], 
    away_centroid: Optional[Tuple[float, float, float]]
) -> str:
    """
    Klassifiziert eine Trikotfarbe in 'home', 'away' oder 'neutral'.
    """
    if not home_centroid or not away_centroid:
        return "home"

    r, g, b = rgb
    d_home = math.hypot(r - home_centroid[0], g - home_centroid[1], b - home_centroid[2])
    d_away = math.hypot(r - away_centroid[0], g - away_centroid[1], b - away_centroid[2])

    if d_home <= d_away:
        return "home"
    else:
        return "away"

def process_video_for_heatmap(video_path: str, output_path: str, match_id: str = None, progress_callback=None):
    print(f"[HeatmapDebug] Starting tracker for {video_path}")
    if progress_callback:
        progress_callback(2.0, "Lade YOLOv8 Tracking-Modell...")

    try:
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file_dir)))
        model_path = os.path.join(root_dir, "yolov8n.pt")
        if not os.path.exists(model_path):
            model_path = "yolov8n.pt"
            
        print(f"[HeatmapDebug] Loading model from {model_path}...")
        model = YOLO(model_path)
        print("[HeatmapDebug] Model loaded successfully.")
    except Exception as e:
        print(f"[HeatmapDebug] Error loading model: {e}")
        if progress_callback:
            progress_callback(0.0, f"Fehler beim Laden des YOLO-Modells: {e}")
        raise

    heatmap_image_path = os.path.join(output_path, "heatmap.png")
    tracking_json_path = os.path.join(output_path, "tracking.jsonl")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        err_msg = f"Video konnte nicht geöffnet werden: {video_path}"
        print(f"[HeatmapDebug] Error: {err_msg}")
        if progress_callback:
            progress_callback(0.0, err_msg)
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if progress_callback:
        progress_callback(5.0, f"Video geöffnet ({total_frames} Frames). Starte KI-Spieler-Tracking...")

    # Optional supervision ByteTrack or fallback centroid tracker
    use_bytetrack = False
    byte_tracker = None
    if hasattr(sv, "ByteTrack"):
        try:
            byte_tracker = sv.ByteTrack(track_thresh=0.25, track_buffer=35, match_thresh=0.8)
            use_bytetrack = True
        except Exception:
            pass

    fallback_tracker = SimpleCentroidTracker(max_distance=0.08, max_disappeared=20)

    # Farbspeicher für Trikot-Clustering
    all_colors_rgb: List[Tuple[int, int, int]] = []
    player_team_votes: Dict[int, List[str]] = {}

    # Heatmap accumulation
    heatmap = np.zeros((height, width), dtype=np.float32)

    frame_skip = 30  # ca. 1 Frame pro Sekunde
    frame_idx = 0
    last_reported_pct = 5.0

    collected_frames_data = []

    # 1. Tracking & Detektion Pass
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_skip == 0:
            results = model(frame, classes=[0], verbose=False) # Person
            detections = sv.Detections.from_ultralytics(results[0])

            if use_bytetrack and byte_tracker is not None:
                try:
                    detections = byte_tracker.update_with_detections(detections)
                except Exception:
                    pass

            frame_detections = []
            centroids_for_fallback = []
            boxes_data = []

            for i in range(len(detections.xyxy)):
                x1, y1, x2, y2 = detections.xyxy[i]
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                norm_x = float(cx / width)
                norm_y = float(cy / height)
                ground_x = norm_x
                ground_y = float(min(height - 1, y2) / height)

                tracker_id = None
                if hasattr(detections, "tracker_id") and detections.tracker_id is not None and len(detections.tracker_id) > i:
                    tid = detections.tracker_id[i]
                    if tid is not None and not np.isnan(tid):
                        tracker_id = int(tid)

                hex_col, rgb = extract_jersey_color(frame, x1, y1, x2, y2)
                all_colors_rgb.append(rgb)

                if 0 <= norm_x <= 1 and 0 <= norm_y <= 1:
                    heatmap[int(cy), int(cx)] += 1
                    boxes_data.append({
                        "x": norm_x,
                        "y": norm_y,
                        "ground_x": ground_x,
                        "ground_y": ground_y,
                        "jersey_color": hex_col,
                        "rgb": rgb,
                        "tracker_id": tracker_id
                    })
                    centroids_for_fallback.append((norm_x, norm_y))

            # Fallback IDs zuweisen falls ByteTrack keine IDs lieferte
            if centroids_for_fallback:
                fallback_ids = fallback_tracker.update(centroids_for_fallback)
                for b_idx, box in enumerate(boxes_data):
                    if box["tracker_id"] is None:
                        box["tracker_id"] = fallback_ids[b_idx] if b_idx < len(fallback_ids) else (b_idx + 1)
                    frame_detections.append(box)

            if frame_detections:
                collected_frames_data.append({
                    "frame": frame_idx,
                    "detections": frame_detections
                })

        # Fortschritt melden
        if total_frames > 0:
            current_pct = round(5.0 + (min(frame_idx, total_frames) / float(total_frames)) * 82.0, 1)
        else:
            current_pct = round(min(5.0 + (frame_idx / 1000.0) * 10.0, 85.0), 1)

        if progress_callback and (current_pct - last_reported_pct >= 0.5 or frame_idx % (frame_skip * 4) == 0):
            last_reported_pct = current_pct
            progress_callback(current_pct, f"YOLOv8 Spieler-Tracking (Frame {frame_idx}/{total_frames} • {int(current_pct)}%)...")

        frame_idx += 1

    cap.release()

    if progress_callback:
        progress_callback(88.0, "Klassifiziere Heim- und Gast-Mannschaften anhand der Trikotfarben...")

    # 2. Team-Clustering (2 Trikotfarben: Heim vs. Gast)
    home_centroid = (220.0, 40.0, 40.0) # Fallback Red
    away_centroid = (40.0, 80.0, 220.0) # Fallback Blue

    if len(all_colors_rgb) >= 10:
        try:
            # 2-Cluster K-Means auf gesammelten Trikot-Farben
            colors_arr = np.float32(all_colors_rgb)
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            _, labels, centers = cv2.kmeans(colors_arr, 2, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
            
            if len(centers) >= 2:
                # Unterscheide Teams
                c0 = (float(centers[0][0]), float(centers[0][1]), float(centers[0][2]))
                c1 = (float(centers[1][0]), float(centers[1][1]), float(centers[1][2]))
                home_centroid = c0
                away_centroid = c1
        except Exception as e_km:
            print(f"[HeatmapDebug] K-Means Teamclustering Fallback: {e_km}")

    # Vote Team for each persistent tracker_id
    for f_item in collected_frames_data:
        for det in f_item["detections"]:
            tid = det["tracker_id"]
            vote = classify_team_by_color(det["rgb"], home_centroid, away_centroid)
            if tid not in player_team_votes:
                player_team_votes[tid] = []
            player_team_votes[tid].append(vote)

    # Konsistente Team-Zuordnung pro Spieler
    player_final_team: Dict[int, str] = {}
    for tid, votes in player_team_votes.items():
        home_count = votes.count("home")
        away_count = votes.count("away")
        player_final_team[tid] = "home" if home_count >= away_count else "away"

    # 3. tracking.jsonl schreiben
    with open(tracking_json_path, "w") as f_json:
        for f_item in collected_frames_data:
            clean_dets = []
            for det in f_item["detections"]:
                tid = det["tracker_id"]
                team = player_final_team.get(tid, "home")
                clean_dets.append({
                    "label": "player",
                    "tracker_id": tid,
                    "team": team,
                    "x": det["x"],
                    "y": det["y"],
                    "ground_x": det["ground_x"],
                    "ground_y": det["ground_y"],
                    "jersey_color": det["jersey_color"]
                })
            f_json.write(json.dumps({"frame": f_item["frame"], "detections": clean_dets}) + "\n")

    if progress_callback:
        progress_callback(94.0, "Generiere Heatmap-Farbmatrix & Speichere Tracking-Daten...")

    # 4. Heatmap Image speichern
    if np.max(heatmap) > 0:
        heatmap_norm = (heatmap / np.max(heatmap) * 255).astype(np.uint8)
        heatmap_color = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
        cv2.imwrite(heatmap_image_path, heatmap_color)
        print(f"Heatmap saved to {heatmap_image_path}")
        print(f"Tracking data with team separation saved to {tracking_json_path}")
        if progress_callback:
            progress_callback(100.0, "Heatmap & Spieler-Tracking erfolgreich abgeschlossen.")
    else:
        print("No detections found, heatmap not generated.")
        if progress_callback:
            progress_callback(100.0, "Keine Spieler im Video erkannt.")
