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

// Geser paling jauh satu diameter badge, bukan sampai ratusan piksel dari wilayahnya.
export const MAX_REGION_LABEL_OFFSET = 56;
const labelOffsets: [number, number][] = [[0, 0]];
for (let radius = 4; radius <= MAX_REGION_LABEL_OFFSET; radius += 4) {
  for (let step = 0; step < 24; step++) {
    const angle = step * Math.PI / 12;
    labelOffsets.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
}

/** Cari posisi terdekat dalam radius terbatas; satu tombol tetap satu ID. */
export function placeRegionLabels(summaries: RegionSummary[], project: (region: Wilayah) => { x: number; y: number }): { summary: RegionSummary; offset: [number, number] }[] {
  const placements: { summary: RegionSummary; offset: [number, number] }[] = [];
  const occupied: { x: number; y: number }[] = [];
  for (const summary of [...summaries].sort((a, b) => a.region.id.localeCompare(b.region.id))) {
    const point = project(summary.region);
    const clearance = ([dx, dy]: [number, number]) => Math.min(...occupied.map((other) =>
      Math.hypot(point.x + dx - other.x, point.y + dy - other.y)));
    // Bila tidak ada ruang penuh, pilih celah terbaik dalam radius yang sama.
    // Kembali ke [0,0] justru dapat menutupi pusat tombol lain sepenuhnya.
    const offset = labelOffsets.find((candidate) => clearance(candidate) >= 54)
      ?? labelOffsets.reduce((best, candidate) => clearance(candidate) > clearance(best) ? candidate : best);
    occupied.push({ x: point.x + offset[0], y: point.y + offset[1] });
    placements.push({ summary, offset });
  }
  return placements;
}
