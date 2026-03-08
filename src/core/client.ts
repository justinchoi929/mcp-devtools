import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { parseServerCommand } from '../utils/platform.js';

export interface ConnectOptions {
  /** Full command string, e.g. "node ./my-server.js" */
  serverCommand: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface McpConnection {
  client: Client;
  transport: StdioClientTransport;
  close: () => Promise<void>;
}

/**
 * Connect to an MCP server via stdio transport.
 */
export async function connectToServer(options: ConnectOptions): Promise<McpConnection> {
  const { serverCommand, timeout = 10_000, env } = options;
  const { command, args } = parseServerCommand(serverCommand);

  logger.debug(`Connecting to server: ${command} ${args.join(' ')}`);

  const transport = new StdioClientTransport({
    command,
    args,
    env: env ? { ...process.env, ...env } as Record<string, string> : undefined,
    stderr: 'pipe',
  });

  const client = new Client(
    { name: 'mcp-devtools', version: '0.1.0' },
    { capabilities: {} },
  );

  const connectPromise = client.connect(transport);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timed out after ${timeout}ms`)), timeout),
  );

  await Promise.race([connectPromise, timeoutPromise]);
  logger.debug('Connected successfully');

  return {
    client,
    transport,
    close: async () => {
      await client.close();
      logger.debug('Connection closed');
    },
  };
}

/**
 * List all tools from a connected MCP server.
 */
export async function listTools(connection: McpConnection): Promise<Tool[]> {
  const result = await connection.client.listTools();
  return result.tools;
}

/**
 * Call a tool on a connected MCP server.
 */
export async function callTool(
  connection: McpConnection,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await connection.client.callTool({ name: toolName, arguments: args });
  return result;
}

/**
 * Convenience: connect, run a callback, then close.
 */
export async function withConnection<T>(
  options: ConnectOptions,
  fn: (conn: McpConnection) => Promise<T>,
): Promise<T> {
  const conn = await connectToServer(options);
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}
