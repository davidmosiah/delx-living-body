import { homedir } from "node:os";
import { join } from "node:path";
import { KNOWN_CONNECTORS, NPM_PACKAGE_NAME, SERVER_VERSION } from "../constants.js";
import { detect, installHint } from "../services/detector.js";

export async function runCliCommand(args: string[]): Promise<number | undefined> {
  const [command, ...rest] = args;
  if (!command || command === "--http") return undefined;
  if (command === "setup") return runSetup(rest);
  if (command === "doctor" || command === "status") return runDoctor(rest);
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(SERVER_VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (!command.startsWith("--")) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }
  return undefined;
}

function runSetup(_args: string[]): number {
  const home = homedir();
  const profilePath = join(home, ".delx-wellness", "profile.json");
  console.log("delx-living-body has no auth of its own — each child connector handles its own setup.");
  console.log("");
  console.log("Shared profile (optional, read by every Delx Wellness connector):");
  console.log(`  ${profilePath}`);
  console.log("");
  console.log("To install a connector, run any of:");
  for (const c of KNOWN_CONNECTORS) {
    console.log(`  ${installHint(c).padEnd(48)} # ${c.display_name}`);
  }
  return 0;
}

function runDoctor(args: string[]): number {
  const json = args.includes("--json");
  const result = detect();
  const payload = {
    project: NPM_PACKAGE_NAME,
    version: SERVER_VERSION,
    total_known: KNOWN_CONNECTORS.length,
    total_installed: result.detected.length,
    detected: result.detected.map((d) => ({ id: d.id, status: d.status, method: d.detection_method, path: d.detected_path })),
    missing: result.missing.map((d) => d.id)
  };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  console.log("delx-living-body · Doctor");
  console.log(`Version: ${SERVER_VERSION}`);
  console.log(`Known connectors: ${payload.total_known}`);
  console.log(`Installed locally: ${payload.total_installed}`);
  console.log("");
  for (const d of payload.detected) {
    console.log(`  + ${d.id} (${d.method ?? "?"})${d.path ? ` at ${d.path}` : ""}`);
  }
  for (const id of payload.missing) {
    console.log(`  - ${id} (missing)`);
  }
  return 0;
}

function printHelp(): void {
  console.log(`delx-living-body — meta-MCP that composes installed Delx Wellness connectors.

Usage:
  living-body-mcp-server                Start MCP stdio server
  living-body-mcp-server --http         Start local HTTP MCP server
  living-body-mcp-server doctor         Detect installed connectors (alias: status)
  living-body-mcp-server doctor --json  JSON output
  living-body-mcp-server setup          Print shared-profile path and per-connector install hints
  living-body-mcp-server version        Print server version

Env:
  DELX_LIVING_BODY_DETECT_TTL           Detection cache TTL (seconds, default 60)
  DELX_LIVING_BODY_NO_CACHE             Disable SQLite response cache when true
  DELX_LIVING_BODY_CACHE_PATH           Override default cache path
  DELX_LIVING_BODY_NPM_RUNNER           Path to npx (default: npx)
  DELX_LIVING_BODY_CHILD_OVERRIDE_<ID>  Override a child connector binary (testing only)
`);
}
