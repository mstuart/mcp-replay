import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FixtureStore } from '../src/fixture-store.js';
import type { McpResponse } from '../src/types.js';

const makeResponse = (text: string): McpResponse => ({
  jsonrpc: '2.0',
  id: 1,
  result: { content: [{ type: 'text', text }] },
});

describe('FixtureStore', () => {
  let store: FixtureStore;

  beforeEach(() => {
    store = new FixtureStore();
  });

  it('set and get a fixture', () => {
    const params = { name: 'get_weather', arguments: { city: 'London' } };
    const response = makeResponse('15C');
    store.set('tools/call', params, response);

    const fixture = store.get('tools/call', params);
    assert.ok(fixture);
    assert.equal(fixture.method, 'tools/call');
    assert.deepEqual(fixture.response.result, response.result);
  });

  it('returns undefined for unknown method/params', () => {
    const fixture = store.get('tools/call', { name: 'nonexistent' });
    assert.equal(fixture, undefined);
  });

  it('save writes JSON to disk and load reads it back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-replay-test-'));
    try {
      const params = { name: 'get_weather', arguments: { city: 'London' } };
      const response = makeResponse('15C');
      store.set('tools/call', params, response);
      await store.save(dir);

      const store2 = new FixtureStore();
      await store2.load(dir);

      const fixture = store2.get('tools/call', params);
      assert.ok(fixture);
      assert.equal(fixture.method, 'tools/call');
      assert.deepEqual(fixture.response.result, response.result);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('load handles nonexistent directory gracefully', async () => {
    await store.load('/nonexistent/path/that/does/not/exist');
    // should not throw
  });

  it('clear removes all fixtures', () => {
    store.set('tools/call', { name: 'a' }, makeResponse('x'));
    store.set('tools/list', undefined, makeResponse('y'));
    assert.ok(store.get('tools/call', { name: 'a' }));

    store.clear();
    assert.equal(store.get('tools/call', { name: 'a' }), undefined);
    assert.equal(store.get('tools/list', undefined), undefined);
  });

  it('scrubFields removes fields from stored params', () => {
    const scrubStore = new FixtureStore(['apiKey']);
    const params = { name: 'foo', apiKey: 'secret123' };
    scrubStore.set('tools/call', params, makeResponse('ok'));

    const fixture = scrubStore.get('tools/call', params);
    assert.ok(fixture);
    assert.equal((fixture.params as Record<string, unknown>)['apiKey'], undefined);
    assert.equal((fixture.params as Record<string, unknown>)['name'], 'foo');
  });
});
