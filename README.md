# MatchTrack Online

MatchTrack Online ist eine moderne Webanwendung zur Videoanalyse von Sportspielen (z. B. Fußball). Sie ermöglicht es Trainern und Teams, hochgeladene Spielvideos zu verwalten, Dual-Video-Perspektiven (Standard & Panorama/Breitbild) zu analysieren, Fisheye-Effekte zu korrigieren, Laufwege (Heatmaps) per KI (YOLOv8) zu generieren, Spielerszenen per @-Mentions zuzuordnen sowie taktische Zeichnungen und Boards direkt im System anzufertigen.

---

## Hauptfunktionen

*   **Detaillierte Match-Ansicht & Player**: Interaktiver Videoplayer mit integrierten Steuerelementen, Vollbildmodus und mobilem Header.
*   **Dual-Video-Perspektiven**: Gleichzeitige Unterstützung von Standard- und Panorama/Breitbild-Videos mit synchronisiertem Umschalten (`📹 Standard` / `🏟️ Panorama`) während der Wiedergabe.
*   **Selektiver Video-Austausch**: Gezieltes Austauschen, Hinzufügen oder Löschen einzelner Videospuren ohne Verlust von Spielkommentaren oder Zeichnungen.
*   **Adaptives HLS-Streaming (ABR)**: Automatisches Anpassen der Videoauflösung (1080p, 720p, 480p) an die Internetgeschwindigkeit – optimiert für mobile Endgeräte (3G/4G/5G).
*   **KI-Heatmaps & Highlights**: Automatisches Tracking der Spieler und Erstellung von Laufweg-Heatmaps sowie Erkennung von Spielereignissen (unter Verwendung von YOLOv8).
*   **@-Mentions für Spieler**: Markieren von Spielern in Szenenkommentaren mit automatischer Auflistung im Spielerprofil.
*   **Taktikboard & Zeichnungen**: Interaktives Spielfeld mit Aufstellungen, Squad Drawer, Taktik-Export und Einzeichnen von Pfeilen, Zonen und Linien direkt im Videobild.
*   **Trainer-Organizer**: Kalender für Spiel- und Trainingstermine inkl. automatischem fussball.de-Import und dynamischer Anwesenheitserfassung.
*   **Sicherer Match-Zugriff**: Teilen über Token, Passwortschutz mit automatischem Verfallsdatum und optimierte Gastansicht.
*   **PWA-App**: Installierbar auf Smartphones und Desktop mit Offline-Hintergrund-Synchronisation (Background Sync, Periodic Sync).

---

## Verzeichnisstruktur

*   [`/backend`](./backend): FastAPI Backend (Python, SQLAlchemy, OpenCV, FFmpeg).
*   [`/web`](./web): Next.js Frontend (React, TypeScript, TailwindCSS, Hls.js).
*   [`/dist`](./dist): Kompilierte Produktions-Artefakte für Webserver.
*   [`/docs`](./docs): Handbücher und Installationsanleitungen.

---

## Dokumente & Anleitungen

Die detaillierten Handbücher findest du hier:

1.  **[Installations- & Serveranleitung](./docs/install_guide.md)**: Einrichten der lokalen Umgebung und Bereitstellung auf einem Linux VPS (Nginx, PM2, Uvicorn, Systemd).
2.  **[Lokale Installationsanleitung](./docs/local_install_guide.md)**: Schritt-für-Schritt-Einrichtung für die lokale Entwicklung.
3.  **[Systemanforderungen](./docs/requirements.md)**: Hardware- und Softwarevoraussetzungen für Server und Clients.
4.  **[Benutzerhandbuch (User Guide)](./docs/user_guide.md)**: Anleitung für Trainer und Administratoren zur Bedienung der Weboberfläche (Video-Upload, Analysen, Taktikboard, Organizer).
