import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildAgentManifest } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDataInventory } from "../services/inventory.js";
import { detect } from "../services/detector.js";

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

export function registerLivingBodyResources(server: McpServer): void {
  server.registerResource(
    "living_body_data_inventory",
    "living-body://inventory",
    {
      title: "Living Body Data Inventory",
      description: "Static inventory of composed domains, known connectors and recommended first calls.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildDataInventory())
  );

  server.registerResource(
    "living_body_agent_manifest",
    "living-body://agent-manifest",
    {
      title: "Living Body Agent Manifest",
      description: "Machine-readable install and operating instructions for AI agents.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildAgentManifest("generic"))
  );

  server.registerResource(
    "living_body_capabilities",
    "living-body://capabilities",
    {
      title: "Living Body Capabilities",
      description: "Self-description and per-connector availability matrix.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildCapabilities())
  );

  server.registerResource(
    "living_body_connection_status",
    "living-body://connection-status",
    {
      title: "Living Body Connection Status",
      description: "Live detection snapshot of installed wellness connectors (no child data tools).",
      mimeType: "application/json"
    },
    async (uri) => {
      const result = detect();
      return jsonResource(uri, {
        ok: result.detected.length > 0,
        generated_at: new Date().toISOString(),
        total_installed: result.detected.length,
        total_active: result.detected.filter((d) => d.status === "active").length,
        detected: result.detected,
        missing: result.missing
      });
    }
  );
}
