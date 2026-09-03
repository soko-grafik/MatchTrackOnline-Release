# System- & Hardware-Anforderungen (Requirements)

Dieses Dokument beschreibt die Hardware-, Betriebssystem- und Serveranforderungen für das Hosting und den Betrieb von **MatchTrack Online** (Produktiv- und Entwicklungsbetrieb).

---

## 1. Minimal- & Empfohlene Hardwareanforderungen (Server / VPS)

Da MatchTrack Online videointensive Transkodierungen (FFmpeg, ABR/HLS-Conversion, Dual-Video-Streaming in Standard & Panorama) sowie optionale KI-basierte Videoanalysen (YOLOv8 Spielertracking & Heatmap-Erzeugung) durchführen kann, hängen die Hardwareanforderungen von der Auslastung ab.

| Komponente | Minimalanforderungen (Basis-Betrieb) | Empfohlene Spezifikation (Mit KI-Tracking & ABR) |
| :--- | :--- | :--- |
| **CPU** | 2 – 4 vCPU Kerne (x86_64) | 6 – 8 vCPU Kerne (z.B. AMD EPYC / Intel Xeon) |
| **Arbeitsspeicher (RAM)** | 4 GB RAM | 8 – 16 GB RAM |
| **Festplattenspeicher (SSD)** | 50 GB NVMe / SSD | 250 GB+ NVMe SSD (skalierbar je nach Videomenge) |
| **Netzwerk-Bandbreite** | 100 Mbit/s Anbindung | 1 Gbit/s Anbindung (für schnellen Upload & HLS-Streaming) |
| **Grafikkarte (GPU)** | Nicht zwingend erforderlich (CPU-Fallback) | Optional: NVIDIA GPU (CUDA Support für beschleunigtes YOLOv8 KI-Tracking & NVENC Transkodierung) |

> [!NOTE]
> **Tipp für VPS-Hosting**: Ein virtueller Server wie z. B. **Contabo VPS M / L** oder vergleichbare Hetzner / DigitalOcean Instanzen mit 6+ vCPUs bieten ein optimales Preis-Leistungs-Verhältnis für flüssige Video-Verarbeitung und parallele HLS-Konvertierungen.

---

## 2. Unterstützte Betriebssysteme

MatchTrack Online ist plattformunabhängig aufgebaut. Für Server-Deployments wird ein Linux-Betriebssystem dringend empfohlen.

* **Linux (Empfohlen für Server)**: Ubuntu 22.04 / 24.04 LTS, Debian 11 / 12, Rocky Linux 9, AlmaLinux
* **Windows (Entwicklung / Lokaler Betrieb)**: Windows 10 / 11 (mit PowerShell oder WSL2)
* **macOS (Entwicklung)**: macOS 12+ (Intel & Apple Silicon M1/M2/M3/M4)

---

## 3. Erforderliche Server-Software & Abhängigkeiten

Folgende Laufzeitumgebungen und Systemwerkzeuge müssen auf dem Server installiert sein:

### 3.1. Kern-Software
* **Python**: Version `3.10` oder höher (inkl. `pip`, `venv` & `python3-dev`)
* **Node.js**: Version `18.x` oder `20.x` LTS (inkl. `npm`)
* **FFmpeg**: Version `4.4` oder höher (muss im Systempfad `$PATH` sein und Support für `libx264` und `aac` besitzen).

### 3.2. Webserver & Prozess-Manager
* **Nginx**: Als Reverse-Proxy, SSL-Terminierung (HTTPS) und direkte, performante Auslieferung von statischen Mediendateien (HLS Video Segmente `.m3u8` / `.ts`).
* **PM2**: Node.js Process Manager zur Verwaltung der Next.js Frontend-Anwendung.
* **Systemd / PM2**: Zur Steuerung des FastAPI Backend-Dienstes (`uvicorn`) und des KI-Background-Workers (`worker.py`).

### 3.3. Datenbank
* **SQLite3**: In der Python Standardbibliothek enthalten (ausgezeichnet für kleine bis mittlere Vereine).
* **MySQL / MariaDB**: Empfohlen ab Version `8.0` / `10.6` für Vereinsinstanzen mit vielen parallelen Zugriffen.

---

## 4. Client / Endgeräte-Anforderungen (Browser & Hardware)

MatchTrack Online ist voll responsiv aufgebaut und für Desktops, Tablets sowie Smartphones optimiert.

* **Browser**: Google Chrome, Mozilla Firefox, Microsoft Edge, Apple Safari (jeweils aktuelle Versionen mit HLS.js & HTML5 Canvas Support).
* **Mobile & PWA**: iOS 14.5+ oder Android 10+ (Progressive Web App Unterstützung für Home-Screen Installation, Background Sync und Offline-Caching).
