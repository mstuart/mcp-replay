import { FixtureStore } from "./fixture-store.js";
import type {
  McpReplayClient,
  McpRequest,
  McpResponse,
  ReplayOptions,
} from "./types.js";

export class McpReplay {
  private readonly store: FixtureStore;
  private readonly opts: Required<ReplayOptions>;

  constructor(opts: ReplayOptions) {
    this.opts = {
      fallback: opts.fallback ?? "fail-fast",
      fixtureDir: opts.fixtureDir,
      scrubFields: opts.scrubFields ?? [],
      strategy: opts.strategy ?? "match-by-hash",
    };
    this.store = new FixtureStore(this.opts.scrubFields);
  }

  async start(): Promise<void> {
    await this.store.load(this.opts.fixtureDir);
  }

  async stop(): Promise<void> {
    await this.store.save(this.opts.fixtureDir);
  }

  intercept(request: McpRequest): Promise<McpResponse> {
    const fixture = this.store.get(request.method, request.params);

    if (fixture) {
      return Promise.resolve({ ...fixture.response, id: request.id });
    }

    if (this.opts.fallback === "fail-fast") {
      return Promise.reject(
        new Error(
          `McpReplay: no fixture found for method="${request.method}" params=${JSON.stringify(request.params)}`
        )
      );
    }

    return Promise.reject(
      new Error(
        `McpReplay: no fixture found and pass-through is not implemented (method="${request.method}")`
      )
    );
  }

  addFixture(
    method: string,
    params: Record<string, unknown> | undefined,
    response: McpResponse
  ): void {
    this.store.set(method, params, response);
  }

  getClient(): McpReplayClient {
    return {
      callTool: async (name: string, args: Record<string, unknown>) => {
        const request: McpRequest = {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: args, name },
        };
        const response = await this.intercept(request);
        return response.result as {
          content: Array<{ type: string; text?: string }>;
        };
      },

      listTools: async () => {
        const request: McpRequest = {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
        };
        const response = await this.intercept(request);
        return response.result as {
          tools: Array<{
            name: string;
            description: string;
            inputSchema: object;
          }>;
        };
      },
    };
  }
}
