import type { Command } from 'commander';
import { parseClientConfig, parseAllConfigs } from '../core/config-parser.js';
import { connectToServer, listTools } from '../core/client.js';
import { formatDoctorReport } from '../core/reporter.js';
import type { ClientType, DoctorResult, OutputFormat, ServerDiagnostic } from '../types/index.js';
import { logger } from '../utils/logger.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose MCP configuration across all clients')
    .option('--client <client>', 'Only check a specific client (claude-desktop, claude-code, vscode, cursor)')
    .option('-f, --format <format>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-t, --timeout <ms>', 'Connection test timeout in milliseconds', '5000')
    .option('--skip-connect', 'Skip connection tests (only check config files)')
    .action(async (opts) => {
      try {
        const results = await runDoctor({
          client: opts.client as ClientType | undefined,
          timeout: parseInt(opts.timeout, 10),
          skipConnect: opts.skipConnect ?? false,
        });
        console.log(formatDoctorReport(results, opts.format as OutputFormat));
      } catch (err) {
        logger.error(`Doctor failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

export interface DoctorOptions {
  client?: ClientType;
  timeout?: number;
  skipConnect?: boolean;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult[]> {
  const { client, timeout = 5000, skipConnect = false } = options;

  const configs = client
    ? [await parseClientConfig(client)]
    : await parseAllConfigs();

  const results: DoctorResult[] = [];

  for (const config of configs) {
    const diagnostics: ServerDiagnostic[] = [];

    if (config.exists && !skipConnect) {
      for (const [name, serverConfig] of config.servers) {
        const diag = await testServerConnection(name, serverConfig.command, serverConfig.args, timeout);
        diagnostics.push(diag);
      }
    } else if (config.exists) {
      // Just list servers without testing
      for (const [name, serverConfig] of config.servers) {
        diagnostics.push({
          name,
          command: serverConfig.command,
          status: 'ok',
          message: 'skipped connection test',
        });
      }
    }

    results.push({
      client: config.client,
      configPath: config.configPath,
      configFound: config.exists,
      servers: diagnostics,
      warnings: config.warnings,
      hints: config.hints,
    });
  }

  return results;
}

async function testServerConnection(
  name: string,
  command: string,
  args: string[] | undefined,
  timeout: number,
): Promise<ServerDiagnostic> {
  // Skip HTTP/SSE URLs — can't test via stdio
  if (command.startsWith('http://') || command.startsWith('https://')) {
    return {
      name,
      command,
      status: 'warning',
      message: 'HTTP/SSE transport — skipped stdio test',
    };
  }

  try {
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    const conn = await connectToServer({ serverCommand: fullCommand, timeout });
    try {
      const tools = await listTools(conn);
      return {
        name,
        command,
        status: 'ok',
        toolCount: tools.length,
      };
    } finally {
      await conn.close();
    }
  } catch (err) {
    const msg = (err as Error).message;

    if (msg.includes('timed out')) {
      return { name, command, status: 'timeout', message: 'Connection timed out' };
    }

    return { name, command, status: 'error', message: msg };
  }
}
