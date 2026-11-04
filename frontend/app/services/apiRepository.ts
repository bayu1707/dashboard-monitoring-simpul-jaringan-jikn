import type {
  ExplorationState,
  Instansi,
  InstansiDetail,
  InstansiRepository,
  ReferenceData,
  SnapshotMetadata,
  Wilayah,
} from '../types/domain';
import { DataValidationError, parseReferenceData } from './validation';

export type DatasetMode = 'pilot' | 'excel' | 'demo' | 'sikn' | 'dev';
export type JsonTransport = (url: string) => Promise<unknown>;
type ApiData<T> = { data: T };
type Page = {
  data: Instansi[];
  metadata: SnapshotMetadata;
  meta: { total: number; page: number; perPage: number; lastPage: number };
};

/** Cache terbatas pada instance repository. Promise gagal dibuang agar Retry membaca API kembali. */
export function createApiRepository(
  baseUrl: string,
  mode: DatasetMode,
  transport: JsonTransport,
): InstansiRepository {
  const base = baseUrl.replace(/\/$/, '');
  let references: Promise<ReferenceData> | undefined;
  const cache = new Map<string, Promise<unknown>>();
  const read = <T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> => {
    const query = new URLSearchParams({ mode, ...params });
    const url = `${base}/${path}?${query}`;
    // Autocomplete tidak menyimpan setiap variasi ketikan dalam cache permanen.
    if (params.search || mode === 'dev' || (mode === 'sikn' && path.startsWith('institutions/'))) return transport(url) as Promise<T>;
    let pending = cache.get(url);
    if (!pending) {
      pending = transport(url).catch((error: unknown) => {
        cache.delete(url);
        throw error;
      });
      cache.set(url, pending);
    }
    return pending as Promise<T>;
  };
  const cachedReferenceData = () =>
    (references ??= read<ApiData<unknown>>('reference-data')
      .then((value) => parseReferenceData(value.data))
      .catch((error: unknown) => {
        references = undefined;
        cache.clear();
        throw error;
      }));
  const getReferenceData = () => mode === 'dev'
    ? read<ApiData<unknown>>('reference-data').then(value => parseReferenceData(value.data))
    : cachedReferenceData();
  return {
    getReferenceData,
    async listInstansi(filters: Partial<ExplorationState> & { search?: string } = {}) {
      try {
        const params: Record<string, string> = { per_page: '250' };
        if (filters.search?.trim()) params.search = filters.search.trim().slice(0, 120);
        if (filters.provinceId) params.provinceId = filters.provinceId;
        if (filters.kabKotaId) params.kabKotaId = filters.kabKotaId;
        if (filters.jenisId) params.jenisId = filters.jenisId;
        const first = await read<Page>('institutions', {
          ...params,
          page: '1',
        });
        if (
          !Number.isInteger(first.meta?.lastPage) ||
          first.meta.lastPage < 1 ||
          first.meta.lastPage > 1000
        )
          throw new DataValidationError([
            'Metadata pagination API tidak valid.',
          ]);
        const pages = await Promise.all(
          Array.from({ length: first.meta.lastPage - 1 }, (_, index) =>
            read<Page>('institutions', { ...params, page: String(index + 2) }),
          ),
        );
        if (
          pages.some(
            (page) =>
              page.metadata.id !== first.metadata.id ||
              page.meta.total !== first.meta.total,
          )
        ) {
          cache.clear();
          throw new DataValidationError([
            'Snapshot berubah selama pagination; coba muat ulang.',
          ]);
        }
        const items = [first, ...pages].flatMap((page) => page.data);
        if (
          items.length !== first.meta.total ||
          new Set(items.map((item) => item.id)).size !== items.length
        )
          throw new DataValidationError([
            'Jumlah atau ID instansi hasil pagination API tidak konsisten.',
          ]);
        return { items, metadata: first.metadata };
      } catch (error: unknown) {
        cache.clear();
        throw error;
      }
    },
    async getInstansiDetail(id) {
      try {
        return (
          await read<ApiData<InstansiDetail>>(
            `institutions/${encodeURIComponent(id)}`,
          )
        ).data;
      } catch (error: unknown) {
        const value = error as {
          status?: number;
          statusCode?: number;
          response?: { status?: number };
        };
        if (
          value.status === 404 ||
          value.statusCode === 404 ||
          value.response?.status === 404
        )
          return null;
        throw error;
      }
    },
    async getKabKotaGeometry(provinceId): Promise<Wilayah[]> {
      try {
        const refs = await getReferenceData();
        const regions = refs.kabKota.filter(
          (region) => region.provinceId === provinceId,
        );
        const collection = await read<{
          type: string;
          features: Array<{ properties: { id: string }; geometry: unknown }>;
        }>(`geometry/${encodeURIComponent(provinceId)}`);
        if (
          collection.type !== 'FeatureCollection' ||
          !Array.isArray(collection.features)
        )
          throw new DataValidationError(['Geometri API tidak valid.']);
        const geometries = new Map<string, unknown>();
        for (const feature of collection.features) {
          const id = feature.properties?.id;
          if (!regions.some((region) => region.id === id) || geometries.has(id))
            throw new DataValidationError([
              `Geometri API: ID asing atau duplikat ${id}.`,
            ]);
          geometries.set(id, feature.geometry);
        }
        return parseReferenceData({
          ...refs,
          kabKota: regions.map((region) => ({
            ...region,
            geometry: geometries.get(region.id) ?? region.geometry,
          })),
        }).kabKota;
      } catch (error: unknown) {
        cache.clear();
        throw error;
      }
    },
  };
}
