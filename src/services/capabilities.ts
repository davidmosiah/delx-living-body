import { KNOWN_CONNECTORS, MCP_NAME, NPM_PACKAGE_NAME } from "../constants.js";

export function buildCapabilities() {
  return {
    project: NPM_PACKAGE_NAME,
    mcp_name: MCP_NAME,
    creator: {
      name: "David Mosiah",
      github: "https://github.com/davidmosiah"
    },
    unofficial: true,
    api_boundary: {
      source: "Composes other locally installed Delx Wellness connectors",
      raw_definition: "Raw means the full structured payload returned by each child connector's *_wellness_context tool.",
      does_not_include: [
        "any direct vendor API call (children handle their own auth)",
        "continuous sensor streams or BLE data",
        "any LLM-based reasoning — synthesis is rule-based and offline"
      ]
    },
    auth_model: {
      type: "Inherits each child connector's auth model",
      token_storage: "Each child reads its own ~/.<vendor>-mcp/tokens.json (or equivalent). living-body never reads child tokens.",
      notes: [
        "living-body spawns children with MCP_PROBE=1 when only detecting.",
        "living-body never forwards CLIENT_SECRET/ACCESS_TOKEN/REFRESH_TOKEN env vars to child processes."
      ]
    },
    privacy_modes: [
      { mode: "summary", use_when: "The agent only needs minimal fields for interpretation." },
      { mode: "structured", use_when: "Default — passed to all children unless the caller opts into 'raw'." },
      { mode: "raw", use_when: "Caller explicitly requested full upstream payloads and set explicit_user_intent." }
    ],
    tools: [
      { name: "living_body_status", summary: "Detected wellness connectors on this machine, plus per-connector detection method." },
      { name: "living_body_ask", summary: "Compose installed connectors to answer a wellness question. Spawns subprocesses — requires explicit_user_intent." },
      { name: "living_body_daily_brief", summary: "Synthetic daily briefing aggregating every detected connector's daily_summary." },
      { name: "living_body_compose_context", summary: "Returns the normalized delx-wellness-context/v1 shape merged across sources." },
      { name: "living_body_health_check", summary: "Status of all 15 known connectors, including install hints for missing ones." },
      { name: "living_body_capabilities", summary: "Self-description and per-connector availability matrix." }
    ],
    per_connector_availability_matrix: KNOWN_CONNECTORS.map((c) => ({
      id: c.id,
      package: c.package,
      display_name: c.display_name,
      category: c.category,
      auth_shape: c.auth_shape,
      context_tool: c.context_tool,
      daily_summary_tool: c.daily_summary_tool
    })),
    recommended_agent_flow: [
      "Call living_body_capabilities once to discover the surface.",
      "Call living_body_status to see which connectors are installed.",
      "Use living_body_compose_context for raw merged context, or living_body_ask for a synthesized answer.",
      "Use living_body_health_check when you need install hints for missing connectors.",
      "Always pass explicit_user_intent=true on living_body_ask — it spawns child MCP processes."
    ],
    contribution_paths: [
      "Add more known connectors to KNOWN_CONNECTORS.",
      "Add more heuristic rules to the synthesizer.",
      "Add per-connector field mapping where vendors use non-standard field names.",
      "Improve the daily brief markdown."
    ],
    links: {
      github: "https://github.com/davidmosiah/delx-living-body",
      npm: "https://www.npmjs.com/package/delx-living-body",
      wellness_registry: "https://wellness.delx.ai/"
    }
  };
}
