# 📋 MatchTrack Online - Versions-Changelog

## Release: 2026-11-10 13:07:22 (Dev Commit: `059ac8f3`)

### 🚀 Letzte Änderungen aus dem Entwicklungs-Repository:
* perf(upload): support thread-safe parallel chunk streaming and multi-stream concurrency (059ac8f3 - 2026-11-10)
* remove (854714b0 - 2026-11-10)
* feat(auth): add Admin API-Key generator & management for MatchTrack-Stitcher (8ef1b5e6 - 2026-11-10)
* feat(upload): add resumable chunked upload session API with SHA-256 & ffprobe verification for MatchTrack-Stitcher (126afb4c - 2026-11-10)
* feat(hls): add cancel/clear-all for HLS conversion queue and auto-clean stale processing tasks (2eee435c - 2026-11-07)
* fix(hls): use db_session instead of undefined db in generate_hls_playlist (ae17ab1d - 2026-11-07)
* fix(hls): add missing Optional import in hls_service.py (0a7d69c1 - 2026-11-07)
* feat(upload,hls): background upload with top-bar progress and progressive 5s H.264 HLS for HEVC videos (3ef1b2ac - 2026-11-07)
* fix(video): normalize HEVC/10-bit uploads to 8-bit H.264 yuv420p and prevent HLS pipe deadlock (7ccb41d9 - 2026-11-07)
* fix(security): restrict video upload and livestream settings strictly to admin role (2f3d7ca9 - 2026-10-30)

---
*Automatisch generiert durch die MatchTrack Release Pipeline.*
