import { Link } from 'react-router-dom';
import { CalendarDays, Files, Users, ArrowRight, ExternalLink, X } from 'lucide-react';
import { InstitutionLogo } from '../instansi/InstitutionLogo';
import { formatMetric } from '../../services/metrics';
import type { InstansiDetail } from '../../types/domain';
import { verifiedLandingPageUrl } from '../../services/landingPage';
import '../../styles/landing-page.css';
export function InstansiPopup({
  detail,
  demo,
  onClose,
  onDetail,
  onEnter,
  onLeave,
  search,
  jenisName,
}: {
  detail: InstansiDetail;
  demo: boolean;
  onClose: () => void;
  onDetail: () => void;
  onEnter: () => void;
  onLeave: () => void;
  search: string;
  jenisName?: string | null;
}) {
  const { instansi, statistik } = detail;
  const landingUrl = verifiedLandingPageUrl(instansi);
  return (
    <section
      className="instansi-popup"
      aria-label={`Pratinjau ${instansi.name}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onLeave();
      }}
    >
      <button
        className="popup-close icon-button"
        aria-label="Tutup popup"
        onClick={() => onClose()}
      >
        <X size={18} />
      </button>
      {demo && <span className="demo-badge">DATA DEMO</span>}
      {detail.metadata.datasetKind === 'pilot' && <span className="demo-badge">DATA SIMULASI</span>}
      {detail.metadata.datasetKind === 'excel' && (
        <p className="snapshot-popup-label">Snapshot Excel · Data Pengelolaan Casefile</p>
      )}
      <div className="popup-identity">
        <InstitutionLogo name={instansi.name} url={instansi.logoUrl} />
        <div className="popup-profile-text">
          {jenisName && <span className="popup-jenis-badge">{jenisName}</span>}
          <h2>{instansi.name}</h2>
        </div>
      </div>
      {instansi.coordinateLocationLabel && <p className="snapshot-popup-label">Lokasi: {instansi.coordinateLocationLabel}</p>}
      <dl className="popup-metrics">
        <div>
          <dt>
            <Files size={17} />
            Jumlah arsip
          </dt>
          <dd>{formatMetric(statistik.jumlahArsip.value)}</dd>
        </div>
        <div>
          <dt>
            <Users size={17} />
            Pencipta arsip
          </dt>
          <dd>{formatMetric(statistik.penciptaArsip.value)}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={17} />
            Tahun bergabung
          </dt>
          <dd>{instansi.joinedYear ?? 'Belum tersedia'}</dd>
        </div>
      </dl>
      <div className="popup-actions">
        <Link
          className="popup-link"
          onClick={onDetail}
          to={`/simpul-jaringan/${encodeURIComponent(instansi.id)}${search}`}
        >
          <ExternalLink size={17} aria-hidden="true" />
          Lihat detail
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        {landingUrl ? (
          <a className="landing-page-link" href={landingUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={17} aria-hidden="true" />
            Landing Page <ArrowRight size={17} aria-hidden="true" />
          </a>
        ) : (
          <button className="landing-page-link" disabled type="button">
            <ExternalLink size={17} aria-hidden="true" />
            Landing Page <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {!landingUrl && <p className="landing-page-note">Tautan belum tersedia</p>}
      {detail.metadata.datasetKind === 'pilot' && <p className="snapshot-popup-label">Statistik simulasi · Tahun bergabung dari Excel</p>}
    </section>
  );
}
