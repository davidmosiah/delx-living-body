---
name: living-body
description: >
  Meta-MCP that composes installed Delx Wellness connectors. Prefer MCP tools if connected; otherwise the package CLI.
  Use when the user wants Delx Living Body data or actions through an agent.
---

# Delx Living Body — skill or MCP

Same binary either way. Do not duplicate the API client.

## Choose a surface

**MCP** — tools appear natively after stdio/HTTP config:

```json
{ "mcpServers": { "living-body": { "command": "npx", "args": ["-y", "delx-living-body"] } } }
```

Do not put mutation flags in that snippet.

**Skill / CLI** — no MCP client required. Same tools:

```bash
npx -y delx-living-body call living_body_connection_status --json '{}'
```

If MCP tools named `living_*` are already available, use them. Do not also shell out.

## Loop

1. Call `living_body_connection_status` (or `doctor --json` when that exists).
2. Use read tools as asked.
3. Stop on `USER_ACTION_REQUIRED`. Do not invent env flags. Do not enable mutations from this skill.

## Never

- Paste tokens into git, chat logs, or the prompt
- Copy a mutations-enabled assignment into config
