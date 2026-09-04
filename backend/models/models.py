from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum, Boolean, Table, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    TEAM_ADMIN = "TEAM_ADMIN"
    TRAINER = "TRAINER"
    CO_TRAINER = "CO_TRAINER"
    VIEWER = "VIEWER"

class HeatmapStatus(str, enum.Enum):
    NONE = "NONE"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    FAILED = "FAILED"

class StitchingStatus(str, enum.Enum):
    NONE = "NONE"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    FAILED = "FAILED"

class UserActivityType(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    VIEW_MATCH = "VIEW_MATCH"
    WATCH_TIME = "WATCH_TIME"
    ADD_COMMENT = "ADD_COMMENT"
    CREATE_DRAWING = "CREATE_DRAWING"
    CREATE_TACTICS = "CREATE_TACTICS"
    EDIT_TACTICS = "EDIT_TACTICS"
    CREATE_TRAINING = "CREATE_TRAINING"
    EVALUATE_PLAYER = "EVALUATE_PLAYER"
    SCAN_EXERCISE = "SCAN_EXERCISE"

# Association table for User (Trainer) <-> Team (Many-to-Many) with permissions
user_teams = Table(
    'user_teams',
    Base.metadata,
    Column('user_id', String(50), primary_key=True),
    Column('team_id', String(50), primary_key=True),
    Column('can_edit', Boolean, default=True, nullable=False)
)

class Team(Base):
    __tablename__ = "teams"
    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    age_group = Column(String(50), nullable=True) # E.g., U11, U19
    created_at = Column(DateTime, default=datetime.utcnow)

    trainers = relationship(
        "User",
        secondary=user_teams,
        primaryjoin="Team.id == user_teams.c.team_id",
        secondaryjoin="User.id == user_teams.c.user_id",
        back_populates="teams"
    )
    matches = relationship(
        "Match",
        primaryjoin="Team.id == Match.team_id",
        foreign_keys="[Match.team_id]",
        back_populates="team"
    )

class User(Base):
    __tablename__ = "users"
    id = Column(String(50), primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_approved = Column(Integer, default=0, nullable=False) # 0 = False, 1 = True (SQLite compatibility)
    avatar_path = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    notify_on_new_video = Column(Boolean, default=True)
    notify_on_analysis = Column(Boolean, default=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    module_permissions = Column(JSON, default=dict, nullable=True)
    ai_provider = Column(String(50), default="OPENAI", nullable=True)
    ai_api_key = Column(String(255), nullable=True)
    ai_model_name = Column(String(100), nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teams = relationship(
        "Team",
        secondary=user_teams,
        primaryjoin="User.id == user_teams.c.user_id",
        secondaryjoin="Team.id == user_teams.c.team_id",
        back_populates="trainers"
    )

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id"))
    match_id = Column(String(50), ForeignKey("matches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    match = relationship("Match", back_populates="subscriptions")

class Match(Base):
    __tablename__ = "matches"
    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255))
    team_name = Column(String(100), nullable=True)
    team_id = Column(String(50), nullable=True) # NEU: Verknüpfung zu Team
    category = Column(String(50), nullable=True, default="Punktspiel") # NEU: Kategorie (Punktspiel, Pokalspiel, Testspiel, Training, Trainingslager)
    video_quality = Column(String(20), nullable=True)
    age_group = Column(String(10), nullable=True) # Legacy field
    recording_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    thumbnail_path = Column(String(500), nullable=True)
    heatmap_status = Column(Enum(HeatmapStatus), default=HeatmapStatus.NONE, nullable=False)
    heatmap_path = Column(String(500), nullable=True)

    # Stitching Status
    stitching_status = Column(Enum(StitchingStatus), default=StitchingStatus.NONE, nullable=False)
    video_left_path = Column(String(500), nullable=True)
    video_right_path = Column(String(500), nullable=True)
    stitching_time_offset = Column(Integer, default=0) # Zeitversatz in Sekunden

    # Fields for sharing and password protection
    share_token = Column(String(50), unique=True, index=True, nullable=True)
    is_password_protected = Column(Boolean, default=False, nullable=False) # NEU: Gibt an, ob Passwortschutz aktiv ist
    hashed_password = Column(String(255), nullable=True) # Speichert das gehashte Passwort
    plain_password = Column(String(255), nullable=True) # Speichert das Klartext-Passwort für Trainer/Admins
    password_expires_at = Column(DateTime, nullable=True) # Ablaufdatum/Uhrzeit für externen Passwortzugriff

    # Farbanpassungen (NEU)
    video_brightness = Column(Integer, default=100)
    video_contrast = Column(Integer, default=100)
    video_saturation = Column(Integer, default=100)
    video_hue = Column(Integer, default=0)

    team = relationship(
        "Team",
        primaryjoin="Match.team_id == Team.id",
        foreign_keys="[Match.team_id]",
        back_populates="matches"
    )
    chunks = relationship("VideoChunk", back_populates="match", cascade="all, delete-orphan")
    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="match", cascade="all, delete-orphan")

class VideoChunk(Base):
    __tablename__ = "video_chunks"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    match_id = Column(String(50), ForeignKey("matches.id"))
    video_path = Column(String(500))
    # Neues Feld für die HLS Playlist
    hls_playlist_path = Column(String(500), nullable=True)

    video_path_sd = Column(String(500), nullable=True)
    video_path_hd = Column(String(500), nullable=True)
    video_path_fhd = Column(String(500), nullable=True)
    conversion_status = Column(String(20), default="pending") # pending, processing, completed, failed
    conversion_progress = Column(Integer, default=0) # 0-100
    conversion_pid = Column(Integer, nullable=True)
    tracking_path = Column(String(500), nullable=True)
    file_size_mb = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    match = relationship("Match", back_populates="chunks")

match_event_players = Table(
    'match_event_players',
    Base.metadata,
    Column('match_event_id', String(50), ForeignKey('match_events.id', ondelete='CASCADE'), primary_key=True),
    Column('player_id', String(50), ForeignKey('players.id', ondelete='CASCADE'), primary_key=True)
)

class MatchEvent(Base):
    __tablename__ = "match_events"
    id = Column(String(50), primary_key=True)
    match_id = Column(String(50), ForeignKey("matches.id"))
    event_type = Column(String(100))
    timestamp = Column(DateTime, default=datetime.utcnow)
    video_time_ms = Column(Integer)
    details = Column(JSON, nullable=True)
    match = relationship("Match", back_populates="events")
    
    # NEU: Verknüpfung zu markierten Spielern
    tagged_players = relationship(
        "Player",
        secondary=match_event_players,
        back_populates="tagged_in_events",
        lazy="selectin"
    )

class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, default=1) # Always 1
    
    # Module Toggles
    module_stitching_enabled = Column(Boolean, default=True)
    module_heatmap_enabled = Column(Boolean, default=True)
    module_video_color_enabled = Column(Boolean, default=True)
    module_hls_enabled = Column(Boolean, default=True)
    module_fisheye_enabled = Column(Boolean, default=True)
    module_ai_assistant_enabled = Column(Boolean, default=True)
    
    # Upload Defaults
    default_resolution = Column(String(20), default="1080p")
    default_video_quality = Column(String(20), default="High")
    default_storage_path = Column(String(500), default="uploads")
    auto_hls_conversion = Column(Boolean, default=True)
    auto_stitching = Column(Boolean, default=False)
    show_push_test_button = Column(Boolean, default=False)
    show_match_cleanup_button = Column(Boolean, default=False)
    
    # SMTP E-Mail Settings
    smtp_enabled = Column(Boolean, default=False)
    smtp_host = Column(String(255), nullable=True, default="smtp.example.com")
    smtp_port = Column(Integer, nullable=True, default=587)
    smtp_user = Column(String(255), nullable=True, default="")
    smtp_password = Column(String(255), nullable=True, default="")
    smtp_sender_email = Column(String(255), nullable=True, default="noreply@matchtrack.de")
    smtp_use_tls = Column(Boolean, default=True)

    # FTP Backup Settings
    ftp_enabled = Column(Boolean, default=False)
    ftp_host = Column(String(255), nullable=True, default="")
    ftp_port = Column(Integer, nullable=True, default=21)
    ftp_user = Column(String(255), nullable=True, default="")
    ftp_password = Column(String(255), nullable=True, default="")
    ftp_path = Column(String(255), nullable=True, default="/backups")
    ftp_auto_backup = Column(Boolean, default=False)
    ftp_backup_schedule = Column(String(50), default="DAILY")
    ftp_last_backup_at = Column(DateTime, nullable=True)
    ftp_last_backup_status = Column(String(255), nullable=True, default="NO_BACKUP_YET")
    # Legal / Rechtstexte & DSGVO (Vollständig editierbar durch Admin)
    legal_imprint_content = Column(Text, nullable=True)     # Individuelles Impressum (Markdown)
    legal_privacy_content = Column(Text, nullable=True)     # Individuelle Datenschutzerklärung (Markdown)
    legal_terms_content = Column(Text, nullable=True)       # Individuelle Nutzungsbedingungen (Markdown)
    legal_club_name = Column(String(255), nullable=True, default="")
    legal_contact_email = Column(String(255), nullable=True, default="")
    legal_address = Column(String(500), nullable=True, default="")
    legal_representative = Column(String(255), nullable=True, default="")
    legal_register_info = Column(String(255), nullable=True, default="")

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingExercise(Base):
    __tablename__ = "training_exercises"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(String(5000), nullable=True)
    coaching_points = Column(String(2000), nullable=True)
    age_group = Column(String(50), nullable=False, default="Alle")  # e.g., U7-U9, U10-U13, U14-U19, Senioren, Alle
    focus_area = Column(String(100), nullable=False, default="Passspiel")  # e.g., Koordination, Passspiel, Torschuss, Taktik, Athletik, Umschaltspiel, Zweikampf
    min_players = Column(Integer, default=4, nullable=False)
    max_players = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, default=15, nullable=False)
    materials = Column(JSON, nullable=True)  # List of required items
    diagram_data = Column(JSON, nullable=True)  # Canvas vector elements & drawings
    thumbnail_path = Column(String(500), nullable=True)
    created_by_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User")


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), index=True, nullable=False)
    methodology = Column(String(50), default="Trainingsphilosophie Deutschland", nullable=False)  # "Trainingsphilosophie Deutschland" or "3 + 3"
    date = Column(DateTime, nullable=True)
    team_id = Column(String(50), ForeignKey("teams.id"), nullable=True)
    age_group = Column(String(50), nullable=True)
    notes = Column(String(2000), nullable=True)
    is_shared = Column(Boolean, default=False, nullable=False)
    created_by_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by = relationship("User")
    team = relationship("Team")
    exercises = relationship("TrainingSessionExercise", back_populates="session", cascade="all, delete-orphan", order_by="TrainingSessionExercise.order_index")


class TrainingSessionExercise(Base):
    __tablename__ = "training_session_exercises"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("training_exercises.id", ondelete="CASCADE"), nullable=False)
    section_name = Column(String(100), nullable=True)  # e.g., "Einstimmen", "Hauptteil 1", "Hauptteil 2", "Schlussteil" OR "Vorübung 1", "Spielform 1"...
    order_index = Column(Integer, default=0, nullable=False)
    duration_override = Column(Integer, nullable=True)

    session = relationship("TrainingSession", back_populates="exercises")
    exercise = relationship("TrainingExercise")


# Association table for CalendarEvent <-> Team (Many-to-Many).
# calendar_events.team_id is kept as the primary team for backwards compatibility
# (event series identity, fussball.de import); this table holds the full assignment.
calendar_event_teams = Table(
    'calendar_event_teams',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('calendar_events.id', ondelete='CASCADE'), primary_key=True),
    Column('team_id', String(50), ForeignKey('teams.id', ondelete='CASCADE'), primary_key=True)
)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), index=True, nullable=False)
    event_type = Column(String(50), default="TRAINING", nullable=False)  # MATCH, TRAINING, MEETING, EVENT
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    location = Column(String(255), nullable=True)
    is_home = Column(Boolean, default=True)
    opponent = Column(String(255), nullable=True)
    team_id = Column(String(50), ForeignKey("teams.id"), nullable=True)
    fussball_de_match_id = Column(String(100), unique=True, index=True, nullable=True)
    training_session_id = Column(Integer, ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True)
    reminder_minutes = Column(Integer, nullable=True, default=30)  # 0=none, 15, 30, 60, 240, 1440
    # When the reminder push was last dispatched. Prevents the 60s scheduler from
    # re-sending for the whole reminder window; re-arms automatically if the event
    # is moved to a later date (see check_and_send_event_reminders).
    reminder_sent_at = Column(DateTime, nullable=True)
    notes = Column(String(2000), nullable=True)
    created_by_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team")
    teams = relationship("Team", secondary=calendar_event_teams, lazy="selectin")
    training_session = relationship("TrainingSession")
    created_by = relationship("User")

    @property
    def team_ids(self) -> list:
        """All assigned team ids, falling back to the legacy single team_id."""
        if self.teams:
            return [t.id for t in self.teams]
        return [self.team_id] if self.team_id else []


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    endpoint = Column(String(1000), nullable=False)
    p256dh = Column(String(500), nullable=False)
    auth = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Player(Base):
    __tablename__ = "players"
    id = Column(String(50), primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(50), nullable=True) # DD.MM.YYYY
    nationality = Column(String(50), nullable=True, default="D")
    dfb_id = Column(String(50), index=True, nullable=True) # Passnummer
    jersey_number = Column(Integer, nullable=True)
    position = Column(String(50), nullable=True, default="Feldspieler")
    team_id = Column(String(50), ForeignKey("teams.id"), nullable=True)
    notes = Column(String(2000), nullable=True)
    # Last birthday push, so the 60s scheduler sends one per birthday, not one per minute.
    birthday_notified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team = relationship("Team")
    evaluations = relationship("PlayerEvaluation", back_populates="player", cascade="all, delete-orphan", order_by="desc(PlayerEvaluation.created_at)")
    tagged_in_events = relationship(
        "MatchEvent",
        secondary=match_event_players,
        back_populates="tagged_players"
    )

class PlayerAttendance(Base):
    __tablename__ = "player_attendances"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    player_id = Column(String(50), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(Integer, ForeignKey("calendar_events.id", ondelete="SET NULL"), nullable=True)
    event_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    event_type = Column(String(50), default="TRAINING", nullable=False) # TRAINING, MATCH
    status = Column(String(50), default="PRESENT", nullable=False) # PRESENT, ABSENT, EXCUSED
    absence_reason = Column(String(50), nullable=True) # KRANKHEIT, PRIVATES, VERLETZUNG, SONSTIGES
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    player = relationship("Player")
    event = relationship("CalendarEvent")


class PlayerEvaluation(Base):
    __tablename__ = "player_evaluations"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    player_id = Column(String(50), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    evaluation_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    eval_year = Column(Integer, nullable=True)
    eval_quarter = Column(String(10), nullable=True) # Q1, Q2, Q3, Q4
    created_by_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    is_approved = Column(Boolean, default=True, nullable=False)
    approved_by_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    overall_rating = Column(Float, default=0.0)
    overall_notes = Column(String(2000), nullable=True)
    raw_transcript = Column(String(5000), nullable=True)
    strengths = Column(String(2000), nullable=True)
    weaknesses = Column(String(2000), nullable=True)

    # 1. Technische Fähigkeiten (1-10)
    tech_ball_control = Column(Float, default=5.0)
    tech_dribbling = Column(Float, default=5.0)
    tech_passing = Column(Float, default=5.0)
    tech_shooting = Column(Float, default=5.0)
    tech_both_feet = Column(Float, default=5.0)

    # 2. Taktisches Grundverhalten (1-10)
    tact_intelligence = Column(Float, default=5.0)
    tact_space_creation = Column(Float, default=5.0)
    tact_transition = Column(Float, default=5.0)
    tact_one_on_one = Column(Float, default=5.0)

    # 3. Physische & Koordinative Aspekte (1-10)
    phys_speed = Column(Float, default=5.0)
    phys_agility = Column(Float, default=5.0)
    phys_mobility = Column(Float, default=5.0)

    # 4. Mentale & Soziale Faktoren (1-10)
    ment_teamwork = Column(Float, default=5.0)
    ment_attitude = Column(Float, default=5.0)
    ment_learning = Column(Float, default=5.0)
    ment_fairplay = Column(Float, default=5.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    player = relationship("Player", back_populates="evaluations")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


class UserTacticsPreference(Base):
    __tablename__ = "user_tactics_preferences"
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    default_pitch_type = Column(String(50), default="full_horizontal", nullable=False)
    default_pitch_style = Column(String(50), default="grass_classic", nullable=False)
    home_team_colors = Column(JSON, nullable=True)
    away_team_colors = Column(JSON, nullable=True)
    neutral_colors = Column(JSON, nullable=True)
    default_player_label_mode = Column(String(50), default="number", nullable=False)
    default_tool = Column(String(50), default="select", nullable=False)
    laser_fade_seconds = Column(Float, default=1.5, nullable=False)
    animation_speed = Column(Float, default=1.0, nullable=False)
    auto_chain_lines = Column(Boolean, default=False, nullable=False)
    show_tactical_grid = Column(Boolean, default=False, nullable=False)
    custom_settings = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class TacticsBoard(Base):
    __tablename__ = "tactics_boards"
    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(String(2000), nullable=True)
    category = Column(String(100), default="Allgemein", nullable=False)
    team_id = Column(String(50), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    pitch_type = Column(String(50), default="full_horizontal", nullable=False)
    pitch_style = Column(String(50), default="grass_classic", nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)
    frames_data = Column(JSON, nullable=False)
    thumbnail_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User")
    team = relationship("Team")


class TacticsFormationPreset(Base):
    __tablename__ = "tactics_formation_presets"
    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    team_id = Column(String(50), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    system_type = Column(String(50), default="11v11", nullable=False)
    player_count = Column(Integer, default=11, nullable=False)
    positions_data = Column(JSON, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by = relationship("User")
    team = relationship("Team")


class VideoStitchJob(Base):
    __tablename__ = "video_stitch_jobs"

    id = Column(String(50), primary_key=True, index=True)
    match_id = Column(String(50), ForeignKey("matches.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    output_mode = Column(String(30), default="DYNAMIC_16_9", nullable=False) # 'DYNAMIC_16_9', 'PANORAMA_32_9', 'DUAL'
    detect_events_auto = Column(Boolean, default=True, nullable=False)
    
    status = Column(String(30), default="PENDING", nullable=False) # PENDING, SYNCING, STITCHING, TRACKING, REFRAMING, COMPLETED, FAILED, CANCELLED
    progress = Column(Float, default=0.0, nullable=False)
    current_step_text = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    detailed_logs = Column(Text, default="", nullable=True)
    
    left_video_path = Column(String(500), nullable=False)
    right_video_path = Column(String(500), nullable=False)
    audio_sync_offset_ms = Column(Integer, default=0, nullable=False)
    
    stitched_panorama_path = Column(String(500), nullable=True)
    reframed_broadcast_path = Column(String(500), nullable=True)
    hls_panorama_url = Column(String(500), nullable=True)
    hls_broadcast_url = Column(String(500), nullable=True)
    
    tracking_data_json = Column(JSON, nullable=True)
    settings_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    match = relationship("Match")
    user = relationship("User")


class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True) # "match", "tactics", "training", "player"
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, default=dict, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", backref="activity_logs")
