// Tiny stub MCP child server used by the `demo` subcommand to stand in for real
// wearable connectors (WHOOP/Oura/Garmin). It speaks JSON-RPC over stdio just
// like a real MCP server, but emits synthetic wellness_context read from STUB_*
// env vars. No accounts, no network, no real credentials.
//
// This is invoked as a hidden subcommand of the same binary so the published
// package ships a single executable artifact (dist/index.js):
//   node dist/index.js __demo-stub-child
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export async function runDemoStubChild(): Promise<void> {
  const vendor = process.env.STUB_VENDOR ?? "stub";
  const recovery = process.env.STUB_RECOVERY ? Number(process.env.STUB_RECOVERY) : NaN;
  const sleepScore = process.env.STUB_SLEEP ? Number(process.env.STUB_SLEEP) : NaN;
  const bodyBattery = process.env.STUB_BB ? Number(process.env.STUB_BB) : NaN;
  const trainingLoad = process.env.STUB_LOAD ?? "normal";

  const server = new McpServer({ name: `stub-${vendor}`, version: "0.0.0" });

  server.registerTool(
    `${vendor}_wellness_context`,
    {
      title: `Stub ${vendor} wellness context`,
      description: "Synthetic wellness_context emitted by the demo harness.",
      inputSchema: { response_format: z.string().optional() }
    },
    async () => {
      const data: Record<string, unknown> = {
        source: vendor,
        context_contract_version: "delx-wellness-context/v1",
        context_type: "wellness_context",
        generated_at: new Date().toISOString(),
        recent_training_load: trainingLoad
      };
      if (Number.isFinite(recovery)) data.recovery_score = recovery;
      if (Number.isFinite(sleepScore)) data.sleep_score = sleepScore;
      if (Number.isFinite(bodyBattery)) data.body_battery = bodyBattery;
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data
      };
    }
  );

  await server.connect(new StdioServerTransport());
}
