import L from 'leaflet';
import type { Instansi, Wilayah } from '../../types/domain';
import { countInstansi } from '../../services/exploration';

/** DOM textContent menjaga nama sumber tetap berupa teks, bukan HTML. */
export function bindRegionTooltip(
  layer: L.Layer,
  region: Wilayah,
  items: Instansi[],
  map: L.Map,
  registerCleanup: (cleanup: () => void) => void,
) {
  const counts = countInstansi(items.filter(item => region.level === 'province'
    ? item.provinceId === region.id : item.kabKotaId === region.id));
  const card = document.createElement('div');
  card.className = 'region-info';
  const append = (tag: string, className: string, text: string) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    card.append(node);
  };
  append('span', 'region-info-kind', region.level === 'province' ? 'Provinsi' : 'Kabupaten/Kota');
  append('strong', 'region-info-name', region.name);
  append('span', 'region-info-counts', `${counts.total} instansi unik · ${counts.mapped} memiliki pin`);
  append('span', 'region-info-hint', region.level === 'province' ? 'Klik atau Enter untuk melihat kabupaten/kota →' : 'Klik atau Enter untuk melihat instansi →');
  layer.bindTooltip(card, { className: 'region-info-tooltip', direction: 'top', offset: [0, -25], opacity: 1 });
  const tooltip = layer.getTooltip()!;
  // Ubah sisi kartu, tidak menggeser badge dari koordinat sumbernya.
  const position = () => {
    const latLng = layer instanceof L.Marker ? layer.getLatLng() : tooltip.getLatLng();
    if (!latLng) return;
    const point = map.latLngToContainerPoint(latLng);
    const size = map.getSize();
    const box = tooltip.getElement();
    const halfWidth = (box?.offsetWidth ?? 260) / 2;
    const height = box?.offsetHeight ?? 160;
    const toolbar = map.getContainer().parentElement?.querySelector('.map-toolbar');
    const safeTop = toolbar ? toolbar.getBoundingClientRect().bottom - map.getContainer().getBoundingClientRect().top + 12 : 70;
    const direction = point.y - height - 31 > safeTop ? 'top' : 'bottom';
    // Geser kartu saja di sisi kiri/kanan viewport; panah tetap menuju badge.
    const left = Math.max(12, Math.min(size.x - halfWidth * 2 - 12, point.x - halfWidth));
    const shift = left - (point.x - halfWidth);
    tooltip.options.direction = direction;
    tooltip.options.offset = L.point(shift, direction === 'top' ? -25 : 25);
    box?.style.setProperty('--region-tip-x', `${halfWidth - shift}px`);
    tooltip.update();
  };
  layer.on('tooltipopen', position);
  const onMove = () => { if (layer.isTooltipOpen()) position(); };
  map.on('moveend resize', onMove);
  const onAdd = () => {
    const element = layer instanceof L.Marker || layer instanceof L.Path ? layer.getElement() : null;
    if (!element) return;
    const focus = () => {
      if (region.labelPosition) layer.openTooltip(L.latLng(region.labelPosition));
      else layer.openTooltip();
    };
    const blur = () => layer.closeTooltip();
    const escape = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') layer.closeTooltip();
    };
    element.addEventListener('focus', focus);
    element.addEventListener('blur', blur);
    element.addEventListener('keydown', escape);
    registerCleanup(() => {
      element.removeEventListener('focus', focus);
      element.removeEventListener('blur', blur);
      element.removeEventListener('keydown', escape);
    });
  };
  layer.on('add', onAdd);
  registerCleanup(() => {
    map.off('moveend resize', onMove);
    layer.off('add', onAdd);
    layer.off('tooltipopen', position);
    const element = tooltip.getElement();
    layer.unbindTooltip();
    // Cakupan baru tidak menyisakan kartu lama selama animasi fade Leaflet.
    element?.remove();
  });
}
