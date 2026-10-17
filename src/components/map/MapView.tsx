import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
} from 'react-leaflet';
import L from 'leaflet';
import type {
  ExplorationState,
  Instansi,
  InstansiDetail,
  MapSession,
  ReferenceData,
  Wilayah,
  Coordinates,
  Bounds,
} from '../../types/domain';
import { NATIONAL_BOUNDS, tileConfig } from '../../data/mapConfig';
import { countInstansi } from '../../services/exploration';
import { ClusterLayer } from './ClusterLayer';
import { InstansiPopup } from './InstansiPopup';
import { MarkerPopup } from './MarkerPopup';
import { RegionCounts } from './RegionCounts';
import { MapZoomControls } from './MapZoomControls';
import { regionSummaries } from '../../services/regionSummaries';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
interface Props {
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  allItems: Instansi[];
  onRegion: (region: Wilayah) => void;
  onPreview: (id: string, element: HTMLElement | null) => void;
  onNavigate: (id: string) => void;
  onEnter: () => void;
  onReposition: (moving: boolean) => void;
  onLeave: (id?: string) => void;
  onClose: (id?: string) => void;
  onDetail: () => void;
  detail: InstansiDetail | null;
  previewFromList: boolean;
  demo: boolean;
  pilot?: boolean;
  search: string;
  touch: boolean;
  initialSession: MapSession | null;
  onViewport: (center: Coordinates, zoom: number) => void;
  resetEpoch: number;
}
function FocusController({
  state,
  references,
  items,
  initialSession,
  onViewport,
  resetEpoch,
  onNotice,
  overviewBounds,
  pilot,
}: {
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  initialSession: MapSession | null;
  onViewport: Props['onViewport'];
  resetEpoch: number;
  onNotice: (value: string | null) => void;
  overviewBounds: Bounds;
  pilot: boolean;
}) {
  const map = useMap();
  const key = `${state.provinceId ?? 'nasional'}:${state.kabKotaId ?? ''}:${resetEpoch}`;
  const previous = useRef(initialSession ? key : '');
  const focusBounds = useMemo(() => {
    const region = state.kabKotaId
      ? references.kabKota.find((r) => r.id === state.kabKotaId)
      : references.provinces.find((r) => r.id === state.provinceId);
    // Dalam pilot, buka cakupan kab/kota bersampel, termasuk bounds resminya.
    // Seluruh kab/kota tetap tersedia lewat polygon, dropdown dan Daftar.
    const sampleBounds = pilot && state.level === 'provinsi'
      ? references.kabKota.filter((area) => area.provinceId === state.provinceId &&
          items.some((item) => item.kabKotaId === area.id)).flatMap((area) => area.bounds ? [area.bounds] : [])
      : [];
    const bounds = state.level === 'nasional' ? overviewBounds : sampleBounds.length
      ? L.latLngBounds(sampleBounds.flatMap((value) => value)) : region?.bounds;
    if (bounds) return bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
    const points = items.flatMap((item) => item.coordinates ? [item.coordinates] : []);
    return points.length ? L.latLngBounds(points) : null;
  }, [state, references, items, overviewBounds, pilot]);
  useEffect(() => {
    const updateZoomLimit = () => {
      // Batas lama harus dilepas sebelum getBoundsZoom menghitung cakupan baru
      // atau viewport lebih kecil. getBoundsZoom membatasi hasil ke minZoom aktif.
      map.setMinZoom(3);
      // Tampilan awal boleh diperkecil hingga skala dunia. Batas sesuai bounds
      // hanya diperlukan saat kab/kota suatu provinsi sedang ditampilkan.
      if (state.level !== 'provinsi' || !focusBounds) return;
      const zoom = map.getBoundsZoom(focusBounds, false, L.point(48, 170));
      const minimum = Math.max(3, Math.min(14, zoom));
      // setMinZoom dapat memulai animasi zoom sendiri. Selesaikan perubahan
      // sinkron agar animasi lama tidak menimpa fitBounds untuk wilayah baru.
      if (map.getZoom() < minimum) {
        map.stop();
        map.setZoom(minimum, { animate: false });
      }
      map.setMinZoom(minimum);
    };
    updateZoomLimit();
    map.on('resize', updateZoomLimit);
    return () => { map.off('resize', updateZoomLimit); };
  }, [map, state.level, focusBounds]);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    const region = state.kabKotaId
      ? references.kabKota.find((r) => r.id === state.kabKotaId)
      : references.provinces.find((r) => r.id === state.provinceId);
    const bounds = focusBounds;
    if (bounds) {
      map.fitBounds(bounds, {
        paddingTopLeft: [24, 110],
        paddingBottomRight: [24, 60],
        maxZoom: 14,
        animate: false,
      });
      onNotice(state.level !== 'nasional' && !region?.bounds
        ? 'Batas wilayah belum tersedia; peta difokuskan pada titik hasil yang valid.' : null);
    } else {
      onNotice('Batas wilayah dan titik hasil belum tersedia. Posisi peta dipertahankan; gunakan Daftar.');
    }
  }, [map, key, state, references, onNotice, focusBounds]);
  useEffect(() => {
    const save = () => {
      const c = map.getCenter();
      onViewport([c.lat, c.lng], map.getZoom());
    };
    map.on('moveend', save);
    save();
    return () => {
      map.off('moveend', save);
    };
  }, [map, onViewport]);
  return null;
}
export function MapView(props: Props) {
  const overviewBounds = useMemo<Bounds>(() => {
    if (!props.pilot) return NATIONAL_BOUNDS;
    const bounds = props.references.provinces.flatMap((region) => region.bounds ? [region.bounds] : []);
    if (!bounds.length) return NATIONAL_BOUNDS;
    return [[Math.min(...bounds.map((b) => b[0][0])), Math.min(...bounds.map((b) => b[0][1]))],
      [Math.max(...bounds.map((b) => b[1][0])), Math.max(...bounds.map((b) => b[1][1]))]];
  }, [props.pilot, props.references.provinces]);
  const markers = useRef(new Map<string, L.Marker>());
  const [tileFailed, setTileFailed] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const summaries = useMemo(() => regionSummaries(props.state, props.references, props.allItems),
    [props.state, props.references, props.allItems]);
  const jenisName = props.references.jenisInstansi.find((item) => item.id === props.detail?.instansi.jenisId)?.name ?? null;
  const regions =
    props.state.level === 'nasional'
      ? props.references.provinces
      : props.references.kabKota.filter(
          (r) => r.provinceId === props.state.provinceId,
        );
  return (
    <>
      <MapContainer
        className="map-canvas"
        bounds={props.initialSession ? undefined : overviewBounds}
        center={props.initialSession?.center}
        zoom={props.initialSession?.zoom}
        zoomControl={false}
        // flyTo pada MapZoomControls memberi animasi yang dapat dibatalkan,
        // tanpa timeout transisi CSS Leaflet 1.9 ketika route dilepas.
        zoomAnimation={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom={false}
        doubleClickZoom={false}
      >
        <TileLayer
          key={tileAttempt}
          url={tileConfig.url}
          opacity={0.9}
          attribution={tileConfig.attribution}
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileFailed(true) }}
        />
        <MapZoomControls />
        <FocusController
          state={props.state}
          references={props.references}
          items={props.items}
          initialSession={props.initialSession}
          onViewport={props.onViewport}
          resetEpoch={props.resetEpoch}
          onNotice={setNotice}
          overviewBounds={overviewBounds}
          pilot={props.pilot ?? false}
        />
        {props.state.level !== 'instansi' &&
          regions.map((region) => {
            const count = countInstansi(
              props.allItems.filter((i) =>
                region.level === 'province'
                  ? i.provinceId === region.id
                  : i.kabKotaId === region.id,
              ),
            ).total;
            const label = `${region.name} · ${count} instansi${props.pilot ? ' percontohan' : ` unik dalam snapshot${props.demo ? ' demo' : ''}`}`;
            return region.geometry ? (
              <GeoJSON
                key={`${region.level}:${region.id}`}
                data={region.geometry}
                style={{
                  color: '#5688ae',
                  weight: props.pilot ? 0.8 : 2,
                  opacity: props.pilot ? 0.35 : 1,
                  fillColor: '#4d9cd4',
                  fillOpacity: props.pilot ? 0.015 : 0.17,
                }}
                onEachFeature={(_feature, layer) => {
                  if (!props.pilot) {
                    const tooltipContent = document.createElement('span');
                    tooltipContent.textContent = label;
                    layer.bindTooltip(tooltipContent);
                  }
                  layer.on('click', () => props.onRegion(region));
                  layer.on('mouseover', () => {
                    if (layer instanceof L.Path)
                      layer.setStyle({ fillOpacity: props.pilot ? 0.07 : 0.35, weight: props.pilot ? 1.2 : 3 });
                  });
                  layer.on('mouseout', () => {
                    if (layer instanceof L.Path)
                      layer.setStyle({ fillOpacity: props.pilot ? 0.015 : 0.17, weight: props.pilot ? 0.8 : 2 });
                  });
                  layer.on('add', () => {
                    if (layer instanceof L.Path) {
                      const el = layer.getElement();
                      if (el) {
                        el.setAttribute('data-region-id', region.id);
                        el.setAttribute('aria-label', `Pilih ${region.name}`);
                        el.setAttribute('role', 'button');
                        el.setAttribute('tabindex', '0');
                        el.addEventListener('keydown', (event) => {
                          if (
                            event instanceof KeyboardEvent &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            props.onRegion(region);
                          }
                        });
                      }
                    }
                  });
                }}
              />
            ) : region.labelPosition && !summaries.some((summary) => summary.region.id === region.id) ? (
              <Marker
                key={region.id}
                position={region.labelPosition}
                icon={L.divIcon({
                  className: 'region-pointer',
                  html: '<span>↗</span>',
                  iconSize: [36, 36],
                })}
                eventHandlers={{ click: () => props.onRegion(region) }}
              />
            ) : null;
          })}
        {props.state.level === 'instansi' && (
          <ClusterLayer
            markers={markers}
            items={props.items}
            onPreview={props.onPreview}
            onNavigate={props.onNavigate}
            onEnter={props.onEnter}
            onLeave={props.onLeave}
            touch={props.touch}
          />
        )}
        <RegionCounts summaries={summaries} compact={props.pilot} onSelect={(summary) => props.onRegion(summary.region)} />
        {!props.touch && !props.previewFromList && props.detail?.instansi.coordinates && (
          <MarkerPopup
            markers={markers}
            detail={props.detail}
            jenisName={jenisName}
            demo={props.demo}
            search={props.search}
            onClose={props.onClose}
            onDetail={props.onDetail}
            onEnter={props.onEnter}
            onReposition={props.onReposition}
            onLeave={props.onLeave}
          />
        )}
      </MapContainer>
      {tileFailed && (
        <div className="tile-error" role="status">
          Peta dasar belum dapat dimuat. Wilayah dan daftar tetap tersedia.
          <button
            onClick={() => {
              setTileFailed(false);
              setTileAttempt((n) => n + 1);
            }}
          >
            Coba muat peta dasar lagi
          </button>
        </div>
      )}
      {notice && (
        <span className="viewport-note map-viewport-note" role="status">
          {notice}
        </span>
      )}
      {props.detail && (props.touch || props.previewFromList || !props.detail.instansi.coordinates) && (
        <div
          className={`mobile-popup ${props.previewFromList && !props.touch ? 'list-profile-popup' : ''}`}
          role="dialog"
          aria-modal="false"
          aria-label="Pratinjau instansi"
        >
          <InstansiPopup
            detail={props.detail}
            jenisName={jenisName}
            demo={props.demo}
            search={props.search}
            onClose={props.onClose}
            onDetail={props.onDetail}
            onEnter={props.onEnter}
            onLeave={() => { if (!props.touch) props.onLeave(props.detail?.instansi.id); }}
          />
        </div>
      )}
    </>
  );
}
