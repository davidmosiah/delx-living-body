#!/usr/bin/env node
// End-to-end demo of delx-living-body answering "What should I do today?"
//
// This drives the REAL MCP server (dist/index.js) over stdio, exactly the way
// an AI agent (Claude Desktop, Cursor, OpenClaw) would. The only thing faked is
// the child connectors: instead of real WHOOP/Oura/Garmin accounts we point the
// composer at the bundled stub child MCP (scripts/_stub-child-mcp.mjs) carrying
// synthetic body data. Everything else — detection, parallel spawning,
// normalization, the rule-based synthesizer — is the shipped code path.
//
// Run with:  npm run demo   (after npm run build)
// No accounts, no API keys, no network.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const stub = new URL("./_stub-child-mcp.mjs", import.meta.url).pathname;

// 1. Pretend WHOOP, Oura, and Garmin are installed by dropping the token files
//    the detector looks for under a throwaway HOME. (We never write real creds.)
const home = mkdtempSync(join(tmpdir(), "living-body-demo-home-"));
for (const dir of [".whoop-mcp", ".oura-mcp", ".garmin-mcp"]) {
  mkdirSync(join(home, dir), { recursive: true });
  writeFileSync(join(home, dir, "tokens.json"), "{}");
}

// 2. Point each connector's child binary at the stub MCP, each carrying its own
//    synthetic snapshot. A small shell wrapper lets all three reuse one script
//    with different env (the stub reads STUB_* at startup).
const wrappers = mkdtempSync(join(tmpdir(), "living-body-demo-wrap-"));
function wrapper(name, env) {
  const path = join(wrappers, `run-${name}.sh`);
  const lines = Object.entries(env).map(([k, v]) => `${k}='${v}'`).join(" ");
  writeFileSync(path, `#!/bin/sh\nexport ${lines}\nexec node '${stub}' "$@"\n`, { mode: 0o755 });
  return `sh ${path}`;
}

// A realistic "mixed but mostly green" morning: solid recovery + sleep,
// healthy Body Battery, normal recent load.
const childOverrides = {
  DELX_LIVING_BODY_CHILD_OVERRIDE_WHOOP: wrapper("whoop", {
    STUB_VENDOR: "whoop", STUB_RECOVERY: "74", STUB_LOAD: "normal"
  }),
  DELX_LIVING_BODY_CHILD_OVERRIDE_OURA: wrapper("oura", {
    STUB_VENDOR: "oura", STUB_SLEEP: "83"
  }),
  DELX_LIVING_BODY_CHILD_OVERRIDE_GARMIN: wrapper("garmin", {
    STUB_VENDOR: "garmin", STUB_BB: "68", STUB_LOAD: "normal"
  })
};

// 3. Connect to the real server the same way an agent would.
const client = new Client({ name: "living-body-demo", version: "0.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: {
    ...process.env,
    HOME: home,
    DELX_LIVING_BODY_NO_CACHE: "true",
    npm_config_update_notifier: "false",
    ...childOverrides
  }
});

function line(char = "─") {
  return char.repeat(64);
}

await client.connect(transport);
try {
  console.log(line("═"));
  console.log("delx-living-body — \"What should I do today?\" (end-to-end demo)");
  console.log(line("═"));
  console.log("Installed (mock) connectors: WHOOP, Oura, Garmin");
  console.log("Snapshot: recovery 74 · sleep 83 · body battery 68 · load normal");
  console.log("");

  // Step 1 — what does the agent see is available?
  const status = await client.callTool({
    name: "living_body_status",
    arguments: { response_format: "json" }
  });
  const detected = status.structuredContent.detected
    .map((d) => d.id)
    .filter((id) => ["whoop", "oura", "garmin"].includes(id));
  console.log("1) living_body_status — detected wearable connectors:");
  console.log("   " + detected.join(", "));
  console.log("");

  // Step 2 — the headline tool. Ask in plain language; one synthesized answer
  //          per question, each composed across all 3 connectors at once.
  async function ask(step, question) {
    const res = await client.callTool({
      name: "living_body_ask",
      arguments: { question, explicit_user_intent: true, response_format: "json" }
    });
    const out = res.structuredContent;
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
    if (!out.sources_used.includes("whoop") || !out.sources_used.includes("oura") || !out.sources_used.includes("garmin")) {
      throw new Error(`expected all 3 sources composed, got ${out.sources_used.join(",")}`);
    }
  }
  if (!/hard session|high intensity|green light/i.test(training.recommendation)) {
    throw new Error(`expected a training-readiness directive, got: ${training.recommendation}`);
  }
  console.log("OK — 3 connectors composed per question, confidence=high, zero LLM calls.");
} finally {
  await client.close();
}
