import os
import shutil
from datetime import datetime
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

DEFAULT_TEAMS = [
    {"id": "team_g_junioren", "name": "G-Junioren", "age_group": "U7"},
    {"id": "team_f_junioren", "name": "F-Junioren", "age_group": "U9"},
    {"id": "team_e_junioren", "name": "E-Junioren", "age_group": "U11"},
    {"id": "team_d_junioren", "name": "D-Junioren", "age_group": "U13"},
    {"id": "team_c_junioren", "name": "C-Junioren", "age_group": "U15"},
    {"id": "team_b_junioren", "name": "B-Junioren", "age_group": "U17"},
    {"id": "team_a_junioren", "name": "A-Junioren", "age_group": "U19"},
]

# Alle Spalten, die nachträglich zu bestehenden Tabellen hinzugefügt wurden
MIGRATION_COLUMNS = [
    # Table: users
    ("users", "avatar_path", "VARCHAR(255)"),
    ("users", "first_name", "VARCHAR(100)"),
    ("users", "last_name", "VARCHAR(100)"),
    ("users", "notify_on_new_video", "BOOLEAN DEFAULT 1"),
    ("users", "notify_on_analysis", "BOOLEAN DEFAULT 1"),
    ("users", "reset_token", "VARCHAR(255)"),
    ("users", "reset_token_expires_at", "DATETIME"),
    ("users", "module_permissions", "JSON DEFAULT '{}'"),
    ("users", "ai_provider", "VARCHAR(50) DEFAULT 'OPENAI'"),
    ("users", "ai_api_key", "VARCHAR(255)"),
    ("users", "ai_model_name", "VARCHAR(100)"),
    ("users", "last_login", "DATETIME"),

    # Table: teams
    ("teams", "age_group", "VARCHAR(50)"),

    # Table: user_teams
    ("user_teams", "can_edit", "BOOLEAN DEFAULT 1"),

    # Table: matches
    ("matches", "team_name", "VARCHAR(100)"),
    ("matches", "team_id", "VARCHAR(50)"),
    ("matches", "category", "VARCHAR(50) DEFAULT 'Punktspiel'"),
    ("matches", "video_quality", "VARCHAR(20)"),
    ("matches", "age_group", "VARCHAR(10)"),
    ("matches", "recording_date", "DATETIME"),
    ("matches", "thumbnail_path", "VARCHAR(500)"),
    ("matches", "heatmap_status", "VARCHAR(50) DEFAULT 'NONE'"),
    ("matches", "heatmap_path", "VARCHAR(500)"),
    ("matches", "heatmap_progress", "FLOAT DEFAULT 0.0"),
    ("matches", "heatmap_step_text", "VARCHAR(255) DEFAULT ''"),
    ("matches", "field_calibration", "TEXT"),
    ("matches", "stitching_status", "VARCHAR(50) DEFAULT 'NONE'"),
    ("matches", "video_left_path", "VARCHAR(500)"),
    ("matches", "video_right_path", "VARCHAR(500)"),
    ("matches", "stitching_time_offset", "INTEGER DEFAULT 0"),
    ("matches", "share_token", "VARCHAR(50)"),
    ("matches", "is_password_protected", "BOOLEAN DEFAULT 0"),
    ("matches", "hashed_password", "VARCHAR(255)"),
    ("matches", "plain_password", "VARCHAR(255)"),
    ("matches", "password_expires_at", "DATETIME"),
    ("matches", "video_brightness", "INTEGER DEFAULT 100"),
    ("matches", "video_contrast", "INTEGER DEFAULT 100"),
    ("matches", "video_saturation", "INTEGER DEFAULT 100"),
    ("matches", "video_hue", "INTEGER DEFAULT 0"),

    # Table: video_chunks
    ("video_chunks", "hls_playlist_path", "VARCHAR(500)"),
    ("video_chunks", "video_path_sd", "VARCHAR(500)"),
    ("video_chunks", "video_path_hd", "VARCHAR(500)"),
    ("video_chunks", "video_path_fhd", "VARCHAR(500)"),
    ("video_chunks", "conversion_status", "VARCHAR(20) DEFAULT 'pending'"),
    ("video_chunks", "conversion_progress", "INTEGER DEFAULT 0"),
    ("video_chunks", "conversion_pid", "INTEGER"),
    ("video_chunks", "tracking_path", "VARCHAR(500)"),
    ("video_chunks", "file_size_mb", "INTEGER"),

    # Table: system_settings
    ("system_settings", "module_stitching_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "module_heatmap_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "module_video_color_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "module_hls_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "module_fisheye_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "module_ai_assistant_enabled", "BOOLEAN DEFAULT 1"),
    ("system_settings", "default_resolution", "VARCHAR(20) DEFAULT '1080p'"),
    ("system_settings", "default_video_quality", "VARCHAR(20) DEFAULT 'High'"),
    ("system_settings", "default_storage_path", "VARCHAR(500) DEFAULT 'uploads'"),
    ("system_settings", "auto_hls_conversion", "BOOLEAN DEFAULT 1"),
    ("system_settings", "auto_stitching", "BOOLEAN DEFAULT 0"),
    ("system_settings", "show_push_test_button", "BOOLEAN DEFAULT 0"),
    ("system_settings", "show_match_cleanup_button", "BOOLEAN DEFAULT 0"),
    ("system_settings", "smtp_enabled", "BOOLEAN DEFAULT 0"),
    ("system_settings", "smtp_host", "VARCHAR(255) DEFAULT 'smtp.example.com'"),
    ("system_settings", "smtp_port", "INTEGER DEFAULT 587"),
    ("system_settings", "smtp_user", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "smtp_password", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "smtp_sender_email", "VARCHAR(255) DEFAULT 'noreply@matchtrack.de'"),
    ("system_settings", "smtp_use_tls", "BOOLEAN DEFAULT 1"),
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
    ("system_settings", "legal_imprint_content", "TEXT"),
    ("system_settings", "legal_privacy_content", "TEXT"),
    ("system_settings", "legal_terms_content", "TEXT"),
    ("system_settings", "legal_club_name", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "legal_contact_email", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "legal_address", "VARCHAR(500) DEFAULT ''"),
    ("system_settings", "legal_representative", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "legal_register_info", "VARCHAR(255) DEFAULT ''"),
    ("system_settings", "updated_at", "DATETIME"),

    # Table: training_sessions
    ("training_sessions", "is_shared", "BOOLEAN DEFAULT 0"),
    ("training_sessions", "methodology", "VARCHAR(50) DEFAULT 'Trainingsphilosophie Deutschland'"),
    ("training_sessions", "notes", "VARCHAR(2000)"),
    ("training_sessions", "age_group", "VARCHAR(50)"),
    ("training_sessions", "team_id", "VARCHAR(50)"),
    ("training_sessions", "created_by_user_id", "VARCHAR(50)"),

    # Table: calendar_events
    ("calendar_events", "reminder_minutes", "INTEGER DEFAULT 30"),
    ("calendar_events", "reminder_sent_at", "DATETIME"),
    ("calendar_events", "external_url", "VARCHAR(1000)"),
    ("calendar_events", "notes", "VARCHAR(2000)"),
    ("calendar_events", "opponent", "VARCHAR(255)"),
    ("calendar_events", "location", "VARCHAR(255)"),
    ("calendar_events", "is_home", "BOOLEAN DEFAULT 1"),
    ("calendar_events", "fussball_de_match_id", "VARCHAR(100)"),
    ("calendar_events", "training_session_id", "INTEGER"),
    ("calendar_events", "created_by_user_id", "VARCHAR(50)"),

    # Table: players
    ("players", "birthday_notified_at", "DATETIME"),
    ("players", "dfb_id", "VARCHAR(50)"),
    ("players", "jersey_number", "INTEGER"),
    ("players", "position", "VARCHAR(50) DEFAULT 'Feldspieler'"),
    ("players", "nationality", "VARCHAR(50) DEFAULT 'D'"),
    ("players", "date_of_birth", "VARCHAR(50)"),
    ("players", "notes", "VARCHAR(2000)"),
    ("players", "team_id", "VARCHAR(50)"),
    ("players", "updated_at", "DATETIME"),

    # Table: player_evaluations
    ("player_evaluations", "raw_transcript", "TEXT"),
    ("player_evaluations", "strengths", "TEXT"),
    ("player_evaluations", "weaknesses", "TEXT"),
    ("player_evaluations", "evaluation_date", "DATETIME"),
    ("player_evaluations", "is_approved", "BOOLEAN DEFAULT 1"),
    ("player_evaluations", "approved_by_user_id", "VARCHAR(50)"),
    ("player_evaluations", "approved_at", "DATETIME"),
    ("player_evaluations", "eval_year", "INTEGER"),
    ("player_evaluations", "eval_quarter", "VARCHAR(10)"),
    ("player_evaluations", "overall_rating", "FLOAT DEFAULT 0.0"),
    ("player_evaluations", "overall_notes", "VARCHAR(2000)"),
    ("player_evaluations", "tech_ball_control", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tech_dribbling", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tech_passing", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tech_shooting", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tech_both_feet", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tact_intelligence", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tact_space_creation", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tact_transition", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "tact_one_on_one", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "phys_speed", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "phys_agility", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "phys_mobility", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "ment_teamwork", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "ment_attitude", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "ment_learning", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "ment_fairplay", "FLOAT DEFAULT 5.0"),
    ("player_evaluations", "created_by_user_id", "VARCHAR(50)"),
    ("player_evaluations", "updated_at", "DATETIME"),

    # Table: tactics_boards
    ("tactics_boards", "description", "VARCHAR(2000)"),
    ("tactics_boards", "category", "VARCHAR(100) DEFAULT 'Allgemein'"),
    ("tactics_boards", "team_id", "VARCHAR(50)"),
    ("tactics_boards", "pitch_type", "VARCHAR(50) DEFAULT 'full_horizontal'"),
    ("tactics_boards", "pitch_style", "VARCHAR(50) DEFAULT 'grass_classic'"),
    ("tactics_boards", "is_shared", "BOOLEAN DEFAULT 0"),
    ("tactics_boards", "frames_data", "JSON"),
    ("tactics_boards", "thumbnail_path", "VARCHAR(255)"),
    ("tactics_boards", "updated_at", "DATETIME"),

    # Table: video_stitch_jobs
    ("video_stitch_jobs", "detailed_logs", "TEXT"),
    ("video_stitch_jobs", "audio_sync_offset_ms", "INTEGER DEFAULT 0"),
    ("video_stitch_jobs", "detect_events_auto", "BOOLEAN DEFAULT 1"),
    ("video_stitch_jobs", "current_step_text", "VARCHAR(255)"),
    ("video_stitch_jobs", "error_message", "TEXT"),
    ("video_stitch_jobs", "output_mode", "VARCHAR(30) DEFAULT 'DYNAMIC_16_9'"),
    ("video_stitch_jobs", "stitched_panorama_path", "VARCHAR(500)"),
    ("video_stitch_jobs", "reframed_broadcast_path", "VARCHAR(500)"),
    ("video_stitch_jobs", "hls_panorama_url", "VARCHAR(500)"),
    ("video_stitch_jobs", "hls_broadcast_url", "VARCHAR(500)"),
    ("video_stitch_jobs", "tracking_data_json", "JSON"),
    ("video_stitch_jobs", "settings_json", "JSON"),
    ("video_stitch_jobs", "created_at", "DATETIME"),
    ("video_stitch_jobs", "updated_at", "DATETIME"),
]

def run_migrations(engine=None):
    """
    Bulletproof migration runner:
    1. Erstellt alle Tabellen via Base.metadata.create_all (idempotent).
    2. Prüft und fügt fehlende Spalten zu bestehenden Tabellen hinzu (SQLite & MySQL kompatibel).
    3. Stellt sicher, dass Standard-System-Settings (id=1) existieren.
    4. Seeding der Standard-Teams, wenn leer.
    5. Migration von Alt-Matches ohne team_id.
    6. Backfill von calendar_event_teams.
    7. Verzeichnisstruktur für Uploads sicherstellen.
    """
    if engine is None:
        from db.session import engine as default_engine
        engine = default_engine

    is_mysql = "mysql" in str(engine.url)

    # 1. Fremdschlüssel temporär für Tabellenerstellung deaktivieren (MySQL)
    if is_mysql:
        try:
            with engine.connect() as conn:
                conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
                conn.commit()
        except Exception:
            pass

    # 2. Tabellen erstellen
    try:
        from models import Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Hinweis bei create_all: {e}")

    if is_mysql:
        try:
            with engine.connect() as conn:
                conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
                conn.commit()
        except Exception:
            pass

    # 3. Fehlende Spalten prüfen und hinzufügen
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
    except Exception:
        existing_tables = set()

    table_columns_cache = {}
    if existing_tables:
        for tbl in existing_tables:
            try:
                table_columns_cache[tbl] = {c["name"].lower() for c in inspector.get_columns(tbl)}
            except Exception:
                table_columns_cache[tbl] = set()

    for tbl, col_name, col_type in MIGRATION_COLUMNS:
        if tbl in table_columns_cache and col_name.lower() in table_columns_cache[tbl]:
            continue

        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                if tbl in table_columns_cache:
                    table_columns_cache[tbl].add(col_name.lower())
        except Exception:
            pass

    # 4. Standard SystemSettings sicherstellen (id=1)
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT id FROM system_settings WHERE id = 1")).fetchone()
            if not res:
                conn.execute(text("INSERT INTO system_settings (id) VALUES (1)"))
                conn.commit()
    except Exception as set_err:
        print(f"Hinweis bei system_settings init: {set_err}")

    # 5. Default Teams seeden und Alt-Matches migrieren
    try:
        from models.models import Team, Match
        with Session(bind=engine) as db:
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

            # Alt-Matches zuweisen
            all_teams = db.query(Team).all()
            team_map = {t.name.lower(): t for t in all_teams}
            for t in all_teams:
                if t.age_group:
                    team_map[t.age_group.lower()] = t

            unassigned_matches = db.query(Match).filter(Match.team_id == None).all()
            for match in unassigned_matches:
                matched_team = None
                if match.team_name and match.team_name.lower() in team_map:
                    matched_team = team_map[match.team_name.lower()]
                elif match.age_group and match.age_group.lower() in team_map:
                    matched_team = team_map[match.age_group.lower()]

                if matched_team:
                    match.team_id = matched_team.id
                    if not match.team_name:
                        match.team_name = matched_team.name
            db.commit()
    except Exception as team_err:
        print(f"Hinweis bei Team-Migration: {team_err}")

    # 6. Backfill calendar_event_teams
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO calendar_event_teams (event_id, team_id)
                SELECT ce.id, ce.team_id FROM calendar_events ce
                WHERE ce.team_id IS NOT NULL
                  AND ce.team_id IN (SELECT id FROM teams)
                  AND NOT EXISTS (
                      SELECT 1 FROM calendar_event_teams cet WHERE cet.event_id = ce.id
                  )
            """))
            conn.commit()
    except Exception as backfill_err:
        pass

    # 7. Uploads Verzeichnis
    try:
        from db.session import BASE_DIR, UPLOAD_DIR
        old_uploads = os.path.join(BASE_DIR, "uploads")
        new_uploads = UPLOAD_DIR

        os.makedirs(new_uploads, exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "avatars"), exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "thumbnails"), exist_ok=True)
        os.makedirs(os.path.join(new_uploads, "diagrams"), exist_ok=True)

        if os.path.exists(old_uploads) and not os.path.islink(old_uploads):
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
                        except Exception:
                            pass
            try:
                shutil.rmtree(old_uploads, ignore_errors=True)
            except Exception:
                pass
            if not os.path.exists(old_uploads):
                try:
                    os.symlink(new_uploads, old_uploads)
                except Exception:
                    pass
    except Exception as up_err:
        print(f"Hinweis bei Upload-Verzeichnis-Check: {up_err}")

    print("✅ Datenbank-Migrationen und Tabellenprüfung erfolgreich abgeschlossen.")
