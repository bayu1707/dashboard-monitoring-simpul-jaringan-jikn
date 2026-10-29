import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-21',
  devtools: { enabled: false },
  typescript: { strict: true },
  // Helper TypeScript tetap diperiksa, tetapi bukan komponen auto-import.
  components: [{ path: '~/components', extensions: ['vue'] }],
  hooks: {
    'app:templates'(app) {
      // Nuxt 4.6.2: parameter ke-9 DefineComponent harus string (Vue 3.5).
      // Koreksi template saat digenerasi; hapus setelah generator Nuxt diperbaiki.
      const invalid = 'DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType';
      const corrected = 'DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, string, {}, {}, {}, SlotsType';
      for (const template of app.templates) {
        if (!['components.d.ts', 'types/components.d.ts'].includes(template.filename ?? '') || !template.getContents) continue;
        const getContents = template.getContents;
        template.getContents = async (data) => (await getContents(data)).replace(invalid, corrected);
      }
    },
  },
  vite: {
    optimizeDeps: {
      include: ['leaflet', 'leaflet.markercluster', '@lucide/vue'],
    },
  },
  css: [
    'leaflet/dist/leaflet.css',
    'leaflet.markercluster/dist/MarkerCluster.css',
    'leaflet.markercluster/dist/MarkerCluster.Default.css',
    '~/assets/css/tokens.css',
    '~/assets/css/layout.css',
    '~/assets/css/map.css',
    '~/assets/css/detail.css',
    '~/assets/css/landing-page.css',
  ],
  runtimeConfig: {
    developmentConfigPath: fileURLToPath(new URL('../.local/development/connection.json', import.meta.url)),
    public: {
      apiBase: 'http://127.0.0.1:8000/api/v1',
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileAttribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Simpul Jaringan · JIKN',
      meta: [
        {
          name: 'description',
          content:
            'Dashboard Monitoring Simpul Jaringan JIKN. Snapshot existing dengan statistik simulasi yang diberi label.',
        },
      ],
    },
  },
  routeRules: { '/': { redirect: '/simpul-jaringan' } },
});
