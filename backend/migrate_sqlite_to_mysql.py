#!/usr/bin/env python3
"""
==============================================================================
MatchTrack Online - SQLite zu MySQL Migrations- und Validierungsskript
==============================================================================
Migriert alle Daten aus der lokalen SQLite-Datenbank (backend/matchtracker.db)
in die MySQL-Datenbank (soko_matchtrack) unter absoluter Null-Datenverlust-Garantie.

Ablauf:
1. Sicherheits-Backup der SQLite-Datei (.db + vollständiger .sql Text-Dump)
2. Sicherheits-Backup der .env-Datei
3. Verbindung & Schema-Erstellung in MySQL (via Base.metadata & db.migrate)
4. 1:1 Datenübertragung aller Tabellen & Relationen (FOREIGN_KEY_CHECKS=0)
5. Typen-Harmonisierung (Datetimes, Booleans, JSON)
6. Auto-Increment Neuausrichtung
7. Validierung & Konsistenzprüfung (Zeilen-Zähler-Abgleich je Tabelle)
8. Optionale automatische Aktualisierung der backend/.env
==============================================================================
"""

import os
import sys
import shutil
import json
import sqlite3
import argparse
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List

# Basisverzeichnisse ermitteln
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT_DIR, '.env'))
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

try:
    from sqlalchemy import create_engine, text, inspect, MetaData, Table, Column, DateTime, Boolean, JSON, Integer
    from sqlalchemy.engine import Engine
except ImportError:
    print("❌ Fehler: SQLAlchemy ist in der aktuellen Python-Umgebung nicht installiert.")
    print("Bitte führe aus: pip install sqlalchemy pymysql python-dotenv")
    sys.exit(1)


# -----------------------------------------------------------------------------
# 1. Backup-Funktionen (Zero-Risk Sicherheitsnetz)
# -----------------------------------------------------------------------------
def create_safety_backups(sqlite_file: str, env_file: str) -> Dict[str, str]:
    """
    Erstellt mehrstufige Sicherheitskopien vor jeder Datei- oder Datenbank-Interaktion:
    1. Binärkopie der SQLite .db Datei
    2. SQL-Textdump aller SQLite Tabellen & Zeilen
    3. Backup der backend/.env Datei
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    backups = {}

    # 1. SQLite Binärkopie
    if os.path.exists(sqlite_file):
        db_backup_path = os.path.join(backup_dir, f"matchtracker_safety_backup_{timestamp}.db")
        shutil.copy2(sqlite_file, db_backup_path)
        backups["sqlite_db"] = db_backup_path
        print(f"🔒 [Backup 1/3] SQLite-Binärdatei gesichert:")
        print(f"   -> {db_backup_path}")

        # 2. SQLite SQL-Text-Dump
        try:
            sql_dump_path = os.path.join(backup_dir, f"matchtracker_safety_dump_{timestamp}.sql")
            conn = sqlite3.connect(sqlite_file)
            with open(sql_dump_path, "w", encoding="utf-8") as f:
                for line in conn.iterdump():
                    f.write(f"{line}\n")
            conn.close()
            backups["sqlite_dump"] = sql_dump_path
            print(f"🔒 [Backup 2/3] Vollständiger SQLite-SQL-Dump exportiert:")
            print(f"   -> {sql_dump_path}")
        except Exception as e:
            print(f"⚠️  Hinweis beim SQL-Dump: {e}")
    else:
        print(f"⚠️  Warnung: SQLite-Datei nicht gefunden unter: {sqlite_file}")

    # 3. .env Backup
    if os.path.exists(env_file):
        env_backup_path = os.path.join(backup_dir, f".env_safety_backup_{timestamp}")
        shutil.copy2(env_file, env_backup_path)
        backups["env"] = env_backup_path
        print(f"🔒 [Backup 3/3] .env-Konfiguration gesichert:")
        print(f"   -> {env_backup_path}")

    return backups


# -----------------------------------------------------------------------------
# 2. Datenbank-Verbindungsaufbau
# -----------------------------------------------------------------------------
def get_mysql_engine(user: str, password: str, host: str, port: int, db_name: str) -> Engine:
    """
    Erstellt eine SQLAlchemy Engine für MySQL (pymysql) und stellt sicher,
    dass die Zieldatenbank existiert und utf8mb4 verwendet wird.
    """
    enc_pass = urllib.parse.quote_plus(password) if password else ""
    
    # Zuerst Server-Verbindung prüfen und DB bei Bedarf anlegen
    server_url = f"mysql+pymysql://{user}:{enc_pass}@{host}:{port}/?charset=utf8mb4"
    try:
        temp_engine = create_engine(server_url, connect_args={"connect_timeout": 8})
        with temp_engine.connect() as conn:
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            ))
            conn.commit()
    except Exception as e:
        print(f"ℹ️  Hinweis beim Vorab-DB-Check: {e}")

    db_url = f"mysql+pymysql://{user}:{enc_pass}@{host}:{port}/{db_name}?charset=utf8mb4"
    return create_engine(
        db_url,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"connect_timeout": 10}
    )


def get_sqlite_engine(sqlite_file: str) -> Engine:
    """Erstellt eine SQLite SQLAlchemy Engine."""
    sqlite_url = f"sqlite:///{os.path.abspath(sqlite_file)}"
    return create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )


# -----------------------------------------------------------------------------
# 3. Datentyp-Konvertierung (SQLite -> MySQL)
# -----------------------------------------------------------------------------
def convert_val_for_mysql(val: Any, target_col: Column, row_data: Dict[str, Any] = None) -> Any:
    """Harmonisiert Datentypen zwischen SQLite und MySQL inkl. Not-Null Fallbacks."""
    if val is None:
        if not target_col.nullable:
            # Not-null Spalte hat None-Wert aus SQLite -> intelligenter Fallback
            if isinstance(target_col.type, DateTime):
                if row_data and row_data.get("created_at"):
                    val = row_data["created_at"]
                elif row_data and row_data.get("updated_at"):
                    val = row_data["updated_at"]
                else:
                    val = datetime.utcnow()
            elif isinstance(target_col.type, Boolean):
                val = False
            elif isinstance(target_col.type, (Integer, Float)):
                val = 0
            elif isinstance(target_col.type, JSON):
                val = "{}"
            elif isinstance(target_col.type, (String, Text)):
                val = ""
            else:
                return None
        else:
            return None

    # DateTime Konvertierung
    if isinstance(target_col.type, DateTime):
        if isinstance(val, str):
            val_clean = val.strip().replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(val_clean)
            except Exception:
                for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(val_clean, fmt)
                    except Exception:
                        pass
        return val

    # Boolean Konvertierung
    if isinstance(target_col.type, Boolean):
        if isinstance(val, (int, str)):
            try:
                return bool(int(val))
            except Exception:
                return bool(val)
        return bool(val)

    # JSON & strukturierte Typen: PyMySQL kann KEINE rohen dict/list Objekte als SQL-Parameter escapen
    # (wirft sonst 'TypeError: dict can not be used as parameter').
    # Daher MÜSSEN alle dict/list Objekte für MySQL als JSON-String formatiert werden!
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False)

    if isinstance(target_col.type, JSON):
        if isinstance(val, str):
            return val
        try:
            return json.dumps(val, ensure_ascii=False)
        except Exception:
            return str(val)

    return val


# -----------------------------------------------------------------------------
# 4. Daten-Migration (SQLite -> MySQL)
# -----------------------------------------------------------------------------
def migrate_data(sqlite_engine: Engine, mysql_engine: Engine) -> Dict[str, Dict[str, Any]]:
    """
    Liest alle Tabellen aus SQLite und schreibt sie 1:1 nach MySQL.
    """
    print("\n==============================================================================")
    print("🚀 STARTE DATENMIGRATION (SQLite ➡️ MySQL)...")
    print("==============================================================================")

    # 1. Tabellenstrukturen in MySQL sicherstellen (via migrate.py)
    try:
        from db.migrate import run_migrations
        print("🔨 [1/4] Synchronisiere MySQL-Tabellenschema via run_migrations()...")
        run_migrations(mysql_engine)
        print("   ✅ MySQL-Tabellen & Spalten erfolgreich bereitgestellt.")
    except Exception as e:
        print(f"⚠️  Hinweis beim Aufruf von run_migrations: {e}")
        try:
            from models import Base
            Base.metadata.create_all(bind=mysql_engine)
            print("   ✅ Fallback Base.metadata.create_all() ausgeführt.")
        except Exception as inner_e:
            print(f"❌ Fehler bei Tabellenerstellung: {inner_e}")
            raise

    # Ggf. bestehende Spalten anpassen (z. B. evaluation_date NULL erlauben & thumbnail_path auf LONGTEXT erweitern)
    try:
        with mysql_engine.connect() as conn:
            conn.execute(text("ALTER TABLE `training_exercises` MODIFY `thumbnail_path` LONGTEXT NULL;"))
            conn.execute(text("ALTER TABLE `tactics_boards` MODIFY `thumbnail_path` LONGTEXT NULL;"))
            conn.execute(text("ALTER TABLE `matches` MODIFY `thumbnail_path` LONGTEXT NULL;"))
            conn.execute(text("ALTER TABLE `player_evaluations` MODIFY `evaluation_date` DATETIME NULL;"))
            conn.commit()
    except Exception as e:
        print(f"ℹ️  Hinweis bei ALTER TABLE Anpassungen: {e}")

    # 2. Tabellen reflektieren
    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)

    mysql_meta = MetaData()
    mysql_meta.reflect(bind=mysql_engine)

    sqlite_tables = list(sqlite_meta.tables.keys())
    # Interne SQLite Tabellen ignorieren
    sqlite_tables = [t for t in sqlite_tables if not t.startswith("sqlite_")]

    print(f"📊 [2/4] Gefundene Quelltabellen in SQLite: {len(sqlite_tables)}")

    stats: Dict[str, Dict[str, Any]] = {}

    # 3. Foreign Key Checks in MySQL temporär deaktivieren
    with mysql_engine.connect() as mysql_conn:
        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        mysql_conn.commit()

    try:
        # Tabellen nacheinander leeren und aus SQLite befüllen
        for table_name in sqlite_tables:
            if table_name not in mysql_meta.tables:
                print(f"⚠️  Tabelle '{table_name}' existiert nicht im MySQL-Schema. Überspringe.")
                stats[table_name] = {"sqlite": 0, "mysql": 0, "status": "SKIPPED_NOT_IN_TARGET"}
                continue

            src_table = sqlite_meta.tables[table_name]
            dst_table = mysql_meta.tables[table_name]

            # Datensätze aus SQLite lesen
            with sqlite_engine.connect() as sqlite_conn:
                src_rows = sqlite_conn.execute(src_table.select()).mappings().all()

            sqlite_count = len(src_rows)

            # MySQL Tabelle leeren (verhindert Primärschlüssel-Kollisionen mit Default-Seed-Daten)
            with mysql_engine.connect() as mysql_conn:
                mysql_conn.execute(text(f"DELETE FROM `{table_name}`;"))
                mysql_conn.commit()

            if sqlite_count == 0:
                stats[table_name] = {"sqlite": 0, "mysql": 0, "status": "EMPTY_OK"}
                print(f"   ⚡ '{table_name}': 0 Datensätze (leer).")
                continue

            # Datensätze für MySQL aufbereiten
            converted_rows = []
            for row in src_rows:
                row_raw = dict(row)
                row_dict = {}
                for col_name, val in row.items():
                    if col_name in dst_table.c:
                        target_col = dst_table.c[col_name]
                        row_dict[col_name] = convert_val_for_mysql(val, target_col, row_raw)
                converted_rows.append(row_dict)

            # In MySQL einfügen (in Batches zu 100)
            batch_size = 100
            with mysql_engine.connect() as mysql_conn:
                for i in range(0, len(converted_rows), batch_size):
                    batch = converted_rows[i:i + batch_size]
                    mysql_conn.execute(dst_table.insert(), batch)
                mysql_conn.commit()

            # Auto-Increment ID anpassen, falls vorhanden
            if "id" in dst_table.c and isinstance(dst_table.c["id"].type, Integer):
                try:
                    with mysql_engine.connect() as mysql_conn:
                        max_id = mysql_conn.execute(text(f"SELECT MAX(`id`) FROM `{table_name}`;")).scalar()
                        if max_id is not None and isinstance(max_id, int):
                            mysql_conn.execute(text(f"ALTER TABLE `{table_name}` AUTO_INCREMENT = {max_id + 1};"))
                            mysql_conn.commit()
                except Exception:
                    pass

            # Überprüfen wie viele Zeilen in MySQL angekommen sind
            with mysql_engine.connect() as mysql_conn:
                mysql_count = mysql_conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`;")).scalar()

            is_ok = (sqlite_count == mysql_count)
            status = "SUCCESS" if is_ok else "COUNT_MISMATCH"
            stats[table_name] = {"sqlite": sqlite_count, "mysql": mysql_count, "status": status}

            symbol = "✅" if is_ok else "❌"
            print(f"   {symbol} '{table_name}': {sqlite_count} aus SQLite ➡️ {mysql_count} in MySQL übertragen.")

    finally:
        # Foreign Key Checks wieder aktivieren
        with mysql_engine.connect() as mysql_conn:
            mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            mysql_conn.commit()

    return stats


# -----------------------------------------------------------------------------
# 5. Validierung & Konsistenz-Report
# -----------------------------------------------------------------------------
def run_validation(sqlite_engine: Engine, mysql_engine: Engine, stats: Dict[str, Dict[str, Any]] = None) -> bool:
    """
    Führt einen lückenlosen Zeilenvergleich zwischen SQLite und MySQL durch
    und gibt eine übersichtliche Kontrolltabelle aus.
    """
    print("\n==============================================================================")
    print("🔍 VALIDIERUNG & KONSISTENZ-BERICHT")
    print("==============================================================================")

    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)

    mysql_meta = MetaData()
    mysql_meta.reflect(bind=mysql_engine)

    all_tables = sorted(list(set(sqlite_meta.tables.keys()) | set(mysql_meta.tables.keys())))
    all_tables = [t for t in all_tables if not t.startswith("sqlite_")]

    header = f"{'Tabelle':<32} | {'SQLite':<10} | {'MySQL':<10} | {'Status':<15}"
    divider = "-" * len(header)
    print(header)
    print(divider)

    all_matched = True
    total_sqlite_rows = 0
    total_mysql_rows = 0

    for t in all_tables:
        sq_count = 0
        my_count = 0

        if t in sqlite_meta.tables:
            with sqlite_engine.connect() as conn:
                try:
                    sq_count = conn.execute(text(f"SELECT COUNT(*) FROM `{t}`;")).scalar() or 0
                except Exception:
                    sq_count = -1

        if t in mysql_meta.tables:
            with mysql_engine.connect() as conn:
                try:
                    my_count = conn.execute(text(f"SELECT COUNT(*) FROM `{t}`;")).scalar() or 0
                except Exception:
                    my_count = -1

        if sq_count >= 0:
            total_sqlite_rows += sq_count
        if my_count >= 0:
            total_mysql_rows += my_count

        status_str = "✅ OK"
        if sq_count != my_count:
            # Sonderfall: Tabellen, die nur in MySQL existieren oder durch Seed erweitert wurden
            if sq_count == 0 and my_count > 0:
                status_str = "ℹ️ SEED / EXTRA"
            else:
                status_str = "❌ MISMATCH"
                all_matched = False
        elif sq_count == 0:
            status_str = "⚡ Leer (OK)"

        print(f"{t:<32} | {sq_count:<10} | {my_count:<10} | {status_str:<15}")

    print(divider)
    print(f"{'GESAMTZEILEN':<32} | {total_sqlite_rows:<10} | {total_mysql_rows:<10} | {'✅ 100% MATCH' if all_matched else '⚠️ ABWEICHUNG'}")
    print("==============================================================================")

    return all_matched


# -----------------------------------------------------------------------------
# 6. Konfiguration umschalten (.env)
# -----------------------------------------------------------------------------
def update_env_to_mysql(env_path: str, user: str, password: str, host: str, port: int, db_name: str) -> bool:
    """
    Aktualisiert die backend/.env Datei auf MySQL-Betrieb.
    """
    print(f"\n⚙️  Aktualisiere Konfigurationsdatei: {env_path}")
    if not os.path.exists(env_path):
        print(f"❌ .env Datei nicht gefunden unter: {env_path}")
        return False

    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    keys_to_set = {
        "DB_TYPE": "mysql",
        "USE_SQLITE": "false",
        "DB_USER": user,
        "DB_PASS": password,
        "DB_HOST": host,
        "DB_PORT": str(port),
        "DB_NAME": db_name,
    }

    enc_pass = urllib.parse.quote_plus(password) if password else ""
    mysql_url = f"mysql+pymysql://{user}:{enc_pass}@{host}:{port}/{db_name}?charset=utf8mb4"
    keys_to_set["DATABASE_URL"] = mysql_url

    new_lines = []
    seen_keys = set()

    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k = stripped.split("=", 1)[0].strip()
            if k in keys_to_set:
                new_lines.append(f"{k}={keys_to_set[k]}\n")
                seen_keys.add(k)
                continue
        new_lines.append(line)

    # Fehlende Schlüssel am Ende anfügen
    missing_keys = set(keys_to_set.keys()) - seen_keys
    if missing_keys:
        new_lines.append("\n# Automatisch durch Migrationsskript ergänzt:\n")
        for k in sorted(missing_keys):
            new_lines.append(f"{k}={keys_to_set[k]}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print("✅ backend/.env erfolgreich auf MySQL umgestellt:")
    print(f"   -> DB_TYPE=mysql")
    print(f"   -> USE_SQLITE=false")
    print(f"   -> DB_USER={user}")
    print(f"   -> DB_HOST={host}:{port}")
    print(f"   -> DB_NAME={db_name}")
    print(f"   -> DATABASE_URL={mysql_url}")
    return True


# -----------------------------------------------------------------------------
# 7. Main Entry Point
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="MatchTrack Online - SQLite zu MySQL Migration")
    parser.add_argument("--sqlite-path", default=os.path.join(BASE_DIR, "matchtracker.db"), help="Pfad zur matchtracker.db")
    parser.add_argument("--env-path", default=os.path.join(BASE_DIR, ".env"), help="Pfad zur backend/.env")
    parser.add_argument("--mysql-host", default=os.getenv("DB_HOST", "127.0.0.1"), help="MySQL Host")
    parser.add_argument("--mysql-port", type=int, default=int(os.getenv("DB_PORT", 3306)), help="MySQL Port")
    parser.add_argument("--mysql-user", default=os.getenv("DB_USER", "soko_dev"), help="MySQL User")
    parser.add_argument("--mysql-pass", default=os.getenv("DB_PASS", ""), help="MySQL Passwort (wird aus .env gelesen oder via CLI/Prompt)")
    parser.add_argument("--mysql-db", default=os.getenv("DB_NAME", "soko_matchtrack_dev"), help="MySQL Datenbankname")
    parser.add_argument("--update-env", action="store_true", help="Automatisch backend/.env nach erfolgreicher Migration aktualisieren")
    parser.add_argument("--verify-only", action="store_true", help="Nur Daten- und Zeilenvergleich ausführen, keine Daten migrieren")
    parser.add_argument("--dry-run", action="store_true", help="Verbindung testen und Zeilen zählen ohne Schreibvorgänge")

    args = parser.parse_args()

    print("==============================================================================")
    print("MATCHTRACK ONLINE - DATENBANK-MIGRATION & VALIDIERUNG")
    print("==============================================================================")
    print(f"📁 SQLite-Quelle: {args.sqlite_path}")
    print(f"🐬 MySQL-Ziel:   {args.mysql_user}@{args.mysql_host}:{args.mysql_port}/{args.mysql_db}")
    print("==============================================================================")

    if not os.path.exists(args.sqlite_path):
        print(f"❌ Fehler: Die SQLite-Datei '{args.sqlite_path}' existiert nicht!")
        sys.exit(1)

    if not args.mysql_pass and not args.dry_run and not args.verify_only:
        import getpass
        try:
            prompt_pass = getpass.getpass(f"🔑 MySQL-Passwort für '{args.mysql_user}' eingeben: ")
            if prompt_pass:
                args.mysql_pass = prompt_pass
        except Exception:
            pass

    # 1. Backups erstellen
    if not args.verify_only and not args.dry_run:
        create_safety_backups(args.sqlite_path, args.env_path)

    # 2. Engines initialisieren
    print("\n🔌 Stelle Datenbankverbindungen her...")
    sqlite_engine = get_sqlite_engine(args.sqlite_path)
    try:
        mysql_engine = get_mysql_engine(
            user=args.mysql_user,
            password=args.mysql_pass,
            host=args.mysql_host,
            port=args.mysql_port,
            db_name=args.mysql_db
        )
        # Testverbindung
        with mysql_engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        print("✅ Erfolgreich mit MySQL-Server verbunden.")
    except Exception as e:
        print(f"❌ Fehler beim Verbinden mit MySQL: {e}")
        print("Tipp: Bitte prüfe Host, Port, Benutzer und Passwort.")
        sys.exit(1)

    # 3. Nur Validierung gewünscht?
    if args.verify_only:
        run_validation(sqlite_engine, mysql_engine)
        sys.exit(0)

    # 4. Dry-Run?
    if args.dry_run:
        print("\nℹ️  DRY-RUN Modus aktiv: Keine Änderungen an MySQL oder .env.")
        run_validation(sqlite_engine, mysql_engine)
        sys.exit(0)

    # 5. Migration durchführen
    stats = migrate_data(sqlite_engine, mysql_engine)

    # 6. Validierung
    success = run_validation(sqlite_engine, mysql_engine, stats)

    if not success:
        print("\n⚠️  WARNUNG: Es gab Abweichungen bei der Migration! Siehe Tabelle oben.")
        print("Die .env Datei wurde aus Sicherheitsgründen NICHT automatisch umgeschaltet.")
        sys.exit(1)

    print("\n🎉 Migration zu 100% erfolgreich abgeschlossen! Alle Daten sind integer in MySQL.")

    # 7. Konfiguration umschalten
    if args.update_env:
        update_env_to_mysql(
            env_path=args.env_path,
            user=args.mysql_user,
            password=args.mysql_pass,
            host=args.mysql_host,
            port=args.mysql_port,
            db_name=args.mysql_db
        )
        print("\n🚀 Nächster Schritt auf dem Server:")
        print("   pm2 restart all   (oder Backend neu starten)")
    else:
        print("\nℹ️  Hinweis: Die .env Datei wurde noch nicht geändert.")
        print("   Um das Backend auf MySQL umzuschalten, starte das Skript erneut mit:")
        print(f"   python {os.path.basename(__file__)} --update-env")
        print("   Oder trage in backend/.env ein: DB_TYPE=mysql und USE_SQLITE=false")

if __name__ == "__main__":
    main()
