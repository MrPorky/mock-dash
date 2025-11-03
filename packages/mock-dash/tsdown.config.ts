import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: 'src/index.ts',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: 'src/cli/index.ts',
    format: 'esm',
    dts: false,
    sourcemap: false,
    clean: true,
  },
])
