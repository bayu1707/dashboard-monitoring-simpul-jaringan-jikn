import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Geometry, Position } from 'geojson';
import type {
  Coordinates, CoordinateVerificationMethod, Instansi, Metric, ReferenceData, SnapshotData, SnapshotMetadata,
  StatistikRecord, Wilayah,
} from '../src/types/domain';
import {
  parseJson, parseReferenceData, parseSnapshotData, validCoordinates, validTimestamp,
} from '../src/services/validation';
import { coordinateMethod, safeCoordinateSource } from '../src/services/coordinateSource';
import { applyLandingPageMappings, verifiedLandingPageUrl } from '../src/services/landingPage';

/** Titik tempat hasil pemeriksaan manual, bukan hasil geocoding otomatis. */
export interface PilotLocation {
  instansiId: string;
  provinceId: string;
  kabKotaId: string | null;
  coordinates: Coordinates | null;
  address: string | null;
  googleMapsPlaceUrl: string | null;
  coordinateMethod?: CoordinateVerificationMethod | null;
  coordinateSourceUrl?: string | null;
  coordinateEvidence?: string | null;
  coordinateLocationLabel?: string;
  sourceUrls: string[];
  capturedAt: string;
  notes: string;
  name?: string;
  joinedYear?: number | null;
  locationVerificationStatus?: 'verified' | 'needs-review';
  administrativeVerified?: boolean;
  /** Pengecualian manual untuk pin publik dekat batas geometri; bukan izin memindahkan titik. */
  geometryReview?: { reason: string; sourceUrl: string; maxDistanceMeters: number };
}

export const PILOT_PROVINCES = new Set(['31', '32', '33', '34', '35', '36']);
const SIMULATION = 'SIMULASI — bukan data resmi JIKN';
const SIMULATED_CATEGORIES = [
  { id: 'simulasi-dokumen', name: 'Dokumen (simulasi)' },
  { id: 'simulasi-foto', name: 'Foto (simulasi)' },
  { id: 'simulasi-audio', name: 'Audio (simulasi)' },
  { id: 'simulasi-video', name: 'Video (simulasi)' },
];
const DEFINITIONS = {
  jumlahArsip: `${SIMULATION}; jumlah record sintetis untuk penilaian antarmuka.`,
  penciptaArsip: `${SIMULATION}; jumlah entitas pencipta sintetis unik.`,
  kopiDigital: `${SIMULATION}; jumlah kopi digital sintetis, bukan jumlah file arsip sebenarnya.`,
  trenInput: `${SIMULATION}; tambahan record sintetis per tahun kalender hingga 2026, mulai 2022 atau tahun bergabung jika lebih baru; bukan total kumulatif.`,
  distribusiArsip: `${SIMULATION}; pembagian record sintetis menurut empat kategori contoh.`,
  pencipta: `${SIMULATION}; nama Pencipta simulasi A dan seterusnya bukan nama pencipta sebenarnya; satu pencipta per record contoh.`,
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function randomFor(id: string, key: string): number {
  return Number.parseInt(hash(`${id}:${key}`).slice(0, 8), 16);
}

function partition(total: number, weights: number[]): number[] {
  const sum = weights.reduce((value, weight) => value + weight, 0);
  let remainder = total;
  return weights.map((weight, index) => {
    const value = index === weights.length - 1 ? remainder : Math.floor(total * weight / sum);
    remainder -= value;
    return value;
  });
}

function letters(index: number): string {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + current % 26) + result;
    current = Math.floor(current / 26);
  }
  return result;
}

function buildStatistics(instansiId: string, metadata: SnapshotMetadata, joinedYear: number | null): StatistikRecord {
  const jumlahArsip = 1500 + randomFor(instansiId, 'arsip') % 13501;
  const penciptaArsip = 20 + randomFor(instansiId, 'pencipta') % 181;
  const kopiDigital = Math.floor(jumlahArsip * (35 + randomFor(instansiId, 'digital') % 56) / 100);
  const metric = (value: number, key: 'jumlahArsip' | 'penciptaArsip' | 'kopiDigital'): Metric => ({
    value, definition: DEFINITIONS[key], scope: 'instansi',
    snapshotId: metadata.id, referenceDate: metadata.referenceDate,
  });
  const firstYear = Math.max(2022, joinedYear ?? 2022);
  const trendCounts = partition(jumlahArsip, [10, 15, 18, 25, 32].slice(firstYear - 2022));
  const distributionCounts = partition(jumlahArsip, [60, 25, 10, 5]);
  const creatorCounts = partition(jumlahArsip,
    Array.from({ length: penciptaArsip }, (_, index) => 1 + randomFor(instansiId, `pencipta-${index}`) % 10));
  return {
    instansiId,
    statistik: {
      jumlahArsip: metric(jumlahArsip, 'jumlahArsip'),
      penciptaArsip: metric(penciptaArsip, 'penciptaArsip'),
      kopiDigital: metric(kopiDigital, 'kopiDigital'),
    },
    trenInput: trendCounts.map((count, index) => ({ year: firstYear + index, count })),
    distribusiArsip: SIMULATED_CATEGORIES.map((category, index) => ({
      categoryId: category.id, label: category.name, count: distributionCounts[index] ?? 0,
    })),
    penciptaArsip: creatorCounts.map((count, index) => ({
      id: `${instansiId}:simulasi-pencipta-${index + 1}`, name: `Pencipta simulasi ${letters(index)}`, count,
    })),
    multiCreator: false,
    // Tidak mengarang tanggal input bulanan atau tanggal pembaruan sumber.
    monthlyAdded: null,
  };
}

function onSegment(point: Coordinates, start: Position, end: Position): boolean {
  const [y, x] = point;
  const [ax = 0, ay = 0] = start;
  const [bx = 0, by = 0] = end;
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  return Math.abs(cross) < 1e-10 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
    && y >= Math.min(ay, by) && y <= Math.max(ay, by);
}

function inRing(point: Coordinates, ring: Position[]): boolean {
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[i];
    const end = ring[j];
    if (!start || !end) continue;
    if (onSegment(point, start, end)) return true;
    const [ax = 0, ay = 0] = start;
    const [bx = 0, by = 0] = end;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function inGeometry(point: Coordinates, geometry: Geometry): boolean {
  const inPolygon = (rings: Position[][]) => Boolean(rings[0] && inRing(point, rings[0]))
    && !rings.slice(1).some((ring) => inRing(point, ring));
  if (geometry.type === 'Polygon') return inPolygon(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(inPolygon);
  if (geometry.type === 'GeometryCollection') return geometry.geometries.some((item) => inGeometry(point, item));
  throw new Error('Pemeriksaan kantor memerlukan Polygon/MultiPolygon wilayah, bukan geometri titik atau garis.');
}

/** Jarak lokal ke ruas batas. Hanya dipakai untuk tinjauan eksplisit dengan batas paling jauh 100 m. */
function boundaryDistance(point: Coordinates, geometry: Geometry): number {
  const radians = Math.PI / 180;
  const scale = 6371008.8 * radians;
  const [lat, lng] = point;
  const ringDistance = (ring: Position[]) => {
    let nearest = Infinity;
    for (let i = 0; i < ring.length; i += 1) {
      const start = ring[i]!;
      const end = ring[(i + 1) % ring.length]!;
      const ax = (start[0]! - lng) * scale * Math.cos(lat * radians);
      const ay = (start[1]! - lat) * scale;
      const bx = (end[0]! - lng) * scale * Math.cos(lat * radians);
      const by = (end[1]! - lat) * scale;
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
      nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return nearest;
  };
  if (geometry.type === 'Polygon') return Math.min(...geometry.coordinates.map(ringDistance));
  if (geometry.type === 'MultiPolygon') return Math.min(...geometry.coordinates.flatMap((polygon) => polygon.map(ringDistance)));
  if (geometry.type === 'GeometryCollection') return Math.min(...geometry.geometries.map((item) => boundaryDistance(point, item)));
  return Infinity;
}

function geometryReviewNote(location: PilotLocation, region: Wilayah | null): string {
  if (!location.geometryReview || !location.coordinates || !region?.geometry) return '';
  return ` Tinjauan batas geometri: ${location.geometryReview.reason} Jarak ke batas referensi ${boundaryDistance(location.coordinates, region.geometry).toFixed(1)} m; pin sumber tidak dipindahkan. Sumber wilayah/alamat: ${location.geometryReview.sourceUrl}.`;
}

function validateLocation(location: PilotLocation, instansi: Instansi, references: ReferenceData): Wilayah | null {
  const prefix = `Lokasi ${location.instansiId}`;
  if (!PILOT_PROVINCES.has(location.provinceId)) throw new Error(`${prefix}: pilot dibatasi pada enam provinsi di Jawa.`);
  const region = references.kabKota.find((item) => item.id === location.kabKotaId);
  if (location.kabKotaId !== null && (!region || region.provinceId !== location.provinceId))
    throw new Error(`${prefix}: kab/kota tidak sesuai provinsi.`);
  if (location.name !== undefined && location.name !== instansi.name)
    throw new Error(`${prefix}: nama tidak cocok dengan identitas Excel.`);
  if (location.joinedYear !== undefined && location.joinedYear !== instansi.joinedYear)
    throw new Error(`${prefix}: tahun bergabung tidak cocok dengan Excel.`);
  if ((location.address !== null && (typeof location.address !== 'string' || !location.address.trim()))
    || (location.coordinates !== null && !location.address)
    || typeof location.notes !== 'string' || !location.notes.trim())
    throw new Error(`${prefix}: catatan pemeriksaan wajib; alamat harus tersedia sebelum membuat pin kantor.`);
  if (!validTimestamp(location.capturedAt)) throw new Error(`${prefix}: waktu pemeriksaan tidak valid.`);
  if (location.coordinateLocationLabel !== undefined &&
    (typeof location.coordinateLocationLabel !== 'string' || !location.coordinateLocationLabel.trim() || !location.coordinates))
    throw new Error(`${prefix}: label lokasi hanya untuk titik yang tersedia dan harus berupa teks.`);
  if (!Array.isArray(location.sourceUrls) || !location.sourceUrls.length || location.sourceUrls.some((source) => {
    try { return new URL(source).protocol !== 'https:'; } catch { return true; }
  })) throw new Error(`${prefix}: sertakan sumber pemeriksaan HTTPS.`);
  if (location.geometryReview) {
    const review = location.geometryReview;
    if (!location.coordinates || !region?.geometry || typeof review.reason !== 'string' || !review.reason.trim()
      || !Number.isFinite(review.maxDistanceMeters) || review.maxDistanceMeters <= 0 || review.maxDistanceMeters > 100
      || !safeCoordinateSource(review.sourceUrl, 'official-published-coordinates')
      || !location.sourceUrls.includes(review.sourceUrl))
      throw new Error(`${prefix}: tinjauan batas memerlukan geometri, pin, alasan, sumber alamat resmi yang tercatat, serta batas >0 sampai 100 meter.`);
    if (inGeometry(location.coordinates, region.geometry))
      throw new Error(`${prefix}: tinjauan batas hanya diperlukan untuk pin di luar polygon referensi.`);
    if (boundaryDistance(location.coordinates, region.geometry) > review.maxDistanceMeters)
      throw new Error(`${prefix}: jarak pin melebihi batas tinjauan geometri; perlu pemeriksaan ulang.`);
  }
  if (location.locationVerificationStatus !== undefined &&
    !['verified', 'needs-review'].includes(location.locationVerificationStatus))
    throw new Error(`${prefix}: status pemeriksaan wilayah tidak sah.`);
  if (location.coordinates === null) {
    if (location.googleMapsPlaceUrl !== null || !location.locationVerificationStatus)
      throw new Error(`${prefix}: koordinat tidak valid; record tanpa pin harus menyatakan status tinjauan dan URL pin null.`);
    return region ?? null;
  }
  if (!validCoordinates(location.coordinates) || !region) throw new Error(`${prefix}: pasangan koordinat tidak valid atau kab/kota belum diketahui.`);
  if (location.locationVerificationStatus === 'needs-review')
    throw new Error(`${prefix}: lokasi yang masih memerlukan tinjauan tidak boleh mempunyai marker.`);
  const method = coordinateMethod(location.coordinateMethod ?? undefined);
  const source = method === 'google-maps-place' ? location.googleMapsPlaceUrl : location.coordinateSourceUrl;
  if (!method || !safeCoordinateSource(source, method))
    throw new Error(`${prefix}: sumber koordinat harus HTTPS Google Maps atau situs resmi sesuai metode.`);
  if (!source) throw new Error(`${prefix}: sumber koordinat belum tersedia.`);
  if (method === 'google-maps-place') {
    const maps = new URL(source);
    if (!maps.pathname.startsWith('/maps/place/')) throw new Error(`${prefix}: perlu URL tempat Google Maps yang telah diperiksa.`);
    const pair = decodeURIComponent(maps.href).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (!pair || Number(pair[1]) !== location.coordinates[0] || Number(pair[2]) !== location.coordinates[1])
      throw new Error(`${prefix}: koordinat harus sesuai !3d/!4d pin tempat, bukan pusat viewport /@.`);
    if (location.sourceUrls.length < 2) throw new Error(`${prefix}: sertakan sumber Google Maps dan sumber alamat resmi HTTPS.`);
  } else {
    // Bukti menyimpan fitur kantor yang diperiksa, bukan pusat kamera iframe.
    const evidence = location.coordinateEvidence;
    const values = typeof evidence === 'string' ? [...evidence.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])) : [];
    if (!evidence || !location.coordinates.every((coordinate) => values.some((value) => Math.abs(value - coordinate) < 1e-10)))
      throw new Error(`${prefix}: bukti sumber resmi harus memuat pasangan koordinat fitur kantor.`);
  }
  if (!location.sourceUrls.includes(source)) throw new Error(`${prefix}: sumber koordinat harus tercatat dalam sumber pemeriksaan.`);
  if (region.bounds) {
    const [[south, west], [north, east]] = region.bounds;
    const [lat, lng] = location.coordinates;
    if (lat < south || lat > north || lng < west || lng > east)
      throw new Error(`${prefix}: titik berada di luar bounds kab/kota ${region.id}.`);
  }
  if (region.geometry && !inGeometry(location.coordinates, region.geometry) && !location.geometryReview)
    throw new Error(`${prefix}: titik berada di luar polygon kab/kota ${region.id}; perlu peninjauan.`);
  return region;
}

/** Murni: tidak membaca Excel/berkas atau mengubah objek masukan. */
export function buildPilotSnapshot(excel: SnapshotData, refs: ReferenceData, locations: PilotLocation[], landingPages: unknown = []) {
  parseReferenceData(refs);
  parseSnapshotData(excel, refs);
  if (excel.metadata.datasetKind !== 'excel') throw new Error('Sumber pilot harus snapshot Excel; data demo tidak boleh dicampur.');
  if (!locations.length) throw new Error('Belum ada lokasi kantor yang diperiksa untuk pilot.');
  if (Number(excel.metadata.referenceDate.slice(0, 4)) < 2026)
    throw new Error('Seri simulasi 2022–2026 memerlukan tanggal acuan Excel tahun 2026 atau setelahnya.');
  const unique = new Map<string, PilotLocation>();
  const sourceInstitutions = new Map(excel.instansi.map((item) => [item.id, item]));
  const sortedLocations = [...locations].sort((a, b) => a.instansiId.localeCompare(b.instansiId));
  let repeatedIdentical = 0;
  for (const location of sortedLocations) {
    const instansi = sourceInstitutions.get(location.instansiId);
    if (!instansi) throw new Error(`ID ${location.instansiId} tidak ditemukan pada snapshot Excel; tidak membuat instansi baru.`);
    validateLocation(location, instansi, refs);
    const previous = unique.get(location.instansiId);
    if (previous) {
      if (hash(JSON.stringify(previous)) !== hash(JSON.stringify(location)))
        throw new Error(`ID ${location.instansiId} mempunyai dua pemetaan lokasi yang konflik; tinjau sumber secara manual.`);
      repeatedIdentical += 1;
    } else unique.set(location.instansiId, structuredClone(location));
  }
  const ordered = [...unique.values()];
  const identity = ordered.map((location) => ({
    location, institution: sourceInstitutions.get(location.instansiId),
  }));
  const capturedAt = [excel.metadata.capturedAt, ...ordered.map((location) => location.capturedAt)]
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? excel.metadata.capturedAt;
  const metadata: SnapshotMetadata = {
    id: `pilot-jawa-${hash(JSON.stringify({ version: 4, identity, definitions: DEFINITIONS, landingPages })).slice(0, 16)}`,
    datasetKind: 'pilot', coverage: 'partial', capturedAt,
    referenceDate: excel.metadata.referenceDate,
    sources: [...new Set([...excel.metadata.sources, ...ordered.flatMap((item) => item.sourceUrls)])].sort(),
    metricDefinitions: DEFINITIONS,
    nationalTotal: null,
    coverageDescription: `Percontohan Jawa: ${ordered.length} instansi dari snapshot Excel. Kantor tanpa pin yang dapat dipastikan tetap tersedia dalam daftar. Cakupan instansi masih parsial, bukan seluruh simpul atau statistik resmi JIKN.`,
    verificationNotes: [
      'DATA SIMULASI: semua statistik, tren, distribusi dan pencipta dibuat untuk demonstrasi antarmuka atas permintaan pengguna; bukan data resmi instansi/JIKN.',
      'Nama, kode, ID lokal dan tahun bergabung tetap berasal dari Indonesia.xlsx — sheet pengelolaan casefile. Tahun bergabung bukan hasil API SIKN.',
      'Koordinat berasal dari pin Google Maps yang diperiksa manual, fitur peta tertanam pada situs resmi, atau publikasi koordinat resmi. Perbedaan alamat dan rujukan historis dicatat per record; pin publik bukan pengesahan lokasi kantor terkini oleh ANRI. Pusat kamera bukan titik kantor. Tidak ada geocoding otomatis.',
      'Pengecualian pin dekat batas polygon hanya diterima melalui tinjauan per record dengan sumber alamat resmi dan jarak paling jauh 100 meter. Jarak dan alasan dicatat; titik sumber tidak dipindahkan agar masuk polygon.',
      'Record tanpa koordinat tetap dihitung dan dapat dibuka lewat Daftar. Wilayah administratif yang diketahui tidak diubah menjadi koordinat kantor; konflik alamat dicatat untuk tinjauan.',
      'Posisi institusi bukan jaminan lokasi ruang penyimpanan arsip. Pengelola perlu mengonfirmasi sebelum penggunaan operasional.',
      'Kategori arsip dan nama pencipta pada pilot merupakan contoh sintetis. Seri hingga 2026 membagi jumlah record sintetis menjadi tambahan tahunan yang sama pada bar/garis dan tidak mendahului tahun bergabung pada Excel.',
      'Kontak, status simpul, logo, tanggal pembaruan, jumlah bulan ini dan Landing Page tidak dikarang. Total arsip nasional tidak tersedia.',
      'Kontribusi percontohan membagi jumlah arsip sintetis instansi dengan total arsip sintetis seluruh instansi pilot pada snapshot yang sama; tidak dihitung sebagai kontribusi nasional JIKN.',
      'Berkas pilot hanya untuk review localhost di .local/pilot; tidak disalin ke build atau diunggah ke GitHub. Data bukan real-time.',
    ],
  };
  const references: ReferenceData = {
    ...structuredClone(refs),
    provinces: refs.provinces.filter((item) => PILOT_PROVINCES.has(item.id)).map((item) => structuredClone(item)),
    kabKota: refs.kabKota.filter((item) => item.provinceId && PILOT_PROVINCES.has(item.provinceId))
      .map((item) => ({ ...structuredClone(item), geometry: item.geometryUrl ? null : structuredClone(item.geometry) })),
    archiveCategories: structuredClone(SIMULATED_CATEGORIES),
    metadata: {
      ...structuredClone(refs.metadata), id: `referensi-${metadata.id}`, coverage: 'partial',
      coverageDescription: 'Referensi wilayah enam provinsi Jawa beserta seluruh kab/kotanya; geometri kab/kota dimuat saat dipilih.',
      verificationNotes: [...refs.metadata.verificationNotes, 'Pilot membatasi referensi wilayah ke kode 31–36; label administratif tidak dijadikan koordinat instansi. Empat kategori arsip pilot adalah kategori SIMULASI.'],
      nationalTotal: null, sampleTotal: null,
    },
  };
  const sourceInstansi = ordered.map((location): Instansi => {
    const original = sourceInstitutions.get(location.instansiId)!;
    const region = refs.kabKota.find((item) => item.id === location.kabKotaId);
    const province = refs.provinces.find((item) => item.id === location.provinceId)!;
    return {
      ...structuredClone(original),
      provinceId: province.id, provinceName: province.name,
      kabKotaId: region?.id ?? null, kabKotaName: region?.name ?? null,
      coordinates: location.coordinates ? [...location.coordinates] : null,
      coordinateSource: location.coordinates ? (location.coordinateMethod && location.coordinateMethod !== 'google-maps-place'
        ? location.coordinateSourceUrl! : location.googleMapsPlaceUrl!) : undefined,
      coordinatesVerificationMethod: location.coordinates ? coordinateMethod(location.coordinateMethod ?? undefined)! : undefined,
      coordinateLocationLabel: location.coordinates ? location.coordinateLocationLabel : undefined,
      coordinatesVerifiedAt: location.coordinates ? location.capturedAt : undefined,
      coordinatesVerificationNotes: location.coordinates ? `${location.address}. ${location.notes}${geometryReviewNote(location, region ?? null)} Sumber pencocokan: ${location.sourceUrls.join(' | ')}` : undefined,
      locationVerificationStatus: location.locationVerificationStatus ?? 'verified',
      locationVerificationNotes: `${location.address ? `${location.address}. ` : 'Alamat kantor belum tersedia. '}${location.notes}${geometryReviewNote(location, region ?? null)}${location.coordinates ? '' : ` Sumber tinjauan: ${location.sourceUrls.join(' | ')}`}`,
    };
  });
  const snapshot = applyLandingPageMappings({ metadata, instansi: sourceInstansi,
    statistics: sourceInstansi.map((item) => buildStatistics(item.id, metadata, item.joinedYear)) }, landingPages);
  const instansi = snapshot.instansi;
  const simulatedCounts = snapshot.statistics.map((item) => item.statistik.jumlahArsip.value);
  metadata.sampleTotal = {
    value: simulatedCounts.every((value) => value !== null)
      ? simulatedCounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
    definition: DEFINITIONS.jumlahArsip, scope: 'percontohan',
    snapshotId: metadata.id, referenceDate: metadata.referenceDate,
  };
  parseReferenceData(references);
  parseSnapshotData(snapshot, references);
  const countBy = (key: 'provinceId' | 'kabKotaId' | 'jenisId') => Object.fromEntries(
    [...new Set(instansi.map((item) => item[key]))].sort().map((id) => [String(id), instansi.filter((item) => item[key] === id).length]),
  );
  return {
    snapshot, references,
    report: {
      snapshotId: metadata.id, capturedAt, datasetKind: 'pilot', coverage: 'partial',
      sourceExcelSnapshotId: excel.metadata.id,
      totalExcelRecords: excel.instansi.length, selectedRecords: instansi.length,
      recordsOutsidePilot: excel.instansi.length - instansi.length,
      identicalMappingsIgnored: repeatedIdentical,
      validOfficeCoordinates: instansi.filter((item) => item.coordinates !== null).length,
      missingOfficeCoordinates: instansi.filter((item) => item.coordinates === null).length,
      provinces: references.provinces.length, kabKota: references.kabKota.length,
      byProvince: countBy('provinceId'), byKabKota: countBy('kabKotaId'), byCategory: countBy('jenisId'),
      byLocationStatus: Object.fromEntries(['verified', 'needs-review'].map((status) => [status, instansi.filter((item) => item.locationVerificationStatus === status).length])),
      missingPins: instansi.filter((item) => !item.coordinates).map((item) => ({ id: item.id, name: item.name,
        provinceId: item.provinceId, kabKotaId: item.kabKotaId, reason: item.locationVerificationNotes })),
      simulatedStatistics: true, statisticsDescription: SIMULATION,
      nationalTotalAvailable: false,
      simulatedArchiveTotal: metadata.sampleTotal.value,
      verifiedLandingPages: instansi.filter((item) => verifiedLandingPageUrl(item) !== null).length,
      geometryReviews: ordered.filter((item) => item.geometryReview).map((item) => ({
        id: item.instansiId, kabKotaId: item.kabKotaId, ...item.geometryReview,
        distanceMeters: Number(boundaryDistance(item.coordinates!, refs.kabKota.find((region) => region.id === item.kabKotaId)!.geometry!).toFixed(2)),
      })),
      records: instansi.map((item) => ({
        id: item.id, name: item.name, joinedYear: item.joinedYear, joinedYearSource: item.joinedYearSource,
        provinceId: item.provinceId, kabKotaId: item.kabKotaId, coordinates: item.coordinates,
        coordinateSource: item.coordinateSource, coordinatesVerifiedAt: item.coordinatesVerifiedAt, coordinatesVerificationMethod: item.coordinatesVerificationMethod,
        coordinatesVerificationNotes: item.coordinatesVerificationNotes,
        landingPageUrl: item.landingPageUrl, landingPageSource: item.landingPageSource,
        landingPageVerificationStatus: item.landingPageVerificationStatus, landingPageVerifiedAt: item.landingPageVerifiedAt,
      })),
    },
  };
}

function readLocations(value: unknown, source: string): PilotLocation[] {
  const records = Array.isArray(value) ? value
    : typeof value === 'object' && value !== null && 'records' in value ? value.records : null;
  if (!Array.isArray(records) || records.some((item) => typeof item !== 'object' || item === null
    || !('instansiId' in item) || typeof item.instansiId !== 'string'))
    throw new Error(`Berkas ${source} harus berisi array lokasi atau objek dengan records.`);
  return records.map((item: Record<string, unknown>) => ({
    ...item,
    googleMapsPlaceUrl: item.googleMapsPlaceUrl === undefined ? item.coordinateSourceUrl : item.googleMapsPlaceUrl,
  })) as PilotLocation[];
}

async function main() {
  const inputs = process.argv.slice(2);
  const landingFlag = inputs.indexOf('--landing-pages');
  let landingPages: unknown = [];
  if (landingFlag !== -1) {
    const mappingPath = inputs[landingFlag + 1];
    if (!mappingPath || mappingPath.startsWith('--')) throw new Error('--landing-pages memerlukan path berkas mapping yang ditinjau.');
    landingPages = parseJson(await readFile(resolve(mappingPath), 'utf8'), mappingPath);
    inputs.splice(landingFlag, 2);
  }
  const outputFlag = inputs.indexOf('--output');
  let output = resolve('.local/pilot');
  if (outputFlag !== -1) {
    const value = inputs[outputFlag + 1];
    if (!value || value.startsWith('--')) throw new Error('--output memerlukan folder di dalam .local/.');
    output = resolve(value);
    if (!output.startsWith(`${resolve('.local')}/`)) throw new Error('Dataset pengguna hanya boleh dibangun di dalam .local/ untuk review privat.');
    inputs.splice(outputFlag, 2);
  }
  if (!inputs.length)
    throw new Error('Pemakaian: npm run build:pilot -- lokasi-jakarta.json lokasi-banten.json; output privat .local/pilot/.');
  const references = parseReferenceData(parseJson(await readFile(resolve('public/data/references.json'), 'utf8'), 'referensi nasional'));
  // Muat geometri untuk pemeriksaan titik saja; keluaran tetap memakai geometryUrl dan lazy loading.
  for (const provinceId of PILOT_PROVINCES) {
    const geometryPath = resolve(`public/data/geometry/kab-kota/${provinceId}.json`);
    const geometry = parseJson(await readFile(geometryPath, 'utf8'), geometryPath) as {
      features: Array<{ id: string; geometry: Geometry }>;
    };
    for (const feature of geometry.features) {
      const region = references.kabKota.find((item) => item.id === String(feature.id));
      if (region) region.geometry = feature.geometry;
    }
  }
  const excel = parseSnapshotData(parseJson(await readFile(resolve('.local/casefile/snapshot.json'), 'utf8'), 'snapshot Excel lokal'), references);
  const locations: PilotLocation[] = [];
  for (const input of inputs)
    locations.push(...readLocations(parseJson(await readFile(resolve(input), 'utf8'), input), input));
  const result = buildPilotSnapshot(excel, references, locations, landingPages);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'locations.json'), `${JSON.stringify({ records: locations }, null, 2)}\n`, 'utf8');
  for (const [name, data] of Object.entries(result))
    await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  process.stdout.write(`Pilot lokal: ${result.snapshot.instansi.length} instansi, ${result.report.validOfficeCoordinates} titik kantor, ${result.references.provinces.length} provinsi/${result.references.kabKota.length} kab/kota.\nStatistik: ${SIMULATION}.\nOutput: ${output}\nSnapshot Excel asli tidak diubah; tidak ada commit/push.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
