## Unreleased

- living_body_ask: emit child_tool_mode + local series routing log (no PHI)

## 0.3.4 - 2026-08-04

### Changed
- Child connector spawns and install hints now use **pinned** `npx -y package@version` (aligned with Hermes/OpenClaw presets). Google Health children resolve to `google-health-mcp-unofficial@0.7.3`; nourish to `wellness-nourish@0.8.0`.

## 0.3.3 - 2026-07-30

### Added / Fixed

- MCP prompts: daily_checkin, triage_setup, ask_compose.

## 0.3.1 - 2026-07-30

## 0.3.2 - 2026-07-30

### Security

- living_body_daily_brief and living_body_compose_context require explicit_user_intent (spawn child MCPs).


### Added

- Agent-readiness surface: `living_body_agent_manifest`, `living_body_connection_status`, `living_body_data_inventory` plus MCP resources for inventory/manifest/capabilities/connection-status.
- Aligns with mcp-scorecard discovery checks (score was 77/C without these tools).

### Fixed

- `SERVER_VERSION` drift (constants still said 0.2.1 while package was 0.3.0).

# Changelog

All notable changes to `delx-living-body` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows semantic versioning.

## [0.3.0] - 2026-06-27

### Added

- Package-installed zero-secret demo command: `npx -y delx-living-body demo`.
- Hidden bundled stub child MCP used by the demo so the published package can
  run the real server, composer and synthesizer path without WHOOP, Oura,
  Garmin, accounts, API keys, or network access.
- Red/green demo scenarios for proving both "train hard" and "back off"
  readiness paths from the shipped binary.

## [0.2.1] - 2026-06-27

### Security

- Pin transitive `hono` resolution to `4.12.27` via npm overrides, resolving production audit advisories while keeping the public MCP API unchanged.

## [0.2.0] - 2026-05-29

### Added

- **Runnable end-to-end demo** (`npm run demo`, `scripts/demo.mjs`): boots the real MCP server over stdio, fakes three installed connectors (WHOOP + Oura + Garmin) using the bundled stub child with synthetic body data, and answers "What should I do today?" and "Should I train hard today?" — composing all three sources into one synthesized answer with no accounts, API keys, or network. Captured output committed at `examples/demo-what-should-i-do-today.txt`; the demo carries assertions and now runs as part of `npm test`.
- README "See it answer" quickstart promoting the demo as the Body-vertical entrypoint.

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
