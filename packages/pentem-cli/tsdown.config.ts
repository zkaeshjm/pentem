import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  clean: true,
  minify: false,
  bundle: true,
  platform: 'node',
  target: 'node20',
});
