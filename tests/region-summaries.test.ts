import { describe, expect, it } from 'vitest';
import { regionSummaries } from '../src/services/regionSummaries';
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
  it('wilayah berdekatan atau berposisi sama tetap memakai anchor sumber tanpa mutasi', () => {
    const { references, snapshot } = data();
    const province = references.provinces.find((item) => item.id === '36')!;
    references.provinces.push({ ...province, id: '37', name: 'Provinsi Fixture B' });
    snapshot.instansi.push({ ...snapshot.instansi[0]!, id: 'fixture-provinsi-b', provinceId: '37' });
    const before = structuredClone({ references, snapshot });
    const summaries = regionSummaries(NATIONAL_STATE, references, snapshot.instansi);
    expect(summaries.map((item) => item.region.labelPosition)).toEqual([province.labelPosition, province.labelPosition]);
    expect(summaries.map((item) => item.count)).toEqual([7, 1]);
    expect({ references, snapshot }).toEqual(before);
  });
  it('pengurutan instansi tidak mengubah identitas, jumlah atau anchor ringkasan', () => {
    const { references, snapshot } = data();
    const first = regionSummaries(NATIONAL_STATE, references, snapshot.instansi);
    const repeat = regionSummaries(NATIONAL_STATE, references, [...snapshot.instansi].reverse());
    expect(repeat).toEqual(first);
    expect(first[0]!.region.labelPosition).toEqual([-6.1, 106.1]);
  });
});
