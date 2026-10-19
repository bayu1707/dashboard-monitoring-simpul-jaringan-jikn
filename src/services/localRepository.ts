import type {
  InstansiDetail,
  InstansiRepository,
  ReferenceData,
  SnapshotData,
  Wilayah,
} from '../types/domain';
import { filterInstansi } from './exploration';
import { SHARED_DATASETS } from '../data/sharedDatasets';
import {
  DataValidationError,
  parseJson,
  parseReferenceData,
  parseSnapshotData,
  unknownMetric,
} from './validation';

async function readJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok)
    throw new Error(
      `Sumber ${path} belum dapat dimuat (HTTP ${response.status}).`,
    );
  return parseJson(await response.text(), path);
}

/** Buat ulang repository untuk retry; kegagalan tidak tersimpan dalam cache. */
export function createLocalRepository(
  demo: boolean,
  localCasefile = import.meta.env.DEV && import.meta.env.VITE_LOCAL_CASEFILE === '1',
  pilot = false,
  shared?: { snapshot: string; references: string; datasetKind: 'pilot' | 'excel' },
): InstansiRepository {
  const base = demo ? '/demo' : '/data';
  const snapshotPath = shared?.snapshot ?? (!demo && pilot ? '/local-data/pilot-snapshot.json'
    : !demo && localCasefile ? '/local-data/snapshot.json' : `${base}/snapshot.json`);
  const referencePath = shared?.references ?? (!demo && pilot ? '/local-data/pilot-references.json' : `${base}/references.json`);
  const geometryCache = new Map<string, Promise<Wilayah[]>>();
  let referencePromise: Promise<ReferenceData> | null = null;
  let snapshotPromise: Promise<SnapshotData> | null = null;
  const getReferenceData = () => {
    referencePromise ??= readJson(referencePath)
      .then(parseReferenceData)
      .catch((error: unknown) => {
        referencePromise = null;
        throw error;
      });
    return referencePromise;
  };
  const getSnapshot = () => {
    snapshotPromise ??= Promise.all([
      getReferenceData(),
      readJson(snapshotPath),
    ])
      .then(([references, source]) => {
        const snapshot = parseSnapshotData(source, references);
        if (shared && snapshot.metadata.datasetKind !== shared.datasetKind)
          throw new DataValidationError(['Penanda dataset tidak sesuai katalog kolaborasi.']);
        if (demo !== (snapshot.metadata.datasetKind === 'demo'))
          throw new DataValidationError([
            'Mode dan penanda dataset demo tidak sesuai.',
          ]);
        if (!demo && pilot !== (snapshot.metadata.datasetKind === 'pilot'))
          throw new DataValidationError(['Mode dan penanda DATA SIMULASI tidak sesuai.']);
        return snapshot;
      })
      .catch((error: unknown) => {
        snapshotPromise = null;
        throw error;
      });
    return snapshotPromise;
  };
  return {
    getReferenceData,
    async getKabKotaGeometry(provinceId) {
      const references = await getReferenceData();
      const regions = references.kabKota.filter((region) => region.provinceId === provinceId);
      const path = regions.find((region) => region.geometryUrl)?.geometryUrl;
      if (!path) return regions;
      let pending = geometryCache.get(provinceId);
      if (!pending) {
        pending = readJson(path).then((value) => {
          const collection = value as { type?: unknown; features?: unknown } | null;
          if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features))
            throw new DataValidationError([`Geometri ${path} bukan FeatureCollection`]);
          const features = new Map<string, unknown>();
          for (const value of collection.features) {
            const feature = value as { properties?: { id?: unknown }; geometry?: unknown } | null;
            const id = feature?.properties?.id;
            if (typeof id !== 'string' || !regions.some((region) => region.id === id) || features.has(id))
              throw new DataValidationError([`Geometri ${path}: ID asing atau duplikat ${String(id)}`]);
            features.set(id, feature?.geometry);
          }
          return parseReferenceData({ ...references, kabKota: regions.map((region) => ({
            ...region, geometry: features.get(region.id) ?? region.geometry,
          })) }).kabKota;
        }).catch((error: unknown) => {
          geometryCache.delete(provinceId);
          throw error;
        });
        geometryCache.set(provinceId, pending);
      }
      return pending;
    },
    async listInstansi(filters = {}) {
      const source = await getSnapshot();
      return {
        items: filterInstansi(source.instansi, filters),
        metadata: source.metadata,
      };
    },
    async getInstansiDetail(id): Promise<InstansiDetail | null> {
      const source = await getSnapshot();
      const instansi = source.instansi.find((item) => item.id === id);
      if (!instansi) return null;
      const record = source.statistics.find((item) => item.instansiId === id);
      const empty = {
        statistik: {
          jumlahArsip: unknownMetric(
            source.metadata,
            source.metadata.metricDefinitions.jumlahArsip ??
              'Definisi jumlah arsip belum tersedia',
          ),
          penciptaArsip: unknownMetric(
            source.metadata,
            source.metadata.metricDefinitions.penciptaArsip ??
              'Definisi entitas pencipta unik belum tersedia',
          ),
          kopiDigital: unknownMetric(
            source.metadata,
            source.metadata.metricDefinitions.kopiDigital ??
              'Definisi kopi digital belum tersedia',
          ),
        },
        trenInput: null,
        distribusiArsip: null,
        penciptaArsip: null,
        multiCreator: null,
        monthlyAdded: null,
      };
      return { ...(record ?? empty), instansi, metadata: source.metadata };
    },
  };
}

/** Sumber kolaborasi sama pada dev, build dan preview; tidak membaca environment privat. */
export function createSharedRepository(mode: 'pilot' | 'excel' | 'demo'): InstansiRepository {
  if (mode === 'demo') return createLocalRepository(true, false, false);
  return createLocalRepository(false, false, mode === 'pilot', {
    ...SHARED_DATASETS[mode], datasetKind: mode,
  });
}
