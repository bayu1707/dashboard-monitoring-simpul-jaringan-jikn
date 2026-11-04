import { describe, expect, it } from 'vitest';
import {
  calculateContribution,
  formatMetric,
  trendForRange,
  validEmail,
  validPhone,
} from '../app/services/metrics';
import {
  DataValidationError,
  parseJson,
  parseReferenceData,
  parseSnapshotData,
  validCoordinates,
  validDate,
  validTimestamp,
} from '../app/services/validation';
import { makeFixture } from './fixtures/data';

const errors = (mutate: (fixture: ReturnType<typeof makeFixture>) => void) => {
  const fixture = makeFixture();
  mutate(fixture);
  return () => parseSnapshotData(fixture.snapshot, fixture.references);
};

describe('Validasi snapshot sintetis', () => {
  it('menerima demo berlabel jelas dan koordinat null', () => {
    const { snapshot } = makeFixture();
    expect(snapshot.metadata.datasetKind).toBe('demo');
    expect(snapshot.instansi).toHaveLength(7);
    expect(snapshot.instansi[2]!.coordinates).toBeNull();
  });
  it('melaporkan ID ganda dengan ID dan sumber tanpa penggabungan', () => {
    const validate = errors(({ snapshot }) =>
      snapshot.instansi.push({ ...snapshot.instansi[0]! }),
    );
    expect(validate).toThrow(
      /duplikasi ID demo-a; sumber public\/demo\/snapshot.json/,
    );
  });
  it('menolak kabupaten/kota yang tidak sesuai provinsi', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.instansi[0]!.provinceId = '31';
      }),
    ).toThrow(/tidak sesuai provinsi/);
  });
  it('menolak statistik dengan ID instansi tidak ditemukan', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.instansiId = 'absent';
      }),
    ).toThrow(/instansiId absent tidak ditemukan/);
  });
  it('menolak kategori jenis atau distribusi yang tidak sah', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.instansi[0]!.jenisId = 'tidak-sah';
      }),
    ).toThrow(/jenisId kategori tidak sah/);
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.distribusiArsip![0]!.categoryId = 'tidak-sah';
      }),
    ).toThrow(/categoryId kategori tidak sah/);
  });
  it('menolak metric negatif, menerima nol dan null', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.statistik.jumlahArsip.value = -1;
      }),
    ).toThrow(/nonnegatif/);
    const { snapshot } = makeFixture();
    expect(snapshot.statistics[1]!.statistik.jumlahArsip.value).toBe(0);
    expect(snapshot.statistics[2]!.statistik.jumlahArsip.value).toBeNull();
  });
  it('menolak statistik snapshot tidak konsisten', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.statistik.jumlahArsip.snapshotId = 'other';
      }),
    ).toThrow(/tidak konsisten/);
  });
  it('melaporkan numerator yang melampaui denominator kompatibel dan definisi metric tidak cocok', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.statistik.jumlahArsip.value = 331;
      }),
    ).toThrow(/melampaui denominator/);
    expect(
      errors(({ snapshot }) => {
        snapshot.metadata.nationalTotal!.definition = 'definisi lain';
      }),
    ).toThrow(/nationalTotal.definition/);
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.statistik.jumlahArsip.definition =
          'definisi lain';
      }),
    ).toThrow(/definisi metadata/);
  });
  it('menolak tahun bergabung masa depan dan tanggal tidak valid', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.instansi[0]!.joinedYear = 2027;
      }),
    ).toThrow(/joinedYear/);
    expect(
      errors(({ snapshot }) => {
        snapshot.instansi[0]!.sourceUpdatedAt = '2026-02-30';
      }),
    ).toThrow(/sourceUpdatedAt tidak valid/);
  });
  it('menolak koordinat di luar rentang atau bukan pasangan', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.instansi[0]!.coordinates = [91, 106];
      }),
    ).toThrow(/coordinates/);
    expect(validCoordinates([0, 0, 1])).toBe(false);
    expect(validCoordinates([0, 0])).toBe(true); // [0,0] sah secara geografis; tidak pernah menggantikan null.
  });
  it('menolak bulan tambahan arsip yang berbeda dengan bulan acuan', () => {
    expect(
      errors(({ snapshot }) => {
        snapshot.statistics[0]!.monthlyAdded!.yearMonth = '2026-09';
      }),
    ).toThrow(/bulan kalender/);
  });
  it('menolak referensi ganda dan relasi tidak sah', () => {
    const { references } = makeFixture();
    references.provinces.push({ ...references.provinces[0]! });
    expect(() => parseReferenceData(references)).toThrow(/duplikasi ID/);
    const fresh = makeFixture().references;
    fresh.kabKota[0]!.provinceId = 'absent';
    expect(() => parseReferenceData(fresh)).toThrow(/relasi provinsi/);
  });
  it('menolak JSON rusak dan struktur tidak lengkap', () => {
    expect(() => parseJson('{not json', 'source.json')).toThrow(
      /JSON tidak valid; sumber source.json/,
    );
    const { references } = makeFixture();
    expect(() => parseSnapshotData({}, references)).toThrow(
      DataValidationError,
    );
  });
  it('mewajibkan waktu pengambilan dengan zona waktu', () => {
    expect(validTimestamp('2026-10-12T21:00:00+07:00')).toBe(true);
    expect(validTimestamp('2026-10-12T21:00:00')).toBe(false);
    expect(validDate('2026-02-30')).toBe(false);
    expect(
      errors(({ snapshot }) => {
        snapshot.metadata.capturedAt = '2026-10-12T21:00:00';
      }),
    ).toThrow(/zona waktu/);
  });
});

describe('Metric dan interpretasi', () => {
  it('membedakan null dengan nol dalam tampilan', () => {
    expect(formatMetric(null)).toBe('Belum tersedia');
    expect(formatMetric(0)).toBe('0');
    expect(formatMetric(12430)).toBe('12.430');
  });
  it('menghitung kontribusi hanya dengan total sumber yang kompatibel', () => {
    const { snapshot } = makeFixture();
    const numerator = snapshot.statistics[0]!.statistik.jumlahArsip;
    expect(calculateContribution(numerator, snapshot.metadata)).toBeCloseTo(
      (120 / 330) * 100,
    );
    expect(
      calculateContribution({ ...numerator, value: 0 }, snapshot.metadata),
    ).toBe(0);
    expect(
      calculateContribution({ ...numerator, value: null }, snapshot.metadata),
    ).toBeNull();
  });
  it.each(['snapshotId', 'referenceDate', 'definition'] as const)(
    'menyembunyikan kontribusi ketika %s berbeda',
    (key) => {
      const { snapshot } = makeFixture();
      expect(
        calculateContribution(
          {
            ...snapshot.statistics[0]!.statistik.jumlahArsip,
            [key]: 'different',
          },
          snapshot.metadata,
        ),
      ).toBeNull();
    },
  );
  it('tidak menghitung total nasional dari sampel parsial atau denominator nol', () => {
    const { snapshot } = makeFixture();
    const numerator = snapshot.statistics[0]!.statistik.jumlahArsip;
    expect(
      calculateContribution(numerator, {
        ...snapshot.metadata,
        coverage: 'partial',
      }),
    ).toBeNull();
    expect(
      calculateContribution(numerator, {
        ...snapshot.metadata,
        nationalTotal: null,
      }),
    ).toBeNull();
    expect(
      calculateContribution(numerator, {
        ...snapshot.metadata,
        nationalTotal: { ...snapshot.metadata.nationalTotal!, value: 0 },
      }),
    ).toBeNull();
  });
  it('mempertahankan tahun kosong dan nol dalam rentang kalender', () => {
    const series = [
      { year: 2022, count: 2 },
      { year: 2024, count: 0 },
      { year: 2026, count: null },
    ];
    expect(trendForRange(series, '5', '2026-10-12')).toEqual([
      { year: 2022, count: 2 },
      { year: 2023, count: null },
      { year: 2024, count: 0 },
      { year: 2025, count: null },
      { year: 2026, count: null },
    ]);
    expect(trendForRange(series, '1', '2026-10-12')).toEqual([
      { year: 2026, count: null },
    ]);
    expect(trendForRange(null, 'all', '2026-10-12')).toBeNull();
  });
  it('membatasi tautan kontak ke nilai yang sah', () => {
    expect(validEmail('demo@example.test')).toBe(true);
    expect(validEmail('bukan email')).toBe(false);
    expect(validPhone('+62 21 123456')).toBe(true);
    expect(validPhone('belum tersedia')).toBe(false);
  });
});
