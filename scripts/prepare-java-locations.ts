import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { PILOT_PROVINCES, type PilotLocation } from './build-local-pilot';

/** Katalog administratif dan hasil penelitian digabung hanya melalui ID Excel. */
export function preparePilotLocations(excel: SnapshotData, refs: ReferenceData, reviews: PilotLocation[], provinceIds: ReadonlySet<string>) {
  const institutions = new Map(excel.instansi.map((item) => [item.id, item]));
  const locations = new Map<string, PilotLocation>();
  const exceptions: { id: string; name: string; reason: string }[] = [];
  const referenceUrls = refs.metadata.sources.filter((source) => source.startsWith('https://'));
  for (const item of excel.instansi) {
    if (!item.provinceId || !provinceIds.has(item.provinceId) || item.locationVerificationStatus !== 'verified') continue;
    locations.set(item.id, {
      instansiId: item.id, name: item.name, joinedYear: item.joinedYear,
      provinceId: item.provinceId, kabKotaId: item.kabKotaId, coordinates: null,
      address: null, googleMapsPlaceUrl: null,
      sourceUrls: referenceUrls, capturedAt: excel.metadata.capturedAt,
      locationVerificationStatus: 'verified',
      notes: `${item.locationVerificationNotes} Identitas wilayah administratif dari nama sumber; belum membuktikan lokasi gedung kantor. Tidak dibuat marker pengganti.`,
    });
  }
  const reviewed = new Set<string>();
  for (const review of reviews) {
    const original = institutions.get(review.instansiId);
    if (!original) throw new Error(`ID penelitian ${review.instansiId} tidak ada dalam snapshot Excel.`);
    if (review.name !== undefined && review.name !== original.name) throw new Error(`Nama penelitian berbeda pada ID ${original.id}.`);
    if (review.joinedYear !== undefined && review.joinedYear !== original.joinedYear) throw new Error(`Tahun penelitian berbeda pada ID ${original.id}.`);
    if (!provinceIds.has(review.provinceId)) throw new Error(`Penelitian ${original.id} berada di luar cakupan provinsi yang dipilih.`);
    if (!Array.isArray(review.sourceUrls) || !review.sourceUrls.length) {
      if (!locations.has(original.id)) exceptions.push({ id: original.id, name: original.name,
        reason: 'Kandidat wilayah belum dilengkapi bukti publik; belum dimasukkan ke cakupan pilot.' });
      continue;
    }
    const previous = locations.get(original.id);
    if (reviewed.has(original.id) && previous &&
      (previous.provinceId !== review.provinceId || previous.kabKotaId !== review.kabKotaId))
      throw new Error(`Konflik wilayah dua hasil penelitian untuk ${original.id} (${original.name}); tinjau manual.`);
    if (previous?.coordinates && review.coordinates &&
      (JSON.stringify(previous.coordinates) !== JSON.stringify(review.coordinates) || previous.kabKotaId !== review.kabKotaId))
      throw new Error(`Konflik dua pin untuk ${original.id} (${original.name}); tinjau manual, tidak memilih salah satunya otomatis.`);
    if (previous?.coordinates && !review.coordinates) {
      if (review.locationVerificationStatus === 'needs-review')
        throw new Error(`Penarikan pin ${original.id} (${original.name}) perlu resolusi manual; sumber lama tidak dipertahankan diam-diam.`);
      continue;
    }
    if (!previous && review.locationVerificationStatus !== 'verified' && !review.administrativeVerified) {
      exceptions.push({ id: original.id, name: original.name, reason: review.notes });
      continue;
    }
    locations.set(original.id, { ...structuredClone(review), name: original.name, joinedYear: original.joinedYear });
    reviewed.add(original.id);
  }
  const records = [...locations.values()].sort((a, b) => a.instansiId.localeCompare(b.instansiId));
  return {
    records,
    report: {
      sourceSnapshotId: excel.metadata.id, sourceRecords: excel.instansi.length,
      selected: records.length, withOfficePin: records.filter((item) => item.coordinates).length,
      missingOfficePin: records.filter((item) => !item.coordinates).length,
      reviewedIds: [...reviewed].sort(), exceptions,
      notYetIncluded: excel.instansi.filter((item) => !locations.has(item.id)).map((item) => ({
        id: item.id, name: item.name, jenisId: item.jenisId, provinceId: item.provinceId,
        reason: item.provinceId && !provinceIds.has(item.provinceId) ? 'Wilayah sumber di luar cakupan pilot.' : 'Belum mempunyai penempatan wilayah yang terverifikasi; tetap tersedia di snapshot Excel penuh.',
      })),
      note: 'Kelengkapan katalog administratif berbeda dari kelengkapan pin kantor. Tidak menyatakan seluruh K/L/kampus telah dipetakan ke cakupan pilot.',
    },
  };
}

/** Kontrak lama Jawa tetap tersedia untuk pipeline dan pengujian sebelumnya. */
export function prepareJavaLocations(excel: SnapshotData, refs: ReferenceData, reviews: PilotLocation[]) {
  return preparePilotLocations(excel, refs, reviews, PILOT_PROVINCES);
}

async function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) throw new Error('Pemakaian: npm run prepare:java -- lokasi-lama.json penelitian-jabar.json penelitian-jateng-diy.json penelitian-jatim.json');
  const excel = JSON.parse(await readFile('.local/casefile/snapshot.json', 'utf8')) as SnapshotData;
  const refs = JSON.parse(await readFile('public/data/references.json', 'utf8')) as ReferenceData;
  const reviews: PilotLocation[] = [];
  const researchExceptions: Record<string, unknown>[] = [];
  for (const input of inputs) {
    const data: unknown = JSON.parse(await readFile(resolve(input), 'utf8'));
    const records = Array.isArray(data) ? data : data && typeof data === 'object' && 'records' in data ? data.records : null;
    if (!Array.isArray(records)) throw new Error(`Berkas ${input} tidak mempunyai array records.`);
    reviews.push(...records as PilotLocation[]);
    if (data && typeof data === 'object' && 'exceptions' in data && Array.isArray(data.exceptions)) {
      for (const exception of data.exceptions) {
        if (!exception || typeof exception !== 'object' || typeof exception.instansiId !== 'string')
          throw new Error(`Pengecualian dalam ${input} memerlukan instansiId sumber.`);
        const original = excel.instansi.find((item) => item.id === exception.instansiId);
        if (!original || (exception.name !== undefined && exception.name !== original.name))
          throw new Error(`Identitas pengecualian tidak cocok dengan Excel: ${exception.instansiId}.`);
        researchExceptions.push({ ...exception, name: original.name, sourceFile: input });
      }
    }
  }
  const result = prepareJavaLocations(excel, refs, reviews);
  await mkdir('.local/java', { recursive: true });
  await writeFile('.local/java/locations.json', `${JSON.stringify({ records: result.records }, null, 2)}\n`);
  await writeFile('.local/java/coverage-report.json', `${JSON.stringify({ ...result.report, researchExceptions }, null, 2)}\n`);
  process.stdout.write(`Katalog Jawa: ${result.records.length} ID, ${result.report.withOfficePin} pin kantor, ${result.report.missingOfficePin} tanpa pin. Keluaran privat .local/java/.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
