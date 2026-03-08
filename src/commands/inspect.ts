import type { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { connectToServer, listTools, callTool, type McpConnection } from '../core/client.js';
import { analyzeToolTokens } from '../core/token-counter.js';
import { logger } from '../utils/logger.js';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect')
    .description('Interactively explore an MCP server')
    .requiredOption('-s, --server <command>', 'Server command to connect to')
    .option('--list-tools', 'List all tools (non-interactive)')
    .option('--list-resources', 'List all resources (non-interactive)')
    .option('--list-prompts', 'List all prompts (non-interactive)')
    .option('--call <tool>', 'Call a specific tool (non-interactive)')
    .option('--params <json>', 'JSON params for --call', '{}')
    .option('-t, --timeout <ms>', 'Connection timeout in milliseconds', '10000')
    .action(async (opts) => {
      try {
        await runInspect(opts);
      } catch (err) {
        logger.error(`Inspect failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

interface InspectCommandOpts {
  server: string;
  listTools?: boolean;
  listResources?: boolean;
  listPrompts?: boolean;
  call?: string;
  params?: string;
  timeout?: string;
}

async function runInspect(opts: InspectCommandOpts): Promise<void> {
  const timeout = parseInt(opts.timeout ?? '10000', 10);

  const s = clack.spinner();
  s.start('Connecting to server...');

  const conn = await connectToServer({ serverCommand: opts.server, timeout });

  s.stop('Connected');

  try {
    // Non-interactive modes
    if (opts.listTools) {
      await printTools(conn);
      return;
    }
    if (opts.listResources) {
      await printResources(conn);
      return;
    }
    if (opts.listPrompts) {
      await printPrompts(conn);
      return;
    }
    if (opts.call) {
      const params = JSON.parse(opts.params ?? '{}');
      await runToolCall(conn, opts.call, params);
      return;
    }

    // Interactive mode
    await interactiveLoop(conn);
  } finally {
    await conn.close();
  }
}

async function printTools(conn: McpConnection): Promise<void> {
  const tools = await listTools(conn);
  console.log(pc.bold(`\nFound ${tools.length} tools:\n`));

  for (const tool of tools) {
    const info = analyzeToolTokens(tool);
    console.log(`  ${pc.bold(pc.cyan(tool.name))} ${pc.dim(`(${info.tokens} tokens)`)}`);
    if (tool.description) {
      console.log(`    ${pc.dim(tool.description.substring(0, 120))}${tool.description.length > 120 ? '...' : ''}`);
    }
    if (tool.inputSchema) {
      const schema = tool.inputSchema as Record<string, unknown>;
      const props = schema.properties as Record<string, unknown> | undefined;
      if (props) {
        const paramNames = Object.keys(props);
        console.log(`    Params: ${pc.yellow(paramNames.join(', '))}`);
      }
    }
    console.log('');
  }
}

async function printResources(conn: McpConnection): Promise<void> {
  const result = await conn.client.listResources();
  const resources = result.resources;
  console.log(pc.bold(`\nFound ${resources.length} resources:\n`));
  for (const r of resources) {
    console.log(`  ${pc.cyan(r.name)} ${pc.dim(r.uri)}`);
    if (r.description) {
      console.log(`    ${pc.dim(r.description)}`);
    }
  }
}

async function printPrompts(conn: McpConnection): Promise<void> {
  const result = await conn.client.listPrompts();
  const prompts = result.prompts;
  console.log(pc.bold(`\nFound ${prompts.length} prompts:\n`));
  for (const p of prompts) {
    console.log(`  ${pc.cyan(p.name)}`);
    if (p.description) {
      console.log(`    ${pc.dim(p.description)}`);
    }
  }
}

async function runToolCall(
  conn: McpConnection,
  toolName: string,
  params: Record<string, unknown>,
): Promise<void> {
  console.log(pc.dim(`\nCalling ${toolName} with ${JSON.stringify(params)}...\n`));

  const start = performance.now();
  const result = await callTool(conn, toolName, params);
  const elapsed = performance.now() - start;

  console.log(pc.bold('Result:'));
  console.log(JSON.stringify(result, null, 2));
  console.log(pc.dim(`\n⏱ ${elapsed.toFixed(0)}ms`));
}

async function interactiveLoop(conn: McpConnection): Promise<void> {
  clack.intro(pc.bgCyan(pc.black(' MCP Inspector ')));

  while (true) {
    const action = await clack.select({
      message: 'What would you like to do?',
      options: [
        { value: 'tools', label: 'List tools' },
        { value: 'resources', label: 'List resources' },
        { value: 'prompts', label: 'List prompts' },
        { value: 'call', label: 'Call a tool' },
        { value: 'quit', label: 'Quit' },
      ],
    });

    if (clack.isCancel(action) || action === 'quit') {
      clack.outro('Bye!');
      break;
    }

    switch (action) {
      case 'tools':
        await printTools(conn);
        break;
      case 'resources':
        await printResources(conn);
        break;
      case 'prompts':
        await printPrompts(conn);
        break;
      case 'call':
        await interactiveToolCall(conn);
        break;
    }
  }
}

async function interactiveToolCall(conn: McpConnection): Promise<void> {
  const tools = await listTools(conn);

  if (tools.length === 0) {
    clack.log.warn('No tools available');
    return;
  }

  const toolName = await clack.select({
    message: 'Select a tool to call:',
    options: tools.map(t => ({
      value: t.name,
      label: t.name,
      hint: t.description?.substring(0, 60),
    })),
  });

  if (clack.isCancel(toolName)) return;

  const tool = tools.find(t => t.name === toolName);
  if (!tool) return;

  // Build params from schema
  const params: Record<string, unknown> = {};
  const schema = tool.inputSchema as Record<string, unknown> | undefined;
  const props = schema?.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema?.required as string[]) ?? [];

  if (props) {
    for (const [paramName, paramDef] of Object.entries(props)) {
      const isRequired = required.includes(paramName);
      const hint = paramDef.description ? ` (${paramDef.description})` : '';
      const typeHint = paramDef.type ? ` [${paramDef.type}]` : '';

      const value = await clack.text({
        message: `${paramName}${typeHint}${hint}`,
        placeholder: isRequired ? 'required' : 'optional (press enter to skip)',
        validate: (v) => {
          if (isRequired && !v) return `${paramName} is required`;
        },
      });

      if (clack.isCancel(value)) return;

      if (value) {
        // Try to parse as JSON for objects/arrays/numbers
        try {
          params[paramName] = JSON.parse(value);
        } catch {
          params[paramName] = value;
        }
      }
    }
  }

  await runToolCall(conn, toolName as string, params);
}
