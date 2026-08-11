import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const packDir = await mkdtemp(join(tmpdir(), "mcp-replay-pack-"));
const consumerDir = await mkdtemp(join(tmpdir(), "mcp-replay-consumer-"));

try {
  const packJson = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", packDir],
    {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "inherit"],
    }
  );
  const [pack] = JSON.parse(packJson);
  const tarball = join(packDir, pack.filename);
  const files = pack.files.map((file) => file.path).sort();

  assert(files.includes("dist/src/index.js"));
  assert(files.includes("dist/src/index.d.ts"));
  assert(files.includes("README.md"));
  assert(files.includes("LICENSE"));
  assert(files.includes("CHANGELOG.md"));
  assert(
    !files.some((file) => file.startsWith("src/")),
    "source files must not be packed"
  );
  assert(
    !files.some((file) => file.startsWith("tests/")),
    "tests must not be packed"
  );
  assert(
    !files.some((file) => file.startsWith(".github/")),
    "workflows must not be packed"
  );

  await writeFile(
    join(consumerDir, "package.json"),
    '{"type":"module","private":true}\n'
  );
  execFileSync("npm", ["install", "--silent", tarball], {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const smoke = `
    import assert from 'node:assert/strict';
    import { McpReplay, FixtureStore, hashRequest, scrub } from 'mcp-replay';
    assert.equal(typeof McpReplay, 'function');
    assert.equal(typeof FixtureStore, 'function');
    assert.equal(typeof hashRequest, 'function');
    assert.deepEqual(scrub({ token: 'secret', keep: true }, ['token']), { keep: true });
    const replay = new McpReplay({ fixtureDir: 'unused' });
    replay.addFixture('tools/list', undefined, {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 'pack-smoke', description: 'Package smoke', inputSchema: {} }] },
    });
    const result = await replay.getClient().listTools();
    assert.equal(result.tools[0].name, 'pack-smoke');
  `;
  execFileSync("node", ["--input-type=module", "--eval", smoke], {
    cwd: consumerDir,
    stdio: "inherit",
  });

  console.log(`package smoke passed: ${pack.filename}`);
} finally {
  await rm(packDir, { force: true, recursive: true });
  await rm(consumerDir, { force: true, recursive: true });
}
