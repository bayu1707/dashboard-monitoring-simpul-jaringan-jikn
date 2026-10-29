<script setup lang="ts">
import { computed } from 'vue';
import { ChartPie } from '@lucide/vue';
import type { DistribusiArsip } from '../../types/domain';
import { formatMetric } from '../../services/metrics';
const props = defineProps<{
  series: DistribusiArsip[] | null;
  totalArsip: number | null;
  simulation?: boolean;
}>();
const colors = [
  '#3298ed',
  '#64bf70',
  '#f5b84b',
  '#a98add',
  '#7f98aa',
  '#d7849d',
];
const known = computed(
  () => props.series?.filter((row) => row.count !== null) ?? [],
);
const knownCount = computed(() =>
  known.value.reduce((sum, row) => sum + (row.count ?? 0), 0),
);
const partial = computed(
  () =>
    props.series?.some((row) => row.count === null) ||
    (props.totalArsip !== null && knownCount.value !== props.totalArsip),
);
const slices = computed(() => {
  let angle = -90;
  return (props.series ?? []).flatMap((row, index) => {
    if (row.count === null || row.count <= 0 || knownCount.value === 0)
      return [];
    const start = angle;
    angle += (row.count / knownCount.value) * 360;
    // SVG circles keep a complete single-category ring valid, without a degenerate arc.
    return [
      {
        ...row,
        color: colors[index % colors.length],
        length: (row.count / knownCount.value) * 100,
        offset: ((start + 90) / 360) * 100,
      },
    ];
  });
});
</script>
<template>
  <section class="detail-card chart-card" aria-labelledby="distribution-title">
    <h2 id="distribution-title" class="detail-section-title">
      <ChartPie :size="20" />Distribusi Arsip<span
        v-if="simulation"
        class="simulation-label"
        >SIMULASI</span>
    </h2>
    <div v-if="!series || !series.length" class="chart-empty">
      <ChartPie :size="32" /><strong>Belum tersedia</strong>
      <p>Taksonomi dan nilai distribusi arsip belum diberikan oleh sumber.</p>
    </div>
    <template v-else>
<div class="distribution-layout">
        <div
          v-if="knownCount > 0"
          class="distribution-chart"
          aria-hidden="true"
        >
          <svg width="100%" height="100%" viewBox="0 0 200 200">
            <circle
              v-for="row in slices"
              :key="row.categoryId"
              cx="100"
              cy="100"
              r="75"
              fill="none"
              :stroke="row.color"
              stroke-width="28"
              pathLength="100"
              :stroke-dasharray="`${row.length} ${100 - row.length}`"
              :stroke-dashoffset="-row.offset"
              transform="rotate(-90 100 100)"
            >
              <title>{{ row.label }}: {{ formatMetric(row.count) }}</title>
            </circle>
          </svg>
          <div class="donut-label">
            <strong>{{ formatMetric(knownCount) }}</strong><span>Dalam kategori</span>
          </div>
        </div>
        <div v-else class="distribution-zero">
          <strong>{{ known.length ? '0' : 'Belum tersedia' }}</strong><span>Belum ada nilai positif untuk digambarkan.</span>
        </div>
        <table class="detail-data-table distribution-table">
          <caption class="visually-hidden">
            Nilai distribusi arsip menurut kategori sumber
          </caption>
          <thead>
            <tr>
              <th scope="col">Kategori sumber</th>
              <th scope="col">Arsip</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in series" :key="row.categoryId">
              <th scope="row">
                <span
                  class="category-dot"
                  :style="{ backgroundColor: colors[index % colors.length] }"
                  aria-hidden="true"
                />{{ row.label }}
              </th>
              <td>{{ formatMetric(row.count) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="detail-note">
        <template v-if="partial">
Cakupan kategori belum lengkap atau tidak sama dengan total arsip{{
            totalArsip === null ? '' : ` (${formatMetric(totalArsip)})`
          }}.
</template>Diagram hanya menggambarkan kategori dengan nilai diketahui; persentase
        nasional tidak disimpulkan.
      </p>
</template>
  </section>
</template>
