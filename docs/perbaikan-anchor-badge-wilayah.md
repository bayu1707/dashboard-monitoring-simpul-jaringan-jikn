# Perbaikan anchor badge wilayah - 20 Oktober 2026

## Masalah dan reproduksi

Setelah pilot Jawa-Sumatra, badge jumlah provinsi/kabupaten bergeser dari wilayahnya ketika zoom out. Data `labelPosition` tetap benar; posisi visual ikon yang digeser.

Reproduksi sebelum perubahan: buka `/simpul-jaringan` pada 1440 x 900, pulihkan viewport nasional berpusat `[-3, 113]` pada zoom 3, lalu ukur pusat lingkaran DOM terhadap proyeksi Web Mercator `labelPosition`. Tes regresi baru gagal pada Sumatera Utara: **40,432 px**, melampaui toleransi pembulatan 1,6 px. Pemeriksaan localhost:5175 dengan tile asli, center `[-3, 109]`, zoom 4,5 menunjukkan maksimum **56,844 px** dari 16 badge. Tidak ada pageerror pada reproduksi tersebut.

Bukti lokal tersimpan pada `.local/qa/region-anchor-20261020/`: `before-1440.png`, `before-live-1440.png` dan `before-live.json`. Bukti lokal tidak masuk paket data publik.

## Penyebab utama

- `placeRegionLabels` mencoba memberi jarak minimum 54 px antarbadge melalui offset sampai 56 px. Ketika ruang sempit, algoritme tetap mencari celah layar alih-alih mempertahankan anchor.
- `RegionCounts` menerapkan offset pada `iconAnchor`. Pada pilot, offset dihitung di zoom aktual: puluhan piksel pada skala dunia dapat terlihat jauh di luar pulau. Mode non-pilot juga mempunyai proyeksi zoom referensi tersendiri.
- Langganan `zoomend resize` menghitung ulang placement serta membuat ikon baru. Pergeseran berubah sesudah zoom, menghasilkan posisi yang terlihat melompat.
- CSS lingkaran, data/geometri sumber, batas peta dan cluster instansi bukan penyebab displacement tersebut.

## Solusi

1. Marker tetap memakai `position={region.labelPosition}` dengan ikon 48 x 48 dan **iconAnchor `[24, 24]`** serta tooltipAnchor `[0, 0]`.
2. Hapus algoritme collision displacement, proyeksi referensi, offset leader dan listener zoom/resize milik penempatan badge. Leaflet mengurus transformasi geografis saat zoom/pan/resize.
3. Ikon tidak dibangun ulang hanya karena zoom berubah. Jumlah, ID, label sumber, tooltip, klik dan akses keyboard tetap dipertahankan.
4. Overlap diterima. Dropdown provinsi/kabupaten dan pemilihan keyboard tetap memilih ID yang tepat; tidak ada clustering administratif baru.

Tidak mengubah MapView, MapZoomControls, mapConfig, koordinat/geometri/ID atau jumlah instansi. Batas minimum zoom provinsi yang sudah ada tetap dipertahankan; tidak ditambah atau diperketat untuk menutupi bug. Popup instansi dan markercluster tidak diubah.

## Berkas yang diubah

- `src/components/map/RegionCounts.tsx`: marker geografis tanpa collision offset/listener penempatan.
- `src/services/regionSummaries.ts`: hapus utility collision yang tidak lagi dipakai; count ID unik tetap.
- `src/styles/map.css`: hapus dua aturan leader line yang sudah tidak dihasilkan.
- `tests/region-summaries.test.ts`: hapus ekspektasi wajib terpisah; periksa count, anchor sumber dan immutability.
- `tests/e2e/region-anchor.spec.ts`: ukur pusat DOM terhadap proyeksi sumber pada empat viewport, zoom berulang, drag, resize dan reload; mencakup pilot serta mode Excel.
- `tests/e2e/region-zoom.spec.ts`: toleransi posisi diperketat menjadi 1,6 px; overlap sah tidak lagi dianggap gagal.
- `tests/e2e/regionBadge.ts`: helper pengujian klik badge terbuka; keyboard ketika pusat tertutup badge lain. Tidak memakai force click atau mengubah koordinat aplikasi.
- `tests/e2e/java.spec.ts`, `sumatra.spec.ts`, `pilot.spec.ts`, `collaboration.spec.ts`: adaptasi tes terhadap overlap yang diminta, tetap memeriksa ID, filter, detail dan kembali.
- `README.md` dan laporan ini: dokumentasi perilaku baru.

## Pemeriksaan geografis

Tes mengukur bounding box lingkaran yang benar-benar tampil. Titik `labelPosition` diproyeksikan sendiri dengan rumus Web Mercator menggunakan center/zoom yang disimpan sesi, lalu dibandingkan terhadap center container. Ini tidak hanya menguji nilai iconAnchor atau satu screenshot. Toleransi **1,6 px** memperhitungkan pembulatan pixel origin dan posisi marker Leaflet.

Setelah perbaikan pada viewport localhost yang sama: penyimpangan maksimum **1,063 px**, 16 badge, 45 tile termuat, 0 pageerror. Screenshot `after-live-1440.png` dan laporan `after-live.json` disimpan di folder bukti lokal yang sama.

Tes browser memakai tile fixture agar tidak mengunduh tile provider secara massal. Pemeriksaan tile asli dilakukan terpisah pada localhost:5175. Pada tes drag, pembacaan menunggu transform map pane stabil agar inertia tidak dibandingkan dengan sesi `moveend` yang belum diperbarui.

## Cakupan QA

- Desktop 1440 x 900, laptop 1280 x 800, tablet 768 x 1024, mobile 390 x 844.
- Zoom minimum 3, zoom nasional/pulau 5 dan 7, kembali ke 3, pan, resize dan reload.
- Seluruh 16 provinsi pilot (10 Sumatra, 6 Jawa) dan badge kab/kotanya. Mode Excel memakai referensi nasional tanpa displacement mode khusus.
- Navigasi wilayah, sinkronisasi dropdown, jenis opsional, daftar, detail/kembali, sesi peta, cluster/spiderfy, popup hover/panah, sentuh dan gesture zoom.
- Baseline checksum 53 berkas data/aset (termasuk kurasi Sumatra) disimpan sebelum edit dan dibandingkan sesudahnya. Seluruhnya identik; pilot tetap **418 instansi/417 pin**, Excel tetap **643 instansi**.

### Hasil akhir

- `npm run build`: lulus (termasuk TypeScript dan build Vite).
- `npm run typecheck`, `npm run lint`, `git diff --check`: lulus.
- `npm test`: **139 unit/komponen lulus**. Empat tes placement lama yang mewajibkan badge terpisah dihapus dan diganti dua pemeriksaan anchor/count tanpa mutasi; bukan mengabaikan kegagalan UI.
- `npm run validate:shared`: lulus, pilot 418 dan Excel 643, 44 file pada manifest.
- Playwright Chrome: **59 skenario unik lulus pada hasil akhir**, 0 skipped. Run awal 58 skenario menghasilkan 57 lulus dan satu ekspektasi mobile lama gagal: zoom awal 3,25 dikurangi 0,5 diharapkan 2,75, padahal minZoom yang sudah ada 3. Ekspektasi tes diperbaiki menjadi clamp pada 3; seluruh 7 tes region-zoom kemudian lulus saat dijalankan ulang. Satu tes Browser Back tambahan juga lulus.
- Run suite awal memakai `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PORT=5181 npm run test:e2e -- tests/e2e/region-anchor.spec.ts tests/e2e/region-zoom.spec.ts tests/e2e/java.spec.ts tests/e2e/sumatra.spec.ts tests/e2e/collaboration.spec.ts tests/e2e/pilot.spec.ts tests/e2e/popup-regression.spec.ts tests/e2e/map-zoom-gestures.spec.ts tests/e2e/smooth-zoom-landing.spec.ts`.
- Run ulang terarah: `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PORT=5181 npm run test:e2e -- tests/e2e/region-zoom.spec.ts` (7 lulus). Browser Back: suite region-anchor dengan `--grep 'browser Back'` pada port 5182 (1 lulus).
- Pemeriksaan terakhir 53 checksum data/aset: identik dengan baseline. Tidak ada perubahan data Jawa/Sumatra, sumber pin, geometri, ID atau jumlah.

Kegagalan awal tes anchor sebelum implementasi adalah bukti reproduksi. Empat kegagalan sementara tes drag sesudah implementasi berasal dari pembacaan sesi sebelum inertia peta selesai; helper kemudian menunggu transform peta stabil, setelah itu seluruh empat viewport lulus tanpa perubahan kode peta tambahan.

## Batasan

Pada zoom kecil, sebagian angka dapat tertutup badge tetangga. Itu perilaku yang diminta agar posisi geografis tetap akurat. Pilih lewat dropdown/keyboard atau zoom in untuk membedakan wilayah. Badge tidak digeser ke laut demi keterpisahan.

Posisi mengikuti label wilayah yang sudah ada, bukan klaim titik kantor atau pusat resmi baru. Tidak melakukan pembetulan geometri/label sumber pada pekerjaan UI ini. Pemeriksaan gesture Safari melalui event sintetis tidak menggantikan pengujian trackpad Safari fisik. Tidak melakukan commit, push, merge atau deployment; kedua dokumen handoff tetap lokal.
