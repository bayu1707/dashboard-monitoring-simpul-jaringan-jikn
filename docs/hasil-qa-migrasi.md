# Hasil pemeriksaan migrasi Laravel + Nuxt

Pemeriksaan lokal macOS, 21–22 Oktober 2026. Lokasi kerja final: clone `dashboard-monitoring-simpul-jaringan-jikn`, branch `codex/migrasi-laravel-nuxt`. Source dan konfigurasi disimpan secara lokal; tidak ada git add, commit, push, merge, atau deployment.

## Versi aktual

| Bagian | Versi |
|---|---|
| Node | 24.19.0 |
| Nuxt / Vue | 4.6.2 / 3.5.44 |
| TypeScript | 5.9.3, strict |
| Leaflet / markercluster | 1.9.4 / 1.5.3 |
| Lucide Vue | @lucide/vue 1.61.0 |
| Nitro / Vite Nuxt | 2.13.5 / 8.3.5 |
| Laravel | 13.38.0 |
| PHP yang dipakai pengujian | 8.4.26 |
| Composer / PHPUnit | 2.10.3 / 12.5.40 |

PHP dan Composer dipasang melalui Homebrew setelah persetujuan eksplisit pengguna. Dependency Composer juga memasang PHP 8.5.11; tidak ada service Apache/FPM yang dinyalakan. Laravel proyek menggunakan PHP ^8.4 karena lockfile Symfony 8. Gunakan `/opt/homebrew/opt/php@8.4/bin/php` atau PATH PHP 8.4 di depan PATH terminal. Tidak ada perubahan konfigurasi shell pengguna.

## Preservasi data dan pekerjaan sebelumnya

Checksum **92 file** `src`, `public` dan `data/curation` yang dicatat sebelum migrasi dibandingkan kembali: **seluruhnya tetap sama**. Manifest shared existing juga lulus untuk 44 file dataset. Source React, perbaikan badge wilayah yang belum di-commit, dataset dan ID tidak ditimpa. README diperluas dengan panduan migrasi; konfigurasi lint root mengecualikan folder frontend/backend baru agar pemeriksaan React tidak membaca source Vue/PHP.

| Mode | Instansi | Pin | Provinsi | Kab/kota |
|---|---:|---:|---:|---:|
| Pilot | 418 | 417 | 16 | 273 |
| Excel penuh | 643 | 0 | 38 | 514 |
| Demo sintetis | 7 | 6 | 38 pada referensi demo | 8 |

Respons API dibandingkan dengan sumber: identitas/nama/tahun/koordinat/metadata tetap cocok. Semua geometri kab/kota pilot 273 dan nasional 514 diperiksa lewat HTTP. Dua kode referensi Excel duplikat tetap memiliki record/ID masing-masing. Satu instansi pilot tanpa pin tetap tersedia di Daftar.

## Pemeriksaan yang benar-benar dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `frontend: npm ci` | Lulus dengan lockfile |
| `frontend: npm run typecheck` | Lulus |
| `frontend: npm run lint` | Lulus, tanpa warning setelah format |
| `frontend: npm test` | **44 tes lulus**, 5 file |
| `frontend: npm run build` | Lulus client + server Nuxt/Nitro |
| `frontend: npm run test:e2e -- --output=test-results-final` | **9 tes browser lulus**, 37,8 detik, Chrome |
| `backend: composer install` | Lulus dengan lockfile |
| `backend: php artisan test` | **37 tes / 121 assertion lulus** |
| `backend: composer lint` | Pint lulus |
| PHP syntax 30 file, Composer validate/platform | Lulus |
| `backend: composer audit` | Tidak ada advisory |
| HTTP langsung semua mode dan geometri | Lulus |
| Legacy root: validate:shared, typecheck, lint, build | Lulus |
| Legacy root: `npm test -- --maxWorkers=1` | **139 tes lulus**, 14 file |

Run legacy dengan worker paralel sempat tertunda sangat lama dan timeout. Ulang satu worker lulus 139 tes tanpa perubahan logika/kode legacy. Tidak menutupi hasil run awal sebagai lulus.

## Cakupan sembilan tes browser

Lima tes integrasi memakai **API Laravel hidup di port8000** dan Nuxt di port3000; respons API data tidak di-mock:

1. Pagination seluruh mode, ID unik, jumlah pin, kesamaan record pilot, geometri Banten, error404 dan filter422.
2. Pilot → Daftar ANRI → pratinjau tahun2015 → URL Landing Page terverifikasi → detail → kembali; lalu katalog Excel643/0pin.
3. Pemilihan Banten, Aceh dan Jawa Tengah, lazy geometry, dropdown provinsi/kab/kota/jenis sinkron.
4. Mobile390: draft filter dibatalkan/diterapkan, reset, tanpa overflow horizontal, ID detail tidak ditemukan.
5. Tile sengaja digagalkan: pesan peta gagal, Daftar dan detail Excel tanpa pin/metric tetap digunakan.

Empat tes regresi peta menggunakan respons API fixture di lapisan tes; fixture berasal dari data demo existing dan tidak digunakan aplikasi produksi. SSR awal dapat membaca backend lokal; tes ini tidak dihitung sebagai pengganti tes integrasi hidup:

6. Klik wilayah provinsi → kab/kota → cluster/spiderfy → hover → tombol detail → kembali satu tingkat.
7. Pergantian cepat marker A/B; timer200ms tidak menutup popup baru; panah mengikuti marker hasil spiderfy; metric0/null; keyboard/fokus/Escape; popup tutup saat cakupan berubah.
8. Badge tetap pada koordinat sumber sampai zoom dunia; pusat DOM dibandingkan proyeksi Mercator sumber, toleransi1,6px. Tidak ada leader line/displacement.
9. Mobile390: tap marker spiderfy → sheet → detail → kembali; tidak ada scroll horizontal.

Panah native popup diuji terhadap marker DOM aktif dengan toleransi2px, termasuk marker berkoordinat sama setelah spiderfy. Semua tes browser lulus tanpa pageerror pada skenario yang merekam runtime error. Beberapa tes memakai tile fixture untuk kestabilan/ketergantungan jaringan; itu bukan bukti tile internet hidup.

Pengambilan screenshot pilot terpisah memakai **data API Laravel dan tile OpenStreetMap sungguhan**, 1440×900: 40 tile termuat, popup Dinas Perpustakaan dan Kearsipan Provinsi BANTEN tampil, tidak ada pageerror.

## Masalah migrasi yang ditemukan dan diperbaiki

- PHP associative JSON sempat mengubah `metricDefinitions: {}` menjadi `[]`. Serialisasi objek kosong dipertahankan dan ditambah tes.
- Wrapper `.client` Nuxt menyediakan DOM setelah mounted pertama. Inisialisasi Leaflet menunggu `nextTick`, sehingga peta tidak tertinggal sebagai canvas kosong.
- Import langsung komponen Leaflet client dari halaman SSR diganti autoimport Nuxt agar Leaflet tidak dievaluasi di server.
- Filter/Daftar sempat dapat ditekan pada HTML SSR sebelum event Vue aktif. Kontrol kini disabled sampai onMounted.
- ID detail pada session dipertahankan saat unmount; request preview memakai generation guard, timer memakai owner guard.
- Respons gagal/invalid dibuang dari cache repository, sehingga retry tidak membaca kegagalan yang sama terus-menerus.

## Bukti tampilan

![Pilot dengan Laravel dan tile internet](qa/migrasi/popup-pilot-laravel-1440.png)

![Demo desktop, tile fixture](qa/migrasi/nuxt-popup-desktop.png)

![Demo sentuh390, tile fixture](qa/migrasi/nuxt-popup-mobile-390.png)

Inventaris file aplikasi baru: [file-migrasi.json](qa/migrasi/file-migrasi.json). Ringkasan integritas: [integritas-data.json](qa/migrasi/integritas-data.json).

## Batasan dan tindak lanjut

- **API resmi SIKN/JIKN belum terhubung.** API yang berjalan adalah REST Laravel proyek untuk snapshot existing; tahun bergabung tetap berasal dari Excel.
- `npm audit` frontend mencatat **11 entri high** pada rantai dependency Nuxt/Nitro, dengan dua advisory akar pada `braces <=3.0.3` dan `node-forge <=1.4.0`. Versi registry saat pemeriksaan belum menawarkan patch kompatibel untuk kedua akar tersebut. Tidak menjalankan audit fix --force atau downgrade Nuxt diam-diam. Ini perlu peninjauan keamanan/pembaruan sebelum produksi; build/test yang lulus tidak berarti audit keamanan bersih.
- PHP/Laravel Composer audit bersih pada waktu pemeriksaan.
- Belum dijalankan pada laptop Windows fisik maupun CI GitHub. Workflow matrix Windows/Linux disiapkan, belum dikirim/dijalankan. Ikuti panduan Windows dan jalankan seluruh perintah yang sama.
- Desktop1440 dan perangkat sentuh390 diuji lewat Chrome/Playwright. Safari, perangkat Android/iOS fisik, dan zoom browser200% masih memerlukan verifikasi manual. Untuk zoom200%, ubah zoom Chrome lewat menu browser, pastikan toolbar/daftar/detail tidak overflow dan kembalikan100%.
- Belum ada benchmark produksi atau uji beban banyak pengguna. PHPUnit memakai budget512MB untuk beberapa salinan snapshot/geometri; endpoint lokal diuji dengan batas CLI128MB.
- Database, autentikasi, pemetaan ID resmi SIKN dan aturan cache integrasi resmi ditetapkan setelah kontrak vendor tersedia. Jangan memasukkan token dalam NUXT_PUBLIC.
- Workbook mentah, .local, .env dan kedua PROJECT_HANDOFF tetap lokal/ignored. Tidak ada unggahan data baru atau deployment.
