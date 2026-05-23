import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CONTEXT_CONTRACT_VERSION,
  DEFAULT_CHILD_TIMEOUT_MS,
  KnownConnector
} from "../constants.js";
import { getKnownConnector } from "./detector.js";
import type { ComposedSourceResult, DetectedConnector, PrivacyMode } from "../types.js";

const VERSION_TAG = "delx-living-body/composer-0.1";

function childCommand(connector: KnownConnector): { command: string; args: string[] } {
  // Allow tests/dev to override with DELX_LIVING_BODY_CHILD_OVERRIDE_<ID>=cmd a b c
  const overrideEnv = `DELX_LIVING_BODY_CHILD_OVERRIDE_${connector.id.toUpperCase()}`;
  const override = process.env[overrideEnv];
  if (override) {
    const parts = override.split(" ").filter(Boolean);
    return { command: parts[0]!, args: parts.slice(1) };
  }
  const useNpx = process.env.DELX_LIVING_BODY_NPM_RUNNER ?? "npx";
  // npx requires "-y" to avoid prompts
  return { command: useNpx, args: ["-y", connector.package] };
}

function childEnv(connector: KnownConnector, options: { probeOnly: boolean; privacyMode: PrivacyMode }): Record<string, string> {
  // CRITICAL: do NOT forward upstream tokens. Children read their own files.
  // We also intentionally drop anything that looks vendor-secret-shaped.
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") continue;
    const upper = key.toUpperCase();
    if (/(CLIENT_SECRET|REFRESH_TOKEN|ACCESS_TOKEN|API_KEY|PRIVATE_KEY|PASSWORD)$/i.test(upper)) continue;
    safe[key] = value;
  }
  if (options.probeOnly) {
    safe.MCP_PROBE = "1";
    safe.DELX_LIVING_BODY_PROBE = "1";
  }
  // Tell child what privacy mode the parent wants. Each vendor uses different env names;
  // we set a normalized one + the common per-vendor ones we know about.
  safe.DELX_WELLNESS_PRIVACY_MODE = options.privacyMode;
  const vendor = connector.id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  safe[`${vendor}_PRIVACY_MODE`] = options.privacyMode;
  return safe;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface CallChildOptions {
  privacyMode: PrivacyMode;
  /** When true we only confirm the child boots; we do not call data tools. */
  probeOnly?: boolean;
  /** Override the tool to call. Defaults to connector.context_tool. */
  toolName?: string;
  /** Args passed to the tool. */
  toolArgs?: Record<string, unknown>;
  /** Per-call timeout */
  timeoutMs?: number;
}

export async function callChild(connectorId: string, options: CallChildOptions): Promise<ComposedSourceResult> {
  const connector = getKnownConnector(connectorId);
  if (!connector) {
    return {
      source: connectorId,
      status: "error",
      duration_ms: 0,
      error: `Unknown connector id: ${connectorId}`
    };
  }

  const toolName = options.toolName ?? connector.context_tool;
  if (!toolName) {
    return {
      source: connectorId,
      status: "skipped",
      duration_ms: 0,
      error: `No tool to call for ${connectorId}`
    };
  }

  const started = Date.now();
  const { command, args } = childCommand(connector);
  const env = childEnv(connector, {
    probeOnly: Boolean(options.probeOnly),
    privacyMode: options.privacyMode
  });

  const client = new Client(
    { name: "delx-living-body-composer", version: VERSION_TAG },
    { capabilities: {} }
  );
  const transport = new StdioClientTransport({ command, args, env });

  try {
    await withTimeout(client.connect(transport), options.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS, `${connectorId}.connect`);
    if (options.probeOnly) {
      return { source: connectorId, status: "ok", duration_ms: Date.now() - started };
    }
    const result = await withTimeout(
      client.callTool({
        name: toolName,
        arguments: {
          response_format: "json",
          ...(options.toolArgs ?? {})
        }
      }),
      options.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS,
      `${connectorId}.${toolName}`
    );
    const context = (result.structuredContent && typeof result.structuredContent === "object")
      ? (result.structuredContent as Record<string, unknown>)
      : undefined;
    return {
      source: connectorId,
      status: "ok",
      duration_ms: Date.now() - started,
      context
    };
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (/timed out/i.test(message)) {
      return { source: connectorId, status: "timeout", duration_ms: Date.now() - started, error: message };
    }
    return { source: connectorId, status: "error", duration_ms: Date.now() - started, error: message };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export interface ComposeOptions {
  privacyMode: PrivacyMode;
  sources?: string[];
  timeoutMs?: number;
  tool?: "context" | "daily_summary";
  toolArgs?: Record<string, unknown>;
}

export async function composeAcrossDetected(
  detected: DetectedConnector[],
  options: ComposeOptions
): Promise<ComposedSourceResult[]> {
  const candidates = detected.filter((d) => d.status === "detected" || d.status === "active");
  const filtered = options.sources
    ? candidates.filter((d) => options.sources!.includes(d.id))
    : candidates;

  const results = await Promise.all(
    filtered.map((d) => {
      const connector = getKnownConnector(d.id);
      const toolName = options.tool === "daily_summary"
        ? connector?.daily_summary_tool
        : connector?.context_tool;
      return callChild(d.id, {
        privacyMode: options.privacyMode,
        timeoutMs: options.timeoutMs,
        toolName: toolName ?? undefined,
        toolArgs: options.toolArgs
      });
    })
  );
  return results;
}

export interface NormalizedComposition {
  context_contract_version: typeof CONTEXT_CONTRACT_VERSION;
  source: "delx-living-body";
  context_type: "composed_wellness_context";
  generated_at: string;
  recovery_score?: number;
  sleep_score?: number;
  strain_score?: number;
  body_battery?: number;
  recent_training_load: "low" | "normal" | "high" | "unknown";
  cycle_phase?: string;
  per_source: Record<string, Record<string, unknown>>;
  sources_used: string[];
  sources_failed: string[];
  failures: Array<{ source: string; status: "timeout" | "error" | "skipped"; note?: string }>;
  notes: string[];
}

export function normalize(results: ComposedSourceResult[]): NormalizedComposition {
  const per_source: Record<string, Record<string, unknown>> = {};
  const sources_used: string[] = [];
  const failures: NormalizedComposition["failures"] = [];
  const sources_failed: string[] = [];

  for (const r of results) {
    if (r.status === "ok" && r.context) {
      per_source[r.source] = r.context;
      sources_used.push(r.source);
    } else if (r.status !== "ok") {
      sources_failed.push(r.source);
      failures.push({ source: r.source, status: r.status, note: truncate(r.error, 240) });
    }
  }

  const scores = collectScores(per_source);

  return {
    context_contract_version: CONTEXT_CONTRACT_VERSION as typeof CONTEXT_CONTRACT_VERSION,
    source: "delx-living-body",
    context_type: "composed_wellness_context",
    generated_at: new Date().toISOString(),
    recovery_score: scores.recovery,
    sleep_score: scores.sleep,
    strain_score: scores.strain,
    body_battery: scores.body_battery,
    cycle_phase: scores.cycle_phase,
    recent_training_load: scores.training_load,
    per_source,
    sources_used,
    sources_failed,
    failures,
    notes: scores.notes
  };
}

interface ScoreBundle {
  recovery?: number;
  sleep?: number;
  strain?: number;
  body_battery?: number;
  training_load: "low" | "normal" | "high" | "unknown";
  cycle_phase?: string;
  notes: string[];
}

function collectScores(per_source: Record<string, Record<string, unknown>>): ScoreBundle {
  const notes: string[] = [];
  const recoveryCandidates: number[] = [];
  const sleepCandidates: number[] = [];
  const strainCandidates: number[] = [];
  const bbCandidates: number[] = [];
  const loads: string[] = [];
  let cycle_phase: string | undefined;

  for (const [source, ctx] of Object.entries(per_source)) {
    const recovery = numberField(ctx, "recovery_score");
    if (recovery !== undefined) {
      recoveryCandidates.push(recovery);
      notes.push(`${source} recovery_score=${recovery}`);
    }
    const sleep = numberField(ctx, "sleep_score");
    if (sleep !== undefined) {
      sleepCandidates.push(sleep);
      notes.push(`${source} sleep_score=${sleep}`);
    }
    const strain = numberField(ctx, "strain_score");
    if (strain !== undefined) {
      strainCandidates.push(strain);
      notes.push(`${source} strain_score=${strain}`);
    }
    const bb = numberField(ctx, "body_battery") ?? numberField(ctx, "body_battery_score");
    if (bb !== undefined) {
      bbCandidates.push(bb);
      notes.push(`${source} body_battery=${bb}`);
    }
    const load = stringField(ctx, "recent_training_load");
    if (load) loads.push(load);

    const phase = stringField(ctx, "cycle_phase") ?? stringField(ctx, "phase");
    if (phase) cycle_phase = phase;
  }

  const training_load = pickTrainingLoad(loads);

  return {
    recovery: avg(recoveryCandidates),
    sleep: avg(sleepCandidates),
    strain: avg(strainCandidates),
    body_battery: avg(bbCandidates),
    training_load,
    cycle_phase,
    notes
  };
}

function numberField(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value ? value : undefined;
}

function avg(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function pickTrainingLoad(loads: string[]): "low" | "normal" | "high" | "unknown" {
  if (loads.length === 0) return "unknown";
  const priority = ["high", "normal", "low", "unknown"];
  for (const candidate of priority) {
    if (loads.includes(candidate)) return candidate as "low" | "normal" | "high" | "unknown";
  }
  return "unknown";
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
