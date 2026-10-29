import { readFileSync } from 'node:fs';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { buildPilotSnapshot, PILOT_PROVINCES, SUMATRA_PROVINCES, type PilotLocation } from '../scripts/build-local-pilot';
import { preparePilotLocations } from '../scripts/prepare-java-locations';
import { mergeIslandPilots } from '../scripts/build-sumatra-pilot';
const read = <T,>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const excel = read<SnapshotData>('public/data/datasets/excel/snapshot.json');
const references = read<ReferenceData>('public/data/references.json');
for (const provinceId of SUMATRA_PROVINCES) for (const feature of read<FeatureCollection>(`public/data/geometry/kab-kota/${provinceId}.json`).features) {
  const region = references.kabKota.find((item) => item.id === String(feature.id));
  if (region) region.geometry = feature.geometry;
}
const pilot = read<SnapshotData>('public/data/datasets/pilot/snapshot.json');
const reviews = read<{ records: PilotLocation[] }>('data/curation/sumatra-locations.json').records;
const prepared = preparePilotLocations(excel, references, reviews, SUMATRA_PROVINCES);
const sumatra = buildPilotSnapshot(excel, references, prepared.records, [], { provinceIds: SUMATRA_PROVINCES, label: 'Sumatra' });
describe('Perluasan Sumatra memakai identitas snapshot yang sama', () => {
  it('169 record, 10 provinsi/154 kab/kota, termasuk alias administratif dan kampus yang ditinjau', () => {
    expect(prepared.records).toHaveLength(169);
    expect(sumatra.references.provinces).toHaveLength(10);
    expect(sumatra.references.kabKota).toHaveLength(154);
    const lkd = sumatra.snapshot.instansi.filter((row) => ['lkd-kabupaten', 'lkd-kota'].includes(row.jenisId ?? ''));
    expect(lkd).toHaveLength(154);
    // Kepemilikan LKD tetap kabupaten; pin kantor Padang Pariaman secara fisik di Kota Pariaman.
    for (const region of sumatra.references.kabKota) {
      const expected = region.id === '13.05' ? 0 : region.id === '13.77' ? 2 : 1;
      expect(lkd.filter((row) => row.kabKotaId === region.id)).toHaveLength(expected);
    }
    expect(sumatra.snapshot.instansi.find((row) => row.name.includes('Kabupaten Padang Pariaman'))?.kabKotaId).toBe('13.77');
    const ids = new Set<string>();
    for (const item of sumatra.snapshot.instansi) {
      const source = excel.instansi.find((row) => row.id === item.id)!;
      expect(source).toBeDefined();
      for (const key of ['name', 'kode', 'joinedYear', 'jenisId'] as const) expect(item[key]).toEqual(source[key]);
      expect(ids.has(item.id)).toBe(false); ids.add(item.id);
      expect(item.email).toBeNull(); expect(item.phone).toBeNull();
    }
    expect(sumatra.snapshot.instansi.find((row) => row.id === 'casefile-65bfc3a611df7f00543cb305')?.kabKotaId).toBe('21.05');
  });
  it('urutan sumber tidak menukar identitas; konflik review tidak ditimpa', () => {
    const reverse = preparePilotLocations({ ...excel, instansi: [...excel.instansi].reverse() }, references, [...reviews].reverse(), SUMATRA_PROVINCES);
    expect(reverse.records).toEqual(prepared.records);
    const first = reviews[0]!;
    expect(() => preparePilotLocations(excel, references, [first, { ...first, provinceId: '21', kabKotaId: null }], SUMATRA_PROVINCES)).toThrow(/Konflik/);
  });
  it('tanpa koordinat tetap tersimpan, tidak berubah menjadi nol atau titik label wilayah', () => {
    expect(sumatra.report.validOfficeCoordinates).toBe(168);
    expect(sumatra.report.missingOfficeCoordinates).toBe(1);
    expect(sumatra.report.validOfficeCoordinates + sumatra.report.missingOfficeCoordinates).toBe(169);
    const noPin = sumatra.snapshot.instansi.find((row) => row.coordinates === null)!;
    expect(noPin.id).toBe('casefile-adadd4ae25edba10ef95bf6b');
    expect(noPin.coordinateSource).toBeUndefined();
    const withPin = prepared.records.find((row) => row.coordinates)!;
    expect(() => buildPilotSnapshot(excel, references, [{ ...withPin, coordinates: [0, 0], coordinateEvidence: '0, 0' }], [],
      { provinceIds: SUMATRA_PROVINCES, label: 'Sumatra' })).toThrow(/bounds|!3d/);
  });
  it('ID/pin Jawa yang sudah ada tetap dipertahankan; merge berulang stabil dan metrik satu snapshot', () => {
    const before = pilot.instansi.filter((row) => row.provinceId && PILOT_PROVINCES.has(row.provinceId));
    const merged = mergeIslandPilots(pilot, sumatra.snapshot, references);
    expect(before.length).toBeGreaterThanOrEqual(249);
    expect(before.every((row) => row.coordinates !== null)).toBe(true);
    expect(merged.snapshot.instansi.filter((row) => row.provinceId && PILOT_PROVINCES.has(row.provinceId))).toEqual(before);
    expect(merged.snapshot.instansi).toHaveLength(before.length + 169);
    expect(mergeIslandPilots(merged.snapshot, sumatra.snapshot, references)).toEqual(merged);
    expect(merged.snapshot.metadata.nationalTotal).toBeNull();
    expect(merged.snapshot.metadata.sampleTotal?.value).toBe(merged.snapshot.statistics.reduce((total, row) => total + row.statistik.jumlahArsip.value!, 0));
    expect(merged.snapshot.statistics.every((row) => Object.values(row.statistik).every((metric) => metric.snapshotId === merged.snapshot.metadata.id && metric.definition.includes('SIMULASI')))).toBe(true);
    const javaIds = new Set(before.map((row) => row.id));
    for (const stat of pilot.statistics.filter((row) => javaIds.has(row.instansiId))) {
      const after = merged.snapshot.statistics.find((row) => row.instansiId === stat.instansiId)!;
      expect(Object.values(after.statistik).map((metric) => metric.value)).toEqual(Object.values(stat.statistik).map((metric) => metric.value));
    }
  });
});
