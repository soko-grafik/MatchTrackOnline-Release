import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from models import UserActivityLog, UserActivityType

def log_user_activity(
    db: Session,
    user_id: str,
    activity_type: str,
    resource_type: str = None,
    resource_id: str = None,
    details: dict = None,
    ip_address: str = None,
    user_agent: str = None
) -> None:
    """
    Protokolliert eine Benutzeraktion schlank und sicher in der Datenbank.
    Wirft keine Fehler nach oben weiter, um Hauptabläufe nie zu blockieren.
    """
    if not user_id:
        return

    try:
        log_entry = UserActivityLog(
            id=f"act_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            activity_type=str(activity_type),
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent[:250] if user_agent else None,
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[ActivityLog] Error logging activity for user {user_id}: {e}")
