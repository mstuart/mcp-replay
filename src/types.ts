export interface McpRequest {
  id: number | string;
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  error?: { code: number; message: string; data?: unknown };
  id: number | string;
  jsonrpc: "2.0";
  result?: unknown;
}

export interface Fixture {
  method: string;
  params?: Record<string, unknown>;
  paramsHash: string;
  recordedAt: string;
  response: McpResponse;
}

export interface IFixtureStore {
  clear: () => void;
  get: (
    method: string,
    params?: Record<string, unknown>
  ) => Fixture | undefined;
  load: (path: string) => Promise<void>;
  save: (path: string) => Promise<void>;
  set: (
    method: string,
    params: Record<string, unknown> | undefined,
    response: McpResponse
  ) => void;
}

export interface ReplayOptions {
  fallback?: "fail-fast" | "pass-through";
  fixtureDir: string;
  scrubFields?: string[];
  strategy?: "exact" | "match-by-hash";
}

export interface McpReplayClient {
  callTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  listTools: () => Promise<{
    tools: Array<{ name: string; description: string; inputSchema: object }>;
  }>;
}
