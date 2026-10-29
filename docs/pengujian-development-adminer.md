# Pengujian PostgreSQL, Adminer dan peta JIKN

## Hasil audit dan pemisahan data

Proyek tetap Laravel + PostgreSQL + Nuxt/Vue + Leaflet. Tidak ada pergantian engine, migrasi ulang SIKN, penghapusan React legacy, atau perubahan dataset sumber.

| Sumber | Pemakaian | Hak/karakter |
|---|---|---|
| JSON pilot | Peta biasa, nama/tahun Excel dan pin kurasi | Tetap; statistik DATA SIMULASI |
| JSON Excel | `?data=excel` | Katalog tanpa koordinat/statistik simulasi |
| `sikn_local` | `?data=sikn` dan profil SIKN Adminer | Salinan inspeksi SIKN pada SSD, akun `sikn_analisis` tetap SELECT terbatas/read-only |
| `jikn_dashboard_dev` | `?data=dev` dan formulir pengujian | Cluster PostgreSQL baru pada port 55440, hanya data uji |
| `jikn_dashboard_dev_test` | Tes Laravel PostgreSQL opt-in | Database otomatis terpisah; perubahan tes di-rollback |

SIKN memakai volume inspeksi dengan shadow. Volume sumber SIKN_DB tetap terpasang read-only. Tidak ada perubahan password, grants, tabel atau konfigurasi koneksi SIKN pada pekerjaan ini. Referensi SIKN lama tidak menggantikan referensi nasional 38 provinsi/514 kabupaten-kota.

Pada awal audit terdapat banyak perubahan lokal migrasi/peta/dataset yang sudah ada. Semuanya dipertahankan. Agen lama yang tercatat sudah selesai; proses Laravel/Nuxt pengguna tidak dimatikan. Pemeriksaan proses bukan jaminan bahwa editor lain tidak akan mengubah berkas setelah audit.

## Membuka fitur

- Database manager: **http://127.0.0.1:8081/**
- Form pengujian: **http://127.0.0.1:3000/pengujian?data=dev**
- Peta pengujian: **http://127.0.0.1:3000/simpul-jaringan?data=dev**
- Peta SIKN lokal sebelumnya: **http://127.0.0.1:3000/simpul-jaringan?data=sikn**

Pada Adminer, pilih profil kemudian tekan **Buka profil lokal**. Tidak perlu mengetik atau membagikan password database. Pilih **Lihat struktur**, **Pilih data**, pencarian/filter tabel, atau **Perintah SQL** dari menu Adminer. Link edit mungkin tetap terlihat pada profil SIKN, tetapi PostgreSQL menolak penulisan sesuai hak akun.

Adminer adalah [paket resmi 6.1.2](https://github.com/vrana/adminer/releases/tag/v6.1.2), dipasang lokal setelah SHA256 cocok dengan digest aset rilis. Kode vendor tidak masuk `public` atau Git. Wrapper menggunakan [mekanisme ekstensi Adminer](https://www.adminer.org/en/extension/), koneksi profil tetap dan password hanya dibaca server. Form login memakai nonce browser sementara, bukan password database. Pembatasan host/IP, Origin untuk POST, cookie SameSite, larangan iframe dan proteksi CSRF Adminer tetap digunakan. Tidak ada koneksi administrator database pada profil browser.

## Menjalankan kembali di MacBook

Jalankan dari root proyek. Binary PostgreSQL yang telah tersedia digunakan; tidak diperlukan Docker atau XAMPP.

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn
python3 scripts/setup-development.py
python3 scripts/setup-adminer.py
```

Installer idempoten: mempertahankan kredensial/record existing, mengisi referensi yang belum ada, membuat tabel development yang belum ada, dan menyiapkan fungsi/constraint lokal. Jangan jalankan installer terhadap folder data SIKN; script menggunakan folder/port/database development tetap. Opsi `--pg-bin` dapat menunjuk direktori PostgreSQL 18 yang berbeda.

Terminal Laravel, bila belum berjalan:

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn/backend
composer dev
```

Terminal Nuxt, bila belum berjalan:

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn/frontend
npm run dev -- --port 3000
```

Terminal Adminer:

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn
php -S 127.0.0.1:8081 -t .local/adminer/web tools/adminer/router.php
```

Jangan menjalankan server kedua pada port yang sama jika sudah aktif. Adminer berhenti dengan Ctrl+C pada terminalnya. Menghentikan PostgreSQL development saja:

```sh
python3 scripts/setup-development.py --stop
```

Jalankan installer kembali untuk menyalakannya; record tersimpan. Ini tidak menghentikan PostgreSQL SIKN. Profil SIKN tetap memerlukan SSD, salinan inspeksi dan sesi PostgreSQL baca-saja yang dijelaskan pada dokumentasi uji SIKN lokal. Startup development tidak memasang SSD atau memulihkan kredensial sesi SIKN.

## Menambahkan instansi dan melihat marker

1. Buka formulir pengujian. Gunakan identitas dummy/alamat publik, bukan kontak personal atau data internal.
2. Isi sumber identifier dan identifier stabil, misalnya `manual-test` / `uji-serang-001`. Nama boleh berubah; pasangan identifier menjaga identitas.
3. Pilih provinsi dan kabupaten/kota. Isi alamat, koordinat kantor bila diketahui, serta sumber URL HTTPS.
4. Centang konfirmasi koordinat hanya setelah memeriksa posisi kantor. Koordinat yang berada di luar polygon tidak diterbitkan menjadi marker.
5. Tahun bergabung boleh kosong. Tidak diisi dari waktu pembuatan record.
6. Landing Page boleh kosong. URL harus HTTPS pada pola resmi `jikn.anri.go.id/deskripsi-arsip/sj/<UUID>` dan baru aktif setelah penguji mengonfirmasi kepemilikan tautan. Jangan memakai link instansi lain untuk dummy.
7. Simpan, lalu buka **Peta DATA UJI**. Pilih provinsi → kabupaten/kota, atau gunakan pencarian global. Hover marker membuka popup; tombol detail menggunakan ID yang sama.

Email dan telepon instansi kini opsional pada formulir. Isi satu alamat email dan satu nomor telepon kantor yang diizinkan untuk pengujian; gunakan `example.invalid` untuk email dummy. Keduanya tampil pada detail dengan label sumber DATA UJI. Mengosongkan field pada form menghapus kontak dari record uji; klien lama yang tidak mengirim field kontak saat edit/sinkron ulang tidak menghapus nilai existing. Nomor disimpan sebagai teks agar angka nol di depan tetap ada. Jalankan ulang installer development untuk menambahkan dua kolom nullable secara idempoten pada database lama; ID dan record tidak diganti. Lihat [aturan kontak](kontak-instansi.md).

Record tanpa koordinat/yang perlu verifikasi tetap ada di pencarian, daftar dan detail. Statistik tidak dikarang. Label DATA UJI membedakan seluruh record ini dari instansi resmi.

Peta dan halaman detail memeriksa revisi setiap 3 detik ketika tab terlihat. Data dimuat ulang hanya jika revisi berubah; interval tidak menggambar ulang peta yang tidak berubah. Saat koneksi putus, tampilan terakhir dipertahankan dengan pemberitahuan status. Saat menambah data di tab lain, kembali ke tab peta dan tunggu siklus pemeriksaan.

## Menambahkan wilayah pengujian

Referensi nasional sudah di-seed. Untuk mencoba wilayah baru, gunakan kode yang belum tersedia, misalnya provinsi uji `99` dan kabupaten/kota `99.01`, atau kabupaten uji `36.99` di Banten.

Kode kabupaten/kota harus berawalan kode provinsi induk. Duplikasi ditolak, bukan menimpa wilayah existing. Wilayah tambahan berlabel pengujian dan **tidak dibuatkan polygon**. Wilayah tersebut dapat dipilih dari dropdown/daftar. Tidak dijanjikan dapat diklik sebagai polygon atau badge tanpa geometri/posisi label.

Untuk kabupaten uji dalam provinsi existing, marker masukan manual dapat diterbitkan setelah konfirmasi penguji dan pemeriksaan polygon provinsi; catatan menyatakan polygon kabupaten uji belum tersedia. Untuk provinsi baru tanpa geometri tepercaya, titik tetap membutuhkan peninjauan dan tidak diterbitkan. Pengesahan wilayah administratif nyata memerlukan referensi resmi baru, bukan menggambar polygon perkiraan.

## Tabel dan aturan perubahan

- `dev_regions`: provinsi/kabupaten-kota, induk, origin referensi/pengujian.
- `dev_institutions`: UUID, identifier sumber, nama, wilayah/alamat, email/telepon opsional, kandidat/koordinat, sumber/status verifikasi, tahun, tautan, versi, timestamps.
- `dev_meta`: revisi katalog yang dipantau frontend.
- `dev_audit_events`: perubahan status/versi, tanpa menyalin SQL atau seluruh isi form.
- `dev_geocode_cache`: hasil kandidat dan masa berlaku cache.

Foreign key menjaga induk wilayah; unique index mencegah duplikasi identifier. Aplikasi memakai Query Builder melalui koneksi khusus, tanpa mengganti koneksi/default database Laravel atau menambahkan model produksi baru.

Edit melalui form memerlukan versi record yang masih sesuai. Edit basi mengembalikan 409. **Uji sinkron ulang** menggunakan pasangan identifier sumber dan mempertahankan UUID, sehingga tidak menambah duplikat. Endpoint ini hanya untuk simulasi development, belum proses sinkronisasi vendor dan belum mengatur konflik kepemilikan field produksi.

Perubahan langsung melalui Adminer memicu revisi, audit dan kenaikan versi melalui trigger PostgreSQL. Perubahan lokasi/alamat langsung tanpa waktu konfirmasi baru menurunkan status menjadi `needs-review`; konfirmasi ulang melalui formulir untuk menerbitkan marker. Mengedit nama tidak memindahkan koordinat. Form adalah jalur yang disarankan karena validasi bisnis tidak seluruhnya dapat diwakili oleh constraint SQL.

## Geocoding

Adapter menerima respons kompatibel Nominatim dari provider yang dipilih tim. **Default tidak aktif dan tidak mengirim alamat keluar.** Tanpa provider, record tetap tersimpan dengan `not-configured`/perlu verifikasi.

Konfigurasi privat bagian `geocoder` memiliki `enabled`, `endpoint`, `userAgent`. Endpoint hanya dibaca konfigurasi, bukan URL dari pengguna. Jangan menaruh key/token pada URL; adapter ini belum menyediakan autentikasi khusus vendor geocoding.

Provider publik OSM tidak otomatis diaktifkan. Pemakaiannya memerlukan keputusan sadar tim atas [kebijakan Nominatim](https://operations.osmfoundation.org/policies/nominatim/), termasuk identifikasi aplikasi, maksimal satu permintaan per detik, caching, atribusi/lisensi, larangan autocomplete/bulk sistematis, dan larangan mengirim data personal/internal. Adapter mempunyai guard `publicPolicyAccepted` khusus host publik OSM, tetapi flag tersebut bukan pengganti izin maupun kepatuhan operasional. Gunakan provider berizin atau instance sendiri sesuai kebutuhan tim.

Alur yang terpasang:

1. Koordinat manual valid → pemeriksaan polygon → konfirmasi penguji → marker.
2. Tanpa koordinat dan opsi geocoding dipilih → cache 30 hari atau permintaan provider dengan timeout, lock dan jeda laju global per provider (2 detik).
3. Kandidat diperiksa rentang koordinat dan polygon wilayah. Beberapa hasil atau hasil di luar wilayah ditandai ambigu; tidak ada hasil menjadi `not-found`. Kegagalan tidak menghilangkan record.
4. **Tidak ada skor keyakinan universal yang dikarang.** Satu kandidat pun tetap belum membuktikan posisi kantor. Tinjau nama/alamat/titik, isikan kandidat ke form dan konfirmasi manual sebelum marker diterbitkan.

Respons kandidat menyimpan sumber, waktu pemeriksaan dan hasil pemeriksaan wilayah. Tidak ada penggunaan titik pusat kabupaten sebagai kantor, tidak ada geocoding saat mengetik, dan tidak ada retry massal otomatis.

## Keamanan dan batas produksi

Kredensial, token API, cluster dan cache tetap `.local`, diabaikan Git dan di luar document root. Nuxt menyimpan token di server, bukan runtimeConfig publik. Proxy development hanya tersedia pada server Nuxt dev; host lokal dan Origin JSON yang sama diperlukan untuk penulisan. Laravel juga memerlukan token privat dan request loopback. CORS API dashboard existing tetap GET/OPTIONS.

Akun aplikasi hanya mendapat SELECT/INSERT/UPDATE tabel uji; akun editor juga boleh DELETE tabel data uji. Keduanya bukan superuser, tidak dapat membuat database/role, DROP/TRUNCATE tabel, atau mengubah audit/revisi secara langsung. Adminer hanya bind 127.0.0.1. Jangan mengekspos server lewat tunnel/proxy; pembatasan localhost bukan sistem autentikasi produksi.

Jangan unggah `.local`, workbook, password, dump, atau PROJECT_HANDOFF. Tidak ada commit/push atau perubahan remote pada pekerjaan ini.

## Pengujian otomatis

```sh
# Root: siapkan database khusus tes, bukan data form pengguna
python3 scripts/setup-development.py --test-db

# backend
JIKN_DEV_PG_TEST=1 composer test
composer lint

# frontend
npm run typecheck
npm run lint
npm test
npm run build
JIKN_DEV_E2E=1 npm run test:e2e -- tests/e2e/development.spec.ts
```

Tanpa flag opt-in, tes yang membutuhkan PostgreSQL lokal dilewati pada clone/CI. Tes backend menggunakan database `_test` dengan rollback. Tes browser menyimpan contoh DATA UJI yang jelas pada database development untuk dilihat pengguna, menggunakan API PostgreSQL/Laravel nyata dan tile fixture. Pemeriksaan visual tambahan dapat memakai tile asli.

Belum diuji pada Windows fisik. Script setup saat ini menargetkan instalasi PostgreSQL/Homebrew di Mac; Windows memerlukan penyesuaian startup/socket/ACL atau lingkungan WSL yang diuji terpisah. Jangan menganggap command Homebrew berlaku langsung di Windows.

## File implementasi

- `scripts/setup-development.py`, `scripts/setup-adminer.py`: penyiapan lokal yang dapat dijalankan ulang.
- `tools/adminer/router.php`: profil lokal dan pembatasan Adminer.
- `backend/database/development/schema.php`: schema, relasi, constraints, audit/revisi/versi khusus development.
- `backend/app/Services/DevelopmentDatabase.php`, `DevelopmentService.php`, `DevelopmentLocation.php`, `DevelopmentGeocoder.php`: koneksi privat, CRUD/sync, geometri dan geocoding.
- `backend/app/Repositories/DevelopmentRepository.php`: adapter kontrak peta.
- `backend/app/Http/Controllers/Api/V1/DevelopmentController.php`: API pengujian bertoken.
- `frontend/server/api/development/[...path].ts`: proxy token server.
- `frontend/app/pages/pengujian.vue`: formulir, daftar, edit dan kandidat.
- `frontend/app/composables/useDevelopmentRefresh.ts`: pemantauan revisi.
- Integrasi kecil pada repository/router/request/validator/domain, pemilihan mode, label header/popup/detail dan tautan kembali. React legacy dan data sumber tidak diubah pada tugas ini.
- Tes baru: `backend/tests/Feature/DevelopmentPostgresTest.php`, `frontend/tests/development-repository.test.ts`, `frontend/tests/e2e/development.spec.ts`.

## Langkah menuju SIKN resmi

Saat kontrak dan izin vendor tersedia, tambahkan adapter sinkronisasi staging: UUID resmi + identifier sumber → identitas lokal stabil → validasi wilayah/koordinat/tautan → peninjauan konflik → publikasi. Tahun bergabung tetap dari sumber pelengkap tervalidasi atau null. Jangan menjadikan `created_at` sebagai tahun bergabung, atau memindahkan seluruh data uji ke produksi. Definisi statistik, autentikasi, pemetaan ID yang belum cocok, pagination, rate limit dan hak publikasi masih perlu kesepakatan vendor.
