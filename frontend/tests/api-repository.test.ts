import { describe, expect, it, vi } from 'vitest';
import { createApiRepository } from '../app/services/apiRepository';
import { makeFixture } from './fixtures/data';

const fixture = makeFixture();
const metadata = fixture.snapshot.metadata;
describe('Repository REST Laravel', () => {
  it('mengambil seluruh halaman; mode dan filter dikirim tanpa mengganti ID', async () => {
    const transport = vi.fn(async (raw: string) => {
      const url = new URL(raw);
      expect(url.searchParams.get('mode')).toBe('demo');
      expect(url.searchParams.get('provinceId')).toBe('36');
      const page = Number(url.searchParams.get('page'));
      return {
        data:
          page === 1
            ? fixture.snapshot.instansi.slice(0, 4)
            : fixture.snapshot.instansi.slice(4),
        metadata,
        meta: { total: 7, page, perPage: 4, lastPage: 2 },
      };
    });
    const repository = createApiRepository(
      'http://127.0.0.1/api/v1/',
      'demo',
      transport,
    );
    const result = await repository.listInstansi({ provinceId: '36' });
    expect(result.items).toEqual(fixture.snapshot.instansi);
    expect(result.metadata).toEqual(metadata);
    await repository.listInstansi({ provinceId: '36' });
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('gagal parsing referensi dapat diulang pada sumber yang sama', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: fixture.references });
    const repository = createApiRepository('/api/v1', 'demo', transport);
    await expect(repository.getReferenceData()).rejects.toThrow();
    // Cache respons malformed juga harus dibuang, bukan mengunci Retry selamanya.
    await expect(repository.getReferenceData()).resolves.toEqual(
      fixture.references,
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('kegagalan jaringan dibuang dari cache; 404 detail menjadi null, 503 tetap error', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error('jaringan'))
      .mockResolvedValueOnce({ data: fixture.references });
    const repository = createApiRepository('/api/v1', 'demo', transport);
    await expect(repository.getReferenceData()).rejects.toThrow('jaringan');
    await expect(repository.getReferenceData()).resolves.toEqual(
      fixture.references,
    );
    const errors = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 503 });
    const failing = createApiRepository('/api/v1', 'demo', errors);
    await expect(failing.getInstansiDetail('tidak-ada')).resolves.toBeNull();
    await expect(failing.getInstansiDetail('tidak-ada')).rejects.toEqual({
      statusCode: 503,
    });
  });
  it('menolak ID ganda, total salah, dan geometri asing', async () => {
    const duplicated = vi
      .fn()
      .mockResolvedValue({
        data: [fixture.snapshot.instansi[0], fixture.snapshot.instansi[0]],
        metadata,
        meta: { total: 2, page: 1, perPage: 250, lastPage: 1 },
      });
    await expect(
      createApiRepository('/api', 'demo', duplicated).listInstansi(),
    ).rejects.toThrow('pagination');
    const transport = vi.fn(async (url: string) =>
      url.includes('reference-data')
        ? { data: fixture.references }
        : {
            type: 'FeatureCollection',
            features: [{ properties: { id: 'foreign-id' }, geometry: null }],
          },
    );
    await expect(
      createApiRepository('/api', 'demo', transport).getKabKotaGeometry!('36'),
    ).rejects.toThrow('asing');
  });
});

// Pencarian menggunakan endpoint yang sama dan tidak mewarisi filter peta.
it('pencarian global meneruskan mode/search saja dan hasil gagal bisa dicoba ulang', async () => {
  const transport = vi.fn(async (raw: string) => {
    const url = new URL(raw, 'http://localhost');
    expect(url.searchParams.get('search')).toBe('Demo A');
    expect(url.searchParams.get('mode')).toBe('demo');
    expect(url.searchParams.has('provinceId')).toBe(false);
    expect(url.searchParams.has('kabKotaId')).toBe(false);
    return { data: [fixture.snapshot.instansi[0]], metadata,
      meta: { total: 1, page: 1, perPage: 250, lastPage: 1 } };
  });
  const repository = createApiRepository('/api', 'demo', transport);
  expect((await repository.listInstansi({ search: ' Demo A ' })).items[0]?.id).toBe(fixture.snapshot.instansi[0]?.id);
  await repository.listInstansi({ search: ' Demo A ' });
  expect(transport).toHaveBeenCalledTimes(2);
});
