# Living Body — Agent Plugins package

Portable [Agent Plugins](https://agent-plugins.org/) v1 package for
[Hermes Agent](https://github.com/NousResearch/hermes-agent) and other Agent Plugins clients:
the `living-body` MCP server (`delx-living-body@0.3.7` over stdio) plus the `delx-living-body` workflow skill.

## Install (Hermes Agent)

```bash
hermes plugins install davidmosiah/delx-living-body/agent-plugin --no-enable
hermes plugins enable delx-living-body
```

Requires Node.js 20+ (`npx` on PATH). The skill loads as `delx-living-body:delx-living-body`.

## Connector setup

```bash
npx -y delx-living-body@0.3.7 doctor
npx -y delx-living-body@0.3.7 demo
```

Set up at least one connector first (for example the whoop-mcp, oura-mcp or garmin-mcp plugin). `doctor` lists detected connectors; `demo` runs a zero-secret end-to-end example.

## Disclosure

Runs the `delx-living-body@0.3.7` npm package locally over stdio through `npx` (Node.js 20+ required); the package is downloaded from npm on first start. Data source: no own service: it detects which Delx Wellness connectors are set up on this machine and starts them as child MCP processes through npx at the versions pinned in this release. Child connectors are downloaded from npm on first use at pinned versions and run with the user's privileges. The tool set comes from the pinned npm version, not from this repository's source tree.
