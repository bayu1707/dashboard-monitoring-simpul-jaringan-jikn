import { Archive, Files, Users } from 'lucide-react';
import type { StatistikSimpul } from '../../types/domain';
import { formatMetric } from '../../services/metrics';

export function StatisticCards({ statistik, simulation = false }: { statistik: StatistikSimpul; simulation?: boolean }) {
  const cards = [
    { label: 'Jumlah Arsip', metric: statistik.jumlahArsip, Icon: Archive },
    { label: 'Pencipta Arsip', metric: statistik.penciptaArsip, Icon: Users },
    { label: 'Kopi Digital', metric: statistik.kopiDigital, Icon: Files },
  ];
  return (
    <section className="detail-card" aria-labelledby="statistics-title">
      <h2 id="statistics-title" className="detail-section-title">
        <Archive size={20} aria-hidden="true" />
        Statistik Simpul
        {simulation && <span className="simulation-label">SIMULASI</span>}
      </h2>
      <div className="statistic-grid">
        {cards.map(({ label, metric, Icon }) => (
          <div className="statistic-item" key={label}>
            <Icon size={23} aria-hidden="true" />
            <strong
              className={
                metric.value === null ? 'metric-unavailable' : undefined
              }
            >
              {formatMetric(metric.value)}
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="detail-note">
        Pencipta arsip menghitung entitas unik. Kopi digital mengikuti definisi
        sumber, bukan jumlah arsip yang memiliki berkas.
      </p>
    </section>
  );
}
