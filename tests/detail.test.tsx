import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type {
  InstansiDetail,
  InstansiRepository,
  Metric,
  ReferenceData,
  SnapshotMetadata,
} from '../src/types/domain';
import { InstansiDetailPage } from '../src/pages/InstansiDetailPage';
import { StatisticCards } from '../src/components/instansi/StatisticCards';
import { TrendCard } from '../src/components/charts/TrendCard';
import { DistributionCard } from '../src/components/charts/DistributionCard';
import { CreatorsCard } from '../src/components/charts/CreatorsCard';
import { calculateContribution } from '../src/services/metrics';
import { saveMapSession } from '../src/services/session';

// Grafik diuji melalui tabel data aksesibel. Rendering SVG sebenarnya diperiksa di browser.
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    ComposedChart: Container,
    PieChart: Container,
    Pie: Container,
    Bar: Empty,
    Line: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Cell: Empty,
  };
});

function metric(
  value: number | null,
  definition = 'Record sintetis unik',
): Metric {
  return {
    value,
    definition,
    scope: 'instansi',
    snapshotId: 'test-synthetic',
    referenceDate: '2026-10-12',
  };
}
const metadata: SnapshotMetadata = {
  id: 'test-synthetic',
  sources: ['fixture unit test sintetis'],
  capturedAt: '2026-10-12T19:00:00+07:00',
  referenceDate: '2026-10-12',
  coverage: 'full',
  datasetKind: 'demo',
  metricDefinitions: {},
  verificationNotes: ['DATA DEMO'],
  nationalTotal: { ...metric(100), scope: 'nasional' },
};
const detail: InstansiDetail = {
  instansi: {
    id: 'unit-demo-a',
    name: 'Instansi Demo A',
    kode: null,
    jenisId: 'demo',
    provinceId: '36',
    kabKotaId: '3673',
    provinceName: 'Banten',
    kabKotaName: 'Kota Serang',
    email: null,
    phone: 'bukan nomor',
    joinedYear: null,
    status: null,
    logoUrl: null,
    coordinates: null,
    sourceUpdatedAt: '2026-10-01',
    source: 'fixture unit test sintetis',
  },
  metadata,
  statistik: {
    jumlahArsip: metric(0),
    penciptaArsip: metric(null, 'Pencipta unik sintetis'),
    kopiDigital: metric(0, 'Kopi digital sintetis'),
  },
  trenInput: null,
  distribusiArsip: null,
  penciptaArsip: null,
  multiCreator: null,
  monthlyAdded: { yearMonth: '2025-10', count: 7 },
};
const references: ReferenceData = {
  provinces: [],
  kabKota: [],
  jenisInstansi: [{ id: 'demo', name: 'Jenis Demo' }],
  archiveCategories: [],
  metadata,
};
function repository(value: InstansiDetail | null = detail): InstansiRepository {
  return {
    getReferenceData: vi.fn().mockResolvedValue(references),
    listInstansi: vi.fn().mockResolvedValue({ items: [], metadata }),
    getInstansiDetail: vi.fn().mockResolvedValue(value),
  };
}
function renderPage(
  repo: InstansiRepository,
  path = '/simpul-jaringan/unit-demo-a?demo=1',
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/simpul-jaringan/:id"
          element={<InstansiDetailPage repository={repo} demo />}
        />
        <Route path="/simpul-jaringan" element={<p>Peta dipulihkan</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);
describe('Profil simpul dari repository lokal', () => {
  it('mempertahankan nilai 0, tahun null, status sumber, dan membuang bulan tidak cocok tanpa tab', async () => {
    renderPage(repository());
    await screen.findByRole('heading', { name: 'Instansi Demo A' });
    expect(
      screen.getByText(/DATA DEMO · Instansi dan statistik/),
    ).toBeInTheDocument();
    const profile = screen
      .getByRole('heading', { name: 'Informasi Instansi' })
      .closest('section');
    expect(profile).not.toBeNull();
    const year = within(profile!).getByText('Tahun bergabung').closest('div');
    expect(within(year!).getByText('Belum tersedia')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('Simpul Aktif')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'bukan nomor' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Record ditambahkan bulan acuan'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Pembaruan sumber')).toBeInTheDocument();
    expect(screen.getByText('Snapshot diambil')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('Kembali ke Peta memakai session filter tersimpan dan dapat dinavigasi tanpa history back', async () => {
    saveMapSession({
      query: '?demo=1&provinsi=36&kabKota=3673',
      center: [-6.1, 106.1],
      zoom: 12,
      listScroll: 100,
      listOpen: true,
    });
    renderPage(repository());
    await screen.findByRole('heading', { name: 'Instansi Demo A' });
    const back = screen.getByRole('link', { name: 'Kembali ke Peta' });
    expect(back).toHaveAttribute(
      'href',
      '/simpul-jaringan?demo=1&provinsi=36&kabKota=3673',
    );
    await userEvent.click(back);
    expect(screen.getByText('Peta dipulihkan')).toBeInTheDocument();
  });

  it('profil yang dibuka langsung menurunkan query dari pasangan wilayah profil', async () => {
    renderPage(repository(), '/simpul-jaringan/unit-demo-a?demo=1&jenis=asing');
    await screen.findByRole('heading', { name: 'Instansi Demo A' });
    expect(
      screen.getByRole('link', { name: 'Kembali ke Peta' }),
    ).toHaveAttribute(
      'href',
      '/simpul-jaringan?demo=1&provinsi=36&kabKota=3673',
    );
  });

  it('menampilkan ID tidak ditemukan dan retry membaca repository sama saat gagal', async () => {
    const missing = renderPage(repository(null));
    await screen.findByRole('heading', { name: 'Simpul tidak ditemukan' });
    missing.unmount();
    const repo = repository();
    vi.mocked(repo.getInstansiDetail)
      .mockRejectedValueOnce(new Error('JSON tidak valid'))
      .mockResolvedValue(detail);
    renderPage(repo);
    await screen.findByRole('heading', { name: 'Data belum dapat dimuat' });
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    await screen.findByRole('heading', { name: 'Instansi Demo A' });
    expect(repo.getInstansiDetail).toHaveBeenCalledTimes(2);
    expect(repo.getInstansiDetail).toHaveBeenNthCalledWith(2, 'unit-demo-a');
  });
});

describe('Nilai statistik dan seri bersumber', () => {
  it('membedakan null dengan nol dalam kartu statistik', () => {
    render(<StatisticCards statistik={detail.statistik} />);
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('Belum tersedia')).toBeInTheDocument();
  });

  it('rentang kalender mempertahankan tahun null dan nol pada tabel tren', async () => {
    render(
      <TrendCard
        series={[
          { year: 2022, count: 2 },
          { year: 2024, count: 0 },
          { year: 2026, count: 5 },
        ]}
        referenceDate="2026-10-12"
      />,
    );
    const table = screen.getByRole('table', { hidden: true });
    expect(
      within(table).getByRole('row', {
        name: '2023 Belum tersedia',
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: '2024 0', hidden: true }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText('Rentang tren input arsip'),
      '1',
    );
    expect(
      screen.getByRole('table', { hidden: true }).querySelectorAll('tbody tr'),
    ).toHaveLength(1);
    expect(
      screen.getByText('Tambahan record berdasarkan waktu input · 2026'),
    ).toBeInTheDocument();
  });

  it('tidak membuat grafik kategori contoh, serta memberi catatan distribusi parsial', () => {
    const empty = render(<DistributionCard series={null} totalArsip={null} />);
    expect(screen.getByText('Belum tersedia')).toBeInTheDocument();
    expect(screen.queryByText('Foto')).not.toBeInTheDocument();
    empty.unmount();
    render(
      <DistributionCard
        series={[
          { categoryId: 'kategori-demo', label: 'Kategori Demo', count: 10 },
          {
            categoryId: 'unknown',
            label: 'Kategori tidak diketahui',
            count: null,
          },
        ]}
        totalArsip={30}
      />,
    );
    expect(
      screen.getByText(/Cakupan kategori belum lengkap/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {
        name: 'Kategori tidak diketahui Belum tersedia',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });

  it('Perluas daftar membuka baris pencipta tambahan dan menjelaskan multi pencipta', async () => {
    render(
      <CreatorsCard
        creators={Array.from({ length: 7 }, (_, index) => ({
          id: `creator-${index}`,
          name: `Pencipta Demo ${index + 1}`,
          count: index,
        }))}
        multiCreator
      />,
    );
    expect(screen.queryByText('Pencipta Demo 7')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Perluas daftar' }),
    );
    expect(screen.getByText('Pencipta Demo 7')).toBeInTheDocument();
    expect(
      screen.getByText(/Jumlah antarbaris dapat melebihi total arsip/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ringkas daftar' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('kontribusi menolak denominator snapshot/tanggal/definisi berbeda dan sampel parsial', () => {
    expect(calculateContribution(metric(25), metadata)).toBe(25);
    expect(calculateContribution(metric(0), metadata)).toBe(0);
    expect(calculateContribution(metric(null), metadata)).toBeNull();
    expect(
      calculateContribution(metric(25), { ...metadata, coverage: 'partial' }),
    ).toBeNull();
    expect(
      calculateContribution(metric(25), {
        ...metadata,
        nationalTotal: { ...metadata.nationalTotal!, snapshotId: 'different' },
      }),
    ).toBeNull();
    expect(
      calculateContribution(metric(25), {
        ...metadata,
        nationalTotal: {
          ...metadata.nationalTotal!,
          referenceDate: '2025-10-12',
        },
      }),
    ).toBeNull();
    expect(
      calculateContribution(metric(25, 'definisi berbeda'), metadata),
    ).toBeNull();
  });
});
