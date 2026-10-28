#!/bin/bash
# ==============================================================================
# MatchTrack Online - RTMP & HLS Livestream Server Setup (MediaMTX Engine)
# ==============================================================================
# Verwendet MediaMTX (Standalone Go Streaming-Server) - 100% unabhängig von
# Nginx-Paketversionen und vermeidet "held broken packages" Konflikte auf HestiaCP/VPS.
#
# Unterstützt:
#   - DJI Osmo Action 4 (DJI Mimo App)
#   - OBS Studio
#   - Web HLS Player im MatchTrack Dashboard
#
# Ausführen auf dem VPS mit:
#   sudo bash setup_rtmp.sh
# ==============================================================================

set -e

echo "=============================================================================="
echo "🎥 Richte MediaMTX Livestream-Server für MatchTrack Online ein..."
echo "=============================================================================="

if [ "$EUID" -ne 0 ]; then
    echo "❌ Bitte führe dieses Skript als root oder mit sudo aus:"
    echo "   sudo bash setup_rtmp.sh"
    exit 1
fi

# 1. Architektur ermitteln
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)
        MTX_ARCH="linux_amd64"
        ;;
    aarch64|arm64)
        MTX_ARCH="linux_arm64v8"
        ;;
    *)
        MTX_ARCH="linux_amd64"
        ;;
esac

# 2. Neueste Version von MediaMTX herunterladen
MTX_VERSION="v1.9.3"
echo "📦 [1/5] Lade MediaMTX ($MTX_VERSION für $MTX_ARCH) herunter..."

DOWNLOAD_URL="https://github.com/bluenviron/mediamtx/releases/download/${MTX_VERSION}/mediamtx_${MTX_VERSION}_${MTX_ARCH}.tar.gz"

TMP_DIR=$(mktemp -d)
if command -v curl >/dev/null 2>&1; then
    curl -sSL -o "$TMP_DIR/mediamtx.tar.gz" "$DOWNLOAD_URL"
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMP_DIR/mediamtx.tar.gz" "$DOWNLOAD_URL"
else
    echo "❌ Weder curl noch wget gefunden. Installiere curl mit: apt-get install -y curl"
    exit 1
fi

# Binary & offizielle Original-Konfiguration extrahieren
tar -xzf "$TMP_DIR/mediamtx.tar.gz" -C /usr/local/bin/ mediamtx
chmod +x /usr/local/bin/mediamtx

# Offizielle Default-Konfigurationsdatei verwenden (garantiert 100% syntaktisch valide)
tar -xzf "$TMP_DIR/mediamtx.tar.gz" -O mediamtx.yml > /etc/mediamtx.yml
rm -rf "$TMP_DIR"

echo "✅ MediaMTX Binary & Original-Konfiguration installiert."

# 3. Konfiguration für HLS Remuxing optimieren
echo "⚙️  [2/5] Optimiere /etc/mediamtx.yml für HLS-Streaming..."

# HLS Always Remux aktivieren, damit der Stream sofort ohne Latenz abrufbar ist
sed -i -E 's/^#?[[:space:]]*hlsAlwaysRemux:.*/hlsAlwaysRemux: yes/' /etc/mediamtx.yml 2>/dev/null || true
# HLS Variant auf mpegts fuer 100% universelle Browser- & HLS.js Kompatibilitaet (.ts Segmente)
sed -i -E 's/^#?[[:space:]]*hlsVariant:.*/hlsVariant: mpegts/' /etc/mediamtx.yml 2>/dev/null || true
sed -i -E 's/^#?[[:space:]]*hlsSegmentDuration:.*/hlsSegmentDuration: 2s/' /etc/mediamtx.yml 2>/dev/null || true
sed -i -E 's/^#?[[:space:]]*hlsSegmentCount:.*/hlsSegmentCount: 5/' /etc/mediamtx.yml 2>/dev/null || true
# HLS Allow Origin für Cross-Origin Browser-Zugriff
sed -i -E 's/^#?[[:space:]]*hlsAllowOrigin:.*/hlsAllowOrigin: '\''*'\''/' /etc/mediamtx.yml 2>/dev/null || true
# API fuer Statusabfragen aktivieren
sed -i -E 's/^#?[[:space:]]*api:.*/api: yes/' /etc/mediamtx.yml 2>/dev/null || true

# 4. Systemd Service einrichten
echo "🚀 [3/5] Richte Systemd Service ein..."

cat << 'EOF' > /etc/systemd/system/mediamtx.service
[Unit]
Description=MediaMTX Live Streaming Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mediamtx /etc/mediamtx.yml
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mediamtx
systemctl restart mediamtx

# Prüfen ob der Dienst läuft
sleep 1
if systemctl is-active --quiet mediamtx; then
    echo "✅ MediaMTX Dienst läuft erfolgreich!"
else
    echo "⚠️ MediaMTX Dienst konnte nicht sauber starten. Journal-Log:"
    journalctl -u mediamtx -n 15 --no-pager
    exit 1
fi

# 5. Nginx Proxy für /live/ einrichten
echo "🌐 [4/5] Prüfe Nginx Proxy-Konfiguration für /live/..."

NGINX_PROXY_CONFIG='
    # MatchTrack LiveStream HLS Reverse Proxy zu MediaMTX (nur Video-Playlists & Segmente)
    # Ermöglicht gleichzeitiges Rendering der Next.js Web-Page unter /live
    location ~* ^/live/.+\.(m3u8|ts|mp4|m4s|key)$ {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Access-Control-Allow-Origin *;
    }
'

# Suche HestiaCP Domain-Konfigurationen
HESTIA_CONF=$(find /home/*/conf/web/matchtrack.de/ -name "nginx.ssl.conf" 2>/dev/null | head -n 1)

if [ -n "$HESTIA_CONF" ]; then
    HESTIA_DIR=$(dirname "$HESTIA_CONF")
    CUSTOM_CONF="$HESTIA_DIR/nginx.ssl.conf_live"
    CUSTOM_CONF_HTTP="$HESTIA_DIR/nginx.conf_live"
    echo "💡 HestiaCP Nginx-Konfiguration gefunden in: $HESTIA_DIR"
    echo "$NGINX_PROXY_CONFIG" > "$CUSTOM_CONF"
    echo "$NGINX_PROXY_CONFIG" > "$CUSTOM_CONF_HTTP"
    echo "✅ HestiaCP Includes erstellt: $CUSTOM_CONF & $CUSTOM_CONF_HTTP"
else
    SITE_CONF=$(grep -rl "matchtrack.de" /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null | head -n 1 || true)
    if [ -n "$SITE_CONF" ] && ! grep -q "location /live/" "$SITE_CONF"; then
        echo "💡 Füge /live/ Proxy zu $SITE_CONF hinzu..."
        sed -i '$ s/}/'"$NGINX_PROXY_CONFIG"'\n}/' "$SITE_CONF" 2>/dev/null || true
    fi
fi

# Nginx testen und neu laden
if command -v nginx >/dev/null 2>&1; then
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null && echo "✅ Nginx Konfiguration erfolgreich neu geladen." || echo "ℹ️ Nginx-Reload übersprungen oder manuell zu prüfen."
fi

# 6. Firewall Port 1935 freigeben
echo "🛡️  [5/5] Firewall prüfen..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 1935/tcp comment "MatchTrack RTMP Live Stream" 2>/dev/null || true
    echo "✅ Port 1935/tcp in UFW Firewall freigegeben."
fi
if command -v iptables >/dev/null 2>&1; then
    iptables -A INPUT -p tcp --dport 1935 -j ACCEPT 2>/dev/null || true
fi

PUBLIC_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "matchtrack.de")

echo "=============================================================================="
echo "🎉 Livestream-Server ist jetzt aktiv und bereit!"
echo "=============================================================================="
echo ""
echo "📡 Zugangsdaten für OBS Studio:"
echo "   - Dienst:            Benutzerdefiniert..."
echo "   - Server:            rtmp://${PUBLIC_IP}:1935/live"
echo "   - Stream-Schlüssel:  osmo4"
echo ""
echo "📹 Zugangsdaten für DJI Mimo App (DJI Osmo Action 4):"
echo "   - RTMP-URL:          rtmp://${PUBLIC_IP}:1935/live/osmo4"
echo ""
echo "📺 Web-Player Abruf-URL:"
echo "   - https://matchtrack.de/live/osmo4/index.m3u8"
echo ""
echo "🔍 Status prüfen mit:"
echo "   systemctl status mediamtx"
echo "=============================================================================="
