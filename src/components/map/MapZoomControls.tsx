import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/** Animasi flyTo dibersihkan Leaflet saat map.remove(); tidak memakai timeout zoom CSS 1.9. */
export function MapZoomControls() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({ position: 'bottomright', zoomInTitle: 'Perbesar peta', zoomOutTitle: 'Perkecil peta' });
    map.addControl(control);
    const element = control.getContainer()!;
    const canvas = map.getContainer();
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let wheelDelta = 0;
    let wheelPoint: L.Point | undefined;
    let gestureScale: number | null = null;
    let destination: number | null = null;
    let unloaded = false;
    const clearWheel = () => {
      clearTimeout(wheelTimer);
      wheelTimer = undefined;
      wheelDelta = 0;
      wheelPoint = undefined;
    };
    const finished = () => { destination = null; canvas.removeAttribute('data-zoom-moving'); };
    const zoom = (delta: number, point?: L.Point) => {
      if (unloaded) return;
      const current = map.getZoom();
      const base = point ? current : destination ?? current;
      const target = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.round((base + delta) * 4) / 4));
      if (Math.abs(target - current) < 0.001) {
        // + lalu − pada frame yang sama membatalkan tujuan lama, bukan meneruskan zoom masuk.
        if (destination !== null) { map.stop(); finished(); }
        return;
      }
      const half = map.getSize().divideBy(2);
      const offset = point?.subtract(half).multiplyBy(1 - 1 / map.getZoomScale(target, current));
      const center = offset ? map.containerPointToLatLng(half.add(offset)) : map.getCenter();
      destination = target;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) canvas.setAttribute('data-zoom-moving', 'true');
      map.flyTo(center, target, { animate: !reduced, duration: 0.32 });
    };
    const click = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('a') : null;
      if (!button || !element.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute('aria-disabled') === 'true') return;
      clearWheel();
      zoom(button.classList.contains('leaflet-control-zoom-in') ? 0.5 : -0.5);
    };
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.repeat
        || (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable]'))) return;
      if (!['+', '=', '-', '_'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      clearWheel();
      zoom(event.key === '+' || event.key === '=' ? 0.5 : -0.5);
    };
    const queueWheel = (delta: number, point: L.Point) => {
      wheelDelta += delta;
      wheelPoint = point;
      if (wheelTimer !== undefined) return;
      // Batasi satu burst menjadi paling jauh setengah level; trackpad kecil seperempat level.
      wheelTimer = setTimeout(() => {
        const delta = wheelDelta;
        const point = wheelPoint;
        clearWheel();
        if (delta) zoom(-Math.sign(delta) * (Math.abs(delta) < 120 ? 0.25 : 0.5), point);
      }, 80);
    };
    const wheel = (event: WheelEvent) => {
      // Pinch trackpad dikirim sebagai Ctrl+wheel. Tangkap sebelum kontrol/popup menghentikan bubbling.
      const pinch = event.ctrlKey || event.metaKey;
      if (!pinch && event.target instanceof Element && event.target.closest('.leaflet-control, .instansi-popup')) return;
      event.preventDefault();
      if (gestureScale !== null) return; // Safari dapat mengirim wheel dan GestureEvent untuk gestur yang sama.
      queueWheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1),
        map.mouseEventToContainerPoint(event));
    };
    // Safari desktop memakai GestureEvent; pinch layar sentuh tetap ditangani TouchZoom Leaflet.
    const webKitGestures = navigator.maxTouchPoints === 0;
    type WebKitGesture = Event & { scale?: number; clientX?: number; clientY?: number };
    const gestureStart = (event: Event) => {
      event.preventDefault();
      clearWheel();
      gestureScale = 1;
    };
    const gestureChange = (event: WebKitGesture) => {
      if (gestureScale === null) return;
      event.preventDefault();
      if (typeof event.scale !== 'number' || !Number.isFinite(event.scale) || event.scale <= 0) return;
      const box = canvas.getBoundingClientRect();
      const point = typeof event.clientX === 'number' && typeof event.clientY === 'number'
        ? L.point(event.clientX - box.left, event.clientY - box.top) : map.getSize().divideBy(2);
      queueWheel(-Math.log2(event.scale / gestureScale) * 240, point);
      gestureScale = event.scale;
    };
    const gestureEnd = (event: Event) => {
      if (gestureScale === null) return;
      event.preventDefault();
      gestureScale = null;
    };
    const cancel = () => { clearWheel(); gestureScale = null; destination = null; canvas.removeAttribute('data-zoom-moving'); };
    const doubleClick = (event: L.LeafletMouseEvent) => {
      clearWheel();
      zoom(event.originalEvent.shiftKey ? -0.5 : 0.5, event.containerPoint);
    };
    const unload = () => { unloaded = true; cancel(); };
    element.addEventListener('click', click, true);
    canvas.addEventListener('keydown', key, true);
    canvas.addEventListener('wheel', wheel, { passive: false, capture: true });
    if (webKitGestures) {
      canvas.addEventListener('gesturestart', gestureStart, { passive: false, capture: true });
      canvas.addEventListener('gesturechange', gestureChange, { passive: false, capture: true });
      canvas.addEventListener('gestureend', gestureEnd, { passive: false, capture: true });
    }
    map.on('zoomend', finished);
    map.on('dblclick', doubleClick);
    map.on('dragstart', cancel);
    map.on('viewreset', cancel);
    map.on('unload', unload);
    return () => {
      clearWheel();
      gestureScale = null;
      element.removeEventListener('click', click, true);
      canvas.removeEventListener('keydown', key, true);
      canvas.removeEventListener('wheel', wheel, true);
      if (webKitGestures) {
        canvas.removeEventListener('gesturestart', gestureStart, true);
        canvas.removeEventListener('gesturechange', gestureChange, true);
        canvas.removeEventListener('gestureend', gestureEnd, true);
      }
      map.off('zoomend', finished);
      map.off('dblclick', doubleClick);
      map.off('dragstart', cancel);
      map.off('viewreset', cancel);
      map.off('unload', unload);
      if (!unloaded) map.removeControl(control);
    };
  }, [map]);
  return null;
}
