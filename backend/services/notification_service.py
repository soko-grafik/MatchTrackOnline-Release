import smtplib
from email.mime.text import MIMEText
from sqlalchemy.orm import Session
from models import Match, Subscription, User, MatchEvent, UserRole
import os

def get_smtp_config(db: Session = None, custom_cfg: dict = None):
    if custom_cfg and custom_cfg.get("smtp_host"):
        return {
            "enabled": custom_cfg.get("smtp_enabled", True),
            "server": custom_cfg.get("smtp_host"),
            "port": int(custom_cfg.get("smtp_port") or 587),
            "user": custom_cfg.get("smtp_user"),
            "password": custom_cfg.get("smtp_password"),
            "sender": custom_cfg.get("smtp_sender_email") or "noreply@matchtrack.de",
            "use_tls": custom_cfg.get("smtp_use_tls", True)
        }

    if db:
        try:
            from models import SystemSettings
            settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
            if settings and settings.smtp_enabled:
                return {
                    "enabled": settings.smtp_enabled,
                    "server": settings.smtp_host,
                    "port": settings.smtp_port or 587,
                    "user": settings.smtp_user,
                    "password": settings.smtp_password,
                    "sender": settings.smtp_sender_email or "noreply@matchtrack.de",
                    "use_tls": settings.smtp_use_tls
                }
        except Exception as e:
            print(f"Error fetching SMTP config from DB: {e}")

    server = os.environ.get("SMTP_SERVER")
    user = os.environ.get("SMTP_USER")
    return {
        "enabled": bool(server and user),
        "server": server,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": user,
        "password": os.environ.get("SMTP_PASSWORD"),
        "sender": os.environ.get("SENDER_EMAIL", "noreply@matchtrack.de"),
        "use_tls": True
    }

def send_email(to_email: str, subject: str, body: str, db: Session = None, custom_cfg: dict = None):
    cfg = get_smtp_config(db, custom_cfg)

    if not cfg["enabled"]:
        raise ValueError("SMTP-Versand ist in den Einstellungen deaktiviert.")
    if not cfg["server"]:
        raise ValueError("SMTP Host ist nicht konfiguriert.")
    if not cfg["user"]:
        raise ValueError("SMTP Benutzername ist nicht konfiguriert.")

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = cfg["sender"]
    msg['To'] = to_email

    try:
        if cfg["port"] == 465 or not cfg["use_tls"]:
            server_class = smtplib.SMTP_SSL if cfg["port"] == 465 else smtplib.SMTP
        else:
            server_class = smtplib.SMTP

        with server_class(cfg["server"], cfg["port"], timeout=10) as server:
            if cfg["port"] != 465 and cfg["use_tls"]:
                server.starttls()
            if cfg["user"] and cfg["password"]:
                server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
        print(f"Email sent successfully to {to_email}")
    except Exception as e:
        print(f"CRITICAL: Failed to send email to {to_email}: {e}")
        raise RuntimeError(f"SMTP Fehler beim Senden an {to_email}: {str(e)}")

def notify_subscribers(match_id: str, action: str, event: MatchEvent, db: Session):
    try:
        print(f"DEBUG: notify_subscribers called for match {match_id}")
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            print(f"DEBUG: Match {match_id} not found")
            return

        # Find all subscribers
        subscriptions = db.query(Subscription).filter(Subscription.match_id == match_id).all()
        print(f"DEBUG: Found {len(subscriptions)} subscriptions for match {match_id}")
        if not subscriptions:
            return

        subject = f"MatchTracker: Update in {match.name or match_id}"
        event_desc = "Neue Zeichnung/Kommentar" if action == "created" else "Aktualisierte Zeichnung/Kommentar"
        video_sec = (event.video_time_ms // 1000) if (event and event.video_time_ms is not None) else 0

        body = f"""Hallo,

es gibt eine Aktualisierung im Spiel '{match.name or match_id}'.

Aktion: {event_desc}
Zeitstempel im Video: {video_sec}s

Link zum Match: https://matchtrack.de/matches?id={match_id}

Dein MatchTracker Team
"""

        for sub in subscriptions:
            user = sub.user
            if user and user.email:
                print(f"DEBUG: Sending notification to user {user.username} ({user.email})")
                send_email(user.email, subject, body)
            else:
                print(f"DEBUG: Subscription {sub.id} has no valid user or email")
    except Exception as err:
        print(f"Error in notify_subscribers: {err}")

def notify_admin_new_registration(new_user: User, db: Session):
    print(f"DEBUG: notify_admin_new_registration for {new_user.username}")
    # Find all admins
    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()

    subject = f"🔔 Neue Registrierung: {new_user.username}"
    body = f"""Hallo Admin,

ein neuer Benutzer hat sich registriert und wartet auf deine Freischaltung:

• Benutzername: {new_user.username}
• E-Mail: {new_user.email}
• Name: {new_user.first_name or ''} {new_user.last_name or ''}

Du kannst den Benutzer im Admin-Dashboard direkt freischalten:
https://matchtrack.de/admin/users

Dein MatchTracker System
"""
    # 1. Send E-Mail to all Admins (passing db so SystemSettings SMTP configuration is used)
    for admin in admins:
        if admin.email:
            try:
                send_email(admin.email, subject, body, db=db)
            except Exception as e:
                print(f"Error sending registration email to admin {admin.username}: {e}")

    # 2. Send Web Push Notification to all Admins who enabled Push
    try:
        from models import PushSubscription
        import json
        import os

        admin_ids = [a.id for a in admins]
        push_subs = db.query(PushSubscription).filter(PushSubscription.user_id.in_(admin_ids)).all()

        if push_subs:
            push_payload = json.dumps({
                "title": "👤 Neue Benutzer-Registrierung",
                "body": f"{new_user.username} ({new_user.email}) wartet auf deine Freischaltung.",
                "url": "/admin/users"
            })

            # Must stay in sync with the frontend's NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            # otherwise the push service rejects the request with 403.
            vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "AMI9ABKmCQ_dgj3Qomgbi4mZUIQhAkN-d-UVgLCVsec")
            vapid_claims = {"sub": "mailto:admin@matchtrack.de"}

            try:
                from pywebpush import webpush, WebPushException
                for sub in push_subs:
                    try:
                        webpush(
                            subscription_info={
                                "endpoint": sub.endpoint,
                                "keys": {
                                    "p256dh": sub.p256dh,
                                    "auth": sub.auth
                                }
                            },
                            data=push_payload,
                            vapid_private_key=vapid_private_key,
                            vapid_claims=vapid_claims
                        )
                        print(f"Web Push registration notification sent to admin user_id {sub.user_id}")
                    except Exception as push_ex:
                        status = getattr(getattr(push_ex, "response", None), "status_code", None)
                        print(f"Error sending Web Push to admin {sub.user_id}, status {status}: {push_ex}")
                        # Only delete on 404/410 - see send_web_push() for the rationale.
                        if isinstance(push_ex, WebPushException) and status in (404, 410):
                            try:
                                db.delete(sub)
                                db.commit()
                                print(f"Pruned expired PushSubscription {sub.id} (HTTP {status})")
                            except Exception:
                                pass

            except ImportError:
                print("pywebpush module not installed - skipping push notification")
    except Exception as err:
        print(f"Error triggering push notification for new registration: {err}")


def notify_user_approved(user: User, db: Session = None):
    print(f"DEBUG: notify_user_approved for {user.username}")
    if not user.email:
        return

    subject = "Willkommen beim MatchTracker: Dein Account wurde freigeschaltet"
    body = f"""Hallo {user.username},

gute Nachrichten! Dein Account beim MatchTracker wurde soeben von einem Administrator freigeschaltet.

Du kannst dich nun anmelden:
https://matchtrack.de/login

Viel Spaß bei der Analyse!
Dein MatchTracker Team
"""
    send_email(user.email, subject, body, db=db)

def notify_users_new_video(user_ids: list[str], match_id: str, match_name: str, db: Session):
    print(f"DEBUG: notify_users_new_video for match {match_id} to {len(user_ids)} users")
    
    match = db.query(Match).filter(Match.id == match_id).first()
    category_badge = match.category if (match and match.category) else "Punktspiel"
    team_name = match.team_name if (match and match.team_name) else None
    
    # 1. Add subscriptions for these users so they follow the match
    for u_id in user_ids:
        existing_sub = db.query(Subscription).filter(
            Subscription.user_id == u_id,
            Subscription.match_id == match_id
        ).first()
        
        if not existing_sub:
            new_sub = Subscription(user_id=u_id, match_id=match_id)
            db.add(new_sub)
    
    try:
        db.commit()
    except Exception as e:
        print(f"Error committing subscriptions: {e}")

    # 2. Send emails
    subject = f"⚽ Neues Match-Video verfügbar: {match_name}"
    
    for u_id in user_ids:
        user = db.query(User).filter(User.id == u_id).first()
        if not user or not user.email:
            continue

        text_body = f"""Hallo {user.username},

Ein neues Match-Video wurde auf MatchTracker hochgeladen:
Match: {match_name}
Category: {category_badge}
{f'Team: {team_name}' if team_name else ''}

Sieh dir das Video und die KI-Analysen jetzt an:
https://matchtrack.de/matches?id={match_id}

Dein MatchTracker Team
"""

        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding: 30px; text-align: left;">
                      <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #93c5fd; margin-bottom: 6px;">MATCHTRACKER ONLINE</div>
                      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; text-transform: uppercase; font-style: italic;">Neues Spiel verfügbar!</h1>
                    </td>
                  </tr>

                  <!-- Content Body -->
                  <tr>
                    <td style="padding: 30px;">
                      <p style="margin-top: 0; font-size: 15px; color: #d4d4d8;">Hallo <strong>{user.username}</strong>,</p>
                      <p style="font-size: 14px; color: #a1a1aa; line-height: 1.6;">Ein neues Video steht für dich zur Analyse und Wiedergabe bereit:</p>
                      
                      <!-- Match Info Card -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; margin: 20px 0; padding: 20px;">
                        <tr>
                          <td>
                            <div style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                              {category_badge}
                            </div>
                            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #ffffff;">{match_name}</h2>
                            {f'<p style="margin: 0; font-size: 13px; color: #9ca3af; font-weight: 600;">Mannschaft: {team_name}</p>' if team_name else ''}
                          </td>
                        </tr>
                      </table>

                      <!-- Call to Action Button -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; margin-bottom: 10px;">
                        <tr>
                          <td align="center">
                            <a href="https://matchtrack.de/matches?id={match_id}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.4);">
                              ⚽ Jetzt Video ansehen
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #09090b; padding: 20px 30px; border-top: 1px solid #27272a; text-align: center; font-size: 11px; color: #71717a;">
                      <p style="margin: 0 0 6px 0;">Du erhältst diese Benachrichtigung, weil ein Trainer oder Administrator dich für dieses Match benachrichtigt hat.</p>
                      <p style="margin: 0; font-weight: 700; color: #52525b;">MatchTracker Online &bull; Video & Tracking Platform</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        
        send_email_html(user.email, subject, body_html, text_body=text_body, db=db)

def send_email_html(to_email: str, subject: str, html_body: str, text_body: str = None, db: Session = None):
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    cfg = get_smtp_config(db)
    if not cfg["enabled"] or not cfg["server"] or not cfg["user"]:
        print(f"Skipping HTML email to {to_email}: SMTP not enabled or unconfigured")
        return

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = cfg["sender"]
    msg['To'] = to_email

    if text_body:
        part_text = MIMEText(text_body, 'plain')
        msg.attach(part_text)

    part_html = MIMEText(html_body, 'html')
    msg.attach(part_html)

    try:
        if cfg["port"] == 465 or not cfg["use_tls"]:
            server_class = smtplib.SMTP_SSL if cfg["port"] == 465 else smtplib.SMTP
        else:
            server_class = smtplib.SMTP

        with server_class(cfg["server"], cfg["port"], timeout=10) as server:
            if cfg["port"] != 465 and cfg["use_tls"]:
                server.starttls()
            if cfg["user"] and cfg["password"]:
                server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
        print(f"HTML Email sent successfully to {to_email}")
    except Exception as e:
        print(f"CRITICAL: Failed to send HTML email to {to_email}: {e}")


def send_web_push(user_ids: list[str], title: str, body: str, url: str = "/organizer", db: Session = None):
    """
    Sends a Web Push notification to all active PushSubscriptions of the given user_ids.
    """
    if not user_ids or not db:
        return 0

    try:
        from models import PushSubscription
        import json
        import os
        from pywebpush import webpush, WebPushException

        push_subs = db.query(PushSubscription).filter(PushSubscription.user_id.in_(user_ids)).all()
        if not push_subs:
            print(f"[WEB-PUSH] ⚠️ No PushSubscriptions stored in DB for target user_ids {user_ids}. (User must activate Push-Notifications in Organizer menu!)")
            return 0

        print(f"[WEB-PUSH] Found {len(push_subs)} active PushSubscription(s) for user_ids {user_ids}")

        vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "AMI9ABKmCQ_dgj3Qomgbi4mZUIQhAkN-d-UVgLCVsec")
        vapid_claims = {"sub": "mailto:admin@matchtrack.de"}

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url
        })

        sent_count = 0
        for sub in push_subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth
                        }
                    },
                    data=payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims
                )
                sent_count += 1
            except WebPushException as p_err:
                # Only 404/410 from the push service mean the endpoint is permanently gone.
                # Any other failure (network hiccup, library or VAPID misconfiguration) says
                # nothing about the subscription, so it must never be deleted for that.
                status = getattr(getattr(p_err, "response", None), "status_code", None)
                print(f"[WEB-PUSH] Error sending to sub {sub.id} (user {sub.user_id}), status {status}: {p_err}")
                if status in (404, 410):
                    try:
                        db.delete(sub)
                        db.commit()
                        print(f"[WEB-PUSH] Pruned expired PushSubscription {sub.id} (HTTP {status})")
                    except Exception:
                        pass
            except Exception as p_err:
                print(f"[WEB-PUSH] Unexpected error sending to sub {sub.id} (user {sub.user_id}): {p_err}")
        return sent_count
    except ImportError:
        print("[WEB-PUSH] pywebpush module is not installed!")
        return 0
    except Exception as e:
        print(f"[WEB-PUSH] Error sending push: {e}")
        return 0


def notify_team_new_event(events: list, creator: User, db: Session):
    """
    Sends immediate Web Push notification to all members/trainers of the team
    when a new calendar event is created by another user.
    """
    if not events:
        return

    first_event = events[0]
    team_ids = first_event.team_ids

    # Determine target users: members of every assigned team, except the creator
    target_user_ids = set()
    if team_ids:
        from models import user_teams
        members = db.query(User.id).join(user_teams, User.id == user_teams.c.user_id).filter(user_teams.c.team_id.in_(team_ids)).all()
        for m in members:
            if m[0] != creator.id:
                target_user_ids.add(m[0])
    else:
        # If event is global (no team_id), notify all users except creator
        all_users = db.query(User.id).filter(User.id != creator.id).all()
        for u in all_users:
            target_user_ids.add(u[0])

    if not target_user_ids:
        return

    creator_name = creator.first_name or creator.username
    event_type_label = "🟢 Training" if first_event.event_type == "TRAINING" else ("🔴 Spiel" if first_event.event_type == "MATCH" else "🔵 Termin")
    date_str = first_event.start_time.strftime("%d.%m. um %H:%M")
    
    count_str = f" ({len(events)} Termine)" if len(events) > 1 else ""
    title = f"📅 Neuer Termin{count_str}: {first_event.title}"
    body = f"{creator_name} hat einen neuen Termin erstellt: {event_type_label} am {date_str} Uhr."

    sent = send_web_push(list(target_user_ids), title=title, body=body, url="/organizer", db=db)
    print(f"[PUSH-EVENT-CREATE] Notified {sent} device(s) for newly created event '{first_event.title}'")


def check_and_send_event_reminders(db: Session):
    """
    Checks all calendar events and sends WebPush & Email notifications
    to assigned team trainers/members when an event is due (based on reminder_minutes).
    """
    try:
        from models import CalendarEvent, PushSubscription, User, user_teams, UserRole
        from datetime import datetime, timedelta
        import json
        import os

        now_utc = datetime.utcnow()
        now_local = datetime.now()
        print(f"[PUSH-SCHEDULER] Running check_and_send_event_reminders at UTC: {now_utc.strftime('%Y-%m-%d %H:%M:%S')}, Local: {now_local.strftime('%Y-%m-%d %H:%M:%S')}")

        # start_time is naive server-local, so the window must be built from now_local.
        # Bounding it with now_utc cut the last hours off on a UTC+n server, which put
        # events with a 1-day reminder out of range entirely. The 2-day lookahead keeps
        # the largest supported reminder (1440 min) comfortably inside the window.
        events = db.query(CalendarEvent).filter(
            CalendarEvent.reminder_minutes > 0,
            CalendarEvent.start_time >= now_local - timedelta(hours=2),
            CalendarEvent.start_time <= now_local + timedelta(days=2)
        ).all()

        if not events:
            print("[PUSH-SCHEDULER] No upcoming calendar events found with reminder_minutes > 0.")
            return

        print(f"[PUSH-SCHEDULER] Found {len(events)} upcoming event(s) to check.")

        for ev in events:
            # start_time is stored naive in server-local time (the frontend submits a
            # local "YYYY-MM-DDTHH:mm"), so it must be compared against now_local.
            reminder_time = ev.start_time - timedelta(minutes=ev.reminder_minutes)
            seconds_until_start_local = (ev.start_time - now_local).total_seconds()

            # Due from the reminder moment until the event starts. No grace period on
            # the upper bound: firing before reminder_time would leave reminder_sent_at
            # behind it, so the next tick would not recognise the reminder as sent and
            # would fire a second time. The 60s loop makes it fire at most 59s late.
            is_due = 0 <= seconds_until_start_local <= (ev.reminder_minutes * 60)

            # Send once per reminder. Storing the send time also re-arms the reminder
            # automatically when an event is moved to a later slot, because the new
            # reminder_time then lies after the recorded timestamp.
            already_sent = ev.reminder_sent_at is not None and ev.reminder_sent_at >= reminder_time

            print(f"[PUSH-SCHEDULER] Event ID {ev.id} '{ev.title}' (Start: {ev.start_time}, Reminder: {ev.reminder_minutes}m before -> {reminder_time}). Until start: {seconds_until_start_local:.0f}s, due={is_due}, already_sent={already_sent}")

            if is_due and not already_sent:
                print(f"[PUSH-SCHEDULER] 🎯 Event '{ev.title}' IS DUE FOR PUSH NOTIFICATION!")

                # Mark before dispatching, and regardless of how many devices are
                # reached: a retry every 60s cannot improve the outcome and would
                # turn one reminder into a notification storm.
                ev.reminder_sent_at = now_local
                try:
                    db.commit()
                except Exception as commit_err:
                    db.rollback()
                    print(f"[PUSH-SCHEDULER] ⚠️ Could not persist reminder_sent_at for event {ev.id}: {commit_err}")
                    continue

                # Target users: team members/trainers + event creator + admins
                target_user_ids = set()
                if ev.created_by_user_id:
                    target_user_ids.add(ev.created_by_user_id)

                ev_team_ids = ev.team_ids
                if ev_team_ids:
                    team_users = db.query(User.id).join(user_teams, User.id == user_teams.c.user_id).filter(user_teams.c.team_id.in_(ev_team_ids)).all()
                    for t_tuple in team_users:
                        target_user_ids.add(t_tuple[0])
                
                # Also include all admins
                all_admins = db.query(User.id).filter(User.role == UserRole.ADMIN).all()
                for a_id in all_admins:
                    target_user_ids.add(a_id[0])

                if not target_user_ids:
                    print(f"[PUSH-SCHEDULER] ⚠️ No target user IDs found for event '{ev.title}' (team_ids: {ev_team_ids}, created_by: {ev.created_by_user_id})")
                    continue

                print(f"[PUSH-SCHEDULER] Target user IDs for event '{ev.title}': {list(target_user_ids)}")

                event_type_label = "🟢 Training" if ev.event_type == "TRAINING" else ("🔴 Spiel" if ev.event_type == "MATCH" else "🔵 Termin")
                time_str = ev.start_time.strftime("%H:%M")
                
                title = f"⏰ Erinnerung: {ev.title}"
                body = f"{event_type_label} beginnt in {ev.reminder_minutes} Min. (um {time_str} Uhr)!"

                sent = send_web_push(list(target_user_ids), title=title, body=body, url="/organizer", db=db)
                print(f"[PUSH-SCHEDULER] ✅ Sent reminder push for '{ev.title}' to {sent} device(s) (Target users: {list(target_user_ids)}).")

    except Exception as err:
        print(f"[PUSH-SCHEDULER] ❌ Critical error in check_and_send_event_reminders: {err}")


def check_and_send_birthday_reminders(db: Session):
    """
    Checks if any player has a birthday today and sends automatic Push Notifications
    to all assigned team trainers and admins.
    """
    try:
        from models import Player, User, user_teams, UserRole
        from datetime import datetime
        import re

        now = datetime.utcnow()
        today_day = now.day
        today_month = now.month

        players_with_dob = db.query(Player).filter(Player.date_of_birth != None).all()
        birthday_players = []

        for p in players_with_dob:
            if not p.date_of_birth:
                continue
            parts = [pt for pt in re.split(r'[.\-/]', p.date_of_birth.strip()) if pt]
            if len(parts) >= 2:
                try:
                    if len(parts[0]) == 4: # YYYY-MM-DD
                        dob_m = int(parts[1])
                        dob_d = int(parts[2])
                    else: # DD.MM.YYYY
                        dob_d = int(parts[0])
                        dob_m = int(parts[1])

                    if dob_d == today_day and dob_m == today_month:
                        birthday_players.append(p)
                except ValueError:
                    continue

        if not birthday_players:
            return

        for p in birthday_players:
            # One push per birthday, not one per scheduler tick.
            if p.birthday_notified_at and p.birthday_notified_at.date() == now.date():
                continue

            target_user_ids = set()
            if p.team_id:
                team_trainers = db.query(User.id).join(user_teams, User.id == user_teams.c.user_id).filter(user_teams.c.team_id == p.team_id).all()
                for t_tuple in team_trainers:
                    target_user_ids.add(t_tuple[0])
            
            all_admins = db.query(User.id).filter(User.role == UserRole.ADMIN).all()
            for a_id in all_admins:
                target_user_ids.add(a_id[0])

            if not target_user_ids:
                continue

            # Mark before dispatching - see check_and_send_event_reminders().
            p.birthday_notified_at = now
            try:
                db.commit()
            except Exception as commit_err:
                db.rollback()
                print(f"[PUSH-BIRTHDAY] ⚠️ Could not persist birthday_notified_at for player {p.id}: {commit_err}")
                continue

            team_info = f" ({p.team.name})" if p.team else ""
            title = f"🎂 Heute Geburtstag: {p.first_name} {p.last_name}"
            body = f"Dein Spieler {p.first_name} {p.last_name}{team_info} feiert heute Geburtstag! 🎉"

            sent = send_web_push(list(target_user_ids), title=title, body=body, url="/players", db=db)
            print(f"[PUSH-BIRTHDAY] Sent Birthday Push for {p.first_name} {p.last_name} to {sent} device(s)")

    except Exception as err:
        print(f"Error in check_and_send_birthday_reminders: {err}")




