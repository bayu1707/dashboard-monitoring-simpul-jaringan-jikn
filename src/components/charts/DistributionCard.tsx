import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartPie } from 'lucide-react';
import type { DistribusiArsip } from '../../types/domain';
import { formatMetric } from '../../services/metrics';

const categoryColors = [
  '#3298ed',
  '#64bf70',
  '#f5b84b',
  '#a98add',
  '#7f98aa',
  '#d7849d',
];
export function DistributionCard({
  series,
  totalArsip,
}: {
  series: DistribusiArsip[] | null;
  totalArsip: number | null;
}) {
  const known = series?.filter((row) => row.count !== null) ?? [];
  const plotted = known.filter((row) => (row.count ?? 0) > 0);
  const knownCount = known.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const hasUnknown = series?.some((row) => row.count === null) ?? false;
  const partial =
    hasUnknown || (totalArsip !== null && knownCount !== totalArsip);
  return (
    <section
      className="detail-card chart-card"
      aria-labelledby="distribution-title"
    >
      <h2 id="distribution-title" className="detail-section-title">
        <ChartPie size={20} aria-hidden="true" />
        Distribusi Arsip
      </h2>
      {series === null || series.length === 0 ? (
        <div className="chart-empty">
          <ChartPie size={32} aria-hidden="true" />
          <strong>Belum tersedia</strong>
          <p>
            Taksonomi dan nilai distribusi arsip belum diberikan oleh sumber.
          </p>
        </div>
      ) : (
        <>
          <div className="distribution-layout">
            {plotted.length > 0 ? (
              <div className="distribution-chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={plotted}
                      dataKey="count"
                      nameKey="label"
                      innerRadius="66%"
                      outerRadius="90%"
                      paddingAngle={2}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {plotted.map((row) => (
                        <Cell
                          key={row.categoryId}
                          fill={
                            categoryColors[
                              series.findIndex(
                                (category) =>
                                  category.categoryId === row.categoryId,
                              ) % categoryColors.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        Number(value).toLocaleString('id-ID'),
                        'Arsip',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-label">
                  <strong>{formatMetric(knownCount)}</strong>
                  <span>Dalam kategori</span>
                </div>
              </div>
            ) : (
              <div className="distribution-zero">
                <strong>{known.length > 0 ? '0' : 'Belum tersedia'}</strong>
                <span>Belum ada nilai positif untuk digambarkan.</span>
              </div>
            )}
            <table className="detail-data-table distribution-table">
              <caption className="visually-hidden">
                Nilai distribusi arsip menurut kategori sumber
              </caption>
              <thead>
                <tr>
                  <th scope="col">Kategori sumber</th>
                  <th scope="col">Arsip</th>
                </tr>
              </thead>
              <tbody>
                {series.map((row, index) => (
                  <tr key={row.categoryId}>
                    <th scope="row">
                      <span
                        className="category-dot"
                        style={{
                          backgroundColor:
                            categoryColors[index % categoryColors.length],
                        }}
                        aria-hidden="true"
                      />
                      {row.label}
                    </th>
                    <td>{formatMetric(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="detail-note">
            {partial
              ? `Cakupan kategori belum lengkap atau tidak sama dengan total arsip${totalArsip === null ? '' : ` (${formatMetric(totalArsip)})`}. `
              : ''}
            Diagram hanya menggambarkan kategori dengan nilai diketahui;
            persentase nasional tidak disimpulkan.
          </p>
        </>
      )}
    </section>
  );
}
