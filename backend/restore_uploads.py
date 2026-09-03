#!/usr/bin/env python3
import os
import uuid
import urllib.parse
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from models import Match, VideoChunk, HeatmapStatus, StitchingStatus, Team

def main():
    print("==========================================")
    print("🎥 WIEDERHERSTELLUNG VON VORHANDENEN UPLOADS")
    print("==========================================")

    db_type = os.getenv("DB_TYPE", "sqlite")
    use_sqlite = db_type == "sqlite" or os.getenv("USE_SQLITE") == "true"
    
    if use_sqlite:
        url = f"sqlite:///{os.path.join(BASE_DIR, 'matchtracker.db')}"
    else:
        db_user = os.getenv("DB_USER")
        db_pass = os.getenv("DB_PASS")
        db_host = os.getenv("DB_HOST", "127.0.0.1")
        db_name = os.getenv("DB_NAME")
        enc_pass = urllib.parse.quote_plus(db_pass) if db_pass else ""
        url = f"mysql+pymysql://{db_user}:{enc_pass}@{db_host}/{db_name}"

    engine = create_engine(url, connect_args={"check_same_thread": False} if "sqlite" in url else {})
    Session = sessionmaker(bind=engine)
    db = Session()

    uploads_dir = os.path.join(BASE_DIR, "uploads")
    if not os.path.exists(uploads_dir):
        print(f"⚠️ Ordner '{uploads_dir}' existiert nicht.")
        return

    subdirs = [d for d in os.listdir(uploads_dir) if os.path.isdir(os.path.join(uploads_dir, d))]
    print(f"📂 Gefundene Match-Ordner in uploads/: {len(subdirs)}")

    restored_count = 0

    for item in subdirs:
        match_dir = os.path.join(uploads_dir, item)
        match_id = item
        
        # Prüfen ob Match bereits in DB existiert
        existing_match = db.query(Match).filter((Match.id == match_id) | (Match.name == item)).first()
        if existing_match:
            print(f" ℹ️ Match '{item}' existiert bereits in der Datenbank.")
            continue

        # Rekursiv oder direkt Dateien im Match-Ordner scannen
        all_files = []
        for root, dirs, files in os.walk(match_dir):
            for f in files:
                rel_path = os.path.relpath(os.path.join(root, f), BASE_DIR).replace("\\", "/")
                all_files.append((f, rel_path))

        video_files = [path for f, path in all_files if f.lower().endswith(('.mp4', '.mov', '.mkv', '.avi', '.ts')) and not f.startswith('.')]
        hls_files = [path for f, path in all_files if f.lower().endswith('.m3u8')]
        thumb_files = [path for f, path in all_files if ('thumb' in f.lower() or f.lower().endswith(('.jpg', '.png'))) and not f.startswith('.')]

        thumbnail_path = thumb_files[0] if thumb_files else None

        match_name = item.replace("_", " ").replace("-", " ").title()
        new_match = Match(
            id=match_id,
            name=match_name,
            team_name=None,
            created_at=datetime.utcnow(),
            thumbnail_path=thumbnail_path,
            heatmap_status=HeatmapStatus.NONE,
            stitching_status=StitchingStatus.NONE
        )
        db.add(new_match)
        db.commit()

        # Chunks verknüpfen
        if video_files:
            for vf_path in video_files:
                chunk = VideoChunk(
                    match_id=new_match.id,
                    video_path=vf_path
                )
                db.add(chunk)
            db.commit()
            print(f" ✅ Match '{match_name}' ({match_id}) erfolgreich wiederhergestellt! ({len(video_files)} Video(s))")
            restored_count += 1
        elif hls_files:
            chunk = VideoChunk(
                match_id=new_match.id,
                video_path=hls_files[0],
                hls_playlist_path=hls_files[0]
            )
            db.add(chunk)
            db.commit()
            print(f" ✅ Match '{match_name}' ({match_id}) erfolgreich wiederhergestellt! (HLS Playlist)")
            restored_count += 1
        else:
            print(f" ⚠️ Ordner '{item}' enthält keine Videodateien.")

    print("\n==========================================")
    print(f"🎉 Fertig! {restored_count} Match(es) wurden in der Datenbank wiederhergestellt.")
    print("==========================================\n")
    db.close()

if __name__ == "__main__":
    main()
