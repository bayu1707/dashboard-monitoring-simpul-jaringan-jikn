import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { placeRegionLabels, type RegionSummary } from '../../services/regionSummaries';

export function RegionCounts({ summaries, onSelect, compact = false }: { summaries: RegionSummary[]; onSelect: (summary: RegionSummary) => void; compact?: boolean }) {
  const map = useMap();
  const subscribe = useCallback((update: () => void) => {
    map.on('zoomend resize', update);
    return () => { map.off('zoomend resize', update); };
  }, [map]);
  const zoom = useSyncExternalStore(subscribe, () => map.getZoom());
  const placements = useMemo(() => {
    // Badge ringkas percontohan tetap berdiameter 48 px, termasuk di layar
    // kecil. Hitung jaraknya pada zoom aktual agar DIY tidak menutupi Jawa
    // Tengah. Pergeseran layar tetap dibatasi 56 px; koordinat sumber utuh.
    // Overview nasional lengkap mempertahankan proyeksi lama.
    const provinceOverview = summaries[0]?.region.level === 'province';
    const layoutZoom = provinceOverview && !compact ? Math.max(8, zoom) : zoom;
    const scale = 2 ** (zoom - layoutZoom);
    return placeRegionLabels(summaries, (region) => map.project(region.labelPosition!, layoutZoom))
      .map(({ summary, offset }) => ({ summary, offset: [offset[0] * scale, offset[1] * scale] as [number, number] }));
  }, [summaries, map, zoom, compact]);
  return placements.map(({ summary, offset }) => <RegionCount key={summary.region.id} summary={summary} offset={offset} onSelect={onSelect} compact={compact} />);
}
function RegionCount({ summary, offset, onSelect, compact }: { summary: RegionSummary; offset: [number, number]; onSelect: (summary: RegionSummary) => void; compact: boolean }) {
  const { region, count } = summary;
  const marker = useRef<L.Marker | null>(null);
  const caption = `${region.name} · ${count} instansi${compact ? ' percontohan' : ' unik dalam snapshot'}`;
  const label = `${caption}. Klik untuk membuka ${region.level === 'province' ? 'kabupaten/kota' : 'instansi'}.`;
  const icon = useMemo(() => {
    const element = document.createElement('div');
    if (!compact && (offset[0] || offset[1])) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('region-count-leader');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(24 - offset[0])); line.setAttribute('y1', String(24 - offset[1]));
      line.setAttribute('x2', '24'); line.setAttribute('y2', '24');
      svg.append(line); element.append(svg);
    }
    const badge = document.createElement('div');
    badge.className = 'region-count-label';
    const number = document.createElement('span');
    number.className = `region-count-circle ${count < 10 ? 'region-count-small' : count < 100 ? 'region-count-medium' : 'region-count-large'}`;
    number.textContent = String(count);
    badge.append(number);
    if (!compact) {
      const caption = document.createElement('span');
      caption.className = 'region-count-caption';
      caption.textContent = region.name;
      badge.append(caption);
    }
    element.append(badge);
    // Hanya posisi label di layar yang bergeser; lat/lng dari sumber tetap utuh.
    return L.divIcon({ className: `region-count-marker${compact ? ' region-count-compact' : ''}`, html: element, iconSize: [48, 48],
      iconAnchor: [24 - offset[0], 24 - offset[1]], tooltipAnchor: offset });
  }, [count, region.name, offset, compact]);
  useEffect(() => {
    const element = marker.current?.getElement();
    if (!element) return;
    element.setAttribute('data-region-count-id', region.id);
    element.setAttribute('data-region-count-kind', 'region');
    element.setAttribute('aria-label', label);
    element.setAttribute('role', 'button');
    if (compact) element.removeAttribute('title');
    else element.setAttribute('title', label);
    const activate = (event: KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault(); event.stopPropagation(); onSelect(summary);
      }
    };
    element.addEventListener('keydown', activate);
    return () => element.removeEventListener('keydown', activate);
  }, [icon, region.id, label, onSelect, summary, compact]);
  if (!region.labelPosition) return null;
  return <Marker ref={marker} position={region.labelPosition} icon={icon} keyboard riseOnHover title={label} alt={label}
    eventHandlers={{
      click: () => onSelect(summary),
    }}>
    <Tooltip className="region-count-tooltip" direction="top" offset={[0, -22]}>{compact ? caption : label}</Tooltip>
  </Marker>;
}
