import { describe, expect, it } from 'vitest';
import { MAX_REGION_LABEL_OFFSET, placeRegionLabels, regionSummaries } from '../src/services/regionSummaries';
import { NATIONAL_STATE } from '../src/services/exploration';
import { makeFixture } from './fixtures/data';

function data() {
  const fixture = makeFixture();
  const province = fixture.references.provinces.find((item) => item.id === '36')!;
  const city = fixture.references.kabKota.find((item) => item.id === '36.73')!;
  province.labelPosition = [-6.1, 106.1];
  city.labelPosition = [-6.12, 106.16];
  province.labelPositionSource = city.labelPositionSource = 'Posisi wilayah fixture sintetis';
  return fixture;
}
describe('Ringkasan wilayah terpisah dari marker kantor', () => {
  it('nasional menampilkan jumlah ID unik wilayah, termasuk instansi tanpa koordinat', () => {
    const { references, snapshot } = data();
    const result = regionSummaries(NATIONAL_STATE, references, [...snapshot.instansi, snapshot.instansi[0]!]);
    expect(result.find((item) => item.region.id === '36')).toMatchObject({ count: 7 });
    expect(snapshot.instansi[2]!.coordinates).toBeNull();
  });
  it('tidak meletakkan instansi tanpa provinsi pada suatu bubble wilayah', () => {
    const { references, snapshot } = data();
    snapshot.instansi[0]!.provinceId = null;
    expect(regionSummaries(NATIONAL_STATE, references, snapshot.instansi)[0]?.count).toBe(6);
  });
  it('provinsi menyediakan kabupaten/kota, level instansi tidak mempunyai penanda administratif', () => {
    const { references, snapshot } = data();
    const provinceState = { level: 'provinsi', provinceId: '36', kabKotaId: null, jenisId: null } as const;
    expect(regionSummaries(provinceState, references, snapshot.instansi).map((item) => item.region.id)).toEqual(['36.73']);
    const state = { level: 'instansi', provinceId: '36', kabKotaId: '36.73', jenisId: null } as const;
    expect(regionSummaries(state, references, snapshot.instansi)).toEqual([]);
    snapshot.instansi.forEach((item) => { item.coordinates = null; });
    expect(regionSummaries(state, references, snapshot.instansi)).toEqual([]);
  });
  it('posisi label tanpa sumber tidak dipakai', () => {
    const { references, snapshot } = data();
    references.provinces.find((item) => item.id === '36')!.labelPositionSource = undefined;
    expect(regionSummaries(NATIONAL_STATE, references, snapshot.instansi)).toEqual([]);
  });
  it('label berdekatan tetap satu ID per tombol tanpa mengubah posisi sumber', () => {
    const { references, snapshot } = data();
    const region = references.kabKota.find((item) => item.id === '36.73')!;
    const summaries = regionSummaries(NATIONAL_STATE, references, snapshot.instansi);
    const choices = [summaries[0]!, { ...summaries[0]!, region }];
    const position = [...region.labelPosition!];
    const placed = placeRegionLabels(choices, () => ({ x: 10, y: 10 }));
    expect(placed.map((item) => item.summary.region.id)).toEqual(['36', '36.73']);
    const [first, second] = placed;
    expect(Math.hypot(first!.offset[0] - second!.offset[0], first!.offset[1] - second!.offset[1])).toBeGreaterThanOrEqual(54);
    expect(region.labelPosition).toEqual(position);
    expect(placeRegionLabels(choices, (item) => ({ x: item.id === '36' ? 0 : 200, y: 0 })).map((item) => item.offset)).toEqual([[0, 0], [0, 0]]);
  });
  it('label yang sangat padat tidak menyebar ratusan piksel saat zoom out', () => {
    const { references, snapshot } = data();
    const summary = regionSummaries(NATIONAL_STATE, references, snapshot.instansi)[0]!;
    const choices = Array.from({ length: 38 }, (_, index) => ({ ...summary,
      region: { ...summary.region, id: String(index).padStart(2, '0') } }));
    const placed = placeRegionLabels(choices, () => ({ x: 0, y: 0 }));
    expect(placed).toHaveLength(choices.length);
    expect(new Set(placed.map((item) => item.summary.region.id)).size).toBe(choices.length);
    for (const { offset } of placed)
      expect(Math.hypot(...offset)).toBeLessThanOrEqual(MAX_REGION_LABEL_OFFSET + 1e-9);
    expect(placeRegionLabels([...choices].reverse(), () => ({ x: 0, y: 0 }))).toEqual(placed);
  });
  it('memilih pergeseran terdekat, bukan diagonal jauh untuk tabrakan kecil', () => {
    const { references, snapshot } = data();
    const summary = regionSummaries(NATIONAL_STATE, references, snapshot.instansi)[0]!;
    const choices = [summary, { ...summary, region: { ...summary.region, id: '37' } }];
    const placed = placeRegionLabels(choices, (region) => ({ x: region.id === '36' ? 0 : 50, y: 0 }));
    expect(Math.hypot(...placed[1]!.offset)).toBeLessThanOrEqual(4);
  });
  it('saat ruang penuh memilih celah tersisa alih-alih menutupi pusat tombol pertama', () => {
    const { references, snapshot } = data();
    const summary = regionSummaries(NATIONAL_STATE, references, snapshot.instansi)[0]!;
    const choices = Array.from({ length: 5 }, (_, index) => ({ ...summary,
      region: { ...summary.region, id: String(index) } }));
    const placed = placeRegionLabels(choices, () => ({ x: 0, y: 0 }));
    expect(placed.filter(({ offset }) => Math.hypot(...offset) < 1)).toHaveLength(1);
    for (const { offset } of placed.slice(1)) expect(Math.hypot(...offset)).toBeGreaterThan(24);
  });
});
