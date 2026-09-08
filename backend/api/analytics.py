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
                                    # Team, Tracker-ID und Trikotfarbe mit Fallback extrahieren
                                    team = det.get("team")
                                    tid = det.get("tracker_id")
                                    jersey_col = det.get("jersey_color")

                                    if not team:
                                        team = "home" if (len(positions) % 2 == 0) else "away"
                                    if tid is None:
                                        tid = (len(positions) % 22) + 1
                                    if not jersey_col:
                                        jersey_col = "#ef4444" if team == "home" else "#3b82f6"

                                    positions.append({
                                        "x": det["x"],
                                        "y": det["y"],
                                        "ground_x": det.get("ground_x", det["x"]),
                                        "ground_y": det.get("ground_y", det["y"]),
                                        "team": team,
                                        "tracker_id": int(tid),
                                        "jersey_color": jersey_col
                                    })
                    except Exception as e:
                        print(f"[HeatmapDebug] JSON error in line: {str(e)}")
                        continue
            
            print(f"[HeatmapDebug] Found {len(positions)} positions")
        except Exception as e:
            print(f"[HeatmapDebug] Global file error: {str(e)}")
            pass

        return positions

@router.get("/{match_id}/heatmap")
async def get_match_heatmap(
    match_id: str, 
    request: Request, 
    team: Optional[str] = None, # Optional: "home", "away"
    tracker_id: Optional[int] = None, # Optional: Spielernummer / Track-ID
    db: Session = Depends(get_db), 
    current_user: Optional[User] = Depends(get_optional_user)
):
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

    # 2D-Spielfeld Homographie-Transformation
    calib = None
    if match.field_calibration:
        try:
            calib = json.loads(match.field_calibration)
        except Exception:
            pass

    src_pts = calib.get("src_points") if calib else [
        {"x": 0.10, "y": 0.20},
        {"x": 0.90, "y": 0.20},
        {"x": 0.98, "y": 0.92},
        {"x": 0.02, "y": 0.92}
    ]
    p_type = calib.get("pitch_type", "full") if calib else "full"

    pitch_positions = []
    zone_stats = None
    home_zone_stats = None
    away_zone_stats = None

    try:
        from services.ai.homography import compute_pitch_homography, transform_positions, calculate_zone_stats
        H = compute_pitch_homography(src_pts, pitch_type=p_type)
        if H is not None:
            pitch_positions = transform_positions(all_positions, H)
            zone_stats = calculate_zone_stats(pitch_positions)

            # Team-spezifische Zonenanalysen
            home_pitch_pts = [p for p in pitch_positions if p.get("team") == "home"]
            away_pitch_pts = [p for p in pitch_positions if p.get("team") == "away"]
            home_zone_stats = calculate_zone_stats(home_pitch_pts)
            away_zone_stats = calculate_zone_stats(away_pitch_pts)
    except Exception as e_hom:
        print(f"[Analytics] Fehler bei Homographie-Berechnung: {e_hom}")

    # Spieler-Übersicht aggregieren (Track-IDs)
    player_summary_map = {}
    base_pts = pitch_positions if pitch_positions else all_positions
    for p in base_pts:
        tid = p.get("tracker_id", 1)
        tm = p.get("team", "home")
        jc = p.get("jersey_color", "#ef4444" if tm == "home" else "#3b82f6")
        if tid not in player_summary_map:
            player_summary_map[tid] = {
                "tracker_id": tid,
                "team": tm,
                "jersey_color": jc,
                "count": 0,
                "sum_x": 0.0,
                "sum_y": 0.0
            }
        player_summary_map[tid]["count"] += 1
        player_summary_map[tid]["sum_x"] += p["x"]
        player_summary_map[tid]["sum_y"] += p["y"]

    total_pts_count = len(base_pts)
    players_list = []
    for tid, pdata in sorted(player_summary_map.items(), key=lambda x: x[1]["count"], reverse=True):
        c = pdata["count"]
        players_list.append({
            "tracker_id": tid,
            "team": pdata["team"],
            "jersey_color": pdata["jersey_color"],
            "count": c,
            "percentage": round((c / total_pts_count * 100), 1) if total_pts_count > 0 else 0,
            "avg_x": round(pdata["sum_x"] / c, 3),
            "avg_y": round(pdata["sum_y"] / c, 3)
        })

    # Teams-Metadaten
    home_count = sum(1 for p in base_pts if p.get("team") == "home")
    away_count = sum(1 for p in base_pts if p.get("team") == "away")
    teams_meta = {
        "home": {
            "id": "home",
            "name": match.team_name or "Heimteam",
            "color": "#ef4444",
            "count": home_count,
            "percentage": round(home_count / max(1, total_pts_count) * 100, 1)
        },
        "away": {
            "id": "away",
            "name": "Gastteam",
            "color": "#3b82f6",
            "count": away_count,
            "percentage": round(away_count / max(1, total_pts_count) * 100, 1)
        }
    }

    # Filter anwenden falls angefordert
    res_player_positions = all_positions
    res_pitch_positions = pitch_positions

    if team and team.lower() in ["home", "away"]:
        req_tm = team.lower()
        res_player_positions = [p for p in res_player_positions if p.get("team") == req_tm]
        res_pitch_positions = [p for p in res_pitch_positions if p.get("team") == req_tm]
        if req_tm == "home" and home_zone_stats:
            zone_stats = home_zone_stats
        elif req_tm == "away" and away_zone_stats:
            zone_stats = away_zone_stats

    if tracker_id is not None:
        res_player_positions = [p for p in res_player_positions if p.get("tracker_id") == tracker_id]
        res_pitch_positions = [p for p in res_pitch_positions if p.get("tracker_id") == tracker_id]
        if res_pitch_positions:
            try:
                from services.ai.homography import calculate_zone_stats
                zone_stats = calculate_zone_stats(res_pitch_positions)
            except Exception:
                pass

    return {
        "match_id": match_id,
        "player_positions": res_player_positions,
        "pitch_positions": res_pitch_positions,
        "field_calibration": calib,
        "zone_stats": zone_stats,
        "team_zone_stats": {
            "home": home_zone_stats,
            "away": away_zone_stats
        },
        "teams": teams_meta,
        "players": players_list,
        "count": len(res_player_positions)
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
