from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db.session import get_db, BASE_DIR
from models import Match, VideoChunk, User
from typing import Optional
import os
import json

from .dependencies import get_optional_user
from .matches import _is_match_access_allowed

router = APIRouter()

class AnalyticsService:
    @staticmethod
    def get_player_heatmap(tracking_path):
        if not tracking_path:
            return []

        if not os.path.isabs(tracking_path):
            clean_path = tracking_path
            if clean_path.startswith("backend/"):
                clean_path = clean_path.replace("backend/", "", 1)
            full_path = os.path.join(BASE_DIR, clean_path)
        else:
            full_path = tracking_path

        if not os.path.exists(full_path):
            return []

        positions = []
        print(f"[HeatmapDebug] Processing file: {full_path}")
        try:
            with open(full_path, "r") as f:
                content = f.read().strip()
                if not content:
                    print("[HeatmapDebug] File is empty")
                    return []

                # Handle JSONL (Newline Delimited JSON) or standard JSON
                lines = content.split("\n") if "\n" in content else [content]
                
                for line in lines:
                    if not line.strip(): continue
                    try:
                        data = json.loads(line)
                        # Data could be a single frame or a list of frames
                        frames = data if isinstance(data, list) else [data]
                        
                        for frame in frames:
                            detections = frame.get("detections", [])
                            if not detections and isinstance(frame, list):
                                detections = frame # Case where frame is just a list of detections
                                
                            for det in detections:
                                # Fallback: if label is missing, assume it's a player if it has x,y
                                label = det.get("label", "player") 
                                if label == "player" or "x" in det:
                                    positions.append({"x": det["x"], "y": det["y"]})
                    except Exception as e:
                        print(f"[HeatmapDebug] JSON error in line: {str(e)}")
                        continue
            
            print(f"[HeatmapDebug] Found {len(positions)} positions")
        except Exception as e:
            print(f"[HeatmapDebug] Global file error: {str(e)}")
            pass

        return positions

@router.get("/{match_id}/heatmap")
async def get_match_heatmap(match_id: str, request: Request, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not _is_match_access_allowed(match, current_user, request):
        raise HTTPException(status_code=401, detail="Password required")

    chunks = db.query(VideoChunk).filter(VideoChunk.match_id == match_id).all()

    all_positions = []
    for chunk in chunks:
        if chunk.tracking_path:
            positions = AnalyticsService.get_player_heatmap(chunk.tracking_path)
            if positions:
                all_positions.extend(positions)

    return {
        "match_id": match_id,
        "player_positions": all_positions,
        "count": len(all_positions)
    }

class TrackPingRequest(BaseModel):
    match_id: Optional[str] = None
    duration_seconds: int = 30
    module: str = "match_video"

@router.post("/track-ping")
async def track_user_ping(
    payload: TrackPingRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Protokolliert aktive Nutzungszeit (Watch Time / Modul-Verweildauer) des eingeloggten Benutzers."""
    if not current_user:
        return {"status": "ignored"}

    try:
        from services.activity_service import log_user_activity
        log_user_activity(
            db=db,
            user_id=current_user.id,
            activity_type="WATCH_TIME",
            resource_type="match" if payload.match_id else "module",
            resource_id=payload.match_id,
            details={"duration_seconds": payload.duration_seconds, "module": payload.module}
        )
    except Exception:
        pass

    return {"status": "ok"}
