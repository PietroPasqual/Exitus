import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos: o site funciona em https://<usuario>.github.io/c-rculo-magico/
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // As tabelas de silhuetas têm cache próprio, separado da lógica do editor.
          if (/\/src\/ui\/pixel-intention-(?!glyph\.ts$)[a-z]+\.ts$/.test(id)) return 'intention-forms';
          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
