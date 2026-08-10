import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashRequest, scrub } from "./hash.js";
import type { Fixture, IFixtureStore, McpResponse } from "./types.js";

export class FixtureStore implements IFixtureStore {
  private readonly fixtures = new Map<string, Fixture>();
  private readonly scrubFields: string[];

  constructor(scrubFields: string[] = []) {
    this.scrubFields = scrubFields;
  }

  private key(method: string, params?: Record<string, unknown>): string {
    return hashRequest(method, params, this.scrubFields);
  }

  get(method: string, params?: Record<string, unknown>): Fixture | undefined {
    return this.fixtures.get(this.key(method, params));
  }

  set(
    method: string,
    params: Record<string, unknown> | undefined,
    response: McpResponse
  ): void {
    const paramsHash = this.key(method, params);
    let storedParams = params;
    if (storedParams && this.scrubFields.length > 0) {
      storedParams = scrub(storedParams, this.scrubFields) as Record<
        string,
        unknown
      >;
    }
    const fixture: Fixture = {
      method,
      params: storedParams,
      paramsHash,
      recordedAt: new Date().toISOString(),
      response,
    };
    this.fixtures.set(paramsHash, fixture);
  }

  async save(dirPath: string): Promise<void> {
    await Promise.all(
      Array.from(this.fixtures.values(), async (fixture) => {
        const methodDir = join(dirPath, fixture.method.replace(/\//g, "_"));
        await mkdir(methodDir, { recursive: true });
        const filePath = join(methodDir, `${fixture.paramsHash}.json`);
        await writeFile(filePath, JSON.stringify(fixture, null, 2), "utf-8");
      })
    );
  }

  async load(dirPath: string): Promise<void> {
    let methodDirs: string[];
    try {
      methodDirs = await readdir(dirPath);
    } catch {
      return; // directory doesn't exist yet, nothing to load
    }

    const fixtureGroups = await Promise.all(
      methodDirs.map(async (methodDir): Promise<Fixture[]> => {
        const fullMethodDir = join(dirPath, methodDir);
        let files: string[];
        try {
          files = await readdir(fullMethodDir);
        } catch {
          return [];
        }
        return Promise.all(
          files
            .filter((file) => file.endsWith(".json"))
            .map(async (file): Promise<Fixture> => {
              const content = await readFile(
                join(fullMethodDir, file),
                "utf-8"
              );
              return JSON.parse(content) as Fixture;
            })
        );
      })
    );
    for (const fixture of fixtureGroups.flat()) {
      this.fixtures.set(fixture.paramsHash, fixture);
    }
  }

  clear(): void {
    this.fixtures.clear();
  }
}
