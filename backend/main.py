import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import upload, matches, analytics, auth, admin, videos, install, teams, users, training, organizer, players, ai, tactics, public
from db.session import engine, SessionLocal
from models import Base
from db.migrate import run_migrations

# Tabellen erstellen, Migrationen durchführen und Default-Werte seeden
try:
    run_migrations(engine)
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

