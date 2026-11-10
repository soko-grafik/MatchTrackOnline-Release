from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from db.session import get_db
from models import Match, SystemSettings
from core.security import verify_password, create_access_token
from core.default_legal_texts import get_default_imprint, get_default_privacy, get_default_terms

router = APIRouter()

class PublicMatchOut(BaseModel):
    """Gibt nur die nötigsten, nicht-sensitiven Daten zurück."""
    name: str
    team_name: Optional[str]
    age_group: Optional[str]
    recording_date: Optional[datetime]

    class Config:
        orm_mode = True

class ShareLogin(BaseModel):
    password: str

class PublicLegalPagesOut(BaseModel):
    imprint_content: str
    privacy_content: str
    terms_content: str
    club_name: Optional[str] = ""
    contact_email: Optional[str] = ""
    address: Optional[str] = ""
    representative: Optional[str] = ""
    register_info: Optional[str] = ""
    updated_at: Optional[datetime] = None

@router.get("/share/{share_token}", response_model=PublicMatchOut)
async def get_public_match_info(share_token: str, db: Session = Depends(get_db)):
    """
    Gibt öffentliche Informationen zu einem geteilten Match zurück,
    damit die Login-Seite nicht komplett anonym ist.
    """
    match = db.query(Match).filter(Match.share_token == share_token).first()
    if not match:
        raise HTTPException(status_code=404, detail="Share link not found or invalid.")
    return match

@router.post("/share/{share_token}")
async def login_for_shared_match(share_token: str, form_data: ShareLogin, db: Session = Depends(get_db)):
    """
    Überprüft das Passwort für ein geteiltes Match und gibt einen
    zeitlich begrenzten JWT zurück, der nur für dieses Match gilt.
    """
    match = db.query(Match).filter(Match.share_token == share_token).first()
    if not match or not match.share_password:
        raise HTTPException(status_code=404, detail="Share link not found or invalid.")

    if not verify_password(form_data.password, match.share_password):
        raise HTTPException(status_code=400, detail="Incorrect password.")

    access_token_expires = timedelta(hours=12)
    access_token = create_access_token(
        data={"sub": f"shared_match_{match.id}"},
        expires_delta=access_token_expires,
        additional_claims={"shared_match_id": match.id}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/legal-pages", response_model=PublicLegalPagesOut)
def get_public_legal_pages(db: Session = Depends(get_db)):
    """
    Liefert die aktiven Rechtstexte (Impressum, Datenschutz, AGB).
    Falls der Admin noch keine individuellen Texte hinterlegt hat,
    wird automatisch das rechtssichere Standard-Template zurückgegeben.
    """
    settings = db.query(SystemSettings).first()

    club_name = getattr(settings, "legal_club_name", "") or ""
    contact_email = getattr(settings, "legal_contact_email", "") or ""
    address = getattr(settings, "legal_address", "") or ""
    representative = getattr(settings, "legal_representative", "") or ""
    register_info = getattr(settings, "legal_register_info", "") or ""

    custom_imprint = getattr(settings, "legal_imprint_content", None)
    custom_privacy = getattr(settings, "legal_privacy_content", None)
    custom_terms = getattr(settings, "legal_terms_content", None)

    imprint_content = custom_imprint.strip() if custom_imprint and custom_imprint.strip() else get_default_imprint(
        club_name=club_name,
        representative=representative,
        address=address,
        contact_email=contact_email,
        register_info=register_info
    )

    privacy_content = custom_privacy.strip() if custom_privacy and custom_privacy.strip() else get_default_privacy(
        club_name=club_name,
        contact_email=contact_email,
        address=address
    )

    terms_content = custom_terms.strip() if custom_terms and custom_terms.strip() else get_default_terms(
        club_name=club_name
    )

    return {
        "imprint_content": imprint_content,
        "privacy_content": privacy_content,
        "terms_content": terms_content,
        "club_name": club_name,
        "contact_email": contact_email,
        "address": address,
        "representative": representative,
        "register_info": register_info,
        "updated_at": getattr(settings, "updated_at", None)
    }


@router.get("/legal-templates")
def get_legal_templates(db: Session = Depends(get_db)):
    """
    Liefert die Standard-Vorlagen, z. B. wenn der Admin im Editor auf 'Standard-Vorlage laden' klickt.
    """
    settings = db.query(SystemSettings).first()
    club_name = getattr(settings, "legal_club_name", "") or ""
    contact_email = getattr(settings, "legal_contact_email", "") or ""
    address = getattr(settings, "legal_address", "") or ""
    representative = getattr(settings, "legal_representative", "") or ""
    register_info = getattr(settings, "legal_register_info", "") or ""

    return {
        "default_imprint": get_default_imprint(club_name, representative, address, contact_email, register_info),
        "default_privacy": get_default_privacy(club_name, contact_email, address),
        "default_terms": get_default_terms(club_name)
    }

import time
import urllib.request
import json

_last_streams_check_time = 0.0
_cached_active_streams = set()

def get_active_stream_names() -> set:
    global _last_streams_check_time, _cached_active_streams
    now = time.time()
    if now - _last_streams_check_time < 2.0:
        return _cached_active_streams

    _last_streams_check_time = now
    found = set()

    # 1. MediaMTX API pruefen (Port 9997)
    try:
        req = urllib.request.Request("http://127.0.0.1:9997/v3/paths/list", headers={"User-Agent": "FastAPI"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                for item in data.get("items", []):
                    if item.get("ready"):
                        raw_name = str(item.get("name", "")).strip().lower()
                        cleaned = raw_name.split("/")[-1]
                        if cleaned:
                            found.add(cleaned)
                            if cleaned == "osmo4":
                                found.add("cam1")
    except Exception:
        pass

    # 2. Fallback: HLS Playlist Ports pruefen
    if not found:
        for probe_key in ["cam1", "cam2", "stitched", "osmo4"]:
            for probe_url in [f"http://127.0.0.1:8888/live/{probe_key}/index.m3u8", f"http://127.0.0.1:8888/{probe_key}/index.m3u8"]:
                try:
                    req = urllib.request.Request(probe_url, headers={"User-Agent": "FastAPI"})
                    with urllib.request.urlopen(req, timeout=0.5) as resp:
                        if resp.status == 200:
                            found.add(probe_key)
                            if probe_key == "osmo4":
                                found.add("cam1")
                            break
                except Exception:
                    pass

    _cached_active_streams = found
    return _cached_active_streams

class StreamDetail(BaseModel):
    is_live: bool
    name: str
    url: str

class PublicLivestreamOut(BaseModel):
    is_protected: bool
    title: str
    is_live: bool = False
    is_published: bool = False
    mode: str = "multi_cam"
    active_stream_count: int = 0
    active_streams: List[str] = []
    streams: Dict[str, StreamDetail] = {}

class LivestreamVerifyIn(BaseModel):
    password: str

@router.get("/livestream", response_model=PublicLivestreamOut)
def get_public_livestream_status(db: Session = Depends(get_db)):
    """
    Oeffentliche Status-Abfrage fuer den Livestream:
    Liefert Schutz-Status, Titel, Freigabe (is_published), Modus und die einzelnen Streams.
    """
    settings = db.query(SystemSettings).first()
    is_protected = bool(getattr(settings, "livestream_is_protected", False)) if settings else False
    has_pass = bool(getattr(settings, "livestream_password", None)) if settings else False
    title = (getattr(settings, "livestream_title", None) or "MatchTrack Livestream") if settings else "MatchTrack Livestream"
    is_published = bool(getattr(settings, "livestream_is_published", False)) if settings else False
    mode = getattr(settings, "livestream_mode", "multi_cam") or "multi_cam"
    cam1_name = getattr(settings, "livestream_cam1_name", "Kamera 1 (Links)") or "Kamera 1 (Links)"
    cam2_name = getattr(settings, "livestream_cam2_name", "Kamera 2 (Rechts)") or "Kamera 2 (Rechts)"

    active_set = get_active_stream_names()
    cam1_live = ("cam1" in active_set) or ("osmo4" in active_set)
    cam2_live = "cam2" in active_set
    stitched_live = "stitched" in active_set

    is_live = False
    if mode == "stitched":
        is_live = stitched_live or (cam1_live and cam2_live)
    else:
        is_live = cam1_live or cam2_live

    cam1_url = "/live/osmo4/index.m3u8" if ("osmo4" in active_set and "cam1" not in active_set) else "/live/cam1/index.m3u8"

    streams = {
        "cam1": StreamDetail(is_live=cam1_live, name=cam1_name, url=cam1_url),
        "cam2": StreamDetail(is_live=cam2_live, name=cam2_name, url="/live/cam2/index.m3u8"),
        "stitched": StreamDetail(is_live=stitched_live, name="Panorama (Gestitcht)", url="/live/stitched/index.m3u8")
    }

    active_keys = [k for k, v in streams.items() if v.is_live]

    return {
        "is_protected": is_protected and has_pass,
        "title": title,
        "is_live": is_live,
        "is_published": is_published,
        "mode": mode,
        "active_stream_count": len(active_keys),
        "active_streams": active_keys,
        "streams": streams
    }

@router.post("/livestream/verify")
def verify_livestream_password(data: LivestreamVerifyIn, db: Session = Depends(get_db)):
    """
    Überprüft das Passwort für den geschützten Livestream.
    """
    settings = db.query(SystemSettings).first()
    if not settings or not getattr(settings, "livestream_is_protected", False):
        return {"success": True}

    stored_password = getattr(settings, "livestream_password", "") or ""
    if not stored_password:
        return {"success": True}

    if data.password.strip() == stored_password.strip():
        return {"success": True}
    else:
        raise HTTPException(status_code=401, detail="Ungültiges Livestream-Passwort")
