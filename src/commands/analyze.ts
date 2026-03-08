import type { Command } from 'commander';
import { withConnection, listTools } from '../core/client.js';
import { analyzeAllTools } from '../core/token-counter.js';
import { formatAnalysisReport } from '../core/reporter.js';
import type { AnalysisResult, OutputFormat } from '../types/index.js';
import { logger } from '../utils/logger.js';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze token consumption of MCP server tools')
    .requiredOption('-s, --server <command>', 'Server command to analyze (e.g. "node ./my-server.js")')
    .option('-f, --format <format>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-c, --context-window <size>', 'Context window size for percentage calculation', '200000')
    .option('-t, --timeout <ms>', 'Connection timeout in milliseconds', '10000')
    .action(async (opts) => {
      try {
        const result = await runAnalyze({
          serverCommand: opts.server,
          format: opts.format as OutputFormat,
          contextWindowSize: parseInt(opts.contextWindow, 10),
          timeout: parseInt(opts.timeout, 10),
        });
        console.log(formatAnalysisReport(result, opts.format as OutputFormat));
      } catch (err) {
        logger.error(`Analysis failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

export interface AnalyzeOptions {
  serverCommand: string;
  format?: OutputFormat;
  contextWindowSize?: number;
  timeout?: number;
}

export async function runAnalyze(options: AnalyzeOptions): Promise<AnalysisResult> {
  const { serverCommand, contextWindowSize = 200_000, timeout = 10_000 } = options;

  logger.debug(`Analyzing server: ${serverCommand}`);

  const tools = await withConnection(
    { serverCommand, timeout },
    (conn) => listTools(conn),
  );

  logger.debug(`Found ${tools.length} tools`);

  const { toolInfos, suggestions, totalTokens } = analyzeAllTools(tools, contextWindowSize);
  const contextUsagePercent = (totalTokens / contextWindowSize) * 100;

  return {
    serverCommand,
    totalTools: tools.length,
    totalTokens,
    contextWindowSize,
    contextUsagePercent,
    tools: toolInfos,
    suggestions,
    exactMode: false,
  };
}
