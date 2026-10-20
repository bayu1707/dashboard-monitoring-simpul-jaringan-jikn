import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Geometry } from 'geojson';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { parseReferenceData, parseSnapshotData } from '../src/services/validation';
import { buildPilotSnapshot, PILOT_PROVINCES, SUMATRA_PROVINCES, type PilotLocation } from './build-local-pilot';
import { preparePilotLocations } from './prepare-java-locations';

/** Mempertahankan identitas/pin/angka Jawa; hanya konteks snapshot metric yang diganti. */
export function mergeIslandPilots(java: SnapshotData, sumatra: SnapshotData, refs: ReferenceData) {
  if (java.metadata.datasetKind !== 'pilot' || sumatra.metadata.datasetKind !== 'pilot') throw new Error('Merge hanya untuk dua snapshot pilot, bukan dataset demo atau API.');
  const previous = java.instansi.filter((row) => row.provinceId && PILOT_PROVINCES.has(row.provinceId));
  const ids = new Set(previous.map((row) => row.id));
  if (sumatra.instansi.some((row) => ids.has(row.id))) throw new Error('ID Jawa dan Sumatra bertabrakan; perlu review, tidak digabung otomatis.');
  if (java.metadata.referenceDate !== sumatra.metadata.referenceDate) throw new Error('Tanggal acuan antar-pilot berbeda.');
  const instansi = [...structuredClone(previous), ...structuredClone(sumatra.instansi)].sort((a, b) => a.id.localeCompare(b.id));
  const sourceStatistics = [...java.statistics.filter((row) => ids.has(row.instansiId)), ...sumatra.statistics];
  const digest = createHash('sha256').update(JSON.stringify({ instansi, sumatra: sumatra.metadata.id,
    javaValues: sourceStatistics.filter((row) => ids.has(row.instansiId)).map((row) => ({ id: row.instansiId,
      values: Object.values(row.statistik).map((metric) => metric.value) })) })).digest('hex').slice(0, 16);
  const metadata = structuredClone(sumatra.metadata);
  metadata.id = `pilot-jawa-sumatra-${digest}`;
  metadata.capturedAt = [java.metadata.capturedAt, sumatra.metadata.capturedAt].sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)!;
  metadata.sources = [...new Set([...java.metadata.sources, ...sumatra.metadata.sources])].sort();
  metadata.coverageDescription = `Percontohan Jawa dan Sumatra: ${instansi.length} instansi terpilih dari snapshot Excel; bukan seluruh instansi nasional. Pin publik bukan pengesahan lokasi lapangan oleh ANRI. Instansi tanpa pin tetap tersedia lewat Daftar.`;
  metadata.verificationNotes = [...new Set([...java.metadata.verificationNotes.filter((note) => !note.startsWith('Berkas pilot hanya untuk review localhost')), ...sumatra.metadata.verificationNotes])];
  const statistics = structuredClone(sourceStatistics).sort((a, b) => a.instansiId.localeCompare(b.instansiId));
  for (const row of statistics) for (const metric of Object.values(row.statistik)) metric.snapshotId = metadata.id;
  metadata.sampleTotal = { ...sumatra.metadata.sampleTotal!, snapshotId: metadata.id,
    value: statistics.reduce((total, row) => total + (row.statistik.jumlahArsip.value ?? 0), 0) };
  const allowed = new Set([...PILOT_PROVINCES, ...SUMATRA_PROVINCES]);
  const references: ReferenceData = {
    ...structuredClone(refs),
    provinces: refs.provinces.filter((row) => allowed.has(row.id)),
    kabKota: refs.kabKota.filter((row) => row.provinceId && allowed.has(row.provinceId))
      .map((row) => ({ ...row, geometry: row.geometryUrl ? null : row.geometry })),
    archiveCategories: structuredClone(
      [{ id: 'simulasi-dokumen', name: 'Dokumen (simulasi)' }, { id: 'simulasi-foto', name: 'Foto (simulasi)' },
        { id: 'simulasi-audio', name: 'Audio (simulasi)' }, { id: 'simulasi-video', name: 'Video (simulasi)' }]),
    metadata: { ...structuredClone(refs.metadata), id: `referensi-${metadata.id}`, coverage: 'partial', nationalTotal: null,
      coverageDescription: '16 provinsi Jawa dan kawasan Sumatra (termasuk Kepulauan Riau dan Kepulauan Bangka Belitung); geometri kab/kota dimuat saat dipilih.' },
  };
  const snapshot = { metadata, instansi, statistics };
  parseReferenceData(references); parseSnapshotData(snapshot, references);
  return { snapshot, references };
}

async function main() {
  const read = async (path: string) => JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  const references = parseReferenceData(await read('public/data/references.json'));
  const excel = parseSnapshotData(await read('public/data/datasets/excel/snapshot.json'), references);
  const javaRefs = parseReferenceData(await read('public/data/datasets/pilot/references.json'));
  const java = parseSnapshotData(await read('public/data/datasets/pilot/snapshot.json'), javaRefs);
  const reviews = await read('data/curation/sumatra-locations.json') as { records: PilotLocation[] };
  const catalogue = preparePilotLocations(excel, references, reviews.records, SUMATRA_PROVINCES);
  for (const provinceId of SUMATRA_PROVINCES) {
    const collection = await read(`public/data/geometry/kab-kota/${provinceId}.json`) as { features: { id: string; geometry: Geometry }[] };
    for (const feature of collection.features) {
      const region = references.kabKota.find((item) => item.id === String(feature.id));
      if (region) region.geometry = feature.geometry;
    }
  }
  const sumatra = buildPilotSnapshot(excel, references, catalogue.records, [], { provinceIds: SUMATRA_PROVINCES, label: 'Sumatra' });
  const merged = mergeIslandPilots(java, sumatra.snapshot, references);
  const output = resolve('.local/sumatra/staged');
  await mkdir(output, { recursive: true });
  const report = { ...sumatra.report, preparationExceptions: catalogue.report.exceptions,
    combinedRecords: merged.snapshot.instansi.length, combinedPins: merged.snapshot.instansi.filter((item) => item.coordinates).length,
    combinedProvinces: merged.references.provinces.length, combinedKabKota: merged.references.kabKota.length };
  for (const [name, data] of Object.entries({ ...merged, report }))
    await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Sumatra: ${sumatra.report.selectedRecords} instansi; ${sumatra.report.validOfficeCoordinates} pin; ${sumatra.report.missingOfficeCoordinates} tanpa pin. Gabungan: ${report.combinedRecords} instansi, ${report.combinedPins} pin. Hasil review lokal: ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
