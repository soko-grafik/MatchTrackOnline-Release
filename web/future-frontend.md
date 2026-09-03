# Vorschlag zur Frontend-Strukturierung & Modernisierung

## 1. Code-Strukturierung (Sauberkeit & Wartbarkeit)
Die aktuelle `page.tsx` ist sehr groß, da sie Logik, Navbar, Filter und die Match-Karten enthält. Das können wir wie folgt aufteilen:
*   **`components/Navbar.tsx`**: Auslagern der oberen Navigationsleiste (Logo, User-Menü, ConversionStatus).
*   **`components/FilterBar.tsx`**: Auslagern der Such- und Filterleiste.
*   **`components/MatchCard.tsx`**: Die `MatchCard`-Komponente in eine eigene Datei verschieben.
*   **Custom Hook `hooks/useMatches.ts`**: Die gesamte Fetch- und Filter-Logik (inkl. Sortierung) in einen eigenen Hook auslagern, damit die `page.tsx` nur noch für das Rendering zuständig ist.

## 2. Visuelle & UI-Verbesserungen (Das "Schöne")
*   **Begrüßungs-Sektion (Hero):** Ein kurzer, persönlicher Header oben auf dem Dashboard (z. B. *"Willkommen zurück, [Name]! Hier sind deine neuesten Spiele."*). Das wirkt einladender.
*   **Verbessertes Card-Design:** Den `MatchCards` einen subtilen Hover-Glow-Effekt (z. B. `hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]`) geben und die Metadaten (Datum, Team) optisch etwas aufgeräumter in einem Grid anordnen.
*   **Layout-Wechsel:** Anstelle der reinen Top-Navbar könntest du auf dem Desktop eine schmale **Sidebar** für die Navigation (Dashboard, Upload, Admin, Logout) verwenden. Das ist für Web-Apps oft moderner und lässt den Inhalten mehr Platz.
*   **Leerräume (Whitespace):** Etwas mehr Abstand (Padding/Margin) zwischen der Filterleiste und den Ergebnissen, um das Layout weniger gedrungen wirken zu lassen.

## 3. Neues Konzept für die Filterleiste
Statt einfacher `<select>`-Dropdowns können wir moderne, abgerundete "Pills" (kleine Buttons) für häufige Teams oder Quick-Filter (z.B. "Nur abonnierte") nutzen, ähnlich wie bei YouTube über den Videos.
