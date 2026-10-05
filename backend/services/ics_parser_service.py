import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

GERMAN_STATES = [
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
    "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
    "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"
]

def unfold_ics_content(ics_text: str) -> List[str]:
    """
    Unfolds multi-line properties in RFC 5545 iCalendar text.
    Lines starting with space or tab are continuations of the previous line.
    """
    normalized = ics_text.replace('\r\n', '\n').replace('\r', '\n')
    lines = normalized.split('\n')
    unfolded: List[str] = []
    
    for line in lines:
        if not line:
            continue
        if (line.startswith(' ') or line.startswith('\t')) and unfolded:
            unfolded[-1] += line[1:]
        else:
            unfolded.append(line.strip())
            
    return unfolded

def parse_ics_date_value(date_str: str) -> Optional[datetime]:
    """
    Parses ICS date representations:
    - 20260730
    - 20260730T000000Z
    - 20260730T120000
    - 2026-07-30
    """
    if not date_str:
        return None
        
    cleaned = date_str.strip()
    # Remove timezone or params prefix if passed together
    if ':' in cleaned:
        cleaned = cleaned.split(':')[-1].strip()
        
    # Remove non-alphanumeric except T
    digits_and_t = re.sub(r'[^0-9T]', '', cleaned)
    
    # Check date part
    if 'T' in digits_and_t:
        parts = digits_and_t.split('T')
        d_part = parts[0]
        t_part = parts[1] if len(parts) > 1 else "000000"
        if len(d_part) >= 8:
            y, m, d = int(d_part[0:4]), int(d_part[4:6]), int(d_part[6:8])
            hh = int(t_part[0:2]) if len(t_part) >= 2 else 0
            mm = int(t_part[2:4]) if len(t_part) >= 4 else 0
            ss = int(t_part[4:6]) if len(t_part) >= 6 else 0
            return datetime(y, m, d, hh, mm, ss)
    elif len(digits_and_t) >= 8:
        y, m, d = int(digits_and_t[0:4]), int(digits_and_t[4:6]), int(digits_and_t[6:8])
        return datetime(y, m, d, 0, 0, 0)
        
    return None

def unescape_ics_text(text: str) -> str:
    """
    Unescapes backslash sequences according to RFC 5545.
    """
    if not text:
        return ""
    text = text.replace('\\,', ',').replace('\\;', ';')
    text = text.replace('\\n', ' ').replace('\\N', ' ')
    text = text.replace('\\\\', '\\')
    return text.strip()

def detect_german_state(text: str, location: Optional[str] = None) -> Optional[str]:
    """
    Tries to detect German federal state from text or location.
    """
    combined = f"{text} {location or ''}"
    for state in GERMAN_STATES:
        # Match case-insensitively with word boundaries or substring
        pattern = r'\b' + re.escape(state) + r'\b'
        if re.search(pattern, combined, re.IGNORECASE):
            return state
        # Also check common abbreviations (BW, NRW, RLP, etc.)
        if state == "Nordrhein-Westfalen" and re.search(r'\bNRW\b', combined, re.IGNORECASE):
            return "Nordrhein-Westfalen"
        if state == "Baden-Württemberg" and re.search(r'\b(BW|Baden-Wuerttemberg)\b', combined, re.IGNORECASE):
            return "Baden-Württemberg"
        if state == "Rheinland-Pfalz" and re.search(r'\bRLP\b', combined, re.IGNORECASE):
            return "Rheinland-Pfalz"
        if state == "Mecklenburg-Vorpommern" and re.search(r'\bMV\b', combined, re.IGNORECASE):
            return "Mecklenburg-Vorpommern"
        if state == "Schleswig-Holstein" and re.search(r'\bSH\b', combined, re.IGNORECASE):
            return "Schleswig-Holstein"
            
    return location.strip() if location and len(location.strip()) > 0 else None

def parse_school_holidays_from_ics(ics_content: str) -> List[Dict[str, Any]]:
    """
    Parses school holiday event periods from iCalendar (.ics) string.
    Returns list of dicts with:
    - name (str)
    - start_date (datetime)
    - end_date (datetime)
    - state_or_region (Optional[str])
    """
    unfolded_lines = unfold_ics_content(ics_content)
    
    events: List[Dict[str, Any]] = []
    current_event: Optional[Dict[str, str]] = None
    
    for line in unfolded_lines:
        upper_line = line.upper()
        if upper_line == "BEGIN:VEVENT":
            current_event = {}
        elif upper_line == "END:VEVENT" and current_event is not None:
            # Process current event
            summary = unescape_ics_text(current_event.get("SUMMARY", ""))
            location = unescape_ics_text(current_event.get("LOCATION", ""))
            
            # Start date
            raw_dtstart = current_event.get("DTSTART", "")
            raw_dtend = current_event.get("DTEND", "")
            
            start_dt = parse_ics_date_value(raw_dtstart)
            end_dt = parse_ics_date_value(raw_dtend)
            
            if start_dt and summary:
                # If DTEND is date-only (e.g. VALUE=DATE or no time) and is strictly after start_dt:
                # In RFC 5545, date-only DTEND is exclusive (e.g. 2026-07-30 to 2026-09-12 means until end of 2026-09-11).
                is_date_only = ("VALUE=DATE" in current_event.get("_DTEND_KEY", "").upper() or 
                                "VALUE=DATE" in current_event.get("_DTSTART_KEY", "").upper() or
                                ("T" not in raw_dtstart and "T" not in raw_dtend))
                
                if end_dt:
                    if is_date_only and end_dt > start_dt:
                        # Convert exclusive end date to inclusive end-of-day
                        end_inclusive = end_dt - timedelta(days=1)
                        end_dt = datetime(end_inclusive.year, end_inclusive.month, end_inclusive.day, 23, 59, 59)
                    else:
                        end_dt = datetime(end_dt.year, end_dt.month, end_dt.day, 23, 59, 59)
                else:
                    # Single day holiday
                    end_dt = datetime(start_dt.year, start_dt.month, start_dt.day, 23, 59, 59)
                    
                start_dt = datetime(start_dt.year, start_dt.month, start_dt.day, 0, 0, 0)
                
                # Check end_dt >= start_dt
                if end_dt < start_dt:
                    end_dt = datetime(start_dt.year, start_dt.month, start_dt.day, 23, 59, 59)
                    
                state = detect_german_state(summary, location)
                
                events.append({
                    "name": summary,
                    "start_date": start_dt,
                    "end_date": end_dt,
                    "state_or_region": state
                })
                
            current_event = None
        elif current_event is not None:
            # Parse property key and value
            if ':' in line:
                prop_key, prop_val = line.split(':', 1)
                clean_key = prop_key.split(';')[0].strip().upper()
                current_event[clean_key] = prop_val.strip()
                current_event[f"_{clean_key}_KEY"] = prop_key.strip()
                
    # Sort events chronologically
    events.sort(key=lambda x: x["start_date"])
    return events
