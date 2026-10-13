import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Instansi } from '../../types/domain';
interface Props {
  items: Instansi[];
  onPreview: (id: string, element: HTMLElement | null) => void;
  onNavigate: (id: string) => void;
  onLeave: () => void;
  onEnter: () => void;
  touch: boolean;
}
/** Adapter lifecycle: satu grup per efek; event dan layer dilepas saat cleanup. */
export function ClusterLayer({
  items,
  onPreview,
  onNavigate,
  onLeave,
  onEnter,
  touch,
}: Props) {
  const map = useMap();
  const callbacks = useRef({ onPreview, onNavigate, onLeave, onEnter });
  useEffect(() => {
    callbacks.current = { onPreview, onNavigate, onLeave, onEnter };
  }, [onPreview, onNavigate, onLeave, onEnter]);
  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 52,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      showCoverageOnHover: false,
      animate: false,
      iconCreateFunction(cluster) {
        // Duplikasi ditolak saat impor; label cluster tetap menghitung ID unik.
        const ids = new Set(
          cluster.getAllChildMarkers().map((marker) => marker.options.title),
        );
        const n = ids.size;
        return L.divIcon({
          className: `instansi-cluster ${n < 10 ? 'cluster-small' : n < 100 ? 'cluster-medium' : 'cluster-large'}`,
          html: `<span aria-label="${n} instansi terpetakan">${n}</span>`,
          iconSize: [50, 50],
        });
      },
    });
    const unique = new Map(items.map((item) => [item.id, item]));
    unique.forEach((item) => {
      if (item.coordinates === null) return;
      const marker = L.marker(item.coordinates, {
        icon: L.divIcon({
          className: 'instansi-marker',
          html: '<span class="marker-pin"></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        }),
        title: item.id,
        alt: item.name,
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('add', () => {
        const element = marker.getElement();
        if (element) {
          element.setAttribute('aria-label', item.name);
          element.setAttribute('data-instansi-id', item.id);
          element.setAttribute('role', 'button');
        }
      });
      marker.on('mouseover', () => {
        callbacks.current.onEnter();
        callbacks.current.onPreview(item.id, marker.getElement() ?? null);
      });
      marker.on('mouseout', () => callbacks.current.onLeave());
      marker.on('click', () => {
        if (touch)
          callbacks.current.onPreview(item.id, marker.getElement() ?? null);
        else callbacks.current.onNavigate(item.id);
      });
      group.addLayer(marker);
    });
    map.addLayer(group);
    return () => {
      group.eachLayer((layer) => layer.off());
      group.off();
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [map, items, touch]);
  return null;
}
