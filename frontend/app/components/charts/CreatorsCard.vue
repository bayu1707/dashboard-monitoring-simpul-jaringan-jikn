<script setup lang="ts">
import { computed, ref } from 'vue';
import { Users } from '@lucide/vue';
import type { PenciptaArsip } from '../../types/domain';
import { formatMetric } from '../../services/metrics';
const props = defineProps<{
  creators: PenciptaArsip[] | null;
  multiCreator: boolean | null;
  simulation?: boolean;
}>();
const expanded = ref(false);
const rows = computed(() =>
  expanded.value ? props.creators : props.creators?.slice(0, 5),
);
const maxValue = computed(() =>
  Math.max(0, ...(props.creators?.map((row) => row.count ?? 0) ?? [])),
);
</script>
<template>
  <section class="detail-card chart-card" aria-labelledby="creators-title">
    <div class="card-title-row">
      <h2 id="creators-title" class="detail-section-title">
        <Users :size="20" />Pencipta Arsip<span
          v-if="simulation"
          class="simulation-label"
          >SIMULASI</span>
      </h2>
      <button
        v-if="creators && creators.length > 5"
        type="button"
        class="text-button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ringkas daftar' : 'Perluas daftar' }}
      </button>
    </div>
    <div v-if="!rows || !rows.length" class="chart-empty">
      <Users :size="32" /><strong>Belum tersedia</strong>
      <p>Nama pencipta dan jumlah arsip per pencipta belum tersedia.</p>
    </div>
    <table v-else class="detail-data-table creators-table">
      <caption class="visually-hidden">
        Jumlah arsip per pencipta
      </caption>
      <thead>
        <tr>
          <th scope="col">Nama pencipta</th>
          <th scope="col">Jumlah arsip</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <th scope="row">{{ row.name }}</th>
          <td>
            <span class="creator-value">{{ formatMetric(row.count) }}</span><span class="creator-track" aria-hidden="true"><span
                :style="{
                  width: `${maxValue > 0 ? ((row.count ?? 0) / maxValue) * 100 : 0}%`,
                }"
            /></span>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="detail-note">
      {{
        multiCreator === true
          ? 'Satu record dapat memiliki lebih dari satu pencipta. Jumlah antarbaris dapat melebihi total arsip.'
          : multiCreator === false
            ? 'Sumber menyatakan satu pencipta per record pada cakupan ini.'
            : 'Hubungan satu atau banyak pencipta per record belum dinyatakan oleh sumber; jumlah antarbaris tidak dianggap sebagai total arsip.'
      }}
    </p>
  </section>
</template>
