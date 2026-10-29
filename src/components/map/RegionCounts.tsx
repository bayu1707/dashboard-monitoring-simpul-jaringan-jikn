import { useEffect, useMemo, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { RegionSummary } from '../../services/regionSummaries';

export function RegionCounts({ summaries, onSelect, compact = false }: { summaries: RegionSummary[]; onSelect: (summary: RegionSummary) => void; compact?: boolean }) {
  // Posisi mengikuti koordinat wilayah melalui transformasi Leaflet.
  // Overlap pada zoom rendah diperbolehkan; dropdown tetap memilih ID yang tepat.
  return summaries.map((summary) => <RegionCount key={summary.region.id} summary={summary} onSelect={onSelect} compact={compact} />);
}
function RegionCount({ summary, onSelect, compact }: { summary: RegionSummary; onSelect: (summary: RegionSummary) => void; compact: boolean }) {
  const { region, count } = summary;
  const marker = useRef<L.Marker | null>(null);
  const caption = `${region.name} · ${count} instansi${compact ? ' percontohan' : ' unik dalam snapshot'}`;
  const label = `${caption}. Klik untuk membuka ${region.level === 'province' ? 'kabupaten/kota' : 'instansi'}.`;
  const icon = useMemo(() => {
    const element = document.createElement('div');
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
    // Pusat ikon 48 x 48 tepat pada labelPosition; tidak ada offset collision.
    return L.divIcon({ className: `region-count-marker${compact ? ' region-count-compact' : ''}`, html: element, iconSize: [48, 48],
      iconAnchor: [24, 24], tooltipAnchor: [0, 0] });
  }, [count, region.name, compact]);
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
