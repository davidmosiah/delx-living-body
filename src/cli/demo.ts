// Zero-secret end-to-end demo of delx-living-body answering
// "Should I train hard today?".
//
// This drives the REAL MCP server (this same binary, dist/index.js) over stdio,
// exactly the way an AI agent (Claude Desktop, Cursor, ChatGPT, Hermes,
// OpenClaw) would. The only thing faked is the child connectors: instead of real
// WHOOP/Oura/Garmin accounts we point the composer at a bundled stub child MCP
// (the hidden `__demo-stub-child` subcommand) carrying synthetic body data.
// Everything else — detection, parallel spawning, normalization, the rule-based
// synthesizer — is the shipped code path.
//
// No accounts, no API keys, no network. Runs from an installed package via npx.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { SERVER_VERSION } from "../constants.js";

/** Absolute path to this package's entrypoint (dist/index.js), resolved from the
 *  compiled location of this module (dist/cli/demo.js). */
function entrypoint(): string {
  return join(dirname(dirname(fileURLToPath(import.meta.url))), "index.js");
}

interface Scenario {
  label: string;
  blurb: string;
  whoop: Record<string, string>;
  oura: Record<string, string>;
  garmin: Record<string, string>;
}

const SCENARIOS: Record<string, Scenario> = {
  // A realistic "mixed but mostly green" morning: solid recovery + sleep,
  // healthy Body Battery, normal recent load.
  green: {
    label: "green",
    blurb: "recovery 74 · sleep 83 · body battery 68 · load normal",
    whoop: { STUB_VENDOR: "whoop", STUB_RECOVERY: "74", STUB_LOAD: "normal" },
    oura: { STUB_VENDOR: "oura", STUB_SLEEP: "83" },
    garmin: { STUB_VENDOR: "garmin", STUB_BB: "68", STUB_LOAD: "normal" }
  },
  // A "back off today" morning: poor recovery + sleep, depleted Body Battery,
  // high recent load.
  red: {
    label: "red",
    blurb: "recovery 31 · sleep 52 · body battery 22 · load high",
    whoop: { STUB_VENDOR: "whoop", STUB_RECOVERY: "31", STUB_LOAD: "high" },
    oura: { STUB_VENDOR: "oura", STUB_SLEEP: "52" },
    garmin: { STUB_VENDOR: "garmin", STUB_BB: "22", STUB_LOAD: "high" }
  }
};

function parseScenario(args: string[]): Scenario {
  for (const arg of args) {
    const match = /^--scenario=(.+)$/.exec(arg);
    if (match) {
      const key = match[1]!.toLowerCase();
      const scenario = SCENARIOS[key];
      if (!scenario) {
        throw new Error(
          `Unknown scenario "${key}". Available: ${Object.keys(SCENARIOS).join(", ")}.`
        );
      }
      return scenario;
    }
  }
  return SCENARIOS.green!;
}

function line(char = "─"): string {
  return char.repeat(64);
}

export function printDemoHelp(): void {
  console.log(`delx-living-body — zero-secret end-to-end demo.

Drives the real MCP server over stdio (the way an agent would) with three mock
wearable connectors carrying synthetic data. No accounts, no API keys, no network.

Usage:
  delx-living-body demo                 Run the demo ("Should I train hard today?")
  delx-living-body demo --scenario=red  Run the low-readiness ("back off") scenario
  delx-living-body demo --help          Show this help

Scenarios: ${Object.keys(SCENARIOS).join(", ")} (default: green)`);
}

export async function runDemo(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    printDemoHelp();
    return 0;
  }

  let scenario: Scenario;
  try {
    scenario = parseScenario(args);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const self = entrypoint();

  // 1. Pretend WHOOP, Oura, and Garmin are installed by dropping the token files
  //    the detector looks for under a throwaway HOME. (We never write real creds.)
  const home = mkdtempSync(join(tmpdir(), "living-body-demo-home-"));
  for (const dir of [".whoop-mcp", ".oura-mcp", ".garmin-mcp"]) {
    mkdirSync(join(home, dir), { recursive: true });
    writeFileSync(join(home, dir, "tokens.json"), "{}");
  }

  // 2. Point each connector's child binary at the bundled stub MCP (the hidden
  //    `__demo-stub-child` subcommand of this same binary), each carrying its own
  //    synthetic snapshot via STUB_* env. We use a tiny wrapper script per vendor
  //    so we can pin env per child (the override parsing is space-delimited).
  const wrappers = mkdtempSync(join(tmpdir(), "living-body-demo-wrap-"));
  function wrapper(name: string, env: Record<string, string>): string {
    const path = join(wrappers, `run-${name}.sh`);
    const lines = Object.entries(env)
      .map(([k, v]) => `${k}='${v}'`)
      .join(" ");
    writeFileSync(
      path,
      `#!/bin/sh\nexport ${lines}\nexec '${process.execPath}' '${self}' __demo-stub-child "$@"\n`,
      { mode: 0o755 }
    );
    return `sh ${path}`;
  }

  const childOverrides = {
    DELX_LIVING_BODY_CHILD_OVERRIDE_WHOOP: wrapper("whoop", scenario.whoop),
    DELX_LIVING_BODY_CHILD_OVERRIDE_OURA: wrapper("oura", scenario.oura),
    DELX_LIVING_BODY_CHILD_OVERRIDE_GARMIN: wrapper("garmin", scenario.garmin)
  };

  // 3. Connect to the real server the same way an agent would.
  const client = new Client({ name: "living-body-demo", version: SERVER_VERSION });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [self],
    env: {
      ...process.env,
      HOME: home,
      DELX_LIVING_BODY_NO_CACHE: "true",
      npm_config_update_notifier: "false",
      ...childOverrides
    }
  });

  await client.connect(transport);
  try {
    console.log(line("═"));
    console.log('delx-living-body — "Should I train hard today?" (end-to-end demo)');
    console.log(line("═"));
    console.log(`Scenario: ${scenario.label}`);
    console.log("Installed (mock) connectors: WHOOP, Oura, Garmin");
    console.log(`Snapshot: ${scenario.blurb}`);
    console.log("");

    // Step 1 — what does the agent see is available?
    const status = await client.callTool({
      name: "living_body_status",
      arguments: { response_format: "json" }
    });
    const statusContent = status.structuredContent as { detected: Array<{ id: string }> };
    const detected = statusContent.detected
      .map((d) => d.id)
      .filter((id) => ["whoop", "oura", "garmin"].includes(id));
    console.log("1) living_body_status — detected wearable connectors:");
    console.log("   " + detected.join(", "));
    console.log("");

    // Step 2 — the headline tool. Ask in plain language; one synthesized answer
    //          per question, each composed across all 3 connectors at once.
    interface AskResult {
      recommendation: string;
      confidence: string;
      sources_used: string[];
      reasoning: string;
    }
    async function ask(step: string, question: string): Promise<AskResult> {
      const res = await client.callTool({
        name: "living_body_ask",
        arguments: { question, explicit_user_intent: true, response_format: "json" }
      });
      const out = res.structuredContent as unknown as AskResult;
      console.log(`${step}) living_body_ask  question="${question}"`);
      console.log(line());
      console.log("Recommendation:");
      console.log("   " + out.recommendation);
      console.log("");
      console.log(`Confidence: ${out.confidence}   Sources: ${out.sources_used.join(", ")}`);
      console.log("");
      console.log("Reasoning trace (rule-based, no LLM):");
      for (const ln of out.reasoning.split("\n")) {
        console.log(ln ? "   " + ln : "");
      }
      console.log(line());
      console.log("");
      return out;
    }

    // The literal headline question — a daily overview composed from all sources.
    const overview = await ask("2", "What should I do today?");
    // The flagship reasoning path — a crisp, actionable directive.
    const training = await ask("3", "Should I train hard today?");

    // Sanity assertions so the demo doubles as a smoke test of the real surface.
    if (!detected.includes("whoop") || !detected.includes("oura") || !detected.includes("garmin")) {
      throw new Error(`expected whoop/oura/garmin detected, got ${detected.join(",")}`);
    }
    for (const out of [overview, training]) {
      if (out.confidence !== "high") {
        throw new Error(`expected high confidence from 3 agreeing sources, got ${out.confidence}`);
      }
      if (
        !out.sources_used.includes("whoop") ||
        !out.sources_used.includes("oura") ||
        !out.sources_used.includes("garmin")
      ) {
        throw new Error(`expected all 3 sources composed, got ${out.sources_used.join(",")}`);
      }
    }
    console.log("OK — 3 connectors composed per question, confidence=high, zero LLM calls.");
    return 0;
  } finally {
    await client.close();
    rmSync(home, { recursive: true, force: true });
    rmSync(wrappers, { recursive: true, force: true });
  }
}
