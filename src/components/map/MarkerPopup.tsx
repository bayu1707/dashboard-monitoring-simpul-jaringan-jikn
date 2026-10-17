import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { InstansiDetail } from '../../types/domain';
import { InstansiPopup } from './InstansiPopup';

interface Props {
  detail: InstansiDetail;
  markers: RefObject<Map<string, L.Marker>>;
  demo: boolean;
  jenisName?: string | null;
  search: string;
  onClose: (id?: string) => void;
  onDetail: () => void;
  onEnter: () => void;
  onLeave: (id?: string) => void;
  onReposition: (moving: boolean) => void;
}
const noop = () => {};

/** Satu popup Leaflet dengan portal React, mengikuti marker aktual termasuk spiderfy. */
export function MarkerPopup({ detail, markers, ...props }: Props) {
  const map = useMap();
  const [content] = useState(() => document.createElement('div'));
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });
  const id = detail.instansi.id;
  useEffect(() => {
    const marker = markers.current.get(id);
    // Detail bisa selesai setelah zoom menyembunyikan marker ke dalam cluster.
    if (!marker || !map.hasLayer(marker)) {
      callbacks.current.onClose(id);
      return;
    }
    let autoPanning = false;
    let awaitingPointer = false;
    let disposed = false;
    let pointerDuringPan: { x: number; y: number } | null = null;
    const popup = L.popup({
      className: 'instansi-leaflet-popup',
      closeButton: false,
      closeOnEscapeKey: false, // Escape dan pengembalian fokus dikelola halaman.
      offset: [0, 0],
      autoPan: true,
      autoPanPaddingTopLeft: [24, 150],
      autoPanPaddingBottomRight: [24, 65],
    }, marker).setLatLng(marker.getLatLng()).setContent(content);

    const enter = () => callbacks.current.onEnter();
    const leave = () => {
      if (!popup.getElement()?.contains(document.activeElement))
        callbacks.current.onLeave(id);
    };
    const focusOut = (event: FocusEvent) => {
      const element = popup.getElement();
      if (element && !element.contains(event.relatedTarget as Node | null) &&
          !element.matches(':hover')) callbacks.current.onLeave(id);
    };
    const onAutoPan = () => {
      autoPanning = true;
      pointerDuringPan = null;
      awaitingPointer = true;
      callbacks.current.onReposition(true);
    };
    const resumePointer = (target: Node | null) => {
      awaitingPointer = false;
      callbacks.current.onReposition(false);
      if (popup.getElement()?.contains(target) || marker.getElement()?.contains(target)) enter();
      else leave();
    };
    const onMoveEnd = () => {
      autoPanning = false;
      if (awaitingPointer && pointerDuringPan) {
        resumePointer(document.elementFromPoint(pointerDuringPan.x, pointerDuringPan.y));
        pointerDuringPan = null;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      // Gerak peta sendiri tidak dianggap pointer meninggalkan pratinjau.
      if (!awaitingPointer) return;
      if (autoPanning) {
        pointerDuringPan = { x: event.clientX, y: event.clientY };
        return;
      }
      resumePointer(event.target as Node | null);
    };
    const followMarker = () => popup.setLatLng(marker.getLatLng());
    const closeRemoved = () => {
      if (!disposed) callbacks.current.onClose(id);
    };
    map.on('autopanstart', onAutoPan);
    map.on('moveend', onMoveEnd);
    const onResize = () => popup.update();
    map.on('resize', onResize);
    marker.on('move', followMarker);
    marker.on('remove', closeRemoved);
    popup.on('remove', closeRemoved);
    document.addEventListener('pointermove', onPointerMove);
    popup.openOn(map);
    const element = popup.getElement();
    element?.addEventListener('pointerenter', enter);
    element?.addEventListener('pointerleave', leave);
    element?.addEventListener('focusin', enter);
    element?.addEventListener('focusout', focusOut);
    // Logo, pembungkusan teks, dan ukuran container dapat berubah setelah render.
    const resize = new ResizeObserver(() => popup.update());
    resize.observe(content);
    return () => {
      disposed = true;
      resize.disconnect();
      element?.removeEventListener('pointerenter', enter);
      element?.removeEventListener('pointerleave', leave);
      element?.removeEventListener('focusin', enter);
      element?.removeEventListener('focusout', focusOut);
      document.removeEventListener('pointermove', onPointerMove);
      map.off('autopanstart', onAutoPan);
      map.off('moveend', onMoveEnd);
      map.off('resize', onResize);
      marker.off('move', followMarker);
      marker.off('remove', closeRemoved);
      popup.off('remove', closeRemoved);
      popup.remove();
      // Leaflet menunda penghapusan DOM 200 ms untuk fade. Saat pilihan berganti,
      // lepaskan container milik efek ini segera agar popup lama tidak menahan pointer.
      element?.remove();
      callbacks.current.onReposition(false);
    };
  }, [map, id, markers, content]);
  return createPortal(
    <InstansiPopup detail={detail} demo={props.demo} search={props.search} jenisName={props.jenisName}
      onClose={() => props.onClose()} onDetail={props.onDetail}
      onEnter={noop} onLeave={noop} />,
    content,
  );
}
