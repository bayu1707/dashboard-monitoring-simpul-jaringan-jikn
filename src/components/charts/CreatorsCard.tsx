import { useState } from 'react';
import { Users } from 'lucide-react';
import type { PenciptaArsip } from '../../types/domain';
import { formatMetric } from '../../services/metrics';

export function CreatorsCard({
  creators,
  multiCreator,
}: {
  creators: PenciptaArsip[] | null;
  multiCreator: boolean | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? creators : creators?.slice(0, 5);
  const maxValue = Math.max(
    0,
    ...(creators?.map((row) => row.count ?? 0) ?? []),
  );
  return (
    <section
      className="detail-card chart-card"
      aria-labelledby="creators-title"
    >
      <div className="card-title-row">
        <h2 id="creators-title" className="detail-section-title">
          <Users size={20} aria-hidden="true" />
          Pencipta Arsip
        </h2>
        {creators !== null && creators.length > 5 && (
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Ringkas daftar' : 'Perluas daftar'}
          </button>
        )}
      </div>
      {rows === null || rows === undefined || rows.length === 0 ? (
        <div className="chart-empty">
          <Users size={32} aria-hidden="true" />
          <strong>Belum tersedia</strong>
          <p>Nama pencipta dan jumlah arsip per pencipta belum tersedia.</p>
        </div>
      ) : (
        <table className="detail-data-table creators-table">
          <caption className="visually-hidden">
            Jumlah arsip per pencipta
          </caption>
          <thead>
            <tr>
              <th scope="col">Nama pencipta</th>
              <th scope="col">Jumlah arsip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>
                  <span className="creator-value">
                    {formatMetric(row.count)}
                  </span>
                  <span className="creator-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${maxValue > 0 ? ((row.count ?? 0) / maxValue) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="detail-note">
        {multiCreator === true
          ? 'Satu record dapat memiliki lebih dari satu pencipta. Jumlah antarbaris dapat melebihi total arsip.'
          : multiCreator === false
            ? 'Sumber menyatakan satu pencipta per record pada cakupan ini.'
            : 'Hubungan satu atau banyak pencipta per record belum dinyatakan oleh sumber; jumlah antarbaris tidak dianggap sebagai total arsip.'}
      </p>
    </section>
  );
}
