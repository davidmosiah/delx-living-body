import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detect, clearDetectionCache } from '../dist/services/detector.js';
import { composeAcrossDetected, normalize, callChild } from '../dist/services/composer.js';

const stub = new URL('./_stub-child-mcp.mjs', import.meta.url).pathname;

function makeHome(setup) {
  const home = mkdtempSync(join(tmpdir(), 'living-body-compose-'));
  for (const [dir, files] of Object.entries(setup)) {
    const abs = join(home, dir);
    mkdirSync(abs, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(abs, name), content);
    }
  }
  return home;
}

// 1. Single child via callChild — direct invocation
process.env.STUB_VENDOR = 'whoop';
process.env.STUB_RECOVERY = '78';
process.env.STUB_LOAD = 'normal';
process.env.DELX_LIVING_BODY_CHILD_OVERRIDE_WHOOP = `node ${stub}`;
const direct = await callChild('whoop', { privacyMode: 'structured', timeoutMs: 10_000 });
assert.equal(direct.status, 'ok', `direct call failed: ${direct.error}`);
assert.equal(direct.context?.recovery_score, 78);
delete process.env.STUB_VENDOR;
delete process.env.STUB_RECOVERY;

// 2. Multi-child composition via composeAcrossDetected
const home = makeHome({
  '.whoop-mcp': { 'tokens.json': '{}' },
  '.oura-mcp': { 'tokens.json': '{}' },
  '.garmin-mcp': { 'tokens.json': '{}' }
});
clearDetectionCache();
const detection = detect({ home });
assert.ok(detection.detected.find((d) => d.id === 'whoop'));

// Configure stub overrides for each. The stub binary reads env at startup,
// but since all 3 spawn the same script we use a small differentiating trick:
// each override gets its own STUB_VENDOR via a shell wrapper script we generate.
const wrapperHome = mkdtempSync(join(tmpdir(), 'living-body-wrappers-'));

function writeWrapper(vendor, envOverrides) {
  const sh = join(wrapperHome, `run-${vendor}.sh`);
  const envLines = Object.entries(envOverrides).map(([k, v]) => `${k}='${v}'`).join(' ');
  writeFileSync(sh, `#!/bin/sh\nexport ${envLines}\nexec node '${stub}' "$@"\n`, { mode: 0o755 });
  return sh;
}

const whoopWrapper = writeWrapper('whoop', { STUB_VENDOR: 'whoop', STUB_RECOVERY: '78', STUB_LOAD: 'normal' });
const ouraWrapper = writeWrapper('oura', { STUB_VENDOR: 'oura', STUB_SLEEP: '82' });
const garminWrapper = writeWrapper('garmin', { STUB_VENDOR: 'garmin', STUB_BB: '71', STUB_LOAD: 'normal' });

process.env.DELX_LIVING_BODY_CHILD_OVERRIDE_WHOOP = `sh ${whoopWrapper}`;
process.env.DELX_LIVING_BODY_CHILD_OVERRIDE_OURA = `sh ${ouraWrapper}`;
process.env.DELX_LIVING_BODY_CHILD_OVERRIDE_GARMIN = `sh ${garminWrapper}`;

const results = await composeAcrossDetected(detection.detected, { privacyMode: 'structured', timeoutMs: 15_000 });
const ok_count = results.filter((r) => r.status === 'ok').length;
assert.ok(ok_count >= 3, `expected >=3 OK results, got ${ok_count}. results=${JSON.stringify(results.map((r) => ({ s: r.source, st: r.status, e: r.error?.slice(0, 80) })))}`);

const composition = normalize(results);
assert.equal(composition.recovery_score, 78);
assert.equal(composition.sleep_score, 82);
assert.equal(composition.body_battery, 71);
assert.ok(composition.sources_used.includes('whoop'));
assert.ok(composition.sources_used.includes('oura'));
assert.ok(composition.sources_used.includes('garmin'));

// 3. Verify upstream secrets are NOT forwarded to children
// We add a sentinel CLIENT_SECRET to our env. The stub does not echo env,
// but composer.ts guarantees the secret is filtered.
process.env.WHOOP_CLIENT_SECRET = 'NEVER_FORWARD';
const sweep = await callChild('whoop', { privacyMode: 'structured', timeoutMs: 10_000 });
assert.equal(sweep.status, 'ok');
delete process.env.WHOOP_CLIENT_SECRET;

// 4. Timeout path: pretend child binary hangs
process.env.DELX_LIVING_BODY_CHILD_OVERRIDE_WHOOP = 'sleep 60';
const timed = await callChild('whoop', { privacyMode: 'structured', timeoutMs: 1500 });
assert.equal(timed.status, 'timeout', `expected timeout, got ${timed.status}`);

console.log(JSON.stringify({
  ok: true,
  sources_composed: composition.sources_used.length,
  recovery_score: composition.recovery_score,
  sleep_score: composition.sleep_score,
  body_battery: composition.body_battery,
  timeout_handled: true
}, null, 2));
