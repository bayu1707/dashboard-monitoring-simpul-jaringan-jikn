import type {
  ReferenceData,
  SnapshotData,
  SnapshotMetadata,
} from '../types/domain';

export class DataValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Data tidak valid: ${issues.join('; ')}`);
    this.name = 'DataValidationError';
    this.issues = issues;
  }
}

type ObjectValue = Record<string, unknown>;
const isObject = (value: unknown): value is ObjectValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const nullableText = (value: unknown) => value === null || text(value);
const nonNegative = (value: unknown) =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0);

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  return validDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}

export function validCoordinates(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 90 &&
    Math.abs(value[1]) <= 180
  );
}

function object(value: unknown, path: string, issues: string[]): ObjectValue {
  if (!isObject(value)) {
    issues.push(`${path} harus berupa objek`);
    return {};
  }
  return value;
}
function array(value: unknown, path: string, issues: string[]): unknown[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} harus berupa array`);
    return [];
  }
  return value;
}
function requireText(value: unknown, path: string, issues: string[]) {
  if (!text(value)) issues.push(`${path} harus berupa teks yang tidak kosong`);
}
function requireNullableText(value: unknown, path: string, issues: string[]) {
  if (!nullableText(value)) issues.push(`${path} harus berupa teks atau null`);
}
function unique(
  items: unknown[],
  path: string,
  key: string,
  issues: string[],
  fallbackSource = 'dataset saat ini',
) {
  const seen = new Set<unknown>();
  for (const value of items) {
    if (!isObject(value)) continue;
    const id = value[key];
    if (seen.has(id))
      issues.push(
        `${path}: duplikasi ID ${String(id)}; sumber ${String(value.source ?? fallbackSource)}`,
      );
    seen.add(id);
  }
}
function validateMetric(
  value: unknown,
  path: string,
  issues: string[],
  metadata: ObjectValue,
  scope: string,
) {
  const metric = object(value, path, issues);
  if (!nonNegative(metric.value))
    issues.push(
      `${path}.value harus berupa bilangan bulat nonnegatif atau null`,
    );
  for (const key of ['definition', 'scope', 'snapshotId'])
    requireText(metric[key], `${path}.${key}`, issues);
  if (metric.scope !== scope) issues.push(`${path}.scope harus ${scope}`);
  if (!validDate(metric.referenceDate))
    issues.push(`${path}.referenceDate tidak valid`);
  if (
    metric.snapshotId !== metadata.id ||
    metric.referenceDate !== metadata.referenceDate
  )
    issues.push(`${path} tidak konsisten dengan ID/tanggal snapshot`);
}
function validateMetadata(
  value: unknown,
  path: string,
  issues: string[],
): ObjectValue {
  const metadata = object(value, path, issues);
  requireText(metadata.id, `${path}.id`, issues);
  const sources = array(metadata.sources, `${path}.sources`, issues);
  if (!sources.length || sources.some((source) => !text(source)))
    issues.push(
      `${path}.sources harus mencantumkan URL atau nama berkas sumber`,
    );
  if (!validTimestamp(metadata.capturedAt))
    issues.push(
      `${path}.capturedAt harus ISO 8601 dengan zona waktu dan tanggal valid`,
    );
  if (!validDate(metadata.referenceDate))
    issues.push(`${path}.referenceDate tidak valid`);
  if (!['full', 'partial'].includes(String(metadata.coverage)))
    issues.push(`${path}.coverage harus full atau partial`);
  if (!['verified', 'empty', 'demo'].includes(String(metadata.datasetKind)))
    issues.push(`${path}.datasetKind tidak sah`);
  const definitions = object(
    metadata.metricDefinitions,
    `${path}.metricDefinitions`,
    issues,
  );
  for (const [key, definition] of Object.entries(definitions))
    requireText(definition, `${path}.metricDefinitions.${key}`, issues);
  const notes = array(
    metadata.verificationNotes,
    `${path}.verificationNotes`,
    issues,
  );
  if (!notes.length || notes.some((note) => !text(note)))
    issues.push(
      `${path}.verificationNotes harus mencantumkan catatan verifikasi`,
    );
  if (metadata.nationalTotal !== null) {
    validateMetric(
      metadata.nationalTotal,
      `${path}.nationalTotal`,
      issues,
      metadata,
      'nasional',
    );
    if (
      isObject(metadata.nationalTotal) &&
      metadata.nationalTotal.definition !== definitions.jumlahArsip
    )
      issues.push(
        `${path}.nationalTotal.definition harus sesuai definisi jumlahArsip metadata`,
      );
  }
  return metadata;
}
function validateGeometry(value: unknown, path: string, issues: string[]) {
  if (value === null) return;
  const geometry = object(value, path, issues);
  if (
    ![
      'Polygon',
      'MultiPolygon',
      'Point',
      'MultiPoint',
      'LineString',
      'MultiLineString',
      'GeometryCollection',
    ].includes(String(geometry.type))
  ) {
    issues.push(`${path}.type geometri tidak sah`);
    return;
  }
  if (geometry.type === 'GeometryCollection') {
    array(geometry.geometries, `${path}.geometries`, issues).forEach(
      (item, index) =>
        validateGeometry(item, `${path}.geometries[${index}]`, issues),
    );
    return;
  }
  const walk = (coords: unknown): boolean => {
    if (!Array.isArray(coords) || !coords.length) return false;
    if (typeof coords[0] === 'number')
      return (
        coords.length >= 2 &&
        typeof coords[1] === 'number' &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1]) &&
        Math.abs(coords[0]) <= 180 &&
        Math.abs(coords[1]) <= 90
      );
    return coords.every(walk);
  };
  if (!walk(geometry.coordinates))
    issues.push(`${path}.coordinates GeoJSON tidak valid (lng, lat)`);
}

export function parseReferenceData(value: unknown): ReferenceData {
  const issues: string[] = [];
  const data = object(value, 'referensi', issues);
  validateMetadata(data.metadata, 'referensi.metadata', issues);
  const provinces = array(data.provinces, 'referensi.provinces', issues);
  const kabKota = array(data.kabKota, 'referensi.kabKota', issues);
  const provinceIds = new Set(
    provinces.filter(isObject).map((item) => item.id),
  );
  unique([...provinces, ...kabKota], 'referensi.wilayah', 'id', issues);
  for (const [level, values] of [
    ['province', provinces],
    ['kabKota', kabKota],
  ] as const) {
    values.forEach((value, index) => {
      const path = `referensi.${level}[${index}]`;
      const region = object(value, path, issues);
      for (const key of ['id', 'name', 'source'])
        requireText(region[key], `${path}.${key}`, issues);
      requireNullableText(region.sourceId, `${path}.sourceId`, issues);
      if (region.level !== level) issues.push(`${path}.level harus ${level}`);
      if (level === 'province' && region.provinceId !== null)
        issues.push(`${path}.provinceId harus null`);
      if (level === 'kabKota' && !provinceIds.has(region.provinceId))
        issues.push(
          `${path}: relasi provinsi ${String(region.provinceId)} tidak ditemukan`,
        );
      if (
        region.labelPosition !== null &&
        !validCoordinates(region.labelPosition)
      )
        issues.push(`${path}.labelPosition tidak valid`);
      if (
        region.bounds !== null &&
        (!Array.isArray(region.bounds) ||
          region.bounds.length !== 2 ||
          !region.bounds.every(validCoordinates) ||
          region.bounds[0][0] > region.bounds[1][0] ||
          region.bounds[0][1] > region.bounds[1][1])
      )
        issues.push(`${path}.bounds tidak valid`);
      validateGeometry(region.geometry, `${path}.geometry`, issues);
    });
  }
  for (const key of ['jenisInstansi', 'archiveCategories']) {
    const values = array(data[key], `referensi.${key}`, issues);
    unique(values, `referensi.${key}`, 'id', issues);
    values.forEach((value, index) => {
      const item = object(value, `referensi.${key}[${index}]`, issues);
      requireText(item.id, `referensi.${key}[${index}].id`, issues);
      requireText(item.name, `referensi.${key}[${index}].name`, issues);
    });
  }
  if (issues.length) throw new DataValidationError(issues);
  return value as ReferenceData;
}

export function parseSnapshotData(
  value: unknown,
  references: ReferenceData,
): SnapshotData {
  const issues: string[] = [];
  const data = object(value, 'snapshot', issues);
  const metadata = validateMetadata(data.metadata, 'snapshot.metadata', issues);
  const institutions = array(data.instansi, 'snapshot.instansi', issues);
  const statistics = array(data.statistics, 'snapshot.statistics', issues);
  unique(institutions, 'snapshot.instansi', 'id', issues);
  unique(
    statistics,
    'snapshot.statistics',
    'instansiId',
    issues,
    Array.isArray(metadata.sources) ? metadata.sources.join(', ') : 'snapshot',
  );
  const provinceMap = new Map(
    references.provinces.map((item) => [item.id, item]),
  );
  const regionMap = new Map(references.kabKota.map((item) => [item.id, item]));
  const kinds = new Set(references.jenisInstansi.map((item) => item.id));
  const categories = new Map(
    references.archiveCategories.map((item) => [item.id, item.name]),
  );
  const institutionIds = new Set(
    institutions.filter(isObject).map((item) => item.id),
  );
  institutions.forEach((value, index) => {
    const path = `snapshot.instansi[${index}]`;
    const item = object(value, path, issues);
    for (const key of [
      'id',
      'name',
      'provinceId',
      'kabKotaId',
      'provinceName',
      'kabKotaName',
      'source',
    ])
      requireText(item[key], `${path}.${key}`, issues);
    for (const key of [
      'kode',
      'jenisId',
      'email',
      'phone',
      'status',
      'logoUrl',
    ])
      requireNullableText(item[key], `${path}.${key}`, issues);
    const province = provinceMap.get(String(item.provinceId));
    const region = regionMap.get(String(item.kabKotaId));
    if (!province)
      issues.push(
        `${path}: provinsi ${String(item.provinceId)} tidak ditemukan`,
      );
    if (!region || region.provinceId !== item.provinceId)
      issues.push(
        `${path}: kabupaten/kota ${String(item.kabKotaId)} tidak sesuai provinsi ${String(item.provinceId)}`,
      );
    if (province && item.provinceName !== province.name)
      issues.push(`${path}.provinceName tidak sesuai nama referensi asli`);
    if (region && item.kabKotaName !== region.name)
      issues.push(`${path}.kabKotaName tidak sesuai nama referensi asli`);
    if (item.jenisId !== null && !kinds.has(String(item.jenisId)))
      issues.push(`${path}.jenisId kategori tidak sah`);
    if (item.coordinates !== null && !validCoordinates(item.coordinates))
      issues.push(
        `${path}.coordinates harus pasangan [lat, lng] valid atau null`,
      );
    if (
      item.joinedYear !== null &&
      (typeof item.joinedYear !== 'number' ||
        !Number.isInteger(item.joinedYear) ||
        item.joinedYear < 1 ||
        item.joinedYear > Number(String(metadata.referenceDate).slice(0, 4)))
    )
      issues.push(`${path}.joinedYear melampaui tanggal acuan atau tidak sah`);
    if (
      item.sourceUpdatedAt !== null &&
      !validDate(item.sourceUpdatedAt) &&
      !validTimestamp(item.sourceUpdatedAt)
    )
      issues.push(`${path}.sourceUpdatedAt tidak valid`);
  });
  statistics.forEach((value, index) => {
    const path = `snapshot.statistics[${index}]`;
    const item = object(value, path, issues);
    if (!institutionIds.has(item.instansiId))
      issues.push(
        `${path}: instansiId ${String(item.instansiId)} tidak ditemukan`,
      );
    const metrics = object(item.statistik, `${path}.statistik`, issues);
    for (const key of ['jumlahArsip', 'penciptaArsip', 'kopiDigital']) {
      validateMetric(
        metrics[key],
        `${path}.statistik.${key}`,
        issues,
        metadata,
        'instansi',
      );
      if (
        isObject(metrics[key]) &&
        isObject(metadata.metricDefinitions) &&
        metrics[key].definition !== metadata.metricDefinitions[key]
      )
        issues.push(
          `${path}.statistik.${key}.definition tidak cocok dengan definisi metadata`,
        );
    }
    const numerator = metrics.jumlahArsip;
    const denominator = metadata.nationalTotal;
    if (
      metadata.coverage === 'full' &&
      isObject(numerator) &&
      isObject(denominator) &&
      numerator.definition === denominator.definition &&
      numerator.snapshotId === denominator.snapshotId &&
      numerator.referenceDate === denominator.referenceDate &&
      typeof numerator.value === 'number' &&
      typeof denominator.value === 'number' &&
      numerator.value > denominator.value
    )
      issues.push(
        `${path}: jumlah arsip instansi melampaui denominator nasional pada snapshot kompatibel`,
      );
    if (item.multiCreator !== null && typeof item.multiCreator !== 'boolean')
      issues.push(`${path}.multiCreator harus boolean atau null`);
    if (item.trenInput !== null) {
      const years = array(item.trenInput, `${path}.trenInput`, issues);
      unique(years, `${path}.trenInput`, 'year', issues);
      years.forEach((value, position) => {
        const entry = object(value, `${path}.trenInput[${position}]`, issues);
        if (
          typeof entry.year !== 'number' ||
          !Number.isInteger(entry.year) ||
          entry.year < 1 ||
          entry.year > Number(String(metadata.referenceDate).slice(0, 4))
        )
          issues.push(`${path}.trenInput[${position}].year tidak valid`);
        if (!nonNegative(entry.count))
          issues.push(
            `${path}.trenInput[${position}].count harus nonnegatif atau null`,
          );
      });
    }
    if (item.distribusiArsip !== null) {
      const values = array(
        item.distribusiArsip,
        `${path}.distribusiArsip`,
        issues,
      );
      unique(values, `${path}.distribusiArsip`, 'categoryId', issues);
      values.forEach((value, position) => {
        const entry = object(
          value,
          `${path}.distribusiArsip[${position}]`,
          issues,
        );
        if (!categories.has(String(entry.categoryId)))
          issues.push(
            `${path}.distribusiArsip[${position}].categoryId kategori tidak sah`,
          );
        else if (entry.label !== categories.get(String(entry.categoryId)))
          issues.push(
            `${path}.distribusiArsip[${position}].label tidak sesuai taksonomi`,
          );
        if (!nonNegative(entry.count))
          issues.push(
            `${path}.distribusiArsip[${position}].count harus nonnegatif atau null`,
          );
      });
    }
    if (item.penciptaArsip !== null) {
      const values = array(item.penciptaArsip, `${path}.penciptaArsip`, issues);
      unique(values, `${path}.penciptaArsip`, 'id', issues);
      values.forEach((value, position) => {
        const entry = object(
          value,
          `${path}.penciptaArsip[${position}]`,
          issues,
        );
        requireText(entry.id, `${path}.penciptaArsip[${position}].id`, issues);
        requireText(
          entry.name,
          `${path}.penciptaArsip[${position}].name`,
          issues,
        );
        if (!nonNegative(entry.count))
          issues.push(
            `${path}.penciptaArsip[${position}].count harus nonnegatif atau null`,
          );
      });
    }
    if (item.monthlyAdded !== null) {
      const entry = object(item.monthlyAdded, `${path}.monthlyAdded`, issues);
      if (
        typeof entry.yearMonth !== 'string' ||
        !validDate(`${entry.yearMonth}-01`) ||
        entry.yearMonth !== String(metadata.referenceDate).slice(0, 7)
      )
        issues.push(
          `${path}.monthlyAdded.yearMonth harus bulan kalender tanggal acuan`,
        );
      if (!nonNegative(entry.count) || entry.count === null)
        issues.push(`${path}.monthlyAdded.count harus nonnegatif`);
    }
  });
  if (metadata.datasetKind === 'empty' && institutions.length)
    issues.push('snapshot kosong tidak boleh berisi instansi');
  if (issues.length) throw new DataValidationError(issues);
  return value as SnapshotData;
}

export function parseJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DataValidationError([`JSON tidak valid; sumber ${source}`]);
  }
}

export function unknownMetric(metadata: SnapshotMetadata, definition: string) {
  return {
    value: null,
    definition,
    scope: 'instansi',
    snapshotId: metadata.id,
    referenceDate: metadata.referenceDate,
  };
}
