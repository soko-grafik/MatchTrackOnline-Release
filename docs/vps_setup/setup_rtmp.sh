#!/bin/bash
# ==============================================================================
# MatchTrack Online - RTMP & HLS Livestream Server Setup (Debian / Ubuntu / Contabo)
# ==============================================================================
# Dieses Skript richtet Nginx-RTMP und die HLS-Videokonvertierung für Livestreams
# von DJI Osmo Action 4 oder OBS Studio ein.
#
# Ausführen auf dem VPS mit:
#   sudo bash docs/vps_setup/setup_rtmp.sh
# ==============================================================================

set -e

echo "=============================================================================="
echo "🎥 Richte RTMP & HLS Livestream-Server für MatchTrack Online ein..."
echo "=============================================================================="

if [ "$EUID" -ne 0 ]; then
    echo "❌ Bitte führe dieses Skript als root oder mit sudo aus:"
    echo "   sudo bash docs/vps_setup/setup_rtmp.sh"
    exit 1
fi

# 1. RTMP-Modul für Nginx installieren
echo "📦 [1/5] Installiere libnginx-mod-rtmp..."
apt-get update -qq
apt-get install -y -qq libnginx-mod-rtmp

# 2. HLS-Ausgabeverzeichnis vorbereiten
HLS_DIR="/var/www/matchtrack/live/hls"
echo "📁 [2/5] Erstelle HLS-Stream-Verzeichnis ($HLS_DIR)..."
mkdir -p "$HLS_DIR"
chown -R www-data:www-data /var/www/matchtrack/live
chmod -R 775 /var/www/matchtrack/live

# 3. RTMP-Block in /etc/nginx/nginx.conf eintragen
NGINX_CONF="/etc/nginx/nginx.conf"
if grep -q "application live {" "$NGINX_CONF"; then
    echo "ℹ️  [3/5] RTMP-Block ist bereits in $NGINX_CONF konfiguriert."
else
    echo "⚙️  [3/5] Füge RTMP-Block zu $NGINX_CONF hinzu..."
    cat << 'EOF' >> "$NGINX_CONF"

# MatchTrack Online - RTMP Streaming Server
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        application live {
            live on;
            record off;

            # HLS Konvertierung für Web-Player (LiveStreamModal)
            hls on;
            hls_path /var/www/matchtrack/live/hls;
            hls_fragment 2s;
            hls_playlist_length 10s;
            hls_nested on;
        }
    }
}
EOF
    echo "✅ RTMP-Block erfolgreich zu $NGINX_CONF hinzugefügt."
fi

# 4. Firewall: Port 1935 freigeben
echo "🛡️  [4/5] Prüfe Firewall für Port 1935/tcp..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 1935/tcp comment "MatchTrack RTMP Live Stream" || true
    echo "✅ UFW Firewall-Regel für Port 1935/tcp hinzugefügt."
fi
if command -v iptables >/dev/null 2>&1; then
    iptables -A INPUT -p tcp --dport 1935 -j ACCEPT 2>/dev/null || true
fi

# 5. Nginx Konfiguration testen und neu laden
echo "🔄 [5/5] Teste und starte Nginx neu..."
nginx -t
systemctl restart nginx

echo "=============================================================================="
echo "🎉 RTMP-Livestream Server ist jetzt aktiv!"
echo "=============================================================================="
echo ""
echo "📡 Zugangsdaten für OBS Studio:"
echo "   - Dienst:            Benutzerdefiniert..."
echo "   - Server:            rtmp://$(curl -s ifconfig.me || echo 'deine-domain.de'):1935/live"
echo "   - Stream-Schlüssel:  osmo4"
echo ""
echo "📹 Zugangsdaten für DJI Mimo App (DJI Osmo Action 4):"
echo "   - RTMP URL:          rtmp://$(curl -s ifconfig.me || echo 'deine-domain.de'):1935/live/osmo4"
echo ""
echo "📺 Web-Player Abruf-URL:"
echo "   - https://deine-domain.de/live/osmo4/index.m3u8"
echo "=============================================================================="
