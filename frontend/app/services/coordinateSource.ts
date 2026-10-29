import type { CoordinateVerificationMethod } from '../types/domain';

export function safeCoordinateSource(
  value: unknown,
  method: unknown = 'google-maps-place',
): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    if (method === 'google-maps-place') {
      return [
        'google.com',
        'www.google.com',
        'maps.google.com',
        'google.co.id',
        'www.google.co.id',
        'maps.google.co.id',
      ].includes(url.hostname) && url.pathname.startsWith('/maps/')
        ? url.href
        : null;
    }
    if (
      method === 'official-map-embed' ||
      method === 'official-published-coordinates'
    ) {
      return ['go.id', 'ac.id', 'sch.id', 'mil.id'].some((suffix) =>
        url.hostname.endsWith(`.${suffix}`),
      )
        ? url.href
        : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function coordinateMethod(
  value: unknown,
): CoordinateVerificationMethod | null {
  return value === undefined || value === 'google-maps-place'
    ? 'google-maps-place'
    : value === 'official-map-embed' ||
        value === 'official-published-coordinates'
      ? value
      : null;
}
