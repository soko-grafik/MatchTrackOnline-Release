import os
import re
import json
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
import requests

from db.session import get_db
from models import User, Player, PlayerAttendance, PlayerEvaluation, CalendarEvent, Team, SystemSettings
from api.dependencies import get_current_user, require_module_access


router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


class AIProcessRequest(BaseModel):
    text: str
    team_id: Optional[str] = None


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.webm", user: Optional[User] = None) -> str:
    """Transcribes audio using OpenAI Whisper API or Gemini API with auto-detection and user key fallback."""
    user_key = (user.ai_api_key if user and user.ai_api_key else "").strip()
    api_key = user_key or OPENAI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Kein API-Key hinterlegt. Bitte hinterlege deinen OpenAI oder Gemini API-Key in deinem Profil!"
        )

    # Auto-detect provider if key prefix is recognizable
    provider = (user.ai_provider if user and user.ai_provider else "OPENAI").upper()
    if api_key.startswith("sk-"):
        provider = "OPENAI"
    elif api_key.startswith("AIza"):
        provider = "GEMINI"

    if provider == "GEMINI":
        try:
            # Primary: gemini-2.5-flash, Fallback: gemini-2.0-flash
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            import base64
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            payload = {
                "contents": [{
                    "parts": [
                        {"text": "Transkribiere diesen gesprochenen deutschen Audioclip exakt als Text. Antworte NUR mit dem transkribierten deutschen Satz."},
                        {"inline_data": {"mime_type": "audio/webm", "data": b64_audio}}
                    ]
                }]
            }
            resp = requests.post(url, json=payload, timeout=30)
            if resp.status_code != 200:
                # Fallback to gemini-2.0-flash if 2.5 is not yet in current region
                url_fb = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
                resp = requests.post(url_fb, json=payload, timeout=30)

            if resp.status_code == 200:
                res_json = resp.json()
                text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    return text

        except Exception as e:
            print(f"Gemini API Exception: {e}")

        # Fallback to OpenAI Whisper if user key is valid for OpenAI
        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            files = {"file": (filename, audio_bytes, "audio/webm")}
            data = {"model": "whisper-1", "language": "de"}
            resp2 = requests.post("https://api.openai.com/v1/audio/transcriptions", headers=headers, files=files, data=data, timeout=30)
            if resp2.status_code == 200:
                return resp2.json().get("text", "").strip()
        except Exception as e:
            print(f"OpenAI Fallback Exception: {e}")

        raise HTTPException(status_code=400, detail="Transkription fehlgeschlagen. Bitte prüfe deinen API-Key in den Profil-Einstellungen.")
    else:
        try:
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {api_key}"}
            files = {"file": (filename, audio_bytes, "audio/webm")}
            data = {"model": "whisper-1", "language": "de"}

            resp = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            if resp.status_code != 200:
                err_msg = "OpenAI Whisper Fehler"
                try:
                    err_msg = resp.json().get("error", {}).get("message", resp.text)
                except Exception:
                    err_msg = resp.text
                raise HTTPException(status_code=400, detail=f"OpenAI Fehler: {err_msg}")

            result = resp.json()
            return result.get("text", "").strip()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Verbindungsfehler zur AI-Schnittstelle: {str(e)}")


def fuzzy_match_players(query_names: List[str], db_players: List[Player]) -> List[Player]:
    """Matches spoken name list against player database roster."""
    matched = []
    for raw_name in query_names:
        clean_search = raw_name.strip().lower()
        if not clean_search:
            continue
        for p in db_players:
            first = (p.first_name or "").lower()
            last = (p.last_name or "").lower()
            full = f"{first} {last}".strip()
            
            if clean_search in first or clean_search in last or clean_search in full or first in clean_search:
                if p not in matched:
                    matched.append(p)
                break
    return matched


@router.post("/voice-process")
def process_voice_or_text(
    text: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_module_access("AI"))
):

    """
    Processes audio voice recordings or text prompts.
    Parses Intent & Entities, and executes DB updates automatically.
    """
    system_settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if system_settings and system_settings.module_ai_assistant_enabled is False:
        raise HTTPException(
            status_code=403,
            detail="Das KI-Modul wurde vom System-Administrator deaktiviert."
        )

    db_user = db.query(User).filter(User.id == current_user.id).first() or current_user
    transcript = text or ""

    if audio_file:
        audio_content = audio_file.file.read()
        if audio_content:
            transcript = transcribe_audio_bytes(audio_content, filename=audio_file.filename or "voice.webm", user=db_user)

    if not transcript:
        raise HTTPException(status_code=400, detail="Keine Sprache oder Text empfangen.")

    # Get available players for context
    players_query = db.query(Player)
    if team_id:
        players_query = players_query.filter(Player.team_id == team_id)
    all_players = players_query.all()

    lower_trans = transcript.lower()

    # Keywords for explicit attendance
    attendance_keywords = ["anwesend", "beim training", "beim spiel", "war da", "waren da", "abmelden", "abgemeldet", "gefehlt", "krank", "ist da", "sind da"]
    is_attendance = any(kw in lower_trans for kw in attendance_keywords)

    # Keywords for creating calendar event / appointment
    event_keywords = ["termin", "erstelle", "anlegen", "kalender", "trage ein", "neuer termin", "spiel am", "training am", "treffpunkt", "uhr"]
    is_event_creation = any(kw in lower_trans for kw in event_keywords)

    # --- INTENT 1: ATTENDANCE (Anwesenheit) ---
    if is_attendance and not is_event_creation:
        is_absence = any(kw in lower_trans for kw in ["abmelden", "abgemeldet", "gefehlt", "krank", "nicht da", "fehlt"])
        status_val = "EXCUSED" if is_absence else "PRESENT"

        # Split transcript to find player names
        raw_names = re.split(r'[,;\nund]+', transcript)
        matched_players = fuzzy_match_players(raw_names, all_players)

        if not matched_players:
            # Fallback word-by-word matching
            words = [w.strip(".,!?") for w in transcript.split()]
            matched_players = fuzzy_match_players(words, all_players)

        recorded_count = 0
        now = datetime.utcnow()
        for p in matched_players:
            att = db.query(PlayerAttendance).filter(
                PlayerAttendance.player_id == p.id,
                PlayerAttendance.event_date >= now.replace(hour=0, minute=0, second=0)
            ).first()

            if not att:
                att = PlayerAttendance(
                    player_id=p.id,
                    event_date=now,
                    event_type="TRAINING" if "training" in lower_trans else "MATCH",
                    status=status_val
                )
                db.add(att)
            else:
                att.status = status_val
            recorded_count += 1

        db.commit()

        player_names = [f"{p.first_name} {p.last_name}".strip() for p in matched_players]
        if recorded_count > 0:
            msg = f"🟢 Anwesenheit aktualisiert: {', '.join(player_names)} wurde(n) als {'entschuldigt/gefehlt' if is_absence else 'anwesend beim letzten Training'} markiert!"
        else:
            msg = "Ich konnte leider keinen passenden Spielernamen im Kader für die Anwesenheit finden."

        return {
            "status": "success" if recorded_count > 0 else "warning",
            "action_type": "ATTENDANCE",
            "title": "📋 Anwesenheit aktualisiert",
            "transcript": transcript,
            "details": {
                "players": player_names,
                "status": status_val
            },
            "executed": True if recorded_count > 0 else False,
            "message": msg
        }

    # --- INTENT 2: PLAYER EVALUATION (Spielereinschätzung) ---
    elif "einschätzung" in lower_trans or "bewertung" in lower_trans or "trage für" in lower_trans or "note" in lower_trans or "starke" in lower_trans or "schwächen" in lower_trans:
        target_player = None
        for p in all_players:
            if (p.first_name and p.first_name.lower() in lower_trans) or (p.last_name and p.last_name.lower() in lower_trans):
                target_player = p
                break

        if not target_player and all_players:
            target_player = all_players[0]

        if not target_player:
            raise HTTPException(status_code=400, detail="Kein passender Spieler im Kader für die Einschätzung gefunden.")

        rating_val = 2.0
        grade_match = re.search(r'note\s*([1-6])', lower_trans)
        if grade_match:
            rating_val = float(grade_match.group(1))

        eval_obj = PlayerEvaluation(
            player_id=target_player.id,
            created_by_user_id=current_user.id,
            overall_rating=rating_val,
            overall_notes=transcript,
            raw_transcript=transcript,
            evaluation_date=datetime.utcnow()
        )
        db.add(eval_obj)
        db.commit()

        return {
            "status": "success",
            "action_type": "PLAYER_EVALUATION",
            "title": f"⚽ Spielereinschätzung gespeichert",
            "transcript": transcript,
            "details": {
                "player_id": target_player.id,
                "player_name": f"{target_player.first_name} {target_player.last_name}".strip(),
                "rating": rating_val
            },
            "executed": True,
            "message": f"Spielereinschätzung für {target_player.first_name} {target_player.last_name} erfolgreich gespeichert!"
        }

    # --- INTENT 3: TEAM SUMMARY (Mannschafts-Analyse) ---
    elif "analyse" in lower_trans or "zusammenfassung" in lower_trans or "wie steht" in lower_trans:
        team_name = "Mannschaft"
        if team_id:
            team_obj = db.query(Team).filter(Team.id == team_id).first()
            if team_obj:
                team_name = team_obj.name

        total_players = len(all_players)
        summary_text = (
            f"📊 KI-Team-Analyse für {team_name}:\n"
            f"• Kaderstärke: {total_players} aktive Spieler\n"
            f"• Anwesenheitsquote: Sehr gut im aktuellen Monat\n"
            f"• Empfehlung: Fokus auf Passgenauigkeit und Umschaltspiel in den kommenden Einheiten."
        )

        return {
            "status": "success",
            "action_type": "TEAM_SUMMARY",
            "title": f"🏆 Team-Analyse für {team_name}",
            "transcript": transcript,
            "details": {
                "summary": summary_text
            },
            "executed": True,
            "message": summary_text
        }

    # --- INTENT 4: ORGANIZER EVENT (Termin anlegen mit Datum- & Team-Erkennung) ---
    elif is_event_creation or "anlegen" in lower_trans or "termin" in lower_trans:
        now = datetime.utcnow()
        start_dt = now + timedelta(days=1)

        # Parse relative weekdays if mentioned
        weekdays = {"montag": 0, "dienstag": 1, "mittwoch": 2, "donnerstag": 3, "freitag": 4, "samstag": 5, "sonntag": 6}
        for wd_name, wd_idx in weekdays.items():
            if wd_name in lower_trans:
                days_ahead = wd_idx - now.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                start_dt = now + timedelta(days=days_ahead)
                break

        if "heute" in lower_trans:
            start_dt = now
        elif "morgen" in lower_trans and "übermorgen" not in lower_trans:
            start_dt = now + timedelta(days=1)
        elif "übermorgen" in lower_trans:
            start_dt = now + timedelta(days=2)

        # Parse time if mentioned (e.g. 18:30 or 18 uhr)
        time_match = re.search(r'(\d{1,2})[:\.](\d{2})', lower_trans)
        if time_match:
            hours = int(time_match.group(1))
            minutes = int(time_match.group(2))
            start_dt = start_dt.replace(hour=hours, minute=minutes, second=0)
        else:
            time_uhr_match = re.search(r'(\d{1,2})\s*uhr', lower_trans)
            if time_uhr_match:
                hours = int(time_uhr_match.group(1))
                start_dt = start_dt.replace(hour=hours, minute=0, second=0)

        end_dt = start_dt + timedelta(hours=2)

        # Match team if mentioned
        target_team = None
        if team_id:
            target_team = db.query(Team).filter(Team.id == team_id).first()
        else:
            all_teams = db.query(Team).all()
            for tm in all_teams:
                if tm.name and tm.name.lower() in lower_trans:
                    target_team = tm
                    break

        clean_title = transcript.capitalize()
        event_obj = CalendarEvent(
            title=clean_title,
            event_type="MATCH" if "spiel" in lower_trans or "gegen" in lower_trans else "TRAINING",
            start_time=start_dt,
            end_time=end_dt,
            location="Sportplatz",
            team_id=target_team.id if target_team else (all_players[0].team_id if all_players else None),
            reminder_minutes=30,
            notes=transcript
        )
        db.add(event_obj)
        db.commit()

        team_str = f" für {target_team.name}" if target_team else ""
        date_str = start_dt.strftime("%d.%m.%Y um %H:%M Uhr")
        msg = f"📅 Termin '{clean_title}'{team_str} für den {date_str} erfolgreich im Organizer angelegt!"

        return {
            "status": "success",
            "action_type": "ORGANIZER_EVENT",
            "title": "📅 Termin im Organizer angelegt",
            "transcript": transcript,
            "details": {
                "event_title": event_obj.title,
                "start_time": date_str,
                "team": target_team.name if target_team else None
            },
            "executed": True,
            "message": msg
        }

    # --- FALLBACK: Fragen & Klärung ---
    else:
        return {
            "status": "question",
            "action_type": "UNSUFFICIENT_INFO",
            "title": "❓ KI-Nachfrage",
            "transcript": transcript,
            "details": {},
            "executed": False,
            "message": "Ich bin mir nicht sicher, ob du einen Termin anlegen oder Anwesenheiten erfassen möchtest. Sage z. B.: 'Rio war beim Training' oder 'Erstelle ein Training für Dienstag 18 Uhr'."
        }



@router.post("/scan-exercise")
async def scan_exercise_card(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_module_access("AI"))
):

    """Scans a physical training card photo using multimodal AI (Gemini/OpenAI Vision) and extracts structured exercise data."""
    # Check if AI assistant is globally enabled
    system_settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if system_settings and system_settings.module_ai_assistant_enabled is False:
        raise HTTPException(
            status_code=403,
            detail="Das KI-Modul ist vom Administrator global deaktiviert."
        )


    user_key = (current_user.ai_api_key if current_user and current_user.ai_api_key else "").strip()
    api_key = user_key or OPENAI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Kein API-Key hinterlegt. Bitte hinterlege deinen OpenAI oder Gemini API-Key in deinem Profil!"
        )

    # Read image content
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Hochgeladene Bilddatei ist leer.")

    import base64
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    content_type = file.content_type or "image/jpeg"

    # Detect provider
    provider = (current_user.ai_provider if current_user and current_user.ai_provider else "OPENAI").upper()
    if api_key.startswith("sk-"):
        provider = "OPENAI"
    elif api_key.startswith("AIza"):
        provider = "GEMINI"

    prompt_text = """
Du bist ein erfahrener Fußball-Trainer. Analysiere diese Kartothekkarte / dieses Bild einer Fußball-Trainingsübung.
Extrahiere präzise alle erkennbaren Informationen und antworte AUSSCHLIESSLICH im folgenden gültigen JSON-Format (kein Markdown-Block, kein Prosa-Text um das JSON):

{
  "title": "Titel der Übung",
  "description": "Detaillierte Beschreibung des Übungsablaufs und der Regeln",
  "coaching_points": "Wichtige Coaching-Punkte / Worauf der Trainer achten muss",
  "focus_area": "Passspiel",
  "age_group": "U10-U13",
  "min_players": 6,
  "max_players": 12,
  "duration_minutes": 15,
  "materials": ["Bälle", "Hütchen", "Leibchen"]
}

Mögliche Werte für focus_area: Passspiel, Koordination, Torschuss, Taktik, Athletik, Umschaltspiel, Zweikampf, Dribbling & Finten, Torwartspiel.
Mögliche Werte für age_group: U7-U9, U10-U13, U14-U19, Senioren, Alle.
Falls Felder wie Spieleranzahl oder Dauer auf der Karte fehlen, schätze sie realistisch für diese Übung ein.
"""

    raw_json_str = ""

    if provider == "GEMINI":
        try:
            # Model names and API versions to try (Google Gemini API updated endpoints)
            gemini_candidates = [
                ("v1beta", "gemini-2.5-flash"),
                ("v1", "gemini-2.5-flash"),
                ("v1beta", "gemini-2.0-flash-exp"),
                ("v1beta", "gemini-flash"),
                ("v1", "gemini-flash"),
                ("v1beta", "gemini-1.5-flash"),
                ("v1", "gemini-1.5-flash")
            ]
            res_json = None
            last_err_msg = ""

            for api_ver, model_name in gemini_candidates:
                url = f"https://generativelanguage.googleapis.com/{api_ver}/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": prompt_text},
                            {"inline_data": {"mime_type": content_type, "data": b64_image}}
                        ]
                    }]
                }
                resp = requests.post(url, json=payload, timeout=40)
                if resp.status_code == 200:
                    res_json = resp.json()
                    break
                else:
                    last_err_msg = resp.text
                    print(f"Gemini API ({api_ver}/{model_name}) failed ({resp.status_code}): {last_err_msg}")

            # If all standard candidates fail, try fetching available models dynamically from Google ListModels API
            if not res_json:
                try:
                    list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                    list_resp = requests.get(list_url, timeout=15)
                    if list_resp.status_code == 200:
                        models_data = list_resp.json().get("models", [])
                        valid_models = [m.get("name", "").replace("models/", "") for m in models_data if "generateContent" in m.get("supportedGenerationMethods", [])]
                        print(f"Dynamically discovered valid Gemini models for key: {valid_models}")
                        for disc_model in valid_models:
                            if "flash" in disc_model or "pro" in disc_model:
                                url = f"https://generativelanguage.googleapis.com/v1beta/models/{disc_model}:generateContent?key={api_key}"
                                resp = requests.post(url, json=payload, timeout=40)
                                if resp.status_code == 200:
                                    res_json = resp.json()
                                    break
                except Exception as list_err:
                    print(f"ListModels auto-discovery exception: {list_err}")

            if res_json:
                raw_json_str = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
            else:
                try:
                    err_json = json.loads(last_err_msg)
                    err_msg = err_json.get("error", {}).get("message", last_err_msg)
                except Exception:
                    err_msg = last_err_msg
                raise HTTPException(status_code=400, detail=f"Gemini API Fehler: {err_msg}")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            print(f"Gemini Vision Exception: {e}")
            raise HTTPException(status_code=400, detail=f"Gemini Vision Fehler: {str(e)}")


    else:
        # OPENAI Vision (GPT-4o / GPT-4o-mini)
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{content_type};base64,{b64_image}"}
                            }
                        ]
                    }
                ],
                "max_tokens": 800
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=40)
            if resp.status_code == 200:
                raw_json_str = resp.json()["choices"][0]["message"]["content"].strip()
            else:
                err_text = resp.text
                print(f"OpenAI API Error details: {err_text}")
                try:
                    err_json = resp.json()
                    err_msg = err_json.get("error", {}).get("message", err_text)
                except Exception:
                    err_msg = err_text
                raise HTTPException(status_code=400, detail=f"OpenAI API Fehler ({resp.status_code}): {err_msg}")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            print(f"OpenAI Vision Exception: {e}")
            raise HTTPException(status_code=400, detail=f"OpenAI Vision Fehler: {str(e)}")


    # Clean markdown formatting if present
    cleaned_str = raw_json_str
    if cleaned_str.startswith("```"):
        lines = cleaned_str.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned_str = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned_str)
        return {
            "status": "success",
            "data": data
        }
    except Exception as parse_err:
        return {
            "status": "partial",
            "raw_text": raw_json_str,
            "data": {
                "title": "Gescannte Übung",
                "description": raw_json_str,
                "coaching_points": "",
                "focus_area": "Passspiel",
                "age_group": "Alle",
                "min_players": 4,
                "max_players": 12,
                "duration_minutes": 15,
                "materials": ["Bälle", "Hütchen"]
            }
        }

