import type {
  InstansiDetail,
  InstansiRepository,
  ReferenceData,
  SnapshotData,
} from '../types/domain';
import { filterInstansi } from './exploration';
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
export function createLocalRepository(demo: boolean): InstansiRepository {
  const base = demo ? '/demo' : '/data';
  let referencePromise: Promise<ReferenceData> | null = null;
  let snapshotPromise: Promise<SnapshotData> | null = null;
  const getReferenceData = () => {
    referencePromise ??= readJson(`${base}/references.json`)
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
      readJson(`${base}/snapshot.json`),
    ])
      .then(([references, source]) => {
        const snapshot = parseSnapshotData(source, references);
        if (demo !== (snapshot.metadata.datasetKind === 'demo'))
          throw new DataValidationError([
            'Mode dan penanda dataset demo tidak sesuai.',
          ]);
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
