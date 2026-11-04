# Migrasi Laravel + Nuxt + Leaflet

Migrasi 21–22 Oktober 2026 mempertahankan frontend React di root sebagai pembanding/rollback lokal. Aplikasi baru ada di `frontend/` dan `backend/`. Migrasi ini tidak menghubungkan API resmi SIKN/JIKN dan tidak mengganti ID, pin, tahun bergabung, sumber, maupun dataset.

## Hasil audit awal

Sumber migrasi: clone `dashboard-monitoring-simpul-jaringan-jikn`, bukan salinan React lama di folder `sikn jikn`. Branch kerja `codex/migrasi-laravel-nuxt`. Perubahan badge wilayah yang belum di-commit dipertahankan. Sebelum implementasi, file sumber dan dataset dicatat checksum-nya untuk pembandingan.

- React 19, React Router, React Leaflet dan Recharts adalah implementasi awal.
- Pilot kolaborasi berisi **418 instansi, 417 pin, 16 provinsi, 273 kabupaten/kota**. Satu record tanpa pin tetap tersedia lewat Daftar.
- Snapshot Excel terpisah berisi **643 instansi**, tanpa pin/statistik simulasi; referensi nasional 38 provinsi/514 kabupaten/kota.
- Demo sintetis berisi 7 instansi dan 6 pin, termasuk koordinat identik untuk spiderfy, metric 0 dan null.
- InstansiRepository, tipe domain dan helper murni dapat digunakan kembali. Komponen React harus diterjemahkan ke Vue.
- Perbaikan popup menggunakan native Leaflet Popup dengan sumber marker aktual. Badge wilayah menggunakan labelPosition bersumber, tanpa displacement dan leader line.
- Tidak terdapat AGENTS.md pada proyek sumber. Instruksi bootstrap dari scaffold Laravel tidak dijadikan ketergantungan aplikasi.

## Alur baru

```text
public/data + public/demo (dataset existing, read-only)
  → Laravel JsonSnapshotRepository
  → DatasetValidator + DashboardService
  → Controller /api/v1
  → Nuxt apiRepository (pagination, cache, error)
  → halaman Vue dan Leaflet client-only
```

Tidak diperlukan database untuk API baca snapshot saat ini. Konfigurasi SQLite disediakan untuk perkembangan berikutnya; server baca JSON tidak memerlukan migrasi tabel, database server, XAMPP, atau login dashboard. Pemilihan database produksi menunggu kebutuhan dan kontrak integrasi resmi.

## Struktur dan tanggung jawab

| Lokasi | Kegunaan |
|---|---|
| `frontend/nuxt.config.ts` | Runtime config URL API/tile, CSS, SSR dan routing |
| `frontend/app/app.vue` | Header bersama dan pemisahan halaman per mode dataset |
| `frontend/app/pages/simpul-jaringan/index.vue` | Query filter, level geografis, popup, daftar dan session |
| `frontend/app/pages/simpul-jaringan/[id].vue` | Detail instansi, metadata sumber dan kembali ke peta |
| `frontend/app/components/map/MapView.client.vue` | Instance Leaflet, GeoJSON lazy, cluster, spiderfy, popup/Teleport dan cleanup |
| `frontend/app/components/map/installMapZoomControls.ts` | Zoom/pinch/keyboard yang dibatasi per gesture, reduced motion |
| `frontend/app/components/map/MapFilters.vue` | Dropdown desktop dan draft filter mobile |
| `frontend/app/components/map/ResultsList.vue` | Navigasi tekstual, pencarian, instansi tanpa lokasi/pin |
| `frontend/app/components/instansi/` | Identitas, metric dan isi popup |
| `frontend/app/components/charts/` | Grafik SVG Vue dengan ringkasan dan tabel aksesibel |
| `frontend/app/composables/useInstansiRepository.ts` | Pemilihan mode dan repository per Nuxt app/request |
| `frontend/app/services/apiRepository.ts` | Kontrak asinkron frontend, mengambil seluruh halaman, cache terbatas dan retry |
| `frontend/app/services/` | Helper domain existing yang dipakai ulang |
| `frontend/app/types/domain.ts` | Tipe domain TypeScript yang dipertahankan |
| `backend/routes/api.php` | Rute API dashboard milik proyek ini |
| `backend/app/Http/Requests/` | Validasi input filter, mode dan pagination |
| `backend/app/Http/Controllers/` | Respons HTTP |
| `backend/app/Services/` | Logika data/validasi, bukan komponen UI |
| `backend/app/Repositories/` | Kontrak data dan adapter JSON read-only |
| `backend/config/dashboard.php` | Pilihan sumber data lokal backend |
| `public/data/`, `public/demo/` | Sumber shared existing; tidak disalin menjadi data privat baru |
| `src/`, file Vite root | Frontend React lama; tetap tersedia selama transisi |

## Menjalankan di macOS

Prasyarat: Node 24 >=24.15, PHP 8.4 (lockfile proyek memerlukan >=8.4), Composer 2. Tidak perlu PHP global jika PATH terminal diarahkan ke instalasi PHP kompatibel.

Terminal backend, dari root clone:

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal frontend terpisah, dari root clone:

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev -- --port 3000
```

Buka `http://127.0.0.1:3000/simpul-jaringan`. Jangan memakai perintah `cp` untuk menimpa .env yang sudah diatur. Pada clone kedua, lewati copy bila file sudah ada. API backend menggunakan `../public` secara default. `DASHBOARD_DATA_ROOT` hanya diperlukan bila dataset diletakkan di lokasi lain oleh pengelola.

Frontend React lama masih dapat dibuka dengan `npm run dev -- --port 5175` dari root. Server 5175 dan 3000 adalah dua implementasi berbeda; lihat 3000 untuk hasil migrasi.

## Windows PowerShell

Pasang Node 24 yang kompatibel, PHP 8.4 beserta extension Laravel dan Composer 2 dari distribusi resmi. Pastikan `node -v`, `php -v`, `composer --version` berhasil pada terminal VS Code baru.

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal kedua:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev -- --port 3000
```

Composer akan memeriksa extension PHP. Jangan mengatasi masalah dengan `--ignore-platform-reqs`. Gunakan lockfile pada kedua folder. Backend tidak bergantung pada path MacBook pengguna. Konfigurasi CORS default hanya localhost:3000 dan 127.0.0.1:3000; tambahkan origin pengembangan lain secara eksplisit lewat konfigurasi backend bila diperlukan.

## Mode dan integritas data

- `/simpul-jaringan`: pilot kolaborasi, statistik/grafik tetap **DATA SIMULASI**. Nama, kode dan tahun dari snapshot Excel; pin bersumber publik dengan catatan keterbatasan per record.
- `/simpul-jaringan?data=excel`: seluruh 643 record snapshot Excel. Tanpa pin/metric yang belum tersedia, bukan fallback ke pilot.
- `/simpul-jaringan?demo=1`: tujuh instansi sintetis **DATA DEMO** untuk uji interaksi.
- ID lokal tetap sama, kode Excel duplikat tidak dijadikan satu record. Tahun bergabung tetap data pelengkap Excel.
- Tile membutuhkan internet; gagal tile tetap menyediakan wilayah/Daftar. Ini bukan aplikasi offline penuh.
- Tombol Landing Page hanya aktif untuk URL HTTPS JIKN yang sudah diverifikasi dengan metadata; lainnya disabled.
- Metadata snapshot membedakan tanggal pengambilan dan pembaruan sumber; tidak ada klaim real time.

## Kontrak API dashboard

Semua endpoint berikut **milik backend Laravel proyek ini**, bukan endpoint resmi SIKN/JIKN. Parameter `mode` adalah `pilot`, `excel` atau `demo` (default pilot).

| Metode/rute | Bentuk/tujuan |
|---|---|
| GET `/api/v1/reference-data` | `{data: ReferenceData}` |
| GET `/api/v1/institutions` | `{data: Instansi[], metadata, meta: {total,page,perPage,lastPage}}` |
| GET `/api/v1/institutions/{id}` | `{data: InstansiDetail}` atau 404 |
| GET `/api/v1/geometry/{provinceId}` | GeoJSON FeatureCollection |
| GET `/api/v1/provinces` | Daftar provinsi sesuai mode |
| GET `/api/v1/provinces/{id}/regencies` | Kabupaten/kota sesuai relasi |
| GET `/api/v1/dashboard/statistics` | Jumlah record/pin sesuai snapshot; bukan total arsip nasional |

Filter daftar: `provinceId`, `kabKotaId`, `jenisId`, `search`, `page`, `per_page`. Referensi hubungan tidak sah menghasilkan 422. Data hilang/rusak menghasilkan 503 dengan pesan aman. ID detail asing menghasilkan 404. Tidak ada fallback statistik/pin palsu.

Frontend mengambil seluruh halaman agar hitungan peta tidak berhenti pada halaman pertama. Geometri kabupaten/kota dimuat saat provinsi dipilih. Cache data bersifat per instance Nuxt/SSR request dan mode, tidak disimpan permanen; reload mengambil snapshot terbaru. Request gagal dapat diulang lewat tombol Coba lagi, tanpa mengunci error di cache. Tidak ada token rahasia di runtimeConfig.public.

## Menguji

```sh
cd backend
php artisan test
composer audit
```

```sh
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
# Jalankan backend8000 dan frontend3000 dahulu.
npm run test:e2e
```

Tes fixture browser memotong HTTP API dengan data demo di lingkungan tes saja. Tes integrasi hidup menggunakan server Laravel dan dataset existing; hasil kedua jenis uji dilaporkan terpisah. Chrome diperlukan oleh konfigurasi lokal Playwright. Untuk mesin CI tanpa Chrome, pilih Chromium yang dipasang Playwright. Tes legacy React tetap terpisah pada root.

## Tahap berikutnya untuk SIKN

Minta kontrak resmi, autentikasi, ID unik, pagination/filter, definisi statistik, rate limit, CORS/jaringan, kebijakan cache dan dokumentasi error. Tambahkan adapter resmi di backend sesuai interface repository. Rahasia tetap berada di Laravel, bukan Nuxt public. Pemetaan ID SIKN ke ID snapshot dan tahun Excel harus melalui tabel crosswalk yang diverifikasi; jangan mencocokkan agresif berdasarkan nama/kode duplikat. Frontend tetap memakai kontrak dashboard yang sama.

## Keamanan dan batas verifikasi

Workbook mentah, .local, .env, vendor, node_modules, key aplikasi lokal dan PROJECT_HANDOFF tidak masuk Git. Tidak ada commit, staging, push, merge atau deployment dalam migrasi ini. Dependensi terkunci; temuan audit transitive yang belum memiliki patch kompatibel harus ditinjau sebelum produksi. Hasil tes aktual dan keterbatasan dicatat pada `docs/hasil-qa-migrasi.md`.

Dokumentasi teknis: [Nuxt](https://nuxt.com/docs/4.x/getting-started/installation), [Vue Composition API](https://vuejs.org/api/sfc-script-setup.html), [Laravel 13](https://laravel.com/framework/docs/13.x/installation), [Leaflet](https://leafletjs.com/reference.html).
