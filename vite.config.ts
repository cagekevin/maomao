import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: /^react\/jsx-dev-runtime$/, replacement: resolve(__dirname, 'src/react-bridge.ts') },
      { find: /^react\/jsx-runtime$/, replacement: resolve(__dirname, 'src/react-bridge.ts') },
      { find: /^react$/, replacement: resolve(__dirname, 'src/react-bridge.ts') },
      { find: /^react-dom$/, replacement: resolve(__dirname, 'src/react-bridge.ts') },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('/src/App.js')) {
            return 'engine';
          }
          if (id.includes('/src/vendor/')) {
            return 'vendor-legacy';
          }
          if (id.includes('node_modules/@xyflow/')) {
            return 'vendor-xyflow';
          }
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
  },
});
