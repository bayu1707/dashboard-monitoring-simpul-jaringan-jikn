<script setup lang="ts">
import { computed } from 'vue';
import {
  CalendarDays,
  Files,
  Users,
  ArrowRight,
  ExternalLink,
  X,
} from '@lucide/vue';
import type { InstansiDetail } from '../../types/domain';
import { formatMetric } from '../../services/metrics';
import { verifiedLandingPageUrl } from '../../services/landingPage';
import InstitutionLogo from './InstitutionLogo.vue';
const props = defineProps<{
  detail: InstansiDetail;
  demo: boolean;
  search: string;
  jenisName?: string | null;
}>();
const emit = defineEmits<{ close: []; detail: []; enter: []; leave: [] }>();
const landingUrl = computed(() =>
  verifiedLandingPageUrl(props.detail.instansi),
);
function blur(event: FocusEvent) {
  if (
    !(event.currentTarget as HTMLElement).contains(
      event.relatedTarget as Node | null,
    )
  )
    emit('leave');
}
</script>
<template>
  <section
    class="instansi-popup"
    :aria-label="`Pratinjau ${detail.instansi.name}`"
    @pointerenter="emit('enter')"
    @pointerleave="emit('leave')"
    @focusin="emit('enter')"
    @focusout="blur"
  >
    <button
      class="popup-close icon-button"
      aria-label="Tutup popup"
      @click="emit('close')"
    >
      <X :size="18" />
    </button>
    <span v-if="demo" class="demo-badge">DATA DEMO</span><span v-if="detail.metadata.datasetKind === 'pilot'" class="demo-badge">DATA SIMULASI</span>
    <p
      v-if="detail.metadata.datasetKind === 'excel'"
      class="snapshot-popup-label"
    >
      Snapshot Excel · Data Pengelolaan Casefile
    </p>
    <div class="popup-identity">
      <InstitutionLogo
        :name="detail.instansi.name"
        :url="detail.instansi.logoUrl"
      />
      <div class="popup-profile-text">
        <span v-if="jenisName" class="popup-jenis-badge">{{ jenisName }}</span>
        <h2>{{ detail.instansi.name }}</h2>
      </div>
    </div>
    <p
      v-if="detail.instansi.coordinateLocationLabel"
      class="snapshot-popup-label"
    >
      Lokasi: {{ detail.instansi.coordinateLocationLabel }}
    </p>
    <dl class="popup-metrics">
      <div>
        <dt :title="detail.statistik.jumlahArsip.definition"><Files :size="17" />{{ detail.metadata.datasetKind === 'database' ? 'Deskripsi arsip' : 'Jumlah arsip' }}</dt>
        <dd>{{ formatMetric(detail.statistik.jumlahArsip.value) }}</dd>
      </div>
      <div>
        <dt :title="detail.statistik.penciptaArsip.definition"><Users :size="17" />{{ detail.metadata.datasetKind === 'database' ? 'Entitas terkait' : 'Pencipta arsip' }}</dt>
        <dd>{{ formatMetric(detail.statistik.penciptaArsip.value) }}</dd>
      </div>
      <div>
        <dt><CalendarDays :size="17" />Tahun bergabung</dt>
        <dd>{{ detail.instansi.joinedYear ?? 'Belum tersedia' }}</dd>
      </div>
    </dl>
    <div class="popup-actions">
      <NuxtLink
        class="popup-link"
        :to="`/simpul-jaringan/${encodeURIComponent(detail.instansi.id)}${search}`"
        @click="emit('detail')"
        >
<ExternalLink :size="17" aria-hidden="true" />Lihat detail<ArrowRight
          :size="17"
          aria-hidden="true"
/>
</NuxtLink><a
        v-if="landingUrl"
        class="landing-page-link"
        :href="landingUrl"
        target="_blank"
        rel="noopener noreferrer"
        ><ExternalLink :size="17" aria-hidden="true" />Landing Page<ArrowRight
          :size="17"
          aria-hidden="true"
/></a><button v-else class="landing-page-link" disabled type="button">
        <ExternalLink :size="17" aria-hidden="true" />Landing Page<ArrowRight
          :size="17"
          aria-hidden="true"
        />
      </button>
    </div>
    <p v-if="!landingUrl" class="landing-page-note">Tautan belum tersedia</p>
    <p v-if="detail.metadata.datasetKind === 'development'" class="snapshot-popup-label">DATA UJI · Bukan simpul resmi SIKN/JIKN</p>
    <p v-if="detail.metadata.datasetKind === 'database'" class="snapshot-popup-label">
      UJI LOKAL · Database Maret 2026 · Tahun dari Excel
    </p>
    <p
      v-if="detail.metadata.datasetKind === 'pilot'"
      class="snapshot-popup-label"
    >
      Statistik simulasi · Tahun bergabung dari Excel
    </p>
  </section>
</template>
