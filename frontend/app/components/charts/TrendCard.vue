<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChartNoAxesCombined } from '@lucide/vue';
import type { TrenInput } from '../../types/domain';
import { formatMetric, trendForRange } from '../../services/metrics';
const props = defineProps<{
  series: TrenInput[] | null;
  referenceDate: string;
  simulation?: boolean;
}>();
const range = ref<'1' | '5' | 'all'>('5');
const rows = computed(() =>
  trendForRange(props.series, range.value, props.referenceDate),
);
const available = computed(
  () => rows.value?.filter((row) => row.count !== null) ?? [],
);
const period = computed(() => {
  const first = rows.value?.at(0)?.year;
  const last = rows.value?.at(-1)?.year;
  return first === undefined
    ? 'Periode belum tersedia'
    : first === last
      ? String(first)
      : `${first}–${last}`;
});
const knownTotal = computed(() =>
  available.value.reduce((sum, row) => sum + (row.count ?? 0), 0),
);
const maxValue = computed(
  () => Math.max(1, ...available.value.map((row) => row.count ?? 0)) * 1.1,
);
const chartRows = computed(() =>
  (rows.value ?? []).map((row, index) => ({
    ...row,
    x: 60 + (index + 0.5) * (520 / Math.max(rows.value?.length ?? 0, 1)),
    y: 190 - ((row.count ?? 0) / maxValue.value) * 170,
  })),
);
const barWidth = computed(() =>
  Math.min(56, 340 / Math.max(chartRows.value.length, 1)),
);
const segments = computed(() => {
  const groups: string[] = [];
  let points: string[] = [];
  for (const row of chartRows.value) {
    if (row.count === null) {
      if (points.length) groups.push(points.join(' '));
      points = [];
    } else points.push(`${row.x},${row.y}`);
  }
  if (points.length) groups.push(points.join(' '));
  return groups;
});
const referenceLabel = computed(() =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(props.referenceDate)),
);
</script>
<template>
  <section class="detail-card chart-card" aria-labelledby="trend-title">
    <div class="card-title-row">
      <h2 id="trend-title" class="detail-section-title">
        <ChartNoAxesCombined :size="20" />Tren Input Arsip<span
          v-if="simulation"
          class="simulation-label"
          >SIMULASI</span>
      </h2>
      <label class="trend-range"><span class="visually-hidden">Rentang tren input arsip</span><select v-model="range">
          <option value="1">1 tahun</option>
          <option value="5">5 tahun</option>
          <option value="all">Semua</option>
        </select></label>
    </div>
    <p class="chart-subtitle">
      Tambahan record berdasarkan waktu input · {{ period }}
    </p>
    <div v-if="!available.length" class="chart-empty">
      <ChartNoAxesCombined :size="32" /><strong>Belum tersedia</strong>
      <p>Sumber belum menyediakan seri tambahan record untuk rentang ini.</p>
    </div>
    <template v-else>
<div class="trend-chart" aria-hidden="true">
        <svg
          viewBox="0 0 600 225"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <g v-for="tick in [0, 1, 2, 3, 4]" :key="tick">
            <line
              x1="55"
              x2="590"
              :y1="190 - tick * 42.5"
              :y2="190 - tick * 42.5"
              stroke="#e8eef6"
            />
            <text
              x="45"
              :y="194 - tick * 42.5"
              text-anchor="end"
              fill="#52657e"
              font-size="12"
            >
              {{ Math.round((maxValue * tick) / 4).toLocaleString('id-ID') }}
            </text>
          </g>
          <g v-for="row in chartRows" :key="row.year">
            <rect
              v-if="row.count !== null"
              :x="row.x - barWidth / 2"
              :y="row.y"
              :width="barWidth"
              :height="190 - row.y"
              fill="#83b8f6"
              rx="4"
            >
              <title>
                {{ row.year }}: {{ formatMetric(row.count) }} record
              </title>
            </rect>
            <text
              :x="row.x"
              y="215"
              text-anchor="middle"
              fill="#52657e"
              font-size="12"
            >
              {{ row.year }}
            </text>
          </g>
          <polyline
            v-for="(points, index) in segments"
            :key="index"
            :points="points"
            fill="none"
            stroke="#287bea"
            stroke-width="2.5"
          />
          <circle
            v-for="row in chartRows.filter((row) => row.count !== null)"
            :key="row.year"
            :cx="row.x"
            :cy="row.y"
            r="4"
            fill="#287bea"
          >
            <title>{{ row.year }}: {{ formatMetric(row.count) }} record</title>
          </circle>
        </svg>
      </div>
      <p class="detail-note">
        {{ formatMetric(knownTotal) }} record pada {{ available.length }} tahun
        dengan nilai diketahui. Bar dan garis menampilkan seri yang sama; tahun
        tanpa informasi tetap kosong.
      </p>
</template>
    <details v-if="rows && rows.length" class="chart-table-details">
      <summary>Lihat tabel tren</summary>
      <table class="detail-data-table">
        <caption>
          Tambahan record arsip per tahun ({{
            period
          }})
        </caption>
        <thead>
          <tr>
            <th scope="col">Tahun input</th>
            <th scope="col">Record ditambahkan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.year">
            <th scope="row">{{ row.year }}</th>
            <td>{{ formatMetric(row.count) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
    <p class="detail-note">
      Rentang kalender mengikuti tanggal acuan dataset: {{ referenceLabel }}.
      Tahun penciptaan arsip tidak dipakai sebagai waktu input.
    </p>
  </section>
</template>
