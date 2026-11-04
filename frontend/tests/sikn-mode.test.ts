import { describe, expect, it, vi } from 'vitest';
import { createApiRepository } from '../app/services/apiRepository';
import { getReturnMapUrl } from '../app/services/session';
import { makeFixture } from './fixtures/data';

describe('Mode database lokal tetap terpisah', () => {
  it('mengirim sumber sikn untuk katalog, detail dan geometri tanpa mengganti ID', async () => {
    const { references, snapshot } = makeFixture();
    references.metadata = { ...references.metadata, datasetKind: 'database', nationalTotal: null };
    const transport = vi.fn(async (raw: string) => {
      const url = new URL(raw);
      expect(url.searchParams.get('mode')).toBe('sikn');
      if (url.pathname.endsWith('reference-data')) return { data: references };
      if (url.pathname.endsWith('institutions')) return { data: snapshot.instansi, metadata: references.metadata, meta: { total: 7, page: 1, perPage: 250, lastPage: 1 } };
      return { data: { instansi: snapshot.instansi[0], metadata: references.metadata } };
    });
    const repository = createApiRepository('http://127.0.0.1/api/v1', 'sikn', transport);
    expect((await repository.getReferenceData()).metadata.datasetKind).toBe('database');
    expect((await repository.listInstansi()).items).toEqual(snapshot.instansi);
    await repository.getInstansiDetail(snapshot.instansi[0].id);
    expect(transport.mock.calls[2][0]).toContain(encodeURIComponent(snapshot.instansi[0].id));
  });

  it('kembali dari detail tidak jatuh ke sumber Excel/pilot dan parameter lain tetap disaring', () => {
    const { snapshot } = makeFixture();
    const item = snapshot.instansi[0];
    const url = new URL(getReturnMapUrl('?data=sikn&jenis=asing', item), 'http://localhost');
    expect(url.searchParams.get('data')).toBe('sikn');
    expect(url.searchParams.get('provinsi')).toBe(item.provinceId);
    expect(url.searchParams.get('jenis')).toBeNull();
  });
});
