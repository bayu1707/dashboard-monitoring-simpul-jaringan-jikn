import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalRepository } from '../src/services/localRepository';
import {
  calculateContribution,
  formatMetric,
  trendForRange,
  validEmail,
  validPhone,
} from '../src/services/metrics';
import {
  DataValidationError,
  parseJson,
  parseReferenceData,
  parseSnapshotData,
  validCoordinates,
  validDate,
  validTimestamp,
} from '../src/services/validation';
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

describe('Repository lokal asinkron', () => {
  afterEach(() => vi.unstubAllGlobals());
  function sourceFetch() {
    const fixture = makeFixture();
    const fetchMock = vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path.includes('references') ? fixture.references : fixture.snapshot,
          ),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    return { fixture, fetchMock };
  }
  it('memfilter dengan AND dan membuka detail tanpa memilih jenis', async () => {
    const { fetchMock } = sourceFetch();
    const repository = createLocalRepository(true);
    const result = await repository.listInstansi({
      provinceId: '36',
      kabKotaId: '36.73',
      jenisId: 'demo-pemerintah',
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'demo-a',
      'demo-d',
      'demo-g',
    ]);
    expect((await repository.getInstansiDetail('demo-a'))?.instansi.name).toBe(
      'Instansi Demo A',
    );
    expect(await repository.getInstansiDetail('tidak-ditemukan')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('menampilkan profil parsial dengan metric yang belum tersedia bernilai null', async () => {
    const { fixture } = sourceFetch();
    fixture.snapshot.statistics = [];
    const detail =
      await createLocalRepository(true).getInstansiDetail('demo-a');
    expect(detail?.statistik.jumlahArsip.value).toBeNull();
    expect(detail?.instansi.joinedYear).toBe(2020);
  });
  it('membaca ulang sumber yang sama setelah kegagalan jaringan', async () => {
    const { fixture } = sourceFetch();
    let fails = true;
    const mock = vi.fn(async (path: string) => {
      if (path.includes('snapshot') && fails)
        return new Response('', { status: 503 });
      return new Response(
        JSON.stringify(
          path.includes('references') ? fixture.references : fixture.snapshot,
        ),
      );
    });
    vi.stubGlobal('fetch', mock);
    const repository = createLocalRepository(true);
    await expect(repository.listInstansi()).rejects.toThrow(/503/);
    fails = false;
    await expect(repository.listInstansi()).resolves.toMatchObject({
      items: expect.any(Array),
    });
    expect(
      mock.mock.calls.filter(([path]) => path === '/demo/snapshot.json'),
    ).toHaveLength(2);
  });
  it('menolak dataset demo pada mode utama', async () => {
    sourceFetch();
    await expect(createLocalRepository(false).listInstansi()).rejects.toThrow(
      /penanda dataset demo/,
    );
  });
});
