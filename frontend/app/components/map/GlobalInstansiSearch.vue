<script setup lang="ts">
import { ref, watch, onBeforeUnmount, useId } from 'vue';
import { Search, X } from '@lucide/vue';
import type { Instansi } from '../../types/domain';

const props = defineProps<{
  search: (text: string) => Promise<Instansi[]>;
  context: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();
const uid = useId();
const input = ref<HTMLInputElement | null>(null);
const text = ref('');
const results = ref<Instansi[]>([]);
const loading = ref(false);
const message = ref('');
const open = ref(false);
const active = ref(-1);
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
function cancel() {
  ++generation;
  clearTimeout(timer);
  loading.value = false;
}
function dismiss() {
  cancel();
  open.value = false;
  active.value = -1;
}
function clear() {
  text.value = '';
  dismiss();
  results.value = [];
  input.value?.focus();
}
function run() {
  cancel();
  results.value = [];
  active.value = -1;
  message.value = '';
  const term = text.value.trim();
  open.value = Boolean(term);
  if (!term) return;
  loading.value = true;
  const request = generation;
  timer = setTimeout(async () => {
    try {
      const items = await props.search(term);
      if (request !== generation) return;
      results.value = [...new Map(items.map(item => [item.id, item])).values()]
        .filter(item => item.name.toLocaleLowerCase('id').includes(term.toLocaleLowerCase('id')))
        .slice(0, 8);
      message.value = results.value.length ? `${results.value.length} hasil. Gunakan panah atas/bawah dan Enter.` : 'Instansi tidak ditemukan dalam dataset ini.';
    } catch {
      if (request !== generation) return;
      message.value = 'Pencarian gagal. Ketik ulang atau fokuskan pencarian untuk mencoba lagi.';
    } finally {
      if (request === generation) loading.value = false;
    }
  }, 200);
}
watch(text, run, { flush: 'sync' });
watch(() => props.context, clear);
function choose(item: Instansi) {
  dismiss();
  emit('select', item.id);
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    if (!open.value) { run(); return; }
    if (!results.value.length) return;
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length;
    document.getElementById(`${uid}-option-${active.value}`)?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter' && open.value && !loading.value) {
    const item = results.value[active.value < 0 ? 0 : active.value];
    if (item) { event.preventDefault(); choose(item); }
  }
}
function blur(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dismiss();
}
onBeforeUnmount(cancel);
</script>
<template>
  <div class="global-search" @focusout="blur">
    <label class="sr-only" :for="`${uid}-input`">Cari instansi seluruh wilayah</label>
    <div class="global-search-field">
      <Search :size="18" aria-hidden="true" />
      <input
        :id="`${uid}-input`" ref="input" v-model="text" type="text" role="combobox"
        autocomplete="off" maxlength="120" placeholder="Cari instansi…"
        aria-autocomplete="list" :aria-expanded="open" :aria-controls="`${uid}-results`"
        :aria-activedescendant="open && active >= 0 ? `${uid}-option-${active}` : undefined"
        :aria-describedby="`${uid}-status`" @keydown="keyboard" @focus="run"
      />
      <button v-if="text" type="button" aria-label="Hapus pencarian" @click="clear"><X :size="17" /></button>
    </div>
    <div v-if="open" class="global-search-dropdown">
      <p class="global-search-hint">Seluruh wilayah · dataset aktif</p>
      <ul :id="`${uid}-results`" role="listbox" aria-label="Hasil pencarian instansi" :aria-busy="loading">
        <li
v-for="(item, index) in results" :id="`${uid}-option-${index}`" :key="item.id"
          role="option" :aria-selected="active === index" :class="{ active: active === index }"
          @pointerdown.prevent @click="choose(item)" @pointermove="active = index"
>
          <strong>{{ item.name }}</strong>
          <span>{{ [item.kabKotaName, item.provinceName].filter(Boolean).join(' · ') || 'Wilayah belum tersedia' }}</span>
          <small v-if="!item.coordinates">Tanpa pin · buka detail</small>
        </li>
      </ul>
    </div>
    <p :id="`${uid}-status`" role="status" :class="open ? 'global-search-status' : 'sr-only'">
      {{ open ? (loading ? 'Mencari instansi…' : message) : '' }}
    </p>
  </div>
</template>
