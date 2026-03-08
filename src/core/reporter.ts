import pc from 'picocolors';
import type { AnalysisResult, DoctorResult, OutputFormat, ToolTokenInfo } from '../types/index.js';

// ─── Terminal Table Helpers ───

function padRight(str: string, len: number): string {
  // Strip ANSI codes for length calculation
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - stripped.length);
  return str + ' '.repeat(pad);
}

function padLeft(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - stripped.length);
  return ' '.repeat(pad) + str;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ─── Analysis Report ───

export function formatAnalysisReport(result: AnalysisResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    case 'markdown':
      return formatAnalysisMarkdown(result);
    case 'terminal':
    default:
      return formatAnalysisTerminal(result);
  }
}

function formatAnalysisTerminal(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold(`  📊 MCP Token Analysis — ${result.serverCommand}`));
  lines.push('');
  lines.push(`  Tools: ${pc.bold(String(result.totalTools))} total`);
  lines.push(
    `  Token Footprint: ${pc.bold(formatNumber(result.totalTokens))} tokens ` +
    `(${pc.yellow(result.contextUsagePercent.toFixed(1) + '%')} of ${formatNumber(result.contextWindowSize)} context)`,
  );
  lines.push('');

  if (result.tools.length > 0) {
    lines.push('  Top consumers:');
    lines.push(formatToolTable(result.tools));
    lines.push('');
  }

  if (result.suggestions.length > 0) {
    lines.push(pc.bold('  💡 Optimization suggestions:'));
    for (const s of result.suggestions) {
      const savings = s.estimatedSavings > 0
        ? pc.green(` (save ~${formatNumber(s.estimatedSavings)} tokens)`)
        : '';
      lines.push(`     • ${s.message}${savings}`);
    }
    lines.push('');
  }

  if (result.exactMode) {
    lines.push(pc.dim('  ℹ Token counts from Anthropic API (exact mode)'));
  } else {
    lines.push(pc.dim('  ℹ Token counts estimated via tiktoken (cl100k_base)'));
  }
  lines.push('');

  return lines.join('\n');
}

function formatToolTable(tools: ToolTokenInfo[]): string {
  const nameWidth = Math.max(20, ...tools.map(t => t.name.length)) + 2;
  const tokenWidth = 8;
  const notesWidth = 30;

  const lines: string[] = [];
  const sep = `  ┌${'─'.repeat(nameWidth)}┬${'─'.repeat(tokenWidth)}┬${'─'.repeat(notesWidth)}┐`;
  const header = `  │${padRight(pc.bold(' Tool'), nameWidth)}│${padRight(pc.bold(' Tokens'), tokenWidth)}│${padRight(pc.bold(' Notes'), notesWidth)}│`;
  const mid = `  ├${'─'.repeat(nameWidth)}┼${'─'.repeat(tokenWidth)}┼${'─'.repeat(notesWidth)}┤`;
  const bot = `  └${'─'.repeat(nameWidth)}┴${'─'.repeat(tokenWidth)}┴${'─'.repeat(notesWidth)}┘`;

  lines.push(sep);
  lines.push(header);
  lines.push(mid);

  for (const tool of tools) {
    const notes = tool.warnings.map(w => {
      switch (w.type) {
        case 'description_too_long':
          return pc.yellow('⚠ Description too long');
        case 'missing_param_description':
          return pc.dim(`Missing param desc: ${w.params.join(', ')}`);
        case 'duplicate_schema':
          return pc.cyan(`= ${w.duplicateOf}`);
        default:
          return '';
      }
    }).filter(Boolean).join('; ');

    const row = `  │${padRight(` ${tool.name}`, nameWidth)}│${padLeft(`${formatNumber(tool.tokens)} `, tokenWidth)}│${padRight(` ${notes}`, notesWidth)}│`;
    lines.push(row);
  }

  lines.push(bot);
  return lines.join('\n');
}

function formatAnalysisMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(`# MCP Token Analysis — ${result.serverCommand}`);
  lines.push('');
  lines.push(`- **Tools**: ${result.totalTools} total`);
  lines.push(`- **Token Footprint**: ${formatNumber(result.totalTokens)} tokens (${result.contextUsagePercent.toFixed(1)}% of ${formatNumber(result.contextWindowSize)} context)`);
  lines.push('');
  lines.push('| Tool | Tokens | Notes |');
  lines.push('|------|--------|-------|');
  for (const tool of result.tools) {
    const notes = tool.warnings.map(w => {
      switch (w.type) {
        case 'description_too_long': return `⚠ Description too long (${w.tokens} tokens)`;
        case 'missing_param_description': return `Missing param desc: ${w.params.join(', ')}`;
        case 'duplicate_schema': return `Duplicate of: ${w.duplicateOf}`;
        default: return '';
      }
    }).filter(Boolean).join('; ');
    lines.push(`| ${tool.name} | ${formatNumber(tool.tokens)} | ${notes} |`);
  }
  lines.push('');

  if (result.suggestions.length > 0) {
    lines.push('## Optimization Suggestions');
    lines.push('');
    for (const s of result.suggestions) {
      const savings = s.estimatedSavings > 0 ? ` (save ~${formatNumber(s.estimatedSavings)} tokens)` : '';
      lines.push(`- ${s.message}${savings}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Doctor Report ───

export function formatDoctorReport(results: DoctorResult[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return formatDoctorMarkdown(results);
    case 'terminal':
    default:
      return formatDoctorTerminal(results);
  }
}

function formatDoctorTerminal(results: DoctorResult[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(pc.bold('  🏥 MCP Health Check'));
  lines.push('');

  for (const r of results) {
    const clientLabel = getClientLabel(r.client);
    lines.push(`  ${pc.bold(clientLabel)}:`);

    if (!r.configFound) {
      lines.push(`    ${pc.red('❌')} Config NOT FOUND at ${pc.dim(r.configPath)}`);
      for (const hint of r.hints) {
        lines.push(`       💡 ${pc.dim(hint)}`);
      }
    } else {
      lines.push(`    ${pc.green('✅')} Config found: ${pc.dim(r.configPath)}`);
      if (r.servers.length > 0) {
        lines.push(`    ${pc.green('✅')} ${r.servers.length} server(s) configured`);
      }

      for (const srv of r.servers) {
        switch (srv.status) {
          case 'ok':
            lines.push(`    ${pc.green('✅')} ${srv.name} — connectable${srv.toolCount ? ` (${srv.toolCount} tools)` : ''}`);
            break;
          case 'timeout':
            lines.push(`    ${pc.red('❌')} ${srv.name} — TIMEOUT${srv.message ? ` (${srv.message})` : ''}`);
            break;
          case 'error':
            lines.push(`    ${pc.red('❌')} ${srv.name} — ERROR: ${srv.message ?? 'unknown'}`);
            break;
          case 'warning':
            lines.push(`    ${pc.yellow('⚠️')}  ${srv.name} — ${srv.message ?? 'warning'}`);
            break;
        }
      }

      for (const warn of r.warnings) {
        lines.push(`    ${pc.yellow('⚠️')}  ${warn}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatDoctorMarkdown(results: DoctorResult[]): string {
  const lines: string[] = [];
  lines.push('# MCP Health Check');
  lines.push('');

  for (const r of results) {
    lines.push(`## ${getClientLabel(r.client)}`);
    lines.push('');
    if (!r.configFound) {
      lines.push(`- ❌ Config NOT FOUND at \`${r.configPath}\``);
      for (const hint of r.hints) {
        lines.push(`  - 💡 ${hint}`);
      }
    } else {
      lines.push(`- ✅ Config found: \`${r.configPath}\``);
      for (const srv of r.servers) {
        const icon = srv.status === 'ok' ? '✅' : srv.status === 'warning' ? '⚠️' : '❌';
        lines.push(`- ${icon} ${srv.name} — ${srv.status}${srv.message ? `: ${srv.message}` : ''}`);
      }
      for (const warn of r.warnings) {
        lines.push(`- ⚠️ ${warn}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function getClientLabel(client: string): string {
  const labels: Record<string, string> = {
    'claude-desktop': 'Claude Desktop',
    'claude-code': 'Claude Code',
    'vscode': 'VS Code',
    'cursor': 'Cursor',
  };
  return labels[client] ?? client;
}
