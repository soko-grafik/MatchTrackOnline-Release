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
from services.thumbnail_service import generate_thumbnail
from services.hls_service import generate_hls_playlist

# ==============================================================================
# Meow Audio Synchronization Engine (Cross-Correlation)
# ==============================================================================

def extract_audio_track(video_path: str, output_wav_path: str, duration_sec: int = 120) -> bool:
    """Extrahiert einen Mono-Audioschnitt (WAV 16kHz) für schnelle Kreuzkorrelation."""
    try:
        cmd = [
            FFMPEG_PATH, "-y",
            "-i", video_path,
            "-t", str(duration_sec),
            "-vn", "-ac", "1", "-ar", "16000",
            output_wav_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return os.path.exists(output_wav_path) and os.path.getsize(output_wav_path) > 1000
    except Exception as e:
        print(f"[MeowAudioSync] Error extracting audio from {video_path}: {e}")
        return False

def compute_audio_offset(video_left: str, video_right: str, temp_dir: str) -> int:
    """
    Berechnet den Zeitversatz (in ms) zwischen linkem und rechtem Video via Kreuzkorrelation (Meow AudioSynchronizer).
    Positiver Wert bedeutet: rechtes Video startet X ms nach dem linken Video.
    """
    try:
        from scipy.io import wavfile
        from scipy import signal
        
        wav_left = os.path.join(temp_dir, f"audio_l_{uuid.uuid4().hex[:6]}.wav")
        wav_right = os.path.join(temp_dir, f"audio_r_{uuid.uuid4().hex[:6]}.wav")
        
        ok_l = extract_audio_track(video_left, wav_left, duration_sec=90)
        ok_r = extract_audio_track(video_right, wav_right, duration_sec=90)
        
        if not ok_l or not ok_r:
            for f in [wav_left, wav_right]:
                if os.path.exists(f): os.remove(f)
            return 0
        
        sr_l, data_l = wavfile.read(wav_left)
        sr_r, data_r = wavfile.read(wav_right)
        
        data_l = data_l.astype(np.float32) - np.mean(data_l)
        data_r = data_r.astype(np.float32) - np.mean(data_r)
        
        if len(data_l) == 0 or len(data_r) == 0:
            return 0
            
        corr = signal.correlate(data_r, data_l, mode='full')
        lag = np.argmax(corr) - len(data_l) + 1
        
        offset_ms = int((lag / sr_l) * 1000)
        
        for f in [wav_left, wav_right]:
            if os.path.exists(f): os.remove(f)
            
        if abs(offset_ms) > 30000:
            print(f"[MeowAudioSync] Offset {offset_ms}ms beyond limit, fallback to 0ms.")
            return 0
            
        print(f"[MeowAudioSync] Calculated offset: {offset_ms} ms")
        return offset_ms
    except Exception as e:
        print(f"[MeowAudioSync] Fallback to 0ms due to error: {e}")
        return 0

# ==============================================================================
# Meow LIR (Largest Interior Rectangle) Algorithm
# ==============================================================================

def find_largest_interior_rectangle(binary_mask: np.ndarray) -> tuple:
    """
    Berechnet das größte einbeschriebene Rechteck (Largest Interior Rectangle, LIR)
    innerhalb der Panorama-Maske (eliminierte gekrümmte und schwarze Ränder aus Meow fast_stitching).
    Gibt (crop_x, crop_y, crop_w, crop_h) zurück.
    """
    h, w = binary_mask.shape[:2]
    scale = min(1.0, 480.0 / max(h, w))
    sh, sw = max(10, int(h * scale)), max(10, int(w * scale))
    small_mask = cv2.resize(binary_mask, (sw, sh), interpolation=cv2.INTER_NEAREST)
    if len(small_mask.shape) == 3:
        small_mask = cv2.cvtColor(small_mask, cv2.COLOR_BGR2GRAY)
    small_bin = (small_mask > 10).astype(np.int32)

    heights = np.zeros(sw, dtype=np.int32)
    max_area = 0
    best_rect = (0, 0, sw, sh)

    for r in range(sh):
        heights = np.where(small_bin[r] == 1, heights + 1, 0)
        stack = []
        for c in range(sw + 1):
            cur_h = heights[c] if c < sw else 0
            while stack and cur_h < heights[stack[-1]]:
                h_idx = stack.pop()
                rect_h = heights[h_idx]
                rect_w = c if not stack else c - stack[-1] - 1
                area = rect_h * rect_w
                if area > max_area:
                    max_area = area
                    best_rect = (stack[-1] + 1 if stack else 0, r - rect_h + 1, rect_w, rect_h)
            stack.append(c)

    bx, by, bw, bh = best_rect
    orig_x = max(0, int(bx / scale))
    orig_y = max(0, int(by / scale))
    orig_w = min(w - orig_x, int(bw / scale))
    orig_h = min(h - orig_y, int(bh / scale))
    
    if orig_w < w * 0.65 or orig_h < h * 0.65:
        return 0, 0, w, h
    return orig_x, orig_y, orig_w, orig_h

# ==============================================================================
# Meow Linsenkorrektur & Kamera-Ausrichtung (Pre-Alignment vor SIFT/Warping)
# ==============================================================================

def build_lens_undistort_maps(w: int, h: int, k1: float, k2: float = 0.0):
    """
    Baut Remap-Lookup-Tabellen für eine einfache radiale Linsenkorrektur - exakt dieselbe
    Formel wie web/components/FisheyeWebGLPreview.tsx (WebGL-Vorschau-Shader), damit die
    Live-Vorschau im Upload-Studio 1:1 dem tatsächlichen Stitching-Ergebnis entspricht:
    f(r) = 1 + k1*r^2 + k2*r^4; Ausgabepixel bei normierter Position `norm` liest die
    Quelle an `norm * f(r)`.
    Gibt None zurück, wenn keine Korrektur nötig ist (k1 und k2 ~ 0) - dann entstehen
    für unveränderte Uploads (Slider nie angefasst) keinerlei zusätzliche Kosten.
    """
    if abs(k1) < 1e-6 and abs(k2) < 1e-6:
        return None
    cx, cy = w / 2.0, h / 2.0
    xs, ys = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    nx, ny = (xs - cx) / cx, (ys - cy) / cy
    r2 = nx * nx + ny * ny
    f = 1.0 + k1 * r2 + k2 * r2 * r2
    map_x = (nx * f * cx + cx).astype(np.float32)
    map_y = (ny * f * cy + cy).astype(np.float32)
    return map_x, map_y


def apply_lens_undistort(frame: np.ndarray, maps) -> np.ndarray:
    """Wendet build_lens_undistort_maps() an; No-Op (gibt frame unverändert zurück), wenn maps None ist."""
    if maps is None:
        return frame
    map_x, map_y = maps
    return cv2.remap(frame, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def build_camera_transform_matrix(
    w: int,
    h: int,
    rotation_deg: float = 0.0,
    pitch_deg: float = 0.0,
    x_shift_px: float = 0.0,
    y_shift_px: float = 0.0,
    scale: float = 1.0
) -> np.ndarray:
    """
    Erstellt eine 3x3 Homographie / Transformationsmatrix für Vor-Ausrichtung der Kamera:
    - rotation_deg: Drehwinkel um Bildmittelpunkt (in Grad)
    - pitch_deg: Vertikale Trapez-/Perspektiv-Neigung (in Grad)
    - x_shift_px: Horizontaler Versatz (in Pixeln)
    - y_shift_px: Vertikaler Versatz (in Pixeln)
    - scale: Zoom / Skalierungsfaktor
    Gibt None zurück, wenn keine Transformation vorgenommen wird (Standardwerte).
    """
    if (abs(rotation_deg) < 1e-5 and
        abs(pitch_deg) < 1e-5 and
        abs(x_shift_px) < 1e-5 and
        abs(y_shift_px) < 1e-5 and
        abs(scale - 1.0) < 1e-5):
        return None

    cx = float(w) / 2.0
    cy = float(h) / 2.0

    T_to_origin = np.array([
        [1.0, 0.0, -cx],
        [0.0, 1.0, -cy],
        [0.0, 0.0, 1.0]
    ], dtype=np.float32)

    rad = float(np.deg2rad(rotation_deg))
    cos_r = float(np.cos(rad) * scale)
    sin_r = float(np.sin(rad) * scale)
    R = np.array([
        [cos_r, -sin_r, 0.0],
        [sin_r,  cos_r, 0.0],
        [0.0,    0.0,   1.0]
    ], dtype=np.float32)

    pitch_factor = float(np.tan(np.deg2rad(pitch_deg)) / max(1.0, float(h) * 1.5))
    P = np.array([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, pitch_factor, 1.0]
    ], dtype=np.float32)

    T_from_origin = np.array([
        [1.0, 0.0, cx + float(x_shift_px)],
        [0.0, 1.0, cy + float(y_shift_px)],
        [0.0, 0.0, 1.0]
    ], dtype=np.float32)

    M = T_from_origin @ P @ R @ T_to_origin
    return M.astype(np.float32)


def apply_camera_transform(frame: np.ndarray, transform_matrix: np.ndarray, w: int, h: int) -> np.ndarray:
    """Wendet Vor-Transformation (Rotation, Tilt/Pitch, Y-Shift, Scale) auf einen Frame an."""
    if transform_matrix is None or frame is None:
        return frame
    return cv2.warpPerspective(
        frame,
        transform_matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0
    )


# ==============================================================================
# Meow SIFT / RANSAC Feature Matching
# ==============================================================================

def find_sift_stitching_homography(
    cap_left: cv2.VideoCapture,
    cap_right: cv2.VideoCapture,
    sample_frames: int = 22,
    undistort_maps_l=None,
    undistort_maps_r=None,
    transform_m_l=None,
    transform_m_r=None,
    is_dji: bool = False
):
    """
    Meow-Style Automatic SIFT Feature Stitcher (robuste Variante).
    Sammelt SIFT-Korrespondenzen aus vielen Sample-Frames gepoolt (statt nur den
    einen best-scoring Frame zu behalten), maskiert bewegte Objekte (Spieler) vor
    dem Keypoint-Matching per Median-Hintergrundbild, löst die Homographie robust
    via USAC_MAGSAC und verwirft geometrisch unplausible Ergebnisse zugunsten des
    Translations-Fallbacks.
    Bei is_dji=True wird das SIFT-Suchfenster exakt auf die 33% Mittelüberlappung fokussiert.
    """
    try:
        finder = cv2.SIFT_create(nfeatures=4000)
        bf = cv2.BFMatcher(cv2.NORM_L2)
    except Exception:
        finder = cv2.ORB_create(nfeatures=4000)
        bf = cv2.BFMatcher(cv2.NORM_HAMMING)

    total_frames = int(min(cap_left.get(cv2.CAP_PROP_FRAME_COUNT), cap_right.get(cv2.CAP_PROP_FRAME_COUNT)))
    step = max(1, total_frames // (sample_frames + 1))

    frames_l, frames_r = [], []
    for i in range(1, sample_frames + 1):
        cap_left.set(cv2.CAP_PROP_POS_FRAMES, i * step)
        cap_right.set(cv2.CAP_PROP_POS_FRAMES, i * step)
        ret1, f1 = cap_left.read()
        ret2, f2 = cap_right.read()
        if not ret1 or not ret2:
            continue
        h_f, w_f = f1.shape[:2]
        f1_proc = apply_camera_transform(apply_lens_undistort(f1, undistort_maps_l), transform_m_l, w_f, h_f)
        f2_proc = apply_camera_transform(apply_lens_undistort(f2, undistort_maps_r), transform_m_r, w_f, h_f)
        frames_l.append(f1_proc)
        frames_r.append(f2_proc)

    cap_left.set(cv2.CAP_PROP_POS_FRAMES, 0)
    cap_right.set(cv2.CAP_PROP_POS_FRAMES, 0)

    def fallback_homography(w):
        return np.array([[1.0, 0.0, float(w * 0.80)], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], dtype=np.float32)

    if len(frames_l) < 3:
        print("[Meow] Not enough sample frames read, using fallback translation homography.")
        w = frames_l[0].shape[1] if frames_l else 1920
        return fallback_homography(w)

    h_ref, w_ref = frames_l[0].shape[:2]

    # Median-Hintergrundbild je Kameraseite über alle Samples: Spieler stehen selten
    # an derselben Stelle über weit auseinanderliegende Frames hinweg, das Median-Bild
    # ist daher näherungsweise der statische Hintergrund (Rasen, Linien, Torpfosten).
    median_l = np.median(np.stack(frames_l, axis=0), axis=0).astype(np.uint8)
    median_r = np.median(np.stack(frames_r, axis=0), axis=0).astype(np.uint8)

    def static_mask(frame, median):
        diff = cv2.cvtColor(cv2.absdiff(frame, median), cv2.COLOR_BGR2GRAY)
        _, moving = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        moving = cv2.dilate(moving, np.ones((9, 9), np.uint8), iterations=1)
        return cv2.bitwise_not(moving)

    pts1_all, pts2_all = [], []
    for f1, f2 in zip(frames_l, frames_r):
        # Bei DJI Action 4 fokussieren wir auf die 33%-40% Mittelzone
        overlap_frac = 0.50 if is_dji else 0.40
        x1 = int(f1.shape[1] * overlap_frac)
        x2 = int(f2.shape[1] * (1.0 - overlap_frac))

        gray1 = cv2.cvtColor(f1, cv2.COLOR_BGR2GRAY)[:, x1:]
        gray2 = cv2.cvtColor(f2, cv2.COLOR_BGR2GRAY)[:, :x2]
        mask1 = static_mask(f1, median_l)[:, x1:]
        mask2 = static_mask(f2, median_r)[:, :x2]

        kp1, des1 = finder.detectAndCompute(gray1, mask1)
        kp2, des2 = finder.detectAndCompute(gray2, mask2)
        if des1 is None or des2 is None or len(kp1) < 12 or len(kp2) < 12:
            continue

        matches = bf.knnMatch(des1, des2, k=2)
        good = [m for m, n in matches if m.distance < 0.75 * n.distance]
        if len(good) <= 8:
            continue

        pts1 = np.float32([kp1[m.queryIdx].pt for m in good]) + np.array([x1, 0])
        pts2 = np.float32([kp2[m.trainIdx].pt for m in good])
        pts1_all.append(pts1)
        pts2_all.append(pts2)

    if not pts1_all:
        print("[Meow] No usable correspondences found, using fallback translation homography.")
        return fallback_homography(w_ref)

    pts1_pool = np.concatenate(pts1_all, axis=0)
    pts2_pool = np.concatenate(pts2_all, axis=0)

    ransac_method = getattr(cv2, "USAC_MAGSAC", cv2.RANSAC)
    H, inlier_mask = cv2.findHomography(pts2_pool, pts1_pool, ransac_method, 3.0, maxIters=5000, confidence=0.995)

    inliers = int(np.sum(inlier_mask)) if inlier_mask is not None else 0
    inlier_ratio = inliers / max(1, len(pts1_pool))

    def homography_is_plausible(H, w, h):
        if H is None:
            return False
        try:
            svals = np.linalg.svd(H[0:2, 0:2], compute_uv=False)
            if svals[0] <= 0 or svals[1] <= 0 or svals.max() / svals.min() > 3.0:
                return False
            if not (0.8 <= svals[0] <= 1.25 and 0.8 <= svals[1] <= 1.25):
                return False
            corners = np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2)
            warped = cv2.perspectiveTransform(corners, H).reshape(-1, 2)
            if cv2.contourArea(warped.astype(np.float32)) <= 0:
                return False
            if len(cv2.convexHull(warped.astype(np.float32))) != 4:
                return False
            min_x = float(warped[:, 0].min())
            return 0.08 * w <= min_x <= 0.45 * w
        except Exception:
            return False

    accepted = H is not None and inliers >= 40 and inlier_ratio >= 0.4 and homography_is_plausible(H, w_ref, h_ref)

    if not accepted:
        print(f"[Meow] Homography rejected (inliers={inliers}, ratio={inlier_ratio:.2f}), using fallback translation homography.")
        H = fallback_homography(w_ref)
    else:
        print(f"[Meow] Homography accepted: {inliers} inliers, ratio={inlier_ratio:.2f} pooled across {len(pts1_all)} frames.")

    return H.astype(np.float32)

# ==============================================================================
# Meow Multi-Band Laplacian Pyramid Blending & Exposure Matching
# ==============================================================================

def compute_channel_gains(img1: np.ndarray, img2: np.ndarray, bg_mask: np.ndarray = None) -> np.ndarray:
    """
    Berechnet RGB-Verstärkungsfaktoren (Gains) zwischen den Überlappungsbereichen.
    Nutzt den Median statt des Mittelwerts (robust gegen einzelne auffällige
    Trikots/Ball/Schiri im Band) und kann optional auf eine Hintergrundmaske
    (gut ausgerichtete, wahrscheinlich statische Pixel) beschränkt werden, damit
    ein zufällig im Blend-Band stehender Spieler die Belichtungsschätzung nicht verzerrt.
    """
    if img1.size == 0 or img2.size == 0:
        return np.array([1.0, 1.0, 1.0], dtype=np.float32)

    px1 = img1.reshape(-1, 3)
    px2 = img2.reshape(-1, 3)

    if bg_mask is not None:
        flat_mask = bg_mask.reshape(-1)
        if flat_mask.shape[0] == px1.shape[0] and flat_mask.sum() >= max(50, int(0.05 * flat_mask.size)):
            px1 = px1[flat_mask]
            px2 = px2[flat_mask]

    m1 = np.median(px1.astype(np.float32), axis=0) + 1e-4
    m2 = np.median(px2.astype(np.float32), axis=0) + 1e-4
    gains = m1 / m2
    return np.clip(gains, 0.65, 1.55).astype(np.float32)


def compute_overlap_band(wm_l: np.ndarray, wm_r: np.ndarray, out_width: int, w_left: int, fallback_width_pct: float = 0.18) -> tuple:
    """
    Bestimmt Start und Breite des Blend-Bands aus dem tatsächlich gemessenen Overlap
    zweier gewarpter Kamera-Footprint-Masken (statt einer festen Breiten-Heuristik).
    Verhindert sowohl das Verblenden nicht-überlappender Inhalte (Ghosting) als auch
    einen harten Schnitt außerhalb des Bands (sichtbare Kante), weil beide Fehler
    entstehen, wenn die feste Heuristik vom tatsächlichen Overlap abweicht.
    """
    try:
        overlap = cv2.bitwise_and(wm_l, wm_r)
        if len(overlap.shape) == 3:
            overlap = cv2.cvtColor(overlap, cv2.COLOR_BGR2GRAY)
        h = overlap.shape[0]
        col_coverage = np.count_nonzero(overlap > 10, axis=0) / max(1, h)
        cols = np.where(col_coverage >= 0.9)[0]
        if len(cols) < 10:
            raise ValueError("degenerate overlap mask")

        blend_start = int(cols.min())
        blend_width = int(cols.max() - cols.min() + 1)

        min_w = max(10, int(w_left * 0.05))
        max_w = int(w_left * 0.35)
        blend_width = max(min_w, min(max_w, blend_width))
        blend_start = max(0, min(out_width - blend_width, blend_start))
        return blend_start, blend_width
    except Exception as e:
        print(f"[Meow] Overlap-band detection fallback: {e}")
        blend_start = max(10, min(w_left - 30, int(w_left * (1.0 - fallback_width_pct))))
        blend_width = max(10, min(w_left - blend_start, int(w_left * fallback_width_pct)))
        if blend_start + blend_width > out_width:
            blend_width = max(10, out_width - blend_start)
        return blend_start, blend_width


def compute_dp_seam_mask(strip_l: np.ndarray, strip_r: np.ndarray, prev_seam_frac: np.ndarray = None,
                          downscale: int = 8, feather_px: int = 7, temporal_lambda: float = 2.0):
    """
    Meow Dynamic-Seam Engine: berechnet pro Frame eine Naht innerhalb des Blend-Bands
    via vektorisierter Minimum-Error-Boundary-DP (Seam-Carving) auf einem stark
    verkleinerten Differenzbild zwischen den beiden Kamera-Strips. Ein Spieler, der
    die Naht kreuzt, wird so auf eine Kamera-Seite geroutet statt aus beiden Kameras
    hälftig überblendet zu werden - das ist der eigentliche Hebel gegen Ghosting,
    unabhängig von der Ausrichtungsgenauigkeit der Homographie.
    Ein temporaler Bias-Term hält die Naht zwischen Frames stabil, solange sich der
    Bildinhalt nicht wesentlich ändert, erlaubt ihr aber, einem echten Objekt zu folgen.

    Gibt (blend_mask, seam_frac, bg_mask_full) zurück:
    - blend_mask: pro-Frame-Gewichtsmaske (gleiche Form wie strip_l) für multiband_blend_strip
    - seam_frac: Naht-Position (0..1) je Zeile, als State für den temporalen Bias im nächsten Frame
    - bg_mask_full: Maske gut ausgerichteter (wahrscheinlich statischer) Pixel, fürs Gain-Matching
    """
    h, w = strip_l.shape[:2]
    feather_px = max(1, feather_px)

    if w < 4 or h < 4:
        mask = np.full((h, w, 3), 0.5, dtype=np.float32)
        return mask, prev_seam_frac, np.ones((h, w), dtype=bool)

    sh = max(4, h // downscale)
    sw = max(4, w // downscale)
    sm_l = cv2.resize(strip_l, (sw, sh), interpolation=cv2.INTER_AREA).astype(np.float32)
    sm_r = cv2.resize(strip_r, (sw, sh), interpolation=cv2.INTER_AREA).astype(np.float32)
    
    # Farbdifferenz
    diff = np.mean(np.abs(sm_l - sm_r), axis=2)

    # Kantendifferenz (Sobel Gradienten): Zwingt die Naht dazu, um Spielerkörper, Trikots
    # und Linien herumzuwandern, statt sie in der Mitte zu durchschneiden (Anti-Ghosting).
    grad_lx = np.abs(cv2.Sobel(sm_l, cv2.CV_32F, 1, 0))
    grad_ly = np.abs(cv2.Sobel(sm_l, cv2.CV_32F, 0, 1))
    grad_rx = np.abs(cv2.Sobel(sm_r, cv2.CV_32F, 1, 0))
    grad_ry = np.abs(cv2.Sobel(sm_r, cv2.CV_32F, 0, 1))
    edge_energy = (grad_lx + grad_ly + grad_rx + grad_ry).mean(axis=2)

    # Gesamtkosten für DP Seam-Routing (bevorzugt gleichmäßigen Rasenhintergrund)
    energy_map = diff * 2.0 + edge_energy * 0.4

    # Hintergrundmaske aus dem unverzerrten Diff (vor dem temporalen Bias), damit
    # das Gain-Matching gut ausgerichtete/statische Pixel bevorzugt.
    bg_small = diff <= np.percentile(diff, 60)
    bg_mask_full = cv2.resize(bg_small.astype(np.uint8) * 255, (w, h), interpolation=cv2.INTER_NEAREST) > 0

    diff_biased = energy_map
    if prev_seam_frac is not None and len(prev_seam_frac) == h:
        prev_small = cv2.resize(prev_seam_frac.reshape(-1, 1).astype(np.float32), (1, sh), interpolation=cv2.INTER_LINEAR).flatten()
        col_idx = np.arange(sw, dtype=np.float32)
        bias = temporal_lambda * np.abs(col_idx[None, :] - (prev_small[:, None] * (sw - 1)))
        diff_biased = energy_map + bias

    # Vektorisierte Seam-Carving-DP: minimaler Kostenpfad von der ersten zur letzten Zeile.
    cost = diff_biased.copy()
    buf_left = np.empty(sw, dtype=cost.dtype)
    buf_right = np.empty(sw, dtype=cost.dtype)
    for r in range(1, sh):
        up = cost[r - 1]
        buf_left[0] = np.inf
        buf_left[1:] = up[:-1]
        buf_right[-1] = np.inf
        buf_right[:-1] = up[1:]
        cost[r] = diff_biased[r] + np.minimum(np.minimum(buf_left, up), buf_right)

    seam_cols_small = np.zeros(sh, dtype=np.int32)
    seam_cols_small[-1] = int(np.argmin(cost[-1]))
    for r in range(sh - 2, -1, -1):
        c = seam_cols_small[r + 1]
        c0, c1 = max(0, c - 1), min(sw - 1, c + 1)
        seam_cols_small[r] = c0 + int(np.argmin(cost[r, c0:c1 + 1]))

    seam_frac_small = seam_cols_small.astype(np.float32) / max(1, sw - 1)
    seam_frac = cv2.resize(seam_frac_small.reshape(-1, 1), (1, h), interpolation=cv2.INTER_LINEAR).flatten()

    seam_col_full = np.clip(seam_frac * (w - 1), 0, w - 1)[:, None]
    col_idx_full = np.arange(w, dtype=np.float32)[None, :]
    dist = col_idx_full - seam_col_full
    # Feine Anti-Aliasing Kante (keine 50px-Geisterüberlagerung mehr)
    alpha_l = np.clip(0.5 - dist / (2.0 * feather_px), 0.0, 1.0)

    blend_mask = np.dstack([alpha_l] * 3).astype(np.float32)
    return blend_mask, seam_frac, bg_mask_full

def multiband_blend_strip(img_l: np.ndarray, img_r: np.ndarray, mask: np.ndarray, levels: int = 1) -> np.ndarray:
    """
    Führt ein scharfes Anti-Ghosting Seam-Blending über dem Naht-Streifen aus.
    Verhindert halbtransparente Geisterspieler durch direkte Seam-Maskierung
    mit sanftem 2-3px Subpixel-Anti-Aliasing.
    """
    blended = img_l.astype(np.float32) * mask + img_r.astype(np.float32) * (1.0 - mask)
    return np.clip(blended, 0, 255).astype(np.uint8)


def meow_panorama_stitching(
    job_id: str,
    left_path: str,
    right_path: str,
    offset_ms: int,
    output_panorama_path: str,
    use_lir: bool = True,
    output_fps: int = 30,
    progress_callback=None,
    left_lens_k1: float = 0.0,
    right_lens_k1: float = 0.0,
    left_rotation: float = 0.0,
    right_rotation: float = 0.0,
    left_pitch: float = 0.0,
    right_pitch: float = 0.0,
    left_x_shift: float = 0.0,
    right_x_shift: float = 0.0,
    left_y_shift: float = 0.0,
    right_y_shift: float = 0.0,
    left_scale: float = 1.0,
    right_scale: float = 1.0,
    is_dji: bool = False
) -> bool:
    """
    Meow Panorama Stitching Engine (`panoramaStitching` / `djiAction4Stitching`).
    Verwendet SIFT 4000 Keypoint-Matching + Lowe's Ratio RANSAC Homographie +
    Laplacian Multi-Band Spline Blending + optionalen LIR (Largest Interior Rectangle) Auto-Beschnitt.
    `left_lens_k1`/`right_lens_k1` korrigieren Objektivverzerrung je Kamera VOR SIFT und
    Warping. `left_rotation`/`right_rotation`, `left_pitch`/`right_pitch`, `left_x_shift`/`right_x_shift`, etc. erlauben
    eine präzise manuelle Vor-Ausrichtung der Kameras.
    """
    cap_left = cv2.VideoCapture(left_path)
    cap_right = cv2.VideoCapture(right_path)
    
    if not cap_left.isOpened() or not cap_right.isOpened():
        print("[MeowStitch] Failed to open input video streams")
        return False
        
    fps = cap_left.get(cv2.CAP_PROP_FPS) or float(output_fps)
    w_left = int(cap_left.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    h_left = int(cap_left.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
    
    total_frames_left = int(cap_left.get(cv2.CAP_PROP_FRAME_COUNT))
    total_frames_right = int(cap_right.get(cv2.CAP_PROP_FRAME_COUNT))
    max_frames = min(total_frames_left, total_frames_right)
    
    offset_frames = int((offset_ms / 1000.0) * fps)
    if offset_frames > 0:
        cap_right.set(cv2.CAP_PROP_POS_FRAMES, offset_frames)
    elif offset_frames < 0:
        cap_left.set(cv2.CAP_PROP_POS_FRAMES, abs(offset_frames))
        
    out_width = int(w_left * 2)
    out_height = h_left

    # Linsenkorrektur-Maps & Kamera-Ausrichtungsmatrizen bauen
    undistort_maps_l = build_lens_undistort_maps(w_left, h_left, left_lens_k1)
    undistort_maps_r = build_lens_undistort_maps(w_left, h_left, right_lens_k1)
    transform_m_l = build_camera_transform_matrix(w_left, h_left, left_rotation, left_pitch, left_x_shift, left_y_shift, left_scale)
    transform_m_r = build_camera_transform_matrix(w_left, h_left, right_rotation, right_pitch, right_x_shift, right_y_shift, right_scale)

    if progress_callback and (undistort_maps_l is not None or undistort_maps_r is not None or transform_m_l is not None or transform_m_r is not None):
        progress_callback(13.0, f"🔍 Meow Kamera-Ausrichtung aktiv: L(k1={left_lens_k1:.2f}, rot={left_rotation:.1f}°, pitch={left_pitch:.1f}°, x={left_x_shift:.0f}, y={left_y_shift:.0f}) | R(k1={right_lens_k1:.2f}, rot={right_rotation:.1f}°, pitch={right_pitch:.1f}°, x={right_x_shift:.0f}, y={right_y_shift:.0f})")

    if progress_callback:
        progress_callback(14.0, "🤖 Meow SIFT Feature Detection & Homographie-Schätzung (gepoolt, bewegungsmaskiert)...")

    H_right = find_sift_stitching_homography(
        cap_left, cap_right, sample_frames=22,
        undistort_maps_l=undistort_maps_l, undistort_maps_r=undistort_maps_r,
        transform_m_l=transform_m_l, transform_m_r=transform_m_r,
        is_dji=is_dji
    )

    # Gewarpte Footprint-Masken einmalig berechnen
    m_l_undist = apply_lens_undistort(np.ones((h_left, w_left), dtype=np.uint8) * 255, undistort_maps_l)
    m_l = apply_camera_transform(m_l_undist, transform_m_l, w_left, h_left)

    m_r_undist = apply_lens_undistort(np.ones((h_left, w_left), dtype=np.uint8) * 255, undistort_maps_r)
    m_r = apply_camera_transform(m_r_undist, transform_m_r, w_left, h_left)

    wm_l = np.pad(m_l, ((0, 0), (0, out_width - w_left)))
    wm_r = cv2.warpPerspective(m_r, H_right, (out_width, out_height))

    blend_start, blend_width = compute_overlap_band(wm_l, wm_r, out_width, w_left)
    blend_feather_px = max(2, min(4, int(w_left * 0.002)))

    if progress_callback:
        progress_callback(15.0, f"📏 Meow Overlap-Band erkannt: Start={blend_start}px, Breite={blend_width}px (Anti-Ghosting aktiv)")

    crop_x, crop_y, crop_w, crop_h = 0, 0, out_width, out_height
    if use_lir:
        try:
            full_mask = cv2.bitwise_or(wm_l, wm_r)
            crop_x, crop_y, crop_w, crop_h = find_largest_interior_rectangle(full_mask)
            crop_w = crop_w - (crop_w % 2)
            crop_h = crop_h - (crop_h % 2)
            if progress_callback and (crop_w < out_width or crop_h < out_height):
                progress_callback(16.0, f"📐 Meow LIR Auto-Crop aktiv: {crop_w}x{crop_h} (Randlos)")
        except Exception as e:
            print(f"[MeowLIR] Fallback: {e}")
            crop_x, crop_y, crop_w, crop_h = 0, 0, out_width, out_height

    processed = 0
    report_interval = max(30, int(fps * 4))

    cmd = [
        FFMPEG_PATH, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{crop_w}x{crop_h}",
        "-pix_fmt", "bgr24",
        "-r", str(output_fps or fps),
        "-i", "-",
        "-i", left_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "aac", "-b:a", "128k",
        "-map", "0:v:0", "-map", "1:a:0?",
        "-shortest",
        output_panorama_path
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    gains = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    prev_seam_frac = None

    while True:
        ret1, f_left = cap_left.read()
        ret2, f_right = cap_right.read()
        if not ret1 or not ret2:
            break

        f_left = apply_camera_transform(apply_lens_undistort(f_left, undistort_maps_l), transform_m_l, w_left, h_left)
        f_right = apply_camera_transform(apply_lens_undistort(f_right, undistort_maps_r), transform_m_r, w_left, h_left)

        warped_left = np.zeros((out_height, out_width, 3), dtype=np.uint8)
        warped_left[0:h_left, 0:w_left] = f_left

        warped_right = cv2.warpPerspective(f_right, H_right, (out_width, out_height))

        # Naht pro Frame auf Basis des (noch nicht final gain-korrigierten) Bandes bestimmen -
        # eine grobe Vorschau-Korrektur mit den aktuellen Gains hält den Struktur-Diff frei von
        # reinem Belichtungsunterschied, ohne dass die Gain-Aktualisierung selbst davon abhängt.
        strip_l = warped_left[0:h_left, blend_start:blend_start+blend_width]
        strip_r_raw = warped_right[0:h_left, blend_start:blend_start+blend_width]
        strip_r_preview = np.clip(strip_r_raw.astype(np.float32) * gains, 0, 255).astype(np.uint8)

        dynamic_mask, prev_seam_frac, bg_mask = compute_dp_seam_mask(
            strip_l, strip_r_preview, prev_seam_frac=prev_seam_frac,
            downscale=8, feather_px=blend_feather_px
        )

        if processed % 15 == 0:
            target_gains = compute_channel_gains(strip_l, strip_r_raw, bg_mask=bg_mask)
            gains = gains * 0.85 + target_gains * 0.15
        warped_right = np.clip(warped_right.astype(np.float32) * gains, 0, 255).astype(np.uint8)

        stitched = warped_right.copy()
        stitched[0:h_left, 0:blend_start] = warped_left[0:h_left, 0:blend_start]

        left_strip = warped_left[0:h_left, blend_start:blend_start+blend_width]
        right_strip = warped_right[0:h_left, blend_start:blend_start+blend_width]

        if left_strip.shape == dynamic_mask.shape and right_strip.shape == dynamic_mask.shape:
            try:
                blended_strip = multiband_blend_strip(left_strip, right_strip, dynamic_mask, levels=3)
                if blended_strip is not None:
                    stitched[0:h_left, blend_start:blend_start+blend_width] = blended_strip
                else:
                    stitched[0:h_left, blend_start:blend_start+blend_width] = (left_strip.astype(np.float32) * dynamic_mask + right_strip.astype(np.float32) * (1.0 - dynamic_mask)).astype(np.uint8)
            except Exception:
                stitched[0:h_left, blend_start:blend_start+blend_width] = (left_strip.astype(np.float32) * dynamic_mask + right_strip.astype(np.float32) * (1.0 - dynamic_mask)).astype(np.uint8)
        else:
            min_w = min(left_strip.shape[1], right_strip.shape[1], dynamic_mask.shape[1])
            sub_mask = dynamic_mask[:, :min_w]
            blended_strip = (left_strip[:, :min_w].astype(np.float32) * sub_mask + right_strip[:, :min_w].astype(np.float32) * (1.0 - sub_mask)).astype(np.uint8)
            stitched[0:h_left, blend_start:blend_start+min_w] = blended_strip

        if use_lir and (crop_w < out_width or crop_h < out_height):
            out_frame = stitched[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
        else:
            out_frame = stitched

        try:
            proc.stdin.write(out_frame.tobytes())
        except Exception:
            break

        processed += 1
        if progress_callback and (processed % report_interval == 0):
            perc = min(45.0, 15.0 + (processed / max_frames) * 30.0)
            progress_callback(perc, f"Meow Panorama 32:9: Frame {processed}/{max_frames} ({int(processed/max_frames*100)}%)...")

    cap_left.release()
    cap_right.release()
    try:
        proc.stdin.close()
        proc.wait()
    except Exception:
        pass

    return os.path.exists(output_panorama_path) and os.path.getsize(output_panorama_path) > 10000


# ==============================================================================
# Meow Engine 2: Farneback Optical-Flow KI-Kameramixer (16:9 Broadcast)
# ==============================================================================

def meow_optical_flow_mixer(
    job_id: str,
    left_path: str,
    right_path: str,
    offset_ms: int,
    output_broadcast_path: str,
    output_fps: int = 30,
    progress_callback=None
) -> bool:
    """
    Meow Optical-Flow Kameramixer (`opticalFlowMixer`).
    Analysiert Spielerballung und -bewegung via Farneback Optical Flow
    und führt eine sanfte 16:9 TV-Kameraführung aus.
    """
    cap_left = cv2.VideoCapture(left_path)
    cap_right = cv2.VideoCapture(right_path)
    if not cap_left.isOpened() or not cap_right.isOpened():
        return False

    fps = cap_left.get(cv2.CAP_PROP_FPS) or float(output_fps)
    w = int(cap_left.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    h = int(cap_left.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
    total_frames = min(int(cap_left.get(cv2.CAP_PROP_FRAME_COUNT)), int(cap_right.get(cv2.CAP_PROP_FRAME_COUNT)))

    offset_frames = int((offset_ms / 1000.0) * fps)
    if offset_frames > 0:
        cap_right.set(cv2.CAP_PROP_POS_FRAMES, offset_frames)
    elif offset_frames < 0:
        cap_left.set(cv2.CAP_PROP_POS_FRAMES, abs(offset_frames))

    cmd = [
        FFMPEG_PATH, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{w}x{h}",
        "-pix_fmt", "bgr24",
        "-r", str(output_fps or fps),
        "-i", "-",
        "-i", left_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k",
        "-map", "0:v:0", "-map", "1:a:0?",
        "-shortest",
        output_broadcast_path
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    prev_gray_l, prev_gray_r = None, None
    smooth_target = 0.5
    processed = 0
    report_interval = max(30, int(fps * 4))

    while True:
        ret1, f_left = cap_left.read()
        ret2, f_right = cap_right.read()
        if not ret1 or not ret2:
            break

        if processed % 3 == 0:
            gray_l = cv2.cvtColor(cv2.resize(f_left, (320, 180)), cv2.COLOR_BGR2GRAY)
            gray_r = cv2.cvtColor(cv2.resize(f_right, (320, 180)), cv2.COLOR_BGR2GRAY)

            if prev_gray_l is not None and prev_gray_r is not None:
                flow_l = cv2.calcOpticalFlowFarneback(prev_gray_l, gray_l, None, 0.5, 2, 10, 2, 5, 1.1, 0)
                flow_r = cv2.calcOpticalFlowFarneback(prev_gray_r, gray_r, None, 0.5, 2, 10, 2, 5, 1.1, 0)

                mag_l = np.sqrt(flow_l[..., 0]**2 + flow_l[..., 1]**2)
                mag_r = np.sqrt(flow_r[..., 0]**2 + flow_r[..., 1]**2)

                _, mask_l = cv2.threshold(gray_l, int(np.mean(gray_l) + 0.8 * np.std(gray_l)), 255, cv2.THRESH_BINARY)
                _, mask_r = cv2.threshold(gray_r, int(np.mean(gray_r) + 0.8 * np.std(gray_r)), 255, cv2.THRESH_BINARY)

                score_l = 0.7 * np.sum(mag_l) + 0.3 * (np.sum(mask_l) / 255.0)
                score_r = 0.7 * np.sum(mag_r) + 0.3 * (np.sum(mask_r) / 255.0)

                total_score = score_l + score_r + 1e-4
                raw_ratio = score_r / total_score
                smooth_target = smooth_target * 0.90 + raw_ratio * 0.10

            prev_gray_l = gray_l
            prev_gray_r = gray_r

        if smooth_target < 0.40:
            out_frame = f_left
        elif smooth_target > 0.60:
            out_frame = f_right
        else:
            alpha = (smooth_target - 0.40) / 0.20
            out_frame = cv2.addWeighted(f_left, float(1.0 - alpha), f_right, float(alpha), 0.0)

        try:
            proc.stdin.write(out_frame.tobytes())
        except Exception:
            break

        processed += 1
        if progress_callback and (processed % report_interval == 0):
            perc = min(45.0, 15.0 + (processed / total_frames) * 30.0)
            side_txt = "Links" if smooth_target < 0.42 else ("Rechts" if smooth_target > 0.58 else "Mitte (Überblendung)")
            progress_callback(perc, f"Meow KI-Mixer 16:9: Frame {processed}/{total_frames} ({int(processed/total_frames*100)}%) - Fokus: {side_txt}")

    cap_left.release()
    cap_right.release()
    try:
        proc.stdin.close()
        proc.wait()
    except Exception:
        pass

    return os.path.exists(output_broadcast_path) and os.path.getsize(output_broadcast_path) > 10000


# ==============================================================================
# Meow Engine 3: Absolute Difference Mixer
# ==============================================================================

def meow_abs_diff_mixer(
    job_id: str,
    left_path: str,
    right_path: str,
    offset_ms: int,
    output_broadcast_path: str,
    output_fps: int = 30,
    progress_callback=None
) -> bool:
    """
    Meow Absolute Difference Mixer (`absDiffMixer`).
    Verwendet Frame-Differenzierung zur schnellen Bewegungsdetektion.
    """
    cap_left = cv2.VideoCapture(left_path)
    cap_right = cv2.VideoCapture(right_path)
    if not cap_left.isOpened() or not cap_right.isOpened():
        return False

    fps = cap_left.get(cv2.CAP_PROP_FPS) or float(output_fps)
    w = int(cap_left.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    h = int(cap_left.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080

    offset_frames = int((offset_ms / 1000.0) * fps)
    if offset_frames > 0:
        cap_right.set(cv2.CAP_PROP_POS_FRAMES, offset_frames)
    elif offset_frames < 0:
        cap_left.set(cv2.CAP_PROP_POS_FRAMES, abs(offset_frames))

    cmd = [
        FFMPEG_PATH, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{w}x{h}",
        "-pix_fmt", "bgr24",
        "-r", str(output_fps or fps),
        "-i", "-",
        "-i", left_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k",
        "-map", "0:v:0", "-map", "1:a:0?",
        "-shortest",
        output_broadcast_path
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    prev_l, prev_r = None, None
    smooth_target = 0.5
    processed = 0

    while True:
        ret1, f_left = cap_left.read()
        ret2, f_right = cap_right.read()
        if not ret1 or not ret2: break

        if processed % 2 == 0:
            gray_l = cv2.cvtColor(cv2.resize(f_left, (320, 180)), cv2.COLOR_BGR2GRAY)
            gray_r = cv2.cvtColor(cv2.resize(f_right, (320, 180)), cv2.COLOR_BGR2GRAY)
            if prev_l is not None and prev_r is not None:
                diff_l = np.sum(cv2.absdiff(prev_l, gray_l))
                diff_r = np.sum(cv2.absdiff(prev_r, gray_r))
                ratio = diff_r / (diff_l + diff_r + 1e-4)
                smooth_target = smooth_target * 0.88 + ratio * 0.12
            prev_l, prev_r = gray_l, gray_r

        if smooth_target < 0.42:
            out_frame = f_left
        elif smooth_target > 0.58:
            out_frame = f_right
        else:
            alpha = (smooth_target - 0.42) / 0.16
            out_frame = cv2.addWeighted(f_left, float(1.0 - alpha), f_right, float(alpha), 0.0)

        try:
            proc.stdin.write(out_frame.tobytes())
        except Exception:
            break

        processed += 1

    cap_left.release()
    cap_right.release()
    try:
        proc.stdin.close()
        proc.wait()
    except Exception:
        pass
    return os.path.exists(output_broadcast_path) and os.path.getsize(output_broadcast_path) > 10000

# ==============================================================================
# Meow Main Dispatcher
# ==============================================================================

def stitch_video_to_panorama(
    job_id: str,
    left_path: str,
    right_path: str,
    offset_ms: int,
    output_panorama_path: str,
    progress_callback=None,
    manual_alignment: dict = None
) -> bool:
    """
    Zentraler Meow-Dispatcher.
    Unterstützt alle Meow-Verarbeitungsarten:
    - "panoramaStitching" (Standard: SIFT + Multi-Band Spline + LIR-Beschnitt)
    - "opticalFlowMixer" / "meow_mixer" (Farnebäck Optical Flow 16:9 Broadcast)
    - "absDiffMixer" (Bewegungsdifferenz-Mixer)
    """
    settings = manual_alignment or {}
    mode = str(settings.get("video_processing_type", settings.get("engine", "panoramaStitching")))
    use_lir = bool(settings.get("use_lir", settings.get("use_lir_crop", True)))
    output_fps = int(settings.get("video_output_fps", 30))
    left_lens_k1 = float(settings.get("left_lens_k1", 0.0) or 0.0)
    right_lens_k1 = float(settings.get("right_lens_k1", 0.0) or 0.0)
    left_rotation = float(settings.get("left_rotation", 0.0) or 0.0)
    right_rotation = float(settings.get("right_rotation", 0.0) or 0.0)
    left_pitch = float(settings.get("left_pitch", settings.get("left_tilt", 0.0)) or 0.0)
    right_pitch = float(settings.get("right_pitch", settings.get("right_tilt", 0.0)) or 0.0)
    left_x_shift = float(settings.get("left_x_shift", settings.get("left_offset_x", 0.0)) or 0.0)
    right_x_shift = float(settings.get("right_x_shift", settings.get("right_offset_x", 0.0)) or 0.0)
    left_y_shift = float(settings.get("left_y_shift", settings.get("left_offset_y", 0.0)) or 0.0)
    right_y_shift = float(settings.get("right_y_shift", settings.get("right_offset_y", 0.0)) or 0.0)
    left_scale = float(settings.get("left_scale", 1.0) or 1.0)
    right_scale = float(settings.get("right_scale", 1.0) or 1.0)

    if mode in ["opticalFlowMixer", "meow_mixer"]:
        if progress_callback:
            progress_callback(15.0, "🎥 Starte Meow KI-Kameramixer (Farnebäck Optical Flow 16:9)...")
        return meow_optical_flow_mixer(
            job_id, left_path, right_path, offset_ms, output_panorama_path, output_fps=output_fps, progress_callback=progress_callback
        )
    elif mode in ["absDiffMixer"]:
        if progress_callback:
            progress_callback(15.0, "⚡ Starte Meow Absolute Difference Mixer...")
        return meow_abs_diff_mixer(
            job_id, left_path, right_path, offset_ms, output_panorama_path, output_fps=output_fps, progress_callback=progress_callback
        )
    elif mode in ["djiAction4Stitching", "dji_action4"]:
        if progress_callback:
            progress_callback(15.0, "🎯 Starte DJI Action 4 Dual-Rig Stitching (120° Wide / 80° Winkel / 4m Mast)...")
        return meow_panorama_stitching(
            job_id, left_path, right_path, offset_ms, output_panorama_path, use_lir=use_lir, output_fps=output_fps, progress_callback=progress_callback,
            left_lens_k1=left_lens_k1, right_lens_k1=right_lens_k1,
            left_rotation=left_rotation, right_rotation=right_rotation,
            left_pitch=left_pitch, right_pitch=right_pitch,
            left_x_shift=left_x_shift, right_x_shift=right_x_shift,
            left_y_shift=left_y_shift, right_y_shift=right_y_shift,
            left_scale=left_scale, right_scale=right_scale,
            is_dji=True
        )
    elif mode in ["djiActionStandardStitching", "dji_action_standard"]:
        if progress_callback:
            progress_callback(15.0, "🎯 Starte DJI Action Standard-Rig Stitching (110°-115° Dewarp / 80° Winkel / 4m Mast)...")
        return meow_panorama_stitching(
            job_id, left_path, right_path, offset_ms, output_panorama_path, use_lir=use_lir, output_fps=output_fps, progress_callback=progress_callback,
            left_lens_k1=left_lens_k1, right_lens_k1=right_lens_k1,
            left_rotation=left_rotation, right_rotation=right_rotation,
            left_pitch=left_pitch, right_pitch=right_pitch,
            left_x_shift=left_x_shift, right_x_shift=right_x_shift,
            left_y_shift=left_y_shift, right_y_shift=right_y_shift,
            left_scale=left_scale, right_scale=right_scale,
            is_dji=True
        )
    else:
        if progress_callback:
            progress_callback(15.0, "🏟️ Starte Meow Panorama Stitching (SIFT & LIR)...")
        return meow_panorama_stitching(
            job_id, left_path, right_path, offset_ms, output_panorama_path, use_lir=use_lir, output_fps=output_fps, progress_callback=progress_callback,
            left_lens_k1=left_lens_k1, right_lens_k1=right_lens_k1,
            left_rotation=left_rotation, right_rotation=right_rotation,
            left_pitch=left_pitch, right_pitch=right_pitch,
            left_x_shift=left_x_shift, right_x_shift=right_x_shift,
            left_y_shift=left_y_shift, right_y_shift=right_y_shift,
            left_scale=left_scale, right_scale=right_scale,
            is_dji=False
        )

# ==============================================================================
# YOLOv8 Highlight-Erkennung & Dynamic Reframing (MatchTrack KI)
# ==============================================================================

def process_tracking_and_reframing(
    job_id: str,
    panorama_path: str,
    broadcast_path: str,
    output_mode: str = "DYNAMIC_16_9",
    detect_events_auto: bool = True,
    progress_callback=None
):
    """
    Führt YOLOv8 Person/Ball-Tracking auf dem 32:9 Master-Panorama aus
    und rendert die 16:9 TV-Kameraführung sowie automatische Event-Erkennung.
    """
    from services.tracker_service import process_tracking_and_reframing as ptr
    return ptr(
        job_id=job_id,
        master_panorama_path=panorama_path,
        output_16_9_path=broadcast_path,
        output_mode=output_mode,
        detect_events_auto=detect_events_auto,
        progress_callback=progress_callback
    )
