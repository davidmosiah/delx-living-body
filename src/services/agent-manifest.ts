import { KNOWN_CONNECTORS, MCP_NAME, NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE, SERVER_VERSION } from "../constants.js";

export const AGENT_CLIENTS = ["generic", "claude", "cursor", "windsurf", "hermes", "openclaw", "codex"] as const;
export type AgentClientName = typeof AGENT_CLIENTS[number];

const TOOLS = [
  "living_body_status",
  "living_body_ask",
  "living_body_daily_brief",
  "living_body_compose_context",
  "living_body_health_check",
  "living_body_capabilities"
];

export function parseAgentClientName(value: string): AgentClientName {
  return AGENT_CLIENTS.includes(value as AgentClientName) ? value as AgentClientName : "generic";
}

export function buildAgentManifest(client: AgentClientName = "generic") {
  return {
    project: NPM_PACKAGE_NAME,
    mcp_name: MCP_NAME,
    client,
    unofficial: true,
    package: {
      name: NPM_PACKAGE_NAME,
      version: SERVER_VERSION,
      install_command: `npx -y ${NPM_PACKAGE_NAME}`,
      pinned_install_command: `npx -y ${PINNED_NPM_PACKAGE}`,
      binary: "living-body-mcp-server"
    },
    composes: KNOWN_CONNECTORS.map((c) => ({ id: c.id, package: c.package, display_name: c.display_name })),
    tools: TOOLS,
    agent_rules: [
      "Call living_body_status before living_body_ask to know which connectors are installed.",
      "Always pass explicit_user_intent: true on living_body_ask — it spawns child MCP processes.",
      "Use privacy_mode='structured' (default). Only use 'raw' when the user explicitly asks for vendor payloads.",
      "Treat living_body output as composed context, not medical advice.",
      "If a needed source is missing, suggest running `npx -y <package> setup` (returned by living_body_health_check)."
    ],
    troubleshooting: [
      { symptom: "living_body_ask returns 'no sources used'", action: "Run living_body_health_check to see which connectors are missing or unauthorized." },
      { symptom: "A child connector times out", action: "Increase DELX_LIVING_BODY_CHILD_TIMEOUT_MS or remove that connector from the `sources` array." },
      { symptom: "Cache feels stale", action: "Set DELX_LIVING_BODY_NO_CACHE=true or delete ~/.delx-living-body/cache.sqlite." }
    ],
    links: {
      github: "https://github.com/davidmosiah/delx-living-body",
      npm: "https://www.npmjs.com/package/delx-living-body",
      wellness_registry: "https://wellness.delx.ai/"
    }
  };
}
