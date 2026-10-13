import { describe, expect, it } from 'vitest';
import {
  NATIONAL_STATE,
  canPreviewInstansi,
  countInstansi,
  explorationToQuery,
  filterInstansi,
  goNational,
  goProvince,
  parseExplorationQuery,
  selectKabKota,
  selectJenis,
  selectProvince,
} from '../src/services/exploration';
import { makeFixture } from './fixtures/data';

const references = makeFixture().references;
describe('Navigasi wilayah bertingkat', () => {
  it('klik Banten memilih layer kabupaten/kota, klik Kota Serang langsung memilih layer instansi', () => {
    const province = selectProvince(NATIONAL_STATE, '36', references);
    expect(province).toEqual({
      level: 'provinsi',
      provinceId: '36',
      kabKotaId: null,
      jenisId: null,
    });
    const institution = selectKabKota(province, '36.73', references);
    expect(institution.level).toBe('instansi');
    expect(institution.jenisId).toBeNull();
    expect(canPreviewInstansi(institution, references)).toBe(true);
    expect(
      filterInstansi(makeFixture().snapshot.instansi, institution),
    ).toHaveLength(7);
  });
  it('query dropdown dan klik peta menghasilkan state yang identik, jenis opsional', () => {
    const clicked = selectKabKota(
      selectProvince(NATIONAL_STATE, '36', references),
      '36.73',
      references,
    );
    expect(
      parseExplorationQuery(
        new URLSearchParams('provinsi=36&kabKota=36.73'),
        references,
      ),
    ).toEqual(clicked);
    expect(
      parseExplorationQuery(
        new URLSearchParams(explorationToQuery(clicked)),
        references,
      ),
    ).toEqual(clicked);
  });
  it('query provinsi saja masuk layer provinsi, ID wilayah salah dibuang', () => {
    expect(
      parseExplorationQuery(new URLSearchParams('provinsi=36'), references)
        .level,
    ).toBe('provinsi');
    expect(
      parseExplorationQuery(
        new URLSearchParams('provinsi=absent&kabKota=36.73'),
        references,
      ),
    ).toEqual(NATIONAL_STATE);
    expect(
      parseExplorationQuery(
        new URLSearchParams('provinsi=31&kabKota=36.73&jenis=demo-pemerintah'),
        references,
      ),
    ).toEqual({
      level: 'provinsi',
      provinceId: '31',
      kabKotaId: null,
      jenisId: null,
    });
  });
  it('tidak mempratinjau marker tanpa relasi provinsi/kabupaten valid', () => {
    expect(canPreviewInstansi(NATIONAL_STATE, references)).toBe(false);
    expect(
      canPreviewInstansi(
        {
          level: 'instansi',
          provinceId: '31',
          kabKotaId: '36.73',
          jenisId: null,
        },
        references,
      ),
    ).toBe(false);
  });
  it('jenis mempersempit dengan AND tanpa mengubah level navigasi', () => {
    const state = selectKabKota(
      selectProvince(NATIONAL_STATE, '36', references),
      '36.73',
      references,
    );
    const filtered = selectJenis(state, 'demo-pemerintah', references);
    expect(filtered.level).toBe('instansi');
    expect(filtered.provinceId).toBe(state.provinceId);
    expect(
      filterInstansi(makeFixture().snapshot.instansi, filtered).map(
        (item) => item.id,
      ),
    ).toEqual(['demo-a', 'demo-d', 'demo-g']);
    expect(selectJenis(state, 'absent', references).jenisId).toBeNull();
  });
  it('perubahan provinsi/kabupaten mengosongkan pilihan turunannya', () => {
    const state = {
      level: 'instansi' as const,
      provinceId: '36',
      kabKotaId: '36.73',
      jenisId: 'demo-pemerintah',
    };
    expect(selectProvince(state, '31', references)).toEqual({
      level: 'provinsi',
      provinceId: '31',
      kabKotaId: null,
      jenisId: null,
    });
    expect(selectKabKota(state, '36.74', references)).toEqual({
      level: 'instansi',
      provinceId: '36',
      kabKotaId: '36.74',
      jenisId: null,
    });
    expect(selectKabKota(state, 'absent', references).level).toBe('provinsi');
  });
  it('kembali satu tingkat dan reset mengganti lapisan', () => {
    const state = {
      level: 'instansi' as const,
      provinceId: '36',
      kabKotaId: '36.73',
      jenisId: 'demo-pemerintah',
    };
    expect(goProvince(state)).toEqual({
      level: 'provinsi',
      provinceId: '36',
      kabKotaId: null,
      jenisId: null,
    });
    expect(goNational()).toEqual(NATIONAL_STATE);
    expect(goProvince(NATIONAL_STATE)).toEqual(NATIONAL_STATE);
  });
  it('count memakai ID unik, titik null tidak menjadi marker atau koordinat nol', () => {
    const institutions = makeFixture().snapshot.instansi;
    expect(countInstansi([...institutions, institutions[0]!])).toEqual({
      total: 7,
      mapped: 6,
      unmapped: 1,
    });
    expect(institutions[2]!.coordinates).toBeNull();
  });
  it('serialize menyimpan opt-in demo dan hanya jenis pada level instansi', () => {
    expect(explorationToQuery(NATIONAL_STATE, true)).toBe('?demo=1');
    expect(
      explorationToQuery(
        {
          level: 'provinsi',
          provinceId: '36',
          kabKotaId: null,
          jenisId: 'invalid',
        },
        true,
      ),
    ).toBe('?provinsi=36&demo=1');
  });
});
