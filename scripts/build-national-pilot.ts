import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FeatureCollection } from 'geojson';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { parseReferenceData, parseSnapshotData } from '../src/services/validation';
import { buildPilotSnapshot, type PilotLocation } from './build-local-pilot';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Menambah identitas yang tersisa tanpa membangun ulang pin/statistik hasil kurasi sebelumnya. */
export function completeNationalPilot(base: SnapshotData, addition: SnapshotData, national: ReferenceData, excel: SnapshotData) {
  if (base.metadata.datasetKind !== 'pilot' || addition.metadata.datasetKind !== 'pilot')
    throw new Error('Penyelesaian nasional hanya menerima snapshot pilot.');
  if (base.metadata.referenceDate !== addition.metadata.referenceDate)
    throw new Error('Tanggal acuan sumber berbeda; perlu review.');
  const replacementIds = new Set(addition.instansi.map((row) => row.id));
  if (replacementIds.size !== addition.instansi.length) throw new Error('Duplikasi ID pada tambahan nasional.');
  const retained = base.instansi.filter((row) => !replacementIds.has(row.id));
  const retainedIds = new Set(retained.map((row) => row.id));
  const instansi = structuredClone([...retained, ...addition.instansi]).sort((a, b) => a.id.localeCompare(b.id));
  const source = new Map(excel.instansi.map((row) => [row.id, row]));
  if (new Set(instansi.map((row) => row.id)).size !== source.size || instansi.length !== source.size)
    throw new Error('Cakupan nasional harus sama persis dengan seluruh ID snapshot Excel.');
  for (const row of instansi) {
    const original = source.get(row.id);
    if (!original || (['name', 'kode', 'joinedYear', 'jenisId', 'joinedYearSource'] as const)
      .some((key) => JSON.stringify(row[key]) !== JSON.stringify(original[key])))
      throw new Error(`Identitas/tahun berubah: ${row.id}.`);
  }
  const statistics = structuredClone([
    ...base.statistics.filter((row) => retainedIds.has(row.instansiId)), ...addition.statistics,
  ]).sort((a, b) => a.instansiId.localeCompare(b.instansiId));
  const identity = digest({ instansi, statistics: statistics.map((row) => ({ ...row,
    statistik: Object.fromEntries(Object.entries(row.statistik).map(([key, metric]) => [key, { ...metric, snapshotId: '' }])),
  })) });
  const metadata = structuredClone(addition.metadata);
  metadata.id = `pilot-indonesia-${identity.slice(0, 16)}`;
  metadata.capturedAt = [base.metadata.capturedAt, addition.metadata.capturedAt]
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)!;
  metadata.sources = [...new Set([...base.metadata.sources, ...addition.metadata.sources])].sort();
  metadata.verificationNotes = [...new Set([...base.metadata.verificationNotes, ...addition.metadata.verificationNotes])];
  metadata.coverageDescription = `Seluruh ${instansi.length} identitas pada snapshot Excel dalam referensi 38 provinsi/514 kabupaten-kota. Statistik DATA SIMULASI; pin publik perlu konfirmasi instansi. Bukan klaim seluruh instansi aktif SIKN atau lokasi kantor terverifikasi lapangan. Record tanpa pin tetap tersedia melalui Daftar dan pencarian.`;
  for (const row of statistics) for (const metric of Object.values(row.statistik)) metric.snapshotId = metadata.id;
  metadata.sampleTotal = { ...addition.metadata.sampleTotal!, snapshotId: metadata.id,
    value: statistics.reduce((sum, row) => sum + (row.statistik.jumlahArsip.value ?? 0), 0) };
  metadata.nationalTotal = null;
  metadata.coverage = 'partial';
  const references: ReferenceData = {
    ...structuredClone(national),
    kabKota: national.kabKota.map((row) => ({ ...structuredClone(row), geometry: row.geometryUrl ? null : structuredClone(row.geometry) })),
    metadata: { ...structuredClone(national.metadata), id: `referensi-${metadata.id}`, coverage: 'partial', nationalTotal: null, sampleTotal: null,
      coverageDescription: '38 provinsi dan 514 kabupaten/kota; geometri kabupaten/kota dimuat saat provinsi dibuka. Kelengkapan referensi wilayah bukan pengesahan koordinat kantor.' },
  };
  // Taksonomi simulasi tetap terpisah dari kategori Excel.
  references.archiveCategories = [
    { id: 'simulasi-dokumen', name: 'Dokumen (simulasi)' }, { id: 'simulasi-foto', name: 'Foto (simulasi)' },
    { id: 'simulasi-audio', name: 'Audio (simulasi)' }, { id: 'simulasi-video', name: 'Video (simulasi)' },
  ];
  const snapshot: SnapshotData = { metadata, instansi, statistics };
  parseReferenceData(references); parseSnapshotData(snapshot, references);
  return { snapshot, references, retainedRecords: retained.length, retainedRecordDigest: digest(retained) };
}

async function main() {
  const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;
  const national = parseReferenceData(await read('public/data/references.json'));
  const excelBytes = await readFile('public/data/datasets/excel/snapshot.json');
  const excel = parseSnapshotData(JSON.parse(excelBytes.toString('utf8')), national);
  const baseRefs = parseReferenceData(await read('public/data/datasets/pilot/references.json'));
  const base = parseSnapshotData(await read('public/data/datasets/pilot/snapshot.json'), baseRefs);
  const reviews = await read('data/curation/national-completion-locations.json') as { records: PilotLocation[] };
  const scope = { provinceIds: new Set(national.provinces.map((row) => row.id)), label: 'Indonesia' };
  for (const province of scope.provinceIds) {
    const geo = await read(`public/data/geometry/kab-kota/${province}.json`) as FeatureCollection;
    for (const feature of geo.features) {
      const region = national.kabKota.find((row) => row.id === String(feature.id));
      if (region) region.geometry = feature.geometry;
    }
  }
  const addition = buildPilotSnapshot(excel, national, reviews.records, [], scope);
  const result = completeNationalPilot(base, addition.snapshot, national, excel);
  const report = { addition: addition.report, retainedRecords: result.retainedRecords,
    retainedRecordDigest: result.retainedRecordDigest, records: result.snapshot.instansi.length,
    pins: result.snapshot.instansi.filter((row) => row.coordinates).length,
    missingPins: result.snapshot.instansi.filter((row) => !row.coordinates).length,
    provinces: result.references.provinces.length, kabKota: result.references.kabKota.length,
    byCategory: Object.fromEntries(national.jenisInstansi.map((category) => [category.id,
      result.snapshot.instansi.filter((row) => row.jenisId === category.id).length])),
    byProvince: Object.fromEntries(national.provinces.map((province) => [province.id,
      result.snapshot.instansi.filter((row) => row.provinceId === province.id).length])),
    exceptions: result.snapshot.instansi.filter((row) => !row.coordinates).map((row) => ({
      id: row.id, name: row.name, provinceId: row.provinceId, kabKotaId: row.kabKotaId, reason: row.locationVerificationNotes,
    })), sourceExcelSha256: createHash('sha256').update(excelBytes).digest('hex') };
  const output = '.local/national-pilot/staged';
  await mkdir(output, { recursive: true });
  for (const [name, data] of Object.entries({ snapshot: result.snapshot, references: result.references, report }))
    await writeFile(`${output}/${name}.json`, `${JSON.stringify(data, null, 2)}\n`);
  if (process.argv.includes('--publish')) {
    const manifest = await read('public/data/datasets/manifest.json') as {
      release: string; datasets: Record<string, Record<string, unknown>>; sha256: Record<string, string>;
    };
    for (const name of ['snapshot', 'references']) {
      const path = `public/data/datasets/pilot/${name}.json`;
      const bytes = await readFile(`${output}/${name}.json`);
      await writeFile(path, bytes);
      manifest.sha256[`/${path.replace(/^public\//, '')}`] = createHash('sha256').update(bytes).digest('hex');
    }
    manifest.release = `kolaborasi-indonesia-${result.snapshot.metadata.id.split('-').at(-1)}`;
    Object.assign(manifest.datasets.pilot!, { records: report.records, pins: report.pins,
      years: result.snapshot.instansi.filter((row) => row.joinedYear !== null).length,
      verifiedLandingPages: result.snapshot.instansi.filter((row) => row.landingPageVerificationStatus === 'verified').length });
    await writeFile('public/data/datasets/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`${report.records} instansi/${report.pins} pin; ${report.provinces} provinsi/${report.kabKota} kabupaten-kota. ${report.exceptions.length} pengecualian: ${output}/report.json`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
