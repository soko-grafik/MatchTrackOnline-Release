# 📋 MatchTrack Online - Versions-Changelog

## Release: 2026-09-08 17:58:44 (Dev Commit: `c6beadd3`)

### 🚀 Letzte Änderungen aus dem Entwicklungs-Repository:
* fix(scripts): auto-detect, stop and disable competing systemd services to guarantee PM2 exclusivity on port 8000 (c6beadd3 - 2026-09-08)
* fix(scripts): add automated port 8000 cleanup and ecosystem start to prevent zombie process lockups during updates (27091c26 - 2026-09-08)
* chore(pm2): add ecosystem.config.js for proper python venv interpreter and backend execution (56d1d81d - 2026-09-08)
* fix(settings): make all SystemSettingsOut fields optional with safe defaults and auto-populate nulls (460dd72c - 2026-09-08)
* fix(db): add bulletproof unified schema migration runner to eliminate 500 errors and missing column exceptions (89b636e1 - 2026-09-08)
* fix(deploy): use pm2 restart instead of reload to avoid build cache and port conflicts (21818c21 - 2026-09-08)
* feat(teams): add batch assignment action bar and multi-select for unassigned matches (e5455820 - 2026-09-08)
* fix(db): add missing dynamic columns migration in init_teams prior to match queries (b3c678f3 - 2026-09-08)
* feat(heatmap): add team and player specific heatmaps with kit clustering, dual comparison and head-to-head zone analytics (a0d123b2 - 2026-09-08)
* feat(heatmap): add homography projection to standardized 2d bird's-eye pitch with interactive 4-corner calibration and zone analytics (327c805d - 2026-09-08)

---
*Automatisch generiert durch die MatchTrack Release Pipeline.*
