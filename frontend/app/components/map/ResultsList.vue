<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { ChevronRight, MapPin, X, Building2 } from '@lucide/vue';
import type {
  ExplorationState,
  Instansi,
  ReferenceData,
  Wilayah,
} from '../../types/domain';
import { countInstansi } from '../../services/exploration';
type ListMode = 'wilayah' | 'instansi' | 'belum-terpetakan';
const props = withDefaults(
  defineProps<{
    state: ExplorationState;
    references: ReferenceData;
    items: Instansi[];
    search: string;
    initialScroll: number;
    demo: boolean;
    mode?: ListMode;
    searchText?: string;
  }>(),
  { mode: 'wilayah', searchText: '' },
);
const emit = defineEmits<{
  region: [region: Wilayah];
  preview: [id: string, origin: HTMLElement];
  close: [];
  detail: [id: string];
  scroll: [top: number];
  catalogChange: [mode: ListMode, text: string];
}>();
const content = ref<HTMLDivElement | null>(null);
onMounted(() => {
  if (content.value) content.value.scrollTop = props.initialScroll;
});
watch(
  () => props.initialScroll,
  (value) => {
    if (content.value) content.value.scrollTop = value;
  },
);
const regions = computed(() =>
  props.state.level === 'nasional'
    ? props.references.provinces
    : props.references.kabKota.filter(
        (w) => w.provinceId === props.state.provinceId,
      ),
);
const catalog = computed(
  () => props.state.level === 'instansi' || props.mode !== 'wilayah',
);
const catalogItems = computed(() =>
  props.items.filter(
    (item) =>
      (props.mode !== 'belum-terpetakan' || item.provinceId === null) &&
      (!props.searchText ||
        `${item.name} ${item.kode ?? ''}`
          .toLocaleLowerCase('id')
          .includes(props.searchText.toLocaleLowerCase('id'))),
  ),
);
const provinceOnly = computed(() =>
  props.state.level === 'provinsi'
    ? props.items.filter((item) => item.kabKotaId === null)
    : [],
);
const counts = computed(() => countInstansi(catalogItems.value));
const visibleItems = computed(() =>
  catalog.value ? catalogItems.value : provinceOnly.value,
);
function regionCount(region: Wilayah) {
  return countInstansi(
    props.items.filter((item) =>
      region.level === 'province'
        ? item.provinceId === region.id
        : item.kabKotaId === region.id,
    ),
  ).total;
}
function preview(event: Event, id: string) {
  emit('preview', id, event.currentTarget as HTMLElement);
}
function selectMode(event: Event) {
  emit(
    'catalogChange',
    (event.target as HTMLSelectElement).value as ListMode,
    '',
  );
}
</script>
<template>
  <aside class="results-panel" aria-labelledby="results-title">
    <div class="results-heading">
      <div>
        <span class="eyebrow">JELAJAHI WILAYAH</span>
        <h2 id="results-title">
          {{
            mode === 'belum-terpetakan'
              ? 'Belum Terpetakan'
              : catalog
                ? 'Daftar instansi'
                : state.level === 'provinsi'
                  ? 'Kabupaten / Kota'
                  : 'Daftar provinsi'
          }}
        </h2>
      </div>
      <button
        class="icon-button"
        aria-label="Tutup daftar"
        @click="emit('close')"
      >
        <X :size="19" />
      </button>
    </div>
    <div class="catalog-controls">
      <label v-if="state.level !== 'instansi'">Tampilkan<select
          aria-label="Tampilkan"
          :value="mode"
          @change="selectMode"
        >
          <option value="wilayah">Wilayah</option>
          <option value="instansi">Instansi dalam cakupan</option>
          <option v-if="state.level === 'nasional'" value="belum-terpetakan">
            Belum Terpetakan
          </option>
        </select></label><label v-if="catalog">Cari nama atau kode<input
          type="search"
          :value="searchText"
          :maxlength="120"
          @input="
            emit(
              'catalogChange',
              mode,
              ($event.target as HTMLInputElement).value,
            )
          "
      /></label>
    </div>
    <div
      ref="content"
      class="results-scroll"
      @scroll="emit('scroll', ($event.target as HTMLElement).scrollTop)"
    >
      <template v-if="catalog">
<p class="results-description">
          {{ counts.total }} hasil · {{ counts.mapped }} terpetakan ·
          {{ counts.unmapped }} belum memiliki koordinat{{
            demo ? ' (demo)' : ''
          }}.
        </p>
        <p v-if="mode === 'belum-terpetakan'" class="results-description">
          Lokasi administratif belum terverifikasi. Instansi dengan wilayah yang
          diketahui tetapi tanpa koordinat tetap ada dalam daftar wilayahnya.
        </p>
        <p v-if="!catalogItems.length" class="empty-list">
          Tidak ada instansi dalam cakupan ini.
        </p>
</template>
      <template v-else>
<p class="results-description">
          Pilih wilayah untuk membuka lapisan berikutnya. Jumlah merupakan ID
          instansi unik dalam snapshot{{ demo ? ' demo' : '' }} ini.
        </p>
        <button
          v-for="region in regions"
          :key="region.id"
          class="region-row"
          @click="emit('region', region)"
        >
          <MapPin :size="17" /><span>{{ region.name }}</span><span class="region-count">{{ regionCount(region) }}</span><ChevronRight :size="16" />
        </button>
        <p v-if="!regions.length" class="empty-list">
          Referensi kabupaten/kota wilayah ini belum dimuat. Pilih provinsi lain
          atau kembali ke nasional.
        </p>
        <template v-if="provinceOnly.length">
<h3>Kabupaten/kota kantor belum dipastikan</h3>
          <p class="results-description">
            Kabupaten/kota kantor belum terverifikasi; instansi tetap tersedia
            di sini.
          </p>
</template>
</template>
      <article
        v-for="item in visibleItems"
        :key="item.id"
        class="result-item"
        :data-result-instansi-id="item.id"
      >
        <span class="result-icon"><Building2 :size="19" /></span>
        <div>
          <NuxtLink
            :to="`/simpul-jaringan/${encodeURIComponent(item.id)}${search}`"
            @click="emit('detail', item.id)"
            >
{{ item.name }}
</NuxtLink>
          <p>
            {{
              item.coordinates
                ? 'Koordinat tersedia'
                : 'Belum memiliki koordinat'
            }}
          </p>
          <p v-if="item.locationVerificationStatus === 'needs-review'">
            Lokasi perlu ditinjau
          </p>
          <p>
            {{
              item.kabKotaName ??
              item.provinceName ??
              'Wilayah belum terverifikasi'
            }}
            · Bergabung {{ item.joinedYear ?? 'Belum tersedia' }}
          </p>
          <button class="text-button" @click="preview($event, item.id)">
            Pratinjau profil
          </button>
        </div>
      </article>
    </div>
    <div class="results-footnote">
      Daftar dapat diakses dengan Tab dan Enter.
    </div>
  </aside>
</template>
