import { describe, expect, it } from 'vitest';
import { coordinateMethod, safeCoordinateSource } from '../src/services/coordinateSource';

describe('provenance koordinat kantor', () => {
  it('mempertahankan kompatibilitas pin Google Maps lama', () => {
    expect(coordinateMethod(undefined)).toBe('google-maps-place');
    expect(safeCoordinateSource('https://www.google.com/maps/place/Instansi+Demo')).toBeTruthy();
    expect(safeCoordinateSource('https://www.google.co.id/maps/place/Instansi+Demo')).toBeTruthy();
    expect(safeCoordinateSource('https://www.google.co.id.example/maps/place/Instansi+Demo')).toBeNull();
  });
  it('memerlukan situs resmi untuk koordinat dari publikasi atau fitur peta tertanam', () => {
    for (const host of ['dinas.kota.go.id', 'kampus.ac.id', 'sekolah.sch.id', 'tni.mil.id'])
      expect(safeCoordinateSource(`https://${host}/kontak`, 'official-map-embed')).toBeTruthy();
    for (const url of ['https://kota.go.id.example/kontak', 'https://example.test/kontak', 'http://kota.go.id/kontak', 'https://user:pass@kota.go.id/kontak'])
      expect(safeCoordinateSource(url, 'official-published-coordinates')).toBeNull();
  });
  it('menolak metode asing dan protokol selain HTTPS', () => {
    expect(coordinateMethod('perkiraan')).toBeNull();
    expect(safeCoordinateSource('javascript:alert(1)')).toBeNull();
    expect(safeCoordinateSource('https://www.google.com.example/maps/place/test')).toBeNull();
  });
});
