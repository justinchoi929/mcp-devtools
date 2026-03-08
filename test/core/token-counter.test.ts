import { describe, it, expect } from 'vitest';
import { countTokens, analyzeToolTokens, analyzeAllTools } from '../../src/core/token-counter.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('countTokens', () => {
  it('should return positive token count for non-empty string', () => {
    const count = countTokens('Hello world');
    expect(count).toBeGreaterThan(0);
  });

  it('should return 0 for empty string', () => {
    const count = countTokens('');
    expect(count).toBe(0);
  });

  it('should count more tokens for longer strings', () => {
    const short = countTokens('hello');
    const long = countTokens('hello world this is a much longer string with many more tokens');
    expect(long).toBeGreaterThan(short);
  });
});

describe('analyzeToolTokens', () => {
  it('should analyze a simple tool', () => {
    const tool: Tool = {
      name: 'get_user',
      description: 'Get a user by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
        required: ['id'],
      },
    };

    const result = analyzeToolTokens(tool);
    expect(result.name).toBe('get_user');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.breakdown.name).toBeGreaterThan(0);
    expect(result.breakdown.description).toBeGreaterThan(0);
    expect(result.breakdown.schema).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn on long descriptions', () => {
    const longDesc = 'This is a very long description. '.repeat(50);
    const tool: Tool = {
      name: 'wordy_tool',
      description: longDesc,
      inputSchema: { type: 'object' },
    };

    const result = analyzeToolTokens(tool);
    const warning = result.warnings.find(w => w.type === 'description_too_long');
    expect(warning).toBeDefined();
    if (warning && warning.type === 'description_too_long') {
      expect(warning.tokens).toBeGreaterThan(200);
    }
  });

  it('should warn on missing param descriptions', () => {
    const tool: Tool = {
      name: 'no_desc_params',
      description: 'A tool',
      inputSchema: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'number', description: 'has desc' },
          baz: { type: 'boolean' },
        },
      },
    };

    const result = analyzeToolTokens(tool);
    const warning = result.warnings.find(w => w.type === 'missing_param_description');
    expect(warning).toBeDefined();
    if (warning && warning.type === 'missing_param_description') {
      expect(warning.params).toContain('foo');
      expect(warning.params).toContain('baz');
      expect(warning.params).not.toContain('bar');
    }
  });

  it('should handle tool with no description', () => {
    const tool: Tool = {
      name: 'no_desc',
      inputSchema: { type: 'object' },
    };

    const result = analyzeToolTokens(tool);
    expect(result.breakdown.description).toBe(0);
    expect(result.tokens).toBeGreaterThan(0);
  });
});

describe('analyzeAllTools', () => {
  it('should sort tools by token count descending', () => {
    const tools: Tool[] = [
      {
        name: 'small',
        description: 'Small tool',
        inputSchema: { type: 'object' },
      },
      {
        name: 'big_tool',
        description: 'This is a bigger tool with a much longer description that uses more tokens',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'string', description: 'A param' },
            b: { type: 'string', description: 'B param' },
            c: { type: 'string', description: 'C param' },
          },
        },
      },
    ];

    const { toolInfos } = analyzeAllTools(tools);
    expect(toolInfos[0].tokens).toBeGreaterThanOrEqual(toolInfos[1].tokens);
  });

  it('should detect duplicate schemas', () => {
    const sharedSchema = {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'The key' },
      },
      required: ['key'],
    };

    const tools: Tool[] = [
      { name: 'tool_a', description: 'Tool A', inputSchema: sharedSchema },
      { name: 'tool_b', description: 'Tool B', inputSchema: sharedSchema },
    ];

    const { suggestions } = analyzeAllTools(tools);
    const dedup = suggestions.find(s => s.type === 'deduplicate_schema');
    expect(dedup).toBeDefined();
    expect(dedup!.affectedTools).toContain('tool_a');
    expect(dedup!.affectedTools).toContain('tool_b');
    expect(dedup!.estimatedSavings).toBeGreaterThan(0);
  });

  it('should calculate total tokens', () => {
    const tools: Tool[] = [
      { name: 'a', description: 'Tool A', inputSchema: { type: 'object' } },
      { name: 'b', description: 'Tool B', inputSchema: { type: 'object' } },
    ];

    const { totalTokens, toolInfos } = analyzeAllTools(tools);
    const manualSum = toolInfos.reduce((sum, t) => sum + t.tokens, 0);
    expect(totalTokens).toBe(manualSum);
  });
});
