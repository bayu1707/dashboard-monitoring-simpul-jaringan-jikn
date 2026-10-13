import type {
  ExplorationState,
  Instansi,
  ReferenceData,
  Wilayah,
} from '../../types/domain';
import { ChevronRight, MapPin, X, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRef, useLayoutEffect } from 'react';
import { countInstansi } from '../../services/exploration';
export function ResultsList({
  state,
  references,
  items,
  onRegion,
  onPreview,
  onClose,
  onDetail,
  search,
  initialScroll,
  onScroll,
  demo,
}: {
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  onRegion: (region: Wilayah) => void;
  onPreview: (id: string) => void;
  onClose: () => void;
  onDetail: () => void;
  search: string;
  initialScroll: number;
  onScroll: (top: number) => void;
  demo: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (content.current) content.current.scrollTop = initialScroll;
  }, [initialScroll]);
  const regions =
    state.level === 'nasional'
      ? references.provinces
      : references.kabKota.filter((w) => w.provinceId === state.provinceId);
  const counts = countInstansi(items);
  return (
    <aside className="results-panel" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <span className="eyebrow">JELAJAHI WILAYAH</span>
          <h2 id="results-title">
            {state.level === 'instansi'
              ? 'Daftar instansi'
              : state.level === 'provinsi'
                ? 'Kabupaten / Kota'
                : 'Daftar provinsi'}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Tutup daftar"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div
        className="results-scroll"
        ref={content}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      >
        {state.level === 'instansi' ? (
          <>
            <p className="results-description">
              {counts.total} hasil · {counts.mapped} terpetakan ·{' '}
              {counts.unmapped} belum memiliki koordinat{demo ? ' (demo)' : ''}.
            </p>
            {items.length === 0 ? (
              <p className="empty-list">
                Tidak ada instansi dalam cakupan ini.
              </p>
            ) : (
              items.map((item) => (
                <article className="result-item" key={item.id}>
                  <span className="result-icon">
                    <Building2 size={19} />
                  </span>
                  <div>
                    <Link
                      onClick={onDetail}
                      to={`/simpul-jaringan/${encodeURIComponent(item.id)}${search}`}
                    >
                      {item.name}
                    </Link>
                    <p>
                      {item.coordinates
                        ? 'Koordinat tersedia'
                        : 'Belum memiliki koordinat'}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => onPreview(item.id)}
                    >
                      Pratinjau profil
                    </button>
                  </div>
                </article>
              ))
            )}
          </>
        ) : (
          <>
            <p className="results-description">
              Pilih wilayah untuk membuka lapisan berikutnya. Jumlah merupakan
              ID instansi unik dalam snapshot{demo ? ' demo' : ''} ini.
            </p>
            {regions.map((region) => {
              const n = countInstansi(
                items.filter((item) =>
                  region.level === 'province'
                    ? item.provinceId === region.id
                    : item.kabKotaId === region.id,
                ),
              ).total;
              return (
                <button
                  className="region-row"
                  key={region.id}
                  onClick={() => onRegion(region)}
                >
                  <MapPin size={17} />
                  <span>{region.name}</span>
                  <span className="region-count">{n}</span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
            {regions.length === 0 && (
              <p className="empty-list">
                Referensi kabupaten/kota wilayah ini belum dimuat. Pilih
                provinsi lain atau kembali ke nasional.
              </p>
            )}
          </>
        )}
      </div>
      <div className="results-footnote">
        Daftar dapat diakses dengan Tab dan Enter.
      </div>
    </aside>
  );
}
