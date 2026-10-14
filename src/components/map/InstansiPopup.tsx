import { Link } from 'react-router-dom';
import { CalendarDays, Files, Users, ArrowUpRight, X } from 'lucide-react';
import { InstitutionLogo } from '../instansi/InstitutionLogo';
import { formatMetric } from '../../services/metrics';
import type { InstansiDetail } from '../../types/domain';
export function InstansiPopup({
  detail,
  demo,
  onClose,
  onDetail,
  onEnter,
  onLeave,
  search,
}: {
  detail: InstansiDetail;
  demo: boolean;
  onClose: () => void;
  onDetail: () => void;
  onEnter: () => void;
  onLeave: () => void;
  search: string;
}) {
  const { instansi, statistik } = detail;
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
      <div className="popup-identity">
        <InstitutionLogo name={instansi.name} url={instansi.logoUrl} />
        <h2>{instansi.name}</h2>
      </div>
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
      <Link
        className="popup-link"
        onClick={onDetail}
        to={`/simpul-jaringan/${encodeURIComponent(instansi.id)}${search}`}
      >
        Lihat detail
        <ArrowUpRight size={17} />
      </Link>
    </section>
  );
}
