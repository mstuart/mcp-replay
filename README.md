# mcp-replay

Record and replay [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server interactions for deterministic CI testing -- the **nock/msw equivalent for MCP**.

MCP is a JSON-RPC 2.0 protocol that lets AI models call tools and read resources from external servers.

## The problem

Testing code that calls MCP servers is painful:

- Live servers are slow, flaky, and cost money
- Mocking JSON-RPC by hand is tedious and error-prone
- Tests that depend on external services break in CI

**mcp-replay** lets you record real MCP responses to fixture files, then replay them in tests without a live server. Deterministic, fast, zero network calls.

## Install

```bash
npm install mcp-replay --save-dev
```

Zero runtime dependencies -- uses only Node.js built-in `crypto` and `fs`.

## Quick start

```typescript
import { McpReplay } from 'mcp-replay';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('weather tool', () => {
  const replay = new McpReplay({
    fixtureDir: './fixtures',
    fallback: 'fail-fast',
  });

  before(async () => {
    // Load fixtures from disk
    await replay.start();

    // Or add fixtures manually
    replay.addFixture('tools/call', { name: 'get_weather', arguments: { city: 'London' } }, {
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: '15C, partly cloudy' }] },
    });
  });

  after(async () => {
    // Save any new fixtures to disk
    await replay.stop();
  });

  it('returns weather data', async () => {
    const client = replay.getClient();
    const result = await client.callTool('get_weather', { city: 'London' });
    assert.equal(result.content[0].text, '15C, partly cloudy');
  });
});
```

## McpReplayClient

`replay.getClient()` returns a lightweight client that routes calls through the replay instance:

```typescript
const client = replay.getClient();

// Call a tool
const result = await client.callTool('get_weather', { city: 'London' });
console.log(result.content[0].text); // "15C, partly cloudy"

// List tools
const { tools } = await client.listTools();
console.log(tools.map(t => t.name));
```

## Recording fixtures

### Option 1: Add fixtures in test setup

```typescript
replay.addFixture('tools/call', { name: 'my_tool', arguments: { key: 'value' } }, {
  jsonrpc: '2.0',
  id: 1,
  result: { content: [{ type: 'text', text: 'response data' }] },
});
```

### Option 2: Pre-populate fixture files

Create JSON files in your fixture directory:

```
fixtures/
  tools_call/
    <sha256-hash>.json
  tools_list/
    <sha256-hash>.json
```

Each fixture file:

```json
{
  "method": "tools/call",
  "paramsHash": "abc123...",
  "params": { "name": "get_weather", "arguments": { "city": "London" } },
  "response": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": { "content": [{ "type": "text", "text": "15C, partly cloudy" }] }
  },
  "recordedAt": "2025-01-15T10:30:00.000Z"
}
```

The hash is computed from `SHA-256(JSON.stringify({ method, params }))`. You can use the exported `hashRequest` function to compute it:

```typescript
import { hashRequest } from 'mcp-replay';
const hash = hashRequest('tools/call', { name: 'get_weather', arguments: { city: 'London' } });
```

## Scrubbing secrets

Use `scrubFields` to strip sensitive fields from params before hashing and before saving to fixtures. This ensures that different API keys produce the same fixture match:

```typescript
const replay = new McpReplay({
  fixtureDir: './fixtures',
  scrubFields: ['Authorization', 'apiKey', 'token'],
});

// These two calls will match the same fixture:
// { name: 'api', Authorization: 'Bearer abc', arguments: { q: 'test' } }
// { name: 'api', Authorization: 'Bearer xyz', arguments: { q: 'test' } }
```

Fields are removed recursively from all nested objects and arrays.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fixtureDir` | `string` | (required) | Directory for fixture files |
| `strategy` | `'exact' \| 'match-by-hash'` | `'match-by-hash'` | Matching strategy |
| `fallback` | `'fail-fast' \| 'pass-through'` | `'fail-fast'` | What to do on cache miss |
| `scrubFields` | `string[]` | `[]` | Field names to remove before hashing |

## API

### `McpReplay`

- `new McpReplay(opts: ReplayOptions)` -- create an instance
- `start(): Promise<void>` -- load fixtures from disk
- `stop(): Promise<void>` -- save fixtures to disk
- `intercept(request: McpRequest): Promise<McpResponse>` -- match a request to a fixture
- `addFixture(method, params, response): void` -- add a fixture programmatically
- `getClient(): McpReplayClient` -- get a client that routes through this instance

### `FixtureStore`

- `get(method, params): Fixture | undefined`
- `set(method, params, response): void`
- `save(path): Promise<void>`
- `load(path): Promise<void>`
- `clear(): void`

### `hashRequest(method, params?, scrubFields?): string`

Compute the SHA-256 hash used for fixture matching.

### `scrub(obj, fields): unknown`

Recursively remove fields from an object.

## License

MIT
