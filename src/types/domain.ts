import type { Geometry } from 'geojson';
export type Coordinates = [number, number]; // latitude, longitude (GeoJSON memakai urutan sebaliknya)
export type Bounds = [Coordinates, Coordinates];
export interface Metric {
  value: number | null;
  definition: string;
  scope: string;
  snapshotId: string;
  referenceDate: string;
}
export interface SnapshotMetadata {
  id: string;
  sources: string[];
  capturedAt: string; // ISO 8601 dengan zona waktu
  referenceDate: string;
  coverage: 'full' | 'partial';
  datasetKind: 'verified' | 'empty' | 'demo';
  metricDefinitions: Record<string, string>;
  verificationNotes: string[];
  nationalTotal: Metric | null;
}
export interface Wilayah {
  id: string;
  name: string;
  level: 'province' | 'kabKota';
  provinceId: string | null;
  geometry: Geometry | null;
  bounds: Bounds | null;
  labelPosition: Coordinates | null;
  source: string;
  sourceId: string | null;
}
export interface Kategori {
  id: string;
  name: string;
}
export interface ReferenceData {
  provinces: Wilayah[];
  kabKota: Wilayah[];
  jenisInstansi: Kategori[];
  archiveCategories: Kategori[];
  metadata: SnapshotMetadata;
}
export interface Instansi {
  id: string;
  name: string;
  kode: string | null;
  jenisId: string | null;
  provinceId: string;
  kabKotaId: string;
  provinceName: string;
  kabKotaName: string;
  email: string | null;
  phone: string | null;
  joinedYear: number | null;
  status: string | null;
  logoUrl: string | null;
  coordinates: Coordinates | null;
  sourceUpdatedAt: string | null;
  source: string;
}
export interface StatistikSimpul {
  jumlahArsip: Metric;
  penciptaArsip: Metric;
  kopiDigital: Metric;
}
export interface TrenInput {
  year: number;
  count: number | null;
}
export interface DistribusiArsip {
  categoryId: string;
  label: string;
  count: number | null;
}
export interface PenciptaArsip {
  id: string;
  name: string;
  count: number | null;
}
export interface StatistikRecord {
  instansiId: string;
  statistik: StatistikSimpul;
  trenInput: TrenInput[] | null;
  distribusiArsip: DistribusiArsip[] | null;
  penciptaArsip: PenciptaArsip[] | null;
  multiCreator: boolean | null;
  monthlyAdded: { yearMonth: string; count: number } | null;
}
export interface SnapshotData {
  metadata: SnapshotMetadata;
  instansi: Instansi[];
  statistics: StatistikRecord[];
}
export interface InstansiDetail extends Omit<StatistikRecord, 'instansiId'> {
  instansi: Instansi;
  metadata: SnapshotMetadata;
}
export type ExplorationLevel = 'nasional' | 'provinsi' | 'instansi';
export interface ExplorationState {
  level: ExplorationLevel;
  provinceId: string | null;
  kabKotaId: string | null;
  jenisId: string | null;
}
export interface MapSession {
  query: string;
  center: Coordinates;
  zoom: number;
  listScroll: number;
  listOpen: boolean;
}
export interface InstansiRepository {
  getReferenceData(): Promise<ReferenceData>;
  listInstansi(
    filters?: Partial<ExplorationState>,
  ): Promise<{ items: Instansi[]; metadata: SnapshotMetadata }>;
  getInstansiDetail(id: string): Promise<InstansiDetail | null>;
}
