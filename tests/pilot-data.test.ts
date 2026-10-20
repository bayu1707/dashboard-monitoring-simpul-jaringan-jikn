import { describe, expect, it } from 'vitest';
import type { ReferenceData, SnapshotData } from '../src/types/domain';
import { buildPilotSnapshot } from '../scripts/build-local-pilot';
import type { PilotLocation } from '../scripts/build-local-pilot';
import { makeFixture } from './fixtures/data';

/** Seluruh nama/kode/titik pada pengujian ini sintetis dan tidak masuk pilot produksi. */
function input(): { excel: SnapshotData; references: ReferenceData; locations: PilotLocation[] } {
  const { snapshot, references } = makeFixture();
  snapshot.metadata.datasetKind = 'excel';
  snapshot.metadata.sources = ['fixture-pilot.xlsx — pengelolaan casefile'];
  snapshot.metadata.nationalTotal = null;
  snapshot.instansi = snapshot.instansi.slice(0, 2);
  snapshot.statistics = snapshot.statistics.filter((item) => snapshot.instansi.some((institution) => institution.id === item.instansiId));
  for (const instansi of snapshot.instansi) {
    instansi.joinedYearSource = 'fixture-pilot.xlsx — pengelolaan casefile!E4';
    instansi.locationVerificationStatus = 'unresolved';
    instansi.locationVerificationNotes = 'Fixture belum dicocokkan.';
    instansi.provinceId = null;
    instansi.provinceName = null;
    instansi.kabKotaId = null;
    instansi.kabKotaName = null;
    instansi.coordinates = null;
    instansi.email = null;
    instansi.phone = null;
    instansi.status = null;
    instansi.logoUrl = null;
    instansi.sourceUpdatedAt = null;
    instansi.landingPageUrl = null;
    instansi.landingPageVerificationStatus = 'unavailable';
  }
  // Persegi fixture menguji polygon dan lubangnya, bukan batas wilayah operasional.
  const serang = references.kabKota.find((item) => item.id === '36.73')!;
  serang.bounds = [[-6.3, 106.0], [-6.0, 106.3]];
  serang.geometry = { type: 'Polygon', coordinates: [[[106.0, -6.3], [106.3, -6.3], [106.3, -6.0], [106.0, -6.0], [106.0, -6.3]]] };
  const locations = snapshot.instansi.map((instansi, index): PilotLocation => {
    const coordinates: [number, number] = [-6.1 - index * 0.01, 106.15];
    const googleMapsPlaceUrl = `https://www.google.com/maps/place/Fixture+Demo/data=!8m2!3d${coordinates[0]}!4d${coordinates[1]}`;
    return {
      instansiId: instansi.id, name: instansi.name, joinedYear: instansi.joinedYear,
      provinceId: '36', kabKotaId: '36.73', coordinates,
      address: 'Alamat fixture sintetis; bukan lokasi kantor sebenarnya',
      googleMapsPlaceUrl, sourceUrls: [googleMapsPlaceUrl, 'https://example.test/alamat-fixture'],
      capturedAt: '2026-10-14T22:00:00+07:00', notes: 'Hanya fixture sintetis untuk unit test.',
    };
  });
  return { excel: snapshot, references, locations };
}

describe('builder pilot lokal', () => {
  it('menerima satu sumber Maps hanya bila ditandai pin publik, tetap menolak koordinat kamera dan sumber palsu', () => {
    const { excel, references, locations } = input();
    const original = locations[0]!;
    const publicPin: PilotLocation = { ...original, publicPlaceOnly: true,
      sourceUrls: [original.googleMapsPlaceUrl!] };
    expect(() => buildPilotSnapshot(excel, references, [{ ...publicPin, publicPlaceOnly: false }])).toThrow('sumber Google Maps');
    expect(buildPilotSnapshot(excel, references, [publicPin]).snapshot.instansi[0]!.coordinatesVerificationNotes)
      .toContain('alamat belum dikonfirmasi oleh instansi');
    expect(() => buildPilotSnapshot(excel, references, [{ ...publicPin, coordinates: [-6.2, 106.15] }])).toThrow('!3d/!4d');
    expect(() => buildPilotSnapshot(excel, references, [{ ...publicPin, coordinates: null,
      googleMapsPlaceUrl: null, locationVerificationStatus: 'verified' }])).toThrow('pin publik');
    expect(() => buildPilotSnapshot(excel, references, [{ ...publicPin,
      coordinateMethod: 'official-published-coordinates' }])).toThrow('pin publik');
  });

  it('tinjauan batas pin publik hanya menerima sumber pin yang sama dan jarak maksimal 10 meter', () => {
    const { excel, references, locations } = input();
    const region = references.kabKota.find((item) => item.id === '36.73')!;
    region.geometry = { type: 'Polygon', coordinates: [[[106.15005, -6.3], [106.3, -6.3], [106.3, -6.0], [106.15005, -6.0], [106.15005, -6.3]]] };
    const original = locations[0]!;
    const reviewed: PilotLocation = { ...original, publicPlaceOnly: true, sourceUrls: [original.googleMapsPlaceUrl!],
      geometryReview: { reason: 'Fixture dekat batas; alamat belum dikonfirmasi.', sourceUrl: original.googleMapsPlaceUrl!, maxDistanceMeters: 10 } };
    expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed, geometryReview: undefined }])).toThrow('di luar polygon');
    const result = buildPilotSnapshot(excel, references, [reviewed]);
    expect(result.snapshot.instansi[0]!.coordinates).toEqual(original.coordinates);
    expect(result.report.geometryReviews[0]!.distanceMeters).toBeLessThan(10);
    expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed,
      geometryReview: { ...reviewed.geometryReview!, maxDistanceMeters: 11 } }])).toThrow('tinjauan batas memerlukan');
    expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed, publicPlaceOnly: false }])).toThrow('tinjauan batas memerlukan');
    region.geometry = { type: 'Polygon', coordinates: [[[106.1502, -6.3], [106.3, -6.3], [106.3, -6.0], [106.1502, -6.0], [106.1502, -6.3]]] };
    expect(() => buildPilotSnapshot(excel, references, [reviewed])).toThrow('melebihi batas');
  });

  it('menerapkan satu mapping yang ditinjau melalui builder tanpa mengaktifkan instansi lain atau mengganti data Excel', () => {
    const { excel, references, locations } = input();
    const owner = excel.instansi[0]!;
    const mapping = [{ instansiId: owner.id, expectedName: owner.name,
      landingPageUrl: 'https://jikn.anri.go.id/deskripsi-arsip/sj/00000000-0000-4000-8000-000000000001',
      landingPageSource: 'Konfirmasi pengguna fixture sintetis; bukan pemetaan ANRI.',
      landingPageVerificationStatus: 'verified', landingPageVerifiedAt: '2026-10-14T09:00:00+07:00' }];
    const before = structuredClone(excel);
    const result = buildPilotSnapshot(excel, references, locations, mapping);
    expect(result.report.verifiedLandingPages).toBe(1);
    expect(result.snapshot.instansi.find((item) => item.id === owner.id)).toMatchObject({
      landingPageUrl: mapping[0]!.landingPageUrl, joinedYear: owner.joinedYear,
    });
    expect(result.snapshot.instansi.filter((item) => item.landingPageVerificationStatus === 'verified')).toHaveLength(1);
    expect(excel).toEqual(before);
    expect(() => buildPilotSnapshot(excel, references, locations, [{ ...mapping[0], expectedName: 'Pemilik berbeda' }])).toThrow('nama tidak cocok');
  });

  it('menyimpan label unit kantor hanya untuk lokasi dengan pin yang memiliki sumber', () => {
    const { excel, references, locations } = input();
    locations[0]!.coordinateLocationLabel = 'Depo arsip fixture';
    const { snapshot } = buildPilotSnapshot(excel, references, locations);
    expect(snapshot.instansi.find((item) => item.id === locations[0]!.instansiId)?.coordinateLocationLabel)
      .toBe('Depo arsip fixture');
    expect(() => buildPilotSnapshot(excel, references, [{
      ...locations[0]!, coordinates: null, googleMapsPlaceUrl: null, locationVerificationStatus: 'verified',
    }])).toThrow('label lokasi hanya untuk titik');
  });

  it('mempertahankan ID, nama dan tahun sumber serta memisahkan angka simulasi dan null profil', () => {
    const { excel, references, locations } = input();
    const before = structuredClone({ excel, references, locations });
    const result = buildPilotSnapshot(excel, references, locations);
    expect(result.snapshot.metadata.datasetKind).toBe('pilot');
    expect(result.snapshot.metadata.coverage).toBe('partial');
    expect(result.snapshot.metadata.nationalTotal).toBeNull();
    expect(result.snapshot.metadata.sampleTotal).toEqual({
      value: result.snapshot.statistics.reduce((sum, item) => sum + (item.statistik.jumlahArsip.value ?? 0), 0),
      definition: result.snapshot.metadata.metricDefinitions.jumlahArsip,
      scope: 'percontohan', snapshotId: result.snapshot.metadata.id,
      referenceDate: result.snapshot.metadata.referenceDate,
    });
    expect(result.references.metadata.sampleTotal).toBeNull();
    for (const record of result.snapshot.instansi) {
      const original = excel.instansi.find((item) => item.id === record.id)!;
      expect(record.name).toBe(original.name);
      expect(record.joinedYear).toBe(original.joinedYear);
      expect(record.joinedYearSource).toBe(original.joinedYearSource);
      expect(record.email).toBeNull();
      expect(record.phone).toBeNull();
      expect(record.status).toBeNull();
      expect(record.landingPageUrl).toBeNull();
      expect(record.sourceUpdatedAt).toBeNull();
      expect(record.coordinates).toEqual(locations.find((item) => item.instansiId === record.id)?.coordinates);
      expect(record.coordinateSource).toContain('google.com/maps/place/');
    }
    expect(result.snapshot.metadata.verificationNotes.join(' ')).toContain('DATA SIMULASI');
    expect({ excel, references, locations }).toEqual(before);
  });

  it('menghasilkan pembagian statistik konsisten dan seri tahunan, bukan kumulatif', () => {
    const { excel, references, locations } = input();
    const { snapshot } = buildPilotSnapshot(excel, references, locations);
    for (const statistics of snapshot.statistics) {
      const total = statistics.statistik.jumlahArsip.value!;
      expect(total).toBeGreaterThanOrEqual(1500);
      expect(total).toBeLessThanOrEqual(15000);
      expect(statistics.statistik.kopiDigital.value).toBeLessThanOrEqual(total);
      expect(statistics.penciptaArsip).toHaveLength(statistics.statistik.penciptaArsip.value!);
      expect(statistics.penciptaArsip?.every((item) => item.name.startsWith('Pencipta simulasi '))).toBe(true);
      expect(statistics.trenInput?.map((item) => item.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
      for (const values of [statistics.trenInput, statistics.distribusiArsip, statistics.penciptaArsip])
        expect(values?.reduce((sum, item) => sum + (item.count ?? 0), 0)).toBe(total);
      expect(statistics.monthlyAdded).toBeNull();
      expect(statistics.statistik.jumlahArsip.definition).toContain('SIMULASI — bukan data resmi JIKN');
      expect(statistics.distribusiArsip?.every((item) => item.label.includes('simulasi'))).toBe(true);
    }
  });

  it('tidak mengubah identitas atau angka ketika urutan instansi dan input lokasi berubah', () => {
    const { excel, references, locations } = input();
    const first = buildPilotSnapshot(excel, references, locations);
    const reordered = { ...excel, instansi: [...excel.instansi].reverse(), statistics: [...excel.statistics].reverse() };
    expect(buildPilotSnapshot(reordered, references, [...locations].reverse())).toEqual(first);
  });

  it('tidak membuat tren simulasi sebelum tahun bergabung kampus baru pada Excel', () => {
    const { excel, references, locations } = input();
    excel.instansi[0]!.joinedYear = 2026;
    locations[0]!.joinedYear = 2026;
    const result = buildPilotSnapshot(excel, references, locations);
    const stats = result.snapshot.statistics.find((item) => item.instansiId === excel.instansi[0]!.id)!;
    expect(stats.trenInput).toEqual([{ year: 2026, count: stats.statistik.jumlahArsip.value }]);
  });

  it('tidak menjadikan null tahun menjadi tahun acuan dan tidak memakai angka nol lama sebagai angka resmi', () => {
    const { excel, references, locations } = input();
    excel.instansi[0]!.joinedYear = null;
    locations[0]!.joinedYear = null;
    excel.statistics[0]!.statistik.jumlahArsip.value = 0;
    const { snapshot } = buildPilotSnapshot(excel, references, locations);
    expect(snapshot.instansi.find((item) => item.id === excel.instansi[0]!.id)?.joinedYear).toBeNull();
    const metric = snapshot.statistics.find((item) => item.instansiId === excel.instansi[0]!.id)!.statistik.jumlahArsip;
    expect(metric.value).toBeGreaterThan(0);
    expect(metric.definition).toContain('SIMULASI');
    expect(excel.statistics[0]!.statistik.jumlahArsip.value).toBe(0);
  });

  it('menolak sumber demo sehingga statistik demo tidak tercampur ke sumber Excel', () => {
    const { excel, references, locations } = input();
    excel.metadata.datasetKind = 'demo';
    expect(() => buildPilotSnapshot(excel, references, locations)).toThrow('data demo tidak boleh dicampur');
  });

  it('menolak ID asing, perubahan nama/tahun dan pemetaan lokasi ganda yang konflik', () => {
    const { excel, references, locations } = input();
    expect(() => buildPilotSnapshot(excel, references, [{ ...locations[0]!, instansiId: 'asing' }])).toThrow('tidak ditemukan');
    expect(() => buildPilotSnapshot(excel, references, [{ ...locations[0]!, name: 'Nama instansi lain' }])).toThrow('nama tidak cocok');
    expect(() => buildPilotSnapshot(excel, references, [{ ...locations[0]!, joinedYear: 2026 }])).toThrow('tahun bergabung tidak cocok');
    expect(() => buildPilotSnapshot(excel, references, [...locations, { ...locations[0]!, notes: 'Catatan pemetaan berbeda' }])).toThrow('konflik');
    const repeated = buildPilotSnapshot(excel, references, [...locations, structuredClone(locations[0]!)]);
    expect(repeated.snapshot.instansi).toHaveLength(2);
    expect(repeated.report.identicalMappingsIgnored).toBe(1);
  });

  it('menolak null/0,0/fiktif, koordinat viewport, salah wilayah dan URL tidak sah', () => {
    const { excel, references, locations } = input();
    const original = locations[0]!;
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, coordinates: null as unknown as [number, number] }])).toThrow('koordinat tidak valid');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, coordinates: [0, 0], googleMapsPlaceUrl: 'https://www.google.com/maps/place/Fixture/data=!3d0!4d0', sourceUrls: ['https://www.google.com/maps/place/Fixture/data=!3d0!4d0', 'https://example.test/alamat'] }])).toThrow('di luar bounds');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, googleMapsPlaceUrl: 'https://www.google.com/maps/place/Fixture/@-6.1,106.15,17z' }])).toThrow('bukan pusat viewport');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, coordinates: [-6.12, 106.15] }])).toThrow('koordinat harus sesuai');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, provinceId: '31' }])).toThrow('kab/kota tidak sesuai');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, googleMapsPlaceUrl: original.googleMapsPlaceUrl!.replace('https:', 'http:') }])).toThrow('HTTPS');
    expect(() => buildPilotSnapshot(excel, references, [{ ...original, googleMapsPlaceUrl: original.googleMapsPlaceUrl!.replace('www.google.com', 'www.google.com.evil.test') }])).toThrow('HTTPS');
  });

  it('menolak titik dalam bounds tetapi di lubang polygon wilayah', () => {
    const { excel, references, locations } = input();
    const region = references.kabKota.find((item) => item.id === '36.73')!;
    if (region.geometry?.type !== 'Polygon') throw new Error('Fixture polygon tidak tersedia.');
    region.geometry.coordinates.push([[106.14, -6.12], [106.16, -6.12], [106.16, -6.09], [106.14, -6.09], [106.14, -6.12]]);
    expect(() => buildPilotSnapshot(excel, references, locations)).toThrow('di luar polygon');
  });

  it('menerima tinjauan per record dekat batas tanpa menggeser koordinat sumber, serta mencatat jarak dan alasan', () => {
    const { excel, references, locations } = input();
    const region = references.kabKota.find((item) => item.id === '36.73')!;
    region.geometry = { type: 'Polygon', coordinates: [[[106.1504, -6.3], [106.3, -6.3], [106.3, -6.0], [106.1504, -6.0], [106.1504, -6.3]]] };
    const original = locations[0]!;
    expect(() => buildPilotSnapshot(excel, references, [original])).toThrow('di luar polygon');
    const reviewed: PilotLocation = { ...original, sourceUrls: [...original.sourceUrls, 'https://fixture.go.id/kantor'],
      geometryReview: { reason: 'Alamat resmi fixture menyebut wilayah ini; pin publik dekat batas referensi.',
        sourceUrl: 'https://fixture.go.id/kantor', maxDistanceMeters: 50 } };
    const result = buildPilotSnapshot(excel, references, [reviewed]);
    expect(result.snapshot.instansi[0]!.coordinates).toEqual(original.coordinates);
    expect(result.snapshot.instansi[0]!.coordinatesVerificationNotes).toContain('pin sumber tidak dipindahkan');
    expect(result.report.geometryReviews[0]).toMatchObject({ id: original.instansiId, kabKotaId: '36.73', ...reviewed.geometryReview });
    expect(result.report.geometryReviews[0]!.distanceMeters).toBeGreaterThan(44);
    expect(result.report.geometryReviews[0]!.distanceMeters).toBeLessThan(45);
    expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed,
      geometryReview: { ...reviewed.geometryReview!, maxDistanceMeters: 40 } }])).toThrow('melebihi batas');
    for (const geometryReview of [
      { ...reviewed.geometryReview!, maxDistanceMeters: 101 },
      { ...reviewed.geometryReview!, maxDistanceMeters: 0 },
      { ...reviewed.geometryReview!, reason: '' },
      { ...reviewed.geometryReview!, sourceUrl: 'https://fixture.example/kantor' },
      { ...reviewed.geometryReview!, sourceUrl: 'https://other.go.id/tidak-tercatat' },
    ]) expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed, geometryReview }])).toThrow('tinjauan batas memerlukan');
    // Batas 100 m tetap menolak titik yang jauh, meskipun diberi alasan dan sumber resmi.
    region.geometry = { type: 'Polygon', coordinates: [[[106.152, -6.3], [106.3, -6.3], [106.3, -6.0], [106.152, -6.0], [106.152, -6.3]]] };
    expect(() => buildPilotSnapshot(excel, references, [{ ...reviewed,
      geometryReview: { ...reviewed.geometryReview!, maxDistanceMeters: 100 } }])).toThrow('melebihi batas');
  });

  it('mempertahankan instansi tanpa pin di kab/kota yang diketahui tanpa membuat koordinat atau provenance palsu', () => {
    const { excel, references, locations } = input();
    locations[0] = { ...locations[0]!, coordinates: null, googleMapsPlaceUrl: null,
      locationVerificationStatus: 'needs-review', sourceUrls: ['https://example.test/konflik-alamat'],
      notes: 'Alamat kantor berubah; pin belum dapat dipastikan.' };
    const result = buildPilotSnapshot(excel, references, locations);
    const record = result.snapshot.instansi.find((item) => item.id === locations[0]!.instansiId)!;
    expect(result.report.selectedRecords).toBe(2);
    expect(result.report.validOfficeCoordinates).toBe(1);
    expect(result.report.missingOfficeCoordinates).toBe(1);
    expect(record.kabKotaId).toBe('36.73');
    expect(record.coordinates).toBeNull();
    expect(record.coordinateSource).toBeUndefined();
    expect(record.coordinatesVerifiedAt).toBeUndefined();
    expect(record.locationVerificationStatus).toBe('needs-review');
    expect(record.locationVerificationNotes).toContain('Alamat kantor berubah');
    expect(record.joinedYear).toBe(excel.instansi[0]!.joinedYear);
  });

  it('mengizinkan hanya provinsi diketahui dan menolak marker pada alamat yang masih perlu tinjauan', () => {
    const { excel, references, locations } = input();
    const pending = { ...locations[0]!, kabKotaId: null, coordinates: null, googleMapsPlaceUrl: null,
      locationVerificationStatus: 'needs-review' as const, sourceUrls: ['https://example.test/alamat-provinsi'] };
    const result = buildPilotSnapshot(excel, references, [pending]);
    expect(result.snapshot.instansi[0]).toMatchObject({ provinceId: '36', kabKotaId: null,
      kabKotaName: null, coordinates: null });
    expect(() => buildPilotSnapshot(excel, references, [{ ...locations[0]!, locationVerificationStatus: 'needs-review' }])).toThrow('tidak boleh mempunyai marker');
    expect(() => buildPilotSnapshot(excel, references, [{ ...pending, sourceUrls: [] }])).toThrow('sumber pemeriksaan');
  });

  it('mencakup enam provinsi Jawa tanpa menjadikan label wilayah sebagai titik kantor', () => {
    const { excel, references, locations } = input();
    expect(references.provinces.some((item) => item.id === '32')).toBe(true);
    const { snapshot, references: result } = buildPilotSnapshot(excel, references, locations);
    expect(result.provinces.map((item) => item.id).sort()).toEqual(['31', '32', '33', '34', '35', '36']);
    expect(result.kabKota.every((item) => ['31', '32', '33', '34', '35', '36'].includes(item.provinceId ?? ''))).toBe(true);
    expect(snapshot.instansi.every((item) => locations.some((location) => location.instansiId === item.id && JSON.stringify(location.coordinates) === JSON.stringify(item.coordinates)))).toBe(true);
    expect(result.metadata.coverage).toBe('partial');
  });

  it('menerima titik fitur peta pada situs resmi dengan bukti pasangan koordinat, tanpa membuat tautan Maps', () => {
    const { excel, references, locations } = input();
    const location: PilotLocation = { ...locations[0]!, googleMapsPlaceUrl: null,
      coordinateMethod: 'official-map-embed', coordinateSourceUrl: 'https://fixture.go.id/kontak',
      sourceUrls: ['https://fixture.go.id/kontak'], coordinateEvidence: `Fitur Kantor Demo [${locations[0]!.coordinates!.join(',')}]` };
    const { snapshot } = buildPilotSnapshot(excel, references, [location]);
    expect(snapshot.instansi[0]!.coordinateSource).toBe('https://fixture.go.id/kontak');
    expect(snapshot.instansi[0]!.coordinatesVerificationMethod).toBe('official-map-embed');
    expect(snapshot.instansi[0]!.coordinates).toEqual(location.coordinates);
    expect(() => buildPilotSnapshot(excel, references, [{ ...location, coordinateEvidence: 'Pusat kamera [-6.2,106.2]' }])).toThrow('bukti sumber resmi');
    expect(() => buildPilotSnapshot(excel, references, [{ ...location, coordinateSourceUrl: 'https://fixture.example/kontak' }])).toThrow('sumber koordinat harus HTTPS');
  });
});
