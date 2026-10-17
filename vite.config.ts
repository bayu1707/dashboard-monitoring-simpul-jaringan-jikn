import { defineConfig } from 'vitest/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// Hanya satu JSON hasil normalisasi dilayani di server pengembangan lokal.
// Workbook, raw-selected, laporan, dan snapshot ini tidak disalin ke build.
function localCasefile(enabled: boolean, pilotEnabled: boolean): Plugin {
  return {
    name: 'casefile-review-lokal',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-data/', (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        const routes: Record<string, string> = {};
        if (enabled) routes['/snapshot.json'] = '.local/casefile/snapshot.json';
        if (pilotEnabled) {
          routes['/pilot-snapshot.json'] = '.local/pilot/snapshot.json';
          routes['/pilot-references.json'] = '.local/pilot/references.json';
        }
        const path = routes[request.url ?? ''];
        if (!path || request.method !== 'GET') {
          response.statusCode = 404;
          response.end('{"error":"Berkas tidak tersedia"}');
          return;
        }
        void readFile(resolve(server.config.root, path), 'utf8')
          .then((json) => response.end(json))
          .catch(() => {
            response.statusCode = 404;
            response.end('{"error":"Jalankan impor casefile terlebih dahulu"}');
          });
      });
    },
  };
}
export default defineConfig(({ mode }) => ({
  plugins: [react(), localCasefile(loadEnv(mode, process.cwd()).VITE_LOCAL_CASEFILE === '1', loadEnv(mode, process.cwd()).VITE_LOCAL_PILOT === '1')],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}));
