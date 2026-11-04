import type {
  ExplorationState,
  Instansi,
  ReferenceData,
} from '../types/domain';

export const NATIONAL_STATE: ExplorationState = {
  level: 'nasional',
  provinceId: null,
  kabKotaId: null,
  jenisId: null,
};

export function parseExplorationQuery(
  params: URLSearchParams,
  references: ReferenceData,
): ExplorationState {
  const provinceId = params.get('provinsi');
  if (
    !provinceId ||
    !references.provinces.some((item) => item.id === provinceId)
  )
    return { ...NATIONAL_STATE };
  const kabKotaId = params.get('kabKota');
  const region = references.kabKota.find(
    (item) => item.id === kabKotaId && item.provinceId === provinceId,
  );
  if (!region)
    return { level: 'provinsi', provinceId, kabKotaId: null, jenisId: null };
  const kind = params.get('jenis');
  const jenisId = references.jenisInstansi.some((item) => item.id === kind)
    ? kind
    : null;
  return { level: 'instansi', provinceId, kabKotaId: region.id, jenisId };
}

export function explorationToQuery(
  state: ExplorationState,
  demo = false,
): string {
  const params = new URLSearchParams();
  if (state.provinceId) params.set('provinsi', state.provinceId);
  if (state.provinceId && state.kabKotaId)
    params.set('kabKota', state.kabKotaId);
  if (state.provinceId && state.kabKotaId && state.jenisId)
    params.set('jenis', state.jenisId);
  if (demo) params.set('demo', '1');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function selectProvince(
  state: ExplorationState,
  id: string | null,
  references: ReferenceData,
): ExplorationState {
  if (!id || !references.provinces.some((item) => item.id === id))
    return { ...NATIONAL_STATE };
  if (state.provinceId === id && state.level === 'provinsi') return state;
  return { level: 'provinsi', provinceId: id, kabKotaId: null, jenisId: null };
}
export function selectKabKota(
  state: ExplorationState,
  id: string | null,
  references: ReferenceData,
): ExplorationState {
  if (
    !state.provinceId ||
    !references.provinces.some((item) => item.id === state.provinceId)
  )
    return { ...NATIONAL_STATE };
  if (
    !id ||
    !references.kabKota.some(
      (item) => item.id === id && item.provinceId === state.provinceId,
    )
  )
    return {
      level: 'provinsi',
      provinceId: state.provinceId,
      kabKotaId: null,
      jenisId: null,
    };
  return {
    level: 'instansi',
    provinceId: state.provinceId,
    kabKotaId: id,
    jenisId: null,
  };
}
export function selectJenis(
  state: ExplorationState,
  id: string | null,
  references: ReferenceData,
): ExplorationState {
  if (!canPreviewInstansi(state, references))
    return { ...state, jenisId: null };
  return {
    ...state,
    jenisId: references.jenisInstansi.some((item) => item.id === id)
      ? id
      : null,
  };
}
export function goNational(): ExplorationState {
  return { ...NATIONAL_STATE };
}
export function goProvince(state: ExplorationState): ExplorationState {
  return state.provinceId
    ? {
        level: 'provinsi',
        provinceId: state.provinceId,
        kabKotaId: null,
        jenisId: null,
      }
    : goNational();
}
export function canPreviewInstansi(
  state: ExplorationState,
  references: ReferenceData,
): boolean {
  return (
    state.level === 'instansi' &&
    references.provinces.some((item) => item.id === state.provinceId) &&
    references.kabKota.some(
      (item) =>
        item.id === state.kabKotaId && item.provinceId === state.provinceId,
    )
  );
}
export function filterInstansi(
  items: Instansi[],
  filters: Partial<ExplorationState>,
): Instansi[] {
  return items.filter(
    (item) =>
      (!filters.provinceId || item.provinceId === filters.provinceId) &&
      (!filters.kabKotaId || item.kabKotaId === filters.kabKotaId) &&
      (!filters.jenisId || item.jenisId === filters.jenisId),
  );
}
export function countInstansi(items: Instansi[]): {
  total: number;
  mapped: number;
  unmapped: number;
} {
  const unique = new Map(items.map((item) => [item.id, item]));
  const mapped = [...unique.values()].filter(
    (item) => item.coordinates !== null,
  ).length;
  return { total: unique.size, mapped, unmapped: unique.size - mapped };
}
