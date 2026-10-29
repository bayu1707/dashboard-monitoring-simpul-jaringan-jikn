# Backend Laravel Dashboard JIKN

Default API membaca snapshot JSON yang sudah disetujui, **tanpa PostgreSQL atau database SSD 22 GB**. Mode SIKN lokal dan DATA UJI bersifat opt-in dan memerlukan konfigurasi/database masing-masing. Backend ini **belum terhubung API resmi SIKN/JIKN**; tahun bergabung tetap berasal dari Excel pendukung, statistik pilot tetap DATA SIMULASI. Ikuti [panduan clone tanpa database](../docs/kolaborasi-tanpa-database.md).

## Menjalankan

Proyek ini memilih **PHP 8.4+** sesuai dependency lock yang diuji (Laravel sendiri mendukung PHP 8.3+), Composer 2, ekstensi JSON, mbstring, openssl, ctype, filter, tokenizer, XML, PDO dan SQLite bila nanti memakai basis data. Di macOS/Homebrew dapat memakai PHP 8.4; Windows dapat memakai PHP yang kompatibel melalui Laravel Herd atau instalasi PHP resmi.

```sh
composer install
cp .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

PowerShell mengganti `cp` dengan `Copy-Item .env.example .env`. `APP_KEY` hanya lokal, tidak dikomit. Data berada pada `../public`; `DASHBOARD_DATA_ROOT` opsional untuk path absolut lain. `FRONTEND_ORIGINS` berisi origin Nuxt yang diizinkan, dipisahkan koma. Tidak ada password/token di variabel frontend.

Tidak perlu migrasi, membuat file SQLite, atau menyalakan database untuk menjalankan adapter JSON. Template `.env.example` memakai session/cache array dan queue sync. Mode opsional SIKN/Development tidak dijalankan atau disiapkan otomatis pada clone baru.

## Kontrak REST v1

- `GET /api/v1/reference-data?mode=pilot|excel|demo` → `{data: ReferenceData}`.
- `GET /api/v1/institutions?mode=pilot&provinceId=36&kabKotaId=36.73&jenisId=lkd-kota&search=arsip&page=1&per_page=250` → `{data: Instansi[], metadata, meta: {total,page,perPage,lastPage}}`.
- `GET /api/v1/institutions/{id}?mode=pilot` → `{data: InstansiDetail}`; tidak ditemukan 404.
- `GET /api/v1/geometry/{provinceId}?mode=pilot` → FeatureCollection, geometri kab/kota dimuat per provinsi.
- `GET /api/v1/provinces`, `/api/v1/provinces/{provinceId}/regencies` → `{data: Wilayah[]}`.
- `GET /api/v1/dashboard/statistics?mode=pilot` → jumlah instansi, terpetakan, tanpa koordinat dan metadata. **Bukan total arsip nasional.**

Default `mode=pilot`. Pagination maksimal 250; frontend perlu mengambil semua halaman untuk ringkasan katalog. Search mengandung nama atau kode, tidak peka kapital. Filter valid diterapkan AND; pasangan provinsi/kabupaten yang bertentangan ditolak 422. Instansi tanpa koordinat tetap ada. Error sumber hilang/JSON rusak/domain tidak sah mengembalikan 503 `DATASET_UNAVAILABLE` tanpa path/isi sumber. Retry membaca sumber yang sama, bukan dataset demo. HTTP error tidak dicache.

`InstansiRepository` → `JsonSnapshotRepository` → `DatasetValidator` → `DashboardService` → controller/FormRequest. Adapter API resmi di masa depan harus mempertahankan kontrak domain dan pemetaan ID, bukan menyusun ulang ID dari nama. Endpoint lokal ini dirancang untuk dashboard; nama endpoint API resmi vendor belum diketahui.

## Pengujian

```sh
composer test
composer lint
php artisan route:list --path=api
```

Tes membandingkan record sumber secara utuh, seluruh halaman, 418/417 pilot, 643 Excel, tujuh demo, geometri/relasi/filter/search/null/nol/404/422, CORS dan sumber rusak. JSON sumber tidak dimutasi. Hanya sumber publik yang disetujui dibaca; workbook, `.local`, `.env.local` dan PROJECT_HANDOFF tidak dibuka oleh API.

Versi aktual pengujian: PHP 8.4.26, Composer 2.10.3, Laravel 13.38.0, PHPUnit 12.5.40, Pint 1.32.1. PHPUnit memakai budget memori 512 MB untuk membandingkan beberapa salinan snapshot/geometri sekaligus; endpoint lokal berhasil diuji dengan batas CLI standar 128 MB.
