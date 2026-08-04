import { KNOWN_CONNECTORS, MCP_NAME, NPM_PACKAGE_NAME, SERVER_VERSION } from "../constants.js";

/** Static data inventory for agent discovery (no live child calls). */
export function buildDataInventory() {
  return {
    kind: "data_inventory" as const,
    project: NPM_PACKAGE_NAME,
    mcp_name: MCP_NAME,
    version: SERVER_VERSION,
    privacy_modes: ["summary", "structured", "raw"],
    domains: [
      {
        id: "composed_wellness_context",
        description: "Normalized delx-wellness-context/v1 merged across detected connectors.",
        tools: ["living_body_compose_context", "living_body_ask", "living_body_daily_brief"]
      },
      {
        id: "connector_detection",
        description: "Which wellness MCP packages are installed and how they were detected.",
        tools: ["living_body_status", "living_body_health_check", "living_body_connection_status"]
      },
      {
        id: "self_description",
        description: "Manifest, capabilities and inventory for agent onboarding.",
        tools: ["living_body_agent_manifest", "living_body_capabilities", "living_body_data_inventory"]
      }
    ],
    known_connectors: KNOWN_CONNECTORS.map((c) => ({
      id: c.id,
      package: c.package,
      package_version: c.packageVersion,
      display_name: c.display_name,
      category: c.category,
      auth_shape: c.auth_shape
    })),
    recommended_first_calls: [
      "living_body_agent_manifest",
      "living_body_connection_status",
      "living_body_status",
      "living_body_capabilities"
    ]
  };
}
