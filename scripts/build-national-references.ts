/** Referensi publik berlisensi MIT. Tidak membaca Excel atau menghasilkan titik kantor. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Feature, Geometry, Position } from 'geojson';
import type { ReferenceData, Wilayah } from '../src/types/domain';

const registryCommit = '5d450ccbc94cc487f54bf2a262300efe97aa58af';
const geometryCommit = '28230eca6e787bac229db56825bd5b1843662c96';
const capturedAt = process.env.REFERENCE_CAPTURED_AT ?? new Date().toISOString();
const output = resolve('public/data');
const cache = resolve('tmp/national-references');
const sourceFiles: { url: string; sha256: string; bytes: number }[] = [];

async function download(repository: string, commit: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/cahyadsn/${repository}/${commit}/${path}`;
  const cached = resolve(cache, repository, commit, path);
  let content: string;
  try { content = await readFile(cached, 'utf8'); }
  catch {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    content = await response.text();
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, content);
  }
  sourceFiles.push({ url, sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content) });
  return content;
}

/** Membaca literal SQL sebagai data; tidak menjalankan SQL atau eval. */
function sqlFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  const body = line.trim().replace(/[,;]$/, '').slice(1, -1);
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (char === '\\' && quoted) { current += body[++index] ?? ''; }
    else if (char === "'") {
      if (quoted && body[index + 1] === "'") { current += "'"; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { fields.push(current.trim()); current = ''; }
    else current += char;
  }
  if (quoted) throw new Error('Literal SQL tidak ditutup.');
  fields.push(current.trim());
  return fields;
}

function rows(sql: string): string[][] {
  return sql.split('\n').filter((line) => /^\s*\('\d{2}(?:\.\d{2})?',/.test(line)).map(sqlFields);
}

function depth(value: unknown): number {
  return Array.isArray(value) ? 1 + Math.max(0, ...value.map(depth)) : 0;
}

function point(value: unknown, round = true): Position {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('Pasangan koordinat batas tidak valid.');
  }
  const lat = value[0] as number;
  const lng = value[1] as number;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) throw new Error(`Koordinat di luar cakupan Indonesia: ${lat}, ${lng}`);
  // Sumber Leaflet: [lat,lng]; keluaran GeoJSON: [lng,lat]. Tidak menjadi koordinat instansi.
  return round ? [Number(lng.toFixed(5)), Number(lat.toFixed(5))] : [lng, lat];
}

let omittedDegenerateRings = 0;
let fullPrecisionRings = 0;
function ring(value: unknown): Position[] {
  if (!Array.isArray(value)) throw new Error('Ring bukan array.');
  let points = value.map((p) => point(p));
  if (new Set(points.map((p) => p.join(','))).size < 3) {
    points = value.map((p) => point(p, false));
    fullPrecisionRings++;
  }
  if (new Set(points.map((p) => p.join(','))).size < 3) {
    // Sumber memiliki beberapa ring dua titik (luas nol) di Kabupaten Sorong.
    // Tidak membuat titik ketiga: abaikan ring tidak berbentuk area dan laporkan.
    omittedDegenerateRings++;
    return [];
  }
  const result = points.filter((p, i, all) => i === 0 || p[0] !== all[i - 1]?.[0] || p[1] !== all[i - 1]?.[1]);
  const first = result[0]!;
  const last = result[result.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) result.push([...first]);
  return result;
}

function polygon(value: unknown): Position[][] {
  if (!Array.isArray(value) || !value.length) throw new Error('Poligon kosong.');
  const rings = value.map(ring);
  if (!rings[0]?.length) return [];
  return rings.filter((r) => r.length);
}

function geometry(path: string): Geometry {
  const value: unknown = JSON.parse(path);
  switch (depth(value)) {
    case 2: return { type: 'Polygon', coordinates: [ring(value)] };
    case 3: return { type: 'Polygon', coordinates: polygon(value) };
    case 4: return { type: 'MultiPolygon', coordinates: (value as unknown[]).map(polygon).filter((p) => p.length) };
    default: throw new Error('Hierarki poligon tidak dikenali.');
  }
}

function bounds(geom: Geometry): NonNullable<Wilayah['bounds']> {
  const positions: Position[] = [];
  function collect(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number') positions.push(value as Position);
    else value.forEach(collect);
  }
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') throw new Error('Bukan area.');
  collect(geom.coordinates);
  return [
    [Math.min(...positions.map((p) => p[1]!)), Math.min(...positions.map((p) => p[0]!))],
    [Math.max(...positions.map((p) => p[1]!)), Math.max(...positions.map((p) => p[0]!))],
  ];
}

async function json(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}

const registrySql = await download('wilayah', registryCommit, 'db/wilayah_level_1_2.sql');
const registry = rows(registrySql);
const provinces = registry.filter(([id]) => id?.length === 2);
const kabKota = registry.filter(([id]) => id?.length === 5);
if (provinces.length !== 38 || kabKota.length !== 514 || new Set(registry.map(([id]) => id)).size !== 552) {
  throw new Error('Jumlah atau keunikan registry berbeda dari 38 provinsi + 514 kabupaten/kota; tinjau sumber.');
}
const geometries = new Map<string, { geometry: Geometry; source: string; labelPosition: [number, number] }>();
const exceptions: { id: string; name: string; source: string; reason: string }[] = [];
const geometryNotes: { id: string; name: string; source: string; omittedDegenerateRings: number; fullPrecisionRings: number }[] = [];
const paths = [
  ...Array.from({ length: 8 }, (_, i) => `db/prov/wilayah_boundaries_prov_${i + 1}.sql`),
  ...provinces.map(([id]) => `db/kab/wilayah_boundaries_kab_${id}.sql`),
];
// Enam unduhan paralel; cache lokal memungkinkan regenerasi tanpa mengunduh ulang.
for (let index = 0; index < paths.length; index += 6) {
  await Promise.all(paths.slice(index, index + 6).map(async (path) => {
    const sql = await download('wilayah_boundaries', geometryCommit, path);
    if (!sql.includes('MIT License')) throw new Error(`Lisensi file tidak ditemukan: ${path}`);
    const source = `https://github.com/cahyadsn/wilayah_boundaries/blob/${geometryCommit}/${path}`;
    for (const row of rows(sql)) {
      const [id, name, latitude, longitude, coordinates] = row;
      if (!id || !name || !coordinates || row.length !== 5) throw new Error(`Format baris tidak dikenali: ${path}`);
      if (geometries.has(id)) throw new Error(`ID geometri duplikat: ${id}`);
      try {
        const beforeOmitted = omittedDegenerateRings;
        const beforePrecision = fullPrecisionRings;
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -12 || lat > 7 || lng < 94 || lng > 142)
          throw new Error(`Posisi label wilayah tidak sah: ${id}`);
        geometries.set(id, { geometry: geometry(coordinates), source, labelPosition: [lat, lng] });
        if (beforeOmitted !== omittedDegenerateRings || beforePrecision !== fullPrecisionRings) {
          geometryNotes.push({ id, name, source, omittedDegenerateRings: omittedDegenerateRings - beforeOmitted, fullPrecisionRings: fullPrecisionRings - beforePrecision });
        }
      }
      catch (error) { exceptions.push({ id, name, source, reason: String(error) }); }
    }
  }));
}

const registrySource = `https://github.com/cahyadsn/wilayah/blob/${registryCommit}/db/wilayah_level_1_2.sql`;
function region(row: string[]): Wilayah {
  const [id, name] = row;
  if (!id || !name) throw new Error('Registry tanpa identitas.');
  const area = geometries.get(id);
  return {
    id, name, level: id.length === 2 ? 'province' : 'kabKota', provinceId: id.length === 2 ? null : id.slice(0, 2),
    geometry: id.length === 2 ? area?.geometry ?? null : null,
    bounds: area ? bounds(area.geometry) : null,
    labelPosition: area?.labelPosition ?? null, source: registrySource, sourceId: id,
    ...(area ? { labelPositionSource: `${area.source} — kolom lat/lng untuk label navigasi wilayah, bukan lokasi kantor` } : {}),
    ...(id.length === 5 && area ? { geometryUrl: `/data/geometry/kab-kota/${id.slice(0, 2)}.json` } : {}),
  };
}
const previous = JSON.parse(await readFile(resolve(output, 'references.json'), 'utf8')) as ReferenceData;
const references: ReferenceData = {
  provinces: provinces.map(region).sort((a, b) => a.name.localeCompare(b.name, 'id')),
  kabKota: kabKota.map(region).sort((a, b) => a.name.localeCompare(b.name, 'id')),
  jenisInstansi: [
    { id: 'kl', name: 'Kementerian/Lembaga' },
    { id: 'lkd-provinsi', name: 'LKD Provinsi' },
    { id: 'lkd-kabupaten', name: 'LKD Kabupaten' },
    { id: 'lkd-kota', name: 'LKD Kota' },
    { id: 'ptn', name: 'Perguruan Tinggi Negeri' },
    { id: 'ptkn', name: 'Perguruan Tinggi Keagamaan Negeri' },
    { id: 'pts', name: 'Perguruan Tinggi Swasta' },
    { id: 'ptk', name: 'Perguruan Tinggi Kedinasan' },
    { id: 'bumn', name: 'Badan Usaha Milik Negara' },
  ],
  archiveCategories: previous.archiveCategories,
  metadata: {
    id: 'wilayah-kepmendagri-2025-cahyadsn-20261014', sources: [registrySource, `https://github.com/cahyadsn/wilayah_boundaries/tree/${geometryCommit}`],
    capturedAt, referenceDate: '2026-10-14', coverage: 'full', datasetKind: 'verified',
    coverageDescription: 'Registry 38 provinsi dan 514 kabupaten/kota; geometri tampilan dari cahyadsn, berlisensi MIT.',
    metricDefinitions: {}, nationalTotal: null,
    verificationNotes: [
      'Kode dan nama beracuan Kepmendagri 300.2.2-2430 Tahun 2025 menurut penerbit; termasuk enam provinsi wilayah Papua (91–96).',
      'Geometri komunitas yang telah disederhanakan oleh sumber, bukan penetapan batas hukum atau koordinat kantor instansi.',
      'Koordinat batas sumber lat/lng derajat dikonversi menjadi GeoJSON longitude/latitude; datum sumber tidak dinyatakan eksplisit.',
      'Tanggal pengambilan bukan tanggal pembaruan semua batas. Geometri kabupaten/kota dimuat per provinsi.',
      'Posisi label navigasi memakai kolom lat/lng wilayah dari sumber; tidak pernah disalin menjadi koordinat instansi.',
      `Geometri gagal validasi: ${exceptions.length}. Record tetap tersedia melalui daftar.`,
      `${omittedDegenerateRings} ring sumber berluas nol (kurang dari tiga titik unik) tidak digambar; rincian pada geometry/metadata.json.`,
    ],
  },
};
await json(resolve(output, 'references.json'), references);
for (const [provinceId] of provinces) {
  const features: Feature[] = references.kabKota.filter((r) => r.provinceId === provinceId && geometries.has(r.id)).map((r) => ({
    type: 'Feature', id: r.id, properties: { id: r.id, name: r.name, provinceId, source: geometries.get(r.id)!.source }, geometry: geometries.get(r.id)!.geometry,
  }));
  await json(resolve(output, `geometry/kab-kota/${provinceId}.json`), { type: 'FeatureCollection', features });
}
const manifest = {
  capturedAt, registryCommit, geometryCommit, registrySource, license: 'MIT',
  coordinateSystem: 'GeoJSON [longitude, latitude] dalam derajat; sumber Leaflet [latitude, longitude]. Datum tidak dinyatakan eksplisit oleh penerbit.',
  provinceCount: references.provinces.length, kabKotaCount: references.kabKota.length,
  provinceGeometryCount: references.provinces.filter((r) => r.geometry).length,
  kabKotaGeometryCount: references.kabKota.filter((r) => r.geometryUrl).length,
  precisionDecimals: 5, precisionNote: 'Presisi asli dipertahankan pada ring kecil yang akan runtuh bila dibulatkan.',
  exceptions, geometryNotes: geometryNotes.sort((a, b) => a.id.localeCompare(b.id)), sourceFiles: sourceFiles.sort((a, b) => a.url.localeCompare(b.url)),
};
await json(resolve(output, 'geometry/metadata.json'), manifest);
await mkdir(resolve(output, 'geometry'), { recursive: true });
await writeFile(resolve(output, 'geometry/LICENSE-cahyadsn.txt'), await download('wilayah_boundaries', geometryCommit, 'LICENSE'));
console.log(JSON.stringify({ provinces: manifest.provinceCount, kabKota: manifest.kabKotaCount, provinceGeometry: manifest.provinceGeometryCount, kabKotaGeometry: manifest.kabKotaGeometryCount, exceptions }, null, 2));
