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

def seed_and_migrate_teams(db: Session = None):
    """
    Creates default teams if not exist, migrates legacy matches,
    and runs all dynamic column migrations via unified run_migrations.
    """
    from db.migrate import run_migrations
    bind = None
    if db is not None:
        try:
            bind = db.get_bind()
        except Exception:
            bind = getattr(db, 'bind', None)
    run_migrations(bind)
