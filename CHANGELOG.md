# 📋 MatchTrack Online - Versions-Changelog

## Release: 2026-10-27 11:14:56 (Dev Commit: `fc70e7ad`)

### 🚀 Letzte Änderungen aus dem Entwicklungs-Repository:
* fix(backend): eliminate 750MB PyTorch RAM leak in backend webserver process (fc70e7ad - 2026-10-27)
* fix(worker): eliminate 700MB idle RAM usage and remove obsolete stitching service files (0a692340 - 2026-10-27)
* feat(training): add touch-friendly tap-to-assign and block dropdown for iPad/tablets (9e6e1e0c - 2026-10-27)
* feat(training): responsive single-column list view below 1260px with left thumbnail (02b33521 - 2026-10-27)
* refactor(admin): remove legacy stitching options from system settings (dbb14597 - 2026-10-27)
* fix(player): resolve video playback stuttering and optimize streaming performance (1df21433 - 2026-10-26)
* fix(services): restore generate_thumbnail in thumbnail_service for video uploads (b50be305 - 2026-10-26)
* feat(perf): implement comprehensive caching masterplan (client SWR, backend TTL RAM cache, and thumbnail offload) (41cb9609 - 2026-10-26)
* perf(core): eliminate N+1 queries, add GZip compression, pool tuning, and DB indexes (73e5831f - 2026-10-26)
* fix(db): widen thumbnail_path to LONGTEXT for base64 canvas images (c5ed68cb - 2026-10-26)

---
*Automatisch generiert durch die MatchTrack Release Pipeline.*
