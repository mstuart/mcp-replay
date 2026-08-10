import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { McpReplay } from "../src/replay.js";
import type { McpRequest, McpResponse } from "../src/types.js";

const makeResponse = (text: string): McpResponse => ({
  id: 1,
  jsonrpc: "2.0",
  result: { content: [{ text, type: "text" }] },
});

const NO_FIXTURE_PATTERN = /no fixture found/;

describe("McpReplay", () => {
  let fixtureDir: string;
  let replay: McpReplay;

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), "mcp-replay-test-"));
    replay = new McpReplay({ fallback: "fail-fast", fixtureDir });
  });

  it("intercept returns fixture when found", async () => {
    replay.addFixture(
      "tools/call",
      { arguments: { city: "London" }, name: "get_weather" },
      makeResponse("15C")
    );

    const request: McpRequest = {
      id: 42,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { city: "London" }, name: "get_weather" },
    };

    const response = await replay.intercept(request);
    assert.equal(response.id, 42);
    assert.deepEqual(response.result, {
      content: [{ text: "15C", type: "text" }],
    });
  });

  it("intercept throws when not found in fail-fast mode", async () => {
    const request: McpRequest = {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "nonexistent" },
    };

    await assert.rejects(() => replay.intercept(request), {
      message: NO_FIXTURE_PATTERN,
    });
  });

  it("addFixture then intercept works", async () => {
    replay.addFixture("tools/list", undefined, {
      id: 1,
      jsonrpc: "2.0",
      result: { tools: [{ description: "bar", inputSchema: {}, name: "foo" }] },
    });

    const response = await replay.intercept({
      id: 5,
      jsonrpc: "2.0",
      method: "tools/list",
    });

    assert.equal(response.id, 5);
    const result = response.result as { tools: Array<{ name: string }> };
    assert.equal(result.tools[0].name, "foo");
  });

  it("start loads fixtures from disk, stop saves them", async () => {
    // Add fixture and stop (saves to disk)
    replay.addFixture("tools/call", { name: "test" }, makeResponse("saved"));
    await replay.stop();

    // New replay instance, start (loads from disk)
    const replay2 = new McpReplay({ fixtureDir });
    await replay2.start();

    const response = await replay2.intercept({
      id: 10,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "test" },
    });

    assert.deepEqual(response.result, {
      content: [{ text: "saved", type: "text" }],
    });

    await rm(fixtureDir, { force: true, recursive: true });
  });
});

describe("McpReplayClient", () => {
  it("callTool routes through intercept", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "mcp-replay-client-"));
    const replay = new McpReplay({ fixtureDir });

    replay.addFixture(
      "tools/call",
      { arguments: { city: "London" }, name: "get_weather" },
      {
        id: 1,
        jsonrpc: "2.0",
        result: { content: [{ text: "15C, partly cloudy", type: "text" }] },
      }
    );

    const client = replay.getClient();
    const result = await client.callTool("get_weather", { city: "London" });

    assert.equal(result.content[0].text, "15C, partly cloudy");
    await rm(fixtureDir, { force: true, recursive: true });
  });

  it("listTools routes through intercept", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "mcp-replay-client-"));
    const replay = new McpReplay({ fixtureDir });

    replay.addFixture("tools/list", undefined, {
      id: 1,
      jsonrpc: "2.0",
      result: {
        tools: [
          {
            description: "Get weather",
            inputSchema: { type: "object" },
            name: "get_weather",
          },
        ],
      },
    });

    const client = replay.getClient();
    const result = await client.listTools();

    assert.equal(result.tools.length, 1);
    assert.equal(result.tools[0].name, "get_weather");
    await rm(fixtureDir, { force: true, recursive: true });
  });
});

describe("scrubFields integration", () => {
  it("removes specified fields from params before hashing", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "mcp-replay-scrub-"));
    const replay = new McpReplay({
      fixtureDir,
      scrubFields: ["Authorization"],
    });

    replay.addFixture(
      "tools/call",
      { Authorization: "Bearer abc123", arguments: { q: "test" }, name: "api" },
      makeResponse("result")
    );

    // Request with different Authorization value should still match
    const response = await replay.intercept({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        Authorization: "Bearer different",
        arguments: { q: "test" },
        name: "api",
      },
    });

    assert.deepEqual(response.result, {
      content: [{ text: "result", type: "text" }],
    });
    await rm(fixtureDir, { force: true, recursive: true });
  });
});
