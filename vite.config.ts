import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos: o site funciona em https://<usuario>.github.io/c-rculo-magico/
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
