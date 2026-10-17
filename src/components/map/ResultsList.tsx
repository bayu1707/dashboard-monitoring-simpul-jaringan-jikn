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
  mode = 'wilayah',
  searchText = '',
  onCatalogChange,
}: {
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  onRegion: (region: Wilayah) => void;
  onPreview: (id: string, origin?: HTMLElement) => void;
  onClose: () => void;
  onDetail: (id?: string) => void;
  search: string;
  initialScroll: number;
  onScroll: (top: number) => void;
  demo: boolean;
  mode?: 'wilayah' | 'instansi' | 'belum-terpetakan';
  searchText?: string;
  onCatalogChange?: (mode: 'wilayah' | 'instansi' | 'belum-terpetakan', text: string) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (content.current) content.current.scrollTop = initialScroll;
  }, [initialScroll]);
  const regions =
    state.level === 'nasional'
      ? references.provinces
      : references.kabKota.filter((w) => w.provinceId === state.provinceId);
  const catalog = state.level === 'instansi' || mode !== 'wilayah';
  const catalogItems = items.filter((item) =>
    (mode !== 'belum-terpetakan' || item.provinceId === null) &&
    (!searchText || `${item.name} ${item.kode ?? ''}`.toLocaleLowerCase('id').includes(searchText.toLocaleLowerCase('id'))));
  const provinceOnly = state.level === 'provinsi' ? items.filter((item) => item.kabKotaId === null) : [];
  const counts = countInstansi(catalogItems);
  const institutionRow = (item: Instansi) => (
    <article className="result-item" key={item.id} data-result-instansi-id={item.id}>
      <span className="result-icon"><Building2 size={19} /></span>
      <div>
        <Link onClick={() => onDetail(item.id)} to={`/simpul-jaringan/${encodeURIComponent(item.id)}${search}`}>
          {item.name}
        </Link>
        <p>{item.coordinates ? 'Koordinat tersedia' : 'Belum memiliki koordinat'}</p>
        {item.locationVerificationStatus === 'needs-review' && <p>Lokasi perlu ditinjau</p>}
        <p>{item.kabKotaName ?? item.provinceName ?? 'Wilayah belum terverifikasi'} · Bergabung {item.joinedYear ?? 'Belum tersedia'}</p>
        <button className="text-button" onClick={(event) => onPreview(item.id, event.currentTarget)}>Pratinjau profil</button>
      </div>
    </article>
  );
  return (
    <aside className="results-panel" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <span className="eyebrow">JELAJAHI WILAYAH</span>
          <h2 id="results-title">
            {mode === 'belum-terpetakan' ? 'Belum Terpetakan' : catalog
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
      {onCatalogChange && (
        <div className="catalog-controls">
          {state.level !== 'instansi' && <label>
            Tampilkan
            <select aria-label="Tampilkan" value={mode} onChange={(event) => onCatalogChange(event.target.value as typeof mode, '')}>
              <option value="wilayah">Wilayah</option>
              <option value="instansi">Instansi dalam cakupan</option>
              {state.level === 'nasional' && <option value="belum-terpetakan">Belum Terpetakan</option>}
            </select>
          </label>}
          {catalog && <label>
            Cari nama atau kode
            <input type="search" value={searchText} maxLength={120} onChange={(event) => onCatalogChange(mode, event.target.value)} />
          </label>}
        </div>
      )}
      <div
        className="results-scroll"
        ref={content}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      >
        {catalog ? (
          <>
            <p className="results-description">
              {counts.total} hasil · {counts.mapped} terpetakan ·{' '}
              {counts.unmapped} belum memiliki koordinat{demo ? ' (demo)' : ''}.
            </p>
            {mode === 'belum-terpetakan' && <p className="results-description">Lokasi administratif belum terverifikasi. Instansi dengan wilayah yang diketahui tetapi tanpa koordinat tetap ada dalam daftar wilayahnya.</p>}
            {catalogItems.length === 0 ? (
              <p className="empty-list">
                Tidak ada instansi dalam cakupan ini.
              </p>
            ) : (
              catalogItems.map(institutionRow)
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
            {provinceOnly.length > 0 && <section aria-label="Instansi dengan provinsi terverifikasi">
              <h3>Kabupaten/kota kantor belum dipastikan</h3>
              <p className="results-description">Kabupaten/kota kantor belum terverifikasi; instansi tetap tersedia di sini.</p>
              {provinceOnly.map(institutionRow)}
            </section>}
          </>
        )}
      </div>
      <div className="results-footnote">
        Daftar dapat diakses dengan Tab dan Enter.
      </div>
    </aside>
  );
}
