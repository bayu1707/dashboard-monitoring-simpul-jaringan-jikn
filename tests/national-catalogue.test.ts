import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { buildPilotSnapshot, type PilotLocation } from '../scripts/build-local-pilot';
import { completeNationalPilot } from '../scripts/build-national-pilot';

const read = <T,>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const references = read<ReferenceData>('public/data/references.json');
const excel = read<SnapshotData>('public/data/datasets/excel/snapshot.json');
const current = read<SnapshotData>('public/data/datasets/pilot/snapshot.json');
const reviews = read<{ records: PilotLocation[] }>('data/curation/national-completion-locations.json').records;
const scope = { provinceIds: new Set(references.provinces.map((row) => row.id)), label: 'Indonesia' };
for (const province of scope.provinceIds) for (const feature of read<FeatureCollection>(`public/data/geometry/kab-kota/${province}.json`).features) {
  const region = references.kabKota.find((row) => row.id === String(feature.id));
  if (region) region.geometry = feature.geometry;
}
const addition = buildPilotSnapshot(excel, references, reviews, [], scope);

describe('Katalog Indonesia tanpa mengarang lokasi atau mengubah identitas Excel', () => {
  it('643 ID/nama/kode/kategori/tahun sama persis dengan Excel; kode ganda tetap record terpisah', () => {
    expect(current.instansi).toHaveLength(643);
    expect(new Set(current.instansi.map((row) => row.id)).size).toBe(643);
    expect(current.instansi.map((row) => row.id).sort()).toEqual(excel.instansi.map((row) => row.id).sort());
    for (const row of current.instansi) {
      const source = excel.instansi.find((item) => item.id === row.id)!;
      for (const key of ['name', 'kode', 'jenisId', 'joinedYear', 'joinedYearSource'] as const) expect(row[key]).toEqual(source[key]);
      expect(row.email).toBeNull(); expect(row.phone).toBeNull();
    }
    for (const code of ['31025-1', '25316-5'])
      expect(current.instansi.filter((row) => row.kode === code).map((row) => row.id).sort())
        .toEqual(excel.instansi.filter((row) => row.kode === code).map((row) => row.id).sort());
    expect(createHash('sha256').update(readFileSync('public/data/datasets/excel/snapshot.json')).digest('hex'))
      .toBe('da653f461b63fd8bd9bc4b2e451f7549080a761eb5a3f69feacddd89f9293fa0');
  });
  it('90 tambahan melalui validasi fitur/polygon; 12 pengecualian tidak dibuatkan pin', () => {
    expect(addition.snapshot.instansi).toHaveLength(90);
    expect(addition.report.validOfficeCoordinates).toBe(78);
    expect(addition.report.missingOfficeCoordinates).toBe(12);
    expect(current.instansi.filter((row) => row.coordinates)).toHaveLength(627);
    expect(current.instansi.filter((row) => !row.coordinates)).toHaveLength(16);
    const kaimana = current.instansi.find((row) => row.id === 'casefile-73ece091bc2cb474bb139b9a')!;
    expect(kaimana.provinceId).toBe('92'); expect(kaimana.kabKotaId).toBe('92.08');
    expect(kaimana.coordinates).toBeNull(); expect(kaimana.locationVerificationStatus).toBe('needs-review');
    expect(current.instansi.find((row) => row.id === 'casefile-a23fa92695af7586e7667659')?.provinceId).toBe('95');
    const pin = reviews.find((row) => row.coordinates && !row.geometryReview)!;
    expect(() => buildPilotSnapshot(excel, references, [{ ...pin, coordinates: [0, 0] }], [], scope)).toThrow();
    expect(addition.report.geometryReviews).toHaveLength(1);
  });
  it('553 record lama/pin/tautan/statistik dipertahankan; rebuild dan urutan sumber stabil', () => {
    const merged = completeNationalPilot(current, addition.snapshot, references, excel);
    const addedIds = new Set(reviews.map((row) => row.instansiId));
    expect(merged.retainedRecords).toBe(553);
    expect(merged.snapshot.instansi.filter((row) => !addedIds.has(row.id)))
      .toEqual(current.instansi.filter((row) => !addedIds.has(row.id)));
    expect(merged.snapshot.instansi).toEqual(current.instansi);
    expect(completeNationalPilot(merged.snapshot, addition.snapshot, references, excel)).toEqual(merged);
    const reverseAddition = buildPilotSnapshot({ ...excel, instansi: [...excel.instansi].reverse() }, references, [...reviews].reverse(), [], scope);
    expect(reverseAddition.snapshot).toEqual(addition.snapshot);
    const retainedIds = new Set(merged.snapshot.instansi.filter((row) => !addedIds.has(row.id)).map((row) => row.id));
    for (const row of current.statistics.filter((item) => retainedIds.has(item.instansiId)))
      expect(merged.snapshot.statistics.find((item) => item.instansiId === row.instansiId)).toEqual({ ...row,
        statistik: Object.fromEntries(Object.entries(row.statistik).map(([key, metric]) => [key, { ...metric, snapshotId: merged.snapshot.metadata.id }])) });
    expect(current.instansi.filter((row) => row.landingPageVerificationStatus === 'verified')).toHaveLength(1);
    expect(current.instansi.find((row) => row.name === 'Arsip Nasional RI')?.landingPageUrl)
      .toBe('https://jikn.anri.go.id/deskripsi-arsip/sj/3bcfbe8a-34bc-4f7c-a997-01b961e085b9');
  });
  it('38/514 referensi lazily loaded, total nasional tetap null dan statistik simulasi terpisah', () => {
    const merged = completeNationalPilot(current, addition.snapshot, references, excel);
    expect(merged.references.provinces).toHaveLength(38); expect(merged.references.kabKota).toHaveLength(514);
    expect(merged.references.kabKota.every((row) => row.geometry === null && row.geometryUrl)).toBe(true);
    expect(merged.snapshot.metadata.nationalTotal).toBeNull();
    expect(merged.snapshot.metadata.sampleTotal?.value).toBe(merged.snapshot.statistics.reduce((sum, row) => sum + row.statistik.jumlahArsip.value!, 0));
    expect(merged.snapshot.statistics.every((row) => Object.values(row.statistik).every((metric) =>
      metric.snapshotId === merged.snapshot.metadata.id && metric.definition.includes('SIMULASI')))).toBe(true);
    expect(excel.statistics).toHaveLength(0);
  });
  it('penambahan hilang, ID ganda, identitas/tahun berubah dan mode salah ditolak', () => {
    const incomplete = structuredClone(addition.snapshot);
    incomplete.instansi.pop();
    const oldOnly = { ...current, instansi: current.instansi.filter((row) => !reviews.some((item) => item.instansiId === row.id)) };
    expect(() => completeNationalPilot(oldOnly, incomplete, references, excel)).toThrow(/Cakupan/);
    const duplicate = structuredClone(addition.snapshot); duplicate.instansi.push(duplicate.instansi[0]!);
    expect(() => completeNationalPilot(current, duplicate, references, excel)).toThrow(/Duplikasi/);
    const renamed = structuredClone(addition.snapshot); renamed.instansi[0]!.joinedYear = 2000;
    expect(() => completeNationalPilot(current, renamed, references, excel)).toThrow(/Identitas/);
    expect(() => completeNationalPilot(excel, addition.snapshot, references, excel)).toThrow(/pilot/);
  });
});
