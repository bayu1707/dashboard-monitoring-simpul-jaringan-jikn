<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { useRuntimeConfig } from '#app';
import { useInstansiRepository } from '../../composables/useInstansiRepository';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type {
  Bounds,
  Coordinates,
  ExplorationState,
  Instansi,
  InstansiDetail,
  MapSession,
  ReferenceData,
  Wilayah,
} from '../../types/domain';
import { bindRegionTooltip } from './regionTooltip';
import { regionSummaries } from '../../services/regionSummaries';
import InstansiPopup from '../instansi/InstansiPopup.vue';
import { installMapZoomControls } from './installMapZoomControls';

const props = defineProps<{
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  allItems: Instansi[];
  detail: InstansiDetail | null;
  previewFromList: boolean;
  demo: boolean;
  pilot: boolean;
  search: string;
  touch: boolean;
  initialSession: MapSession | null;
  resetEpoch: number;
  revealTarget?: { id: string; request: number } | null;
}>();
const emit = defineEmits<{
  region: [region: Wilayah];
  revealed: [id: string, element: HTMLElement | null];
  preview: [id: string, element: HTMLElement | null];
  navigate: [id: string];
  enter: [];
  leave: [id?: string];
  close: [id?: string];
  reposition: [moving: boolean];
  viewport: [center: Coordinates, zoom: number];
  detail: [];
}>();

const NATIONAL_BOUNDS: Bounds = [
  [-11.007552182999973, 94.97194993500005],
  [6.0767408680000585, 141.02004178900006],
];
const config = useRuntimeConfig();
const { repository } = useInstansiRepository();
const canvas = ref<HTMLElement | null>(null);
const tileFailed = ref(false);
const notice = ref<string | null>(null);
const geometryError = ref(false);
const hydratedRegions = shallowRef<Wilayah[]>([]);
const popupContainer = shallowRef<HTMLElement | null>(null);
let map: L.Map | null = null;
let tile: L.TileLayer | null = null;
let regionLayer: L.FeatureGroup | null = null;
let cluster: L.MarkerClusterGroup | null = null;
let popup: L.Popup | null = null;
let popupId: string | null = null;
let disposePopup: (() => void) | null = null;
let disposeZoom: (() => void) | null = null;
let mapResize: ResizeObserver | null = null;
let regionCleanups: (() => void)[] = [];
let geometryRequest = 0;
let popupRequest = 0;
let revealGeneration = 0;
let disposed = false;
const markers = new Map<string, L.Marker>();
let previousFocusKey = props.initialSession ? focusKey() : '';

const mapReferences = computed<ReferenceData>(() => ({
  ...props.references,
  kabKota: props.references.kabKota.map(
    (region) =>
      hydratedRegions.value.find((loaded) => loaded.id === region.id) ?? region,
  ),
}));
const summaries = computed(() =>
  regionSummaries(props.state, mapReferences.value, props.allItems),
);
const jenisName = computed(
  () =>
    props.references.jenisInstansi.find(
      (item) => item.id === props.detail?.instansi.jenisId,
    )?.name ?? null,
);
const sheetVisible = computed(
  () =>
    !!props.detail &&
    (props.touch ||
      props.previewFromList ||
      !props.detail.instansi.coordinates),
);
const overviewBounds = computed<Bounds>(() => {
  if (!props.pilot) return NATIONAL_BOUNDS;
  const values = props.references.provinces.flatMap((region) =>
    region.bounds ? [region.bounds] : [],
  );
  return values.length
    ? [
        [
          Math.min(...values.map((b) => b[0][0])),
          Math.min(...values.map((b) => b[0][1])),
        ],
        [
          Math.max(...values.map((b) => b[1][0])),
          Math.max(...values.map((b) => b[1][1])),
        ],
      ]
    : NATIONAL_BOUNDS;
});
function focusKey() {
  return `${props.state.provinceId ?? 'nasional'}:${props.state.kabKotaId ?? ''}:${props.resetEpoch}`;
}
function selectedRegion() {
  return props.state.kabKotaId
    ? mapReferences.value.kabKota.find((r) => r.id === props.state.kabKotaId)
    : mapReferences.value.provinces.find(
        (r) => r.id === props.state.provinceId,
      );
}
function getFocusBounds(): L.LatLngBounds | null {
  const sampleBounds =
    props.pilot && props.state.level === 'provinsi'
      ? mapReferences.value.kabKota
          .filter(
            (area) =>
              area.provinceId === props.state.provinceId &&
              props.items.some((item) => item.kabKotaId === area.id),
          )
          .flatMap((area) => (area.bounds ? [area.bounds] : []))
      : [];
  const bounds =
    props.state.level === 'nasional'
      ? overviewBounds.value
      : sampleBounds.length
        ? L.latLngBounds(sampleBounds.flatMap((value) => value))
        : selectedRegion()?.bounds;
  if (bounds)
    return bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
  const points = props.items.flatMap((item) =>
    item.coordinates ? [item.coordinates] : [],
  );
  return points.length ? L.latLngBounds(points) : null;
}
function updateZoomLimit() {
  if (!map) return;
  // Lepaskan limit lama sebelum menghitung bounds pada tingkat atau ukuran baru.
  map.setMinZoom(3);
  const bounds = getFocusBounds();
  if (props.state.level !== 'provinsi' || !bounds) return;
  const minimum = Math.max(
    3,
    Math.min(14, map.getBoundsZoom(bounds, false, L.point(48, 170))),
  );
  if (map.getZoom() < minimum) {
    map.stop();
    map.setZoom(minimum, { animate: false });
  }
  map.setMinZoom(minimum);
}
function focusScope() {
  if (!map) return;
  updateZoomLimit();
  const key = focusKey();
  if (previousFocusKey === key) return;
  previousFocusKey = key;
  const bounds = getFocusBounds();
  if (!bounds) {
    notice.value =
      'Batas wilayah dan titik hasil belum tersedia. Posisi peta dipertahankan; gunakan Daftar.';
    return;
  }
  map.fitBounds(bounds, {
    paddingTopLeft: [24, 110],
    paddingBottomRight: [24, 60],
    maxZoom: 14,
    animate: false,
  });
  notice.value =
    props.state.level !== 'nasional' && !selectedRegion()?.bounds
      ? 'Batas wilayah belum tersedia; peta difokuskan pada titik hasil yang valid.'
      : null;
}
function saveViewport() {
  if (!map) return;
  const center = map.getCenter();
  emit('viewport', [center.lat, center.lng], map.getZoom());
}
function addTile() {
  if (!map) return;
  tile?.off();
  tile?.remove();
  tileFailed.value = false;
  tile = L.tileLayer(
    String(
      config.public.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ),
    {
      attribution: String(
        config.public.tileAttribution ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ),
      opacity: 0.9,
      maxZoom: 19,
    },
  )
    .on('tileerror', () => {
      tileFailed.value = true;
    })
    .addTo(map);
}
function keyboardActivation(element: Element | null, action: () => void) {
  if (!element) return;
  const activate = (event: Event) => {
    if (
      !(event instanceof KeyboardEvent) ||
      !['Enter', ' '].includes(event.key) ||
      event.repeat
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  };
  element.addEventListener('keydown', activate);
  regionCleanups.push(() => element.removeEventListener('keydown', activate));
}
function renderRegions() {
  if (!map || !regionLayer) return;
  regionCleanups.forEach((cleanup) => cleanup());
  regionCleanups = [];
  regionLayer.eachLayer((layer) => layer.off());
  regionLayer.clearLayers();
  if (props.state.level === 'instansi') return;
  const regions =
    props.state.level === 'nasional'
      ? mapReferences.value.provinces
      : mapReferences.value.kabKota.filter(
          (r) => r.provinceId === props.state.provinceId,
        );
  for (const region of regions) {
    if (region.geometry) {
      const layer = L.geoJSON(region.geometry, {
        style: {
          color: '#5688ae',
          weight: props.pilot ? 0.8 : 2,
          opacity: props.pilot ? 0.35 : 1,
          fillColor: '#4d9cd4',
          fillOpacity: props.pilot ? 0.015 : 0.17,
        },
        onEachFeature: (_feature, path) => {
          bindRegionTooltip(path, region, props.allItems, map!, cleanup => regionCleanups.push(cleanup));
          path.on('click', () => emit('region', region));
          path.on('mouseover', () => {
            if (path instanceof L.Path)
              path.setStyle({
                fillOpacity: props.pilot ? 0.07 : 0.35,
                weight: props.pilot ? 1.2 : 3,
              });
          });
          path.on('mouseout', () => {
            if (path instanceof L.Path)
              path.setStyle({
                fillOpacity: props.pilot ? 0.015 : 0.17,
                weight: props.pilot ? 0.8 : 2,
              });
          });
          path.on('add', () => {
            if (!(path instanceof L.Path)) return;
            const element = path.getElement();
            element?.setAttribute('data-region-id', region.id);
            element?.setAttribute('aria-label', `Pilih ${region.name}`);
            element?.setAttribute('role', 'button');
            element?.setAttribute('tabindex', '0');
            keyboardActivation(element ?? null, () => emit('region', region));
          });
        },
      });
      regionLayer.addLayer(layer);
    } else if (
      region.labelPosition &&
      !summaries.value.some((item) => item.region.id === region.id)
    ) {
      const marker = L.marker(region.labelPosition, {
        icon: L.divIcon({
          className: 'region-pointer',
          html: '<span>↗</span>',
          iconSize: [36, 36],
        }),
        title: `Pilih ${region.name}`,
        alt: `Pilih ${region.name}`,
      }).on('click', () => emit('region', region));
      bindRegionTooltip(marker, region, props.allItems, map, cleanup => regionCleanups.push(cleanup));
      regionLayer.addLayer(marker);
    }
  }
  for (const summary of summaries.value) {
    const { region, count } = summary;
    if (!region.labelPosition) continue;
    const caption = `${region.name} · ${count} instansi${props.pilot ? ' percontohan' : ' unik dalam snapshot'}`;
    const label = `${caption}. Klik untuk membuka ${region.level === 'province' ? 'kabupaten/kota' : 'instansi'}.`;
    const outer = document.createElement('div');
    const badge = document.createElement('div');
    badge.className = 'region-count-label';
    const number = document.createElement('span');
    number.className = `region-count-circle ${count < 10 ? 'region-count-small' : count < 100 ? 'region-count-medium' : 'region-count-large'}`;
    number.textContent = String(count);
    badge.append(number);
    if (!props.pilot) {
      const name = document.createElement('span');
      name.className = 'region-count-caption';
      name.textContent = region.name;
      badge.append(name);
    }
    outer.append(badge);
    // Tidak ada pergeseran collision: pusat badge selalu tepat pada koordinat referensi.
    const marker = L.marker(region.labelPosition, {
      icon: L.divIcon({
        className: `region-count-marker${props.pilot ? ' region-count-compact' : ''}`,
        html: outer,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        tooltipAnchor: [0, 0],
      }),
      keyboard: true,
      riseOnHover: true,
      title: label,
      alt: label,
    }).on('click', () => emit('region', region));
    bindRegionTooltip(marker, region, props.allItems, map, cleanup => regionCleanups.push(cleanup));
    marker.on('add', () => {
      const element = marker.getElement();
      element?.setAttribute('data-region-count-id', region.id);
      element?.setAttribute('data-region-count-kind', 'region');
      element?.setAttribute('aria-label', label);
      element?.setAttribute('role', 'button');
      if (props.pilot) element?.removeAttribute('title');
      keyboardActivation(element ?? null, () => emit('region', region));
    });
    regionLayer.addLayer(marker);
  }
}
async function loadGeometry() {
  const request = ++geometryRequest;
  geometryError.value = false;
  hydratedRegions.value = [];
  const id = props.state.provinceId;
  if (!id || props.state.level === 'nasional' || !repository.getKabKotaGeometry)
    return;
  try {
    const regions = await repository.getKabKotaGeometry(id);
    if (disposed || request !== geometryRequest) return;
    hydratedRegions.value = regions;
  } catch {
    if (!disposed && request === geometryRequest) geometryError.value = true;
  }
}
function clearPopup() {
  ++popupRequest;
  disposePopup?.();
  disposePopup = null;
  popup = null;
  popupId = null;
  popupContainer.value = null;
}
function clearCluster() {
  ++revealGeneration;
  clearPopup();
  if (!cluster) return;
  cluster.eachLayer((layer) => layer.off());
  cluster.off();
  cluster.remove();
  cluster.clearLayers();
  cluster = null;
  markers.clear();
}
function renderMarkers() {
  if (!map) return;
  clearCluster();
  if (props.state.level !== 'instansi') return;
  cluster = L.markerClusterGroup({
    maxClusterRadius: 52,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    showCoverageOnHover: false,
    animate: false,
    iconCreateFunction(group) {
      const n = new Set(
        group.getAllChildMarkers().map((marker) => marker.options.title),
      ).size;
      return L.divIcon({
        className: `instansi-cluster ${n < 10 ? 'cluster-small' : n < 100 ? 'cluster-medium' : 'cluster-large'}`,
        html: `<span aria-label="${n} instansi terpetakan">${n}</span>`,
        iconSize: [50, 50],
      });
    },
  });
  const unique = new Map(props.items.map((item) => [item.id, item]));
  for (const item of unique.values()) {
    if (!item.coordinates) continue;
    const marker = L.marker(item.coordinates, {
      icon: L.divIcon({
        className: 'instansi-marker',
        html: '<span class="marker-pin"></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -44],
      }),
      title: item.id,
      alt: item.name,
      keyboard: true,
      riseOnHover: true,
    });
    marker.on('add', () => {
      const element = marker.getElement();
      element?.setAttribute('aria-label', item.name);
      element?.setAttribute('data-instansi-id', item.id);
      element?.setAttribute('role', 'button');
      element?.removeAttribute('title');
    });
    marker.on('mouseover', () => {
      if (props.touch) return;
      emit('enter');
      emit('preview', item.id, marker.getElement() ?? null);
    });
    marker.on('mouseout', () => {
      if (!props.touch) emit('leave', item.id);
    });
    marker.on('click', () => {
      if (props.touch) emit('preview', item.id, marker.getElement() ?? null);
      else emit('navigate', item.id);
    });
    markers.set(item.id, marker);
    cluster.addLayer(marker);
  }
  map.addLayer(cluster);
  void syncPopup();
}
// Sesudah render Vue: watcher cakupan sudah membentuk layer marker terbaru.
function revealSearchTarget() {
  const request = ++revealGeneration;
  const target = props.revealTarget;
  const marker = target && markers.get(target.id);
  if (!map || !cluster || !target || !marker) return;
  const activeMap = map;
  const group = cluster;
  activeMap.stop();
  activeMap.setView(marker.getLatLng(), Math.max(15, activeMap.getZoom()), { animate: false });
  // Callback plugin memastikan marker terlihat setelah zoom/spiderfy, tanpa timer tebakan.
  const current = () => !disposed && request === revealGeneration && group === cluster &&
    props.revealTarget?.request === target.request && markers.get(target.id) === marker;
  const finish = async () => {
    // Plugin bisa memanggil callback saat zoomend masih diproses. Tunggu semua
    // handler selesai: handler zoomend berikutnya dapat membatalkan spiderfy awal.
    await nextTick();
    if (!current()) return;
    if (!activeMap.hasLayer(marker)) {
      const parent = group.getVisibleParent(marker);
      if (parent instanceof L.MarkerCluster) parent.spiderfy();
    }
    if (activeMap.hasLayer(marker))
      emit('revealed', target.id, marker.getElement() ?? null);
  };
  group.zoomToShowLayer(marker, () => { void finish(); });
}
watch(() => props.revealTarget, revealSearchTarget, { flush: 'post' });

async function syncPopup() {
  if (!map) return;
  const detail = props.detail;
  const id = detail?.instansi.id;
  const native =
    detail &&
    !props.touch &&
    !props.previewFromList &&
    detail.instansi.coordinates;
  if (!native || !id) {
    clearPopup();
    return;
  }
  if (popupId === id && popup) {
    await nextTick();
    popup?.update();
    return;
  }
  clearPopup();
  const marker = markers.get(id);
  if (!marker || !map.hasLayer(marker)) {
    emit('close', id);
    return;
  }
  const request = popupRequest;
  const content = document.createElement('div');
  popupContainer.value = content;
  await nextTick();
  if (disposed || request !== popupRequest || !map) return;
  let autoPanning = false;
  let awaitingPointer = false;
  let inactive = false;
  let pointerDuringPan: { x: number; y: number } | null = null;
  const activeMap = map;
  const nativePopup = L.popup(
    {
      className: 'instansi-leaflet-popup',
      closeButton: false,
      closeOnEscapeKey: false,
      offset: [0, 0],
      autoPan: true,
      autoPanPaddingTopLeft: [24, 150],
      autoPanPaddingBottomRight: [24, 65],
    },
    marker,
  )
    .setLatLng(marker.getLatLng())
    .setContent(content);
  const enter = () => emit('enter');
  const leave = () => {
    if (!nativePopup.getElement()?.contains(document.activeElement))
      emit('leave', id);
  };
  const focusOut = (event: FocusEvent) => {
    const element = nativePopup.getElement();
    if (
      element &&
      !element.contains(event.relatedTarget as Node | null) &&
      !element.matches(':hover')
    )
      emit('leave', id);
  };
  const onAutoPan = () => {
    autoPanning = true;
    pointerDuringPan = null;
    awaitingPointer = true;
    emit('reposition', true);
  };
  const resumePointer = (target: Node | null) => {
    awaitingPointer = false;
    emit('reposition', false);
    if (
      nativePopup.getElement()?.contains(target) ||
      marker.getElement()?.contains(target)
    )
      enter();
    else leave();
  };
  const onMoveEnd = () => {
    autoPanning = false;
    if (awaitingPointer && pointerDuringPan) {
      resumePointer(
        document.elementFromPoint(pointerDuringPan.x, pointerDuringPan.y),
      );
      pointerDuringPan = null;
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!awaitingPointer) return;
    if (autoPanning) {
      pointerDuringPan = { x: event.clientX, y: event.clientY };
      return;
    }
    resumePointer(event.target as Node | null);
  };
  const followMarker = () => nativePopup.setLatLng(marker.getLatLng());
  const closeRemoved = () => {
    if (!inactive) emit('close', id);
  };
  const update = () => nativePopup.update();
  activeMap.on('autopanstart', onAutoPan);
  activeMap.on('moveend', onMoveEnd);
  activeMap.on('resize', update);
  marker.on('move', followMarker);
  marker.on('remove', closeRemoved);
  nativePopup.on('remove', closeRemoved);
  document.addEventListener('pointermove', onPointerMove);
  nativePopup.openOn(activeMap);
  const element = nativePopup.getElement();
  element?.addEventListener('pointerenter', enter);
  element?.addEventListener('pointerleave', leave);
  element?.addEventListener('focusin', enter);
  element?.addEventListener('focusout', focusOut);
  const resize = new ResizeObserver(update);
  resize.observe(content);
  popup = nativePopup;
  popupId = id;
  disposePopup = () => {
    inactive = true;
    resize.disconnect();
    element?.removeEventListener('pointerenter', enter);
    element?.removeEventListener('pointerleave', leave);
    element?.removeEventListener('focusin', enter);
    element?.removeEventListener('focusout', focusOut);
    document.removeEventListener('pointermove', onPointerMove);
    activeMap.off('autopanstart', onAutoPan);
    activeMap.off('moveend', onMoveEnd);
    activeMap.off('resize', update);
    marker.off('move', followMarker);
    marker.off('remove', closeRemoved);
    nativePopup.off('remove', closeRemoved);
    nativePopup.remove();
    // Lepas DOM langsung: fade Leaflet tidak boleh menahan pointer pada popup lama.
    element?.remove();
    emit('reposition', false);
  };
}

watch(
  () =>
    [
      props.state.level,
      props.state.provinceId,
      props.state.kabKotaId,
      props.resetEpoch,
    ] as const,
  () => {
    if (!map) return;
    clearPopup();
    renderRegions();
    renderMarkers();
    focusScope();
    void loadGeometry();
  },
);
watch(
  () => props.items,
  () => {
    if (map) {
      renderMarkers();
      focusScope();
    }
  },
);
watch([mapReferences, () => props.allItems], () => {
  if (map) renderRegions();
});
watch(
  () => [props.detail, props.touch, props.previewFromList] as const,
  () => {
    void syncPopup();
  },
);

onMounted(async () => {
  // Nuxt .client menampilkan template setelah wrapper mounted$. Tunggu ref DOM-nya.
  await nextTick();
  if (disposed || !canvas.value) return;
  map = L.map(canvas.value, {
    zoomControl: false,
    zoomAnimation: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    minZoom: 3,
    maxZoom: 19,
    scrollWheelZoom: false,
    doubleClickZoom: false,
  });
  if (props.initialSession)
    map.setView(props.initialSession.center, props.initialSession.zoom, {
      animate: false,
    });
  else map.fitBounds(overviewBounds.value, { animate: false });
  regionLayer = L.featureGroup().addTo(map);
  addTile();
  disposeZoom = installMapZoomControls(map);
  map.on('moveend', saveViewport);
  map.on('resize', updateZoomLimit);
  mapResize = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
  mapResize.observe(canvas.value);
  renderRegions();
  renderMarkers();
  focusScope();
  saveViewport();
  revealSearchTarget();
  void loadGeometry();
});
onBeforeUnmount(() => {
  disposed = true;
  ++geometryRequest;
  clearCluster();
  regionCleanups.forEach((cleanup) => cleanup());
  regionCleanups = [];
  mapResize?.disconnect();
  disposeZoom?.();
  map?.off('moveend', saveViewport);
  map?.off('resize', updateZoomLimit);
  tile?.off();
  regionLayer?.eachLayer((layer) => layer.off());
  map?.remove();
  map = null;
});
</script>

<template>
  <div ref="canvas" class="map-canvas" aria-label="Peta Simpul Jaringan JIKN" />
  <div v-if="tileFailed" class="tile-error" role="status">
    Peta dasar belum dapat dimuat. Wilayah dan daftar tetap tersedia.
    <button type="button" @click="addTile">Coba muat peta dasar lagi</button>
  </div>
  <span v-if="notice" class="viewport-note map-viewport-note" role="status">{{
    notice
  }}</span>
  <span
    v-if="geometryError"
    class="viewport-note map-viewport-note"
    role="status"
  >
    Batas kabupaten/kota belum dapat dimuat. Badge dan Daftar tetap tersedia.
    <button type="button" @click="loadGeometry">Coba muat batas lagi</button>
  </span>
  <Teleport v-if="popupContainer && detail" :to="popupContainer">
    <InstansiPopup
      :detail="detail"
      :demo="demo"
      :search="search"
      :jenis-name="jenisName"
      @close="emit('close', detail.instansi.id)"
      @detail="emit('detail')"
    />
  </Teleport>
  <div
    v-if="sheetVisible && detail"
    :class="[
      'mobile-popup',
      { 'list-profile-popup': previewFromList && !touch },
    ]"
    role="dialog"
    aria-modal="false"
    aria-label="Pratinjau instansi"
  >
    <InstansiPopup
      :detail="detail"
      :demo="demo"
      :search="search"
      :jenis-name="jenisName"
      @close="emit('close', detail.instansi.id)"
      @detail="emit('detail')"
      @enter="emit('enter')"
      @leave="!touch && emit('leave', detail.instansi.id)"
    />
  </div>
</template>
