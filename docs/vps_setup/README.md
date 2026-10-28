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

---

## 4. 🎥 RTMP & HLS Livestreaming einrichten (DJI Osmo Action 4 & OBS Studio)

Um Livestreams von der DJI Osmo Action 4 (über die DJI Mimo App) oder von OBS Studio auf dem Server zu empfangen und im Web-Player wiederzugeben:

### Automatisches Setup per Skript:
```bash
sudo bash docs/vps_setup/setup_rtmp.sh
```

### Manuelle Schritte (falls bevorzugt):
1. **Nginx RTMP Modul installieren:**
   ```bash
   sudo apt-get update && sudo apt-get install -y libnginx-mod-rtmp
   ```

2. **HLS Ordner anlegen:**
   ```bash
   sudo mkdir -p /var/www/matchtrack/live/hls
   sudo chown -R www-data:www-data /var/www/matchtrack/live
   sudo chmod -R 775 /var/www/matchtrack/live
   ```

3. **RTMP Block in `/etc/nginx/nginx.conf` ergänzen:**
   (Auf oberster Ebene, außerhalb von `http { ... }`):
   ```nginx
   rtmp {
       server {
           listen 1935;
           chunk_size 4096;

           application live {
               live on;
               record off;
               hls on;
               hls_path /var/www/matchtrack/live/hls;
               hls_fragment 2s;
               hls_playlist_length 10s;
               hls_nested on;
           }
       }
   }
   ```

4. **HLS Location in Nginx Server-Block eintragen:**
   ```nginx
   location /live/ {
       alias /var/www/matchtrack/live/hls/;
       types {
           application/vnd.apple.mpegurl m3u8;
           video/mp2t ts;
       }
       add_header Cache-Control "no-cache, no-store, must-revalidate";
       add_header Access-Control-Allow-Origin *;
   }
   ```

5. **Firewall Port 1935/tcp freigeben:**
   ```bash
   sudo ufw allow 1935/tcp comment "MatchTrack RTMP Stream"
   sudo systemctl restart nginx
   ```

