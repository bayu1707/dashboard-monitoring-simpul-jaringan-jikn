import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Popup,
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
} from '../../types/domain';
import { NATIONAL_BOUNDS, tileConfig } from '../../data/mapConfig';
import { countInstansi } from '../../services/exploration';
import { ClusterLayer } from './ClusterLayer';
import { InstansiPopup } from './InstansiPopup';
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
  onReposition: () => void;
  onLeave: () => void;
  onClose: () => void;
  onDetail: () => void;
  detail: InstansiDetail | null;
  demo: boolean;
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
}: {
  state: ExplorationState;
  references: ReferenceData;
  items: Instansi[];
  initialSession: MapSession | null;
  onViewport: Props['onViewport'];
  resetEpoch: number;
  onNotice: (value: string | null) => void;
}) {
  const map = useMap();
  const key = `${state.provinceId ?? 'nasional'}:${state.kabKotaId ?? ''}:${resetEpoch}`;
  const previous = useRef(initialSession ? key : '');
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    const region = state.kabKotaId
      ? references.kabKota.find((r) => r.id === state.kabKotaId)
      : references.provinces.find((r) => r.id === state.provinceId);
    const bounds =
      state.level === 'nasional' ? NATIONAL_BOUNDS : region?.bounds;
    if (bounds) {
      map.fitBounds(bounds, {
        paddingTopLeft: [24, 110],
        paddingBottomRight: [24, 60],
        maxZoom: 14,
        animate: false,
      });
      onNotice(null);
    } else {
      const points = items.flatMap((item) =>
        item.coordinates ? [item.coordinates] : [],
      );
      if (points.length) {
        map.fitBounds(L.latLngBounds(points), {
          paddingTopLeft: [24, 110],
          paddingBottomRight: [24, 60],
          maxZoom: 14,
          animate: false,
        });
        onNotice(
          'Batas wilayah belum tersedia; peta difokuskan pada titik hasil yang valid.',
        );
      } else
        onNotice(
          'Batas wilayah dan titik hasil belum tersedia. Posisi peta dipertahankan; gunakan Daftar.',
        );
    }
  }, [map, key, state, references, items, onNotice]);
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
function PopupLayer({
  detail,
  ...props
}: Pick<
  Props,
  | 'detail'
  | 'demo'
  | 'onClose'
  | 'onDetail'
  | 'onEnter'
  | 'onReposition'
  | 'onLeave'
  | 'search'
>) {
  const map = useMap();
  const popup = useRef<L.Popup>(null);
  useEffect(() => {
    map.on('autopanstart', props.onReposition);
    return () => {
      map.off('autopanstart', props.onReposition);
    };
  }, [map, props.onReposition]);
  useEffect(() => {
    if (detail?.instansi.coordinates && popup.current)
      popup.current.openOn(map);
  }, [map, detail]);
  if (!detail?.instansi.coordinates) return null;
  return (
    <Popup
      ref={popup}
      position={detail.instansi.coordinates}
      closeButton={false}
      autoPan={true}
      autoPanPaddingTopLeft={[24, 150]}
      autoPanPaddingBottomRight={[24, 65]}
      eventHandlers={{ remove: props.onClose }}
    >
      <InstansiPopup detail={detail} {...props} />
    </Popup>
  );
}
export function MapView(props: Props) {
  const [tileFailed, setTileFailed] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
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
        bounds={props.initialSession ? undefined : NATIONAL_BOUNDS}
        center={props.initialSession?.center}
        zoom={props.initialSession?.zoom}
        zoomControl={false}
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={tileAttempt}
          url={tileConfig.url}
          opacity={0.9}
          attribution={tileConfig.attribution}
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileFailed(true) }}
        />
        <ZoomButtons />
        <FocusController
          state={props.state}
          references={props.references}
          items={props.items}
          initialSession={props.initialSession}
          onViewport={props.onViewport}
          resetEpoch={props.resetEpoch}
          onNotice={setNotice}
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
            const label = `${region.name} · ${count} instansi unik dalam snapshot${props.demo ? ' demo' : ''}`;
            return region.geometry ? (
              <GeoJSON
                key={`${region.level}:${region.id}`}
                data={region.geometry}
                style={{
                  color: '#5688ae',
                  weight: 2,
                  fillColor: '#4d9cd4',
                  fillOpacity: 0.17,
                }}
                onEachFeature={(_feature, layer) => {
                  const tooltipContent = document.createElement('span');
                  tooltipContent.textContent = label;
                  layer.bindTooltip(tooltipContent);
                  layer.on('click', () => props.onRegion(region));
                  layer.on('mouseover', () => {
                    if (layer instanceof L.Path)
                      layer.setStyle({ fillOpacity: 0.35, weight: 3 });
                  });
                  layer.on('mouseout', () => {
                    if (layer instanceof L.Path)
                      layer.setStyle({ fillOpacity: 0.17, weight: 2 });
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
            ) : region.labelPosition ? (
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
            items={props.items}
            onPreview={props.onPreview}
            onNavigate={props.onNavigate}
            onEnter={props.onEnter}
            onLeave={props.onLeave}
            touch={props.touch}
          />
        )}
        {!props.touch && (
          <PopupLayer
            detail={props.detail}
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
      {props.detail && (props.touch || !props.detail.instansi.coordinates) && (
        <div
          className="mobile-popup"
          role="dialog"
          aria-modal="false"
          aria-label="Pratinjau instansi"
        >
          <InstansiPopup
            detail={props.detail}
            demo={props.demo}
            search={props.search}
            onClose={props.onClose}
            onDetail={props.onDetail}
            onEnter={props.onEnter}
            onLeave={() => {}}
          />
        </div>
      )}
    </>
  );
}
function ZoomButtons() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({
      position: 'bottomright',
      zoomInTitle: 'Perbesar peta',
      zoomOutTitle: 'Perkecil peta',
    });
    map.addControl(control);
    return () => {
      map.removeControl(control);
    };
  }, [map]);
  return null;
}
