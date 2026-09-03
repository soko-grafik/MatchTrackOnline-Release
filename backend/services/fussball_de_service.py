import re
from datetime import datetime
from typing import List, Dict, Any, Optional

def extract_time_from_string(text: str) -> Optional[tuple]:
    if not text:
        return None
    # 1. Match with 'Uhr' e.g. "11:30 Uhr", "11.30 Uhr", "9:00 Uhr"
    m_uhr = re.search(r"(\d{1,2})[:\.](\d{2})\s*Uhr", text, re.IGNORECASE)
    if m_uhr:
        h, mn = int(m_uhr.group(1)), int(m_uhr.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return (h, mn)

    # 2. Match standard HH:MM e.g. " | 11:30", "11:30", "09:15", " 15:00 "
    matches = re.finditer(r"(?:^|[^\d])(\d{1,2}):(\d{2})(?:[^\d]|$)", text)
    for m in matches:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            if mn in (0, 15, 30, 45) or 8 <= h <= 22:
                return (h, mn)
    return None


def extract_time(row, date_cell, time_cell, current_date_str) -> Optional[tuple]:
    # 1. Direct time_cell
    if time_cell:
        res = extract_time_from_string(time_cell.text)
        if res:
            return res
        for sub in time_cell.find_all(True):
            res = extract_time_from_string(sub.text)
            if res:
                return res

    # 2. Inside date_cell
    if date_cell:
        for t_elem in date_cell.find_all(class_=re.compile(r"time", re.I)):
            res = extract_time_from_string(t_elem.text)
            if res:
                return res
        res = extract_time_from_string(date_cell.text)
        if res:
            return res

    # 3. Any element with class 'time' in row
    for t_elem in row.find_all(class_=re.compile(r"time|info-text|detail", re.I)):
        res = extract_time_from_string(t_elem.text)
        if res:
            return res

    # 4. From headline current_date_str
    if current_date_str:
        res = extract_time_from_string(current_date_str)
        if res:
            return res

    # 5. From row text
    res = extract_time_from_string(row.text)
    if res:
        return res

    return None


def extract_date(row, date_cell, current_date_str) -> Optional[tuple]:
    sources = []
    if date_cell:
        sources.append(date_cell.text)
    if current_date_str:
        sources.append(current_date_str)
    sources.append(row.text)

    for src in sources:
        if not src:
            continue
        m = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", src)
        if m:
            d, mo, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if yr < 100:
                yr += 2000
            if 1 <= d <= 31 and 1 <= mo <= 12 and 2000 <= yr <= 2100:
                return (yr, mo, d)
    return None


def fetch_and_parse_fussball_de_team_matches(url_or_team_id: str, target_team_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Parses matches for a team from fussball.de given a full URL or team ID.
    Queries team main page, spielplan page, and AJAX endpoints for full match schedule.
    """
    try:
        import requests
        from bs4 import BeautifulSoup
    except ImportError:
        print("Warnung: 'requests' oder 'beautifulsoup4' (bs4) ist nicht im Python Environment installiert.")
        return []

    clean_input = url_or_team_id.strip()
    
    # Extract team-id from URL if full URL is passed
    team_id = clean_input
    if "team-id/" in clean_input:
        match_tid = re.search(r"team-id/([A-Za-z0-9]+)", clean_input)
        if match_tid:
            team_id = match_tid.group(1)

    # Base URLs
    base_url = clean_input.split("#")[0] if "fussball.de" in clean_input else f"https://www.fussball.de/mannschaft/-/-/team-id/{team_id}"
    spielplan_url = f"https://www.fussball.de/spielplan/-/-/team-id/{team_id}"

    target_urls = [
        base_url,
        spielplan_url,
        f"https://www.fussball.de/ajax.team.next.games/-/mode/PAGE/team-id/{team_id}",
        f"https://www.fussball.de/ajax.team.prev.games/-/mode/PAGE/team-id/{team_id}",
        f"https://www.fussball.de/ajax.team.next.matches/-/team-id/{team_id}",
        f"https://www.fussball.de/ajax.team.prev.matches/-/team-id/{team_id}",
        f"https://www.fussball.de/ajax.team.stage.next.matches/-/team-id/{team_id}"
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.fussball.de/"
    }

    matches: List[Dict[str, Any]] = []
    seen_ids = set()
    own_fde_team_name = ""

    for url in target_urls:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            
            # Extract own team name from page header if not yet found
            if not own_fde_team_name:
                h1 = soup.find("h1")
                if h1 and h1.text.strip():
                    own_fde_team_name = " ".join(h1.text.split()).strip()
                if not own_fde_team_name:
                    meta_title = soup.find("meta", property="og:title")
                    if meta_title and meta_title.get("content"):
                        own_fde_team_name = meta_title["content"].split("|")[0].split("-")[0].strip()

            # Find all table rows
            rows = soup.find_all("tr")
            
            current_date_str = ""

            for row in rows:
                try:
                    row_classes = [str(c).lower() for c in (row.get("class") or [])]
                    row_text = " ".join(row.text.split()).strip()

                    # 1. Headline / Competition / Divider rows: extract date if present and ALWAYS SKIP
                    is_header_row = any(c in row_classes for c in ["row-headline", "headline", "row-competition", "row-divider", "header", "thead"]) or "column-headline" in str(row).lower() or row.find("th") is not None
                    if is_header_row or ("colspan" in str(row).lower() and not row.find(class_=re.compile(r"column-club|club-name", re.I))):
                        date_match_hl = re.search(r"(\d{1,2}\.\d{1,2}\.\d{2,4})", row_text)
                        if date_match_hl:
                            current_date_str = row_text
                        continue

                    # Extract Match ID
                    match_id_attr = (row.get("data-match-id") or row.get("id") or "").replace("match-", "").strip()
                    
                    # Time and Date Cells
                    time_cell = row.find(class_=re.compile(r"column-time|time|row-time", re.I))
                    date_cell = row.find(class_=re.compile(r"column-date|date", re.I))

                    # Teams extraction: Home is 1st team, Away/Guest is 2nd team
                    team_home = row.find(class_=re.compile(r"column-club-home|club-home|home-club|column-home|team-home", re.I))
                    team_away = row.find(class_=re.compile(r"column-club-away|club-away|away-club|column-away|team-away|column-club-guest|club-guest|guest-club|column-guest|team-guest", re.I))

                    home_name = ""
                    away_name = ""

                    if team_home:
                        home_name = team_home.text.strip()
                    if team_away:
                        away_name = team_away.text.strip()

                    # Fallback by column position: 1st club cell is Home, 2nd is Away/Guest
                    if not home_name or not away_name:
                        club_tds = row.find_all("td", class_=re.compile(r"column-club|column-team|club|team", re.I))
                        if len(club_tds) >= 2:
                            h_div = club_tds[0].find(class_=re.compile(r"club-name|name", re.I)) or club_tds[0]
                            a_div = club_tds[1].find(class_=re.compile(r"club-name|name", re.I)) or club_tds[1]
                            home_name = h_div.text.strip()
                            away_name = a_div.text.strip()
                            team_home = club_tds[0]
                            team_away = club_tds[1]

                    if not home_name or not away_name or home_name == away_name:
                        continue

                    # Clean team names from line breaks
                    home_name = " ".join(home_name.split())
                    away_name = " ".join(away_name.split())

                    # Filter out competition titles or metadata text mistakenly parsed as team names
                    invalid_tokens = ["kreisliga", "kreisklasse", "verbandsliga", "landesklasse", "kreisoberliga", "regionalliga", "oberliga", "staffel", "me|", "spielfrei", "abgesetzt", "verlegt", "annulliert"]
                    if any(tok in home_name.lower() for tok in invalid_tokens) or any(tok in away_name.lower() for tok in invalid_tokens):
                        continue
                    if len(home_name) < 3 or len(away_name) < 3:
                        continue

                    # Extract Date & Time
                    date_tuple = extract_date(row, date_cell, current_date_str)
                    if not date_tuple:
                        continue

                    year, month, day = date_tuple
                    time_tuple = extract_time(row, date_cell, time_cell, current_date_str)
                    if time_tuple:
                        hour, minute = time_tuple
                    else:
                        hour, minute = 15, 0

                    start_dt = datetime(year=year, month=month, day=day, hour=hour, minute=minute)
                    end_dt = datetime.fromtimestamp(start_dt.timestamp() + 7200)

                    # Determine if imported team is Home or Away
                    str_home = str(team_home).lower() if team_home else ""
                    str_away = str(team_away).lower() if team_away else ""
                    target_tid = team_id.lower() if team_id else ""

                    is_home_match = None
                    opponent_name = None

                    # 1. Check team ID in home vs away cells (case-insensitive)
                    if target_tid and f"team-id/{target_tid}" in str_home:
                        is_home_match = True
                        opponent_name = away_name
                    elif target_tid and f"team-id/{target_tid}" in str_away:
                        is_home_match = False
                        opponent_name = home_name

                    # 2. Check team name from page header
                    if is_home_match is None and own_fde_team_name:
                        norm_fde = re.sub(r'[^a-zA-Z0-9]', '', own_fde_team_name.lower())
                        norm_home = re.sub(r'[^a-zA-Z0-9]', '', home_name.lower())
                        norm_away = re.sub(r'[^a-zA-Z0-9]', '', away_name.lower())

                        if norm_fde and (norm_fde in norm_home or norm_home in norm_fde):
                            is_home_match = True
                            opponent_name = away_name
                        elif norm_fde and (norm_fde in norm_away or norm_away in norm_fde):
                            is_home_match = False
                            opponent_name = home_name

                    # 3. Check target team name passed from MatchTrack
                    if is_home_match is None and target_team_name:
                        norm_target = re.sub(r'[^a-zA-Z0-9]', '', target_team_name.lower())
                        norm_home = re.sub(r'[^a-zA-Z0-9]', '', home_name.lower())
                        norm_away = re.sub(r'[^a-zA-Z0-9]', '', away_name.lower())

                        if norm_target and (norm_target in norm_home or norm_home in norm_target):
                            is_home_match = True
                            opponent_name = away_name
                        elif norm_target and (norm_target in norm_away or norm_away in norm_target):
                            is_home_match = False
                            opponent_name = home_name

                    # If this match does NOT belong to the imported team, skip it (unrelated league row)
                    if is_home_match is None:
                        continue

                    # Extract Venue / Location: simple Sportplatz default
                    location_venue = "Sportplatz"

                    # Canonical deduplication across multiple fussball.de endpoints
                    clean_h = re.sub(r'[^a-z0-9]', '', home_name.lower())[:8]
                    clean_a = re.sub(r'[^a-z0-9]', '', away_name.lower())[:8]
                    date_key = start_dt.strftime('%Y%m%d')
                    canonical_key = f"fde_{date_key}_{clean_h}_{clean_a}"

                    if canonical_key in seen_ids or (match_id_attr and match_id_attr in seen_ids):
                        continue

                    seen_ids.add(canonical_key)
                    if match_id_attr:
                        seen_ids.add(match_id_attr)

                    m_id = match_id_attr if match_id_attr else canonical_key

                    matches.append({
                        "fussball_de_match_id": m_id,
                        "title": f"Spiel: {home_name} vs. {away_name}",
                        "home_team": home_name,
                        "away_team": away_name,
                        "opponent": opponent_name,
                        "start_time": start_dt,
                        "end_time": end_dt,
                        "location": location_venue,
                        "is_home": is_home_match
                    })
                except Exception:
                    continue
        except Exception:
            continue

    return matches
