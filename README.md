# delx-living-body

> Meta-MCP that turns 15 wellness MCPs into one unified body data layer for AI agents.

[![npm](https://img.shields.io/npm/v/delx-living-body)](https://www.npmjs.com/package/delx-living-body)
[![GitHub Release](https://img.shields.io/github/v/release/davidmosiah/delx-living-body?label=release)](https://github.com/davidmosiah/delx-living-body/releases/latest)
[![npm downloads](https://img.shields.io/npm/dm/delx-living-body)](https://www.npmjs.com/package/delx-living-body)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Delx Wellness](https://img.shields.io/badge/part%20of-Delx%20Wellness-0EA5A3)](https://github.com/davidmosiah/delx-wellness)
[![Verified Release Index](https://img.shields.io/badge/verified-release_index-0EA5A3)](https://github.com/davidmosiah/delx-wellness/blob/main/docs/release-index.md)

Today, answering "should I train hard today?" forces an agent to orchestrate WHOOP recovery, Garmin Body Battery, Oura sleep, Nourish nutrition, and cycle phase across five separate MCP servers. That's brittle for users and confusing for the agent.

`delx-living-body` is **one** MCP server that:

1. **Auto-detects** which of 15 Delx Wellness connectors you already have installed locally — no manual config
2. **Composes** parallel calls to the right subset
3. **Synthesizes** a natural-language answer plus a structured reasoning trace and per-source confidence — using rule-based reasoning, **no LLM calls**

Install it once. Get a unified body data layer. Works with whatever wellness MCPs you already have.

If it helps your agent workflow, star the repo. Stars make the single-entry
Delx Wellness path easier for other AI builders to find.

## Install

```bash
npx -y delx-living-body
```

That's the whole install. No OAuth flow, no API keys — `delx-living-body` has no auth of its own. Each child connector handles its own credentials.

## See it answer "What should I do today?" (no accounts needed)

```bash
git clone https://github.com/davidmosiah/delx-living-body && cd delx-living-body
npm install && npm run build
npm run demo
```

The demo boots the **real** MCP server, fakes three installed connectors
(WHOOP + Oura + Garmin, backed by a bundled stub child that carries synthetic
body data), and drives it over stdio exactly the way an agent does. No real
accounts, API keys, or network. Captured output lives at
[`examples/demo-what-should-i-do-today.txt`](examples/demo-what-should-i-do-today.txt):

```
2) living_body_ask  question="What should I do today?"
────────────────────────────────────────────────────────────────
Recommendation:
   Today at a glance: recovery 74, sleep 83, body battery 68.

Confidence: high   Sources: whoop, oura, garmin

3) living_body_ask  question="Should I train hard today?"
────────────────────────────────────────────────────────────────
Recommendation:
   Green light for a hard session. Recovery and sleep both support high intensity.

Confidence: high   Sources: whoop, oura, garmin

Reasoning trace (rule-based, no LLM):
   Intent classified as: training_readiness
   - (rec_high) Recovery 74 supports a high-intensity day.
   - (sleep_good) Sleep score 83 is supporting recovery.
```

One question in → one synthesized answer composed across all three connectors,
with a stable reasoning trace and **zero LLM calls**. This is the Body-vertical
entrypoint: install once, ask in plain language, get a unified answer.

## Tools (6)

| Tool | Purpose |
|---|---|
| `living_body_status` | Which connectors are detected? Safe; no subprocess spawning. |
| `living_body_ask` | Main tool. Spawns detected children in parallel, returns synthesized answer. Requires `explicit_user_intent: true`. |
| `living_body_daily_brief` | Markdown brief built from each connector's `daily_summary`. |
| `living_body_compose_context` | Normalized `delx-wellness-context/v1` shape merged across sources. |
| `living_body_health_check` | All 15 known connectors with install hints for missing ones. |
| `living_body_capabilities` | Self-description + per-connector availability matrix. |

## How detection works

For each known connector, `delx-living-body` checks:

1. `~/.<vendor>-mcp/tokens.json` exists
2. `~/.<vendor>-mcp/config.json` exists (password-based connectors like Eight Sleep)
3. An export file at the path in the vendor's env var (Apple Health, Samsung Health)
4. `~/.delx-wellness/profile.json` lists the device

If any check passes → `detected`. Otherwise → `missing` (with install hint). Stateless connectors (Cycle Coach) are always considered available.

Detection results cache for 60s (`DELX_LIVING_BODY_DETECT_TTL`).

## Known connectors (15)

| ID | Package | Category |
|---|---|---|
| `whoop` | `whoop-mcp-unofficial` | recovery |
| `oura` | `oura-mcp-unofficial` | sleep |
| `garmin` | `garmin-mcp-unofficial` | recovery |
| `strava` | `strava-mcp-unofficial` | training |
| `fitbit` | `fitbit-mcp-unofficial` | recovery |
| `google_health` | `google-health-mcp-unofficial` | multi |
| `withings` | `withings-mcp-unofficial` | multi |
| `apple_health` | `apple-health-mcp-unofficial` | multi |
| `samsung_health` | `samsung-health-mcp-unofficial` | multi |
| `polar` | `polar-mcp-unofficial` | training |
| `eight_sleep` | `eight-sleep-mcp-unofficial` | sleep |
| `nourish` | `wellness-nourish` | nutrition |
| `air` | `wellness-air` | environment |
| `cycle_coach` | `wellness-cycle-coach` | cycle |
| `cgm` | `wellness-cgm-mcp` | glucose |

## Composition flow

When `living_body_ask` or `living_body_compose_context` runs:

1. Detect installed connectors.
2. For each, spawn it as a child MCP via `npx -y <package>` over StdioClientTransport.
3. Call the child's `*_wellness_context` (or `*_daily_summary`) tool in parallel.
4. Normalize results into a `delx-wellness-context/v1` shape with merged scores.
5. Run the synthesizer (rule-based, offline) to produce a recommendation + reasoning trace.

Critically: **`delx-living-body` never calls an LLM.** Synthesis is deterministic so downstream agents can reason on top of a stable trace.

## Synthesizer rules

14 heuristic rules, each with a stable `rule_id` that appears in the reasoning trace:

- `rec_low` / `rec_mid` / `rec_high` — recovery score bands
- `bb_low` / `bb_high` — Garmin Body Battery bands
- `sleep_poor` / `sleep_good` — sleep score bands
- `strain_high` — WHOOP strain ≥ 18
- `cycle_luteal` / `cycle_follicular` — cycle phase signals
- `load_high` / `load_low` — aggregate training load
- `no_data` — nothing installed, advisory only
- `conflict` — sources disagree → low confidence

## Privacy & security

- `delx-living-body` **never reads child connector tokens or config files** — children read their own credentials independently.
- Upstream secret env vars (`*_CLIENT_SECRET`, `*_ACCESS_TOKEN`, `*_REFRESH_TOKEN`, `*_API_KEY`, `*_PASSWORD`) are stripped before spawning children.
- Children are spawned with `privacy_mode=structured` by default. `raw` is only honored when the caller sets `explicit_user_intent: true` on `living_body_ask`.
- Child responses are not logged verbatim — only counts and summary fields.
- Per-child call timeout: 30s. A hanging child is marked `timeout` and skipped.
- Cache lives at `~/.delx-living-body/cache.sqlite` (chmod 600), 5 min TTL. Disable with `DELX_LIVING_BODY_NO_CACHE=true`.
- No phone-home from `delx-living-body` itself.

See [SECURITY.md](SECURITY.md) for the full threat model.

## Env vars

| Variable | Default | Purpose |
|---|---|---|
| `DELX_LIVING_BODY_DETECT_TTL` | `60` | Detection cache TTL in seconds |
| `DELX_LIVING_BODY_NO_CACHE` | unset | Disable SQLite response cache |
| `DELX_LIVING_BODY_CACHE_PATH` | `~/.delx-living-body/cache.sqlite` | Override cache path |
| `DELX_LIVING_BODY_NPM_RUNNER` | `npx` | Override npm runner for child spawning |
| `DELX_LIVING_BODY_CHILD_OVERRIDE_<ID>` | unset | Override child binary path (testing only) |
| `LIVING_BODY_MCP_HOST` / `LIVING_BODY_MCP_PORT` | `127.0.0.1` / `3030` | HTTP transport bind address |

## CLI

```bash
living-body-mcp-server                # MCP stdio server (default)
living-body-mcp-server --http         # Local HTTP transport
living-body-mcp-server doctor         # Detect installed connectors
living-body-mcp-server doctor --json  # JSON output
living-body-mcp-server setup          # Print profile path + install hints
living-body-mcp-server version
```

## Use with Claude Desktop

```json
{
  "mcpServers": {
    "living-body": {
      "command": "npx",
      "args": ["-y", "delx-living-body"]
    }
  }
}
```

## Use with Cursor

```json
{
  "mcpServers": {
    "living-body": { "command": "npx", "args": ["-y", "delx-living-body"] }
  }
}
```

## Not medical advice

Outputs are operational context for training/recovery/sleep/nutrition agents. Not for medical diagnosis or clinical use.

## License

MIT — see [LICENSE](LICENSE). Built by [David Mosiah](https://github.com/davidmosiah).
