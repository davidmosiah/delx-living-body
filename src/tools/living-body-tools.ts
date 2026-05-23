import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CONNECTOR_BY_ID, KNOWN_CONNECTORS } from "../constants.js";
import {
  AskInputSchema,
  AskOutputSchema,
  CapabilitiesOutputSchema,
  ComposeContextInputSchema,
  ComposeContextOutputSchema,
  DailyBriefInputSchema,
  DailyBriefOutputSchema,
  HealthCheckInputSchema,
  HealthCheckOutputSchema,
  StatusInputSchema,
  StatusOutputSchema
} from "../schemas/common.js";
import { composeAcrossDetected, normalize } from "../services/composer.js";
import { detect, installHint } from "../services/detector.js";
import { bulletList, makeError, makeResponse } from "../services/format.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDailyBriefMarkdown, synthesize } from "../services/synthesizer.js";
import type { PrivacyMode } from "../types.js";

function resolvePrivacyMode(input: PrivacyMode | undefined, explicit_user_intent: boolean): PrivacyMode {
  if (input === "raw" && !explicit_user_intent) return "structured";
  return input ?? "structured";
}

export function registerLivingBodyTools(server: McpServer): void {
  server.registerTool(
    "living_body_status",
    {
      title: "Living Body — Connector Detection",
      description: "Detect which Delx Wellness connectors are installed locally. Safe, no subprocess spawning.",
      inputSchema: StatusInputSchema.shape,
      outputSchema: StatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (params) => {
      try {
        const result = detect();
        const out = {
          generated_at: new Date().toISOString(),
          detected: result.detected,
          missing: result.missing,
          total_installed: result.detected.length,
          total_active: result.detected.filter((d) => d.status === "active").length,
          total_known: KNOWN_CONNECTORS.length
        };
        return makeResponse(out, params.response_format, bulletList("Living Body — Status", {
          generated_at: out.generated_at,
          total_known: out.total_known,
          total_installed: out.total_installed,
          detected: out.detected.map((d) => `${d.display_name} (${d.id}) — ${d.detection_method ?? "?"}`),
          missing: out.missing.map((d) => d.id)
        }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "living_body_ask",
    {
      title: "Living Body — Ask",
      description: "Ask a wellness question; composes detected connectors in parallel and returns a synthesized answer + reasoning trace. Spawns subprocesses — requires explicit_user_intent.",
      inputSchema: AskInputSchema.shape,
      outputSchema: AskOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params) => {
      try {
        const detection = detect();
        const privacyMode = resolvePrivacyMode(params.privacy_mode, params.explicit_user_intent === true);
        const results = await composeAcrossDetected(detection.detected, {
          privacyMode,
          sources: params.sources
        });
        const composition = normalize(results);
        const synthesis = synthesize(params.question, composition);
        const out = {
          recommendation: synthesis.recommendation,
          reasoning: synthesis.reasoning,
          sources_used: synthesis.sources_used,
          confidence: synthesis.confidence,
          data_snapshot: synthesis.data_snapshot,
          sources_failed: composition.failures,
          generated_at: new Date().toISOString()
        };
        const markdown = [
          "# Living Body — Answer",
          "",
          `**Recommendation**: ${synthesis.recommendation}`,
          "",
          `**Confidence**: ${synthesis.confidence}`,
          `**Sources used**: ${synthesis.sources_used.length ? synthesis.sources_used.join(", ") : "(none)"}`,
          "",
          "## Reasoning",
          synthesis.reasoning
        ].join("\n");
        return makeResponse(out, params.response_format, markdown);
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "living_body_daily_brief",
    {
      title: "Living Body — Daily Brief",
      description: "Synthetic daily briefing aggregating each detected connector's daily summary/context.",
      inputSchema: DailyBriefInputSchema.shape,
      outputSchema: DailyBriefOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params) => {
      try {
        const detection = detect();
        const privacyMode = resolvePrivacyMode(params.privacy_mode, false);
        const results = await composeAcrossDetected(detection.detected, {
          privacyMode,
          sources: params.sources,
          tool: "daily_summary"
        });
        const composition = normalize(results);
        const { brief_markdown, highlights } = buildDailyBriefMarkdown(composition);
        const out = {
          generated_at: composition.generated_at,
          brief_markdown,
          sources_used: composition.sources_used,
          sources_failed: composition.failures,
          highlights,
          data_snapshot: composition.per_source
        };
        return makeResponse(out, params.response_format, brief_markdown);
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "living_body_compose_context",
    {
      title: "Living Body — Compose Context",
      description: "Return the normalized delx-wellness-context/v1 shape merged across all detected sources.",
      inputSchema: ComposeContextInputSchema.shape,
      outputSchema: ComposeContextOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params) => {
      try {
        const detection = detect();
        const privacyMode = resolvePrivacyMode(params.privacy_mode, false);
        const results = await composeAcrossDetected(detection.detected, {
          privacyMode,
          sources: params.sources
        });
        const composition = normalize(results);
        const out = {
          source: "delx-living-body" as const,
          context_contract_version: "delx-wellness-context/v1" as const,
          context_type: "composed_wellness_context" as const,
          generated_at: composition.generated_at,
          recovery_score: composition.recovery_score,
          sleep_score: composition.sleep_score,
          strain_score: composition.strain_score,
          recent_training_load: composition.recent_training_load,
          body_battery: composition.body_battery,
          cycle_phase: composition.cycle_phase,
          per_source: composition.per_source,
          sources_used: composition.sources_used,
          sources_failed: composition.sources_failed,
          notes: composition.notes,
          recommended_handoff: composition.sources_used.length
            ? { tool: "living_body_ask", reason: "Ask a question against the composed context for a synthesized answer." }
            : undefined
        };
        const markdown = bulletList("Composed Wellness Context", {
          generated_at: out.generated_at,
          sources_used: out.sources_used,
          sources_failed: out.sources_failed,
          recovery_score: out.recovery_score,
          sleep_score: out.sleep_score,
          strain_score: out.strain_score,
          body_battery: out.body_battery,
          cycle_phase: out.cycle_phase,
          recent_training_load: out.recent_training_load
        });
        return makeResponse(out, params.response_format, markdown);
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "living_body_health_check",
    {
      title: "Living Body — Health Check (all known connectors)",
      description: "Returns status for every known connector — including missing ones — with install hints.",
      inputSchema: HealthCheckInputSchema.shape,
      outputSchema: HealthCheckOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (params) => {
      try {
        const detection = detect();
        const map = new Map(detection.all.map((d) => [d.id, d]));
        const connectors = KNOWN_CONNECTORS.map((c) => {
          const det = map.get(c.id);
          const status = det?.status ?? "missing";
          return {
            id: c.id,
            package: c.package,
            display_name: c.display_name,
            status,
            category: c.category,
            install_hint: status === "missing" ? installHint(c) : undefined,
            detected_path: det?.detected_path
          };
        });
        const total_active = connectors.filter((c) => c.status === "active" || c.status === "detected").length;
        const total_missing = connectors.filter((c) => c.status === "missing").length;
        const out = {
          generated_at: new Date().toISOString(),
          total_known: KNOWN_CONNECTORS.length,
          total_active,
          total_missing,
          connectors
        };
        const lines = ["# Living Body — Health Check", ""];
        lines.push(`Known: ${KNOWN_CONNECTORS.length} | active: ${total_active} | missing: ${total_missing}`);
        lines.push("");
        for (const c of connectors) {
          if (c.status === "missing") {
            lines.push(`- ${c.display_name} (${c.id}) — **missing**. Run \`${c.install_hint}\`.`);
          } else {
            lines.push(`- ${c.display_name} (${c.id}) — ${c.status}${c.detected_path ? ` at ${c.detected_path}` : ""}`);
          }
        }
        return makeResponse(out, params.response_format, lines.join("\n"));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "living_body_capabilities",
    {
      title: "Living Body — Capabilities",
      description: "Self-description of this MCP, including the per-connector availability matrix.",
      inputSchema: StatusInputSchema.shape,
      outputSchema: CapabilitiesOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (params) => {
      try {
        const out = buildCapabilities();
        return makeResponse(out, params.response_format, bulletList("Living Body — Capabilities", {
          project: out.project,
          tools: out.tools.map((t) => t.name),
          connectors: out.per_connector_availability_matrix.length
        }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );
}

// Silence unused-import warnings for shake-friendly bundlers
void CONNECTOR_BY_ID;
