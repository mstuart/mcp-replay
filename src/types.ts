export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface Fixture {
  method: string;
  paramsHash: string;
  params?: Record<string, unknown>;
  response: McpResponse;
  recordedAt: string;
}

export interface IFixtureStore {
  get(method: string, params?: Record<string, unknown>): Fixture | undefined;
  set(method: string, params: Record<string, unknown> | undefined, response: McpResponse): void;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
  clear(): void;
}

export interface ReplayOptions {
  fixtureDir: string;
  strategy?: 'exact' | 'match-by-hash';
  fallback?: 'fail-fast' | 'pass-through';
  scrubFields?: string[];
}

export interface McpReplayClient {
  callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }>;
  listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }>;
}
