# Compose matrix — series vs summary

Source of truth: `src/constants.ts` (`KNOWN_CONNECTORS`). Regenerated 2026-08-12.

`living_body_ask` / compose prefer `series_tool` when the question needs effort/HR **shape**. Otherwise they use `context_tool` or `daily_summary_tool`. No PHI in this table.

| id | package pin (in tree) | context | daily_summary | series (agent-safe-series/v1) | category |
|---|---|---|---|---|---|
| whoop | whoop-mcp-unofficial@0.6.1 | whoop_wellness_context | whoop_daily_summary | — summary-only | recovery |
| oura | oura-mcp-unofficial@0.6.1 | oura_wellness_context | oura_daily_summary | — summary-only | sleep |
| garmin | garmin-mcp-unofficial@0.7.2 | garmin_wellness_context | garmin_daily_summary | **garmin_activity_series** | recovery |
| strava | strava-mcp-unofficial@0.6.0 | strava_training_context | strava_daily_summary | **strava_activity_series** | training |
| fitbit | fitbit-mcp-unofficial@0.6.0 | fitbit_wellness_context | fitbit_daily_summary | **fitbit_heart_series** | recovery |
| google_health | google-health-mcp-unofficial@0.7.3 | google_health_wellness_context | google_health_daily_summary | — summary-only | multi |
| withings | withings-mcp-unofficial@0.5.1 | withings_wellness_context | withings_daily_summary | — summary-only | multi |
| apple_health | apple-health-mcp-unofficial@0.7.1 | apple_health_wellness_context | apple_health_daily_summary | — (export path; no series) | multi |
| samsung_health | samsung-health-mcp-unofficial@0.7.1 | samsung_health_wellness_context | samsung_health_daily_summary | — (export path; no series) | multi |
| polar | polar-mcp-unofficial@0.5.0 | polar_wellness_context | polar_daily_summary | **polar_heart_series** | training |
| eight_sleep | eight-sleep-mcp-unofficial@0.2.8 | eight_sleep_wellness_context | eight_sleep_daily_summary | — summary-only | sleep |
| nourish | wellness-nourish@0.8.0 | nourish_wellness_context | nourish_daily_summary | — nutrition | nutrition |
| air | wellness-air@0.7.0 | air_wellness_context | air_daily_summary | — | environment |
| cycle_coach | wellness-cycle-coach@0.4.0 | cycle_wellness_context | cycle_daily_summary | — | cycle |
| cgm | wellness-cgm-mcp@0.6.1 | cgm_wellness_context | cgm_daily_summary | — no glucose_series unless demand | glucose |

Operator debug (no PHI): `living_body_ask` returns `child_tool_mode` = `context` | `daily_summary` | `series` and logs the route on stderr.
