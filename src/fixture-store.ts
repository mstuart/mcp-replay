import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hashRequest, scrub } from './hash.js';
import type { Fixture, IFixtureStore, McpResponse } from './types.js';

export class FixtureStore implements IFixtureStore {
  private fixtures = new Map<string, Fixture>();
  private scrubFields: string[];

  constructor(scrubFields: string[] = []) {
    this.scrubFields = scrubFields;
  }

  private key(method: string, params?: Record<string, unknown>): string {
    return hashRequest(method, params, this.scrubFields);
  }

  get(method: string, params?: Record<string, unknown>): Fixture | undefined {
    return this.fixtures.get(this.key(method, params));
  }

  set(method: string, params: Record<string, unknown> | undefined, response: McpResponse): void {
    const paramsHash = this.key(method, params);
    let storedParams = params;
    if (storedParams && this.scrubFields.length > 0) {
      storedParams = scrub(storedParams, this.scrubFields) as Record<string, unknown>;
    }
    const fixture: Fixture = {
      method,
      paramsHash,
      params: storedParams,
      response,
      recordedAt: new Date().toISOString(),
    };
    this.fixtures.set(paramsHash, fixture);
  }

  async save(dirPath: string): Promise<void> {
    for (const fixture of this.fixtures.values()) {
      const methodDir = join(dirPath, fixture.method.replace(/\//g, '_'));
      await mkdir(methodDir, { recursive: true });
      const filePath = join(methodDir, `${fixture.paramsHash}.json`);
      await writeFile(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
    }
  }

  async load(dirPath: string): Promise<void> {
    let methodDirs: string[];
    try {
      methodDirs = await readdir(dirPath);
    } catch {
      return; // directory doesn't exist yet, nothing to load
    }

    for (const methodDir of methodDirs) {
      const fullMethodDir = join(dirPath, methodDir);
      let files: string[];
      try {
        files = await readdir(fullMethodDir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await readFile(join(fullMethodDir, file), 'utf-8');
        const fixture: Fixture = JSON.parse(content);
        this.fixtures.set(fixture.paramsHash, fixture);
      }
    }
  }

  clear(): void {
    this.fixtures.clear();
  }
}
