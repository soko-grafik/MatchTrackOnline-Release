import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import upload, matches, analytics, auth, admin, videos, install, teams, users, training, organizer, players, ai, tactics, public
from db.session import engine, SessionLocal
from models import Base
from db.init_teams import seed_and_migrate_teams

from sqlalchemy import text

# Tabellen erstellen und Default Teams seeden
try:
    if "mysql" in str(engine.url):
        with engine.connect() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            conn.commit()
    Base.metadata.create_all(bind=engine)
    if "mysql" in str(engine.url):
        with engine.connect() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
            conn.commit()
    db = SessionLocal()
    seed_and_migrate_teams(db)
    db.close()

    # Automatisches Hinzufügen neuer Spalten zu bestehenden SQLite/MySQL Tabellen
    with engine.connect() as conn:
      for col_def in [
          "ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255)",
          "ALTER TABLE users ADD COLUMN first_name VARCHAR(100)",
          "ALTER TABLE users ADD COLUMN last_name VARCHAR(100)",
          "ALTER TABLE users ADD COLUMN notify_on_new_video BOOLEAN DEFAULT 1",
          "ALTER TABLE users ADD COLUMN notify_on_analysis BOOLEAN DEFAULT 1",
          "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)",
          "ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME",
          "ALTER TABLE training_sessions ADD COLUMN is_shared BOOLEAN DEFAULT 0",
          "ALTER TABLE matches ADD COLUMN plain_password VARCHAR(255)",
          "ALTER TABLE calendar_events ADD COLUMN reminder_minutes INTEGER DEFAULT 30",
          "ALTER TABLE system_settings ADD COLUMN show_push_test_button BOOLEAN DEFAULT 0",
          "ALTER TABLE player_evaluations ADD COLUMN raw_transcript TEXT",
          "ALTER TABLE player_evaluations ADD COLUMN strengths TEXT",
          "ALTER TABLE player_evaluations ADD COLUMN weaknesses TEXT",
          "ALTER TABLE users ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'OPENAI'",
          "ALTER TABLE users ADD COLUMN ai_api_key VARCHAR(255)",
          "ALTER TABLE users ADD COLUMN ai_model_name VARCHAR(100)",
          "ALTER TABLE users ADD COLUMN last_login DATETIME",
          "ALTER TABLE user_teams ADD COLUMN can_edit BOOLEAN DEFAULT 1",
          "ALTER TABLE system_settings ADD COLUMN module_ai_assistant_enabled BOOLEAN DEFAULT 1",
          "ALTER TABLE calendar_events ADD COLUMN reminder_sent_at DATETIME",
          "ALTER TABLE players ADD COLUMN birthday_notified_at DATETIME",
          "ALTER TABLE system_settings ADD COLUMN show_match_cleanup_button BOOLEAN DEFAULT 0",
          "ALTER TABLE video_stitch_jobs ADD COLUMN detailed_logs TEXT",
          "ALTER TABLE video_stitch_jobs ADD COLUMN audio_sync_offset_ms INTEGER DEFAULT 0",
          "ALTER TABLE video_stitch_jobs ADD COLUMN detect_events_auto BOOLEAN DEFAULT 1",
          "ALTER TABLE video_stitch_jobs ADD COLUMN current_step_text VARCHAR(255)",
          "ALTER TABLE video_stitch_jobs ADD COLUMN error_message TEXT",
          "ALTER TABLE video_stitch_jobs ADD COLUMN created_at DATETIME",
          "ALTER TABLE video_stitch_jobs ADD COLUMN updated_at DATETIME",
          "ALTER TABLE system_settings ADD COLUMN legal_imprint_content TEXT",
          "ALTER TABLE system_settings ADD COLUMN legal_privacy_content TEXT",
          "ALTER TABLE system_settings ADD COLUMN legal_terms_content TEXT",
          "ALTER TABLE system_settings ADD COLUMN legal_club_name VARCHAR(255)",
          "ALTER TABLE system_settings ADD COLUMN legal_contact_email VARCHAR(255)",
          "ALTER TABLE system_settings ADD COLUMN legal_address VARCHAR(500)",
          "ALTER TABLE system_settings ADD COLUMN legal_representative VARCHAR(255)",
          "ALTER TABLE system_settings ADD COLUMN legal_register_info VARCHAR(255)"
      ]:
            try:
                conn.execute(text(col_def))
                conn.commit()
            except Exception:
                pass # Spalte existiert bereits

    # Bestehende Termine in die neue Mehrfach-Zuordnung übernehmen (idempotent).
    # Ohne diesen Schritt hätten Alt-Termine nach dem Update kein zugewiesenes Team mehr.
    with engine.connect() as conn:
        try:
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
            print(f"Warnung beim Backfill von calendar_event_teams: {backfill_err}")
except Exception as e:
    print(f"Warnung bei DB-Initialisierung: {e}")


# Wir schalten das automatische Hinzufügen von Slashes aus, um Konflikte zu vermeiden
app = FastAPI(title="MatchTracker API", redirect_slashes=False)

@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        request.scope["path"] = path[4:] # Remove "/api"
    elif path == "/api":
        request.scope["path"] = "/"
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from db.session import UPLOAD_DIR, engine, SessionLocal

os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "diagrams"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "tactics"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/backend/uploads", StaticFiles(directory=UPLOAD_DIR), name="backend_uploads")


# Wir registrieren die Router ohne Pfad-Präfix hier, da wir das im Gateway steuern

app.include_router(install.router, prefix="/install", tags=["Installation"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(matches.router, prefix="/matches", tags=["Matches"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(videos.router, prefix="/videos", tags=["Videos"])
app.include_router(teams.router, prefix="/teams", tags=["Teams"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(training.router, prefix="/training", tags=["Training"])
app.include_router(tactics.router, prefix="/tactics", tags=["Tactics"])
app.include_router(organizer.router, prefix="/organizer", tags=["Organizer"])
app.include_router(players.router, prefix="/players", tags=["Players"])
app.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
app.include_router(public.router, prefix="/public", tags=["Public"])

import asyncio
from services.notification_service import check_and_send_event_reminders, check_and_send_birthday_reminders

async def push_reminder_background_loop():
    """Background task running every 60s to dispatch upcoming event & birthday push notifications."""
    while True:
        try:
            db = SessionLocal()
            check_and_send_event_reminders(db)
            check_and_send_birthday_reminders(db)
            db.close()
        except Exception as e:
            print(f"Error in push_reminder_background_loop: {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def start_push_scheduler():
    asyncio.create_task(push_reminder_background_loop())

@app.get("/")
async def root():
    return {"status": "running", "app": "MatchTrack Online Backend"}

@app.get("/health")
async def health_check():
    db_status = "healthy"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "database": db_status,
        "engine": str(engine.url.drivername)
    }

