<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  watch,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import { ArrowLeft, Globe2, MapPin } from '@lucide/vue';
import type {
  Coordinates,
  ExplorationState,
  InstansiDetail,
  MapSession,
  Wilayah,
} from '../../types/domain';
import {
  canPreviewInstansi,
  countInstansi,
  explorationToQuery,
  filterInstansi,
  goNational,
  goProvince,
  parseExplorationQuery,
  selectKabKota,
  selectProvince,
} from '../../services/exploration';
import { readMapSession, saveMapSession } from '../../services/session';
import DataState from '../../components/layout/DataState.vue';
import MapFilters from '../../components/map/MapFilters.vue';
import GlobalInstansiSearch from '../../components/map/GlobalInstansiSearch.vue';
import ResultsList from '../../components/map/ResultsList.vue';
import { useMediaQuery } from '../../composables/useMediaQuery';
const { repository, mode, demo } = useInstansiRepository();
const route = useRoute();
const router = useRouter();
const { data, error, status, refresh } = await useAsyncData(
  `map-data:${mode.value}`,
  async () => {
    const [references, result] = await Promise.all([
      repository.getReferenceData(),
      repository.listInstansi(),
    ]);
    return { references, items: result.items, metadata: result.metadata };
  },
);
const params = computed(
  () => new URLSearchParams(route.fullPath.split('?')[1]?.split('#')[0] ?? ''),
);
// Mode uji memakai katalog/pin pilot yang sama, dengan label sumber tersendiri.
const compactMap = computed(() =>
  ['pilot', 'database', 'development'].includes(data.value?.metadata.datasetKind ?? ''),
);
const state = computed<ExplorationState>(() =>
  data.value
    ? parseExplorationQuery(params.value, data.value.references)
    : goNational(),
);
const listMode = computed(() =>
  params.value.get('daftar') === 'instansi'
    ? 'instansi'
    : params.value.get('daftar') === 'belum-terpetakan'
      ? 'belum-terpetakan'
      : 'wilayah',
);
const listSearch = computed(() =>
  (params.value.get('cari') ?? '').slice(0, 120),
);
function queryForState(next: ExplorationState) {
  const value = new URLSearchParams(explorationToQuery(next, demo.value));
  if (mode.value === 'excel' || mode.value === 'sikn' || mode.value === 'dev')
    value.set('data', mode.value);
  return value;
}
const query = computed(() => {
  const value = queryForState(state.value);
  if (listMode.value !== 'wilayah') value.set('daftar', listMode.value);
  if (listSearch.value) value.set('cari', listSearch.value);
  return value.size ? `?${value}` : '';
});
const items = computed(() =>
  filterInstansi(data.value?.items ?? [], state.value),
);
const counts = computed(() => countInstansi(items.value));
const province = computed(() =>
  data.value?.references.provinces.find(
    (item) => item.id === state.value.provinceId,
  ),
);
const kabKota = computed(() =>
  data.value?.references.kabKota.find(
    (item) => item.id === state.value.kabKotaId,
  ),
);
const canPreview = computed(() =>
  data.value ? canPreviewInstansi(state.value, data.value.references) : false,
);
const touch = useMediaQuery('(max-width: 767px), (hover: none)');
const mounted = ref(false);
const initialSession = shallowRef<MapSession | null>(null);
const listOpen = ref(listMode.value !== 'wilayah');
const restoredScroll = ref(0);
const resetEpoch = ref(0);
const revealTarget = shallowRef<{ id: string; request: number } | null>(null);
let searchSelection = 0;
const selection = shallowRef<{
  id: string;
  query: string;
  fromList: boolean;
} | null>(null);
const preview = shallowRef<{
  id: string;
  detail: InstansiDetail | null;
  error: string | null;
} | null>(null);
let listScroll = 0;
let viewport: { center: Coordinates; zoom: number } | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let origin: HTMLElement | null = null;
let restoringFocus = false;
let repositioning = false;
let previewGeneration = 0;
let leavingDetailId: string | undefined;
const activeId = computed(() =>
  (canPreview.value || selection.value?.fromList) &&
  selection.value?.query === query.value &&
  items.value.some((item) => item.id === selection.value?.id)
    ? (selection.value?.id ?? null)
    : null,
);
const detail = computed(() =>
  preview.value?.id === activeId.value ? (preview.value?.detail ?? null) : null,
);
const previewError = computed(() =>
  preview.value?.id === activeId.value ? (preview.value?.error ?? null) : null,
);
const snapshotTime = computed(() =>
  data.value
    ? new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(data.value.metadata.capturedAt))
    : '',
);
function popupHasInteraction() {
  return Boolean(
    document.querySelector(
      '.instansi-leaflet-popup:hover, .instansi-popup:hover',
    ) || document.activeElement?.closest('.instansi-popup'),
  );
}
function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}
function close(id?: string) {
  cancelClose();
  if (!id || selection.value?.id === id) selection.value = null;
  if (!id) {
    restoringFocus = true;
    try {
      origin?.focus({ preventScroll: true });
    } finally {
      restoringFocus = false;
    }
  }
}
function scheduleClose(id = activeId.value ?? undefined) {
  if (!id || id !== activeId.value || popupHasInteraction()) return;
  cancelClose();
  if (!touch.value && !repositioning) {
    const owner = selection.value;
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (!popupHasInteraction() && selection.value === owner)
        selection.value = null;
    }, 200);
  }
}
function reposition(moving: boolean) {
  repositioning = moving;
  if (moving) cancelClose();
}
function persist(detailId?: string) {
  if (detailId) leavingDetailId = detailId;
  if (viewport && data.value)
    saveMapSession({
      datasetKind: data.value.metadata.datasetKind,
      query: query.value,
      ...viewport,
      listScroll,
      listOpen: listOpen.value,
      detailId: detailId ?? leavingDetailId,
    });
}
function updateViewport(center: Coordinates, zoom: number) {
  viewport = { center, zoom };
  persist();
}
function previewInstansi(
  id: string,
  element: HTMLElement | null,
  fromList = false,
) {
  if (restoringFocus || (element && !fromList && !canPreview.value)) return;
  cancelClose();
  origin =
    element ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  const isList = fromList || !element;
  if (
    selection.value?.id !== id ||
    selection.value.query !== query.value ||
    selection.value.fromList !== isList
  )
    selection.value = { id, query: query.value, fromList: isList };
}
async function loadPreview(id: string | null) {
  const generation = ++previewGeneration;
  if (!id) {
    preview.value = null;
    return;
  }
  preview.value = { id, detail: null, error: null };
  try {
    const result = await repository.getInstansiDetail(id);
    if (generation === previewGeneration && activeId.value === id)
      preview.value = {
        id,
        detail: result,
        error: result ? null : 'Instansi tidak ditemukan dalam snapshot.',
      };
  } catch (reason) {
    if (generation === previewGeneration && activeId.value === id)
      preview.value = {
        id,
        detail: null,
        error:
          reason instanceof Error ? reason.message : 'Profil gagal dimuat.',
      };
  }
}
watch(activeId, (id) => {
  void loadPreview(id);
});
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeId.value) {
    event.preventDefault();
    close();
  }
}
function navigateQuery(value: URLSearchParams, replace = false) {
  const target = `/simpul-jaringan${value.size ? `?${value}` : ''}`;
  return replace ? router.replace(target) : router.push(target);
}
function apply(next: ExplorationState) {
  ++searchSelection;
  revealTarget.value = null;
  cancelClose();
  selection.value = null;
  listScroll = 0;
  restoredScroll.value = 0;
  void navigateQuery(queryForState(next));
}
function chooseRegion(region: Wilayah) {
  if (data.value)
    apply(
      region.level === 'province'
        ? selectProvince(state.value, region.id, data.value.references)
        : selectKabKota(state.value, region.id, data.value.references),
    );
}
function reset() {
  apply(goNational());
  resetEpoch.value++;
  listOpen.value = false;
  listScroll = 0;
}
function toggleList() {
  if (!listOpen.value) restoredScroll.value = listScroll;
  listOpen.value = !listOpen.value;
  persist();
}
function scrollList(top: number) {
  listScroll = top;
  persist();
}
function catalogChange(
  value: 'wilayah' | 'instansi' | 'belum-terpetakan',
  text: string,
) {
  cancelClose();
  selection.value = null;
  const next = queryForState(state.value);
  if (value !== 'wilayah') next.set('daftar', value);
  if (text) next.set('cari', text.slice(0, 120));
  listScroll = 0;
  restoredScroll.value = 0;
  void navigateQuery(next, true);
}
function showUnmapped() {
  cancelClose();
  selection.value = null;
  listScroll = 0;
  restoredScroll.value = 0;
  listOpen.value = true;
  const next = queryForState(goNational());
  next.set('daftar', 'belum-terpetakan');
  void navigateQuery(next);
}
async function searchGlobal(text: string) {
  return (await repository.listInstansi({ search: text })).items;
}
async function chooseSearchResult(id: string) {
  const item = data.value?.items.find(value => value.id === id);
  if (!item || !data.value) return;
  const request = ++searchSelection;
  cancelClose();
  selection.value = null;
  revealTarget.value = null;
  // Navigasi memakai pasangan ID wilayah yang telah tervalidasi, bukan nama.
  const next = selectKabKota(
    selectProvince(goNational(), item.provinceId, data.value.references),
    item.kabKotaId, data.value.references,
  );
  if (!item.coordinates || !canPreviewInstansi(next, data.value.references)) {
    openDetail(id);
    return;
  }
  const target = queryForState(next);
  listScroll = 0;
  restoredScroll.value = 0;
  listOpen.value = false;
  await navigateQuery(target);
  await nextTick();
  if (request !== searchSelection || query.value !== `?${target}`) return;
  revealTarget.value = { id, request };
}
function revealed(id: string, element: HTMLElement | null) {
  if (revealTarget.value?.id !== id) return;
  revealTarget.value = null;
  previewInstansi(id, element, false);
}
function openDetail(id: string) {
  cancelClose();
  persist(id);
  void router.push(`/simpul-jaringan/${encodeURIComponent(id)}${query.value}`);
}
onMounted(() => {
  initialSession.value = readMapSession(
    query.value,
    data.value?.metadata.datasetKind,
  );
  if (initialSession.value) {
    viewport = {
      center: initialSession.value.center,
      zoom: initialSession.value.zoom,
    };
    listOpen.value = initialSession.value.listOpen;
    listScroll = initialSession.value.listScroll;
    restoredScroll.value = listScroll;
  }
  document.addEventListener('keydown', escape);
  mounted.value = true;
  if (data.value && route.fullPath !== `/simpul-jaringan${query.value}`)
    void router.replace(`/simpul-jaringan${query.value}`);
});
watch(query, () => {
  revealTarget.value = null;
  cancelClose();
  selection.value = null;
  if (
    mounted.value &&
    data.value &&
    route.fullPath !== `/simpul-jaringan${query.value}`
  )
    void router.replace(`/simpul-jaringan${query.value}`);
});
onBeforeUnmount(() => {
  persist();
  cancelClose();
  previewGeneration++;
  ++searchSelection;
  document.removeEventListener('keydown', escape);
});
const developmentMessage = useDevelopmentRefresh(
  computed(() => mode.value === 'dev'), computed(() => data.value?.metadata.id), async () => {
    const selected = selection.value ? { ...selection.value } : null;
    cancelClose();
    // Lepaskan popup lama sebelum layer marker dibangun dari revisi baru.
    // Jika tidak, syncPopup dapat menutup seleksi ketika marker masuk cluster lagi.
    selection.value = null;
    preview.value = null;
    ++previewGeneration;
    await refresh();
    await nextTick();
    if (selected) {
      const item = data.value?.items.find(value => value.id === selected.id);
      if (item?.coordinates && !selected.fromList && !touch.value)
        await chooseSearchResult(selected.id);
      else if (item)
        selection.value = { ...selected, query: query.value, fromList: true };
    }
  },
);
</script>
<template>
  <main
    v-if="status === 'pending' && !data"
    id="konten"
    tabindex="-1"
    class="page-loading"
  >
    <DataState
      title="Memuat peta simpul…"
      description="Membaca referensi wilayah dan snapshot melalui API Laravel."
    />
  </main>
  <main
    v-else-if="error || !data"
    id="konten"
    tabindex="-1"
    class="page-loading"
  >
    <DataState
      title="Data belum dapat dimuat"
      :description="error?.message ?? 'Sumber data tidak valid.'"
      retry
      @retry="refresh()"
    />
    <NuxtLink v-if="mode === 'sikn' || mode === 'dev'" to="/simpul-jaringan">Buka mode pilot</NuxtLink>
  </main>
  <main v-else id="konten" tabindex="-1" class="map-page">
    <div
      :class="[
        'map-stage',
        { 'pilot-map': compactMap },
      ]"
      :data-level="state.level"
    >
      <MapView
        v-if="mounted"
        :state="state"
        :references="data.references"
        :items="items"
        :all-items="data.items"
        :detail="detail"
        :preview-from-list="selection?.fromList ?? false"
        :demo="demo"
        :pilot="compactMap"
        :search="query"
        :touch="touch"
        :initial-session="initialSession"
        :reset-epoch="resetEpoch"
        :reveal-target="revealTarget"
        @revealed="revealed"
        @region="chooseRegion"
        @preview="previewInstansi"
        @navigate="openDetail"
        @enter="cancelClose"
        @leave="scheduleClose"
        @close="close"
        @reposition="reposition"
        @viewport="updateViewport"
        @detail="persist(activeId ?? undefined)"
      />
      <MapFilters
        :state="state"
        :references="data.references"
        :list-open="listOpen"
        @change="apply"
        @reset="reset"
        @list="toggleList"
      >
        <template #search>
          <GlobalInstansiSearch :search="searchGlobal" :context="`${mode}:${resetEpoch}`" @select="chooseSearchResult" />
        </template>
      </MapFilters>
      <div
        :class="[
          'map-navigation',
          { 'is-national': state.level === 'nasional' },
        ]"
      >
        <span class="sr-only">{{
          state.level === 'nasional'
            ? 'Peta nasional'
            : state.level === 'provinsi'
              ? 'Lapisan Kabupaten / Kota'
              : 'Lapisan Instansi'
        }}</span>
        <div class="map-scope-header">
          <MapPin :size="17" aria-hidden="true" />
          <h1>
            {{
              kabKota?.name ??
              (province
                ? compactMap
                  ? province.name
                  : `Kabupaten / Kota di ${province.name}`
                : 'Simpul Jaringan Indonesia')
            }}
          </h1>
          <div class="map-level-actions">
            <button
              v-if="state.level === 'instansi'"
              class="back-level"
              aria-label="Kembali ke Provinsi"
              title="Kembali ke Provinsi"
              @click="apply(goProvince(state))"
            >
              <ArrowLeft :size="18" /><span class="sr-only">Kembali ke Provinsi</span>
</button><button
              v-if="state.level !== 'nasional'"
              class="back-level"
              aria-label="Kembali ke Nasional"
              title="Kembali ke Nasional"
              @click="apply(goNational())"
            >
              <Globe2 :size="18" /><span class="sr-only">Kembali ke Nasional</span>
            </button>
          </div>
        </div>
        <p
          :class="
            compactMap && state.level !== 'instansi'
              ? 'sr-only'
              : undefined
          "
        >
          <template v-if="state.level === 'nasional'">
{{
            compactMap
              ? 'Klik provinsi untuk mulai.'
              : `Klik provinsi atau buka Daftar${data.items.length ? ` · ${counts.total} instansi dalam snapshot` : ''}.`
          }}
</template><template v-else-if="state.level === 'provinsi'">
Klik kabupaten/kota untuk membuka titik instansi.<template
              v-if="!compactMap"
            >
              {{ counts.total }} instansi dalam cakupan snapshot; buka
              Daftar.
</template>
</template><template v-else>
{{ counts.total }} hasil · {{ counts.mapped }} terpetakan ·
            {{ counts.unmapped }} tanpa koordinat{{
              demo ? ' (demo)' : ''
            }}
</template>
        </p>
      </div>
      <ResultsList
        v-if="listOpen"
        :state="state"
        :references="data.references"
        :items="items"
        :search="query"
        :initial-scroll="restoredScroll"
        :demo="demo"
        :mode="listMode"
        :search-text="listSearch"
        @region="chooseRegion"
        @preview="(id, element) => previewInstansi(id, element, true)"
        @close="toggleList"
        @detail="persist"
        @scroll="scrollList"
        @catalog-change="catalogChange"
      />
      <div v-if="!data.items.length" class="map-empty-notice" role="status">
        <h2>Data simpul belum dimuat</h2>
        <p>
          Snapshot instansi belum tersedia. Referensi wilayah dapat dijelajahi
          melalui peta dan Daftar.
        </p>
        <NuxtLink to="/simpul-jaringan?demo=1">
Coba interaksi dengan DATA DEMO →
</NuxtLink>
      </div>
      <div
        v-else-if="state.level === 'instansi' && !items.length"
        class="map-empty-notice"
        role="status"
      >
        <h2>Hasil filter kosong</h2>
        <p>
          Belum ada instansi dalam cakupan yang dipilih. Ganti wilayah atau
          gunakan Semua Jenis.
        </p>
      </div>
      <div
        v-else-if="
          state.level === 'instansi' &&
          counts.total > 0 &&
          !counts.mapped &&
          !listOpen
        "
        class="map-empty-notice"
        role="status"
      >
        <h2>Titik instansi belum tersedia</h2>
        <p>
          Data instansi sudah dimuat, tetapi koordinat kantornya belum tersedia.
          Marker dan popup hover akan tampil setelah koordinat terverifikasi
          ditambahkan.
        </p>
        <button class="text-button" @click="toggleList">
          Buka daftar instansi
        </button>
      </div>
      <div v-if="previewError" class="map-empty-notice">
        <DataState
          title="Profil gagal dimuat"
          :description="previewError"
          compact
          retry
          @retry="loadPreview(activeId)"
        />
      </div>
      <div
        v-if="data.items.length && !compactMap"
        class="region-summary-legend"
      >
        <span>Angka menunjukkan jumlah instansi per wilayah.</span><button
          v-if="
            state.level === 'nasional' &&
            data.items.some((item) => item.provinceId === null)
          "
          class="text-button"
          @click="showUnmapped"
        >
          {{
            countInstansi(data.items.filter((item) => item.provinceId === null))
              .total
          }}
          belum terpetakan
        </button>
      </div>
      <div class="map-footer">
        <NuxtLink v-if="mode === 'dev'" to="/pengujian?data=dev" class="snapshot-note" :title="developmentMessage">Kelola DATA UJI</NuxtLink>
        <span
          class="snapshot-note"
          :title="`${data.metadata.coverageDescription ?? `Cakupan snapshot ${data.metadata.coverage}`}; bukan pemantauan real time.`"
          ><template v-if="data.metadata.datasetKind === 'pilot'">{{ data.items.length }} instansi percontohan · DATA SIMULASI<span
              class="sr-only"
            >
              · Nama/tahun: Excel · Lokasi: sumber publik per record · Angka
              lingkaran: jumlah instansi per wilayah.</span></template><template v-else>{{
              data.metadata.datasetKind === 'excel'
                ? 'Snapshot Excel · '
                : data.metadata.datasetKind === 'database'
                  ? 'UJI LOKAL · Database SIKN Maret 2026 · '
                  : data.metadata.datasetKind === 'development'
                    ? 'DATA UJI · PostgreSQL development · '
                    : 'Snapshot '
            }}{{ snapshotTime }} WIB{{
              demo ? ' · sintetis' : ' · bukan real time'
            }}</template></span><span
          class="map-source-note"
          :title="data.references.metadata.verificationNotes.join(' ')"
          >{{ data.references.provinces.length }} provinsi ·
          {{ data.references.kabKota.length }} kab/kota{{
            data.metadata.datasetKind === 'pilot'
              ? ` · ${data.items.length} instansi percontohan`
              : ' · referensi wilayah'
          }}</span><NuxtLink v-if="demo" class="demo-exit" to="/simpul-jaringan">
Keluar demo
</NuxtLink>
      </div>
    </div>
  </main>
</template>
