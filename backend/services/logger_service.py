import os
import uuid
import logging
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from models.models import SystemLog, SystemSettings
from db.session import SessionLocal

logger = logging.getLogger("matchtrack")


def is_message_matching_patterns(message: str, patterns: List[str]) -> bool:
    """Check if message matches any of the irrelevant patterns."""
    if not message or not patterns:
        return False
    msg_lower = message.lower()
    for pattern in patterns:
        if pattern and pattern.strip().lower() in msg_lower:
            return True
    return False


def create_system_log(
    db: Session,
    source: str,
    level: str,
    message: str,
    module: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    is_irrelevant: Optional[bool] = None
) -> SystemLog:
    """
    Creates a new system log entry.
    Automatically marks as irrelevant if matching any configured ignore pattern.
    """
    level_norm = (level or "INFO").upper()
    source_norm = (source or "backend").lower()
    if source_norm not in ("backend", "frontend"):
        source_norm = "backend"

    if is_irrelevant is None:
        is_irrelevant = False
        try:
            settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
            if settings and settings.log_irrelevant_patterns:
                is_irrelevant = is_message_matching_patterns(message, settings.log_irrelevant_patterns)
        except Exception:
            pass

    log_entry = SystemLog(
        id=str(uuid.uuid4()),
        source=source_norm,
        level=level_norm,
        message=message or "",
        module=module,
        details=details or {},
        is_irrelevant=bool(is_irrelevant),
        created_at=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


class DatabaseLogHandler(logging.Handler):
    """
    Custom logging handler that persists WARNING, ERROR and CRITICAL logs to the database.
    Prevents recursion by ignoring database internal loggers.
    """
    def __init__(self, level=logging.WARNING):
        super().__init__(level)
        self._handling = False

    def emit(self, record: logging.LogRecord):
        if self._handling:
            return

        # Skip noisemakers and db internal logs to avoid recursive queries
        name = record.name.lower()
        if any(ignored in name for ignored in ("sqlalchemy", "alembic", "uvicorn.access", "watchfiles", "passlib")):
            return

        self._handling = True
        db = None
        try:
            msg = self.format(record)
            details = {
                "logger_name": record.name,
                "filename": record.filename,
                "lineno": record.lineno,
                "func_name": record.funcName
            }
            if record.exc_info:
                details["traceback"] = "".join(traceback.format_exception(*record.exc_info))

            db = SessionLocal()
            create_system_log(
                db=db,
                source="backend",
                level=record.levelname,
                message=msg,
                module=record.name,
                details=details
            )
        except Exception:
            # Fallback to standard stderr without crashing
            pass
        finally:
            if db:
                try:
                    db.close()
                except Exception:
                    pass
            self._handling = False


_logging_initialized = False

def setup_logging():
    """Initializes the database logging handler for the root logger."""
    global _logging_initialized
    if _logging_initialized:
        return

    root_logger = logging.getLogger()
    # Check if DatabaseLogHandler is already attached
    for handler in root_logger.handlers:
        if isinstance(handler, DatabaseLogHandler):
            _logging_initialized = True
            return

    db_handler = DatabaseLogHandler(level=logging.WARNING)
    formatter = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
    db_handler.setFormatter(formatter)
    root_logger.addHandler(db_handler)
    _logging_initialized = True


def generate_test_logs(db: Session):
    """Generates sample test logs for verification."""
    samples = [
        ("backend", "INFO", "System-Dienste erfolgreich synchronisiert und DB-Verbindung stabil.", "system.core", {"status": "ok"}),
        ("backend", "WARNING", "Hintergrund-Aufgabe 'Thumbnail-Generierung' dauerte länger als erwartet (4200ms).", "services.thumbnail", {"duration_ms": 4200}),
        ("backend", "ERROR", "Fehler bei externer Video-Transkodierung: FFmpeg meldet ungültigen Farbkanal (Code 137).", "services.video", {"error_code": 137, "command": "ffmpeg -i chunk.mp4"}),
        ("frontend", "WARNING", "Langsame Netzwerklatenz beim Laden der Taktiktafel erkannt (>1200ms).", "client.tactics", {"latency_ms": 1240, "route": "/tactics"}),
        ("frontend", "ERROR", "Uncaught TypeError: Kann Eigenschaft 'canvas' von null nicht lesen in ExerciseSketchEditor.", "client.sketch_editor", {"component": "ExerciseSketchEditor", "stack": "Error at drawCanvas (ExerciseSketchEditor.tsx:846)"})
    ]

    created = []
    for src, lvl, msg, mod, det in samples:
        created.append(create_system_log(db, source=src, level=lvl, message=msg, module=mod, details=det))
    return created
