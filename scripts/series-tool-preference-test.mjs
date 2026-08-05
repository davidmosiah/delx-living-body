/**
 * Proves production routing selects agent-safe-series child tools.
 * Drives the real selectComposeToolForQuestion + resolveConnectorTool pair
 * used by living_body_ask / living_body_compose_context.
 */
import assert from 'node:assert/strict';
import { resolveConnectorTool } from '../dist/services/composer.js';
import { selectComposeToolForQuestion } from '../dist/services/synthesizer.js';
import { CONNECTOR_BY_ID } from '../dist/constants.js';

// 1) Question classifier routes dense shape language to series mode
assert.equal(
  selectComposeToolForQuestion('Show me the heart rate shape of my ride with max_points'),
  'series'
);
assert.equal(
  selectComposeToolForQuestion('agent-safe-series effort over time for the climb'),
  'series'
);
assert.equal(
  selectComposeToolForQuestion('How is my recovery today?'),
  'context'
);

// 2) Connector registry declares series_tool for dense vendors
assert.equal(CONNECTOR_BY_ID.garmin.series_tool, 'garmin_activity_series');
assert.equal(CONNECTOR_BY_ID.strava.series_tool, 'strava_activity_series');
assert.equal(CONNECTOR_BY_ID.fitbit.series_tool, 'fitbit_heart_series');
assert.equal(CONNECTOR_BY_ID.polar.series_tool, 'polar_heart_series');
assert.equal(CONNECTOR_BY_ID.whoop.series_tool, null);

// 3) Production resolve path: series mode → series tool name on children
const mode = selectComposeToolForQuestion('plot my workout HR series');
assert.equal(mode, 'series');
assert.equal(
  resolveConnectorTool(CONNECTOR_BY_ID.garmin, { tool: mode }),
  'garmin_activity_series'
);
assert.equal(
  resolveConnectorTool(CONNECTOR_BY_ID.polar, { tool: mode }),
  'polar_heart_series'
);
// Fallback when connector has no series_tool
assert.equal(
  resolveConnectorTool(CONNECTOR_BY_ID.whoop, { tool: mode }),
  'whoop_wellness_context'
);

// 4) Explicit compose child_tool=series matches the same resolution
assert.equal(
  resolveConnectorTool(CONNECTOR_BY_ID.strava, { tool: 'series' }),
  'strava_activity_series'
);

console.log(JSON.stringify({
  ok: true,
  suite: 'series-tool-preference',
  ask_routes_to: mode,
  garmin: resolveConnectorTool(CONNECTOR_BY_ID.garmin, { tool: mode }),
  polar: resolveConnectorTool(CONNECTOR_BY_ID.polar, { tool: mode })
}));
