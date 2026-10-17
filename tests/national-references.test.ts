import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ReferenceData } from '../src/types/domain';

const references = JSON.parse(readFileSync(resolve('public/data/references.json'), 'utf8')) as ReferenceData;
function rings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  throw new Error('Referensi wilayah harus poligon.');
}

describe('integritas referensi nasional yang disertakan', () => {
  it('memuat ID unik 38 provinsi dan 514 kabupaten/kota dengan parent sah', () => {
    expect(references.provinces).toHaveLength(38);
    expect(references.kabKota).toHaveLength(514);
    expect(new Set([...references.provinces, ...references.kabKota].map((r) => r.id)).size).toBe(552);
    const provinceIds = new Set(references.provinces.map((r) => r.id));
    for (const region of references.kabKota) {
      expect(region.id).toMatch(/^\d{2}\.\d{2}$/);
      expect(region.provinceId).toBe(region.id.slice(0, 2));
      expect(provinceIds.has(region.provinceId!)).toBe(true);
      expect(region.labelPosition).toHaveLength(2);
      expect(region.labelPositionSource).toContain('kolom lat/lng');
      expect(region.geometry).toBeNull();
    }
  });

  it('menjaga kode Banten/Serang dan parent wilayah pemekaran Papua', () => {
    expect(references.kabKota.find((r) => r.id === '36.73')).toMatchObject({ name: 'Kota Serang', provinceId: '36' });
    expect(references.kabKota.find((r) => r.id === '92.08')).toMatchObject({ name: 'Kabupaten Kaimana', provinceId: '92' });
    expect(references.kabKota.find((r) => r.id === '96.01')).toMatchObject({ name: 'Kabupaten Sorong', provinceId: '96' });
    for (const id of ['91', '92', '93', '94', '95', '96']) expect(references.provinces.some((r) => r.id === id)).toBe(true);
  });

  it('memuat geometri lazy hanya untuk kabupaten/kota milik provinsi yang dipilih', () => {
    const ids: string[] = [];
    for (const province of references.provinces) {
      expect(province.geometry).not.toBeNull();
      const collection = JSON.parse(readFileSync(resolve(`public/data/geometry/kab-kota/${province.id}.json`), 'utf8')) as FeatureCollection;
      expect(collection.type).toBe('FeatureCollection');
      const expected = references.kabKota.filter((r) => r.provinceId === province.id).map((r) => r.id);
      expect(collection.features.map((f) => f.properties?.id).sort()).toEqual(expected.sort());
      for (const feature of collection.features) {
        ids.push(String(feature.properties?.id));
        expect(feature.properties?.provinceId).toBe(province.id);
        for (const ring of rings(feature.geometry)) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]).toEqual(ring[ring.length - 1]);
          expect(new Set(ring.map((point) => point.join(','))).size).toBeGreaterThanOrEqual(3);
          for (const [lng, lat] of ring) {
            if (lng === undefined || lat === undefined) throw new Error('Koordinat tidak lengkap.');
            expect(lng >= 94 && lng <= 142 && lat >= -12 && lat <= 7).toBe(true);
          }
        }
      }
    }
    expect(new Set(ids).size).toBe(514);
  });

  it('mencatat lisensi dan pengecualian geometri sumber secara terbuka', () => {
    const metadata = JSON.parse(readFileSync(resolve('public/data/geometry/metadata.json'), 'utf8'));
    expect(metadata.license).toBe('MIT');
    expect(metadata.exceptions).toEqual([]);
    expect(metadata.geometryNotes.find((note: { id: string }) => note.id === '96.01').omittedDegenerateRings).toBe(10);
    expect(readFileSync(resolve('public/data/geometry/LICENSE-cahyadsn.txt'), 'utf8')).toContain('MIT License');
  });
});
