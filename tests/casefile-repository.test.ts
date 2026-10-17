import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalRepository } from '../src/services/localRepository';
import { parseSnapshotData } from '../src/services/validation';
import { makeFixture } from './fixtures/data';

afterEach(() => vi.unstubAllGlobals());
describe('Snapshot casefile dan geometri terpisah', () => {
  it('menerima lokasi parsial atau belum diketahui tanpa mengubah null menjadi koordinat', () => {
    const { snapshot, references } = makeFixture();
    const item = snapshot.instansi[0]!;
    item.coordinates = null;
    item.kabKotaId = null;
    item.kabKotaName = null;
    expect(parseSnapshotData(snapshot, references).instansi[0]?.provinceId).toBe('36');
    item.provinceId = null;
    item.provinceName = null;
    expect(parseSnapshotData(snapshot, references).instansi[0]?.coordinates).toBeNull();
    item.locationVerificationStatus = 'verified';
    expect(() => parseSnapshotData(snapshot, references)).toThrow(/verified memerlukan/);
  });
  it('memisahkan snapshot Excel lokal dan demo serta memberikan statistik null', async () => {
    const { references, snapshot } = makeFixture();
    snapshot.metadata.datasetKind = 'excel';
    snapshot.metadata.nationalTotal = null;
    snapshot.statistics = [];
    snapshot.instansi.forEach((item) => {
      item.joinedYearSource = 'fixture sintetis sheet casefile';
      item.locationVerificationStatus = 'verified';
      item.locationVerificationNotes = 'Pencocokan sintetis untuk pengujian';
    });
    const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(path.endsWith('references.json') ? references : snapshot)));
    vi.stubGlobal('fetch', fetcher);
    const repository = createLocalRepository(false, true);
    const detail = await repository.getInstansiDetail('demo-a');
    expect(fetcher).toHaveBeenCalledWith('/local-data/snapshot.json', expect.anything());
    expect(detail?.instansi.joinedYear).toBe(2020);
    expect(detail?.statistik.jumlahArsip.value).toBeNull();
    await expect(createLocalRepository(true, true).listInstansi()).rejects.toThrow(/dataset demo/);
  });
  it('geometri dimuat per provinsi saat diperlukan, dicache, dan menolak ID asing', async () => {
    const { references, snapshot } = makeFixture();
    const region = references.kabKota.find((item) => item.id === '36.73')!;
    const geometry = region.geometry;
    region.geometry = null;
    region.geometryUrl = '/data/geometry/kab-kota/36.json';
    let foreign = true;
    const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(
      path.includes('/geometry/') ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: foreign ? '91.01' : region.id }, geometry }] }
        : path.endsWith('references.json') ? references : snapshot,
    )));
    vi.stubGlobal('fetch', fetcher);
    const repository = createLocalRepository(true);
    await repository.getReferenceData();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(repository.getKabKotaGeometry!('36')).rejects.toThrow(/ID asing/);
    foreign = false;
    const loaded = await repository.getKabKotaGeometry!('36');
    expect(loaded.find((item) => item.id === '36.73')?.geometry).toEqual(geometry);
    await repository.getKabKotaGeometry!('36');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(region.geometry).toBeNull();
  });
});
