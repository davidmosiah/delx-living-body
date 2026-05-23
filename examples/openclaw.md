# OpenClaw — delx-living-body

OpenClaw can route to `delx-living-body` as a meta-MCP that hides the complexity of installed wellness connectors.

In `~/.openclaw/lanes/main/mcpServers.json`:

```json
{
  "living-body": {
    "command": "npx",
    "args": ["-y", "delx-living-body"]
  }
}
```

Restart the lane: `openclaw lane restart main`.

Calling pattern from inside a lane:

```
TOOL living_body_status response_format=json
TOOL living_body_ask question="Should I train hard today?" explicit_user_intent=true response_format=json
```

When `living_body_ask` returns `confidence: "low"` and `sources_used: []`, prompt the user to install at least one wellness connector and surface the `install_hint`s from `living_body_health_check`.
