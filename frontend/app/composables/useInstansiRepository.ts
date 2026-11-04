import { computed } from 'vue';
import { useRoute, useRuntimeConfig, useNuxtApp } from '#app';
import {
  createApiRepository,
  type DatasetMode,
} from '../services/apiRepository';
import type { InstansiRepository } from '../types/domain';

export function useInstansiRepository() {
  const route = useRoute();
  const config = useRuntimeConfig();
  const app = useNuxtApp();
  // Instance per Nuxt app/request: cache tidak bocor antarpengguna SSR.
  const holder = app as typeof app & {
    _jiknRepositories?: Map<string, InstansiRepository>;
  };
  holder._jiknRepositories ??= new Map();
  const mode = computed<DatasetMode>(() =>
    route.query.demo === '1'
      ? 'demo'
      : route.query.data === 'excel'
        ? 'excel'
        : route.query.data === 'dev'
          ? 'dev'
          : route.query.data === 'sikn'
          ? 'sikn'
          : 'pilot',
  );
  const get = () => {
    const key = `${config.public.apiBase}:${mode.value}`;
    let repository = holder._jiknRepositories!.get(key);
    if (!repository) {
      repository = createApiRepository(
        String(config.public.apiBase),
        mode.value,
        async (url) => {
          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok)
            throw Object.assign(
              new Error(
                mode.value === 'sikn' && response.status === 503
                  ? 'Mode uji database lokal belum tersedia. Pastikan SSD dan server PostgreSQL salinan inspeksi aktif.'
                  : `Layanan data belum dapat dimuat (HTTP ${response.status}).`,
              ),
              { statusCode: response.status },
            );
          return response.json() as Promise<unknown>;
        },
      );
      holder._jiknRepositories!.set(key, repository);
    }
    return repository;
  };
  // Facade tidak memegang mode lama ketika query sumber berubah.
  const repository: InstansiRepository = {
    getReferenceData: () => get().getReferenceData(),
    listInstansi: (filters) => get().listInstansi(filters),
    getInstansiDetail: (id) => get().getInstansiDetail(id),
    getKabKotaGeometry: (id) => get().getKabKotaGeometry!(id),
  };
  return {
    repository,
    mode,
    demo: computed(() => mode.value === 'demo'),
    pilot: computed(() => mode.value === 'pilot'),
    query: computed(() =>
      route.fullPath.includes('?')
        ? route.fullPath.slice(route.fullPath.indexOf('?'))
        : '',
    ),
  };
}
