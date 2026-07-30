import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
  'living_body_agent_manifest',
  'living_body_connection_status',
  'living_body_data_inventory',
  'living_body_status',
  'living_body_ask',
  'living_body_daily_brief',
  'living_body_compose_context',
  'living_body_health_check',
  'living_body_capabilities'
];

const home = mkdtempSync(join(tmpdir(), 'living-body-smoke-'));
const client = new Client({ name: 'living-body-smoke', version: '0.0.0' });
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: {
    ...process.env,
    HOME: home,
    DELX_LIVING_BODY_NO_CACHE: 'true'
  }
});
await client.connect(transport);
try {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, expectedTools.sort(), `tool surface mismatch: got ${toolNames.join(',')}`);

  const status = await client.callTool({ name: 'living_body_status', arguments: { response_format: 'json' } });
  assert.equal(typeof status.structuredContent?.total_known, 'number');
  assert.equal(status.structuredContent?.total_known, 15);
  // cycle_coach is stateless => detected even on empty $HOME
  const detectedIds = status.structuredContent.detected.map((d) => d.id);
  assert.ok(detectedIds.includes('cycle_coach'), 'cycle_coach (stateless) should always be detected');

  const caps = await client.callTool({ name: 'living_body_capabilities', arguments: { response_format: 'json' } });
  assert.equal(caps.structuredContent?.unofficial, true);
  assert.equal(caps.structuredContent?.tools?.length, 9);
  assert.equal(caps.structuredContent?.per_connector_availability_matrix?.length, 15);
  const flow = caps.structuredContent?.recommended_agent_flow ?? [];
  assert.ok(flow.some((step) => step.includes('living_body_status') || step.includes('living_body_agent_manifest')));

  const manifest = await client.callTool({ name: 'living_body_agent_manifest', arguments: { response_format: 'json' } });
  assert.ok(Array.isArray(manifest.structuredContent?.recommended_first_calls));
  assert.ok(manifest.structuredContent?.recommended_first_calls.includes('living_body_agent_manifest'));

  const conn = await client.callTool({ name: 'living_body_connection_status', arguments: { response_format: 'json' } });
  assert.equal(typeof conn.structuredContent?.ok, 'boolean');
  assert.equal(typeof conn.structuredContent?.total_installed, 'number');

  const inv = await client.callTool({ name: 'living_body_data_inventory', arguments: { response_format: 'json' } });
  assert.equal(inv.structuredContent?.kind, 'data_inventory');
  assert.ok(inv.structuredContent?.domains?.length >= 1);

  const resources = await client.listResources();
  assert.ok(resources.resources?.length >= 3, 'expected agent-facing resources');

  const hc = await client.callTool({ name: 'living_body_health_check', arguments: { response_format: 'json' } });
  assert.equal(hc.structuredContent?.total_known, 15);
  assert.ok(hc.structuredContent?.connectors?.some((c) => c.install_hint?.startsWith('npx -y ')), 'missing connectors should expose install_hint');

  // compose_context with no children installed => empty per_source, unknown training load
  const ctx = await client.callTool({ name: 'living_body_compose_context', arguments: { response_format: 'json' } });
  assert.equal(ctx.structuredContent?.context_contract_version, 'delx-wellness-context/v1');
  assert.equal(ctx.structuredContent?.recent_training_load, 'unknown');

  // ask: explicit_user_intent is required + question goes through synthesizer
  const ask = await client.callTool({
    name: 'living_body_ask',
    arguments: {
      question: 'Should I train hard today?',
      explicit_user_intent: true,
      response_format: 'json'
    }
  });
  assert.equal(typeof ask.structuredContent?.recommendation, 'string');
  assert.ok(['low', 'medium', 'high'].includes(ask.structuredContent.confidence));
  assert.ok(ask.structuredContent?.reasoning?.includes('Intent classified'));

  console.log(JSON.stringify({ ok: true, tools: toolNames.length, connectors: 15 }, null, 2));
} finally {
  await client.close();
}
