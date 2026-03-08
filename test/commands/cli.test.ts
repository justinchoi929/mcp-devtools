import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/cli.js';

describe('CLI', () => {
  it('should create program with all commands', () => {
    const program = createProgram();
    expect(program.name()).toBe('mcp-devtools');

    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('analyze');
    expect(commands).toContain('doctor');
    expect(commands).toContain('inspect');
    expect(commands).toContain('test');
  });

  it('should have version', () => {
    const program = createProgram();
    expect(program.version()).toBe('0.1.0');
  });
});
