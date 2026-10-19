import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseJson, parseReferenceData, parseSnapshotData } from '../src/services/validation';
import { SHARED_DATASETS } from '../src/data/sharedDatasets';
import type { SnapshotData } from '../src/types/domain';

export async function validateSharedData(root = process.cwd()) {
  const read = async (url: string) => {
    if (!url.startsWith('/data/') || url.includes('..')) throw new Error('Path katalog tidak sah.');
    return readFile(resolve(root, 'public', url.slice(1)), 'utf8');
  };
  const manifest = JSON.parse(await read('/data/datasets/manifest.json')) as {
    defaultDataset: string;
    datasets: Record<'pilot' | 'excel', { snapshot: string; references: string; records: number; pins: number; years: number; verifiedLandingPages: number }>;
    sha256: Record<string, string>;
  };
  if (manifest.defaultDataset !== 'pilot') throw new Error('Default kolaborasi harus pilot.');
  for (const [url, expected] of Object.entries(manifest.sha256)) {
    const hash = createHash('sha256').update(await read(url)).digest('hex');
    if (hash !== expected) throw new Error(`Checksum berubah: ${url}`);
  }
  const snapshots = {} as Record<'pilot' | 'excel', SnapshotData>;
  const sensitiveKeys = /^(password|passwd|secret|token|cookie|authorization|apiKey|pic|nik|nip)$/i;
  const scan = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (sensitiveKeys.test(key) && item != null && item !== '') throw new Error('Field privat terdeteksi; nilai tidak ditampilkan.');
        scan(item);
      }
    } else if (typeof value === 'string') {
      if (/\.local\/|(?:^|[\s"'=])\/(?:Users|home)\/|-----BEGIN .*PRIVATE KEY-----|\bBearer\s+\S+|\bgh[pousr]_[A-Za-z0-9]{20,}/.test(value))
        throw new Error('Path privat atau pola kredensial terdeteksi; nilai tidak ditampilkan.');
    }
  };
  for (const mode of ['pilot', 'excel'] as const) {
    const entry = manifest.datasets[mode];
    if (entry.snapshot !== SHARED_DATASETS[mode].snapshot || entry.references !== SHARED_DATASETS[mode].references)
      throw new Error('Path runtime tidak sesuai manifest rilis.');
    for (const url of [entry.snapshot, entry.references]) {
      if (!manifest.sha256[url]) throw new Error('Katalog belum menyertakan checksum dependensi.');
    }
    const references = parseReferenceData(parseJson(await read(entry.references), entry.references));
    const snapshot = parseSnapshotData(parseJson(await read(entry.snapshot), entry.snapshot), references);
    scan(snapshot); scan(references);
    if (snapshot.metadata.datasetKind !== mode || snapshot.metadata.nationalTotal !== null) throw new Error('Mode atau total nasional tidak sesuai.');
    const actual = {
      records: snapshot.instansi.length,
      pins: snapshot.instansi.filter((item) => item.coordinates !== null).length,
      years: snapshot.instansi.filter((item) => item.joinedYear !== null).length,
      verifiedLandingPages: snapshot.instansi.filter((item) => item.landingPageVerificationStatus === 'verified').length,
    };
    for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
      if (actual[key] !== entry[key]) throw new Error(`Jumlah ${key} tidak sesuai manifest ${mode}.`);
    }
    if (snapshot.instansi.some((item) => item.email !== null || item.phone !== null)) throw new Error('Kontak baru memerlukan review berbagi.');
    for (const region of references.kabKota) {
      if (region.geometryUrl && !manifest.sha256[region.geometryUrl]) throw new Error('Geometri tidak tercakup checksum.');
    }
    if (mode === 'pilot' && (!snapshot.metadata.verificationNotes.join(' ').includes('DATA SIMULASI') ||
      snapshot.statistics.some((row) => Object.values(row.statistik).some((metric) => !metric.definition.includes('SIMULASI')))))
      throw new Error('Statistik pilot harus tetap berlabel simulasi.');
    if (mode === 'excel' && snapshot.statistics.length !== 0) throw new Error('Snapshot Excel tidak boleh mewarisi statistik simulasi.');
    snapshots[mode] = snapshot;
  }
  const full = new Map(snapshots.excel.instansi.map((item) => [item.id, item]));
  for (const item of snapshots.pilot.instansi) {
    const source = full.get(item.id);
    if (!source || (['name', 'kode', 'jenisId', 'joinedYear'] as const).some((key) => item[key] !== source[key]))
      throw new Error('Identitas atau tahun pilot berbeda dengan snapshot Excel.');
  }
  // Paket hanya berisi keluaran runtime yang telah disepakati.
  const files = await readdir(resolve(root, 'public/data/datasets'), { recursive: true });
  for (const name of files) {
    if (/\.json$/.test(name) && !['manifest.json', 'pilot/snapshot.json', 'pilot/references.json', 'excel/snapshot.json'].includes(name.replaceAll('\\', '/')))
      throw new Error('File JSON tambahan belum masuk daftar berbagi.');
  }
  return { pilot: snapshots.pilot.instansi.length, excel: snapshots.excel.instansi.length, files: Object.keys(manifest.sha256).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateSharedData().then((result) => console.log('Dataset bersama valid:', result)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Validasi gagal.'); process.exitCode = 1;
  });
}
