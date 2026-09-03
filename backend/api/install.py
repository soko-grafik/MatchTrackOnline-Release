import os
import sys
import uuid
import secrets
import subprocess
import urllib.parse
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.session import get_db, reinit_db_engine
from models.models import Base, User, UserRole, SystemSettings
from core.security import get_password_hash

router = APIRouter()

# Define lock file path
LOCK_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'setup.lock')

def check_not_installed():
    if os.path.exists(LOCK_FILE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Application is already installed."
        )

# Requests Models
class SetupDependenciesRequest(BaseModel):
    hosting_type: str = Field(..., description="Either 'cgi' or 'vps'")

class ConfigureModulesRequest(BaseModel):
    module_stitching_enabled: bool
    module_heatmap_enabled: bool
    module_video_color_enabled: bool
    module_hls_enabled: bool
    module_fisheye_enabled: bool

class ConfigureDBRequest(BaseModel):
    db_type: str = Field(..., description="Either 'sqlite' or 'mysql'")
    db_host: Optional[str] = "127.0.0.1"
    db_port: Optional[int] = 3306
    db_name: Optional[str] = "matchtracker"
    db_user: Optional[str] = ""
    db_pass: Optional[str] = ""

class CreateAdminRequest(BaseModel):
    username: str
    email: str
    password: str

class ConfigureAppRequest(BaseModel):
    app_name: str = "MatchTracker"
    app_url: str = "http://localhost:3000"
    timezone: str = "Europe/Berlin"
    smtp_host: Optional[str] = ""
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = ""
    smtp_pass: Optional[str] = ""
    smtp_from: Optional[str] = ""

# Helper to update .env file
def update_env_file(updates: dict):
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    
    # Read existing variables
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
    # Parse existing variables
    env_dict = {}
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped or line_stripped.startswith('#'):
            continue
        if '=' in line_stripped:
            parts = line_stripped.split('=', 1)
            env_dict[parts[0].strip()] = parts[1].strip()
            
    # Apply updates
    for k, v in updates.items():
        if v is None:
            continue
        v_str = str(v)
        # Handle quotes and special characters
        if any(c in v_str for c in [' ', '$', '?', '&', '!', '(', ')', '{', '}', '[', ']']):
            v_str = f'"{v_str.replace(chr(34), chr(92) + chr(34))}"'
        env_dict[k] = v_str
        
    # Write back to .env
    with open(env_path, 'w', encoding='utf-8') as f:
        for k, v in env_dict.items():
            f.write(f"{k}={v}\n")

# Endpoints
@router.get("/status")
def get_install_status():
    """Checks if the application has already been installed."""
    return {"installed": os.path.exists(LOCK_FILE)}

@router.post("/prereqs", dependencies=[Depends(check_not_installed)])
def check_prerequisites(custom_ffmpeg_path: Optional[str] = None):
    """Checks tech requirements: python, folders writeability, CGI capabilities, FFmpeg."""
    checks = []
    
    # 1. Python version check (FastAPI running means Python is active)
    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info.major == 3 and sys.version_info.minor >= 8
    checks.append({
        "id": "python",
        "name": "Python Version (>= 3.8)",
        "status": "success" if py_ok else "error",
        "details": f"Running Python {py_version}"
    })
    
    # 2. Write permissions
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    paths_to_check = {
        "uploads": os.path.join(backend_dir, "uploads"),
        "db_folder": backend_dir,
        "lib": os.path.join(backend_dir, "lib")
    }
    
    for key, path in paths_to_check.items():
        # Try to make directory if not exist
        os.makedirs(path, exist_ok=True)
        # Test write access by writing a dummy file
        test_file = os.path.join(path, f".install_test_{uuid.uuid4().hex}")
        writeable = False
        try:
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
            writeable = True
        except Exception:
            pass
            
        checks.append({
            "id": f"write_{key}",
            "name": f"Schreibrechte für {os.path.basename(path) if key != 'db_folder' else 'Backend-Stammverzeichnis'}",
            "status": "success" if writeable else "error",
            "details": f"Pfad: {path} ist {'schreibbar' if writeable else 'nicht schreibbar'}"
        })

    # 3. CGI capability / a2wsgi package
    cgi_capable = False
    try:
        import a2wsgi
        cgi_capable = True
    except ImportError:
        pass
    checks.append({
        "id": "cgi_pkg",
        "name": "CGI Support (a2wsgi Paket)",
        "status": "success" if cgi_capable else "warning",
        "details": "a2wsgi ist installiert" if cgi_capable else "a2wsgi fehlt (wird für Shared Webspace CGI benötigt)"
    })

    # 4. FFmpeg
    ffmpeg_ok = False
    ffmpeg_ver = ""
    ffmpeg_paths = []
    
    if custom_ffmpeg_path:
        ffmpeg_paths.append(custom_ffmpeg_path)
    ffmpeg_paths.extend([
        "ffmpeg", # global
        "/hp/bv/aa/oe/.local/bin/ffmpeg" # 1blu default
    ])
    
    tested_path = ""
    for path in ffmpeg_paths:
        try:
            res = subprocess.run([path, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
            if res.returncode == 0:
                ffmpeg_ok = True
                ffmpeg_ver = res.stdout.split('\n')[0]
                tested_path = path
                break
        except Exception:
            continue
            
    if ffmpeg_ok:
        try:
            update_env_file({"FFMPEG_PATH": tested_path})
        except Exception as e:
            print(f"Error saving FFMPEG_PATH to .env: {e}")
            
    checks.append({
        "id": "ffmpeg",
        "name": "FFmpeg Installation",
        "status": "success" if ffmpeg_ok else "error",
        "details": f"FFmpeg gefunden unter '{tested_path}' ({ffmpeg_ver})" if ffmpeg_ok else "FFmpeg konnte nicht ausgeführt werden (wird für HLS & Stitching benötigt)"
    })
    
    return {
        "success": all(c["status"] != "error" for c in checks),
        "checks": checks
    }

@router.post("/setup-dependencies", dependencies=[Depends(check_not_installed)])
def setup_dependencies(body: SetupDependenciesRequest):
    """Creates backend/lib and installs requirements in CGI context, or instructs for VPS."""
    if body.hosting_type == "vps":
        return {
            "success": True,
            "message": "VPS Modus ausgewählt. Abhängigkeiten müssen manuell via venv/SSH installiert werden."
        }
        
    # Shared Webspace (CGI)
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    lib_path = os.path.join(backend_dir, "lib")
    os.makedirs(lib_path, exist_ok=True)
    
    req_file = os.path.join(backend_dir, "requirements.txt")
    if not os.path.exists(req_file):
        return {
            "success": False,
            "reason": "missing_requirements",
            "message": "requirements.txt im Backend-Verzeichnis nicht gefunden."
        }
        
    # Attempt pip install
    try:
        # Run pip install with timeout to prevent blocking CGI
        process = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-t", lib_path, "-r", req_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15
        )
        
        if process.returncode == 0:
            return {
                "success": True,
                "message": "Abhängigkeiten erfolgreich in backend/lib installiert."
            }
        else:
            return {
                "success": False,
                "reason": "pip_failed",
                "message": f"Pip install fehlgeschlagen mit Code {process.returncode}.",
                "details": process.stderr
            }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "reason": "timeout",
            "message": "Pip install lief länger als 15s. Aufgrund von Hoster-RAM/Zeitlimits wird empfohlen, die Abhängigkeiten als ZIP-Archiv hochzuladen."
        }
    except Exception as e:
        return {
            "success": False,
            "reason": "exception",
            "message": f"Fehler bei der Installation der Abhängigkeiten: {str(e)}"
        }

@router.post("/configure-modules", dependencies=[Depends(check_not_installed)])
def configure_modules(body: ConfigureModulesRequest):
    """Verifies module packages importability and advises which modules can be enabled."""
    results = {}
    
    # Check cv2 + ultralytics
    stitching_ok = True
    try:
        import cv2
        import ultralytics
    except ImportError:
        stitching_ok = False
    results["stitching"] = {"available": stitching_ok, "packages": ["opencv-python-headless", "ultralytics"]}
    
    # Check numpy + matplotlib
    heatmap_ok = True
    try:
        import numpy
        import matplotlib
    except ImportError:
        heatmap_ok = False
    results["heatmap"] = {"available": heatmap_ok, "packages": ["numpy", "matplotlib"]}
    
    # Check cv2
    video_color_ok = True
    try:
        import cv2
    except ImportError:
        video_color_ok = False
    results["video_color"] = {"available": video_color_ok, "packages": ["opencv-python-headless"]}
    
    # HLS conversion check (requires subprocess/ffmpeg)
    results["hls"] = {"available": True, "packages": ["ffmpeg"]}
    
    # Fisheye correction (cv2)
    fisheye_ok = True
    try:
        import cv2
    except ImportError:
        fisheye_ok = False
    results["fisheye"] = {"available": fisheye_ok, "packages": ["opencv-python-headless"]}
    
    return {
        "success": True,
        "availability": results
    }

@router.post("/configure-db", dependencies=[Depends(check_not_installed)])
def configure_db(body: ConfigureDBRequest):
    """Tests DB credentials and writes them to .env."""
    if body.db_type == "sqlite":
        # SQLite check is always successful if directories are writeable
        update_env_file({
            "DB_TYPE": "sqlite",
            "USE_SQLITE": "true"
        })
        # Re-initialize DB configuration
        reinit_db_engine()
        return {"success": True, "message": "SQLite konfiguriert."}
        
    elif body.db_type == "mysql":
        if not body.db_user or not body.db_name:
            raise HTTPException(status_code=400, detail="User und Datenbankname werden für MySQL benötigt.")
            
        encoded_pass = urllib.parse.quote_plus(body.db_pass or "")
        url = f"mysql+pymysql://{body.db_user}:{encoded_pass}@{body.db_host}:{body.db_port}/{body.db_name}"
        
        try:
            engine = create_engine(url, connect_args={"connect_timeout": 5})
            conn = engine.connect()
            conn.close()
        except Exception as e:
            return {
                "success": False,
                "error": f"Verbindung zur MySQL-Datenbank fehlgeschlagen: {str(e)}"
            }
            
        update_env_file({
            "DB_TYPE": "mysql",
            "USE_SQLITE": "false",
            "DB_HOST": body.db_host,
            "DB_PORT": body.db_port,
            "DB_NAME": body.db_name,
            "DB_USER": body.db_user,
            "DB_PASS": body.db_pass or ""
        })
        reinit_db_engine()
        return {"success": True, "message": "MySQL-Verbindung erfolgreich hergestellt und gespeichert."}
        
    raise HTTPException(status_code=400, detail="Ungültiger Datenbank-Typ.")

@router.post("/seed-db", dependencies=[Depends(check_not_installed)])
def seed_database(body: ConfigureModulesRequest, db: Session = Depends(get_db)):
    """Initializes tables and configures modules inside SystemSettings."""
    try:
        # Re-init db engine just in case the db settings were changed in the previous step
        reinit_db_engine()
        
        # Create all tables
        from db.session import engine
        Base.metadata.create_all(bind=engine)
        
        # Setup settings
        settings = db.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings(id=1)
            db.add(settings)
            
        settings.module_stitching_enabled = body.module_stitching_enabled
        settings.module_heatmap_enabled = body.module_heatmap_enabled
        settings.module_video_color_enabled = body.module_video_color_enabled
        settings.module_hls_enabled = body.module_hls_enabled
        settings.module_fisheye_enabled = body.module_fisheye_enabled
        
        db.commit()
        return {"success": True, "message": "Datenbanktabellen erstellt und Module eingerichtet."}
    except Exception as e:
        return {"success": False, "error": f"Fehler beim Erstellen der Tabellen: {str(e)}"}

@router.post("/create-admin", dependencies=[Depends(check_not_installed)])
def create_admin(body: CreateAdminRequest, db: Session = Depends(get_db)):
    """Creates the first administrator account."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Das Passwort muss mindestens 6 Zeichen lang sein.")
        
    # Check if admin already exists
    existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if existing_admin:
        return {"success": True, "message": "Ein Administrator existiert bereits."}
        
    # Check username/email conflicts
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Benutzername bereits vergeben.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="E-Mail-Adresse bereits vergeben.")
        
    hashed_password = get_password_hash(body.password)
    admin_user = User(
        id=str(uuid.uuid4()),
        username=body.username,
        email=body.email,
        hashed_password=hashed_password,
        role=UserRole.ADMIN,
        is_approved=1
    )
    db.add(admin_user)
    db.commit()
    
    return {"success": True, "message": "Administrator erfolgreich erstellt."}

@router.post("/configure-app", dependencies=[Depends(check_not_installed)])
def configure_app(body: ConfigureAppRequest):
    """Saves app configurations and sets up SECRET_KEY if missing."""
    updates = {
        "APP_NAME": body.app_name,
        "APP_URL": body.app_url,
        "TIMEZONE": body.timezone
    }
    
    # SMTP options
    if body.smtp_host:
        updates.update({
            "SMTP_HOST": body.smtp_host,
            "SMTP_PORT": body.smtp_port,
            "SMTP_USER": body.smtp_user or "",
            "SMTP_PASS": body.smtp_pass or "",
            "SMTP_FROM": body.smtp_from or ""
        })
        
    # Generate SECRET_KEY if not already present in environment or .env
    secret_key = os.environ.get("SECRET_KEY")
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    secret_in_file = False
    
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            if "SECRET_KEY=" in f.read():
                secret_in_file = True
                
    if not secret_key and not secret_in_file:
        updates["SECRET_KEY"] = secrets.token_hex(32)
        
    update_env_file(updates)
    return {"success": True, "message": "Anwendungseinstellungen erfolgreich gespeichert."}

@router.post("/complete", dependencies=[Depends(check_not_installed)])
def complete_installation():
    """Generates setup.lock file to lock down installer."""
    try:
        with open(LOCK_FILE, 'w', encoding='utf-8') as f:
            f.write("MatchTracker installed successfully.")
        return {"success": True, "message": "Installation erfolgreich abgeschlossen und gesperrt."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Konnte setup.lock nicht schreiben: {str(e)}")
