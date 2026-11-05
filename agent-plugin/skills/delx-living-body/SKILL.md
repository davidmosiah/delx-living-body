---
name: delx-living-body
description: >-
  Ask one wellness question across every Delx Wellness connector the user has set up (WHOOP, Oura, Garmin, Fitbit, Strava, Apple Health, nutrition, air and more) through the local living-body meta-MCP server. Use when the user wants a single synthesized daily brief or an answer like should I train hard today that needs sleep, recovery, training and nutrition together.
---

# Living Body

MCP server `living-body` from the `delx-living-body@0.3.7` npm package, run locally through `npx`. It reads one synthesized answer across sleep, recovery, training, nutrition and environment from the connectors the user already set up. Data source: no own service: it detects which Delx Wellness connectors are set up on this machine and starts them as child MCP processes through npx at the versions pinned in this release.

## Workflow

1. Start with `living_body_connection_status`. Then pick what fits the question: `living_body_daily_brief`, `living_body_ask`.
2. Lead with the answer to the user's question and keep supporting detail short.

## Setup (the user runs this in a terminal, not in chat)

```bash
npx -y delx-living-body@0.3.7 doctor
npx -y delx-living-body@0.3.7 demo
```

Set up at least one connector first (for example the whoop-mcp, oura-mcp or garmin-mcp plugin). `doctor` lists detected connectors; `demo` runs a zero-secret end-to-end example.

## Safety

- Child connectors are downloaded from npm on first use at pinned versions and run with the user's privileges.
- Not medical advice: the data supports personal reflection and planning, not diagnosis or treatment. Point the user to a clinician for symptoms, medication or anything urgent.
