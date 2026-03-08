import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/mcp-devtools': 'bin/mcp-devtools.ts' },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    clean: true,
    splitting: false,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    dts: true,
    splitting: false,
    sourcemap: true,
  },
]);
