import os
import sys
import time
import math
import wave
import struct
import tempfile
import subprocess
import urllib.request
from typing import Dict, Any, Tuple, Optional

def _check_source_available(url: str, timeout: float = 1.0) -> bool:
    """Prüft, ob eine Streamquelle erreichbar ist."""
    if url.startswith("http://") or url.startswith("https://"):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.status == 200
        except Exception:
            return False
    # Für RTMP nehmen wir an, dass der Port 1935 lauscht, wenn MediaMTX läuft
    return True

def _get_stream_sources() -> Tuple[str, str]:
    """
    Ermittelt die besten Stream-Quellen für Cam 1 und Cam 2.
    Bevorzugt RTMP für verzögerungsfreie Live-Pakete, sonst HLS.
    """
    # Standard MediaMTX RTMP Ports
    rtmp_cam1 = "rtmp://127.0.0.1:1935/live/cam1"
    rtmp_cam2 = "rtmp://127.0.0.1:1935/live/cam2"

    # HLS Fallback
    hls_cam1 = "http://127.0.0.1:8888/live/cam1/index.m3u8"
    hls_cam2 = "http://127.0.0.1:8888/live/cam2/index.m3u8"

    # Wenn HLS erreichbar ist, nutzen wir RTMP oder HLS
    cam1_src = rtmp_cam1
    cam2_src = rtmp_cam2

    return cam1_src, cam2_src

def compute_audio_cross_correlation(s1: list, s2: list, sample_rate: int = 8000, max_search_ms: int = 2500) -> Tuple[int, float]:
    """
    Berechnet den zeitlichen Versatz (in Millisekunden) zwischen zwei Audiosignalen
    mittels Kreuzkorrelation.
    Positive Rückgabe (+ms) bedeutet: Signal 2 kommt später an (Cam 2 hat Verzögerung).
    Negative Rückgabe (-ms) bedeutet: Signal 1 kommt später an (Cam 1 hat Verzögerung).
    """
    # Downsampling auf 1000 Hz für 1ms Genauigkeit und hohe Rechengeschwindigkeit
    ds = max(1, sample_rate // 1000)
    a1 = s1[::ds]
    a2 = s2[::ds]

    if not a1 or not a2:
        return 0, 0.0

    # DC-Offset entfernen (Mittelwert abziehen)
    m1 = sum(a1) / len(a1)
    m2 = sum(a2) / len(a2)
    a1 = [float(x - m1) for x in a1]
    a2 = [float(x - m2) for x in a2]

    N = min(len(a1), len(a2))
    a1 = a1[:N]
    a2 = a2[:N]

    max_lag = min(max_search_ms, N // 2)

    # 1. Schnelle Berechnung via numpy, falls installiert
    try:
        import numpy as np
        na1 = np.array(a1, dtype=np.float32)
        na2 = np.array(a2, dtype=np.float32)

        # Kreuzkorrelation von na2 gegen na1
        corr = np.correlate(na2, na1, mode="full")
        lags = np.arange(-len(na1) + 1, len(na2))

        mask = (lags >= -max_lag) & (lags <= max_lag)
        valid_lags = lags[mask]
        valid_corr = corr[mask]

        best_idx = int(np.argmax(valid_corr))
        best_lag = int(valid_lags[best_idx])
        
        peak_val = float(valid_corr[best_idx])
        mean_val = float(np.mean(valid_corr))
        std_val = float(np.std(valid_corr)) + 1e-6
        confidence = float(min(1.0, max(0.0, (peak_val - mean_val) / (std_val * 4.0))))
        return best_lag, confidence
    except ImportError:
        pass

    # 2. Reines Python-Fallback: Coarse-to-Fine Kreuzkorrelation
    # Grobsuche: Schrittweite 10ms
    best_corr = -1e20
    best_coarse_lag = 0
    corrs = []

    for lag in range(-max_lag, max_lag + 1, 10):
        if lag >= 0:
            c = sum(x * y for x, y in zip(a1[:N - lag], a2[lag:]))
        else:
            c = sum(x * y for x, y in zip(a1[-lag:], a2[:N + lag]))
        corrs.append(c)
        if c > best_corr:
            best_corr = c
            best_coarse_lag = lag

    # Feinsuche: Schrittweite 1ms im Bereich +/- 15ms um den besten Grobwert
    fine_start = max(-max_lag, best_coarse_lag - 15)
    fine_end = min(max_lag, best_coarse_lag + 15)
    best_fine_lag = best_coarse_lag

    for lag in range(fine_start, fine_end + 1):
        if lag >= 0:
            c = sum(x * y for x, y in zip(a1[:N - lag], a2[lag:]))
        else:
            c = sum(x * y for x, y in zip(a1[-lag:], a2[:N + lag]))
        if c > best_corr:
            best_corr = c
            best_fine_lag = lag

    # Konfidenz abschätzen
    if corrs:
        mean_c = sum(corrs) / len(corrs)
        variance = sum((c - mean_c) ** 2 for c in corrs) / len(corrs)
        std_c = math.sqrt(variance) + 1e-6
        confidence = min(1.0, max(0.0, (best_corr - mean_c) / (std_c * 4.0)))
    else:
        confidence = 0.5

    return best_fine_lag, confidence

def detect_audio_sync_offset(duration_sec: float = 6.0, cam1_url: Optional[str] = None, cam2_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Nimmt zeitgleich kurze Audio-Schnipsel von Cam 1 und Cam 2 auf und berechnet
    den exakten Zeitversatz zur automatischen Synchronisation.
    """
    if not cam1_url or not cam2_url:
        c1, c2 = _get_stream_sources()
        cam1_url = cam1_url or c1
        cam2_url = cam2_url or c2

    temp_dir = tempfile.gettempdir()
    path1 = os.path.join(temp_dir, f"matchtrack_sync_cam1_{int(time.time()*1000)}.wav")
    path2 = os.path.join(temp_dir, f"matchtrack_sync_cam2_{int(time.time()*1000)}.wav")

    cmd1 = [
        "ffmpeg", "-nostdin", "-y",
        "-t", str(int(duration_sec)),
        "-i", cam1_url,
        "-vn", "-ac", "1", "-ar", "8000",
        "-f", "wav", path1
    ]
    cmd2 = [
        "ffmpeg", "-nostdin", "-y",
        "-t", str(int(duration_sec)),
        "-i", cam2_url,
        "-vn", "-ac", "1", "-ar", "8000",
        "-f", "wav", path2
    ]

    try:
        # Beide FFmpeg-Prozesse möglichst zeitsynchron starten
        p1 = subprocess.Popen(cmd1, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        p2 = subprocess.Popen(cmd2, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        try:
            p1.wait(timeout=duration_sec + 4.0)
            p2.wait(timeout=duration_sec + 4.0)
        except subprocess.TimeoutExpired:
            p1.kill()
            p2.kill()
            return {
                "success": False,
                "message": "Zeitüberschreitung beim Aufnehmen der Audio-Streams (mindestens eine Kamera antwortet nicht)."
            }

        if not os.path.exists(path1) or not os.path.exists(path2):
            return {
                "success": False,
                "message": "Audiodateien konnten nicht erzeugt werden. Bitte prüfen, ob beide Kameras live senden."
            }

        # Audiodaten auslesen
        with wave.open(path1, "rb") as wf1:
            n1 = wf1.getnframes()
            sr1 = wf1.getframerate()
            frames1 = wf1.readframes(n1)
            s1 = struct.unpack(f"<{len(frames1)//2}h", frames1)

        with wave.open(path2, "rb") as wf2:
            n2 = wf2.getnframes()
            sr2 = wf2.getframerate()
            frames2 = wf2.readframes(n2)
            s2 = struct.unpack(f"<{len(frames2)//2}h", frames2)

        # Plausibilitätsprüfung (mind. 2 Sekunden Audio)
        if len(s1) < sr1 * 2 or len(s2) < sr2 * 2:
            return {
                "success": False,
                "message": "Zu wenig Audiodaten empfangen. Bitte prüfen, ob beide Kameras Audio übertragen."
            }

        offset_ms, confidence = compute_audio_cross_correlation(list(s1), list(s2), sample_rate=sr1)

        # Interpretation des Offsets für den Benutzer:
        if offset_ms > 0:
            cam_to_delay = "cam1"
            explanation = f"Kamera 2 kommt {offset_ms} ms später an. Kamera 1 wird um {offset_ms} ms verzögert."
        elif offset_ms < 0:
            cam_to_delay = "cam2"
            abs_offset = abs(offset_ms)
            explanation = f"Kamera 1 kommt {abs_offset} ms später an. Kamera 2 wird um {abs_offset} ms verzögert."
        else:
            cam_to_delay = "none"
            explanation = "Beide Kameras sind bereits perfekt synchron (0 ms Versatz)."

        return {
            "success": True,
            "offset_ms": offset_ms,
            "confidence": round(confidence, 2),
            "cam_to_delay": cam_to_delay,
            "delay_amount_ms": abs(offset_ms),
            "message": f"Auto-Sync erfolgreich ({explanation})"
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Fehler bei der Audio-Synchronisation: {str(e)}"
        }
    finally:
        # Temporäre WAV-Dateien immer aufräumen
        for p in [path1, path2]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass
