import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detect, clearDetectionCache } from '../dist/services/detector.js';

// Build synthetic $HOME with fake connector dirs and verify detection picks them up.
function makeHome(setup) {
  const home = mkdtempSync(join(tmpdir(), 'living-body-detect-'));
  for (const [dir, files] of Object.entries(setup)) {
    const abs = join(home, dir);
    mkdirSync(abs, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(abs, name), content);
    }
  }
  return home;
}

// 1. Empty $HOME → only stateless (cycle_coach) detected
clearDetectionCache();
let result = detect({ home: mkdtempSync(join(tmpdir(), 'living-body-empty-')) });
const empty_detected = result.detected.map((d) => d.id).sort();
assert.deepEqual(empty_detected, ['cycle_coach'], `empty home should only detect cycle_coach, got ${empty_detected.join(',')}`);

// 2. Three synthetic connectors with tokens.json
clearDetectionCache();
const home3 = makeHome({
  '.whoop-mcp': { 'tokens.json': '{"access_token":"x"}' },
  '.oura-mcp': { 'tokens.json': '{"access_token":"y"}' },
  '.garmin-mcp': { 'tokens.json': '{"access_token":"z"}' }
});
result = detect({ home: home3 });
const ids3 = result.detected.map((d) => d.id).sort();
assert.ok(ids3.includes('whoop') && ids3.includes('oura') && ids3.includes('garmin'),
  `expected whoop+oura+garmin detected, got ${ids3.join(',')}`);
assert.ok(ids3.includes('cycle_coach'), 'stateless cycle_coach should still be detected');

const whoop = result.detected.find((d) => d.id === 'whoop');
assert.equal(whoop.detection_method, 'tokens.json');
assert.ok(whoop.detected_path.endsWith('.whoop-mcp/tokens.json'));

// 3. config.json shape (eight-sleep, nourish)
clearDetectionCache();
const home4 = makeHome({
  '.eight-sleep-mcp': { 'config.json': '{"email":"a@b"}' },
  '.wellness-nourish': { 'config.json': '{"locale":"pt-BR"}' }
});
result = detect({ home: home4 });
assert.ok(result.detected.find((d) => d.id === 'eight_sleep')?.detection_method === 'config.json');
assert.ok(result.detected.find((d) => d.id === 'nourish')?.detection_method === 'config.json');

// 4. profile.json device list (no tokens)
clearDetectionCache();
const home5 = makeHome({
  '.delx-wellness': { 'profile.json': JSON.stringify({ devices: ['strava', { id: 'polar' }] }) }
});
result = detect({ home: home5 });
const profileDetected = result.detected.map((d) => d.id);
assert.ok(profileDetected.includes('strava'), 'strava should be detected via profile.json');
assert.ok(profileDetected.includes('polar'), 'polar should be detected via profile.json');
const strava = result.detected.find((d) => d.id === 'strava');
assert.equal(strava.detection_method, 'profile.json');

// 5. export-path fallback (apple-health default path)
clearDetectionCache();
const home6 = makeHome({
  '.apple-health-mcp': { 'export.xml': '<HealthData></HealthData>' }
});
result = detect({ home: home6 });
const apple = result.detected.find((d) => d.id === 'apple_health');
assert.ok(apple, 'apple_health should be detected via default export path');
assert.equal(apple.detection_method, 'export-path');

// 6. 15 total known
assert.equal(result.all.length, 15);

// 7. Stateless connector never appears in missing
const missing_ids = result.missing.map((d) => d.id);
assert.ok(!missing_ids.includes('cycle_coach'), 'stateless cycle_coach must never be in missing');

console.log(JSON.stringify({
  ok: true,
  synthetic_homes_tested: 6,
  total_detected_in_big_home: result.detected.length
}, null, 2));
