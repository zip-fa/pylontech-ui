import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const daemon = process.env['DAEMON_URL'] ?? 'http://localhost:4300';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@libs/protocol': fileURLToPath(
        new URL('../../libs/protocol/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 4200,
    // Same-origin /api keeps the client free of CORS and host config.
    proxy: { '/api': { target: daemon, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
