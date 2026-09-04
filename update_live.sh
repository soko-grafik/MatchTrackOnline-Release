#!/bin/bash
# ==============================================================================
# MatchTrack Online - Live System Update Skript (PM2 Managed VPS)
# ==============================================================================

set -e

echo "=============================================================================="
echo "🚀 Starte Update-Prozess für MatchTrack Online (PM2 Live System)..."
echo "=============================================================================="

# Basis-Pfade ermitteln
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
WEB_DIR="$PROJECT_DIR/web"

cd "$PROJECT_DIR"

# 1. Git Pull (aus dem öffentlichen MatchTrackOnline-Release Repo)
RELEASE_REPO_URL="https://github.com/soko-grafik/MatchTrackOnline-Release.git"
if [ -d ".git" ]; then
    echo "📥 [1/4] Hole neueste Quellcode-Änderungen aus MatchTrackOnline-Release..."
    git remote set-url origin "$RELEASE_REPO_URL" 2>/dev/null || true
    git checkout -- web/public/sw.js web/public/workbox-*.js 2>/dev/null || true
    git fetch origin main || true
    git reset --hard origin/main || git pull origin main || git pull
    # Sicherstellen, dass alle Shell-Skripte nach dem Pull ausführbar bleiben
    chmod +x "$PROJECT_DIR"/*.sh "$BACKEND_DIR"/*.sh 2>/dev/null || true
else
    echo "ℹ️  [1/4] Kein Git-Repository erkannt. Fahre mit vorhandenen Quellcodedateien fort."
fi

# 2. Backend aktualisieren & DB migrieren
echo "🐍 [2/4] Aktualisiere Backend & Datenbank..."
cd "$BACKEND_DIR"

# Virtuelle Python-Umgebung aktivieren
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
else
    echo "⚠️  Kein 'venv' Ordner gefunden. Verwende System-Python."
fi

# Nur Pakete installieren, wenn requirements.txt sich geändert hat
REQ_HASH_FILE="$PROJECT_DIR/.backend_requirements_hash"
CURRENT_REQ_HASH=""
if command -v md5sum >/dev/null 2>&1; then
    CURRENT_REQ_HASH=$(md5sum requirements.txt 2>/dev/null | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
    CURRENT_REQ_HASH=$(sha256sum requirements.txt 2>/dev/null | awk '{print $1}')
fi

if [ -f "$REQ_HASH_FILE" ] && [ -n "$CURRENT_REQ_HASH" ] && [ "$CURRENT_REQ_HASH" = "$(cat "$REQ_HASH_FILE" 2>/dev/null)" ]; then
    echo "   ⚡ Keine Änderungen an requirements.txt. Überspringe 'pip install'."
else
    echo "   -> Änderungen an requirements.txt erkannt (oder Erstlauf). Installiere Python-Pakete..."
    pip install -r requirements.txt --quiet
    if [ -n "$CURRENT_REQ_HASH" ]; then
        echo "$CURRENT_REQ_HASH" > "$REQ_HASH_FILE"
    fi
    echo "   ✅ Python-Pakete auf dem neuesten Stand."
fi

echo "   -> Führe Datenbank-Tabellenerstellung und Mannschafts-Migration aus..."
python -c "from db.session import engine, SessionLocal; from models import Base; from db.init_teams import seed_and_migrate_teams; from sqlalchemy import text; c = engine.connect(); c.execute(text('SET FOREIGN_KEY_CHECKS=0;')) if 'mysql' in str(engine.url) else None; c.commit(); c.close(); Base.metadata.create_all(bind=engine); c2 = engine.connect(); c2.execute(text('SET FOREIGN_KEY_CHECKS=1;')) if 'mysql' in str(engine.url) else None; c2.commit(); c2.close(); db=SessionLocal(); seed_and_migrate_teams(db); db.close()"
echo "   ✅ Datenbank & Mannschaften auf neuestem Stand."

# 3. Frontend Pakete installieren & Next.js kompilieren
echo "🌐 [3/4] Aktualisiere & Baue Web Frontend (Next.js)..."
cd "$WEB_DIR"

# Nur npm install ausführen, wenn package.json sich geändert hat oder node_modules fehlt
PACKAGE_HASH_FILE="$PROJECT_DIR/.web_package_hash"
CURRENT_PACKAGE_HASH=""
if command -v md5sum >/dev/null 2>&1; then
    CURRENT_PACKAGE_HASH=$(md5sum package.json 2>/dev/null | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
    CURRENT_PACKAGE_HASH=$(sha256sum package.json 2>/dev/null | awk '{print $1}')
fi

if [ -d "node_modules" ] && [ -f "$PACKAGE_HASH_FILE" ] && [ -n "$CURRENT_PACKAGE_HASH" ] && [ "$CURRENT_PACKAGE_HASH" = "$(cat "$PACKAGE_HASH_FILE" 2>/dev/null)" ]; then
    echo "   ⚡ Keine Änderungen an package.json (Node-Module bereits aktuell). Überspringe 'npm install'."
else
    echo "   -> Änderungen an package.json erkannt (oder Erstlauf/fehlende node_modules). Installiere Node-Module..."
    npm install --silent
    if [ -n "$CURRENT_PACKAGE_HASH" ]; then
        echo "$CURRENT_PACKAGE_HASH" > "$PACKAGE_HASH_FILE"
    fi
    echo "   ✅ Node-Module erfolgreich installiert."
fi

echo "   -> Kompiliere Next.js Production Build..."
npm run build
echo "   ✅ Frontend erfolgreich kompiliert."

# 4. PM2 Dienste neu starten
echo "🔄 [4/4] Starte PM2-Dienste neu..."

if command -v pm2 &> /dev/null; then
    echo "   -> Neu Laden aller PM2 Dienste..."
    pm2 reload all || pm2 restart all || echo "⚠️ PM2 konnte Dienste nicht automatisch neu laden."
    echo "   -> PM2 Status:"
    pm2 status
else
    echo "⚠️ PM2 wurde auf dem System nicht gefunden. Bitte starte die Dienste manuell neu."
fi

echo "=============================================================================="
echo "✅ UPDATE ERFOLGREICH ABGESCHLOSSEN!"
echo "   - Datenbank-Migration & Mannschafts-Seeding durchgeführt"
echo "   - Next.js Frontend frisch gebaut"
echo "   - Alle PM2 Live-Dienste neu gestartet"
echo "=============================================================================="
