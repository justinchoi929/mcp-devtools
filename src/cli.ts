import { Command } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerTestCommand } from './commands/test.js';
import { setLogLevel } from './utils/logger.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('mcp-devtools')
    .description('Chrome DevTools for the MCP ecosystem — analyze, diagnose, and inspect MCP servers')
    .version('0.1.0')
    .option('--verbose', 'Enable verbose logging')
    .hook('preAction', (thisCommand) => {
      if (thisCommand.opts().verbose) {
        setLogLevel('debug');
      }
    });

  registerAnalyzeCommand(program);
  registerDoctorCommand(program);
  registerInspectCommand(program);
  registerTestCommand(program);

  return program;
}
