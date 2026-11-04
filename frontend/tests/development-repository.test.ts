import { describe, expect, it } from 'vitest';
import { createApiRepository } from '../app/services/apiRepository';
import { getReturnMapUrl } from '../app/services/session';
import { makeFixture } from './fixtures/data';

describe('Katalog development yang dapat diperbarui', () => {
  it('membaca revisi baru pada referensi, daftar dan detail; tidak menahan cache snapshot lama', async () => {
    const fixture = makeFixture();
    let version = 1;
    const repository = createApiRepository('http://localhost/api/v1', 'dev', async (raw) => {
      const url = new URL(raw);
      expect(url.searchParams.get('mode')).toBe('dev');
      const metadata = { ...fixture.snapshot.metadata, id: `development-v${version}`, datasetKind: 'development' as const, nationalTotal: null };
      if (url.pathname.endsWith('reference-data')) return { data: { ...fixture.references, metadata } };
      const item = { ...fixture.snapshot.instansi[0], name: `Nama versi ${version}` };
      if (url.pathname.endsWith('institutions')) return { data: [item], metadata, meta: { total: 1, page: 1, perPage: 250, lastPage: 1 } };
      return { data: { instansi: item, metadata } };
    });
    expect((await repository.getReferenceData()).metadata.id).toBe('development-v1');
    expect((await repository.listInstansi()).items[0].name).toBe('Nama versi 1');
    expect((await repository.getInstansiDetail('demo-a'))?.instansi.name).toBe('Nama versi 1');
    version = 2;
    expect((await repository.getReferenceData()).metadata.id).toBe('development-v2');
    expect((await repository.listInstansi()).items[0].name).toBe('Nama versi 2');
    expect((await repository.getInstansiDetail('demo-a'))?.instansi.name).toBe('Nama versi 2');
  });
  it('tautan kembali mempertahankan mode development dan ID wilayah', () => {
    const { snapshot } = makeFixture();
    const url = new URL(getReturnMapUrl('?data=dev', snapshot.instansi[0]), 'http://localhost');
    expect(url.searchParams.get('data')).toBe('dev');
    expect(url.searchParams.get('kabKota')).toBe(snapshot.instansi[0].kabKotaId);
  });
  it('detail SIKN membaca kontak terbaru saat diminta kembali, tanpa cache kontak permanen', async () => {
    const fixture = makeFixture();
    let calls = 0;
    const repository = createApiRepository('http://localhost/api/v1', 'sikn', async () => {
      calls++;
      return { data: { instansi: { ...fixture.snapshot.instansi[0], email: `office-${calls}@example.invalid` } } };
    });
    expect((await repository.getInstansiDetail('demo-a'))?.instansi.email).toBe('office-1@example.invalid');
    expect((await repository.getInstansiDetail('demo-a'))?.instansi.email).toBe('office-2@example.invalid');
    expect(calls).toBe(2);
  });
});
