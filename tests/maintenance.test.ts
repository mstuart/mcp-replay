import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { FixtureStore } from "../src/fixture-store.js";
import { hashRequest, scrub } from "../src/hash.js";
import { McpReplay } from "../src/replay.js";

it("recordings remain isolated from caller and reader mutations", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "replay-snapshot-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const store = new FixtureStore();
  const params = { nested: { value: "original" } };
  const response = {
    id: 1,
    jsonrpc: "2.0" as const,
    result: { value: "recorded" },
  };
  store.set("tools/list", params, response);
  params.nested.value = "changed";
  response.result.value = "changed";
  const first = store.get("tools/list", { nested: { value: "original" } });
  assert.ok(first);
  assert.deepEqual(first.params, { nested: { value: "original" } });
  assert.deepEqual(first.response.result, { value: "recorded" });
  first.response.result = { value: "changed again" };
  await store.save(dir);
  const [methodDir] = await readdir(dir);
  const [file] = await readdir(join(dir, methodDir));
  const saved = JSON.parse(await readFile(join(dir, methodDir, file), "utf8"));
  assert.deepEqual(saved.response.result, { value: "recorded" });
  assert.deepEqual(saved.params, { nested: { value: "original" } });
});

it("client helpers reject recorded JSON-RPC errors with their details", async () => {
  const replay = new McpReplay({ fixtureDir: "unused" });
  const error = {
    code: -32_602,
    data: { field: "city" },
    message: "Invalid arguments",
  };
  replay.addFixture(
    "tools/call",
    { arguments: {}, name: "weather" },
    { error, id: 1, jsonrpc: "2.0" }
  );
  replay.addFixture("tools/list", undefined, { error, id: 1, jsonrpc: "2.0" });
  const client = replay.getClient();
  await assert.rejects(client.callTool("weather", {}), {
    cause: error,
    message: error.message,
  });
  await assert.rejects(client.listTools(), {
    cause: error,
    message: error.message,
  });
});

it("load reports invalid fixture roots instead of silently starting empty", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "replay-load-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const file = join(dir, "not-a-directory");
  await writeFile(file, "fixture");
  await assert.rejects(new FixtureStore().load(file), { code: "ENOTDIR" });
  await new FixtureStore().load(join(dir, "missing"));
  await new FixtureStore().load(dir); // Non-directory entries remain ignorable.
});

it("scrubbing preserves own __proto__ fields without changing prototypes", () => {
  const params = JSON.parse(
    '{"nested":{"__proto__":{"value":1},"secret":"remove"}}'
  );
  const expected = JSON.parse('{"nested":{"__proto__":{"value":1}}}');
  const actual = scrub(params, ["secret"]);
  assert.deepEqual(actual, expected);
  assert.notEqual(
    hashRequest("tools/call", params, ["secret"]),
    hashRequest("tools/call", { nested: {} }, ["secret"])
  );
  assert.equal(
    Object.getPrototypeOf((actual as typeof params).nested),
    Object.prototype
  );
});
