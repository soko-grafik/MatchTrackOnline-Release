from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
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
