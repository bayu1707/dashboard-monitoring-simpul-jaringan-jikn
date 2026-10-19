import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Globe2, MapPin } from 'lucide-react';
import type {
  Coordinates,
  ExplorationState,
  Instansi,
  InstansiDetail,
  InstansiRepository,
  ReferenceData,
  SnapshotMetadata,
  Wilayah,
} from '../types/domain';
import { DataState } from '../components/layout/DataState';
import { MapFilters } from '../components/map/MapFilters';
import { MapView } from '../components/map/MapView';
import { ResultsList } from '../components/map/ResultsList';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRegionGeometry } from '../hooks/useRegionGeometry';
import {
  canPreviewInstansi,
  countInstansi,
  explorationToQuery,
  filterInstansi,
  goNational,
  goProvince,
  parseExplorationQuery,
  selectKabKota,
  selectProvince,
} from '../services/exploration';
import { readMapSession, saveMapSession } from '../services/session';
interface Loaded {
  references: ReferenceData;
  items: Instansi[];
  metadata: SnapshotMetadata;
}
function popupHasInteraction() {
  return Boolean(document.querySelector('.instansi-leaflet-popup:hover, .instansi-popup:hover') ||
    document.activeElement?.closest('.instansi-popup'));
}
export function MapPage({
  repository,
  demo,
}: {
  repository: InstansiRepository;
  demo: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<{
    repository: InstansiRepository;
    attempt: number;
    data: Loaded | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([repository.getReferenceData(), repository.listInstansi()])
      .then(([references, result]) => {
        if (active)
          setResource({
            repository,
            attempt,
            data: {
              references,
              items: result.items,
              metadata: result.metadata,
            },
            error: null,
          });
      })
      .catch((reason: unknown) => {
        if (active)
          setResource({
            repository,
            attempt,
            data: null,
            error:
              reason instanceof Error
                ? reason.message
                : 'Sumber JSON tidak dapat dibaca.',
          });
      });
    return () => {
      active = false;
    };
  }, [repository, attempt]);
  const current =
    resource?.repository === repository && resource.attempt === attempt
      ? resource
      : null;
  if (!current)
    return (
      <main id="konten" tabIndex={-1} className="page-loading">
        <DataState
          title="Memuat peta simpul…"
          description="Membaca referensi wilayah dan snapshot lokal."
        />
      </main>
    );
  if (current.error || !current.data)
    return (
      <main id="konten" tabIndex={-1} className="page-loading">
        <DataState
          title="Data belum dapat dimuat"
          description={current.error ?? 'Sumber JSON tidak valid.'}
          onRetry={() => setAttempt((v) => v + 1)}
        />
      </main>
    );
  return (
    <MapWorkspace
      key={demo ? 'demo' : 'utama'}
      {...current.data}
      repository={repository}
      demo={demo}
    />
  );
}
function MapWorkspace({
  references,
  items: allItems,
  metadata,
  repository,
  demo,
}: Loaded & { repository: InstansiRepository; demo: boolean }) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(
    () => parseExplorationQuery(params, references),
    [params, references],
  );
  const sourceOverride = params.get('data') === 'excel' ? 'excel' : null;
  const queryForState = useCallback((next: ExplorationState) => {
    const value = new URLSearchParams(explorationToQuery(next, demo));
    if (sourceOverride) value.set('data', sourceOverride);
    return value;
  }, [demo, sourceOverride]);
  const listMode = params.get('daftar') === 'instansi' ? 'instansi'
    : params.get('daftar') === 'belum-terpetakan' ? 'belum-terpetakan' : 'wilayah';
  const listSearch = (params.get('cari') ?? '').slice(0, 120);
  const queryParams = queryForState(state);
  if (listMode !== 'wilayah') queryParams.set('daftar', listMode);
  if (listSearch) queryParams.set('cari', listSearch);
  const query = queryParams.size ? `?${queryParams}` : '';
  const { mapReferences, geometryError, retryGeometry } = useRegionGeometry(repository, references, state.provinceId);
  const [initialSession] = useState(() => readMapSession(query, metadata.datasetKind));
  const [listOpen, setListOpen] = useState(initialSession?.listOpen ?? listMode !== 'wilayah');
  const listScroll = useRef(initialSession?.listScroll ?? 0);
  const [restoredScroll, setRestoredScroll] = useState(
    initialSession?.listScroll ?? 0,
  );
  const viewport = useRef<{ center: Coordinates; zoom: number } | null>(
    initialSession
      ? { center: initialSession.center, zoom: initialSession.zoom }
      : null,
  );
  const [resetEpoch, setResetEpoch] = useState(0);
  const [selection, setSelection] = useState<{
    id: string;
    query: string;
    fromList: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    detail: InstansiDetail | null;
    error: string | null;
  } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const restoringFocus = useRef(false);
  const repositioning = useRef(false);
  const touch = useMediaQuery('(max-width: 767px), (hover: none)');
  const navigate = useNavigate();
  const items = useMemo(
    () => filterInstansi(allItems, state),
    [allItems, state],
  );
  const canPreview = canPreviewInstansi(state, references);
  const activeId =
    (canPreview || selection?.fromList) &&
    selection?.query === query &&
    items.some((i) => i.id === selection.id)
      ? selection.id
      : null;
  const detail = preview?.id === activeId ? preview.detail : null;
  const previewError = preview?.id === activeId ? preview.error : null;
  const counts = countInstansi(items);
  const province = references.provinces.find((r) => r.id === state.provinceId);
  const kabKota = references.kabKota.find((r) => r.id === state.kabKotaId);
  useEffect(() => {
    if (
      `?${params.toString()}` !== query &&
      !(query === '' && params.size === 0)
    )
      setParams(new URLSearchParams(query), { replace: true });
  }, [params, query, setParams]);
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    void repository
      .getInstansiDetail(activeId)
      .then((detail) => {
        if (active) setPreview({ id: activeId, detail, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setPreview({
            id: activeId,
            detail: null,
            error:
              error instanceof Error ? error.message : 'Profil gagal dimuat.',
          });
      });
    return () => {
      active = false;
    };
  }, [activeId, repository]);
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const close = useCallback((id?: string) => {
    cancelClose();
    setSelection((current) => !id || current?.id === id ? null : current);
    if (!id) {
      // Focus kembali karena Escape tidak boleh dianggap pemilihan profil baru.
      restoringFocus.current = true;
      try { origin.current?.focus({ preventScroll: true }); }
      finally { restoringFocus.current = false; }
    }
  }, [cancelClose]);
  const scheduleClose = useCallback((id = activeId ?? undefined) => {
    // Event leave dari marker lama tidak boleh menutup pilihan yang baru.
    if (!id || id !== activeId) return;
    // Fokus keyboard tetap menjaga popup meski pointer meninggalkan marker asal.
    // Pointerenter popup dapat mendahului mouseout marker atau moveend autopan.
    if (popupHasInteraction()) return;
    cancelClose();
    if (!touch && !repositioning.current) {
      const owner = selection;
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        if (popupHasInteraction()) return;
        setSelection((current) => current === owner ? null : current);
      }, 200);
    }
  }, [activeId, selection, cancelClose, touch]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeId) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      cancelClose();
    };
  }, [activeId, close, cancelClose]);
  const reposition = useCallback((moving: boolean) => {
    repositioning.current = moving;
    if (moving) cancelClose();
  }, [cancelClose]);
  const persist = useCallback((detailId?: string) => {
    if (viewport.current)
      saveMapSession({
        datasetKind: metadata.datasetKind,
        query,
        ...viewport.current,
        listScroll: listScroll.current,
        listOpen,
        detailId,
      });
  }, [query, listOpen, metadata.datasetKind]);
  const updateViewport = useCallback(
    (center: Coordinates, zoom: number) => {
      viewport.current = { center, zoom };
      persist();
    },
    [persist],
  );
  const previewInstansi = useCallback(
    (id: string, element: HTMLElement | null, fromList = false) => {
      if (restoringFocus.current) return;
      if (element && !fromList && !canPreview) return;
      cancelClose();
      origin.current =
        element ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setSelection((current) =>
        current?.id === id && current.query === query && current.fromList === (fromList || !element)
          ? current : { id, query, fromList: fromList || !element },
      );
    },
    [canPreview, cancelClose, query],
  );
  const openDetail = useCallback(
    (id: string) => {
      cancelClose();
      persist(id);
      navigate(`/simpul-jaringan/${encodeURIComponent(id)}${query}`);
    },
    [cancelClose, persist, navigate, query],
  );
  const apply = useCallback(
    (next: ExplorationState) => {
      cancelClose();
      setSelection(null);
      listScroll.current = 0;
      setRestoredScroll(0);
      setParams(queryForState(next));
    },
    [cancelClose, setParams, queryForState],
  );
  const chooseRegion = useCallback(
    (region: Wilayah) => {
      apply(
        region.level === 'province'
          ? selectProvince(state, region.id, references)
          : selectKabKota(state, region.id, references),
      );
    },
    [apply, state, references],
  );
  function reset() {
    apply(goNational());
    setResetEpoch((n) => n + 1);
    setListOpen(false);
    listScroll.current = 0;
  }
  function toggleList() {
    const next = !listOpen;
    if (next) setRestoredScroll(listScroll.current);
    setListOpen(next);
    if (viewport.current)
      saveMapSession({
        query,
        ...viewport.current,
        listScroll: listScroll.current,
        listOpen: next,
      });
  }
  function scrollList(top: number) {
    listScroll.current = top;
    persist();
  }
  const snapshotTime = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(metadata.capturedAt));
  return (
    <main id="konten" tabIndex={-1} className="map-page">
      <div className={`map-stage ${metadata.datasetKind === 'pilot' ? 'pilot-map' : ''}`} data-level={state.level}>
        <MapView
          state={state}
          references={mapReferences}
          items={items}
          allItems={allItems}
          onRegion={chooseRegion}
          onPreview={previewInstansi}
          onNavigate={openDetail}
          onEnter={cancelClose}
          onReposition={reposition}
          onLeave={scheduleClose}
          onClose={close}
          onDetail={() => persist(activeId ?? undefined)}
          detail={detail}
          previewFromList={selection?.fromList ?? false}
          demo={demo}
          pilot={metadata.datasetKind === 'pilot'}
          search={query}
          touch={touch}
          initialSession={initialSession}
          onViewport={updateViewport}
          resetEpoch={resetEpoch}
        />
        <MapFilters
          state={state}
          references={references}
          onChange={apply}
          onReset={reset}
          onList={toggleList}
          listOpen={listOpen}
        />
        <div
          className={`map-navigation ${state.level === 'nasional' ? 'is-national' : ''}`}
        >
          <span className="sr-only">
            {state.level === 'nasional'
              ? 'Peta nasional'
              : state.level === 'provinsi'
                ? 'Lapisan Kabupaten / Kota'
                : 'Lapisan Instansi'}
          </span>
          <div className="map-scope-header">
            <MapPin size={17} aria-hidden="true" />
            <h1>
              {kabKota?.name ?? (province ? metadata.datasetKind === 'pilot' ? province.name : `Kabupaten / Kota di ${province.name}` : metadata.datasetKind === 'pilot' ? 'Simpul Jaringan Jawa' : 'Simpul Jaringan Indonesia')}
            </h1>
            <div className="map-level-actions">
              {state.level === 'instansi' && (
                <button
                  className="back-level"
                  aria-label="Kembali ke Provinsi"
                  title="Kembali ke Provinsi"
                  onClick={() => apply(goProvince(state))}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  <span className="sr-only">Kembali ke Provinsi</span>
                </button>
              )}
              {state.level !== 'nasional' && (
                <button
                  className="back-level"
                  aria-label="Kembali ke Nasional"
                  title="Kembali ke Nasional"
                  onClick={() => apply(goNational())}
                >
                  <Globe2 size={18} aria-hidden="true" />
                  <span className="sr-only">Kembali ke Nasional</span>
                </button>
              )}
            </div>
          </div>
          <p className={metadata.datasetKind === 'pilot' && state.level !== 'instansi' ? 'sr-only' : undefined}>
            {state.level === 'nasional'
              ? metadata.datasetKind === 'pilot' ? 'Klik provinsi untuk mulai.' : `Klik provinsi atau buka Daftar${allItems.length ? ` · ${counts.total} instansi dalam snapshot` : ''}.`
              : state.level === 'provinsi'
                ? 'Klik kabupaten/kota untuk membuka titik instansi.'
                : `${counts.total} hasil · ${counts.mapped} terpetakan · ${counts.unmapped} tanpa koordinat${demo ? ' (demo)' : ''}`}
            {state.level === 'provinsi' && allItems.length > 0 && metadata.datasetKind !== 'pilot' && ` ${counts.total} instansi dalam cakupan snapshot; buka Daftar.`}
          </p>
        </div>
        {listOpen && (
          <ResultsList
            state={state}
            references={references}
            items={items}
            onRegion={chooseRegion}
            onPreview={(id, element) => previewInstansi(id, element ?? null, true)}
            onClose={toggleList}
            onDetail={persist}
            mode={listMode}
            searchText={listSearch}
            onCatalogChange={(mode, text) => {
              cancelClose();
              setSelection(null);
              const next = queryForState(state);
              if (mode !== 'wilayah') next.set('daftar', mode);
              if (text) next.set('cari', text.slice(0, 120));
              listScroll.current = 0;
              setRestoredScroll(0);
              setParams(next, { replace: true });
            }}
            search={query}
            initialScroll={restoredScroll}
            onScroll={scrollList}
            demo={demo}
          />
        )}
        {allItems.length === 0 && (
          <div className="map-empty-notice" role="status">
            <h2>Data simpul belum dimuat</h2>
            <p>
              Snapshot instansi belum tersedia. Referensi wilayah dapat
              dijelajahi melalui peta dan Daftar.
            </p>
            <Link to="/simpul-jaringan?demo=1">
              Coba interaksi dengan DATA DEMO →
            </Link>
          </div>
        )}
        {state.level === 'instansi' &&
          allItems.length > 0 &&
          items.length === 0 && (
            <div className="map-empty-notice" role="status">
              <h2>Hasil filter kosong</h2>
              <p>
                Belum ada instansi dalam cakupan yang dipilih. Ganti wilayah
                atau gunakan Semua Jenis.
              </p>
            </div>
          )}
        {state.level === 'instansi' && counts.total > 0 && counts.mapped === 0 && !listOpen && (
          <div className="map-empty-notice" role="status">
            <h2>Titik instansi belum tersedia</h2>
            <p>Data instansi sudah dimuat, tetapi koordinat kantornya belum tersedia. Marker dan popup hover akan tampil setelah koordinat terverifikasi ditambahkan.</p>
            <button className="text-button" onClick={toggleList}>Buka daftar instansi</button>
          </div>
        )}
        {previewError && (
          <div className="map-empty-notice">
            <DataState
              title="Profil gagal dimuat"
              description={previewError}
              onRetry={() => {
                setPreview(null);
                void repository
                  .getInstansiDetail(activeId ?? '')
                  .then((detail) =>
                    setPreview({ id: activeId ?? '', detail, error: null }),
                  )
                  .catch((e: unknown) =>
                    setPreview({
                      id: activeId ?? '',
                      detail: null,
                      error:
                        e instanceof Error ? e.message : 'Profil gagal dimuat.',
                    }),
                  );
              }}
              compact
            />
          </div>
        )}
        {geometryError && (
          <div className="tile-error" role="status">
            Batas kabupaten/kota belum dapat dimuat. Gunakan Daftar atau dropdown.
            <button onClick={retryGeometry}>Coba muat batas lagi</button>
          </div>
        )}
        {allItems.length > 0 && metadata.datasetKind !== 'pilot' && <div className="region-summary-legend">
          <span>Angka menunjukkan jumlah instansi per wilayah.</span>
          {state.level === 'nasional' && allItems.some((item) => item.provinceId === null) && <button
            className="text-button"
            onClick={() => {
              cancelClose();
              setSelection(null);
              setListOpen(true);
              setRestoredScroll(0);
              listScroll.current = 0;
              const next = queryForState(goNational());
              next.set('daftar', 'belum-terpetakan');
              setParams(next);
            }}>
            {countInstansi(allItems.filter((item) => item.provinceId === null)).total} belum terpetakan
          </button>}
        </div>}
        <div className="map-footer">
          <span
            className="snapshot-note"
            title={`${metadata.coverageDescription ?? `Cakupan snapshot ${metadata.coverage}`}; bukan pemantauan real time.`}
          >
            {metadata.datasetKind === 'pilot' ? <>{allItems.length} instansi percontohan · DATA SIMULASI<span className="sr-only"> · Nama/tahun: Excel · Lokasi: sumber publik per record · Angka lingkaran: jumlah instansi per wilayah.</span></> : <>{metadata.datasetKind === 'excel' ? 'Snapshot Excel · ' : 'Snapshot '}{snapshotTime} WIB{demo ? ' · sintetis' : ' · bukan real time'}</>}
          </span>
          <span
            className="map-source-note"
            title={references.metadata.verificationNotes.join(' ')}
          >
            {references.provinces.length} provinsi · {references.kabKota.length} kab/kota{metadata.datasetKind === 'pilot' ? ` · ${allItems.length} instansi percontohan` : ' · referensi wilayah'}
          </span>
          {demo && (
            <Link className="demo-exit" to="/simpul-jaringan">
              Keluar demo
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
