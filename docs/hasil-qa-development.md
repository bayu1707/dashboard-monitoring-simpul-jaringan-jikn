# Hasil QA development dan Adminer — 23 Oktober 2026

Implementasi dan pemeriksaan dilakukan pada proyek existing, branch `codex/migrasi-laravel-nuxt`, dengan mempertahankan perubahan lokal sebelumnya. Tidak ada git add/commit/push/merge atau perubahan remote.

## Hasil yang sudah dibuktikan

| Pemeriksaan | Hasil |
|---|---|
| Adminer resmi 6.1.2 | Unduhan SHA256 cocok dengan digest rilis GitHub |
| Browser Adminer development | Login profil dan daftar 5 tabel terlihat |
| Browser Adminer SIKN | Login profil baca-saja, kolom/index/foreign key `repositories` terlihat |
| Laravel + PostgreSQL | 59 tes / 302 assertions lulus, termasuk 13 tes development pada database `_test` |
| Nuxt TypeScript strict | `npm run typecheck` lulus |
| Nuxt ESLint | `npm run lint` lulus |
| Nuxt unit | 49 tes lulus |
| Nuxt production build | `npm run build` lulus |
| Laravel Pint | `composer lint` lulus |
| Browser keseluruhan | 29 tes lulus, 2,3 menit: pilot/demo/Excel, SIKN nyata, development, pencarian, wilayah, cluster/spiderfy, popup/detail, keyboard dan mobile |
| Pengamanan build produksi | Endpoint proxy development mengembalikan HTTP 403 pada server preview lokal sementara; preview dihentikan setelah pemeriksaan |
| Rahasia dalam bundle client | Tidak ditemukan password/token development pada berkas client hasil build |
| Persistensi setelah restart PostgreSQL dev | 15 record sebelum dan sesudah; seluruh field dan ID sama |
| Pemeriksaan Git whitespace | `git diff --check` lulus |

Tes PostgreSQL menggunakan `jikn_dashboard_dev_test` dan rollback; tidak menulis ke salinan SIKN. Tes browser development memakai PostgreSQL/Laravel nyata dan menyimpan contoh DATA UJI pada `jikn_dashboard_dev`. Tile fixture digunakan pada tes otomatis untuk menghindari unduhan massal provider peta. Pengecekan UI tambahan pada browser pengguna menggunakan tile peta asli.

## Skenario data

- Tambah instansi di Kota Serang dengan koordinat yang dikonfirmasi: muncul di marker, hover popup, detail, tahun terpisah dari `created_at`.
- Tambah kabupaten uji `36.99`: dropdown/daftar tersedia, instansi valid dapat muncul berdasarkan pemeriksaan provinsi dan konfirmasi manual, tanpa polygon buatan. Popup marker pada wilayah baru juga diverifikasi visual pada peta asli.
- Tambah provinsi uji dan kabupaten di dalamnya: relasi/daftar tersedia; tanpa geometri provinsi tepercaya, marker tidak disahkan.
- Instansi tanpa koordinat: tetap tersimpan, dapat dicari dan dibuka pada detail; tidak memiliki pin fiktif.
- Edit nama/titik melalui API: popup dan marker berubah melalui revisi otomatis tanpa refresh manual. Saat marker masuk cluster kembali, instansi aktif diungkap ulang sebelum popup dipasang pada marker baru.
- Reload halaman: record/detail tetap ada. Restart PostgreSQL development: seluruh record tetap sama.
- Identifier ganda ditolak; sinkron ulang mempertahankan UUID. Edit dengan versi basi ditolak agar perubahan baru tidak tertimpa.
- Perubahan SQL langsung memicu revisi dan kenaikan versi. Perubahan lokasi tanpa konfirmasi baru menurunkan status dan menyembunyikan marker sampai diverifikasi ulang.
- Koordinat di luar polygon tidak diterbitkan. Tahun yang belum diketahui tetap null.
- Geocoding diuji dengan respons HTTP fixture: kandidat, cache, hasil ambigu, tidak ditemukan, kegagalan, batas laju, dan provider nonaktif. Kandidat tidak langsung menjadi marker.
- Form pengujian mobile 390 px tidak mengalami overflow horizontal.
- API write tanpa token/loopback dan proxy write tanpa Origin yang benar ditolak.

## Integritas sumber dan batasan

Salinan SIKN tetap menggunakan `sikn_analisis`: bukan superuser, tidak dapat membuat database/role, default transaksi read-only; izin INSERT/UPDATE `repositories` dan SELECT `users` tetap false. Jumlah repository SIKN tetap 776. Sumber SIKN_DB tidak ditulis; PostgreSQL inspeksi tetap memakai shadow pada volume terpisah.

Snapshot, koordinat sumber, ID instansi lama, Excel, geometri nasional, React legacy dan kontrak API vendor tidak diubah pada tugas ini. SHA256 snapshot Excel tetap `da653f461b63fd8bd9bc4b2e451f7549080a761eb5a3f69feacddd89f9293fa0`.

Geocoder nyata belum dikonfigurasi dan belum diuji pada provider eksternal; tidak ada alamat dikirim keluar untuk geocoding. Definisi keyakinan/otorisasi provider dan atribusi harus diselesaikan sebelum diaktifkan. Integrasi vendor SIKN, autentikasi produksi, pengesahan geometri wilayah baru dan pengujian Windows fisik belum termasuk hasil yang diklaim lulus.

Beberapa percobaan browser awal memerlukan penyesuaian skenario terhadap clustering dan alur detail tanpa pin yang sudah ada. Masalah aktual popup saat rebuild marker karena revisi diperbaiki pada mode development, kemudian keseluruhan 29 tes dijalankan dan lulus.

## Panduan dan bukti lokal

Cara menjalankan server, memakai Adminer, menambah data dan daftar file implementasi ada di [panduan development](pengujian-development-adminer.md).

Bukti pada `.local/qa/development/` (tetap lokal, tidak masuk Git):

- `adminer-sikn-baca-saja.png`: struktur tabel SIKN pada profil baca-saja.
- `form-pengujian.png`: halaman formulir dan data pengujian.
- `marker-wilayah-baru-peta-asli.png`: popup instansi uji pada kabupaten baru, tile asli.
- Screenshot browser otomatis: marker yang diperbarui dan form mobile, dengan tile fixture sesuai keterangan pengujian.
- `persistence.json`: perbandingan jumlah dan kesamaan record setelah restart.
