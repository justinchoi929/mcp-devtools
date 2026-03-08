import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─── MCP Server Connection ───

export interface ServerConfig {
  /** Shell command to start the server, e.g. "node ./my-server.js" */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

// ─── Token Analysis ───

export interface ToolTokenInfo {
  name: string;
  description: string;
  tokens: number;
  /** Breakdown: tokens consumed by name, description, schema respectively */
  breakdown: {
    name: number;
    description: number;
    schema: number;
  };
  warnings: TokenWarning[];
}

export type TokenWarning =
  | { type: 'description_too_long'; tokens: number; threshold: number }
  | { type: 'missing_param_description'; params: string[] }
  | { type: 'duplicate_schema'; duplicateOf: string };

export interface AnalysisResult {
  serverCommand: string;
  totalTools: number;
  totalTokens: number;
  contextWindowSize: number;
  contextUsagePercent: number;
  tools: ToolTokenInfo[];
  suggestions: OptimizationSuggestion[];
  /** Whether exact token counting (Anthropic API) was used */
  exactMode: boolean;
}

export interface OptimizationSuggestion {
  type: 'trim_description' | 'deduplicate_schema' | 'add_param_description';
  message: string;
  estimatedSavings: number;
  affectedTools: string[];
}

// ─── Config Diagnostics ───

export type ClientType = 'claude-desktop' | 'claude-code' | 'vscode' | 'cursor';

export interface ClientConfigLocation {
  client: ClientType;
  path: string;
  exists: boolean;
}

export interface ServerDiagnostic {
  name: string;
  command: string;
  status: 'ok' | 'timeout' | 'error' | 'warning';
  message?: string;
  toolCount?: number;
}

export interface DoctorResult {
  client: ClientType;
  configPath: string;
  configFound: boolean;
  servers: ServerDiagnostic[];
  warnings: string[];
  hints: string[];
}

// ─── Inspect ───

export interface InspectOptions {
  server: string;
  listTools?: boolean;
  listResources?: boolean;
  listPrompts?: boolean;
  call?: string;
  params?: string;
}

// ─── Reporter ───

export type OutputFormat = 'terminal' | 'json' | 'markdown';

// ─── Re-export MCP types we use ───

export type { Tool };
