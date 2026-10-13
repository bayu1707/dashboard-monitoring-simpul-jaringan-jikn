import type { Metric, SnapshotMetadata, TrenInput } from '../types/domain';

export function formatMetric(value: number | null): string {
  return value === null
    ? 'Belum tersedia'
    : new Intl.NumberFormat('id-ID').format(value);
}

/** Total nasional berasal dari sumber; tidak pernah dijumlahkan dari sampel instansi. */
export function calculateContribution(
  numerator: Metric,
  metadata: SnapshotMetadata,
): number | null {
  const denominator = metadata.nationalTotal;
  if (
    numerator.value === null ||
    !Number.isFinite(numerator.value) ||
    numerator.value < 0 ||
    !denominator ||
    denominator.value === null ||
    denominator.value <= 0 ||
    !Number.isFinite(denominator.value)
  )
    return null;
  if (
    metadata.coverage !== 'full' ||
    numerator.scope !== 'instansi' ||
    denominator.scope !== 'nasional'
  )
    return null;
  if (
    numerator.definition !== denominator.definition ||
    numerator.snapshotId !== denominator.snapshotId ||
    numerator.referenceDate !== denominator.referenceDate
  )
    return null;
  if (
    metadata.id !== denominator.snapshotId ||
    metadata.referenceDate !== denominator.referenceDate ||
    numerator.value > denominator.value
  )
    return null;
  return (numerator.value / denominator.value) * 100;
}

/** Tahun kalender yang belum diketahui tetap null; rentang Semua berhenti di tahun tersedia terakhir. */
export function trendForRange(
  series: TrenInput[] | null,
  range: '1' | '5' | 'all',
  referenceDate: string,
): TrenInput[] | null {
  if (series === null || series.length === 0) return series;
  const valid = series
    .filter((item) => item.year <= Number(referenceDate.slice(0, 4)))
    .sort((a, b) => a.year - b.year);
  if (!valid.length) return [];
  const referenceYear = Number(referenceDate.slice(0, 4));
  const first =
    range === 'all' ? valid[0]!.year : referenceYear - (range === '5' ? 4 : 0);
  const last = range === 'all' ? valid[valid.length - 1]!.year : referenceYear;
  const counts = new Map(valid.map((item) => [item.year, item.count]));
  return Array.from({ length: last - first + 1 }, (_, index) => ({
    year: first + index,
    count: counts.get(first + index) ?? null,
  }));
}

export function validEmail(value: string | null): value is string {
  return value !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validPhone(value: string | null): value is string {
  return (
    value !== null &&
    /^\+?[\d\s().-]{6,20}$/.test(value) &&
    value.replace(/\D/g, '').length >= 6
  );
}
