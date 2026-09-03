#!/usr/bin/env python3
import os
import uuid
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from models import User, UserRole
from core.security import get_password_hash

def main():
    print("==========================================")
    print("👤 ADMIN BENUTZER ERSTELLEN / ZURÜCKSETZEN")
    print("==========================================")
    
    db_type = os.getenv("DB_TYPE", "sqlite")
    use_sqlite = db_type == "sqlite" or os.getenv("USE_SQLITE") == "true"
    
    if use_sqlite:
        url = f"sqlite:///{os.path.join(BASE_DIR, 'matchtracker.db')}"
    else:
        db_user = os.getenv("DB_USER")
        db_pass = os.getenv("DB_PASS")
        db_host = os.getenv("DB_HOST", "127.0.0.1")
        db_name = os.getenv("DB_NAME")
        enc_pass = urllib.parse.quote_plus(db_pass) if db_pass else ""
        url = f"mysql+pymysql://{db_user}:{enc_pass}@{db_host}/{db_name}"

    engine = create_engine(url, connect_args={"check_same_thread": False} if "sqlite" in url else {})
    Session = sessionmaker(bind=engine)
    db = Session()

    admin = db.query(User).filter(User.username == 'admin').first()
    if not admin:
        admin = User(
            id=str(uuid.uuid4()),
            username="admin",
            email="admin@matchtrack.de",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            is_approved=1
        )
        db.add(admin)
        print("✅ Neuer Admin-Benutzer 'admin' wurde erfolgreich angelegt!")
    else:
        admin.hashed_password = get_password_hash("admin123")
        admin.is_approved = 1
        admin.role = UserRole.ADMIN
        print("✅ Passwort des bestehenden Admin-Benutzers 'admin' wurde auf 'admin123' zurückgesetzt!")
    
    db.commit()
    print("\n------------------------------------------")
    print("🔑 LOGINDATEN:")
    print(" -> Benutzername: admin")
    print(" -> Passwort:     admin123")
    print("------------------------------------------\n")
    db.close()

if __name__ == "__main__":
    main()
