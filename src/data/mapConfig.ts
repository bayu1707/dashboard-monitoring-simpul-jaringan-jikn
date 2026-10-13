import type { Bounds } from '../types/domain';
// Bounds nasional dari layanan publik BIG dalam WGS84, diambil 12 Oktober 2026.
// Provenance: docs/reference-sources.md. Bounds ini tidak digunakan sebagai koordinat instansi.
export const NATIONAL_BOUNDS: Bounds = [
  [-11.007552182999973, 94.97194993500005],
  [6.0767408680000585, 141.02004178900006],
];
export const tileConfig = {
  url:
    import.meta.env.VITE_TILE_URL ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    import.meta.env.VITE_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
