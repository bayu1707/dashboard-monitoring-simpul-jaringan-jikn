import { useState } from 'react';
import {
  Bar,
  ComposedChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import type { TrenInput } from '../../types/domain';
import { formatMetric, trendForRange } from '../../services/metrics';

export function TrendCard({
  series,
  referenceDate,
  simulation = false,
}: {
  series: TrenInput[] | null;
  referenceDate: string;
  simulation?: boolean;
}) {
  const [range, setRange] = useState<'1' | '5' | 'all'>('5');
  const rows = trendForRange(series, range, referenceDate);
  const available = rows?.filter((row) => row.count !== null) ?? [];
  const firstYear = rows?.at(0)?.year;
  const lastYear = rows?.at(-1)?.year;
  const period =
    firstYear === undefined
      ? 'Periode belum tersedia'
      : firstYear === lastYear
        ? `${firstYear}`
        : `${firstYear}–${lastYear}`;
  const knownTotal = available.reduce(
    (total, row) => total + (row.count ?? 0),
    0,
  );
  return (
    <section className="detail-card chart-card" aria-labelledby="trend-title">
      <div className="card-title-row">
        <h2 id="trend-title" className="detail-section-title">
          <ChartNoAxesCombined size={20} aria-hidden="true" />
          Tren Input Arsip
          {simulation && <span className="simulation-label">SIMULASI</span>}
        </h2>
        <label className="trend-range">
          <span className="visually-hidden">Rentang tren input arsip</span>
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as '1' | '5' | 'all')
            }
          >
            <option value="1">1 tahun</option>
            <option value="5">5 tahun</option>
            <option value="all">Semua</option>
          </select>
        </label>
      </div>
      <p className="chart-subtitle">
        Tambahan record berdasarkan waktu input · {period}
      </p>
      {available.length === 0 ? (
        <div className="chart-empty">
          <ChartNoAxesCombined size={32} aria-hidden="true" />
          <strong>Belum tersedia</strong>
          <p>
            Sumber belum menyediakan seri tambahan record untuk rentang ini.
          </p>
        </div>
      ) : (
        <>
          <div className="trend-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={rows ?? []}
                margin={{ top: 12, right: 12, bottom: 2, left: 0 }}
              >
                <CartesianGrid stroke="#e8eef6" vertical={false} />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tick={{ fill: '#52657e' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  allowDecimals={false}
                  tick={{ fill: '#52657e', fontSize: 12 }}
                  tickFormatter={(value) =>
                    Number(value).toLocaleString('id-ID')
                  }
                />
                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString('id-ID'),
                    'Record ditambahkan',
                  ]}
                  labelFormatter={(label) => `Tahun ${label}`}
                />
                <Bar
                  dataKey="count"
                  fill="#83b8f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                  name="Record ditambahkan"
                  isAnimationActive={false}
                />
                <Line
                  dataKey="count"
                  stroke="#287bea"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                  name="Record ditambahkan"
                  tooltipType="none"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="detail-note">
            {formatMetric(knownTotal)} record pada {available.length} tahun
            dengan nilai diketahui. Bar dan garis menampilkan seri yang sama;
            tahun tanpa informasi tetap kosong.
          </p>
        </>
      )}
      {rows !== null && rows.length > 0 && (
        <details className="chart-table-details">
          <summary>Lihat tabel tren</summary>
          <table className="detail-data-table">
            <caption>Tambahan record arsip per tahun ({period})</caption>
            <thead>
              <tr>
                <th scope="col">Tahun input</th>
                <th scope="col">Record ditambahkan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year}>
                  <th scope="row">{row.year}</th>
                  <td>{formatMetric(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="detail-note">
        Rentang kalender mengikuti tanggal acuan dataset:{' '}
        {new Intl.DateTimeFormat('id-ID', {
          dateStyle: 'long',
          timeZone: 'Asia/Jakarta',
        }).format(new Date(referenceDate))}
        . Tahun penciptaan arsip tidak dipakai sebagai waktu input.
      </p>
    </section>
  );
}
