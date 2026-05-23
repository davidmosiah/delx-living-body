# Contributing

## Setup

```bash
git clone https://github.com/davidmosiah/delx-living-body.git
cd delx-living-body
npm install
npm test
```

## Tests

- `npm run smoke` — boot the MCP server and verify the 6 tools register.
- `npm run test:detector` — verify `~/.<vendor>-mcp/` detection across 6 synthetic homes.
- `npm run test:composer` — verify composition + timeout path + secret-stripping using stub child MCPs.
- `npm run test:synthesizer` — verify 14/14 heuristic rules fire on fixture data.
- `npm run test:metadata` — verify package.json/server.json consistency.

`npm test` runs all of them after typecheck and build.

## Adding a new known connector

1. Edit `src/constants.ts` → append to `KNOWN_CONNECTORS`.
2. Make sure the upstream MCP exposes either `*_wellness_context` or `*_daily_summary` (or both).
3. Update `README.md` table.
4. Add an entry to `examples/` if the connector has unusual config.
5. Bump version in `package.json`, `server.json`, and `src/constants.ts`.
6. Add a CHANGELOG entry.

## Adding a new heuristic rule

1. Add the rule to `HEURISTIC_RULES` in `src/services/synthesizer.ts` with a stable `rule_id`.
2. Wire it inside `applyRules()`.
3. Optionally adjust `buildRecommendation()` for each intent class.
4. Add a test case in `scripts/test-synthesizer.mjs` so `heuristic_rules_covered` includes the new id.

## Coding conventions

- Strict TypeScript, ESM, Node >= 20.
- No additional runtime deps without justification — current set is `@modelcontextprotocol/sdk`, `better-sqlite3`, `cors`, `express`, `zod`.
- Never read child connector token files. Never forward parent secret env vars to children.
- Never call an LLM from this server.
