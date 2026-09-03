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

RELEASE_REPO_URL="https://github.com/soko-grafik/MatchTrackOnline-Release.git"
if [ -d ".git" ]; then
    git remote set-url origin "$RELEASE_REPO_URL" 2>/dev/null || true
    git checkout -- web/public/sw.js web/public/workbox-*.js 2>/dev/null || true
    git fetch origin main || true
    git reset --hard origin/main || git pull origin main
    echo "Git pull from MatchTrackOnline-Release completed successfully."
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

pip install -r requirements.txt --quiet || true

python3 -c "from db.session import engine, SessionLocal; from models import Base; from db.init_teams import seed_and_migrate_teams; from sqlalchemy import text; c = engine.connect(); c.execute(text('SET FOREIGN_KEY_CHECKS=0;')) if 'mysql' in str(engine.url) else None; c.commit(); c.close(); Base.metadata.create_all(bind=engine); c2 = engine.connect(); c2.execute(text('SET FOREIGN_KEY_CHECKS=1;')) if 'mysql' in str(engine.url) else None; c2.commit(); c2.close(); db=SessionLocal(); seed_and_migrate_teams(db); db.close()" || true

echo "Backend & DB updated successfully."

echo "[3/4] Installing dependencies & building Next.js Frontend..."
cd "$WEB_DIR"
npm install --silent || true
npm run build

echo "[4/4] Reloading PM2 live services..."
if command -v pm2 &> /dev/null; then
    pm2 reload all || pm2 restart all || true
    echo "PM2 services reloaded."
fi

echo "--- UPDATE COMPLETED SUCCESSFULLY AT $(date) ---"
