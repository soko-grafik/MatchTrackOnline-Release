import json
import os
from db.session import BASE_DIR

class AnalyticsService:
    @staticmethod
    def get_player_heatmap(tracking_path):
        """
        Generiert Heatmap-Daten aus einer Tracking-Datei.
        Unterstützt sowohl JSONL als auch einfache JSON-Dateien.
        """
        # Pfad korrigieren (relativ zu BASE_DIR falls nötig)
        if not tracking_path:
            return []
            
        if not os.path.isabs(tracking_path):
            # Wenn der Pfad mit 'backend/' beginnt, entfernen wir es für den lokalen Zugriff
            clean_path = tracking_path
            if clean_path.startswith("backend/"):
                clean_path = clean_path.replace("backend/", "", 1)
            full_path = os.path.join(BASE_DIR, clean_path)
        else:
            full_path = tracking_path

        if not os.path.exists(full_path):
            return []

        positions = []
        try:
            with open(full_path, "r") as f:
                content = f.read().strip()
                if not content:
                    return []
                
                # Versuche als JSONL zu parsen (mehrere Zeilen)
                if "\n" in content:
                    lines = content.split("\n")
                    for line in lines:
                        if not line.strip(): continue
                        try:
                            frame = json.loads(line)
                            for det in frame.get("detections", []):
                                if det.get("label") == "player":
                                    positions.append({"x": det["x"], "y": det["y"]})
                        except:
                            continue
                else:
                    # Versuche als einzelnes JSON Objekt
                    data = json.loads(content)
                    if isinstance(data, dict):
                        for det in data.get("detections", []):
                             if det.get("label") == "player":
                                positions.append({"x": det["x"], "y": det["y"]})
                    elif isinstance(data, list):
                        for frame in data:
                            for det in frame.get("detections", []):
                                if det.get("label") == "player":
                                    positions.append({"x": det["x"], "y": det["y"]})
        except:
            pass # Im CGI-Kontext keine Prints zu stdout riskieren
            
        return positions
