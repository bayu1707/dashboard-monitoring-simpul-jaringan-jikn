import type { ExplorationState, Instansi, ReferenceData, Wilayah } from '../types/domain';

export interface RegionSummary {
  region: Wilayah;
  count: number;
}

/** Ringkasan administratif, terpisah dari cluster spasial dan koordinat kantor. */
export function regionSummaries(state: ExplorationState, references: ReferenceData, allItems: Instansi[]): RegionSummary[] {
  if (state.level === 'instansi') return [];
  const regions = state.level === 'nasional' ? references.provinces
    : state.level === 'provinsi' ? references.kabKota.filter((region) => region.provinceId === state.provinceId)
      : [];
  const unique = [...new Map(allItems.map((item) => [item.id, item])).values()];
  return regions.flatMap((region) => {
    if (!region.labelPosition || !region.labelPositionSource) return [];
    const items = unique.filter((item) => region.level === 'province' ? item.provinceId === region.id : item.kabKotaId === region.id);
    return items.length ? [{ region, count: items.length }] : [];
  });
}
