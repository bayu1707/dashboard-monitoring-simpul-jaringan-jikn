import { useEffect, useMemo, useState } from 'react';
import type { InstansiRepository, ReferenceData, Wilayah } from '../types/domain';

/** Registry ringan selalu tersedia. Polygon kabupaten dimuat hanya saat provinsi dipilih. */
export function useRegionGeometry(repository: InstansiRepository, references: ReferenceData, provinceId: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    repository: InstansiRepository; provinceId: string; regions: Wilayah[]; error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!provinceId || !repository.getKabKotaGeometry) return;
    let active = true;
    void repository.getKabKotaGeometry(provinceId).then((regions) => {
      if (active) setResult({ repository, provinceId, regions, error: null });
    }).catch((error: unknown) => {
      if (active) setResult({ repository, provinceId, regions: [], error: error instanceof Error ? error.message : 'Geometri belum dapat dimuat.' });
    });
    return () => { active = false; };
  }, [repository, provinceId, attempt]);
  const current = result?.repository === repository && result.provinceId === provinceId ? result : null;
  const mapReferences = useMemo(() => current?.regions.length ? {
    ...references,
    kabKota: references.kabKota.map((region) => current.regions.find((value) => value.id === region.id) ?? region),
  } : references, [references, current]);
  return { mapReferences, geometryError: current?.error, retryGeometry: () => setAttempt((n) => n + 1) };
}
