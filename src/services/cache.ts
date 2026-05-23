import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_RESPONSE_TTL_SECONDS } from "../constants.js";

export interface CacheStatus extends Record<string, unknown> {
  enabled: boolean;
  path: string;
  entries: number;
  newest_cached_at?: string;
}

function cacheDisabled(): boolean {
  const value = process.env.DELX_LIVING_BODY_NO_CACHE;
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes";
}

function defaultCachePath(): string {
  return process.env.DELX_LIVING_BODY_CACHE_PATH
    ?? join(homedir(), ".delx-living-body", "cache.sqlite");
}

let db: Database.Database | null = null;
let dbPath: string | null = null;

function ensureDb(): Database.Database | null {
  if (cacheDisabled()) return null;
  const path = defaultCachePath();
  if (db && dbPath === path) return db;

  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const next = new Database(path);
    next.pragma("journal_mode = WAL");
    next.exec(`
      CREATE TABLE IF NOT EXISTS composition_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS composition_cache_expires_idx ON composition_cache(expires_at);
    `);
    try { chmodSync(path, 0o600); } catch { /* not all filesystems support chmod */ }
    db = next;
    dbPath = path;
    return db;
  } catch {
    return null;
  }
}

export function cacheGet<T>(key: string): T | undefined {
  const handle = ensureDb();
  if (!handle) return undefined;
  const row = handle.prepare(
    "SELECT payload, expires_at FROM composition_cache WHERE cache_key = ?"
  ).get(key) as { payload?: string; expires_at?: number } | undefined;
  if (!row?.payload) return undefined;
  if (typeof row.expires_at === "number" && row.expires_at < Date.now()) return undefined;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return undefined;
  }
}

export function cacheSet(key: string, payload: unknown, ttlSeconds = DEFAULT_RESPONSE_TTL_SECONDS): void {
  const handle = ensureDb();
  if (!handle) return;
  handle.prepare(`
    INSERT INTO composition_cache (cache_key, payload, cached_at, expires_at)
    VALUES (@cache_key, @payload, @cached_at, @expires_at)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload = excluded.payload,
      cached_at = excluded.cached_at,
      expires_at = excluded.expires_at
  `).run({
    cache_key: key,
    payload: JSON.stringify(payload),
    cached_at: new Date().toISOString(),
    expires_at: Date.now() + ttlSeconds * 1000
  });
}

export function cacheStatus(): CacheStatus {
  if (cacheDisabled()) return { enabled: false, path: defaultCachePath(), entries: 0 };
  const handle = ensureDb();
  if (!handle) return { enabled: false, path: defaultCachePath(), entries: 0 };
  const row = handle.prepare(
    "SELECT COUNT(*) AS entries, MAX(cached_at) AS newest_cached_at FROM composition_cache"
  ).get() as { entries: number; newest_cached_at?: string };
  return {
    enabled: true,
    path: defaultCachePath(),
    entries: row.entries,
    newest_cached_at: row.newest_cached_at
  };
}
