import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  CONNECTOR_BY_ID,
  DEFAULT_DETECT_TTL_SECONDS,
  KNOWN_CONNECTORS,
  KnownConnector,
  PROFILE_PATH_REL
} from "../constants.js";
import type { DetectedConnector } from "../types.js";

const NS_PER_MS = 1_000_000;

interface CacheEntry {
  detected_at_ms: number;
  results: DetectedConnector[];
}

let cache: CacheEntry | null = null;

function ttlSeconds(): number {
  const raw = process.env.DELX_LIVING_BODY_DETECT_TTL;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_DETECT_TTL_SECONDS;
}

function readProfileDevices(home: string): Set<string> {
  const path = join(home, PROFILE_PATH_REL);
  if (!existsSync(path)) return new Set();
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return new Set();
    if (stat.size > 256 * 1024) return new Set();
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    const devices = parsed?.devices;
    if (!Array.isArray(devices)) return new Set();
    const ids = new Set<string>();
    for (const device of devices) {
      if (typeof device === "string") ids.add(device);
      else if (device && typeof device === "object" && typeof device.id === "string") ids.add(device.id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

function detectOne(connector: KnownConnector, home: string, profileDevices: Set<string>): DetectedConnector {
  const base = {
    id: connector.id,
    package: connector.package,
    display_name: connector.display_name
  };

  if (connector.stateless) {
    return {
      ...base,
      status: "detected",
      detection_method: "stateless",
      note: "Stateless connector — always considered available."
    };
  }

  // 1. tokens.json
  const tokenPath = join(home, connector.home_dir, "tokens.json");
  if (existsSync(tokenPath)) {
    return {
      ...base,
      status: "detected",
      detection_method: "tokens.json",
      detected_path: tokenPath,
      last_seen: safeStatMtime(tokenPath)
    };
  }

  // 2. config.json
  const configPath = join(home, connector.home_dir, "config.json");
  if (existsSync(configPath)) {
    return {
      ...base,
      status: "detected",
      detection_method: "config.json",
      detected_path: configPath,
      last_seen: safeStatMtime(configPath)
    };
  }

  // 3. export-path
  if (connector.auth_shape === "export-path") {
    const envPath = connector.export_env_var ? process.env[connector.export_env_var] : undefined;
    if (envPath && existsSync(envPath)) {
      return {
        ...base,
        status: "detected",
        detection_method: "export-path",
        detected_path: envPath,
        last_seen: safeStatMtime(envPath)
      };
    }
    if (connector.default_export_path) {
      const fallbackPath = join(home, connector.default_export_path);
      if (existsSync(fallbackPath)) {
        return {
          ...base,
          status: "detected",
          detection_method: "export-path",
          detected_path: fallbackPath,
          last_seen: safeStatMtime(fallbackPath)
        };
      }
    }
  }

  // 4. profile.json listed device
  if (profileDevices.has(connector.id)) {
    return {
      ...base,
      status: "detected",
      detection_method: "profile.json",
      note: "Listed in ~/.delx-wellness/profile.json devices."
    };
  }

  return {
    ...base,
    status: "missing"
  };
}

function safeStatMtime(path: string): string | undefined {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return undefined;
  }
}

export interface DetectionResult {
  detected: DetectedConnector[];
  missing: DetectedConnector[];
  all: DetectedConnector[];
}

export interface DetectOptions {
  force?: boolean;
  home?: string;
}

export function detect(options: DetectOptions = {}): DetectionResult {
  const home = options.home ?? homedir();
  const now = Date.now();
  const ttlMs = ttlSeconds() * 1000;

  if (!options.force && cache && (now - cache.detected_at_ms) < ttlMs && !options.home) {
    return splitResults(cache.results);
  }

  const profileDevices = readProfileDevices(home);
  const results = KNOWN_CONNECTORS.map((c) => detectOne(c, home, profileDevices));
  if (!options.home) {
    cache = { detected_at_ms: now, results };
  }
  return splitResults(results);
}

function splitResults(all: DetectedConnector[]): DetectionResult {
  return {
    detected: all.filter((r) => r.status !== "missing"),
    missing: all.filter((r) => r.status === "missing"),
    all
  };
}

export function clearDetectionCache(): void {
  cache = null;
}

export function knownConnectorIds(): string[] {
  return KNOWN_CONNECTORS.map((c) => c.id);
}

export function getKnownConnector(id: string): KnownConnector | undefined {
  return CONNECTOR_BY_ID[id];
}

export function installHint(connector: KnownConnector): string {
  return `npx -y ${connector.package} setup`;
}
