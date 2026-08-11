import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FixtureStore, hashRequest, McpReplay, scrub } from "../src/index.js";

describe("public API smoke", () => {
  it("exports the library API from the package entrypoint", () => {
    assert.equal(typeof McpReplay, "function");
    assert.equal(typeof FixtureStore, "function");
    assert.equal(typeof hashRequest, "function");
    assert.equal(typeof scrub, "function");
  });

  it("constructs a replay client from the public entrypoint", async () => {
    const replay = new McpReplay({ fixtureDir: "unused" });
    replay.addFixture("tools/list", undefined, {
      id: 1,
      jsonrpc: "2.0",
      result: {
        tools: [{ description: "Smoke test", inputSchema: {}, name: "smoke" }],
      },
    });

    const { tools } = await replay.getClient().listTools();

    assert.equal(tools[0].name, "smoke");
  });
});
