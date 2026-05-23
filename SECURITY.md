# Security Policy

## Reporting a Vulnerability

Email **support@delx.ai** with details. Please do not open a public GitHub issue for security reports.

## Threat model

`delx-living-body` is a meta-MCP server: it auto-detects locally installed Delx Wellness connectors and spawns them as child processes. The threat surface is:

1. **Credential leakage** — could `delx-living-body` exfiltrate child connector tokens?
2. **Subprocess injection** — could a malicious agent trick the parent into spawning unintended binaries?
3. **Cache exfiltration** — could cached responses leak to unauthorized callers?

## Defenses

### 1. Credentials

- `delx-living-body` **never reads** a child's `tokens.json`, `config.json`, or export file. It only checks for **existence** to decide whether the connector is "detected".
- When spawning children, `delx-living-body` **strips secret-shaped env vars** before forwarding: any name matching `/(CLIENT_SECRET|REFRESH_TOKEN|ACCESS_TOKEN|API_KEY|PRIVATE_KEY|PASSWORD)$/i` is dropped.
- Each child reads its own credentials from its own files. Children are also given `MCP_PROBE=1` when only detecting (no auth-requiring calls expected).
- Child responses are never logged verbatim — only counts and summary fields.

### 2. Subprocess control

- The list of spawnable binaries is hard-coded in `src/constants.ts` as `KNOWN_CONNECTORS`. Callers cannot inject arbitrary connectors.
- Each child is spawned via `npx -y <pinned-package-name>`. The package name comes from the registry, not from caller input.
- The `DELX_LIVING_BODY_CHILD_OVERRIDE_<ID>` env var allows overriding binaries for testing. It is not exposed through any MCP tool.
- `living_body_ask` requires `explicit_user_intent: true` on every call — agents cannot speculatively spawn child processes.
- Per-call timeout: 30s. Hanging children are aborted.

### 3. Caching

- Cache lives at `~/.delx-living-body/cache.sqlite` with directory mode `0o700` and file mode `0o600`.
- TTL is 5 minutes by default and 60s for detection.
- Disable entirely with `DELX_LIVING_BODY_NO_CACHE=true`.

## Privacy modes

- `summary` — minimal interpretive fields.
- `structured` — default for all child calls. Normalized vendor payloads.
- `raw` — full vendor payloads. **Only honored on `living_body_ask` when `explicit_user_intent: true`**. Discouraged for routine composition.

## What `delx-living-body` does NOT do

- Does not call any LLM (synthesis is rule-based and offline).
- Does not phone home or send telemetry anywhere.
- Does not read child credentials.
- Does not forward parent secret env vars to children.
- Does not store user data outside the local SQLite cache.

## Not medical advice

Outputs are operational context for training/recovery/sleep/nutrition agents. They are not medical advice and must not be used for diagnosis or clinical decisions.
