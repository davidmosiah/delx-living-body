
import assert from 'node:assert/strict';
import { resolveConnectorTool } from '../dist/services/composer.js';

const garmin = {
  context_tool: 'garmin_wellness_context',
  daily_summary_tool: 'garmin_daily_summary',
  series_tool: 'garmin_activity_series'
};
assert.equal(resolveConnectorTool(garmin, { tool: 'series' }), 'garmin_activity_series');
assert.equal(resolveConnectorTool(garmin, { tool: 'daily_summary' }), 'garmin_daily_summary');
assert.equal(resolveConnectorTool(garmin, { tool: 'context' }), 'garmin_wellness_context');
const bare = { context_tool: 'x_context', daily_summary_tool: null, series_tool: null };
assert.equal(resolveConnectorTool(bare, { tool: 'series' }), 'x_context');
console.log(JSON.stringify({ ok: true, suite: 'series-tool-preference' }));
