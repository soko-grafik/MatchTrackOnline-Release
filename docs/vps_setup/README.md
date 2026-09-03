# Contabo VPS / Linux Production Deployment Guide

Dieser Leitfaden beschreibt die Einrichtung des MatchTrack Online Systemd & Nginx Services auf einem VPS (Contabo, Hetzner, etc.) oder HestiaCP Server.

---

## 1. Systemd Services installieren

Kopieren Sie die Service-Dateien nach `/etc/systemd/system/`:

```bash
sudo cp docs/vps_setup/matchtrack-backend.service /etc/systemd/system/
sudo cp docs/vps_setup/matchtrack-worker.service /etc/systemd/system/

# Daemon neu laden und aktivieren
sudo systemctl daemon-reload
sudo systemctl enable matchtrack-backend
sudo systemctl enable matchtrack-worker

# Starten
sudo systemctl start matchtrack-backend
sudo systemctl start matchtrack-worker
```

---

## 2. Nginx Reverse Proxy & Statische Dateiauslieferung

Kopieren und passen Sie die Nginx-Konfiguration an:

```bash
sudo cp docs/vps_setup/nginx.conf /etc/nginx/sites-available/matchtrack
sudo ln -s /etc/nginx/sites-available/matchtrack /etc/nginx/sites-enabled/

# Nginx Konfiguration testen und neu laden
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Worker Queue & Ressourcen-Schonung

Der Background-Worker (`worker.py`) läuft mit `Nice=15` CPU-Priorisierung und verarbeitet KI-Heatmaps und Video-Transkodierungen nacheinander (Concurrency Limit = 1), um den Hauptserver nie zu überlasten.
