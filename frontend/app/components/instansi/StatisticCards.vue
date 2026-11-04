<script setup lang="ts">
import { computed } from 'vue';
import { Archive, Files, Users } from '@lucide/vue';
import type { StatistikSimpul } from '../../types/domain';
import { formatMetric } from '../../services/metrics';
const props = defineProps<{
  statistik: StatistikSimpul;
  simulation?: boolean;
  database?: boolean;
}>();
const cards = computed(() => [
  { label: props.database ? 'Deskripsi Arsip' : 'Jumlah Arsip', metric: props.statistik.jumlahArsip, icon: Archive },
  {
    label: props.database ? 'Entitas Terkait' : 'Pencipta Arsip',
    metric: props.statistik.penciptaArsip,
    icon: Users,
  },
  { label: props.database ? 'Metadata Objek Digital' : 'Kopi Digital', metric: props.statistik.kopiDigital, icon: Files },
]);
</script>
<template>
  <section class="detail-card" aria-labelledby="statistics-title">
    <h2 id="statistics-title" class="detail-section-title">
      <Archive :size="20" />Statistik Simpul<span
        v-if="simulation"
        class="simulation-label"
        >SIMULASI</span>
    </h2>
    <div class="statistic-grid">
      <div v-for="card in cards" :key="card.label" class="statistic-item" :title="card.metric.definition">
        <component :is="card.icon" :size="23" /><strong
          :class="{ 'metric-unavailable': card.metric.value === null }"
          >{{ formatMetric(card.metric.value) }}</strong><span>{{ card.label }}</span>
      </div>
    </div>
    <p v-if="database" class="detail-note">
      Deskripsi semua level tanpa filter publikasi. Entitas terkait belum tentu
      pencipta; metadata objek digital bukan bukti berkas tersedia. Definisi
      operasional perlu dikonfirmasi dengan vendor.
    </p>
    <p v-else class="detail-note">
      Pencipta arsip menghitung entitas unik. Kopi digital mengikuti definisi
      sumber, bukan jumlah arsip yang memiliki berkas.
    </p>
  </section>
</template>
