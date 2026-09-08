import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

def get_dst_points(pitch_type: str = "full") -> np.ndarray:
    """
    Gibt die 4 normierten Zielkoordinaten auf dem 2D-Spielfeld zurück.
    Standard-Ausrichtung: Horizontal (X: 0=Linkes Tor bis 1=Rechtes Tor, Y: 0=Obere Seitenlinie bis 1=Untere Seitenlinie)
    Reihenfolge: [Oben-Links, Oben-Rechts, Unten-Rechts, Unten-Links]
    """
    pt = (pitch_type or "full").lower()
    if pt == "half_left":
        # Linkes Halbfeld: Torlinie links (x=0) bis Mittellinie (x=0.5)
        return np.float32([
            [0.0, 0.0],
            [0.5, 0.0],
            [0.5, 1.0],
            [0.0, 1.0]
        ])
    elif pt == "half_right":
        # Rechtes Halbfeld: Mittellinie (x=0.5) bis Torlinie rechts (x=1.0)
        return np.float32([
            [0.5, 0.0],
            [1.0, 0.0],
            [1.0, 1.0],
            [0.5, 1.0]
        ])
    elif pt == "penalty_box_left":
        # Linker 16m-Raum (x: 0 bis ~0.16)
        return np.float32([
            [0.0, 0.22],
            [0.16, 0.22],
            [0.16, 0.78],
            [0.0, 0.78]
        ])
    elif pt == "penalty_box_right":
        # Rechter 16m-Raum (x: ~0.84 bis 1.0)
        return np.float32([
            [0.84, 0.22],
            [1.0, 0.22],
            [1.0, 0.78],
            [0.84, 0.78]
        ])
    else:
        # Standard: Gesamtes Spielfeld von Eckfahne zu Eckfahne
        return np.float32([
            [0.0, 0.0],
            [1.0, 0.0],
            [1.0, 1.0],
            [0.0, 1.0]
        ])

def compute_pitch_homography(src_points: List[Dict[str, float]], pitch_type: str = "full") -> Optional[np.ndarray]:
    """
    Berechnet die 3x3 Projektionsmatrix H von Video-Koordinaten auf normierte 2D-Spielfeldkoordinaten.
    """
    if not src_points or len(src_points) < 4:
        return None

    src = np.float32([[p["x"], p["y"]] for p in src_points[:4]])
    dst = get_dst_points(pitch_type)

    try:
        H, _ = cv2.findHomography(src, dst)
        return H
    except Exception as e:
        print(f"[Homography] Fehler bei findHomography: {e}")
        return None

def transform_positions(
    positions: List[Dict[str, float]], 
    H: Optional[np.ndarray], 
    clip_bounds: bool = True
) -> List[Dict[str, float]]:
    """
    Transformiert eine Liste normierter Video-Koordinaten [{x, y}, ...] via Homographie-Matrix
    in normierte 2D-Spielfeld-Koordinaten (0.0 bis 1.0).
    """
    if H is None or not positions:
        return []

    # Format für cv2.perspectiveTransform: (N, 1, 2)
    pts = np.float32([[p.get("ground_x", p["x"]), p.get("ground_y", p["y"])] for p in positions]).reshape(-1, 1, 2)
    try:
        transformed = cv2.perspectiveTransform(pts, H).reshape(-1, 2)
    except Exception as e:
        print(f"[Homography] Fehler bei perspectiveTransform: {e}")
        return []

    result = []
    for i, pt in enumerate(transformed):
        px, py = float(pt[0]), float(pt[1])
        orig = positions[i]
        item = {
            "team": orig.get("team", "home"),
            "tracker_id": orig.get("tracker_id"),
            "jersey_color": orig.get("jersey_color")
        }
        if clip_bounds:
            # Kleine Toleranz (z. B. Spieler läuft knapp hinter der Außenlinie)
            if -0.05 <= px <= 1.05 and -0.05 <= py <= 1.05:
                item["x"] = max(0.0, min(1.0, round(px, 4)))
                item["y"] = max(0.0, min(1.0, round(py, 4)))
                result.append(item)
        else:
            item["x"] = round(px, 4)
            item["y"] = round(py, 4)
            result.append(item)

    return result

def calculate_zone_stats(pitch_positions: List[Dict[str, float]]) -> Dict[str, Any]:
    """
    Berechnet taktische Zonen-Anteile (in Prozent) aus den 2D-Spielfeld-Positionen:
    - Spielfelddrittel (Defensiv, Mittelfeld, Angriffsdrittel)
    - Spielkanäle (Linke Außenbahn, Zentrum, Rechte Außenbahn)
    - Spielhälften (Eigene Hälfte, Gegnerische Hälfte)
    """
    total = len(pitch_positions)
    if total == 0:
        return {
            "total_points": 0,
            "thirds": {"defensive": 33.3, "midfield": 33.4, "attacking": 33.3},
            "channels": {"left_flank": 33.3, "center": 33.4, "right_flank": 33.3},
            "halves": {"own_half": 50.0, "opponent_half": 50.0}
        }

    # Drittel entlang der Längsachse (X: 0 bis 1)
    def_count = sum(1 for p in pitch_positions if p["x"] < 0.333)
    mid_count = sum(1 for p in pitch_positions if 0.333 <= p["x"] < 0.666)
    att_count = sum(1 for p in pitch_positions if p["x"] >= 0.666)

    # Kanäle entlang der Querachse (Y: 0=Oben/Links bis 1=Unten/Rechts)
    left_count = sum(1 for p in pitch_positions if p["y"] < 0.333)
    center_count = sum(1 for p in pitch_positions if 0.333 <= p["y"] < 0.666)
    right_count = sum(1 for p in pitch_positions if p["y"] >= 0.666)

    # Hälften
    own_count = sum(1 for p in pitch_positions if p["x"] < 0.5)
    opp_count = sum(1 for p in pitch_positions if p["x"] >= 0.5)

    return {
        "total_points": total,
        "thirds": {
            "defensive": round((def_count / total) * 100, 1),
            "midfield": round((mid_count / total) * 100, 1),
            "attacking": round((att_count / total) * 100, 1)
        },
        "channels": {
            "left_flank": round((left_count / total) * 100, 1),
            "center": round((center_count / total) * 100, 1),
            "right_flank": round((right_count / total) * 100, 1)
        },
        "halves": {
            "own_half": round((own_count / total) * 100, 1),
            "opponent_half": round((opp_count / total) * 100, 1)
        }
    }

def draw_2d_pitch_markings(img: np.ndarray, line_color: Tuple[int, int, int] = (255, 255, 255), thickness: int = 2):
    """
    Zeichnet exakte Spielfeldlinien auf ein 2D-Bild (z. B. 1050x680 Pixel, Maßstab 10:1 zu 105x68m).
    """
    h, w = img.shape[:2]
    # Ränder
    margin_x = int(w * 0.04)
    margin_y = int(h * 0.04)
    bx, by = margin_x, margin_y
    bw, bh = w - 2 * margin_x, h - 2 * margin_y

    mid_x = bx + bw // 2
    mid_y = by + bh // 2

    # 1. Äußere Auslinie
    cv2.rectangle(img, (bx, by), (bx + bw, by + bh), line_color, thickness)

    # 2. Mittellinie
    cv2.line(img, (mid_x, by), (mid_x, by + bh), line_color, thickness)

    # 3. Mittelkreis & Mittelpunkt (Radius ~9.15m -> ~9.15/68 * bh)
    center_r = int(bh * 0.18)
    cv2.circle(img, (mid_x, mid_y), center_r, line_color, thickness)
    cv2.circle(img, (mid_x, mid_y), 4, line_color, -1)

    # 4. Strafraum Links & Rechts (16.5m -> 16.5/105 * bw, Breite 40.3m -> 40.3/68 * bh)
    box_w = int(bw * 0.16)
    box_h = int(bh * 0.58)
    box_y = mid_y - box_h // 2
    cv2.rectangle(img, (bx, box_y), (bx + box_w, box_y + box_h), line_color, thickness)
    cv2.rectangle(img, (bx + bw - box_w, box_y), (bx + bw, box_y + box_h), line_color, thickness)

    # 5. Torraum Links & Rechts (5.5m -> 5.5/105 * bw, Breite 18.3m -> 18.3/68 * bh)
    goalbox_w = int(bw * 0.06)
    goalbox_h = int(bh * 0.28)
    goalbox_y = mid_y - goalbox_h // 2
    cv2.rectangle(img, (bx, goalbox_y), (bx + goalbox_w, goalbox_y + goalbox_h), line_color, thickness)
    cv2.rectangle(img, (bx + bw - goalbox_w, goalbox_y), (bx + bw, goalbox_y + goalbox_h), line_color, thickness)

    # 6. Elfmeterpunkte (11m -> 11/105 * bw)
    pen_x_left = bx + int(bw * 0.105)
    pen_x_right = bx + bw - int(bw * 0.105)
    cv2.circle(img, (pen_x_left, mid_y), 4, line_color, -1)
    cv2.circle(img, (pen_x_right, mid_y), 4, line_color, -1)

    # 7. Teilkreise am Strafraum (Elfmeterbogen)
    cv2.ellipse(img, (pen_x_left, mid_y), (center_r, center_r), 0, -50, 50, line_color, thickness)
    cv2.ellipse(img, (pen_x_right, mid_y), (center_r, center_r), 0, 130, 230, line_color, thickness)

    # 8. Tore (Netzkästen)
    goal_w = int(bw * 0.02)
    goal_h = int(bh * 0.15)
    goal_y = mid_y - goal_h // 2
    cv2.rectangle(img, (bx - goal_w, goal_y), (bx, goal_y + goal_h), (200, 200, 200), thickness)
    cv2.rectangle(img, (bx + bw, goal_y), (bx + bw + goal_w, goal_y + goal_h), (200, 200, 200), thickness)

    return (bx, by, bw, bh)

def generate_2d_pitch_heatmap_image(
    pitch_positions: List[Dict[str, float]], 
    output_image_path: str,
    width: int = 1050, 
    height: int = 680
) -> bool:
    """
    Generiert eine druckfertige oder web-optimierte 2D-Vogelperspektive-Heatmap
    mit gemustertem Rasen, offiziellen Spielfeldmarkierungen und Heatmap-Overlay.
    """
    if not pitch_positions:
        return False

    # 1. Basis-Rasen mit Streifenmuster anlegen
    img = np.zeros((height, width, 3), dtype=np.uint8)
    stripe_count = 10
    stripe_w = width // stripe_count
    c1 = (45, 128, 25) # Dunkleres Grün (BGR)
    c2 = (55, 150, 30) # Helleres Grün (BGR)
    for i in range(stripe_count):
        x1 = i * stripe_w
        x2 = width if i == stripe_count - 1 else (i + 1) * stripe_w
        color = c1 if i % 2 == 0 else c2
        cv2.rectangle(img, (x1, 0), (x2, height), color, -1)

    # 2. Begrenzung des Spielfelds ermitteln
    margin_x = int(width * 0.04)
    margin_y = int(height * 0.04)
    bw, bh = width - 2 * margin_x, height - 2 * margin_y

    # 3. Dichte-Akkumulator für Heatmap aufbauen
    density = np.zeros((height, width), dtype=np.float32)
    for pt in pitch_positions:
        px = int(margin_x + pt["x"] * bw)
        py = int(margin_y + pt["y"] * bh)
        if 0 <= px < width and 0 <= py < height:
            density[py, px] += 1.0

    # 4. Gaußscher Weichzeichner für kontinuierliche Heatmap-Glows
    sigma = int(width * 0.035)
    if sigma % 2 == 0:
        sigma += 1
    blurred = cv2.GaussianBlur(density, (sigma, sigma), 0)

    # 5. Normalisierung & Colormap
    max_val = np.max(blurred)
    if max_val > 0:
        norm_density = (blurred / max_val * 255.0).astype(np.uint8)
        heatmap_color = cv2.applyColorMap(norm_density, cv2.COLORMAP_JET)

        # Alpha-Blending: Bereiche mit geringer Dichte bleiben transparent
        alpha = (norm_density.astype(np.float32) / 255.0) * 0.75
        alpha = np.clip(alpha * 1.4, 0.0, 0.85)

        for c in range(3):
            img[:, :, c] = (1.0 - alpha) * img[:, :, c] + alpha * heatmap_color[:, :, c]

    # 6. Weiße Spielfeldlinien darüber zeichnen
    draw_2d_pitch_markings(img, line_color=(255, 255, 255), thickness=2)

    # 7. Speichern
    try:
        cv2.imwrite(output_image_path, img)
        return True
    except Exception as e:
        print(f"[Homography] Fehler beim Speichern der 2D-Heatmap: {e}")
        return False
