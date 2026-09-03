from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db.session import get_db
from models import Match
from core.security import verify_password, create_access_token
from datetime import timedelta

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

    # Das Token ist für 12 Stunden gültig.
    # WICHTIG: Wir fügen eine spezielle "claim" (Zusatzinfo) hinzu,
    # die das Token auf dieses eine Match beschränkt.
    access_token_expires = timedelta(hours=12)
    access_token = create_access_token(
        data={"sub": f"shared_match_{match.id}"},
        expires_delta=access_token_expires,
        # Hier die spezielle claim für das geteilte Match
        additional_claims={"shared_match_id": match.id}
    )
    return {"access_token": access_token, "token_type": "bearer"}
