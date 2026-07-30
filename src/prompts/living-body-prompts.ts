import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerLivingBodyPrompts(server: McpServer): void {
  server.registerPrompt(
    "living_body_daily_checkin",
    {
      title: "Daily wellness check-in",
      description: "Compose a daily readiness brief across installed connectors, then recommend training intensity.",
      argsSchema: {
        focus: z.string().optional().describe("Optional focus: sleep, recovery, training, nutrition"),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You are a local-first wellness agent using living-body MCP tools.",
              "1) Call living_body_connection_status.",
              "2) Call living_body_daily_brief with explicit_user_intent=true (and optional focus=" +
                (focus || "general") +
                ").",
              "3) Summarize readiness, sleep, strain/load, and one concrete next action.",
              "Do not invent wearable data. Prefer summary privacy. Not medical advice.",
            ].join(" "),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "living_body_triage_setup",
    {
      title: "Triage connector setup",
      description: "Diagnose which wellness connectors are missing and how to install them.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call living_body_connection_status and living_body_capabilities. List missing connectors with install_hint (npx -y package@version). Do not request secrets. Suggest max 3 next setup steps.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "living_body_ask_compose",
    {
      title: "Compose an answer across connectors",
      description: "Answer a wellness question by composing installed MCP connectors.",
      argsSchema: {
        question: z.string().describe("User wellness question"),
      },
    },
    ({ question }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Call living_body_ask with question=${JSON.stringify(question)} and explicit_user_intent=true. Preserve confidence and which sources failed. Not medical advice.`,
          },
        },
      ],
    }),
  );
}
