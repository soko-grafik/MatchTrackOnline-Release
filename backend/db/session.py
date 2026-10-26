from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import urllib.parse
from dotenv import load_dotenv

# Absoluter Pfad zum 'backend' Ordner und Projekt-Root
BASE_DIR = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(BASE_DIR, 'matchtracker.db')
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(ROOT_DIR, "uploads"))

# .env laden falls vorhanden (sowohl backend/.env als auch root .env)
load_dotenv(os.path.join(ROOT_DIR, '.env'))
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

# MySQL Konfiguration aus Umgebungsvariablen lesen
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME")

# Bevorzuge SQLite falls DB_TYPE=sqlite oder USE_SQLITE=true
DB_TYPE = os.getenv("DB_TYPE", "sqlite" if os.name == 'nt' else "mysql")
use_sqlite = DB_TYPE == "sqlite" or os.getenv("USE_SQLITE") == "true"

if not use_sqlite:
    if not DB_USER or not DB_PASS or not DB_NAME:
        raise ValueError("Datenbank-Zugangsdaten (DB_USER, DB_PASS, DB_NAME) fehlen in der .env Konfiguration!")

# Passwort für URL encoden
encoded_pass = urllib.parse.quote_plus(DB_PASS) if DB_PASS else ""
host_port = f"{DB_HOST}:{DB_PORT}" if DB_PORT and ":" not in DB_HOST else DB_HOST

# MySQL URL mit pymysql Driver & utf8mb4
MYSQL_URL = f"mysql+pymysql://{DB_USER}:{encoded_pass}@{host_port}/{DB_NAME}?charset=utf8mb4" if DB_USER else ""
SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'matchtracker.db')}"

if use_sqlite:
    DATABASE_URL = SQLITE_URL
    connect_args = {"check_same_thread": False}
else:
    DATABASE_URL = MYSQL_URL
    connect_args = {}

pool_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
}
if not use_sqlite:
    pool_kwargs["pool_size"] = 25
    pool_kwargs["max_overflow"] = 20

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args if "sqlite" in DATABASE_URL else {},
    **pool_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def reinit_db_engine():
    global engine, SessionLocal, DATABASE_URL
    load_dotenv(os.path.join(ROOT_DIR, '.env'))
    load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)
    
    db_type = os.getenv("DB_TYPE", "sqlite" if os.name == 'nt' else "mysql")
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASS")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME")
    
    reinit_use_sqlite = db_type == "sqlite" or os.getenv("USE_SQLITE") == "true"
    
    if not reinit_use_sqlite:
        if not db_user or not db_pass or not db_name:
            raise ValueError("Datenbank-Zugangsdaten (DB_USER, DB_PASS, DB_NAME) fehlen in der .env Konfiguration!")
        
    enc_pass = urllib.parse.quote_plus(db_pass) if db_pass else ""
    reinit_host_port = f"{db_host}:{db_port}" if db_port and ":" not in db_host else db_host
    mysql_url = f"mysql+pymysql://{db_user}:{enc_pass}@{reinit_host_port}/{db_name}?charset=utf8mb4" if db_user else ""
    sqlite_url = f"sqlite:///{os.path.join(BASE_DIR, 'matchtracker.db')}"
    
    if reinit_use_sqlite:
        DATABASE_URL = sqlite_url
        conn_args = {"check_same_thread": False}
    else:
        DATABASE_URL = mysql_url
        conn_args = {}
        
    reinit_pool_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }
    if not reinit_use_sqlite:
        reinit_pool_kwargs["pool_size"] = 25
        reinit_pool_kwargs["max_overflow"] = 20

    engine = create_engine(
        DATABASE_URL,
        connect_args=conn_args if "sqlite" in DATABASE_URL else {},
        **reinit_pool_kwargs
    )
    SessionLocal.configure(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
