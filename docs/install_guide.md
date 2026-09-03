# Installations- & Serveranleitung (VPS Deployment)

Diese Anleitung beschreibt die Voraussetzungen, die lokale Einrichtung sowie das vollständige Deployment der MatchTrack-Anwendung auf einem Linux VPS (z. B. Contabo VPS) mit Nginx, PM2, Uvicorn und Systemd.

---

## 1. Systemanforderungen & Voraussetzungen

Folgende Software muss auf dem Server bzw. dem lokalen Rechner installiert sein:
* **Python**: Version 3.10 oder höher (inkl. `pip` und `venv`)
* **Node.js**: Version 18 oder höher (inkl. `npm`)
* **FFmpeg**: Muss im Systempfad registriert sein und Support für `libx264` und `aac` besitzen.
* **Datenbank**: SQLite (Standard) oder MySQL / MariaDB (für größere VPS-Deployments empfohlen)

---

## 2. Lokale Entwicklung (Development Setup)

### 2.1. Backend einrichten
1. Navigiere in das `backend/`-Verzeichnis:
   ```bash
   cd backend/
   ```
2. Erstelle und aktiviere eine virtuelle Umgebung:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```
3. Installiere die Python-Abhängigkeiten:
   ```bash
   pip install -r requirements.txt
   ```
4. Erstelle eine `.env`-Datei basierend auf der `.env.example` und trage deine Parameter ein.
5. Starte den FastAPI-Server im Entwicklungsmodus:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2.2. Frontend einrichten
1. Navigiere in das `web/`-Verzeichnis:
   ```bash
   cd web/
   ```
2. Installiere die Node-Abhängigkeiten:
   ```bash
   npm install
   ```
3. Starte den Next.js-Entwicklungsserver:
   ```bash
   npm run dev
   ```
4. Öffne [http://localhost:3000](http://localhost:3000) im Browser.

---

## 3. VPS Server-Deployment (Produktionsumgebung)

Für den Produktivbetrieb auf einem VPS nutzen wir folgende Server-Struktur:
* **Next.js Frontend**: Verwaltet von **PM2** (Node.js Process Manager) auf Port `3000`.
* **FastAPI Backend**: Verwaltet von **Systemd** als Hintergrund-Dienst auf Port `8000`.
* **KI- & Transkodierung-Worker**: Verwaltet von **Systemd** als Hintergrund-Prozess (`worker.py`).
* **Nginx**: Agiert als Reverse Proxy, verteilt Anfragen an Port 3000/8000 und liefert Mediendaten direkt statisch aus.

---

### 3.1. Umgebungsvariablen (.env) konfigurieren
Erstelle im Ordner `backend/` auf dem Server eine `.env`-Datei. Generiere vor allem einen sicheren Secret Key:

```bash
# Befehl zur Generierung eines sicheren Keys
openssl rand -hex 32
```

Inhalt der `.env`:
```ini
DB_TYPE=mysql  # Oder "sqlite"
DB_USER=dein_db_user
DB_PASS=dein_sicheres_passwort
DB_HOST=127.0.0.1
DB_NAME=dein_db_name

SECRET_KEY=generierter_jwt_secret_key
```

---

### 3.2. Backend als Systemd-Dienst einrichten

1. Erstelle eine Service-Datei für die FastAPI-Web-API:
   ```bash
   sudo nano /etc/systemd/system/matchtrack-backend.service
   ```
   **Inhalt:**
   ```ini
   [Unit]
   Description=MatchTrack FastAPI Backend
   After=network.target

   [Service]
   User=user
   WorkingDirectory=/home/user/web/domain/public_html/backend
   ExecStart=/home/user/web/domain/public_html/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. Erstelle eine Service-Datei für den KI- & Transkodierungs-Worker (Laufwege & HLS):
   ```bash
   sudo nano /etc/systemd/system/matchtrack-worker.service
   ```
   **Inhalt:**
   ```ini
   [Unit]
   Description=MatchTrack KI- & Video-Worker
   After=network.target

   [Service]
   User=user
   WorkingDirectory=/home/user/web/domain/public_html/backend
   ExecStart=/home/user/user/domain/public_html/backend/venv/bin/python worker.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. Starte und aktiviere beide Dienste:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start matchtrack-backend
   sudo systemctl enable matchtrack-backend
   sudo systemctl start matchtrack-worker
   sudo systemctl enable matchtrack-worker
   ```

---

### 3.3. Frontend mit PM2 einrichten

1. Gehe in den `web/`-Ordner auf dem Server.
2. Installiere die Module und kompiliere das Projekt:
   ```bash
   npm install
   npm run build
   ```
3. Starte die Anwendung über PM2:
   ```bash
   pm2 start npm --name "matchtrack-frontend" -- start
   pm2 save
   ```

---

### 3.4. Nginx Reverse Proxy einrichten
Passe die Nginx-Konfigurationsdatei deiner Domain (z.B. `/etc/nginx/sites-available/default` oder in HestiaCP) wie folgt an:

```nginx
server {
    server_name domain www.domain;
    root /home/user/web/domain/public_html;

    # 1. Statische Next.js Assets direkt ausliefern (Performance)
    location /_next/static/ {
        alias /home/user/web/domain/public_html/web/.next/static/;
        expires 365d;
        access_log off;
    }

    # 2. Upload-Videos direkt als statische Dateien ausliefern
    location /backend/uploads/ {
        alias /home/user/web/domain/public_html/backend/uploads/;
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
        expires 30d;
    }

    # 3. API-Aufrufe an den FastAPI-Dienst (Port 8000) weiterleiten
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 4. Alle normalen Seitenaufrufe an Next.js (Port 3000) weiterleiten
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Starte Nginx danach neu:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Updates auf dem Live-System durchführen

Um das Live-System auf dem VPS jederzeit schnell und sicher mit den neuesten Funktionen (inkl. Datenbank-Migration & Mannschafts-Seeding) zu aktualisieren, führe einfach das Skript [`update_live.sh`](../update_live.sh) im Hauptverzeichnis aus:

```bash
chmod +x update_live.sh
./update_live.sh
```

**Was das Skript automatisch erledigt:**
1. Git Pull der neuesten Quellcode-Dateien.
2. Installation neuer Python-Pip-Pakete & Ausführung der automatischen DB-Migrationen (z. B. Mannschafts-Tabellen & Seeding).
3. Kompilieren des Next.js Frontend Production Builds (`npm run build`).
4. Automatischer Neustart aller PM2-Dienste (`matchtrack-frontend`, `matchtrack-backend`, `matchtrack-worker`).
