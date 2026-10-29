<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RotateCcw, SlidersHorizontal, List, X, ChevronDown } from '@lucide/vue';
import type { ExplorationState, ReferenceData } from '../../types/domain';
import { selectProvince, selectKabKota, selectJenis } from '../../services/exploration';

const props = defineProps<{
  state: ExplorationState;
  references: ReferenceData;
  listOpen: boolean;
}>();
const emit = defineEmits<{
  change: [value: ExplorationState];
  reset: [];
  list: [];
}>();

// SSR menampilkan kontrol sebelum event Vue aktif; tunggu hidrasi selesai.
const ready = ref(false);
onMounted(() => { ready.value = true; });

const dialog = ref<HTMLDialogElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const draft = ref<ExplorationState>({ ...props.state });
const sets = computed(() => [
  { prefix: 'desktop', state: props.state },
  { prefix: 'mobile', state: draft.value },
]);

function open() {
  draft.value = { ...props.state };
  dialog.value?.showModal();
}
function close() {
  dialog.value?.close();
  trigger.value?.focus();
}
function update(prefix: string, state: ExplorationState) {
  if (prefix === 'mobile') draft.value = state;
  else emit('change', state);
}
function change(
  event: Event,
  prefix: string,
  state: ExplorationState,
  field: 'province' | 'kabKota' | 'jenis',
) {
  const value = (event.target as HTMLSelectElement).value || null;
  const next = field === 'province'
    ? selectProvince(state, value, props.references)
    : field === 'kabKota'
      ? selectKabKota(state, value, props.references)
      : selectJenis(state, value, props.references);
  update(prefix, next);
}
function reset() {
  emit('reset');
  close();
}
</script>

<template>
  <div class="map-toolbar" role="group" aria-label="Filter peta" :aria-busy="!ready">
    <slot name="search" />
    <div class="desktop-filters">
      <template v-for="set in sets.filter(value => value.prefix === 'desktop')" :key="set.prefix">
        <label class="map-filter-field" :for="`${set.prefix}-province`">
          <span class="filter-label">Provinsi</span>
          <select
            :id="`${set.prefix}-province`"
            title="Provinsi"
            :disabled="!ready"
            :value="set.state.provinceId ?? ''"
            @change="change($event, set.prefix, set.state, 'province')"
          >
            <option value="">Pilih Provinsi</option>
            <option v-for="p in references.provinces" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <ChevronDown class="filter-chevron" :size="17" aria-hidden="true" />
        </label>
        <label class="map-filter-field" :for="`${set.prefix}-kabkota`">
          <span class="filter-label">Kabupaten / Kota</span>
          <select
            :id="`${set.prefix}-kabkota`"
            title="Kabupaten / Kota"
            :disabled="!ready || !set.state.provinceId"
            :value="set.state.kabKotaId ?? ''"
            @change="change($event, set.prefix, set.state, 'kabKota')"
          >
            <option value="">Pilih Kab/Kota</option>
            <option
              v-for="p in references.kabKota.filter(p => p.provinceId === set.state.provinceId)"
              :key="p.id" :value="p.id"
            >
              {{ p.name }}
            </option>
          </select>
          <ChevronDown class="filter-chevron" :size="17" aria-hidden="true" />
        </label>
        <label class="map-filter-field" :for="`${set.prefix}-jenis`">
          <span class="filter-label">Jenis Instansi</span>
          <select
            :id="`${set.prefix}-jenis`"
            title="Jenis Instansi"
            :disabled="!ready || set.state.level !== 'instansi'"
            :value="set.state.jenisId ?? ''"
            @change="change($event, set.prefix, set.state, 'jenis')"
          >
            <option value="">Semua Jenis</option>
            <option v-for="p in references.jenisInstansi" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <ChevronDown class="filter-chevron" :size="17" aria-hidden="true" />
        </label>
      </template>
    </div>
    <button ref="trigger" class="button mobile-filter" :disabled="!ready" @click="open">
      <SlidersHorizontal :size="18" />Filter
    </button>
    <button
      class="button reset-button secondary"
      aria-label="Reset seluruh filter" title="Reset seluruh filter"
      :disabled="!ready" @click="emit('reset')"
    >
      <RotateCcw :size="18" /><span>Reset</span>
    </button>
    <button
      :class="['button list-button', listOpen ? 'selected' : 'secondary']"
      aria-label="Daftar" :aria-expanded="listOpen"
      :disabled="!ready" @click="emit('list')"
    >
      <List :size="18" />Daftar
    </button>
  </div>
  <dialog ref="dialog" class="filter-sheet" aria-labelledby="filter-title" @cancel.prevent="close">
    <div class="sheet-heading">
      <h2 id="filter-title">Filter wilayah</h2>
      <button class="icon-button" aria-label="Tutup filter dan buang perubahan" @click="close">
        <X :size="20" />
      </button>
    </div>
    <p class="muted">
      Pilih provinsi untuk menjelajahi kabupaten/kota. Jenis instansi bersifat opsional.
    </p>
    <div class="sheet-fields">
      <label class="map-filter-field" for="mobile-province">
        <span class="filter-label">Provinsi</span>
        <select
          id="mobile-province" title="Provinsi" :value="draft.provinceId ?? ''"
          @change="change($event, 'mobile', draft, 'province')"
        >
          <option value="">Pilih Provinsi</option>
          <option v-for="p in references.provinces" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <ChevronDown class="filter-chevron" :size="17" />
      </label>
      <label class="map-filter-field" for="mobile-kabkota">
        <span class="filter-label">Kabupaten / Kota</span>
        <select
          id="mobile-kabkota" title="Kabupaten / Kota"
          :disabled="!draft.provinceId" :value="draft.kabKotaId ?? ''"
          @change="change($event, 'mobile', draft, 'kabKota')"
        >
          <option value="">Pilih Kab/Kota</option>
          <option
            v-for="p in references.kabKota.filter(p => p.provinceId === draft.provinceId)"
            :key="p.id" :value="p.id"
          >
            {{ p.name }}
          </option>
        </select>
        <ChevronDown class="filter-chevron" :size="17" />
      </label>
      <label class="map-filter-field" for="mobile-jenis">
        <span class="filter-label">Jenis Instansi</span>
        <select
          id="mobile-jenis" title="Jenis Instansi"
          :disabled="draft.level !== 'instansi'" :value="draft.jenisId ?? ''"
          @change="change($event, 'mobile', draft, 'jenis')"
        >
          <option value="">Semua Jenis</option>
          <option v-for="p in references.jenisInstansi" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <ChevronDown class="filter-chevron" :size="17" />
      </label>
    </div>
    <div class="sheet-actions">
      <button class="button secondary" @click="reset">Reset</button>
      <button class="button secondary" @click="close">Batal</button>
      <button class="button" @click="emit('change', draft); close()">Terapkan</button>
    </div>
  </dialog>
</template>
