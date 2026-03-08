import { describe, it, expect } from 'vitest';
import { formatAnalysisReport, formatDoctorReport } from '../../src/core/reporter.js';
import type { AnalysisResult, DoctorResult } from '../../src/types/index.js';

const sampleAnalysis: AnalysisResult = {
  serverCommand: 'node ./test-server.js',
  totalTools: 3,
  totalTokens: 1500,
  contextWindowSize: 200000,
  contextUsagePercent: 0.75,
  tools: [
    {
      name: 'search',
      description: 'Search things',
      tokens: 800,
      breakdown: { name: 2, description: 10, schema: 788 },
      warnings: [{ type: 'description_too_long', tokens: 250, threshold: 200 }],
    },
    {
      name: 'create',
      description: 'Create things',
      tokens: 500,
      breakdown: { name: 2, description: 8, schema: 490 },
      warnings: [],
    },
    {
      name: 'delete',
      description: 'Delete things',
      tokens: 200,
      breakdown: { name: 2, description: 8, schema: 190 },
      warnings: [{ type: 'missing_param_description', params: ['id'] }],
    },
  ],
  suggestions: [
    {
      type: 'trim_description',
      message: '1 tool has descriptions over 200 tokens — trim to <100',
      estimatedSavings: 150,
      affectedTools: ['search'],
    },
  ],
  exactMode: false,
};

describe('formatAnalysisReport', () => {
  it('should format terminal output with table', () => {
    const output = formatAnalysisReport(sampleAnalysis, 'terminal');
    expect(output).toContain('Token Analysis');
    expect(output).toContain('search');
    expect(output).toContain('1,500');
    expect(output).toContain('Optimization suggestions');
  });

  it('should format JSON output', () => {
    const output = formatAnalysisReport(sampleAnalysis, 'json');
    const parsed = JSON.parse(output);
    expect(parsed.totalTools).toBe(3);
    expect(parsed.totalTokens).toBe(1500);
    expect(parsed.tools).toHaveLength(3);
  });

  it('should format Markdown output', () => {
    const output = formatAnalysisReport(sampleAnalysis, 'markdown');
    expect(output).toContain('# MCP Token Analysis');
    expect(output).toContain('| search |');
    expect(output).toContain('## Optimization Suggestions');
  });
});

describe('formatDoctorReport', () => {
  const sampleDoctor: DoctorResult[] = [
    {
      client: 'claude-desktop',
      configPath: '/path/to/config.json',
      configFound: true,
      servers: [
        { name: 'filesystem', command: 'node ./fs.js', status: 'ok', toolCount: 5 },
        { name: 'github', command: 'node ./gh.js', status: 'timeout', message: 'Connection timed out' },
      ],
      warnings: [],
      hints: [],
    },
    {
      client: 'claude-code',
      configPath: '~/.claude.json',
      configFound: false,
      servers: [],
      warnings: [],
      hints: ['Claude Code uses .mcp.json (project-level) or ~/.claude.json (user-level)'],
    },
  ];

  it('should format terminal output', () => {
    const output = formatDoctorReport(sampleDoctor, 'terminal');
    expect(output).toContain('Health Check');
    expect(output).toContain('Claude Desktop');
    expect(output).toContain('filesystem');
    expect(output).toContain('TIMEOUT');
    expect(output).toContain('Claude Code');
    expect(output).toContain('NOT FOUND');
  });

  it('should format JSON output', () => {
    const output = formatDoctorReport(sampleDoctor, 'json');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].client).toBe('claude-desktop');
  });

  it('should format Markdown output', () => {
    const output = formatDoctorReport(sampleDoctor, 'markdown');
    expect(output).toContain('# MCP Health Check');
    expect(output).toContain('## Claude Desktop');
  });
});
