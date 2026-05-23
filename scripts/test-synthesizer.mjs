import assert from 'node:assert/strict';
import { synthesize, classifyQuestion, HEURISTIC_RULES, buildDailyBriefMarkdown } from '../dist/services/synthesizer.js';

function comp(per_source, overrides = {}) {
  // Build a NormalizedComposition mock
  const sources_used = Object.keys(per_source);
  const numbers = aggregate(per_source);
  return {
    context_contract_version: 'delx-wellness-context/v1',
    source: 'delx-living-body',
    context_type: 'composed_wellness_context',
    generated_at: new Date().toISOString(),
    recovery_score: numbers.recovery,
    sleep_score: numbers.sleep,
    body_battery: numbers.bb,
    strain_score: numbers.strain,
    recent_training_load: 'normal',
    cycle_phase: undefined,
    per_source,
    sources_used,
    sources_failed: [],
    failures: [],
    notes: [],
    ...overrides
  };
}

function aggregate(per_source) {
  const r = []; const s = []; const b = []; const st = [];
  for (const ctx of Object.values(per_source)) {
    if (typeof ctx.recovery_score === 'number') r.push(ctx.recovery_score);
    if (typeof ctx.sleep_score === 'number') s.push(ctx.sleep_score);
    if (typeof ctx.body_battery === 'number') b.push(ctx.body_battery);
    if (typeof ctx.strain_score === 'number') st.push(ctx.strain_score);
  }
  const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
  return { recovery: avg(r), sleep: avg(s), bb: avg(b), strain: avg(st) };
}

// 1. classifyQuestion sanity
const intents = {
  'should i train hard today?': 'training_readiness',
  'how did i sleep?': 'sleep_quality',
  'am i overtraining?': 'stress_load',
  'what should i eat?': 'nutrition',
  'where am i in my cycle?': 'cycle_phase',
  'how is my glucose?': 'glucose',
  'whats the aqi today?': 'environment',
  'how am i doing today?': 'daily_overview'
};
for (const [question, expected] of Object.entries(intents)) {
  const got = classifyQuestion(question);
  assert.equal(got, expected, `classifyQuestion(${question}) => ${got}, expected ${expected}`);
}

// 2. Each heuristic rule we can deterministically trigger
const fireMap = new Map();

function record(rule_id, syn) {
  fireMap.set(rule_id, (fireMap.get(rule_id) ?? 0) + 1);
  assert.ok(syn.reasoning.includes(rule_id), `rule ${rule_id} should appear in reasoning: ${syn.reasoning}`);
}

// rec_low
let syn = synthesize('should i train today?', comp({ whoop: { recovery_score: 35 } }));
record('rec_low', syn);
assert.ok(syn.recommendation.toLowerCase().includes('easy') || syn.recommendation.toLowerCase().includes('limited'));

// rec_mid
syn = synthesize('should i train today?', comp({ whoop: { recovery_score: 60 } }));
record('rec_mid', syn);

// rec_high
syn = synthesize('should i train today?', comp({ whoop: { recovery_score: 85, sleep_score: 85 } }));
record('rec_high', syn);
record('sleep_good', syn);

// bb_low
syn = synthesize('how am i feeling?', comp({ garmin: { body_battery: 18 } }));
record('bb_low', syn);

// bb_high
syn = synthesize('how am i doing?', comp({ garmin: { body_battery: 78 } }));
record('bb_high', syn);

// sleep_poor
syn = synthesize('how did i sleep?', comp({ oura: { sleep_score: 50 } }));
record('sleep_poor', syn);

// strain_high
syn = synthesize('should i taper?', comp({ whoop: { strain_score: 19 } }));
record('strain_high', syn);

// cycle_luteal
syn = synthesize('cycle phase?', comp({ cycle_coach: { cycle_phase: 'luteal' } }, { cycle_phase: 'luteal' }));
record('cycle_luteal', syn);

// cycle_follicular
syn = synthesize('cycle phase?', comp({ cycle_coach: { cycle_phase: 'follicular' } }, { cycle_phase: 'follicular' }));
record('cycle_follicular', syn);

// load_high
syn = synthesize('am i overtraining?', comp({ whoop: { recent_training_load: 'high' } }, { recent_training_load: 'high' }));
record('load_high', syn);

// load_low
syn = synthesize('how am i?', comp({ whoop: { recent_training_load: 'low' } }, { recent_training_load: 'low' }));
record('load_low', syn);

// no_data
syn = synthesize('train today?', comp({}));
record('no_data', syn);
assert.equal(syn.confidence, 'low');

// conflict (recovery 80 vs body battery 20)
syn = synthesize('train today?', comp({ whoop: { recovery_score: 80 }, garmin: { body_battery: 20 } }));
record('conflict', syn);
assert.equal(syn.confidence, 'low');

// 3. Confidence levels
// 1 source => low
syn = synthesize('train?', comp({ whoop: { recovery_score: 70 } }));
assert.equal(syn.confidence, 'low');
// 2 sources non-conflicting => medium
syn = synthesize('train?', comp({ whoop: { recovery_score: 70 }, oura: { sleep_score: 80 } }));
assert.equal(syn.confidence, 'medium');
// 3 sources non-conflicting => high
syn = synthesize('train?', comp({
  whoop: { recovery_score: 70 },
  oura: { sleep_score: 80 },
  garmin: { body_battery: 65 }
}));
assert.equal(syn.confidence, 'high');

// 4. Daily brief markdown smoke test
const brief = buildDailyBriefMarkdown(comp({
  whoop: { recovery_score: 70 },
  oura: { sleep_score: 80 },
  garmin: { body_battery: 60 }
}));
assert.ok(brief.brief_markdown.includes('Recovery'));
assert.ok(brief.highlights.includes('recovery=70'));

const rules_covered = fireMap.size;
const total_rules = HEURISTIC_RULES.length;
assert.ok(rules_covered >= total_rules - 0, `covered ${rules_covered}/${total_rules} heuristic rules`);

console.log(JSON.stringify({
  ok: true,
  intents_covered: Object.keys(intents).length,
  heuristic_rules_covered: rules_covered,
  total_heuristic_rules: total_rules,
  fire_counts: Object.fromEntries(fireMap)
}, null, 2));
