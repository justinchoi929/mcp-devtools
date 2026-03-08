import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ClientType } from '../types/index.js';

/**
 * Returns platform-specific config paths for each MCP client.
 */
export function getConfigPaths(client: ClientType): string[] {
  const home = homedir();
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  switch (client) {
    case 'claude-desktop': {
      if (isWin) {
        const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
        return [join(appData, 'Claude', 'claude_desktop_config.json')];
      }
      if (isMac) {
        return [join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')];
      }
      // Linux
      return [join(home, '.config', 'Claude', 'claude_desktop_config.json')];
    }

    case 'claude-code': {
      // Project-level first, then user-level
      return [
        join(process.cwd(), '.mcp.json'),
        join(home, '.claude.json'),
      ];
    }

    case 'vscode': {
      return [
        join(process.cwd(), '.vscode', 'mcp.json'),
      ];
    }

    case 'cursor': {
      return [
        join(process.cwd(), '.cursor', 'mcp.json'),
      ];
    }
  }
}

/**
 * Get all supported client types.
 */
export function getAllClientTypes(): ClientType[] {
  return ['claude-desktop', 'claude-code', 'vscode', 'cursor'];
}

/**
 * Parse a server command string into command + args.
 * e.g. "node ./my-server.js --port 3000" → { command: "node", args: ["./my-server.js", "--port", "3000"] }
 */
export function parseServerCommand(cmd: string): { command: string; args: string[] } {
  const parts = cmd.trim().split(/\s+/);
  return {
    command: parts[0],
    args: parts.slice(1),
  };
}
