import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: false,
  treeshake: true,
  target: 'es2020',
  platform: 'neutral',  // works in Node, Edge, Bun, Deno
})
