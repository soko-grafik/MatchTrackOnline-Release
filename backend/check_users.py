#!/usr/bin/env python3
import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from models import User

def check_and_fix_db(url, label):
    print(f"\n==========================================")
    print(f"🔍 Prüfe Datenbank: {label}")
    print(f"   URL: {url.split('@')[-1] if '@' in url else url}")
    print("==========================================")
    try:
        engine = create_engine(url, connect_args={"check_same_thread": False} if "sqlite" in url else {})
        Session = sessionmaker(bind=engine)
        db = Session()
        users = db.query(User).all()
        if users:
            print(f"✅ GEFUNDEN: {len(users)} Benutzer in {label}:")
            for u in users:
                print(f"   -> Username: '{u.username}' | Email: '{u.email}' | Role: '{u.role}' | Approved: {u.is_approved}")
            
            # Reset admin password to admin123 and approve
            admin = db.query(User).filter((User.username == 'admin') | (User.role == 'ADMIN')).first() or users[0]
            from core.security import get_password_hash
            admin.hashed_password = get_password_hash("admin123")
            admin.is_approved = 1
            db.commit()
            print(f"\n🔑 PASSWORT-RESET IN {label}:")
            print(f"   -> Username: {admin.username}")
            print(f"   -> Passwort: admin123")
            print(f"   -> Status: Freigeschaltet (is_approved=1)")
        else:
            print(f"⚠️  Keine Benutzer in {label} vorhanden.")
        db.close()
        return users
    except Exception as e:
        print(f"❌ Fehler bei {label}: {e}")
        return []

def main():
    sqlite_url = f"sqlite:///{os.path.join(BASE_DIR, 'matchtracker.db')}"
    
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASS")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_name = os.getenv("DB_NAME")
    
    enc_pass = urllib.parse.quote_plus(db_pass) if db_pass else ""
    mysql_url = f"mysql+pymysql://{db_user}:{enc_pass}@{db_host}/{db_name}" if db_user and db_name else None

    print("\n🔍 STARTE DATENBANK-DIAGNOSE...")
    sqlite_users = check_and_fix_db(sqlite_url, "SQLite (matchtracker.db)")
    if mysql_url:
        mysql_users = check_and_fix_db(mysql_url, "MySQL Database")

if __name__ == "__main__":
    main()
