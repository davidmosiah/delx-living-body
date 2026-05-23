# Hermes — delx-living-body

Add to `~/.hermes/config.yaml`:

```yaml
mcpServers:
  living-body:
    command: npx
    args: ["-y", "delx-living-body"]
```

Hermes exposes the tools with the `mcp_living-body_` prefix:

- `mcp_living-body_living_body_status`
- `mcp_living-body_living_body_ask`
- `mcp_living-body_living_body_daily_brief`
- `mcp_living-body_living_body_compose_context`
- `mcp_living-body_living_body_health_check`
- `mcp_living-body_living_body_capabilities`

After editing config, run `hermes mcp test living-body` to verify boot. Then `hermes mcp test living-body --tool living_body_status` to confirm detection.

Recommended first call in a skill: `living_body_status` to discover which wellness MCPs are already configured on the host.
