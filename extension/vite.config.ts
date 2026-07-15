import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, 'src/background.ts'),
        contentScript: path.resolve(__dirname, 'src/contentScript.ts'),
      },
      output: {
        dir: 'dist',
        format: 'es',
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
