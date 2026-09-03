#!/usr/bin/env python3
"""
MatchTrack Online - Organizer Match Events Cleanup Script
Löscht Spieltermine (MATCH-Events / fussball.de-Spiele) aus dem Organizer-Kalender.

Verwendung:
  python delete_match_events.py                     # Interaktiv alle Spieltermine löschen
  python delete_match_events.py --yes               # Ohne Rückfrage alle Spieltermine löschen
  python delete_match_events.py --team-id <UUID>    # Nur für ein bestimmtes Team löschen
  python delete_match_events.py --fussball-de-only  # Nur fussball.de importierte Termine löschen
  python delete_match_events.py --dry-run           # Testlauf (zeigt Anzahl an, ohne zu löschen)
"""

import sys
import os
import argparse

# Ensure backend root is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir) if os.path.basename(current_dir) == "scripts" else current_dir
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from db.session import SessionLocal
    from models import CalendarEvent, Team
except ImportError as e:
    print(f"Fehler beim Laden der Backend-Module: {e}")
    print("Bitte stelle sicher, dass das Skript im backend-Verzeichnis ausgeführt wird.")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Löscht Spieltermine aus dem MatchTrack Organizer.")
    parser.add_argument("--team-id", type=str, default=None, help="Filter: Nur Termine dieses Teams löschen")
    parser.add_argument("--fussball-de-only", action="store_true", help="Filter: Nur Termine löschen, die über fussball.de importiert wurden")
    parser.add_argument("--dry-run", action="store_true", help="Nur anzeigen, wie viele Termine gelöscht werden würden")
    parser.add_argument("-y", "--yes", action="store_true", help="Löschung ohne Bestätigungsabfrage direkt durchführen")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        query = db.query(CalendarEvent)

        if args.fussball_de_only:
            query = query.filter(CalendarEvent.fussball_de_match_id.isnot(None))
        else:
            query = query.filter(
                (CalendarEvent.event_type == "MATCH") | (CalendarEvent.fussball_de_match_id.isnot(None))
            )

        if args.team_id:
            team = db.query(Team).filter(Team.id == args.team_id).first()
            team_name = team.name if team else args.team_id
            print(f"Gefiltert auf Team: {team_name} ({args.team_id})")
            query = query.filter(
                CalendarEvent.teams.any(Team.id == args.team_id) | (CalendarEvent.team_id == args.team_id)
            )
        else:
            print("Gefiltert auf: ALLE Teams")

        events = query.all()
        count = len(events)

        filter_desc = "fussball.de importierte Spieltermine" if args.fussball_de_only else "Spieltermine (MATCH)"
        print(f"\n-> Gefundene {filter_desc}: {count}")

        if count == 0:
            print("Keine passenden Termine zum Löschen gefunden.")
            return

        # Preview of first 5
        print("\nVorschau der ersten Termine:")
        for ev in events[:5]:
            date_str = ev.start_time.strftime("%d.%m.%Y %H:%M") if ev.start_time else "ohne Datum"
            opp = f" vs {ev.opponent}" if ev.opponent else ""
            fde = " [fussball.de]" if ev.fussball_de_match_id else ""
            print(f"  • ID {ev.id}: {ev.title}{opp} ({date_str}){fde}")
        if count > 5:
            print(f"  ... und {count - 5} weitere.")

        if args.dry_run:
            print("\n[DRY-RUN] Keine Termine gelöscht.")
            return

        if not args.yes:
            confirm = input(f"\n⚠️ Möchtest du wirklich ALLE diese {count} Termine unwiderruflich löschen? (j/n): ").strip().lower()
            if confirm not in ["j", "ja", "y", "yes"]:
                print("Abgebrochen. Es wurden keine Daten gelöscht.")
                return

        for ev in events:
            db.delete(ev)
        db.commit()

        print(f"\n✅ Erfolgreich {count} Spieltermin(e) aus der Datenbank gelöscht.")

    except Exception as err:
        db.rollback()
        print(f"\n❌ Fehler beim Löschen der Termine: {err}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
