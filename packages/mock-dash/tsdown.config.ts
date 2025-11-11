import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: 'mock-dash',
    entry: 'src/index.ts',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    name: 'cli',
    entry: {'cli': 'src/cli/index.ts'},
    format: 'esm',
    dts: false,
    sourcemap: false,
    clean: true,
  },
])
