import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ClientType, ServerConfig } from '../types/index.js';
import { getConfigPaths } from '../utils/platform.js';
import { logger } from '../utils/logger.js';

export interface ParsedConfig {
  client: ClientType;
  configPath: string;
  exists: boolean;
  servers: Map<string, ServerConfig>;
  warnings: string[];
  hints: string[];
  raw?: unknown;
}

/**
 * Parse MCP config for a specific client.
 */
export async function parseClientConfig(client: ClientType): Promise<ParsedConfig> {
  const paths = getConfigPaths(client);

  for (const configPath of paths) {
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        const json = JSON.parse(content);
        return parseConfigJson(client, configPath, json);
      } catch (err) {
        logger.warn(`Failed to parse ${configPath}: ${(err as Error).message}`);
        return {
          client,
          configPath,
          exists: true,
          servers: new Map(),
          warnings: [`Config file is invalid JSON: ${(err as Error).message}`],
          hints: [],
        };
      }
    }
  }

  return {
    client,
    configPath: paths[0],
    exists: false,
    servers: new Map(),
    warnings: [],
    hints: getHints(client),
  };
}

/**
 * Parse the JSON config based on client type.
 */
function parseConfigJson(
  client: ClientType,
  configPath: string,
  json: Record<string, unknown>,
): ParsedConfig {
  const servers = new Map<string, ServerConfig>();
  const warnings: string[] = [];

  // Different clients use different keys
  let serversObj: Record<string, unknown> | undefined;

  switch (client) {
    case 'claude-desktop':
      serversObj = json.mcpServers as Record<string, unknown> | undefined;
      if (!serversObj && json.servers) {
        warnings.push('Found "servers" key — Claude Desktop expects "mcpServers"');
      }
      break;

    case 'claude-code':
      serversObj = json.mcpServers as Record<string, unknown> | undefined;
      break;

    case 'vscode':
      // VS Code uses "servers" (not "mcpServers")
      serversObj = json.servers as Record<string, unknown> | undefined;
      if (!serversObj && json.mcpServers) {
        warnings.push('Found "mcpServers" key — VS Code expects "servers"');
        serversObj = json.mcpServers as Record<string, unknown>;
      }
      break;

    case 'cursor':
      serversObj = json.mcpServers as Record<string, unknown> | undefined;
      break;
  }

  if (serversObj && typeof serversObj === 'object') {
    for (const [name, config] of Object.entries(serversObj)) {
      const srv = config as Record<string, unknown>;
      if (srv.command && typeof srv.command === 'string') {
        servers.set(name, {
          command: srv.command,
          args: Array.isArray(srv.args) ? srv.args.map(String) : undefined,
          env: srv.env as Record<string, string> | undefined,
        });
      } else if (srv.url && typeof srv.url === 'string') {
        // HTTP/SSE transport — store as command for diagnostic display
        servers.set(name, {
          command: srv.url,
        });
      } else {
        warnings.push(`Server "${name}" has no "command" or "url" field`);
      }
    }
  }

  return {
    client,
    configPath,
    exists: true,
    servers,
    warnings,
    hints: [],
    raw: json,
  };
}

/**
 * Return helpful hints when config is not found.
 */
function getHints(client: ClientType): string[] {
  switch (client) {
    case 'claude-desktop':
      return ['Claude Desktop config is at %APPDATA%\\Claude\\claude_desktop_config.json (Win) or ~/Library/Application Support/Claude/ (Mac)'];
    case 'claude-code':
      return ['Claude Code uses .mcp.json (project-level) or ~/.claude.json (user-level)'];
    case 'vscode':
      return ['VS Code MCP config goes in .vscode/mcp.json — note: key is "servers" not "mcpServers"'];
    case 'cursor':
      return ['Cursor MCP config goes in .cursor/mcp.json'];
  }
}

/**
 * Parse all supported client configs.
 */
export async function parseAllConfigs(): Promise<ParsedConfig[]> {
  const clients: ClientType[] = ['claude-desktop', 'claude-code', 'vscode', 'cursor'];
  return Promise.all(clients.map(parseClientConfig));
}
