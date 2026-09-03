import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv
import os
import json

def process_video_for_heatmap(video_path: str, output_path: str):
    print(f"[HeatmapDebug] Starting tracker for {video_path}")
    try:
        # Get absolute path to yolov8n.pt in the root directory
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file_dir)))
        model_path = os.path.join(root_dir, "yolov8n.pt")
        if not os.path.exists(model_path):
            model_path = "yolov8n.pt"
            
        print(f"[HeatmapDebug] Loading model from {model_path}...")
        model = YOLO(model_path)  # Using a small, fast model
        print("[HeatmapDebug] Model loaded successfully.")
    except Exception as e:
        print(f"[HeatmapDebug] Error loading model: {e}")
        raise

    # Define the output paths
    heatmap_image_path = os.path.join(output_path, "heatmap.png")
    tracking_json_path = os.path.join(output_path, "tracking.jsonl")

    # Get video info
    print(f"[HeatmapDebug] Opening video {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[HeatmapDebug] Error: Could not open video {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Heatmap accumulation array
    heatmap = np.zeros((height, width), dtype=np.float32)

    # Frame skipping
    frame_skip = 30  # Process every 30th frame (roughly 1 frame per second)
    frame_idx = 0

    with open(tracking_json_path, "w") as f_json:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_skip == 0:
                # Perform detection
                results = model(frame, classes=[0], verbose=False) # Class 0 is 'person'
                detections = sv.Detections.from_ultralytics(results[0])

                frame_data = {"frame": frame_idx, "detections": []}

                for x1, y1, x2, y2 in detections.xyxy:
                    # Get the center of the bounding box
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2

                    # Normalized coordinates (0.0 to 1.0) for frontend
                    norm_x = float(center_x / width)
                    norm_y = float(center_y / height)

                    if 0 <= norm_x <= 1 and 0 <= norm_y <= 1:
                        # Accumulate in heatmap image (pixel coordinates)
                        heatmap[int(center_y), int(center_x)] += 1
                        # Save to JSON (normalized coordinates)
                        frame_data["detections"].append({
                            "label": "player",
                            "x": norm_x,
                            "y": norm_y
                        })
                
                if frame_data["detections"]:
                    f_json.write(json.dumps(frame_data) + "\n")

            frame_idx += 1

    cap.release()

    # Normalize and generate the heatmap image
    if np.max(heatmap) > 0:
        heatmap_norm = (heatmap / np.max(heatmap) * 255).astype(np.uint8)
        heatmap_color = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
        cv2.imwrite(heatmap_image_path, heatmap_color)
        print(f"Heatmap saved to {heatmap_image_path}")
        print(f"Tracking data saved to {tracking_json_path}")
    else:
        print("No detections found, heatmap not generated.")
