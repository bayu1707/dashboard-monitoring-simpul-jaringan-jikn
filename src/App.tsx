import { lazy, Suspense, useMemo } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { SiteHeader } from './components/layout/SiteHeader';
import { DataState } from './components/layout/DataState';
const MapPage = lazy(() =>
  import('./pages/MapPage').then((module) => ({ default: module.MapPage })),
);
const InstansiDetailPage = lazy(() =>
  import('./pages/InstansiDetailPage').then((module) => ({
    default: module.InstansiDetailPage,
  })),
);
import { createLocalRepository } from './services/localRepository';
export function App() {
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const repository = useMemo(() => createLocalRepository(demo), [demo]);
  return (
    <>
      <SiteHeader demo={demo} />
      <Suspense
        fallback={
          <main id="konten" className="page-loading">
            <DataState title="Memuat halaman…" />
          </main>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to={`/simpul-jaringan${demo ? '?demo=1' : ''}`}
                replace
              />
            }
          />
          <Route
            path="/simpul-jaringan"
            element={<MapPage repository={repository} demo={demo} />}
          />
          <Route
            path="/simpul-jaringan/:id"
            element={<InstansiDetailPage repository={repository} demo={demo} />}
          />
          <Route
            path="*"
            element={
              <main id="konten" className="page-loading">
                <h1>Halaman tidak ditemukan</h1>
                <a
                  className="button"
                  href={`/simpul-jaringan${demo ? '?demo=1' : ''}`}
                >
                  Kembali ke Peta
                </a>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
