import os
import shutil
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session
from models.models import Team, Match

DEFAULT_TEAMS = [
    {"id": "team_g_junioren", "name": "G-Junioren", "age_group": "U7"},
    {"id": "team_f_junioren", "name": "F-Junioren", "age_group": "U9"},
    {"id": "team_e_junioren", "name": "E-Junioren", "age_group": "U11"},
    {"id": "team_d_junioren", "name": "D-Junioren", "age_group": "U13"},
    {"id": "team_c_junioren", "name": "C-Junioren", "age_group": "U15"},
    {"id": "team_b_junioren", "name": "B-Junioren", "age_group": "U17"},
    {"id": "team_a_junioren", "name": "A-Junioren", "age_group": "U19"},
]

def seed_and_migrate_teams(db: Session):
    """
    Creates default teams if not exist and migrates legacy matches (age_group/team_name) to team_id.
    Also handles dynamic column additions for SQLite/MySQL.
    """
    is_mysql = "mysql" in str(db.bind.url)
    if is_mysql:
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            db.commit()
        except Exception:
            db.rollback()

    # 1. Dynamische Spaltenprüfung für alle Tabellen vor ORM Abfragen
    dynamic_cols = [
        ("matches", "team_id", "VARCHAR(50)"),
        ("matches", "category", "VARCHAR(50) DEFAULT 'Punktspiel'"),
        ("matches", "share_token", "VARCHAR(50)"),
        ("matches", "is_password_protected", "BOOLEAN DEFAULT 0"),
        ("matches", "hashed_password", "VARCHAR(255)"),
        ("matches", "plain_password", "VARCHAR(255)"),
        ("matches", "password_expires_at", "DATETIME"),
        ("matches", "video_brightness", "INTEGER DEFAULT 100"),
        ("matches", "video_contrast", "INTEGER DEFAULT 100"),
        ("matches", "video_saturation", "INTEGER DEFAULT 100"),
        ("matches", "video_hue", "INTEGER DEFAULT 0"),
        ("training_sessions", "is_shared", "BOOLEAN DEFAULT 0"),
        ("users", "avatar_path", "VARCHAR(255)"),
        ("users", "first_name", "VARCHAR(100)"),
        ("users", "last_name", "VARCHAR(100)"),
        ("users", "notify_on_new_video", "BOOLEAN DEFAULT 1"),
        ("users", "notify_on_analysis", "BOOLEAN DEFAULT 1"),
        ("users", "reset_token", "VARCHAR(255)"),
        ("users", "reset_token_expires_at", "DATETIME"),
        ("system_settings", "smtp_enabled", "BOOLEAN DEFAULT 0"),
        ("system_settings", "smtp_host", "VARCHAR(255) DEFAULT 'smtp.example.com'"),
        ("system_settings", "smtp_port", "INTEGER DEFAULT 587"),
        ("system_settings", "smtp_user", "VARCHAR(255) DEFAULT ''"),
        ("system_settings", "smtp_password", "VARCHAR(255) DEFAULT ''"),
        ("system_settings", "smtp_sender_email", "VARCHAR(255) DEFAULT 'noreply@matchtrack.de'"),
        ("system_settings", "smtp_use_tls", "BOOLEAN DEFAULT 1"),
        ("player_evaluations", "evaluation_date", "DATETIME"),
        ("player_evaluations", "is_approved", "BOOLEAN DEFAULT 1"),
        ("player_evaluations", "approved_by_user_id", "VARCHAR(50)"),
        ("player_evaluations", "approved_at", "DATETIME"),
        ("users", "module_permissions", "JSON DEFAULT '{}'"),
        ("system_settings", "ftp_enabled", "BOOLEAN DEFAULT 0"),
        ("system_settings", "ftp_host", "VARCHAR(255) DEFAULT ''"),
        ("system_settings", "ftp_port", "INTEGER DEFAULT 21"),
        ("system_settings", "ftp_user", "VARCHAR(255) DEFAULT ''"),
        ("system_settings", "ftp_password", "VARCHAR(255) DEFAULT ''"),
        ("system_settings", "ftp_path", "VARCHAR(255) DEFAULT '/backups'"),
        ("system_settings", "ftp_auto_backup", "BOOLEAN DEFAULT 0"),
        ("system_settings", "ftp_backup_schedule", "VARCHAR(50) DEFAULT 'DAILY'"),
        ("system_settings", "ftp_last_backup_at", "DATETIME"),
        ("system_settings", "ftp_last_backup_status", "VARCHAR(255) DEFAULT 'NO_BACKUP_YET'"),
        ("video_stitch_jobs", "detailed_logs", "TEXT"),
        ("video_stitch_jobs", "audio_sync_offset_ms", "INTEGER DEFAULT 0"),
        ("video_stitch_jobs", "detect_events_auto", "BOOLEAN DEFAULT 1"),
        ("video_stitch_jobs", "current_step_text", "VARCHAR(255)"),
        ("video_stitch_jobs", "error_message", "TEXT"),
    ]

    for tbl, col_name, col_type in dynamic_cols:
        try:
            db.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_type}"))
            db.commit()
        except Exception:
            db.rollback()

    # Tabellen wie players, player_attendances, player_evaluations sicherstellen
    try:
        from models import Base
        Base.metadata.create_all(bind=db.bind)
    except Exception:
        pass

    # 2. Default Teams nur anlegen, wenn die Teams-Tabelle noch VÖLLIG LEER ist!
    existing_teams_count = db.query(Team).count()
    if existing_teams_count == 0:
        for t_data in DEFAULT_TEAMS:
            team = Team(
                id=t_data["id"],
                name=t_data["name"],
                age_group=t_data["age_group"]
            )
            db.add(team)
        db.commit()

    # 3. Bestands-Matches migrieren, falls team_id IS NULL
    all_teams = db.query(Team).all()
    team_map = {t.name.lower(): t for t in all_teams}
    for t in all_teams:
        if t.age_group:
            team_map[t.age_group.lower()] = t

    unassigned_matches = db.query(Match).filter(Match.team_id == None).all()
    for match in unassigned_matches:
        matched_team = None
        # Überprüfe team_name
        if match.team_name and match.team_name.lower() in team_map:
            matched_team = team_map[match.team_name.lower()]
        # Überprüfe age_group (legacy)
        elif match.age_group and match.age_group.lower() in team_map:
            matched_team = team_map[match.age_group.lower()]

        if matched_team:
            match.team_id = matched_team.id
            if not match.team_name:
                match.team_name = matched_team.name
            print(f"Match '{match.name}' wurde automatisch dem Team '{matched_team.name}' zugewiesen.")

    db.commit()

    # 4. Automatisches Verschieben des uploads/-Ordners vom backend/ in den Projekt-Root (ohne Datenverlust!)
    try:
        from db.session import BASE_DIR, UPLOAD_DIR
        import shutil
        old_uploads = os.path.join(BASE_DIR, "uploads")
        new_uploads = UPLOAD_DIR

        os.makedirs(new_uploads, exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "avatars"), exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "thumbnails"), exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "diagrams"), exist_ok=True)

        if os.path.exists(old_uploads) and not os.path.islink(old_uploads):
            print(f"📦 Verschiebe Medien-Dateien von '{old_uploads}' nach '{new_uploads}'...")
            for root, dirs, files in os.walk(old_uploads):
                rel_dir = os.path.relpath(root, old_uploads)
                target_dir = new_uploads if rel_dir == "." else os.path.join(new_uploads, rel_dir)
                os.makedirs(target_dir, exist_ok=True)
                for file_name in files:
                    src_file = os.path.join(root, file_name)
                    dst_file = os.path.join(target_dir, file_name)
                    if not os.path.exists(dst_file):
                        try:
                            shutil.copy2(src_file, dst_file)
                        except Exception as copy_err:
                            print(f"Hinweis: Datei '{file_name}' konnte nicht kopiert werden: {copy_err}")
            
            try:
                shutil.rmtree(old_uploads, ignore_errors=True)
            except Exception:
                pass

            if not os.path.exists(old_uploads):
                try:
                    os.symlink(new_uploads, old_uploads)
                    print(f"🔗 Symlink '{old_uploads}' -> '{new_uploads}' erfolgreich erstellt.")
                except Exception as sym_err:
                    print(f"Hinweis: Symlink konnte nicht erstellt werden: {sym_err}")
    except Exception as mig_err:
        print(f"Warnung bei Upload-Verzeichnis-Migration: {mig_err}")
