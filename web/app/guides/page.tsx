"use client";

import { useState } from 'react';
import {
  BookOpen,
  UploadCloud,
  Radio,
  Pencil,
  Eye,
  Sliders,
  Sparkles,
  Search,
  ChevronRight,
  Shield,
  Video,
  Layers,
  Cpu,
  Share2,
  Lock,
  Tv,
  CheckCircle2,
  HelpCircle,
  Calendar as CalendarIcon,
  Dumbbell,
  Download,
  RotateCw,
  Clock,
  Plus,
  Monitor,
  Smartphone,
  Users,
  MoreVertical
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';

interface GuideSection {
  id: string;
  title: string;
  category: 'Grundlagen' | 'Video & Upload' | 'Analyse & KI' | 'Organizer & Training' | 'Admin & Sicherheit';
  icon: any;
  summary: string;
  content: React.ReactNode;
}

export default function GuidesPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuide, setSelectedGuide] = useState<string | null>('organizer');

  const guides: GuideSection[] = [
    {
      id: 'organizer',
      title: 'Trainer Organizer & fussball.de Import',
      category: 'Organizer & Training',
      icon: CalendarIcon,
      summary: 'Kalender für Meisterschaftsspiele, Training, fussball.de Spielplan-Import & Wöchentliche Wiederholungen.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Der <strong>Trainer Organizer</strong> ist die zentrale Kalender-Zentrale für Trainer und Betreuer pro Mannschaft.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" /> 1. fussball.de Spielplan-Import
            </h4>
            <p className="text-sm text-zinc-400">
              Über den Button <strong>fussball.de Import</strong> kannst du einfach die URL deiner fussball.de Mannschaftsseite oder die Mannschafts-ID einfügen. Der Server importiert automatisch alle kommenden Meisterschaftsspiele mit Datum, Uhrzeit, Heim-/Auswärtsteam und Gegner!
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-emerald-400" /> 2. Wöchentlich wiederkehrende Termine & Einzel-Bearbeiten
            </h4>
            <ul className="list-disc list-inside text-sm space-y-2 text-zinc-400">
              <li>
                <strong className="text-white">Wöchentliche Wiederholung:</strong> Aktiviere beim Erstellen eines Trainings die Option <em>🔄 Termin wöchentlich wiederholen</em> und wähle ein Enddatum. Es werden automatisch alle Wochentage im Zeitraum angelegt.
              </li>
              <li>
                <strong className="text-white">Einzelne Termine anpassen:</strong> Jeder Termin lässt sich im Kalender anklicken und über <strong>✏️ Bearbeiten</strong> individuell abändern (z. B. Trainingsabsage oder Uhrzeitänderung an einem einzelnen Tag).
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'kader',
      title: 'Kaderverwaltung & Anwesenheitserfassung',
      category: 'Organizer & Training',
      icon: Users,
      summary: 'Spielerkader verwalten, DFB.net CSV Import, dynamische Anwesenheits-Checkboxen & mobile Kartenansicht.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Unter <strong>Kader & Spielerliste</strong> verwaltest du euer Mannschaftsaufgebot und erfässt Anwesenheiten.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1. Dynamische Anwesenheit (Training & Spiel)
            </h4>
            <p className="text-sm text-zinc-400">
              Mit einem Klick auf die Checkboxen in den Spalten <em>Letztes Training</em> und <em>Letztes Spiel</em> hakst du Spieler direkt als <strong>Da</strong> oder <strong>Fehlt</strong> ab. Das Erfassungsdatum wird im Spaltenkopf automatisch angezeigt.
            </p>
            <p className="text-xs text-amber-400/90 font-medium">
              💡 Hinweis: Hat in den letzten 30 Tagen kein Spiel stattgefunden, wird im Spaltenkopf <em>(Kein Spiel stattgefunden)</em> angezeigt und die Checkbox ist deaktiviert.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> 2. Touchfreundliche Mobile-Kaderkarten
            </h4>
            <p className="text-sm text-zinc-400">
              Auf Smartphones schaltet die Ansicht automatisch von der breiten Tabelle auf übersichtliche Spieler-Karten mit großen Touch-Toggles um.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <MoreVertical className="w-4 h-4 text-blue-400" /> 3. 3-Dots Optionsmenü (⋮)
            </h4>
            <p className="text-sm text-zinc-400">
              Rechts neben <em>+ Neuer Spieler</em> findest du das Optionsmenü für <strong>🎂 Geburtstage in Organizer</strong>, <strong>Excel Export</strong>, <strong>PDF Drucken</strong> und den <strong>DFB.net CSV Import</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'training',
      title: 'Trainingsdatenbank, Skizzen-Editor & Zeit-Prüfung',
      category: 'Organizer & Training',
      icon: Dumbbell,
      summary: 'Übungen anlegen, FT-Graphics Taktikskizzen zeichnen, benutzerdefinierte Schwerpunkte & Ziel-Trainingszeit.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Unter <strong>Trainingsplan & Übungen</strong> verwaltest du eure Vereins-Wissensdatenbank für Einheiten und Übungen.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> 1. FT-Graphics Skizzen-Editor
            </h4>
            <p className="text-sm text-zinc-400">
              Zeichne professionelle Taktik-Skizzen mit Toren (Mini-Tor, Jugend-Tor, Groß-Tor), Hütchen, Spielern, Passlinien und realistischen Bällen. Inklusive 90°-Drehung, Skalierung, 15x25m Spielfeld und Live Drag & Drop Positionierung.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> 2. Ziel-Trainingszeit & 5-Sekunden Toast-Warnung
            </h4>
            <p className="text-sm text-zinc-400">
              Stelle komplette Trainingspläne aus deinen Übungen zusammen. Über das Feld <strong>Ziel-Trainingszeit (z. B. 90 Min)</strong> prüft die App automatisch, ob die Dauer der Übungen ausreicht. Reicht die Zeit nicht aus, erscheint eine 5-sekündige Toast-Warnung mit der exakt fehlenden Minutenzahl.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" /> 3. Eigene Trainingsschwerpunkte
            </h4>
            <p className="text-sm text-zinc-400">
              Trainer & Admins können über <strong>+ Neuer Schwerpunkt</strong> direkt beim Anlegen einer Übung benutzerdefinierte Schwerpunkte (z. B. <em>"Gegenpressing"</em>) hinzufügen, die sofort in der Filterleiste erscheinen.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'desktop_pwa',
      title: 'PWA-Installation & Desktop-Software Modus',
      category: 'Grundlagen',
      icon: Monitor,
      summary: 'Nutzung ohne Browserrahmen wie eine echte Windows Desktop-Software.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            MatchTrack Online kann wie eine gewohnte native Windows-Software ohne störende Browserleisten genutzt werden.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" /> 1. Desktop-Software Modus
            </h4>
            <p className="text-sm text-zinc-400">
              Klicke in der Navigationsleiste oben rechts auf <strong>💻 Fullscreen</strong>, um den Vollbildmodus einzuschalten und wie eine echte Software zu arbeiten.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> 2. PWA-Installation (Smartphone & PC)
            </h4>
            <p className="text-sm text-zinc-400">
              Öffne das seitliche Menü-Drawer und klicke ganz unten auf <strong>📲 App als PWA installieren</strong>. Die Anwendung wird als eigenständige Desktop- / Mobile-App auf deinem Gerät installiert und ist mit einem Klick über das Startmenü erreichbar.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'upload',
      title: 'Video Upload & Single/Dual Stitching',
      category: 'Video & Upload',
      icon: UploadCloud,
      summary: 'So lädst du Einzelvideos oder Dual-Kamera Weitwinkel-Aufnahmen (Stitching) hoch.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Über die <strong>Upload Engine</strong> (erreichbar für Trainer, TeamAdmins & Admins) kannst du neue Spielaufzeichnungen auf die Plattform hochladen.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" /> 1. Upload-Modi
            </h4>
            <ul className="list-disc list-inside text-sm space-y-2 text-zinc-400">
              <li>
                <strong className="text-white">Single Video:</strong> Einzelne Videodatei + optionale Tracking-Daten.
              </li>
              <li>
                <strong className="text-white">Video Stitching (2 Kameras):</strong> Lädst du zwei Synchron-Aufnahmen (Links & Rechts) hoch, setzt der Server diese via SIFT-Feature-Matching zu einer 32:9 Panoramansicht zusammen.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> 2. Automatische HLS-Aufbereitung
            </h4>
            <p className="text-sm text-zinc-400">
              Der Server konvertiert hochgeladene Videos automatisch in adaptive HLS-Streams (1080p, 720p, 480p). So läuft das Abspielen auch auf Mobilgeräten im 4G/5G-Netz ohne Ruckeln.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'livestream',
      title: 'DJI Osmo Action 4 Livestreaming',
      category: 'Video & Upload',
      icon: Radio,
      summary: 'Echtzeit-Livestreams direkt von der DJI Action Cam per RTMP auf die Website senden.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Du kannst Spiele live vom Spielfeldrand auf die Website streamen. Die DJI Osmo Action 4 nutzt dazu die DJI Mimo App und das RTMP-Protokoll.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-red-400" /> Schritt-für-Schritt Einrichtung
            </h4>
            <ol className="list-decimal list-inside text-sm space-y-3 text-zinc-400">
              <li>Öffne das Dashboard und klicke oben rechts im Header auf <strong>🔴 Livestream</strong>.</li>
              <li>Kopiere die dort angezeigte <strong>RTMP Server-URL</strong> (z. B. <code className="text-blue-400 bg-zinc-950 px-2 py-0.5 rounded font-mono">rtmp://deine-domain.de:1935/live/osmo4</code>).</li>
              <li>Öffne die <strong>DJI Mimo App</strong> auf deinem Smartphone (Kamera mit Hotspot/WLAN verbunden).</li>
              <li>Wähle <strong>Livestream ➔ RTMP</strong>, füge die kopierte URL ein und starte den Stream.</li>
              <li>Das Video erscheint in Echtzeit im Livestream-Player auf der Website!</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'drawing',
      title: 'Taktische Zeichnungen & Canvas-Tools',
      category: 'Analyse & KI',
      icon: Pencil,
      summary: 'Pfeile, Laufwege, Räume und Notizen direkt auf dem Pausenbild zeichnen und speichern.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Im Videoplayer kannst du jederzeit in den <strong>Zeichen-Modus</strong> wechseln, um taktische Situationen mit der Mannschaft aufzuarbeiten.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h4 className="font-bold text-white mb-2">Werkzeuge</h4>
              <ul className="text-sm text-zinc-400 space-y-1.5">
                <li>✏️ <strong>Freihand (Pen):</strong> Skizzen & freie Formen</li>
                <li>➡️ <strong>Pfeil & Linie:</strong> Laufwege & Passlinien</li>
                <li>⭕ <strong>Kreis & Rechteck:</strong> Räume & Zonen</li>
                <li>💬 <strong>Text:</strong> Taktikhinweise & Namen</li>
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h4 className="font-bold text-white mb-2">Speichern & Wiedergabe</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Beim Speichern wird deine Zeichnung exakt an der aktuellen Video-Zeitmarke hinterlegt. Während der normalen Wiedergabe blendet sich das Overlay zur passenden Sekunde automatisch sanft ein.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'heatmaps',
      title: 'KI-Heatmaps & Spieler-Tracking (YOLOv8)',
      category: 'Analyse & KI',
      icon: Sparkles,
      summary: 'Erzeugung visueller Heatmaps der Laufwege mit künstlicher Intelligenz.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Mit Hilfe des integrierten <strong>YOLOv8 KI-Modells</strong> lassen sich aus den Spielaufnahmen automatisierte Bewegungsmuster und Laufweg-Heatmaps generieren.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> Ablauf der KI-Analyse
            </h4>
            <ol className="list-decimal list-inside text-sm space-y-2 text-zinc-400">
              <li>Ein Admin klickt in der Match-Detailansicht auf <strong>Heatmap generieren</strong>.</li>
              <li>Der Server-Worker verarbeitet das Video ressourcenschonend im Hintergrund (<code className="text-zinc-300 font-mono">nice -n 15</code>).</li>
              <li>Nach Fertigstellung steht im Player ein interaktives <strong>Heatmap-Overlay</strong> mit Farbschemata (Thermal, Fire, Neon) & Reglern zur Verfügung.</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'roles_security',
      title: 'Rollen, Teams & Passwort-Freigaben',
      category: 'Admin & Sicherheit',
      icon: Shield,
      summary: 'Berechtigungskonzept für Admin, TeamAdmin, Trainer & Viewer sowie Freigabelinks.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white">Rollenübersicht</h4>
            <ul className="text-sm space-y-2 text-zinc-400">
              <li><strong className="text-white">Admin:</strong> Vollzugriff, Rollenverwaltung, System-Settings, Fisheye-Korrektur.</li>
              <li><strong className="text-white">TeamAdmin:</strong> Kann Spiele ansehen, analysieren & Videos für ihm zugewiesene Teams hochladen.</li>
              <li><strong className="text-white">Trainer:</strong> Kann Kalender verwalten, Übungen & Trainingspläne erstellen sowie taktische Zeichnungen anfertigen.</li>
              <li><strong className="text-white">Viewer:</strong> Kann freigegebene Spiele ansehen.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-400" /> Share-Links & Passwortschutz
            </h4>
            <p className="text-sm text-zinc-400">
              Über den <strong>Teilen-Button</strong> in den Match-Details lassen sich Freigabelinks erzeugen — optional mit Passwortschutz versehen, damit externe Personen ohne Login-Konto zugreifen können.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'dsgvo_bildrechte',
      title: 'Datenschutz, DSGVO & Recht am eigenen Bild',
      category: 'Admin & Sicherheit',
      icon: Shield,
      summary: 'Rechtssicherheit bei Videoaufnahmen im Jugend- & Amateursport, Bildrechte gem. KUG/DSGVO & Muster-Einwilligungserklärung.',
      content: (
        <div className="space-y-6 text-zinc-300">
          <p>
            Bei der Aufnahme von Fußballspielen und Trainingseinheiten werden personenbezogene Bild- und Videodaten von Spielern (und ggf. Minderjährigen) erfasst. Hier erfährst du, wie Vereine und Trainer rechtssicher und DSGVO-konform vorgehen.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> 1. Recht am eigenen Bild im Verein (§ 22 KUG & Art. 6 DSGVO)
            </h4>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Vor dem Upload von Spiel- und Trainingsaufnahmen zur internen Videoanalyse und KI-Bewegungsanalyse sollte der Verein von allen aktiven Spielern (bzw. bei Minderjährigen von den gesetzlichen Vertretern / Eltern) eine schriftliche Einverständniserklärung einholen.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
            <h4 className="font-bold text-emerald-400 flex items-center justify-between">
              <span>📋 Muster-Einverständniserklärung (Vorlage für Vereine)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">Mustertext</span>
            </h4>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 space-y-3 whitespace-pre-wrap leading-relaxed select-all">
{`EINWILLIGUNGSERKLÄRUNG ZUR VIDEO- UND SPIELANALYSE

Hiermit willige ich ein, dass von mir / meinem Kind [Name des Spielers] im Rahmen des Trainings- und Spielbetriebs des [Vereinsname] Videoaufnahmen zu vereinsinternen Analyse- und Coachingzwecken (z. B. MatchTrack Online Plattform) erstellt, gespeichert und verarbeitet werden dürfen.

Verarbeitungszwecke:
1. Taktische Videoanalyse und Feedback-Gespräche im Trainer- und Mannschaftskreis.
2. Automatisierte Erstellung von Lauf- und Positions-Heatmaps (KI-Tracking).
3. Geschützter interner Zugriff nur für autorisierte Vereinstrainer und Spieler.

Rechte:
Diese Einwilligung ist freiwillig und kann jederzeit mit Wirkung für die Zukunft gegenüber dem Verein widerrufen werden.

Ort, Datum: __________________________

Unterschrift (bei Minderjährigen der/die Erziehungsberechtigte): __________________________`}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2 text-sm text-zinc-400">
            <h4 className="font-bold text-white">2. Datenexport & Recht auf Vergessenwerden</h4>
            <p>
              Jeder Nutzer kann im Profilbereich (<code className="text-emerald-400">/profile</code>) einen strukturierten Datenexport seiner Daten einsehen. Scheidet ein Spieler aus dem Verein aus, können dessen Spielerdaten und Profile vom Administrator mit einem Klick rückstandslos aus der Plattform gelöscht werden.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const categories = ['all', 'Organizer & Training', 'Video & Upload', 'Analyse & KI', 'Grundlagen', 'Admin & Sicherheit'];

  const filteredGuides = guides.filter((g) => {
    const matchesCategory = activeTab === 'all' || g.category === activeTab;
    const matchesSearch =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedGuideObj = guides.find((g) => g.id === selectedGuide) || guides[0];

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Dokumentation & Anleitungen"
          subtitle="HILFE, SCHRITT-FÜR-SCHRITT ANLEITUNGEN & TAKTIK-HANDBUCH"
        />

        {/* Search & Filter Controls */}
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === cat
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Alle Anleitungen' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Anleitung suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Main Guide Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Guide List Navigation */}
          <div className="lg:col-span-4 space-y-3">
            {filteredGuides.map((guide) => {
              const Icon = guide.icon;
              const isSelected = selectedGuideObj.id === guide.id;
              return (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
                      : 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {guide.category}
                    </span>
                    <h3 className="text-sm font-bold text-white truncate mt-0.5">{guide.title}</h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{guide.summary}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detailed Guide Viewer */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
              <div className="flex items-center gap-3 border-b border-zinc-800 pb-6 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <selectedGuideObj.icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">
                    {selectedGuideObj.category}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                    {selectedGuideObj.title}
                  </h2>
                </div>
              </div>

              {/* Dynamic Guide Content */}
              {selectedGuideObj.content}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
