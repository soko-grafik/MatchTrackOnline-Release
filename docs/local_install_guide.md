# Anleitung zur lokalen Installation & Einrichtung (Local Setup Guide)

Diese Anleitung beschreibt Schritt für Schritt, wie **MatchTrack Online** auf einem lokalen Rechner (Windows, macOS oder Linux) für die lokale Test- oder Produktionsnutzung (z.B. mit XAMPP, WAMP, Node.js & FFmpeg) eingerichtet wird.

---

## 1. Voraussetzungen & Benötigte Software

Vor der Installation müssen folgende Programme auf dem lokalen Rechner installiert sein:

1. **Node.js** (Version 18.x oder 20.x LTS)
   * Enthält den Paketmanager `npm`.
   * Download: [nodejs.org](https://nodejs.org/)
2. **Python** (Version 3.10 oder höher)
   * *Wichtig*: Bei der Installation auf Windows den Haken **"Add Python to PATH"** setzen!
   * Download: [python.org](https://www.python.org/)
3. **FFmpeg** (für Video-Transkodierung & HLS-Streaming)
   * Muss auf dem Rechner installiert und im Systempfad (`PATH`) registriert sein.
   * Download Windows: [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/) oder via Chocolatey/winget: `winget install ffmpeg`
   * Download macOS: via Homebrew `brew install ffmpeg`
4. **Lokaler Webserver & Datenbank (Optional für MySQL): XAMPP oder WAMP**
   * *Hinweis*: Wenn SQLite genutzt wird (Standard), wird XAMPP/WAMP nicht zwingend benötigt.
   * Soll eine MySQL / MariaDB Datenbank genutzt werden, installiere [XAMPP](https://www.apachefriends.org/) oder [WampServer](https://www.wampserver.com/) und starte den **MySQL** Dienst.

---

## 2. Projekt-Code herunterladen

Klone das offizielle Release-Repository oder entpacke das Projektarchiv in einen lokalen Ordner (z.B. `C:\Projekte\MatchTrackOnline`):

```bash
git clone https://github.com/soko-grafik/MatchTrackOnline-Release.git
cd MatchTrackOnline-Release
```

---

## 3. Backend (FastAPI Python) einrichten

1. Navigiere in den Ordner `backend`:
   ```bash
   cd backend
   ```

2. Erstelle eine virtuelle Python-Umgebung (`venv`):
   ```bash
   # Windows (PowerShell / Command Prompt):
   python -m venv venv

   # Linux / macOS:
   python3 -m venv venv
   ```

3. Aktiviere die virtuelle Umgebung:
   ```bash
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1

   # Windows (CMD):
   venv\Scripts\activate.bat

   # Linux / macOS:
   source venv/bin/activate
   ```

4. Installiere alle erforderlichen Python-Pakete:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Konfiguriere die Umgebungsvariablen (`.env`):
   * Erstelle eine Datei namens `.env` im `backend/`-Ordner (oder kopiere `.env.example`).
   * **Beispiel `.env` (SQLite Standard)**:
     ```ini
     DB_TYPE=sqlite
     SECRET_KEY=lokaler_geheimer_schluessel_123456789
     ALGORITHM=HS256
     ACCESS_TOKEN_EXPIRE_MINUTES=43200
     MEDIA_DIR=./uploads
     ```
   * **Beispiel `.env` mit XAMPP / WAMP (MySQL)**:
     ```ini
     DB_TYPE=mysql
     DB_HOST=127.0.0.1
     DB_PORT=3306
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=matchtracker_db
     SECRET_KEY=lokaler_geheimer_schluessel_123456789
     ```

6. Starte den Backend-Server:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   * Das Backend läuft nun unter `http://127.0.0.1:8000`. Die interaktive API-Dokumentation findest du unter `http://127.0.0.1:8000/docs`.

---

## 4. Frontend (Next.js React) einrichten

1. Öffne ein **neues Terminal-Fenster** und navigiere in den Ordner `web`:
   ```bash
   cd web
   ```

2. Installiere die Node-Abhängigkeiten:
   ```bash
   npm install
   ```

3. (Optional) Umgebungsvariablen konfigurieren:
   * Erstelle bei Bedarf eine `.env.local` im `web/`-Ordner:
     ```ini
     NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
     ```

4. Starte den Frontend-Entwicklungsserver:
   ```bash
   npm run dev
   ```
   * Das Frontend ist nun im Browser unter [http://localhost:3000](http://localhost:3000) erreichbar!

---

## 5. Lokaler Produktionsbetrieb (Local Production Setup)

Wenn du das System auf einem lokalen PC dauerhaft als "Server" im lokalen Netzwerk (LAN/WLAN) bereitstellen möchtest:

### 5.1. Next.js Produktions-Build erstellen
```bash
cd web
npm run build
npm run start -- -p 3000 -H 0.0.0.0
```

### 5.2. Backend für Netzwerk-Zugriff freigeben
Starte Uvicorn auf `0.0.0.0`, damit Geräte im selben WLAN/LAN zugreifen können:
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```
* Andere Geräte im Netzwerk (z. B. Tablets/Smartphones) erreichen die App über die lokale IP des PCs (z.B. `http://192.168.178.50:3000`).

---

## 6. Häufige Fragen & Troubleshooting (FAQ)

* **FFmpeg Fehler ("FFmpeg not found")**: Stelle sicher, dass `ffmpeg.exe` im PATH registriert ist. Teste im Terminal mit `ffmpeg -version`.
* **XAMPP / WAMP MySQL Verbindung fehlgeschlagen**: Starte das XAMPP Control Panel, aktiviere den MySQL-Dienst und erstelle via phpMyAdmin (`http://localhost/phpmyadmin`) die Datenbank `matchtracker_db`.
* **PowerShell Skriptausführung blockiert**: Führe in Windows PowerShell als Admin `Set-ExecutionPolicy RemoteSigned` aus, um venv-Skripte zuzulassen.
