"""
Standard-Vorlagen für Impressum, Datenschutzerklärung und Nutzungsbedingungen (DSGVO & TDDDG konform).
Diese Texte dienen als rechtssicherer Standard-Fallback für MatchTrack Online Instanzen.
"""

def get_default_imprint(club_name="", representative="", address="", contact_email="", register_info=""):
    c_name = club_name.strip() or "MatchTrack Sportanalyse & Scouting"
    c_rep = representative.strip() or "Der Vorstand / Die Geschäftsführung"
    c_addr = address.strip() or "Musterstraße 1\n12345 Musterstadt\nDeutschland"
    c_email = contact_email.strip() or "kontakt@matchtrack.de"
    c_reg = register_info.strip() or "Amtsgericht Musterstadt"

    return f"""# Impressum

## Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)

**Betreiber der Plattform:**  
{c_name}  

**Vertreten durch:**  
{c_rep}  

**Anschrift:**  
{c_addr}  

**Kontakt:**  
E-Mail: {c_email}  

**Registereintrag:**  
{c_reg}  

---

## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
{c_rep}  
Anschrift wie oben angegeben.

---

## EU-Streitschlichtung & Verbraucherstreitbeilegung
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:  
[https://ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr).  
Unsere E-Mail-Adresse finden Sie oben im Impressum.

Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

---

## Haftung für Inhalte & Links
Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen (wie von Nutzern hochgeladene Spielanalysen oder Videos) zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
"""


def get_default_privacy(club_name="", contact_email="", address=""):
    c_name = club_name.strip() or "MatchTrack Online Plattformbetreiber"
    c_email = contact_email.strip() or "datenschutz@matchtrack.de"
    c_addr = address.strip() or "Musterstraße 1, 12345 Musterstadt"

    return f"""# Datenschutzerklärung

Wir freuen uns über Ihr Interesse an der **MatchTrack Online** Plattform. Der Schutz Ihrer persönlichen Daten und der Daten Ihrer Sportlerinnen und Sportler hat für uns höchste Priorität. Nachfolgend informieren wir Sie ausführlich über den Umgang mit personenbezogenen Daten gemäß der **Datenschutz-Grundverordnung (DSGVO)** sowie dem **Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG)**.

---

## 1. Verantwortliche Stelle & Kontakt
Verantwortlicher im Sinne der DSGVO ist:

**{c_name}**  
{c_addr}  
E-Mail: {c_email}  

---

## 2. Erhebung und Speicherung beim Aufruf der Plattform (Server-Logfiles)
Beim Aufrufen unserer Webanwendung werden durch den Webserver (Nginx / Python Uvicorn) automatisch Informationen erfasst und temporär in Server-Logfiles gespeichert:
- IP-Adresse des anfragenden Rechners
- Datum und Uhrzeit des Zugriffs
- Name und URL der abgerufenen Datei / Ressource
- Übertragene Datenmenge und HTTP-Statuscode
- Browsertyp, Browserversion und Betriebssystem (User-Agent)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse folgt aus dem Zweck der Systemsicherheit, Stabilität und technischen Administration.

---

## 3. Lokale Speicherung im Browser (LocalStorage, SessionStorage, PWA Cache)
Gemäß **§ 25 TDDDG** informieren wir Sie über den Einsatz lokaler Speichertechnologien:

- **JWT Authentifizierungs-Token (`localStorage`):** Speichert Ihre sichere Sitzungskennung nach dem Login, damit Sie bei Seitenwechseln angemeldet bleiben (Technisch notwendig gem. § 25 Abs. 2 Nr. 2 TDDDG).
- **Match-Passwörter (`sessionStorage`):** Speichert temporäre Freigabe-Schlüssel für geteilte Spielvideos für die Dauer Ihrer aktuellen Browser-Sitzung.
- **UI-Einstellungen & Theme (`localStorage`):** Speichert Design-Präferenzen (z. B. Dark Mode).
- **Service Worker & PWA Offline Cache:** Speichert Anwendungs-Assets lokal auf Ihrem Endgerät, um Ladezeiten zu minimieren und PWA-Funktionalität bereitzustellen.

Es werden keine Drittanbieter-Tracking-Cookies (wie Google Analytics, Meta Pixel) ohne Ihre explizite Einwilligung eingesetzt.

---

## 4. Benutzerkonten & Trainer-Verwaltung
Bei der Anlage von Benutzerkonten (Admins, Trainer, Betreuer, Viewer) verarbeiten wir:
- Benutzername, Vorname, Nachname
- E-Mail-Adresse
- Passwort (ausschließlich kryptografisch irreversibel gehasht mit bcrypt/salt)
- Rolle und Team-Zuordnungen

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. Durchführung vorvertraglicher Maßnahmen).

---

## 5. Spieler- und Kaderdaten
Trainer und Vereinsadministratoren können zur Trainings- und Spielvorbereitung Kaderdaten erfassen:
- Name des Spielers, Trikotnummer, Position
- Altersklasse / Geburtsjahrgang
- Leistungsbewertungen, Anwesenheitsstatistiken, Coaching-Notizen und Profilfotos

**Rechtsgrundlage & Verantwortung:** Die Erfassung erfolgt im Auftrag und unter Verantwortung des jeweiligen Vereins (Art. 6 Abs. 1 lit. b / lit. f DSGVO bzw. Art. 9 Abs. 2 lit. d DSGVO im Vereinskontext).

---

## 6. Videoaufnahmen & KI-gestützte Videoanalyse (YOLOv8)
MatchTrack ermöglicht den Upload von Spiel- und Trainingsaufnahmen zur taktischen Analyse:
- **Videotranskodierung (HLS):** Videos werden serverseitig in adaptive Auflösungen (SD, HD, Full-HD) transkodiert.
- **KI-Objekterkennung & Heatmaps (YOLOv8):** Automatisierte Bewegungserkennung zur Erstellung von Lauf-Heatmaps und Highlight-Szenen. Die Berechnung erfolgt serverseitig auf unserer eigenen Serverinfrastruktur.

**Wichtiger Hinweis für Vereine & Trainer:** Der hochladende Verein ist datenschutzrechtlich dafür verantwortlich, dass für Videoaufnahmen von Personen (insbesondere bei minderjährigen Jugendlichen) die erforderlichen Einwilligungen der Spieler bzw. Erziehungsberechtigten vorliegen.

---

## 7. Rechte der betroffenen Personen
Sie haben gemäß DSGVO jederzeit folgende Rechte:
- **Auskunftsrecht (Art. 15 DSGVO):** Sie können Auskunft über Ihre von uns verarbeiteten personenbezogenen Daten verlangen.
- **Recht auf Berichtigung (Art. 16 DSGVO):** Sie können die Berichtigung unrichtiger oder Vervollständigung Ihrer Daten verlangen.
- **Recht auf Löschung (Art. 17 DSGVO):** Sie können die Löschung Ihrer bei uns gespeicherten Daten verlangen („Recht auf Vergessenwerden“).
- **Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO).**
- **Recht auf Datenübertragbarkeit (Art. 20 DSGVO):** Sie können einen strukturierten, maschinenlesbaren Datenexport Ihrer Daten im Profil anfordern.
- **Widerspruchsrecht (Art. 21 DSGVO)** und **Widerrufsrecht bei Einwilligungen (Art. 7 Abs. 3 DSGVO).**
- **Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO):** Sie können sich an die zuständige Datenschutzaufsichtsbehörde Ihres Bundeslandes wenden.

Zur Ausübung Ihrer Rechte kontaktieren Sie bitte: **{c_email}**
"""


def get_default_terms(club_name=""):
    c_name = club_name.strip() or "MatchTrack Online"

    return f"""# Allgemeine Nutzungsbedingungen (Terms of Service)

Stand: September 2026

## 1. Geltungsbereich & Vertragsgegenstand
Diese Nutzungsbedingungen regeln die Nutzung der Videoanalyse- und Scoutingplattform **{c_name}** durch registrierte Vereine, Trainer, Spieler und autorisierte Gäste.

---

## 2. Nutzungsberechtigung & Registrierung
1. Zur Nutzung der erweiterten Analysefunktionen (Video-Upload, Taktikboard, Trainingsplaner, Kaderverwaltung) ist ein autorisiertes Benutzerkonto erforderlich.
2. Der Nutzer ist verpflichtet, seine Zugangsdaten (Benutzername und Passwort) geheim zu halten und vor dem unbefugten Zugriff Dritter zu schützen.

---

## 3. Pflichten des Nutzers beim Video-Upload & Bildrechte
1. Der Nutzer versichert, dass er berechtigt ist, die hochgeladenen Videoaufnahmen zur teaminternen Analyse zu verwenden.
2. Bei Aufnahmen von Jugendmannschaften (Minderjährigen) stellt der zuständige Verein sicher, dass die erforderlichen Einverständniserklärungen der gesetzlichen Vertreter vorliegen.
3. Es ist untersagt, rechtswidrige, beleidigende, diskriminierende oder urheberrechtsverletzende Inhalte hochzuladen.

---

## 4. Verfügbarkeit & Datensicherung
1. Die Plattform wird mit größtmöglicher Sorgfalt und hoher Verfügbarkeit betrieben. Ein Anspruch auf eine unterbrechungsfreie Erreichbarkeit besteht nicht.
2. Für regelmäßige Datensicherungen stellt das System automatisierte Export- und Backup-Möglichkeiten bereit.

---

## 5. Haftungsbeschränkung
Für Schäden, die durch die Nutzung oder Nichtverfügbarkeit der Plattform entstehen, haftet der Betreiber nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, es handelt sich um Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit oder um die Verletzung wesentlicher Vertragspflichten.

---

## 6. Schlussbestimmungen
Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen hiervon unberührt. Es gilt das Recht der Bundesrepublik Deutschland.
"""
