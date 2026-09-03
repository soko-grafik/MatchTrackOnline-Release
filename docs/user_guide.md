# Benutzerhandbuch (User Guide) - MatchTrack Online

Dieses Handbuch beschreibt die Nutzung von **MatchTrack Online** zur Videoanalyse, taktischen Aufarbeitung, Kaderverwaltung, Trainingsplanung und mobilen Nutzung.

---

## 1. Benutzerrollen & Berechtigungen

Die Plattform unterscheidet vier primäre Benutzerrollen:
1. **Viewer**: Kann freigegebene Spiele ansehen, Abspielgeschwindigkeiten anpassen und Analysen lesen.
2. **Trainer / Co-Trainer**: Kann Spiele ansehen, analysieren, Kommentare mit @-Mentions schreiben, den Kalender/Organizer verwalten, Anwesenheiten erfassen, Übungen & Trainingspläne erstellen sowie taktische Zeichnungen und Boards anfertigen.
3. **TeamAdmin**: Kann zusätzlich neue Spiele anlegen, Videos hochladen, Perspektiven austauschen und Daten für ihm zugewiesene Teams pflegen.
4. **Admin**: Vollzugriff auf das System, Benutzer-Freischaltung (Approval), SMTP-Konfiguration, WebPush-Benachrichtigungen, Video-Bearbeitung, Fisheye-Korrektur und globale Einstellungen.
5. **Externer Gast (Passwortschutz)**: Kann über einen Freigabelink mit Passwort auf ein Spiel zugreifen. Sieht eine reduzierte Oberfläche ohne Event-Sidebar/Trainer-Tools und kann das freigegebene Video ansehen oder herunterladen, solange das Ablaufdatum nicht überschritten ist.

---

## 2. Dashboard & Mobile Navigation

Das Dashboard bietet schnellen Zugriff auf alle Kernbereiche:
* **Quick Action Grid**: Direkte Verlinkungen zu **Organizer**, **Kader**, **Spiele**, **Übungen** und **Taktik**.
* **Mobile Tab-Steuerung (Smartphones)**: Auf Mobilgeräten schaltet ein 3-Tab-Menü zwischen **Termine**, **Spiele** und **Übungen** um – für optimale Übersicht ohne langes Scrollen.
* **Responsive Video-Ansicht**: In der Match-Detailansicht führt ein nativer Zurück-Button (`<`) in der oberen Leiste jederzeit direkt zurück zur Übersicht.

---

## 3. Trainer Organizer & Kalender

Der **Organizer** ist die Kalender-Zentrale pro Mannschaft:
* **Agenda & Monatsraster**: Auf Smartphones startet der Kalender standardmäßig in der übersichtlichen **Agenda-Ansicht**, auf Desktop-Geräten im Monatsraster. Vergangene Termine werden in der Agenda automatisch ausgeblendet.
* **3-Dots Optionsmenü (`⋮`)**: Enthält Schnellaktionen für **Push-Notifications** und den **fussball.de Import**.
* **fussball.de Import**: Füge die URL oder Mannschafts-ID deiner fussball.de Seite ein – alle kommenden Meisterschaftsspiele werden automatisch mit Datum, Uhrzeit und Heim/Auswärts importiert.
* **Wöchentlich wiederkehrende Termine**: Beim Erstellen von Trainingseinheiten lässt sich eine wöchentliche Wiederholung aktivieren.

---

## 4. Kader- & Spielerverwaltung

Unter **Kader & Spielerliste** verwaltest du das Mannschaftsaufgebot:
* **Dynamische Anwesenheitserfassung**: Über direkte Checkboxen (*"Letztes Training"* / *"Letztes Spiel"*) wird die Anwesenheit im Handumdrehen erfasst.
  * *Hinweis*: Liegt ein Spiel länger als 30 Tage zurück, zeigt der Spaltenkopf `(Kein Spiel stattgefunden)` an und die Checkboxen sind deaktiviert.
* **Kader-Karten auf Mobile**: Auf Smartphones schaltet die Tabelle in touchfreundliche **Spieler-Karten** um.
* **Spielerprofil & Video-Szenen**: Im Spielerprofil werden alle Szenen und Spielkommentare aufgelistet, in denen der Spieler via `@-Mention` markiert wurde.
* **3-Dots Optionsmenü (`⋮`)**: Beinhaltet **🎂 Geburtstage in Organizer**, **Excel Export**, **PDF Drucken** und **DFB.net CSV Import**.

---

## 5. Taktikboard & Trainingsdatenbank

* **Taktikboard & Bibliothek**: Interaktives Taktik-Spielfeld mit Formationen, Laufwegen, Animationen, Squad-Drawer und Präsentationsmodus für Mannschaftsbesprechungen.
* **FT-Graphics Skizzen-Editor**: Zeichne professionelle Taktikskizzen für Übungen mit Toren, Hütchen, Spielern und Passlinien.
* **Ziel-Trainingszeit**: Beim Zusammenstellen eines Trainingsplans prüft die App, ob die Gesamtübungsausdauer der Zielzeit entspricht.
* **Schwerpunkte**: Erstelle benutzerdefinierte Schwerpunkte (z.B. *Gegenpressing*), die sofort in den Filtern verfügbar sind.

---

## 6. Match-Analyse & Video-Player

* **Dual-Video-Upload & Perspektiven-Umschalter**:
  * Upload von **Standard**-Videos (Hauptkamera), **Panorama / Breitbild**-Videos oder **Dual (beide Perspektiven gleichzeitig)**.
  * Im Videoplayer kann oben links nahtlos zwischen `📹 Standard` und `🏟️ Panorama` gewechselt werden – die Abspielposition (`currentTimeMs`) bleibt dabei exakt synchron.
* **Selektives Ersetzen & Löschen von Video-Spuren**:
  * Über *Match bearbeiten / Video ersetzen* können einzelne Video-Perspektiven gezielt ausgetauscht oder nachgeladen werden, ohne dass bestehende Kommentare, Zeichnungen oder die andere Videospur verloren gehen.
  * Einzelne Perspektiven können bei Bedarf gezielt über die Match-Verwaltung gelöscht werden.
* **Kommentare & @-Mentions**:
  * Setze Zeitstempel-Kommentare mit Kategorien (*Tor, Chance, Foul, Taktik* etc.).
  * Tippe `@`, um Spieler direkt im Kommentar zu erwähnen. Die Szene erscheint automatisch im Spielerprofil.
* **Taktische Zeichnungen**: Zeichne Pfeile, Kreise, Zonen und Freihandlinien direkt auf das eingefrorene Videobild.
* **KI-Highlights & Heatmaps (YOLOv8)**:
  * Automatische Erkennung von Torszenen, Ecken und Karten.
  * Generierung von Laufweg-Heatmaps über den Hintergrund-Worker.
* **Adaptives Streaming (ABR & HLS)**: Automatische HLS-Transkodierung für flüssiges Abspielen auf allen Bandbreiten.
* **Passwortschutz & Externe Freigabe**:
  * Erstelle Freigabelinks mit Passwort und Verfallsdatum (*24 Stunden, 7 Tage, 30 Tage, Unbegrenzt*).
  * Externe Gäste sehen eine aufgeräumte Vollbild-Ansicht ohne interne Trainer-Tools mit Restzeit-Anzeige.

---

## 7. Progressive Web App (PWA) & Mobile Nutzung

* **App-Installation**: MatchTrack kann auf Android, iOS, Windows und macOS direkt als native App installiert werden.
* **Offline- & Hintergrund-Synchronisation**: Unterstützt Background Sync und periodische Synchronisation für Benachrichtigungen und Spieltermine.
* **Desktop-Software Modus**: Umschalten in den rahmenlosen Fenster- oder Vollbildmodus.
