import { FixtureStore } from './fixture-store.js';
import type { McpRequest, McpResponse, McpReplayClient, ReplayOptions } from './types.js';

export class McpReplay {
  private store: FixtureStore;
  private opts: Required<ReplayOptions>;
  private started = false;

  constructor(opts: ReplayOptions) {
    this.opts = {
      fixtureDir: opts.fixtureDir,
      strategy: opts.strategy ?? 'match-by-hash',
      fallback: opts.fallback ?? 'fail-fast',
      scrubFields: opts.scrubFields ?? [],
    };
    this.store = new FixtureStore(this.opts.scrubFields);
  }

  async start(): Promise<void> {
    await this.store.load(this.opts.fixtureDir);
    this.started = true;
  }

  async stop(): Promise<void> {
    await this.store.save(this.opts.fixtureDir);
    this.started = false;
  }

  async intercept(request: McpRequest): Promise<McpResponse> {
    const fixture = this.store.get(request.method, request.params);

    if (fixture) {
      return { ...fixture.response, id: request.id };
    }

    if (this.opts.fallback === 'fail-fast') {
      throw new Error(
        `McpReplay: no fixture found for method="${request.method}" params=${JSON.stringify(request.params)}`
      );
    }

    throw new Error(
      `McpReplay: no fixture found and pass-through is not implemented (method="${request.method}")`
    );
  }

  addFixture(method: string, params: Record<string, unknown> | undefined, response: McpResponse): void {
    this.store.set(method, params, response);
  }

  getClient(): McpReplayClient {
    return {
      callTool: async (name: string, args: Record<string, unknown>) => {
        const request: McpRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        };
        const response = await this.intercept(request);
        return response.result as { content: Array<{ type: string; text?: string }> };
      },

      listTools: async () => {
        const request: McpRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        };
        const response = await this.intercept(request);
        return response.result as { tools: Array<{ name: string; description: string; inputSchema: object }> };
      },
    };
  }
}
