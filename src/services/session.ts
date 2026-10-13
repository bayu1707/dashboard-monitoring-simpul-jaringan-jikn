import type { Instansi, MapSession } from '../types/domain';
const KEY = 'jikn-map-session-v1';
export function saveMapSession(session: MapSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* Penyimpanan browser dapat dinonaktifkan. */
  }
}
export function readMapSession(query?: string): MapSession | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as MapSession;
    if (
      typeof value.query !== 'string' ||
      !Array.isArray(value.center) ||
      value.center.length !== 2 ||
      !value.center.every(Number.isFinite) ||
      value.center[0] < -90 ||
      value.center[0] > 90 ||
      value.center[1] < -180 ||
      value.center[1] > 180 ||
      !Number.isFinite(value.zoom) ||
      value.zoom < 0 ||
      value.zoom > 20 ||
      !Number.isFinite(value.listScroll) ||
      typeof value.listOpen !== 'boolean'
    )
      return null;
    if (query !== undefined && value.query !== query) return null;
    return value;
  } catch {
    return null;
  }
}
export function getReturnMapUrl(search: string, detail?: Instansi): string {
  const current = new URLSearchParams(search);
  const saved = readMapSession();
  const savedParams = new URLSearchParams(saved?.query);
  if (
    saved &&
    savedParams.get('demo') === current.get('demo') &&
    (!detail ||
      (savedParams.get('provinsi') === detail.provinceId &&
        savedParams.get('kabKota') === detail.kabKotaId))
  )
    return `/simpul-jaringan${saved.query}`;
  const query = new URLSearchParams();
  if (current.get('demo') === '1') query.set('demo', '1');
  if (detail) {
    query.set('provinsi', detail.provinceId);
    query.set('kabKota', detail.kabKotaId);
    // Tipe dari profil diketahui valid; query jenis asing tidak diwariskan.
    if (current.get('jenis') === detail.jenisId && detail.jenisId)
      query.set('jenis', detail.jenisId);
  }
  return `/simpul-jaringan${query.size ? `?${query}` : ''}`;
}
