import type { ComponentProps } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import type { MapView as MapViewComponent } from '../src/components/map/MapView';
import type { InstansiRepository } from '../src/types/domain';
import { MapPage } from '../src/pages/MapPage';
import { filterInstansi } from '../src/services/exploration';
import { getReturnMapUrl, readMapSession } from '../src/services/session';
import { makeFixture } from './fixtures/data';

/** Hanya Leaflet yang dimock. State halaman, query, filter, popup dan repository domain tetap nyata. */
vi.mock('../src/components/map/MapView', async () => {
  const { InstansiPopup } = await import('../src/components/map/InstansiPopup');
  return {
    MapView: (props: ComponentProps<typeof MapViewComponent>) => {
      const regions =
        props.state.level === 'nasional'
          ? props.references.provinces
          : props.references.kabKota.filter(
              (region) => region.provinceId === props.state.provinceId,
            );
      return (
        <section aria-label="Peta uji interaksi">
          <output data-testid="map-level">{props.state.level}</output>
          <output data-testid="map-viewport">
            {props.initialSession
              ? `${props.initialSession.center.join(',')};${props.initialSession.zoom}`
              : 'nasional'}
          </output>
          <button onClick={() => props.onViewport([-6.123, 106.151], 13)}>
            Geser peta uji
          </button>
          {props.state.level !== 'instansi'
            ? regions.map((region) => (
                <button key={region.id} onClick={() => props.onRegion(region)}>
                  Peta {region.name}
                </button>
              ))
            : props.items
                .filter((item) => item.coordinates !== null)
                .map((item) => (
                  <button
                    key={item.id}
                    onPointerEnter={(event) => {
                      props.onEnter();
                      props.onPreview(item.id, event.currentTarget);
                    }}
                    onPointerLeave={() => props.onLeave(item.id)}
                    onClick={(event) => {
                      if (props.touch)
                        props.onPreview(item.id, event.currentTarget);
                      else props.onNavigate(item.id);
                    }}
                  >
                    Marker {item.name}
                  </button>
                ))}
          <button
            onClick={(event) => props.onPreview('demo-a', event.currentTarget)}
          >
            Uji pembatasan pratinjau
          </button>
          {props.detail && (
            <InstansiPopup
              detail={props.detail}
              demo={props.demo}
              onClose={props.onClose}
              onDetail={props.onDetail}
              onEnter={props.onEnter}
              onLeave={props.onLeave}
              search={props.search}
            />
          )}
        </section>
      );
    },
  };
});

function createFixtureRepository(): InstansiRepository {
  const { references, snapshot } = makeFixture();
  return {
    getReferenceData: vi.fn(async () => references),
    listInstansi: vi.fn(async (filters = {}) => ({
      items: filterInstansi(snapshot.instansi, filters),
      metadata: snapshot.metadata,
    })),
    getInstansiDetail: vi.fn(async (id) => {
      const instansi = snapshot.instansi.find((item) => item.id === id);
      const record = snapshot.statistics.find((item) => item.instansiId === id);
      return instansi && record
        ? { ...record, instansi, metadata: snapshot.metadata }
        : null;
    }),
  };
}
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function DetailProbe() {
  const { id } = useParams();
  const { search } = useLocation();
  const instansi = makeFixture().snapshot.instansi.find(
    (item) => item.id === id,
  );
  return (
    <section>
      <h1>Detail navigasi {id}</h1>
      <Link to={getReturnMapUrl(search, instansi)}>Kembali ke Peta</Link>
    </section>
  );
}
function setup(
  initialEntry = '/simpul-jaringan?demo=1',
  repository = createFixtureRepository(),
) {
  const user = userEvent.setup();
  const rendered = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/simpul-jaringan"
          element={<MapPage repository={repository} demo />}
        />
        <Route path="/simpul-jaringan/:id" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  const desktop = () =>
    within(rendered.container.querySelector<HTMLElement>('.desktop-filters')!);
  return { ...rendered, user, repository, desktop };
}
async function enterInstansi(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Peta Banten' }));
  await user.click(screen.getByRole('button', { name: 'Peta Kota Serang' }));
  expect(screen.getByTestId('map-level')).toHaveTextContent('instansi');
}

let touchMode = false;
const showModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const closeDialog = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});
afterAll(() => {
  if (showModal)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (closeDialog)
    Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDialog);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
beforeEach(() => {
  touchMode = false;
  sessionStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: touchMode,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Integrasi peta, filter, popup dan URL', () => {
  it('klik provinsi benar-benar mengganti lapisan dan klik kabupaten langsung menampilkan instansi tanpa memilih jenis', async () => {
    const { user, desktop } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Peta Banten' }),
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('provinsi');
    expect(
      screen.queryByRole('button', { name: 'Marker Instansi Demo A' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Peta Kota Serang' }),
    ).toBeInTheDocument();
    expect(desktop().getByLabelText('Provinsi')).toHaveValue('36');
    expect(desktop().getByLabelText('Kabupaten / Kota')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Peta Kota Serang' }));
    expect(screen.getByTestId('map-level')).toHaveTextContent('instansi');
    expect(desktop().getByLabelText('Kabupaten / Kota')).toHaveValue('36.73');
    expect(desktop().getByLabelText('Jenis Instansi')).toHaveValue('');
    expect(desktop().getByLabelText('Jenis Instansi')).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
    );
  });
  it('dropdown memilih lapisan yang sama dengan klik peta dan sinkron kembali dari query', async () => {
    const { user, desktop } = setup();
    await screen.findByTestId('map-level');
    expect(desktop().getByLabelText('Kabupaten / Kota')).toBeDisabled();
    await user.selectOptions(desktop().getByLabelText('Provinsi'), '36');
    expect(screen.getByTestId('map-level')).toHaveTextContent('provinsi');
    await user.selectOptions(
      desktop().getByLabelText('Kabupaten / Kota'),
      '36.73',
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('instansi');
    expect(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    ).toBeInTheDocument();
  });
  it('hover instansi dengan Semua Jenis membuka popup, hover/preview wilayah tidak membuka profil', async () => {
    const { user, desktop } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Uji pembatasan pratinjau' }),
    );
    expect(
      screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }),
    ).not.toBeInTheDocument();
    await enterInstansi(user);
    expect(desktop().getByLabelText('Jenis Instansi')).toHaveValue('');
    await user.hover(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    );
    const popup = await screen.findByRole('region', {
      name: 'Pratinjau Instansi Demo A',
    });
    expect(within(popup).getByText('120')).toBeInTheDocument();
    expect(within(popup).getByText('2020')).toBeInTheDocument();
    expect(
      within(popup).getByRole('link', { name: 'Lihat detail' }),
    ).toBeInTheDocument();
    expect(within(popup).getByText('DATA DEMO')).toBeInTheDocument();
  });
  it('pindah cakupan atau kembali satu tingkat menutup popup dan jenis direset', async () => {
    const { user, desktop } = setup();
    await enterInstansi(user);
    await user.hover(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    );
    await screen.findByRole('region', { name: 'Pratinjau Instansi Demo A' });
    await user.selectOptions(
      desktop().getByLabelText('Jenis Instansi'),
      'demo-pemerintah',
    );
    expect(
      screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marker Instansi Demo B' }),
    ).not.toBeInTheDocument();
    await user.hover(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    );
    await screen.findByRole('region', { name: 'Pratinjau Instansi Demo A' });
    await user.click(
      screen.getByRole('button', { name: 'Kembali ke Provinsi' }),
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('provinsi');
    expect(
      screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }),
    ).not.toBeInTheDocument();
    expect(desktop().getByLabelText('Kabupaten / Kota')).toHaveValue('');
    expect(desktop().getByLabelText('Jenis Instansi')).toHaveValue('');
    await user.click(
      screen.getByRole('button', { name: 'Kembali ke Nasional' }),
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('nasional');
  });
  it('jeda tutup 200ms memungkinkan pointer berpindah ke tombol popup dan Escape mengembalikan fokus', async () => {
    const { user } = setup('/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1');
    const marker = await screen.findByRole('button', {
      name: 'Marker Instansi Demo A',
    });
    await user.hover(marker);
    const popup = await screen.findByRole('region', {
      name: 'Pratinjau Instansi Demo A',
    });
    vi.useFakeTimers();
    fireEvent.pointerLeave(marker);
    fireEvent.pointerEnter(popup);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(popup).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }),
    ).not.toBeInTheDocument();
    expect(marker).toHaveFocus();
  });
  it('menampilkan count semua hasil termasuk titik null; daftar menyediakan tautan detail keyboard', async () => {
    const { user } = setup();
    await enterInstansi(user);
    expect(
      screen.getByText('7 hasil · 6 terpetakan · 1 tanpa koordinat (demo)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marker Instansi Demo C' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Daftar' }));
    const list = screen.getByRole('complementary', { name: 'Daftar instansi' });
    expect(
      within(list).getByText(
        '7 hasil · 6 terpetakan · 1 belum memiliki koordinat (demo).',
      ),
    ).toBeInTheDocument();
    const link = within(list).getByRole('link', { name: 'Instansi Demo C' });
    expect(link).toHaveAttribute(
      'href',
      '/simpul-jaringan/demo-c?provinsi=36&kabKota=36.73&demo=1',
    );
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { name: 'Detail navigasi demo-c' }),
    ).toBeInTheDocument();
  });
  it('navigasi detail dan kembali memulihkan filter opsional, viewport dan posisi daftar', async () => {
    const { user, container } = setup();
    await enterInstansi(user);
    await user.click(screen.getByRole('button', { name: 'Geser peta uji' }));
    await user.click(screen.getByRole('button', { name: 'Daftar' }));
    const scrolling = container.querySelector<HTMLElement>('.results-scroll')!;
    scrolling.scrollTop = 123;
    fireEvent.scroll(scrolling);
    await user.click(screen.getByRole('link', { name: 'Instansi Demo A' }));
    await screen.findByRole('heading', { name: 'Detail navigasi demo-a' });
    expect(readMapSession()).toMatchObject({
      query: '?provinsi=36&kabKota=36.73&demo=1',
      center: [-6.123, 106.151],
      zoom: 13,
      listScroll: 123,
      listOpen: true,
    });
    await user.click(screen.getByRole('link', { name: 'Kembali ke Peta' }));
    await screen.findByRole('complementary', { name: 'Daftar instansi' });
    expect(screen.getByTestId('map-level')).toHaveTextContent('instansi');
    expect(screen.getByTestId('map-viewport')).toHaveTextContent(
      '-6.123,106.151;13',
    );
    expect(
      container.querySelector<HTMLElement>('.results-scroll')?.scrollTop,
    ).toBe(123);
  });
  it('reset menutup popup dan daftar serta kembali ke nasional', async () => {
    const { user, desktop } = setup(
      '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
    );
    await user.click(await screen.findByRole('button', { name: 'Daftar' }));
    await user.hover(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    );
    await screen.findByRole('region', { name: 'Pratinjau Instansi Demo A' });
    await user.click(
      screen.getByRole('button', { name: 'Reset seluruh filter' }),
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('nasional');
    expect(
      screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(desktop().getByLabelText('Kabupaten / Kota')).toBeDisabled();
  });
  it('query relasi tidak sah dinormalisasi dan data kosong tetap dapat dijelajahi', async () => {
    const repository = createFixtureRepository();
    const metadata = makeFixture().snapshot.metadata;
    repository.listInstansi = vi.fn(async () => ({
      items: [],
      metadata: {
        ...metadata,
        datasetKind: 'empty' as const,
        coverage: 'partial' as const,
      },
    }));
    const { user } = setup(
      '/simpul-jaringan?provinsi=36&kabKota=31.71&jenis=invalid&demo=1',
      repository,
    );
    expect(
      await screen.findByRole('heading', { name: 'Data simpul belum dimuat' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/simpul-jaringan?provinsi=36&demo=1',
      ),
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('provinsi');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));
    expect(
      screen.getByRole('complementary', { name: 'Kabupaten / Kota' }),
    ).toBeInTheDocument();
  });
});

describe('Regresi lifecycle popup instansi', () => {
  it('mouseleave marker lama tidak menutup marker terbaru; hanya leave ID aktif menutup tepat setelah jeda 200ms', async () => {
    setup('/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1');
    const markerA = await screen.findByRole('button', {
      name: 'Marker Instansi Demo A',
    });
    const markerB = screen.getByRole('button', { name: 'Marker Instansi Demo B' });
    fireEvent.pointerEnter(markerA);
    await screen.findByRole('region', { name: 'Pratinjau Instansi Demo A' });
    fireEvent.pointerEnter(markerB);
    const popupB = await screen.findByRole('region', {
      name: 'Pratinjau Instansi Demo B',
    });

    vi.useFakeTimers();
    // Urutan ini dapat terjadi ketika perpindahan marker/spiderfy mengirim leave lama.
    fireEvent.pointerLeave(markerA);
    act(() => vi.advanceTimersByTime(250));
    expect(popupB).toBeInTheDocument();
    expect(within(popupB).getByRole('link', { name: 'Lihat detail' }))
      .toHaveAttribute('href', '/simpul-jaringan/demo-b?provinsi=36&kabKota=36.73&demo=1');

    fireEvent.pointerLeave(markerB);
    act(() => vi.advanceTimersByTime(199));
    expect(popupB).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(popupB).not.toBeInTheDocument();
  });

  it('timer close A yang sudah terjadwal dibatalkan ketika pointer masuk marker B', async () => {
    setup('/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1');
    const markerA = await screen.findByRole('button', {
      name: 'Marker Instansi Demo A',
    });
    const markerB = screen.getByRole('button', { name: 'Marker Instansi Demo B' });
    fireEvent.pointerEnter(markerA);
    await screen.findByRole('region', { name: 'Pratinjau Instansi Demo A' });
    vi.useFakeTimers();
    fireEvent.pointerLeave(markerA);
    act(() => vi.advanceTimersByTime(150));
    fireEvent.pointerEnter(markerB);
    await act(async () => {
      await Promise.resolve();
    });
    const popupB = screen.getByRole('region', { name: 'Pratinjau Instansi Demo B' });
    act(() => vi.advanceTimersByTime(300));
    expect(popupB).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }))
      .not.toBeInTheDocument();
  });

  it('respons profil A yang terlambat tidak mengganti popup B yang dipilih terakhir', async () => {
    const repository = createFixtureRepository();
    const readDetail = repository.getInstansiDetail;
    type DetailResult = Awaited<ReturnType<InstansiRepository['getInstansiDetail']>>;
    let finishA: (detail: DetailResult) => void = () => {};
    const pendingA = new Promise<DetailResult>((resolve) => { finishA = resolve; });
    repository.getInstansiDetail = vi.fn((id) =>
      id === 'demo-a' ? pendingA : readDetail(id),
    );
    setup('/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1', repository);
    const markerA = await screen.findByRole('button', {
      name: 'Marker Instansi Demo A',
    });
    const markerB = screen.getByRole('button', { name: 'Marker Instansi Demo B' });
    fireEvent.pointerEnter(markerA);
    expect(repository.getInstansiDetail).toHaveBeenCalledWith('demo-a');
    fireEvent.pointerEnter(markerB);
    const popupB = await screen.findByRole('region', {
      name: 'Pratinjau Instansi Demo B',
    });
    await act(async () => { finishA(await readDetail('demo-a')); });
    expect(popupB).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pratinjau Instansi Demo A' }))
      .not.toBeInTheDocument();
  });
});

describe('Filter draft mobile dan tap', () => {
  it('Batal membuang draft, Terapkan provinsi saja boleh, Reset berlaku segera dan menutup sheet', async () => {
    touchMode = true;
    const { user, desktop } = setup();
    await screen.findByTestId('map-level');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    let sheet = screen.getByRole('dialog', { name: 'Filter wilayah' });
    await user.selectOptions(within(sheet).getByLabelText('Provinsi'), '36');
    await user.selectOptions(
      within(sheet).getByLabelText('Kabupaten / Kota'),
      '36.73',
    );
    await user.selectOptions(
      within(sheet).getByLabelText('Jenis Instansi'),
      'demo-pemerintah',
    );
    expect(screen.getByTestId('map-level')).toHaveTextContent('nasional');
    await user.click(within(sheet).getByRole('button', { name: 'Batal' }));
    expect(
      screen.queryByRole('dialog', { name: 'Filter wilayah' }),
    ).not.toBeInTheDocument();
    expect(desktop().getByLabelText('Provinsi')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    sheet = screen.getByRole('dialog', { name: 'Filter wilayah' });
    expect(within(sheet).getByLabelText('Provinsi')).toHaveValue('');
    await user.selectOptions(within(sheet).getByLabelText('Provinsi'), '36');
    await user.click(within(sheet).getByRole('button', { name: 'Terapkan' }));
    expect(screen.getByTestId('map-level')).toHaveTextContent('provinsi');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    sheet = screen.getByRole('dialog', { name: 'Filter wilayah' });
    await user.selectOptions(
      within(sheet).getByLabelText('Kabupaten / Kota'),
      '36.73',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Reset' }));
    expect(
      screen.queryByRole('dialog', { name: 'Filter wilayah' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('map-level')).toHaveTextContent('nasional');
  });
  it('draft mengganti provinsi atau kabupaten mengosongkan turunannya; Terapkan kabupaten tanpa jenis langsung masuk instansi', async () => {
    touchMode = true;
    const { user } = setup(
      '/simpul-jaringan?provinsi=36&kabKota=36.73&jenis=demo-pemerintah&demo=1',
    );
    await screen.findByTestId('map-level');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const sheet = screen.getByRole('dialog', { name: 'Filter wilayah' });
    await user.selectOptions(
      within(sheet).getByLabelText('Kabupaten / Kota'),
      '36.74',
    );
    expect(within(sheet).getByLabelText('Jenis Instansi')).toHaveValue('');
    await user.selectOptions(within(sheet).getByLabelText('Provinsi'), '31');
    expect(within(sheet).getByLabelText('Kabupaten / Kota')).toHaveValue('');
    expect(within(sheet).getByLabelText('Jenis Instansi')).toHaveValue('');
    await user.selectOptions(within(sheet).getByLabelText('Provinsi'), '36');
    await user.selectOptions(
      within(sheet).getByLabelText('Kabupaten / Kota'),
      '36.73',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Terapkan' }));
    expect(screen.getByTestId('map-level')).toHaveTextContent('instansi');
    expect(
      screen.getByRole('button', { name: 'Marker Instansi Demo B' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
    );
  });
  it('tap pertama marker membuka popup lalu Lihat detail bernavigasi', async () => {
    touchMode = true;
    const { user } = setup();
    await enterInstansi(user);
    await user.click(
      screen.getByRole('button', { name: 'Marker Instansi Demo A' }),
    );
    const popup = await screen.findByRole('region', {
      name: 'Pratinjau Instansi Demo A',
    });
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
    );
    await user.click(within(popup).getByRole('link', { name: 'Lihat detail' }));
    expect(
      await screen.findByRole('heading', { name: 'Detail navigasi demo-a' }),
    ).toBeInTheDocument();
  });
});
