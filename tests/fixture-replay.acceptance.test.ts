import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { hashRequest, McpReplay } from "../src/index.js";

describe("fixture replay acceptance", () => {
  it("loads a fixture file from disk and replays it through the client API", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "mcp-replay-acceptance-"));
    const method = "tools/call";
    const params = { arguments: { city: "London" }, name: "get_weather" };
    const paramsHash = hashRequest(method, params);
    const methodDir = join(fixtureDir, "tools_call");

    await mkdir(methodDir, { recursive: true });
    await writeFile(
      join(methodDir, `${paramsHash}.json`),
      JSON.stringify(
        {
          method,
          params,
          paramsHash,
          recordedAt: "2026-08-11T00:00:00.000Z",
          response: {
            id: 1,
            jsonrpc: "2.0",
            result: { content: [{ text: "15C, partly cloudy", type: "text" }] },
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    try {
      const replay = new McpReplay({ fixtureDir });
      await replay.start();

      const result = await replay
        .getClient()
        .callTool("get_weather", { city: "London" });

      assert.deepEqual(result, {
        content: [{ text: "15C, partly cloudy", type: "text" }],
      });
    } finally {
      await rm(fixtureDir, { force: true, recursive: true });
    }
  });
});
