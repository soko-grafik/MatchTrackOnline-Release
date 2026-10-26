# 📋 MatchTrack Online - Versions-Changelog

## Release: 2026-10-26 15:45:01 (Dev Commit: `b50be305`)

### 🚀 Letzte Änderungen aus dem Entwicklungs-Repository:
* fix(services): restore generate_thumbnail in thumbnail_service for video uploads (b50be305 - 2026-10-26)
* feat(perf): implement comprehensive caching masterplan (client SWR, backend TTL RAM cache, and thumbnail offload) (41cb9609 - 2026-10-26)
* perf(core): eliminate N+1 queries, add GZip compression, pool tuning, and DB indexes (73e5831f - 2026-10-26)
* fix(db): widen thumbnail_path to LONGTEXT for base64 canvas images (c5ed68cb - 2026-10-26)
* fix(db): handle nullable column fallbacks and allow null evaluation_date (fe48aadf - 2026-10-26)
* fix(db): serialize JSON dict/list objects to strings for PyMySQL in migration script (45730421 - 2026-10-26)
* fix(db): support DB_PORT and utf8mb4 in session.py and update dev defaults (c9407589 - 2026-10-26)
* feat(db): add bulletproof SQLite to MySQL migration and validation script (3b1f3c67 - 2026-10-26)
* feat(training): add exercise detail view modal, optimize sketch editor canvas and modernize scrollbars (0dae38f2 - 2026-10-09)
* update futsal fields (cceb5286 - 2026-10-09)

---
*Automatisch generiert durch die MatchTrack Release Pipeline.*
