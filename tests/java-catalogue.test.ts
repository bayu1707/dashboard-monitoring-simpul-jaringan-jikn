import { describe, expect, it } from 'vitest';
import { prepareJavaLocations } from '../scripts/prepare-java-locations';
import { makeFixture } from './fixtures/data';
import type { PilotLocation } from '../scripts/build-local-pilot';

function input() {
  const { snapshot, references } = makeFixture();
  snapshot.metadata.datasetKind = 'excel';
  snapshot.instansi.forEach((item) => { item.locationVerificationStatus = 'verified'; });
  references.metadata.sources = ['https://example.test/referensi-wilayah'];
  return { snapshot, references };
}
describe('katalog Jawa dari ID sumber', () => {
  it('memasukkan semua ID administratif yang sudah diketahui, tanpa membuat titik kantor', () => {
    const { snapshot, references } = input();
    const result = prepareJavaLocations(snapshot, references, []);
    expect(result.records).toHaveLength(snapshot.instansi.length);
    expect(result.records.every((item) => item.coordinates === null && item.address === null)).toBe(true);
    expect(new Set(result.records.map((item) => item.instansiId)).size).toBe(snapshot.instansi.length);
  });
  it('menjaga nama/tahun sumber dan membedakan konflik pin dari wilayah yang sudah diketahui', () => {
    const { snapshot, references } = input();
    const original = snapshot.instansi[0]!;
    original.provinceId = null;
    const review: PilotLocation = { instansiId: original.id, name: original.name, joinedYear: original.joinedYear,
      provinceId: '36', kabKotaId: '36.73', coordinates: null, address: null,
      googleMapsPlaceUrl: null, sourceUrls: ['https://example.test/kantor'],
      capturedAt: snapshot.metadata.capturedAt, notes: 'Kab/kota diketahui; dua gedung perlu konfirmasi.',
      locationVerificationStatus: 'needs-review', administrativeVerified: true };
    expect(prepareJavaLocations(snapshot, references, [review]).records.find((item) => item.instansiId === original.id))
      .toMatchObject({ coordinates: null, name: original.name, joinedYear: original.joinedYear });
    expect(prepareJavaLocations(snapshot, references, [{ ...review, administrativeVerified: false }]).records.some((item) => item.instansiId === original.id)).toBe(false);
    expect(() => prepareJavaLocations(snapshot, references, [{ ...review, joinedYear: 1900 }])).toThrow('Tahun penelitian berbeda');
  });
  it('menolak dua titik konflik pada ID sama dan tidak menggabungkan instansi berdasarkan kab/kota', () => {
    const { snapshot, references } = input();
    const reviews = snapshot.instansi.slice(0, 2).map((item, index): PilotLocation => ({
      instansiId: item.id, name: item.name, joinedYear: item.joinedYear, provinceId: '36', kabKotaId: '36.73',
      coordinates: [-6.1 - index * 0.01, 106.1], address: 'Alamat sintetis', googleMapsPlaceUrl: null,
      sourceUrls: ['https://example.test/kantor'], capturedAt: snapshot.metadata.capturedAt,
      notes: 'Fixture sintetis.', locationVerificationStatus: 'verified',
    }));
    const result = prepareJavaLocations(snapshot, references, reviews);
    expect(result.records.filter((item) => item.coordinates)).toHaveLength(2);
    expect(() => prepareJavaLocations(snapshot, references, [...reviews, { ...reviews[0]!, coordinates: [-6.2, 106.2] }])).toThrow('Konflik dua pin');
    const noPin = { ...reviews[0]!, coordinates: null };
    expect(() => prepareJavaLocations(snapshot, references, [noPin, { ...noPin, kabKotaId: '36.71' }])).toThrow('Konflik wilayah');
    expect(() => prepareJavaLocations(snapshot, references, [reviews[0]!, { ...noPin,
      locationVerificationStatus: 'needs-review', notes: 'Pin lama ternyata gedung instansi lain.' }])).toThrow('Penarikan pin');
  });
});
