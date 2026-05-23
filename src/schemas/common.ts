import { z } from "zod";
import { KNOWN_CONNECTORS } from "../constants.js";

export const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown");

export const ConnectorIdSchema = z.enum(
  KNOWN_CONNECTORS.map((c) => c.id) as [string, ...string[]]
);

export const PrivacyModeValueSchema = z.enum(["summary", "structured", "raw"]);

export const ExplicitUserIntentSchema = z.literal(true).describe(
  "Required confirmation that the caller is acting on explicit user intent. living_body_ask spawns multiple wellness MCP subprocesses; agents must not call it speculatively."
);

export const StatusInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const DetectedConnectorSchema = z.object({
  id: z.string(),
  package: z.string(),
  display_name: z.string(),
  status: z.enum(["active", "detected", "missing", "timeout", "error"]),
  detection_method: z.enum(["tokens.json", "config.json", "export-path", "stateless", "profile.json"]).optional(),
  detected_path: z.string().optional(),
  last_seen: z.string().optional(),
  version_if_known: z.string().optional(),
  note: z.string().optional()
}).strict();

export const StatusOutputSchema = z.object({
  generated_at: z.string(),
  detected: z.array(DetectedConnectorSchema),
  missing: z.array(DetectedConnectorSchema),
  total_installed: z.number().int().nonnegative(),
  total_active: z.number().int().nonnegative(),
  total_known: z.number().int().nonnegative()
}).strict();

export const AskInputSchema = z.object({
  question: z.string().min(1).max(1000)
    .describe("Natural language question about training, recovery, sleep, nutrition or readiness."),
  sources: z.array(ConnectorIdSchema).optional()
    .describe("Restrict composition to a subset of detected connectors. Defaults to all detected."),
  explicit_user_intent: ExplicitUserIntentSchema,
  privacy_mode: PrivacyModeValueSchema.optional()
    .describe("Passed down to child connectors. Defaults to 'structured'. 'raw' is only honored with explicit_user_intent and is discouraged for routine composition."),
  response_format: ResponseFormatSchema
}).strict();

export const AskOutputSchema = z.object({
  recommendation: z.string(),
  reasoning: z.string(),
  sources_used: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  data_snapshot: z.record(z.string(), z.record(z.string(), z.unknown())),
  sources_failed: z.array(z.object({
    source: z.string(),
    status: z.enum(["timeout", "error", "skipped"]),
    note: z.string().optional()
  }).strict()),
  generated_at: z.string()
}).strict();

export const DailyBriefInputSchema = z.object({
  sources: z.array(ConnectorIdSchema).optional(),
  privacy_mode: PrivacyModeValueSchema.optional(),
  response_format: ResponseFormatSchema
}).strict();

export const DailyBriefOutputSchema = z.object({
  generated_at: z.string(),
  brief_markdown: z.string(),
  sources_used: z.array(z.string()),
  sources_failed: z.array(z.object({
    source: z.string(),
    status: z.enum(["timeout", "error", "skipped"]),
    note: z.string().optional()
  }).strict()),
  highlights: z.array(z.string()),
  data_snapshot: z.record(z.string(), z.record(z.string(), z.unknown()))
}).strict();

export const ComposeContextInputSchema = z.object({
  sources: z.array(ConnectorIdSchema).optional(),
  privacy_mode: PrivacyModeValueSchema.optional(),
  response_format: ResponseFormatSchema
}).strict();

export const ComposeContextOutputSchema = z.object({
  source: z.literal("delx-living-body"),
  context_contract_version: z.literal("delx-wellness-context/v1"),
  context_type: z.literal("composed_wellness_context"),
  generated_at: z.string(),
  recovery_score: z.number().min(0).max(100).optional(),
  sleep_score: z.number().min(0).max(100).optional(),
  strain_score: z.number().min(0).max(30).optional(),
  recent_training_load: z.enum(["low", "normal", "high", "unknown"]),
  body_battery: z.number().min(0).max(100).optional(),
  cycle_phase: z.string().optional(),
  per_source: z.record(z.string(), z.record(z.string(), z.unknown())),
  sources_used: z.array(z.string()),
  sources_failed: z.array(z.string()),
  notes: z.array(z.string()),
  recommended_handoff: z.object({ tool: z.string(), reason: z.string() }).strict().optional()
}).strict();

export const HealthCheckInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const HealthCheckEntrySchema = z.object({
  id: z.string(),
  package: z.string(),
  display_name: z.string(),
  status: z.enum(["active", "detected", "missing", "timeout", "error"]),
  category: z.string(),
  install_hint: z.string().optional(),
  detected_path: z.string().optional()
}).strict();

export const HealthCheckOutputSchema = z.object({
  generated_at: z.string(),
  total_known: z.number().int().nonnegative(),
  total_active: z.number().int().nonnegative(),
  total_missing: z.number().int().nonnegative(),
  connectors: z.array(HealthCheckEntrySchema)
}).strict();

export const CapabilitiesOutputSchema = z.object({
  project: z.string(),
  mcp_name: z.string(),
  creator: z.object({
    name: z.string(),
    github: z.string()
  }).strict(),
  unofficial: z.boolean(),
  api_boundary: z.object({
    source: z.string(),
    raw_definition: z.string(),
    does_not_include: z.array(z.string())
  }).strict(),
  auth_model: z.object({
    type: z.string(),
    token_storage: z.string(),
    notes: z.array(z.string())
  }).strict(),
  privacy_modes: z.array(z.object({
    mode: PrivacyModeValueSchema,
    use_when: z.string()
  }).strict()),
  tools: z.array(z.object({
    name: z.string(),
    summary: z.string()
  }).strict()),
  per_connector_availability_matrix: z.array(z.object({
    id: z.string(),
    package: z.string(),
    display_name: z.string(),
    category: z.string(),
    auth_shape: z.string(),
    context_tool: z.string().nullable(),
    daily_summary_tool: z.string().nullable()
  }).strict()),
  recommended_agent_flow: z.array(z.string()),
  contribution_paths: z.array(z.string()),
  links: z.record(z.string(), z.string())
}).strict();

export type AskInput = z.infer<typeof AskInputSchema>;
export type DailyBriefInput = z.infer<typeof DailyBriefInputSchema>;
export type ComposeContextInput = z.infer<typeof ComposeContextInputSchema>;
