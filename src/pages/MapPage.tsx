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
  const query = explorationToQuery(state, demo);
  const [initialSession] = useState(() => readMapSession(query));
  const [listOpen, setListOpen] = useState(initialSession?.listOpen ?? false);
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
  const repositioning = useRef(false);
  const touch = useMediaQuery('(max-width: 767px), (hover: none)');
  const navigate = useNavigate();
  const items = useMemo(
    () => filterInstansi(allItems, state),
    [allItems, state],
  );
  const canPreview = canPreviewInstansi(state, references);
  const activeId =
    canPreview &&
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
    if (!id) origin.current?.focus({ preventScroll: true });
  }, [cancelClose]);
  const scheduleClose = useCallback((id = activeId ?? undefined) => {
    // Event leave dari marker lama tidak boleh menutup pilihan yang baru.
    if (!id || id !== activeId) return;
    // Fokus keyboard tetap menjaga popup meski pointer meninggalkan marker asal.
    if (document.activeElement?.closest('.instansi-popup')) return;
    cancelClose();
    if (!touch && !repositioning.current) {
      const owner = selection;
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
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
  const persist = useCallback(() => {
    if (viewport.current)
      saveMapSession({
        query,
        ...viewport.current,
        listScroll: listScroll.current,
        listOpen,
      });
  }, [query, listOpen]);
  const updateViewport = useCallback(
    (center: Coordinates, zoom: number) => {
      viewport.current = { center, zoom };
      persist();
    },
    [persist],
  );
  const previewInstansi = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (!canPreview) return;
      cancelClose();
      origin.current =
        element ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setSelection((current) =>
        current?.id === id && current.query === query && current.fromList === !element
          ? current : { id, query, fromList: !element },
      );
    },
    [canPreview, cancelClose, query],
  );
  const openDetail = useCallback(
    (id: string) => {
      cancelClose();
      persist();
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
      setParams(new URLSearchParams(explorationToQuery(next, demo)));
    },
    [cancelClose, setParams, demo],
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
      <div className="map-stage" data-level={state.level}>
        <MapView
          state={state}
          references={references}
          items={items}
          allItems={allItems}
          onRegion={chooseRegion}
          onPreview={previewInstansi}
          onNavigate={openDetail}
          onEnter={cancelClose}
          onReposition={reposition}
          onLeave={scheduleClose}
          onClose={close}
          onDetail={persist}
          detail={detail}
          previewFromList={selection?.fromList ?? false}
          demo={demo}
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
              {kabKota?.name ?? province?.name ?? 'Simpul Jaringan Indonesia'}
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
          <p>
            {state.level === 'nasional'
              ? 'Klik wilayah atau pilih provinsi untuk mulai.'
              : state.level === 'provinsi'
                ? 'Pilih kabupaten/kota untuk melihat instansi.'
                : `${counts.total} hasil · ${counts.mapped} terpetakan · ${counts.unmapped} tanpa koordinat${demo ? ' (demo)' : ''}`}
          </p>
        </div>
        {listOpen && (
          <ResultsList
            state={state}
            references={references}
            items={state.level === 'instansi' ? items : allItems}
            onRegion={chooseRegion}
            onPreview={(id) => previewInstansi(id, null)}
            onClose={toggleList}
            onDetail={persist}
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
              Snapshot instansi terverifikasi belum tersedia. Referensi batas
              Banten dapat dijelajahi; provinsi lain tersedia melalui Daftar.
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
        <div className="map-footer">
          <span
            className="snapshot-note"
            title={`Cakupan snapshot ${metadata.coverage === 'full' ? 'penuh menurut sumber' : 'parsial'}; bukan pemantauan real time.`}
          >
            Snapshot {snapshotTime} WIB{demo ? ' · sintetis' : ' · parsial'}
          </span>
          <span
            className="map-source-note"
            title="Geometri yang tersedia mencakup Banten; geometri nasional belum lengkap."
          >
            Batas: BIG · peta parsial
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
