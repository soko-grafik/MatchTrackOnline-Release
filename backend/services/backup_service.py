import os
import io
import ftplib
import sqlite3
from datetime import datetime
from sqlalchemy.orm import Session
from db.session import DB_PATH
from models import SystemSettings


def generate_sql_dump() -> str:
    """
    Erstellt einen vollständigen SQL-Dump der SQLite-Datenbank.
    """
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        dump_io = io.StringIO()
        for line in conn.iterdump():
            dump_io.write(f"{line}\n")
        conn.close()
        return dump_io.getvalue()
    
    if "sqlite" in str(engine.url):
        db_file = str(engine.url).replace("sqlite:///", "")
        if os.path.exists(db_file):
            conn = sqlite3.connect(db_file)
            dump_io = io.StringIO()
            for line in conn.iterdump():
                dump_io.write(f"{line}\n")
            conn.close()
            return dump_io.getvalue()

    raise FileNotFoundError(f"Datenbankdatei nicht gefunden unter: {DB_PATH}")


def upload_to_ftp(host: str, port: int, user: str, password: str, remote_path: str, filename: str, content: bytes):
    """
    Lädt eine Datei auf den angegebenen FTP-Server hoch.
    """
    if not host or not user:
        raise ValueError("FTP Host und Benutzername sind erforderlich.")

    ftp = ftplib.FTP()
    ftp.connect(host=host, port=port or 21, timeout=30)
    ftp.login(user=user, passwd=password or "")

    # Ziel-Verzeichnis sicherstellen / durchwechseln
    if remote_path:
        remote_dirs = [d for d in remote_path.strip("/").split("/") if d]
        for d in remote_dirs:
            try:
                ftp.cwd(d)
            except ftplib.error_perm:
                try:
                    ftp.mkd(d)
                    ftp.cwd(d)
                except Exception:
                    pass

    # Datei hochladen
    file_obj = io.BytesIO(content)
    ftp.storbinary(f"STOR {filename}", file_obj)
    ftp.quit()


def run_ftp_backup_job(db: Session) -> dict:
    """
    Führt ein manuelles oder automatisches FTP-Backup der Datenbank aus.
    """
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if not settings:
        raise ValueError("SystemSettings nicht gefunden.")

    if not settings.ftp_host or not settings.ftp_user:
        raise ValueError("FTP-Zugangsdaten sind unvollständig konfiguriert.")

    try:
        sql_dump = generate_sql_dump()
        dump_bytes = sql_dump.encode('utf-8')
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"matchtrack_backup_{timestamp_str}.sql"

        upload_to_ftp(
            host=settings.ftp_host,
            port=settings.ftp_port or 21,
            user=settings.ftp_user,
            password=settings.ftp_password,
            remote_path=settings.ftp_path or "/backups",
            filename=filename,
            content=dump_bytes
        )

        settings.ftp_last_backup_at = datetime.utcnow()
        settings.ftp_last_backup_status = "SUCCESS"
        db.commit()

        return {
            "status": "success",
            "message": f"Backup '{filename}' wurde erfolgreich per FTP hochgeladen.",
            "timestamp": settings.ftp_last_backup_at.isoformat()
        }
    except Exception as e:
        error_msg = f"ERROR: {str(e)}"
        settings.ftp_last_backup_at = datetime.utcnow()
        settings.ftp_last_backup_status = error_msg[:250]
        db.commit()
        raise Exception(f"FTP-Backup fehlgeschlagen: {str(e)}")
