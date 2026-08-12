# Child pin drift — failure modes

`delx-living-body` spawns children as `npx -y <package>@<packageVersion>` from `KNOWN_CONNECTORS`.
Hermes presets and `delx-wellness` `registry.json` / `docs/release-index.md` are supposed to match.

## What breaks when they drift

| Drift | Symptom | What we do |
|---|---|---|
| living-body pin **older** than npm latest | Child still works; missing new tools (`*_series`) | Prefer series is skipped; compose stays on summary. Not a crash. |
| living-body pin **newer** than published npm | `npx` fails to resolve | `living_body_health_check` / composer timeout; ask uses remaining connectors |
| Hermes preset ≠ living-body pin | Agent on Hermes talks a different child than living-body | Dual answers / missing fields. Fix: one release-index row, both pin to it |
| registry.json ≠ npm view | Hub STATUS lies | `node scripts/sync-registry.mjs --check` (hub) |
| Pin yanked / unpublished | Spawn fail | health_check marks connector unavailable; no invented data |

## Rule

Do not invent a series path for a child whose `series_tool` is null.
Do not silently retarget `@latest`. Pins are the contract.

Reconcile: hub `docs/release-index.md` + `delx-wellness-hermes` presets + this package's `packageVersion` fields.
