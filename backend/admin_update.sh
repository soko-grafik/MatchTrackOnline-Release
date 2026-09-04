#!/bin/bash
# ==============================================================================
# MatchTrack Online - Admin Update Execution Script
# Runs git fetch, git pull, DB migration, Next.js build & PM2 reload
# ==============================================================================

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$BACKEND_DIR/.." && pwd)"
WEB_DIR="$PROJECT_DIR/web"

LOG_FILE="/tmp/matchtrack_update.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "--- UPDATE STARTED AT $(date) ---"
echo "[1/4] Checking out Git & pulling latest changes..."
cd "$PROJECT_DIR"

export GIT_TERMINAL_PROMPT=0

if [ -d ".git" ]; then
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -z "$CURRENT_REMOTE" ]; then
        git remote add origin "${UPDATE_REPO_URL:-https://github.com/soko-grafik/MatchTrackOnline-Public.git}" 2>/dev/null || true
    fi

    # Sparse-Checkout konfigurieren (schließt chats, docs, scripts, plans & Release-Skripte aus)
    git config core.sparseCheckout true
    mkdir -p .git/info
    cat << 'EOF' > .git/info/sparse-checkout
/*
!/chats/
!/chat/
!/docs/
!/scripts/
!/plans/
!/.idea/
!/build_production.bat
!/build_production.sh
!/update_live.sh
!/delete_organizer_matches.py
EOF

    git checkout -- web/public/sw.js web/public/workbox-*.js 2>/dev/null || true
    git fetch origin main || true
    git reset --hard origin/main || git pull origin main

    # Sicherstellen, dass ausgeschlossene Dateien/Ordner nicht im Dateisystem liegen
    rm -rf chats chat docs scripts plans .idea build_production.bat build_production.sh update_live.sh delete_organizer_matches.py 2>/dev/null || true

    chmod +x "$PROJECT_DIR"/*.sh "$BACKEND_DIR"/*.sh 2>/dev/null || true
    echo "Git pull completed successfully."
else
    echo "No .git repository found. Skipping git pull."
fi

echo "[2/4] Updating Backend & Database..."
cd "$BACKEND_DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

REQ_HASH_FILE="$PROJECT_DIR/.backend_requirements_hash"
CURRENT_REQ_HASH=""
if command -v md5sum >/dev/null 2>&1; then
    CURRENT_REQ_HASH=$(md5sum requirements.txt 2>/dev/null | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
    CURRENT_REQ_HASH=$(sha256sum requirements.txt 2>/dev/null | awk '{print $1}')
fi

if [ -f "$REQ_HASH_FILE" ] && [ -n "$CURRENT_REQ_HASH" ] && [ "$CURRENT_REQ_HASH" = "$(cat "$REQ_HASH_FILE" 2>/dev/null)" ]; then
    echo "Python packages up to date. Skipping pip install."
else
    echo "Updating Python packages..."
    pip install -r requirements.txt --quiet || true
    if [ -n "$CURRENT_REQ_HASH" ]; then
        echo "$CURRENT_REQ_HASH" > "$REQ_HASH_FILE"
    fi
fi

python3 -c "from db.session import engine, SessionLocal; from models import Base; from db.init_teams import seed_and_migrate_teams; from sqlalchemy import text; c = engine.connect(); c.execute(text('SET FOREIGN_KEY_CHECKS=0;')) if 'mysql' in str(engine.url) else None; c.commit(); c.close(); Base.metadata.create_all(bind=engine); c2 = engine.connect(); c2.execute(text('SET FOREIGN_KEY_CHECKS=1;')) if 'mysql' in str(engine.url) else None; c2.commit(); c2.close(); db=SessionLocal(); seed_and_migrate_teams(db); db.close()" || true

echo "Backend & DB updated successfully."

echo "[3/4] Installing dependencies & building Next.js Frontend..."
cd "$WEB_DIR"

PACKAGE_HASH_FILE="$PROJECT_DIR/.web_package_hash"
CURRENT_PACKAGE_HASH=""
if command -v md5sum >/dev/null 2>&1; then
    CURRENT_PACKAGE_HASH=$(md5sum package.json 2>/dev/null | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
    CURRENT_PACKAGE_HASH=$(sha256sum package.json 2>/dev/null | awk '{print $1}')
fi

if [ -d "node_modules" ] && [ -f "$PACKAGE_HASH_FILE" ] && [ -n "$CURRENT_PACKAGE_HASH" ] && [ "$CURRENT_PACKAGE_HASH" = "$(cat "$PACKAGE_HASH_FILE" 2>/dev/null)" ]; then
    echo "Node modules up to date. Skipping npm install."
else
    echo "Installing Node modules..."
    npm install --silent || true
    if [ -n "$CURRENT_PACKAGE_HASH" ]; then
        echo "$CURRENT_PACKAGE_HASH" > "$PACKAGE_HASH_FILE"
    fi
fi

npm run build

echo "[4/4] Reloading PM2 live services..."
if command -v pm2 &> /dev/null; then
    pm2 reload all || pm2 restart all || true
    echo "PM2 services reloaded."
fi

echo "--- UPDATE COMPLETED SUCCESSFULLY AT $(date) ---"
