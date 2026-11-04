# Kolaborasi Nuxt + Laravel tanpa database SSD

Panduan 29 Oktober 2026 untuk aplikasi aktif pada `frontend/` dan `backend/`. Source React pada root `src/` tetap tersedia sebagai legacy.

## Apa yang didapat anggota tim?

Default aplikasi adalah **pilot dari snapshot JSON bersama**:

```text
Browser Nuxt/Vue port 3000
  → API Laravel port 8000
  → public/data/datasets + geometri nasional + public/demo
```

Katalog pilot berisi 643 instansi, 627 pin dan 16 record tanpa koordinat. Referensi mencakup 38 provinsi dan 514 kabupaten/kota. Tahun bergabung berasal dari snapshot Excel; statistik pilot berlabel **DATA SIMULASI**. Instansi tanpa pin tetap dapat ditemukan melalui pencarian/Daftar. URL Landing Page aktif hanya jika sudah diverifikasi.

Ini bukan ekspor statistik/kontak dari database SIKN Maret 2026. Tidak ada database 22 GB, password, kontak privat, crosswalk privat, atau file shadow yang diperlukan untuk menjalankan pilot.

| Mode | URL peta | Kebutuhan tambahan |
| --- | --- | --- |
| Pilot default | `/simpul-jaringan` | Tidak perlu database |
| Excel penuh | `/simpul-jaringan?data=excel` | Tidak perlu database; tanpa pin/statistik simulasi |
| Demo sintetis | `/simpul-jaringan?demo=1` | Tidak perlu database |
| SIKN lokal | `/simpul-jaringan?data=sikn` | Salinan SSD, PostgreSQL dan konfigurasi privat milik penguji |
| DATA UJI | `/pengujian?data=dev` | PostgreSQL Development dan penyiapan lokal tersendiri |

Clone tanpa konfigurasi privat tetap boleh menyimpan kode fitur SIKN/DATA UJI. Jika mode opsional itu dibuka sebelum disiapkan, aplikasi menampilkan sumber tidak tersedia; tidak mengganti data SIKN dengan statistik simulasi secara diam-diam. Untuk pengujian kolaborasi tanpa database gunakan URL pilot default.

## File yang diperlukan dan yang tetap lokal

Sertakan source `frontend/`, `backend/`, aset frontend, `public/data/` (snapshot/referensi/geometri yang disetujui), `public/demo/`, kedua dependency lockfile, konfigurasi/tes/workflow dan dokumentasi. Pertahankan struktur folder: Laravel secara default membaca `../public` relatif terhadap `backend`.

Tidak disertakan: `.local/`, `.env`/`.env.local`, kredensial/token, `PROJECT_HANDOFF_BRIEF.md`, `PROJECT_HANDOFF_FULL.md`, workbook mentah, PostgreSQL PGDATA, image SSD/shadow/dump, `node_modules`, `vendor`, `.nuxt`, `.output`, log dan cache. `.env.example` boleh dibagikan karena template publik tanpa secret.

PDF belajar dan folder output lokal tidak dibutuhkan untuk menjalankan dashboard; perintah staging di bawah memilih source dan dokumentasi proyek secara eksplisit.

## Prasyarat laptop tim

- Git dan izin akses repository GitHub.
- Node **24.19.0** sesuai versi proyek; engine frontend menerima `>=24.15.0 <25`. npm mengikuti instalasi Node.
- PHP **8.4+** yang memenuhi Composer lock, Composer 2, dan extension yang diminta Composer/Laravel, termasuk `fileinfo`. Pada Windows, pastikan extension tersebut aktif di PHP CLI yang dipakai terminal; `php --ri fileinfo` harus menampilkan informasi extension sebelum menjalankan `composer install`. Jangan memakai `--ignore-platform-reqs`.
- Internet untuk clone, dependency dan tile peta OpenStreetMap. Ini belum aplikasi offline penuh.

Tidak perlu PostgreSQL/MySQL, XAMPP, Adminer atau DBeaver untuk pilot. Pemeriksaan backend tertentu menggunakan SQLite fixture untuk tes; extension `pdo_sqlite` dibutuhkan untuk suite tersebut, bukan database SSD.

Periksa terminal baru setelah mengatur PATH:

```sh
git --version
node --version
npm --version
php --version
composer --version
```

## Clone branch yang memuat migrasi

Selama migrasi belum digabung ke main, clone branch fitur ini agar Nuxt/Laravel ikut terbawa:

```sh
git clone --branch codex/migrasi-laravel-nuxt https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn.git
cd dashboard-monitoring-simpul-jaringan-jikn
```

Branch ini sudah tersedia di GitHub melalui [PR #4](https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn/pull/4). `git clone` biasa mengambil branch default GitHub; sebelum merge, branch itu belum tentu memuat migrasi ini. Setelah PR digabung ke main dengan persetujuan pemilik, anggota dapat memakai clone biasa.

## Pemasangan pertama: backend

Buka terminal pertama dari root clone:

```sh
cd backend
composer install
php -r "if (!file_exists('.env')) copy('.env.example', '.env');"
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

Langkah copy dan pembuatan key di atas ditujukan untuk **clone baru**. Pada instalasi existing, jangan menimpa environment atau membuat ulang key yang sudah dipakai. Untuk startup harian cukup jalankan perintah `serve` (atau `composer dev`).

Perintah tersebut sama untuk terminal macOS, Git Bash atau PowerShell. Tidak perlu `php artisan migrate`, membuat file SQLite atau menyalakan database. Root `http://127.0.0.1:8000/` dapat menampilkan 404 karena backend menyediakan route API. Uji route sebenarnya:

<http://127.0.0.1:8000/api/v1/dashboard/statistics?mode=pilot>

Respons seharusnya HTTP 200 dengan JSON. Biarkan terminal backend aktif.

## Pemasangan pertama: frontend

Buka terminal kedua dari root clone:

```sh
cd frontend
npm ci
npm run dev -- --port 3000
```

Default `apiBase` sudah `http://127.0.0.1:8000/api/v1`. Environment frontend tidak wajib dibuat untuk konfigurasi ini. Jangan menyalin `.env` pribadi dari MacBook pengembang.

Buka <http://127.0.0.1:3000/simpul-jaringan>. Jalankan Nuxt dari `frontend/`; `npm run dev` pada root menjalankan React/Vite legacy. Pastikan port 3000 dan 8000 tidak sedang dipakai server lain.

## Verifikasi di laptop anggota tim

1. Pilot default terbuka dan berlabel DATA SIMULASI, tanpa permintaan memasang database.
2. Daftar/pencarian bisa menemukan katalog 643 record; angka pin 627, 16 tanpa pin.
3. Pilih provinsi, kabupaten/kota, lalu jenis instansi; dropdown sinkron dengan peta.
4. Hover marker membuka popup; perpindahan ke tombol stabil. Klik detail menampilkan record dan tahun yang sama.
5. Uji cluster/spiderfy pada demo sintetis, serta navigasi kembali dan Reset.
6. Landing Page ANRI yang sudah diverifikasi aktif; yang belum tersedia tetap disabled.
7. Mode Excel tetap 643 record tanpa marker; mode demo tetap tujuh record sintetis.
8. Tidak ada akses ke path MacBook, konfigurasi `.local` atau port PostgreSQL saat memakai pilot.

Jalankan dari `backend/` bila ingin memeriksa suite backend:

```sh
composer test
composer lint
```

Dari `frontend/`:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tes browser membutuhkan browser yang sesuai konfigurasi Playwright dan server API/frontend. CI memiliki workflow Nuxt/Laravel untuk Ubuntu/Windows; status lulus baru dapat dinyatakan setelah workflow benar-benar berjalan. Pengujian database opsional hanya aktif jika flag opt-in sengaja dipasang.

## Persiapan commit dan push oleh pemilik

Perintah berikut disediakan untuk dijalankan pengguna setelah meninjau perubahan; dokumen ini tidak menjalankan Git atau mengirim data.

Periksa branch dan perubahan:

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn
git branch --show-current
git status --short
```

Branch yang disiapkan ialah `codex/migrasi-laravel-nuxt`. Jika hasil berbeda, jangan lanjutkan blok berikutnya sebelum memastikan branch tujuan. Hindari memindahkan branch saat ada perubahan yang belum dipahami.

Validasi paket JSON yang dibagikan (memakai dependency root legacy yang sudah terpasang pada laptop pengembang):

```sh
npm run validate:shared
```

Pilih source/config/data/dokumentasi secara eksplisit; dependency terpasang, rahasia dan database diabaikan `.gitignore`:

```sh
git add -- .gitignore README.md eslint.config.js package.json .github frontend backend public src tests scripts data tools
git add -- 'docs/*.md'
git diff --cached --stat
git diff --cached --name-only
```

Pastikan daftar hanya file yang ingin dibagikan. Jangan lanjut jika ada `.local`, environment privat, workbook, dump/image/shadow, PGDATA atau PROJECT_HANDOFF. Jangan memakai `git add -f` untuk file tersebut. PDF belajar/output lokal dan screenshot/laporan JSON baru pada `docs/qa/migrasi` tidak termasuk pilihan staging di atas; artefak itu bukan kebutuhan runtime.

Setelah review, jalankan:

```sh
git commit -m "feat: siapkan dashboard Nuxt Laravel dan snapshot nasional tanpa database SSD"
git push -u origin codex/migrasi-laravel-nuxt
```

Jika push ditolak karena branch remote lebih maju atau aturan repository, hentikan dan periksa penyebabnya; jangan gunakan `--force`. Push branch fitur belum mengubah main. Buat PR untuk review; merge merupakan langkah terpisah setelah persetujuan dan CI lulus.

## Menyalakan lagi dan menghentikan

Setelah dependency terpasang, startup harian tidak perlu `composer install` atau `npm ci` lagi kecuali lockfile berubah. Jalankan Laravel `serve` dari backend dan Nuxt `dev` dari frontend. Hentikan masing-masing dengan Control+C. Tidak ada database SSD yang perlu dipasang atau dihentikan pada mode pilot.

## Hasil persiapan lokal 29 Oktober 2026

- Validator shared dataset lulus: pilot 643, Excel 643, 44 file manifest/checksum valid.
- Salinan sumber terpisah dibuat tanpa `.local`, database SSD, database SQLite aplikasi, environment pribadi atau credential SIKN. Template environment publik dipakai dengan key pengujian baru. Vendor PHP disalin dan dependency Node existing dipakai ulang; ini uji sumber terisolasi, bukan klaim pemasangan dependency baru di laptop Windows.
- Laravel dan Nuxt pengujian dijalankan di port 18000/23000, terpisah dari server pengguna. HTTP pilot 200 (643/627 pin), Excel 200 (643/0 pin), demo 200 (7/6 pin). Mode SIKN dan DATA UJI menghasilkan 503 karena memang tidak disiapkan, tanpa mengganggu pilot.
- `composer test`: 52 lulus, 295 assertions; 15 tes PostgreSQL Development dilewati karena tidak memakai database tersebut. Tes unit yang memerlukan SQL memakai fixture tes, bukan database SSD.
- Lima tes browser `live-integration.spec.ts` lulus: pagination/geometri/identitas, detail ANRI/Landing Page/tahun/kembali/Excel, dropdown wilayah, mobile 390 px, dan kegagalan tile tetap menyediakan akses daftar/detail. API dan sumber JSON nyata dipakai; tile di-fixture untuk menghindari unduhan provider berlebihan.
- Server pengujian dihentikan setelah pemeriksaan. Server pengguna tidak dihentikan atau dikonfigurasi ulang pada persiapan ini.
- Nuxt memberi peringatan payload SSR sekitar 4,5-6 MB karena katalog/referensi dikirim ke halaman. Tes tetap lulus; pengurangan payload adalah pekerjaan performa terpisah, belum dilakukan pada persiapan push ini.
- Tidak ada staging, commit, push, merge atau deployment. `.gitignore` diperkuat untuk image/shadow/dump/PGDATA dan kedua PROJECT_HANDOFF di seluruh folder. Tampilan, kontrak API dan dataset tidak diubah dalam persiapan ini.
- Instalasi baru pada Windows fisik dan hasil CI GitHub belum diuji pada sesi ini. Ikuti langkah clone dan periksa workflow setelah pengguna melakukan push.
