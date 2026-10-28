# 📋 MatchTrack Online - Versions-Changelog

## Release: 2026-10-28 13:33:33 (Dev Commit: `dee6a7a9`)

### 🚀 Letzte Änderungen aus dem Entwicklungs-Repository:
* fix(streaming): use regex flag -E for mediamtx sed replacements and activate api (dee6a7a9 - 2026-10-28)
* fix(live): resolve /login redirect for external viewers and optimize HLS playback with MPEG-TS (ed7f4ec8 - 2026-10-28)
* fix(backend): replace undefined require_role with require_trainer in admin livestream routes (6c275b37 - 2026-10-28)
* feat(streaming): add role-based access for stream credentials, password protection, and dedicated public /live player page (196619e5 - 2026-10-28)
* fix(streaming): extract official mediamtx.yml to guarantee 100% valid configuration (c20a8cd3 - 2026-10-28)
* feat(streaming): switch setup_rtmp.sh to MediaMTX standalone engine to prevent apt conflicts on HestiaCP (23a54c1b - 2026-10-28)
* feat(streaming): place setup_rtmp.sh in backend directory for direct server execution (f30ceaa6 - 2026-10-28)
* feat(streaming): add RTMP & HLS setup script, docs, and enhance LiveStreamModal with OBS/DJI support (0f41661a - 2026-10-28)
* feat(theme): implement full light mode support across all pages and add release safety guards (af560d79 - 2026-10-28)
* feat(ui): implement Preline UI foundation primitives and modernize global modals (8ce26039 - 2026-10-28)

---
*Automatisch generiert durch die MatchTrack Release Pipeline.*
