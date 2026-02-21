import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { McpReplay } from '../src/replay.js';
import type { McpRequest, McpResponse } from '../src/types.js';

const makeResponse = (text: string): McpResponse => ({
  jsonrpc: '2.0',
  id: 1,
  result: { content: [{ type: 'text', text }] },
});

describe('McpReplay', () => {
  let fixtureDir: string;
  let replay: McpReplay;

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'mcp-replay-test-'));
    replay = new McpReplay({ fixtureDir, fallback: 'fail-fast' });
  });

  it('intercept returns fixture when found', async () => {
    replay.addFixture('tools/call', { name: 'get_weather', arguments: { city: 'London' } }, makeResponse('15C'));

    const request: McpRequest = {
      jsonrpc: '2.0',
      id: 42,
      method: 'tools/call',
      params: { name: 'get_weather', arguments: { city: 'London' } },
    };

    const response = await replay.intercept(request);
    assert.equal(response.id, 42);
    assert.deepEqual(response.result, { content: [{ type: 'text', text: '15C' }] });
  });

  it('intercept throws when not found in fail-fast mode', async () => {
    const request: McpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'nonexistent' },
    };

    await assert.rejects(() => replay.intercept(request), {
      message: /no fixture found/,
    });
  });

  it('addFixture then intercept works', async () => {
    replay.addFixture('tools/list', undefined, {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 'foo', description: 'bar', inputSchema: {} }] },
    });

    const response = await replay.intercept({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/list',
    });

    assert.equal(response.id, 5);
    const result = response.result as { tools: Array<{ name: string }> };
    assert.equal(result.tools[0].name, 'foo');
  });

  it('start loads fixtures from disk, stop saves them', async () => {
    // Add fixture and stop (saves to disk)
    replay.addFixture('tools/call', { name: 'test' }, makeResponse('saved'));
    await replay.stop();

    // New replay instance, start (loads from disk)
    const replay2 = new McpReplay({ fixtureDir });
    await replay2.start();

    const response = await replay2.intercept({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'test' },
    });

    assert.deepEqual(response.result, { content: [{ type: 'text', text: 'saved' }] });

    await rm(fixtureDir, { recursive: true, force: true });
  });
});

describe('McpReplayClient', () => {
  it('callTool routes through intercept', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'mcp-replay-client-'));
    const replay = new McpReplay({ fixtureDir });

    replay.addFixture('tools/call', { name: 'get_weather', arguments: { city: 'London' } }, {
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: '15C, partly cloudy' }] },
    });

    const client = replay.getClient();
    const result = await client.callTool('get_weather', { city: 'London' });

    assert.equal(result.content[0].text, '15C, partly cloudy');
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('listTools routes through intercept', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'mcp-replay-client-'));
    const replay = new McpReplay({ fixtureDir });

    replay.addFixture('tools/list', undefined, {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 'get_weather', description: 'Get weather', inputSchema: { type: 'object' } }] },
    });

    const client = replay.getClient();
    const result = await client.listTools();

    assert.equal(result.tools.length, 1);
    assert.equal(result.tools[0].name, 'get_weather');
    await rm(fixtureDir, { recursive: true, force: true });
  });
});

describe('scrubFields integration', () => {
  it('removes specified fields from params before hashing', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'mcp-replay-scrub-'));
    const replay = new McpReplay({ fixtureDir, scrubFields: ['Authorization'] });

    replay.addFixture(
      'tools/call',
      { name: 'api', Authorization: 'Bearer abc123', arguments: { q: 'test' } },
      makeResponse('result')
    );

    // Request with different Authorization value should still match
    const response = await replay.intercept({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'api', Authorization: 'Bearer different', arguments: { q: 'test' } },
    });

    assert.deepEqual(response.result, { content: [{ type: 'text', text: 'result' }] });
    await rm(fixtureDir, { recursive: true, force: true });
  });
});
