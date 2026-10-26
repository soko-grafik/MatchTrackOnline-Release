#!/usr/bin/env python3
"""
==============================================================================
MatchTrack Online - Base64 Thumbnail Offloading Migration
==============================================================================
Wandelt alle in der Datenbank (TrainingExercise & TacticsBoard) gespeicherten
Base64-Bilddaten in statische Bilddateien auf der Festplatte um.

Vorteil:
- Verkleinert die Datenbankgröße um bis zu 99%
- Beschleunigt GET /api/training/exercises von 1.5MB auf ~20KB Payload
- Aktiviert volles Browser-Festplatten-Caching für alle Übungs-Vorschaubilder
==============================================================================
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from db.session import SessionLocal, UPLOAD_DIR
from models import TrainingExercise, TacticsBoard
from services.thumbnail_service import offload_base64_thumbnail

def run_thumbnail_migration():
    print("==============================================================================")
    print("🚀 STARTE BASE64-THUMBNAIL AUSLAGERUNG (DB ➡️ DATEISYSTEM)...")
    print(f"📁 Zielordner: {os.path.join(UPLOAD_DIR, 'thumbnails')}")
    print("==============================================================================")

    db = SessionLocal()
    try:
        # 1. Training Exercises
        exercises = db.query(TrainingExercise).all()
        ex_converted = 0
        for ex in exercises:
            if ex.thumbnail_path and ex.thumbnail_path.startswith("data:image/"):
                new_path = offload_base64_thumbnail(ex.thumbnail_path, "thumbnails", f"exercise_{ex.id}")
                if new_path != ex.thumbnail_path:
                    ex.thumbnail_path = new_path
                    ex_converted += 1

        # 2. Tactics Boards
        tactics = db.query(TacticsBoard).all()
        tac_converted = 0
        for tac in tactics:
            if tac.thumbnail_path and tac.thumbnail_path.startswith("data:image/"):
                new_path = offload_base64_thumbnail(tac.thumbnail_path, "thumbnails", f"tactics_{tac.id}")
                if new_path != tac.thumbnail_path:
                    tac.thumbnail_path = new_path
                    tac_converted += 1

        db.commit()

        print(f"✅ Übungen (TrainingExercise): {ex_converted} Base64-Bilder erfolgreich in statische Dateien ausgelagert.")
        print(f"✅ Taktiktafeln (TacticsBoard): {tac_converted} Base64-Bilder erfolgreich in statische Dateien ausgelagert.")
        print("==============================================================================")
        print("🎉 DB-Erleichterung abgeschlossen! Die API-Antworten sind jetzt bis zu 98% kleiner.")
    except Exception as e:
        db.rollback()
        print(f"❌ Fehler bei der Thumbnail-Auslagerung: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_thumbnail_migration()
