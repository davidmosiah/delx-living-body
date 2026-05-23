# Changelog

All notable changes to `delx-living-body` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows semantic versioning.

## [0.1.0] - 2026-05-23

Initial release.

### Added

- **6 MCP tools**: `living_body_status`, `living_body_ask`, `living_body_daily_brief`, `living_body_compose_context`, `living_body_health_check`, `living_body_capabilities`.
- **Registry of 15 known wellness connectors** (WHOOP, Oura, Garmin, Strava, Fitbit, Apple/Samsung/Google Health, Withings, Polar, Eight Sleep, Nourish, Air, Cycle Coach, CGM).
- **Auto-detection** via `~/.<vendor>-mcp/tokens.json`, `config.json`, export paths, or `~/.delx-wellness/profile.json` device list.
- **Composer service** that spawns detected children via `npx -y <package>` over StdioClientTransport, calls their `*_wellness_context` tool in parallel, and aggregates results into a `delx-wellness-context/v1` shape.
- **Rule-based synthesizer** with 14 heuristic rules (`rec_low`, `rec_mid`, `rec_high`, `bb_low`, `bb_high`, `sleep_poor`, `sleep_good`, `strain_high`, `cycle_luteal`, `cycle_follicular`, `load_high`, `load_low`, `no_data`, `conflict`). No LLM is called.
- **SQLite response cache** at `~/.delx-living-body/cache.sqlite` (chmod 600), 5 min TTL by default. Disable with `DELX_LIVING_BODY_NO_CACHE=true`.
- **Privacy guarantees**: never reads child credentials; strips secret-shaped env vars before spawning children; honors `raw` only with `explicit_user_intent`; per-child timeout 30s.
- **CLI**: `doctor`, `setup`, `version`, `help`.
- **Transports**: stdio (default) and local HTTP (`--http`).
- **Tests**: typecheck, smoke (6 tools verified), detector (6 synthetic homes), composer (3 stub child MCPs + timeout path + secret-stripping check), synthesizer (14/14 heuristic rules, 8 intent classes), metadata.
