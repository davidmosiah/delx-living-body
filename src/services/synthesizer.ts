import type { SynthesisResult } from "../types.js";
import type { NormalizedComposition } from "./composer.js";

export type IntentClass =
  | "training_readiness"
  | "sleep_quality"
  | "stress_load"
  | "nutrition"
  | "cycle_phase"
  | "glucose"
  | "environment"
  | "daily_overview";

/**
 * Classify the user's question into an intent. Rule-based on purpose — this
 * server intentionally does NOT call an LLM. Synthesis is offline and
 * deterministic so downstream agents can reason on top of a stable trace.
 */
export function classifyQuestion(question: string): IntentClass {
  const text = question.toLowerCase();
  // Stress signals checked first because "overtraining" contains "train".
  if (matches(text, ["stress", "burn", "overload", "overtrain", "fatigue", "exhausted"])) return "stress_load";
  if (matches(text, ["sleep", "slept", "bed", "insomnia", "wake up"])) return "sleep_quality";
  if (matches(text, ["train", "workout", "lift", "ride", "run today", "should i go hard", "rest day", "ready to push", "intensity"])) return "training_readiness";
  if (matches(text, ["eat", "food", "meal", "calor", "macro", "protein", "carb", "nutrition"])) return "nutrition";
  if (matches(text, ["cycle", "period", "luteal", "follicular", "menstr", "ovulat"])) return "cycle_phase";
  if (matches(text, ["glucose", "cgm", "blood sugar", "insulin"])) return "glucose";
  if (matches(text, ["air", "pollution", "aqi", "humid", "uv"])) return "environment";
  return "daily_overview";
}

function matches(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

/**
 * The 14 heuristic rules used by the synthesizer. Indexes are stable —
 * tests assert at least N distinct rule_ids fire across the fixture set.
 */
export const HEURISTIC_RULES = [
  { id: "rec_low", description: "Recovery < 50 => prescribe rest" },
  { id: "rec_mid", description: "Recovery 50-69 => zone 2" },
  { id: "rec_high", description: "Recovery >= 70 => train hard ok" },
  { id: "bb_low", description: "Body battery < 30 => low energy reserve" },
  { id: "bb_high", description: "Body battery >= 70 => good energy reserve" },
  { id: "sleep_poor", description: "Sleep score < 60 => recovery compromised" },
  { id: "sleep_good", description: "Sleep score >= 80 => sleep is supporting recovery" },
  { id: "strain_high", description: "Strain >= 18 yesterday => taper today" },
  { id: "cycle_luteal", description: "Cycle phase = luteal => expect lower output" },
  { id: "cycle_follicular", description: "Cycle phase = follicular => higher capacity window" },
  { id: "load_high", description: "Aggregate recent training load = high" },
  { id: "load_low", description: "Aggregate recent training load = low" },
  { id: "no_data", description: "No detected sources => return advisory only" },
  { id: "conflict", description: "Conflicting signals across sources => return low confidence" }
] as const;

export type RuleId = typeof HEURISTIC_RULES[number]["id"];

interface RuleFire {
  rule_id: RuleId;
  bullet: string;
}

export function synthesize(
  question: string,
  composition: NormalizedComposition
): SynthesisResult {
  const intent = classifyQuestion(question);
  const fires = applyRules(composition);
  const recommendation = buildRecommendation(intent, composition, fires);
  const confidence = pickConfidence(composition, fires);
  const reasoning = buildReasoning(intent, composition, fires);

  return {
    recommendation,
    reasoning,
    sources_used: composition.sources_used,
    confidence,
    data_snapshot: composition.per_source
  };
}

function applyRules(c: NormalizedComposition): RuleFire[] {
  const fires: RuleFire[] = [];

  if (c.sources_used.length === 0) {
    fires.push({ rule_id: "no_data", bullet: "No wellness connectors are installed or returned data — recommendations are generic." });
    return fires;
  }

  if (typeof c.recovery_score === "number") {
    if (c.recovery_score < 50) fires.push({ rule_id: "rec_low", bullet: `Recovery ${c.recovery_score} is in the low band (rest or active recovery).` });
    else if (c.recovery_score < 70) fires.push({ rule_id: "rec_mid", bullet: `Recovery ${c.recovery_score} is moderate — zone 2 / aerobic work.` });
    else fires.push({ rule_id: "rec_high", bullet: `Recovery ${c.recovery_score} supports a high-intensity day.` });
  }

  if (typeof c.body_battery === "number") {
    if (c.body_battery < 30) fires.push({ rule_id: "bb_low", bullet: `Body Battery ${c.body_battery} indicates low energy reserve.` });
    else if (c.body_battery >= 70) fires.push({ rule_id: "bb_high", bullet: `Body Battery ${c.body_battery} is healthy.` });
  }

  if (typeof c.sleep_score === "number") {
    if (c.sleep_score < 60) fires.push({ rule_id: "sleep_poor", bullet: `Sleep score ${c.sleep_score} is poor — recovery is compromised.` });
    else if (c.sleep_score >= 80) fires.push({ rule_id: "sleep_good", bullet: `Sleep score ${c.sleep_score} is supporting recovery.` });
  }

  if (typeof c.strain_score === "number" && c.strain_score >= 18) {
    fires.push({ rule_id: "strain_high", bullet: `Recent strain ${c.strain_score} is high — consider a taper.` });
  }

  if (c.cycle_phase === "luteal" || c.cycle_phase === "late-luteal") {
    fires.push({ rule_id: "cycle_luteal", bullet: `Cycle phase ${c.cycle_phase} typically reduces peak output.` });
  }
  if (c.cycle_phase === "follicular" || c.cycle_phase === "late-follicular") {
    fires.push({ rule_id: "cycle_follicular", bullet: `Cycle phase ${c.cycle_phase} is a higher-capacity window.` });
  }

  if (c.recent_training_load === "high") {
    fires.push({ rule_id: "load_high", bullet: "Aggregate recent training load is high — recovery is the limiter." });
  } else if (c.recent_training_load === "low") {
    fires.push({ rule_id: "load_low", bullet: "Aggregate recent training load is low — capacity to add stress." });
  }

  if (signalsConflict(c)) {
    fires.push({ rule_id: "conflict", bullet: "Sources disagree (e.g. WHOOP recovery vs Garmin Body Battery) — lower confidence." });
  }

  return fires;
}

function signalsConflict(c: NormalizedComposition): boolean {
  // Conflict if recovery score and body battery diverge by >35
  if (typeof c.recovery_score === "number" && typeof c.body_battery === "number") {
    if (Math.abs(c.recovery_score - c.body_battery) > 35) return true;
  }
  if (typeof c.recovery_score === "number" && typeof c.sleep_score === "number") {
    if (Math.abs(c.recovery_score - c.sleep_score) > 35) return true;
  }
  return false;
}

function buildRecommendation(
  intent: IntentClass,
  c: NormalizedComposition,
  fires: RuleFire[]
): string {
  const fireIds = new Set(fires.map((f) => f.rule_id));

  if (fireIds.has("no_data")) {
    return "No wellness data available. Install at least one Delx Wellness connector (whoop, oura, garmin, etc.) for personalized guidance.";
  }

  switch (intent) {
    case "training_readiness": {
      if (fireIds.has("rec_low") || fireIds.has("bb_low") || fireIds.has("strain_high")) {
        return "Recommend an easy day — mobility, walking, or zone 1. Capacity is limited today.";
      }
      if (fireIds.has("rec_high") && (fireIds.has("sleep_good") || !fireIds.has("sleep_poor"))) {
        return "Green light for a hard session. Recovery and sleep both support high intensity.";
      }
      if (fireIds.has("rec_mid")) {
        return "Aerobic zone 2 day. Save the hard intervals for tomorrow if recovery climbs.";
      }
      return "Default to a moderate aerobic session — data is mixed.";
    }
    case "sleep_quality": {
      if (fireIds.has("sleep_poor")) {
        return "Sleep was poor. Prioritize an earlier wind-down tonight and cut afternoon caffeine.";
      }
      if (fireIds.has("sleep_good")) {
        return "Sleep is solid. Maintain your current rhythm.";
      }
      return "Sleep is in the moderate band — no urgent change needed.";
    }
    case "stress_load": {
      if (fireIds.has("load_high") || fireIds.has("strain_high") || fireIds.has("bb_low")) {
        return "Stress load is elevated. Plan a recovery block (light activity, parasympathetic work).";
      }
      return "Stress signals look manageable — proceed with your normal plan.";
    }
    case "nutrition": {
      if (c.per_source["nourish"]) {
        return "Use Nourish suggestions matched to current recovery and (if cycle data is present) cycle phase.";
      }
      return "No nutrition connector detected — install wellness-nourish for meal-level guidance.";
    }
    case "cycle_phase": {
      if (fireIds.has("cycle_luteal")) return "Luteal phase: expect 5-10% lower peak output, slightly higher RPE.";
      if (fireIds.has("cycle_follicular")) return "Follicular phase: good window for higher-intensity work.";
      return c.cycle_phase
        ? `Current cycle phase: ${c.cycle_phase}.`
        : "No cycle data available.";
    }
    case "glucose":
      return c.per_source["cgm"]
        ? "CGM connector available — check cgm_wellness_context for in-range time and hypo events."
        : "No CGM connector detected.";
    case "environment":
      return c.per_source["air"]
        ? "Air connector reports current environmental load — see air_wellness_context for AQI/UV/humidity."
        : "No environment connector detected.";
    case "daily_overview":
    default: {
      const bits: string[] = [];
      if (typeof c.recovery_score === "number") bits.push(`recovery ${c.recovery_score}`);
      if (typeof c.sleep_score === "number") bits.push(`sleep ${c.sleep_score}`);
      if (typeof c.body_battery === "number") bits.push(`body battery ${c.body_battery}`);
      if (typeof c.strain_score === "number") bits.push(`recent strain ${c.strain_score}`);
      return bits.length ? `Today at a glance: ${bits.join(", ")}.` : "Daily overview composed from available sources.";
    }
  }
}

function buildReasoning(intent: IntentClass, c: NormalizedComposition, fires: RuleFire[]): string {
  const lines: string[] = [
    `Intent classified as: ${intent}`,
    `Sources used: ${c.sources_used.length ? c.sources_used.join(", ") : "none"}`
  ];
  if (c.sources_failed.length) {
    lines.push(`Sources failed: ${c.sources_failed.join(", ")}`);
  }
  lines.push("");
  lines.push("Heuristics fired:");
  for (const fire of fires) {
    lines.push(`- (${fire.rule_id}) ${fire.bullet}`);
  }
  return lines.join("\n");
}

function pickConfidence(c: NormalizedComposition, fires: RuleFire[]): "low" | "medium" | "high" {
  if (c.sources_used.length === 0) return "low";
  if (fires.some((f) => f.rule_id === "conflict")) return "low";
  if (c.sources_used.length >= 3) return "high";
  if (c.sources_used.length === 2) return "medium";
  return "low";
}

export function buildDailyBriefMarkdown(c: NormalizedComposition): { brief_markdown: string; highlights: string[] } {
  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];
  lines.push(`# Daily Brief — ${date}`);
  lines.push("");
  const highlights: string[] = [];

  if (c.sources_used.length === 0) {
    lines.push("No wellness sources returned data. Install at least one Delx Wellness connector to populate the brief.");
    return { brief_markdown: lines.join("\n"), highlights };
  }

  lines.push("## Snapshot");
  if (typeof c.recovery_score === "number") {
    lines.push(`- Recovery: **${c.recovery_score}**`);
    highlights.push(`recovery=${c.recovery_score}`);
  }
  if (typeof c.sleep_score === "number") {
    lines.push(`- Sleep: **${c.sleep_score}**`);
    highlights.push(`sleep=${c.sleep_score}`);
  }
  if (typeof c.body_battery === "number") {
    lines.push(`- Body Battery: **${c.body_battery}**`);
    highlights.push(`body_battery=${c.body_battery}`);
  }
  if (typeof c.strain_score === "number") {
    lines.push(`- Recent strain: **${c.strain_score}**`);
    highlights.push(`strain=${c.strain_score}`);
  }
  if (c.cycle_phase) {
    lines.push(`- Cycle phase: **${c.cycle_phase}**`);
    highlights.push(`cycle=${c.cycle_phase}`);
  }
  lines.push(`- Recent training load: **${c.recent_training_load}**`);
  lines.push("");
  lines.push("## Sources");
  for (const source of c.sources_used) {
    lines.push(`- \`${source}\``);
  }
  if (c.failures.length) {
    lines.push("");
    lines.push("## Sources that failed");
    for (const failure of c.failures) {
      lines.push(`- \`${failure.source}\` (${failure.status})${failure.note ? `: ${failure.note}` : ""}`);
    }
  }
  return { brief_markdown: lines.join("\n"), highlights };
}
