import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Geometry } from 'geojson';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { parseReferenceData, parseSnapshotData } from '../src/services/validation';
import { buildPilotSnapshot, type PilotLocation } from './build-local-pilot';
import { preparePilotLocations } from './prepare-java-locations';

export const KALIMANTAN_PROVINCES = new Set(['61', '62', '63', '64', '65']);
export const SULAWESI_PROVINCES = new Set(['71', '72', '73', '74', '75', '76']);
export const NEW_PROVINCES = new Set([...KALIMANTAN_PROVINCES, ...SULAWESI_PROVINCES]);
const LABEL = 'Jawa, Sumatra, Kalimantan dan Sulawesi';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Mengganti hanya cakupan baru agar rebuild stabil, sambil mempertahankan record/pin lama. */
export function extendPilot(base: SnapshotData, addition: SnapshotData, national: ReferenceData) {
  if (base.metadata.datasetKind !== 'pilot' || addition.metadata.datasetKind !== 'pilot')
    throw new Error('Perluasan hanya menerima snapshot pilot.');
  if (base.metadata.referenceDate !== addition.metadata.referenceDate)
    throw new Error('Tanggal acuan snapshot berbeda; perlu review.');
  const retained = base.instansi.filter((row) => !row.provinceId || !NEW_PROVINCES.has(row.provinceId));
  const retainedIds = new Set(retained.map((row) => row.id));
  const ids = new Set(retainedIds);
  for (const row of addition.instansi) {
    if (!row.provinceId || !NEW_PROVINCES.has(row.provinceId)) throw new Error('Tambahan di luar Kalimantan–Sulawesi.');
    if (ids.has(row.id)) throw new Error(`Duplikasi ID ${row.id}; record tidak digabung otomatis.`);
    ids.add(row.id);
  }
  const instansi = structuredClone([...retained, ...addition.instansi]).sort((a, b) => a.id.localeCompare(b.id));
  const statistics = structuredClone([
    ...base.statistics.filter((row) => retainedIds.has(row.instansiId)), ...addition.statistics,
  ]).sort((a, b) => a.instansiId.localeCompare(b.instansiId));
  const identity = digest({ instansi, statistics: statistics.map((row) => ({
    ...row, statistik: Object.fromEntries(Object.entries(row.statistik).map(([key, metric]) => [key, { ...metric, snapshotId: '' }])),
  })) });
  const metadata = structuredClone(addition.metadata);
  metadata.id = `pilot-jawa-sumatra-kalimantan-sulawesi-${identity.slice(0, 16)}`;
  metadata.capturedAt = [base.metadata.capturedAt, addition.metadata.capturedAt].sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)!;
  metadata.sources = [...new Set([...base.metadata.sources, ...addition.metadata.sources])].sort();
  metadata.verificationNotes = [...new Set([...base.metadata.verificationNotes, ...addition.metadata.verificationNotes])];
  metadata.coverageDescription = `Percontohan ${LABEL}: ${instansi.length} instansi dari snapshot Excel. Statistik DATA SIMULASI; pin publik perlu konfirmasi instansi. Bukan seluruh instansi nasional; record tanpa pin tersedia lewat Daftar.`;
  for (const row of statistics) for (const metric of Object.values(row.statistik)) metric.snapshotId = metadata.id;
  metadata.sampleTotal = { ...addition.metadata.sampleTotal!, snapshotId: metadata.id,
    value: statistics.reduce((sum, row) => sum + (row.statistik.jumlahArsip.value ?? 0), 0) };
  const allowed = new Set([...retained.map((row) => row.provinceId).filter((id): id is string => !!id), ...NEW_PROVINCES]);
  const references: ReferenceData = {
    ...structuredClone(national),
    provinces: structuredClone(national.provinces.filter((row) => allowed.has(row.id))),
    kabKota: national.kabKota.filter((row) => row.provinceId && allowed.has(row.provinceId))
      .map((row) => ({ ...structuredClone(row), geometry: row.geometryUrl ? null : structuredClone(row.geometry) })),
    archiveCategories: [
      { id: 'simulasi-dokumen', name: 'Dokumen (simulasi)' }, { id: 'simulasi-foto', name: 'Foto (simulasi)' },
      { id: 'simulasi-audio', name: 'Audio (simulasi)' }, { id: 'simulasi-video', name: 'Video (simulasi)' },
    ],
    metadata: { ...structuredClone(national.metadata), id: `referensi-${metadata.id}`, coverage: 'partial', nationalTotal: null, sampleTotal: null,
      coverageDescription: `27 provinsi di ${LABEL}; seluruh kab/kota referensi dalam cakupan tersedia, geometri dimuat per provinsi.` },
  };
  const snapshot: SnapshotData = { metadata, instansi, statistics };
  parseReferenceData(references); parseSnapshotData(snapshot, references);
  return { snapshot, references, retainedRecords: retained.length, retainedRecordDigest: digest(retained) };
}

async function main() {
  const read = async (path: string) => JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  const references = parseReferenceData(await read('public/data/references.json'));
  const excelBytes = await readFile('public/data/datasets/excel/snapshot.json');
  const excel = parseSnapshotData(JSON.parse(excelBytes.toString('utf8')), references);
  const baseRefs = parseReferenceData(await read('public/data/datasets/pilot/references.json'));
  const base = parseSnapshotData(await read('public/data/datasets/pilot/snapshot.json'), baseRefs);
  const reviews = await read('data/curation/kalimantan-sulawesi-locations.json') as { records: PilotLocation[] };
  const prepared = preparePilotLocations(excel, references, reviews.records, NEW_PROVINCES);
  for (const province of NEW_PROVINCES) {
    const geo = await read(`public/data/geometry/kab-kota/${province}.json`) as { features: { id: string; geometry: Geometry }[] };
    for (const feature of geo.features) {
      const region = references.kabKota.find((row) => row.id === String(feature.id));
      if (region) region.geometry = feature.geometry;
    }
  }
  const addition = buildPilotSnapshot(excel, references, prepared.records, [], { provinceIds: NEW_PROVINCES, label: 'Kalimantan dan Sulawesi' });
  const result = extendPilot(base, addition.snapshot, references);
  const output = resolve('.local/kalimantan-sulawesi/staged');
  await mkdir(output, { recursive: true });
  const report = { ...addition.report, preparationExceptions: prepared.report.exceptions,
    combinedRecords: result.snapshot.instansi.length, combinedPins: result.snapshot.instansi.filter((row) => row.coordinates).length,
    combinedProvinces: result.references.provinces.length, combinedKabKota: result.references.kabKota.length,
    retainedRecords: result.retainedRecords, retainedRecordDigest: result.retainedRecordDigest,
    sourceExcelSha256: createHash('sha256').update(excelBytes).digest('hex') };
  for (const [name, data] of Object.entries({ snapshot: result.snapshot, references: result.references, report }))
    await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  if (process.argv.includes('--publish')) {
    // Hanya keluaran pilot yang disetujui; workbook, Excel snapshot, dan bahan riset tidak ditulis.
    const paths = { snapshot: 'public/data/datasets/pilot/snapshot.json', references: 'public/data/datasets/pilot/references.json' };
    const manifest = await read('public/data/datasets/manifest.json') as {
      release: string; datasets: Record<string, Record<string, unknown>>; sha256: Record<string, string>;
    };
    for (const [name, path] of Object.entries(paths)) {
      const bytes = await readFile(resolve(output, `${name}.json`));
      await writeFile(path, bytes);
      manifest.sha256[`/${path.replace(/^public\//, '')}`] = createHash('sha256').update(bytes).digest('hex');
    }
    manifest.release = `kolaborasi-kalimantan-sulawesi-${result.snapshot.metadata.id.split('-').at(-1)}`;
    Object.assign(manifest.datasets.pilot!, { records: report.combinedRecords, pins: report.combinedPins,
      years: result.snapshot.instansi.filter((row) => row.joinedYear !== null).length,
      verifiedLandingPages: result.snapshot.instansi.filter((row) => row.landingPageVerificationStatus === 'verified').length });
    await writeFile('public/data/datasets/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`Tambahan ${report.selectedRecords} instansi/${report.validOfficeCoordinates} pin; gabungan ${report.combinedRecords} instansi/${report.combinedPins} pin, ${report.combinedProvinces} provinsi/${report.combinedKabKota} kab/kota. Laporan: ${output}/report.json`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
