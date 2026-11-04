import { readFileSync } from 'node:fs';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { buildPilotSnapshot, type PilotLocation } from '../scripts/build-local-pilot';
import { extendPilot, KALIMANTAN_PROVINCES, NEW_PROVINCES } from '../scripts/build-kalimantan-sulawesi-pilot';
import { preparePilotLocations } from '../scripts/prepare-java-locations';

const read = <T,>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const references = read<ReferenceData>('public/data/references.json');
const excel = read<SnapshotData>('public/data/datasets/excel/snapshot.json');
const current = read<SnapshotData>('public/data/datasets/pilot/snapshot.json');
const reviews = read<{ records: PilotLocation[] }>('data/curation/kalimantan-sulawesi-locations.json').records;
for (const provinceId of NEW_PROVINCES) {
  for (const feature of read<FeatureCollection>(`public/data/geometry/kab-kota/${provinceId}.json`).features) {
    const region = references.kabKota.find((row) => row.id === String(feature.id));
    if (region) region.geometry = feature.geometry;
  }
}
const prepared = preparePilotLocations(excel, references, reviews, NEW_PROVINCES);
const addition = buildPilotSnapshot(excel, references, prepared.records, [], { provinceIds: NEW_PROVINCES, label: 'Kalimantan dan Sulawesi' });

describe('Pilot Kalimantan–Sulawesi dan perlindungan katalog lama', () => {
  it('135 identitas Excel, 11 provinsi/137 kab-kota, tanpa menggabungkan kode/nama yang mirip', () => {
    expect(addition.snapshot.instansi).toHaveLength(135);
    expect(addition.references.provinces).toHaveLength(11);
    expect(addition.references.kabKota).toHaveLength(137);
    expect(addition.snapshot.instansi.filter((row) => KALIMANTAN_PROVINCES.has(row.provinceId!))).toHaveLength(62);
    expect(new Set(addition.snapshot.instansi.map((row) => row.id)).size).toBe(135);
    for (const row of addition.snapshot.instansi) {
      const source = excel.instansi.find((item) => item.id === row.id)!;
      expect(source).toBeDefined();
      for (const key of ['id', 'name', 'kode', 'jenisId', 'joinedYear', 'joinedYearSource'] as const)
        expect(row[key]).toEqual(source[key]);
      expect(row.email).toBeNull(); expect(row.phone).toBeNull();
      expect(row.landingPageUrl).toBeNull();
    }
  });
  it('132 pin melewati bukti fitur dan polygon; 3 pengecualian tetap null dan dapat ditemukan', () => {
    expect(addition.report.validOfficeCoordinates).toBe(132);
    expect(addition.report.missingOfficeCoordinates).toBe(3);
    const missing = addition.snapshot.instansi.filter((row) => row.coordinates === null);
    expect(missing.map((row) => row.id).sort()).toEqual([
      'casefile-4d38343a923ea5817d9ae016', 'casefile-bf1032193988af5c61840d5b', 'casefile-e155d6b135b6848523b25714',
    ]);
    expect(missing.every((row) => row.locationVerificationStatus === 'needs-review')).toBe(true);
    // Kolaka tidak boleh memakai fitur Kolaka Timur yang ditolak saat penelitian.
    expect(missing.find((row) => row.name.endsWith('Kabupaten Kolaka'))?.kabKotaId).toBe('74.01');
    const pin = prepared.records.find((row) => row.coordinates)!;
    expect(() => buildPilotSnapshot(excel, references, [{ ...pin, coordinates: [0, 0] }], [],
      { provinceIds: NEW_PROVINCES, label: 'Kalimantan dan Sulawesi' })).toThrow();
  });
  it('rebuild berulang stabil; record/pin di luar cakupan tambahan serta Landing Page ANRI dipertahankan', () => {
    const merged = extendPilot(current, addition.snapshot, references);
    const retained = current.instansi.filter((row) => !NEW_PROVINCES.has(row.provinceId!));
    expect(retained).toHaveLength(current.instansi.length - 135);
    expect(retained.filter((row) => row.coordinates)).toHaveLength(current.instansi.filter((row) => row.coordinates).length - 132);
    expect(merged.snapshot.instansi.filter((row) => !NEW_PROVINCES.has(row.provinceId!))).toEqual(retained);
    expect(merged.snapshot.instansi).toHaveLength(current.instansi.length);
    expect(merged.snapshot.instansi.filter((row) => row.coordinates)).toHaveLength(current.instansi.filter((row) => row.coordinates).length);
    expect(merged.references.provinces).toHaveLength(38);
    expect(merged.references.kabKota).toHaveLength(514);
    expect(extendPilot(merged.snapshot, addition.snapshot, references)).toEqual(merged);
    for (const row of current.statistics.filter((item) => retained.some((institution) => institution.id === item.instansiId))) {
      const after = merged.snapshot.statistics.find((item) => item.instansiId === row.instansiId)!;
      expect(after).toEqual({ ...row, statistik: Object.fromEntries(Object.entries(row.statistik)
        .map(([key, metric]) => [key, { ...metric, snapshotId: merged.snapshot.metadata.id }])) });
    }
    expect(merged.snapshot.instansi.find((row) => row.name === 'Arsip Nasional RI')?.landingPageVerificationStatus).toBe('verified');
    expect(merged.snapshot.metadata.nationalTotal).toBeNull();
    expect(merged.snapshot.metadata.sampleTotal?.value).toBe(merged.snapshot.statistics.reduce((sum, row) => sum + row.statistik.jumlahArsip.value!, 0));
    expect(merged.snapshot.statistics.every((row) => Object.values(row.statistik).every((metric) => metric.definition.includes('SIMULASI')))).toBe(true);
  });
  it('urutan kurasi tidak mengubah identitas; ID ganda dan mode non-pilot ditolak', () => {
    expect(preparePilotLocations({ ...excel, instansi: [...excel.instansi].reverse() }, references, [...reviews].reverse(), NEW_PROVINCES).records).toEqual(prepared.records);
    const duplicate = structuredClone(addition.snapshot);
    duplicate.instansi.push(structuredClone(duplicate.instansi[0]!));
    expect(() => extendPilot(current, duplicate, references)).toThrow(/Duplikasi ID/);
    expect(() => extendPilot(excel, addition.snapshot, references)).toThrow(/pilot/);
  });
});
