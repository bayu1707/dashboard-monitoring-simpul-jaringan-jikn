import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateSharedData } from '../scripts/validate-shared-data';
import { createSharedRepository } from '../src/services/localRepository';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Paket kolaborasi mandiri', () => {
  it('checksum, schema, ID, tahun, provenance dan label simulasi konsisten', async () => {
    await expect(validateSharedData()).resolves.toMatchObject({ pilot: 643, excel: 643 });
  });
  it('repository pilot dan Excel memuat data yang sama tanpa flag lokal, tanpa mencampurkan statistik', async () => {
    vi.stubEnv('VITE_LOCAL_PILOT', '0'); vi.stubEnv('VITE_LOCAL_CASEFILE', '0');
    const fetcher = vi.fn(async (path: string) => new Response(await readFile(resolve('public', path.slice(1)), 'utf8')));
    vi.stubGlobal('fetch', fetcher);
    const pilot = createSharedRepository('pilot');
    const list = await pilot.listInstansi();
    expect(list.items).toHaveLength(643);
    expect(list.items.filter((item) => item.coordinates)).toHaveLength(627);
    const anri = list.items.find((item) => item.name === 'Arsip Nasional RI')!;
    const preview = await pilot.getInstansiDetail(anri.id);
    expect(preview?.instansi.joinedYear).toBe(2015);
    expect(preview?.instansi.landingPageVerificationStatus).toBe('verified');
    expect(preview?.metadata.datasetKind).toBe('pilot');
    const excel = createSharedRepository('excel');
    const full = await excel.listInstansi();
    expect(full.items).toHaveLength(643);
    expect(full.items.every((item) => item.coordinates === null)).toBe(true);
    const detail = await excel.getInstansiDetail(anri.id);
    expect(detail?.instansi.joinedYear).toBe(anri.joinedYear);
    expect(detail?.statistik.jumlahArsip.value).toBeNull();
    expect(detail?.metadata.datasetKind).toBe('excel');
    expect(fetcher.mock.calls.every(([path]) => !path.includes('local-data'))).toBe(true);
  });
});
