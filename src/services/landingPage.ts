import type { Instansi, SnapshotData } from '../types/domain';

const landingPath = /^\/deskripsi-arsip\/sj\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validasi bentuk URL saja; kesesuaian nama instansi tetap perlu bukti sumber. */
export function safeLandingPageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim() || /[\\\s%]/.test(value))
    return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'jikn.anri.go.id' ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== '' ||
      !landingPath.test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function validLandingPageTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    return false;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}

export function verifiedLandingPageUrl(instansi: Instansi): string | null {
  if (
    instansi.landingPageVerificationStatus !== 'verified' ||
    !instansi.landingPageSource?.trim() ||
    !validLandingPageTimestamp(instansi.landingPageVerifiedAt)
  )
    return null;
  return safeLandingPageUrl(instansi.landingPageUrl);
}

export interface LandingPageMapping {
  instansiId: string;
  expectedName: string;
  landingPageUrl: string;
  landingPageSource: string;
  landingPageVerificationStatus: 'verified';
  landingPageVerifiedAt: string;
}

export class LandingPageMappingError extends Error {
  constructor(readonly issues: string[]) {
    super(`Pemetaan Landing Page ditolak: ${issues.join('; ')}`);
    this.name = 'LandingPageMappingError';
  }
}

/** Tidak mencari URL melalui jaringan dan tidak menebak pencocokan berdasarkan nama. */
export function applyLandingPageMappings(
  snapshot: SnapshotData,
  input: unknown,
  now = new Date(),
): SnapshotData {
  if (!Array.isArray(input))
    throw new LandingPageMappingError(['berkas mapping harus berupa array']);
  const issues: string[] = [];
  const records = new Map(snapshot.instansi.map((instansi) => [instansi.id, instansi]));
  if (records.size !== snapshot.instansi.length)
    issues.push('snapshot memiliki ID instansi duplikat');
  const mappings = new Map<string, LandingPageMapping>();
  for (const [index, value] of input.entries()) {
    const label = `mapping baris ${index + 1}`;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issues.push(`${label} harus berupa objek`);
      continue;
    }
    const row = value as Record<string, unknown>;
    const id = typeof row.instansiId === 'string' ? row.instansiId : '';
    const instansi = records.get(id);
    if (!instansi) issues.push(`${label}: ID ${id || '(kosong)'} tidak ditemukan`);
    if (mappings.has(id)) issues.push(`${label}: duplikasi ID ${id}`);
    if (typeof row.expectedName !== 'string' || row.expectedName.normalize('NFC') !== instansi?.name.normalize('NFC'))
      issues.push(`${label}: nama tidak cocok dengan record ID ${id}`);
    const url = safeLandingPageUrl(row.landingPageUrl);
    if (url === null) issues.push(`${label}: URL JIKN tidak sah`);
    if (typeof row.landingPageSource !== 'string' || !row.landingPageSource.trim())
      issues.push(`${label}: sumber/bukti pencocokan wajib diisi`);
    if (row.landingPageVerificationStatus !== 'verified')
      issues.push(`${label}: hasil verifikasi harus verified`);
    if (!validLandingPageTimestamp(row.landingPageVerifiedAt))
      issues.push(`${label}: waktu verifikasi harus ISO 8601 dengan zona waktu`);
    else if (Date.parse(row.landingPageVerifiedAt) > now.getTime())
      issues.push(`${label}: waktu verifikasi belum terjadi`);
    // Semua baris harus lolos sebelum ada hasil baru; snapshot masukan tidak dimutasi.
    mappings.set(id, { ...row, landingPageUrl: url } as unknown as LandingPageMapping);
  }
  const instansi = snapshot.instansi.map((record) => {
    const mapping = mappings.get(record.id);
    if (!mapping) return record;
    return {
      ...record,
      landingPageUrl: mapping.landingPageUrl,
      landingPageSource: mapping.landingPageSource,
      landingPageVerificationStatus: mapping.landingPageVerificationStatus,
      landingPageVerifiedAt: mapping.landingPageVerifiedAt,
    };
  });
  const owners = new Map<string, string>();
  for (const record of instansi) {
    const url = safeLandingPageUrl(record.landingPageUrl);
    if (!url) continue;
    // UUID bersifat case-insensitive untuk mendeteksi URL sama yang disalin ke instansi lain.
    const key = url.toLowerCase();
    const owner = owners.get(key);
    if (owner && owner !== record.id)
      issues.push(`URL yang sama dipakai oleh ID ${owner} dan ${record.id}`);
    owners.set(key, record.id);
  }
  if (issues.length) throw new LandingPageMappingError(issues);
  return { ...snapshot, instansi };
}
