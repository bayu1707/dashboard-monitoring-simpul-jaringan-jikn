# Audit Dashboard Monitoring Simpul Jaringan JIKN

Tanggal: **24 Oktober 2026 — Asia/Jakarta**. Workspace yang diperiksa: `/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn`, branch `codex/migrasi-laravel-nuxt`.

## Kesimpulan

Alur utama berjalan dan seluruh pemeriksaan otomatis yang dijalankan lulus. Namun proyek belum bebas bug: ditemukan **empat masalah aplikasi**, satu ketidakkonsistenan dokumentasi, serta peringatan dependensi frontend. Dua masalah frontend dibuktikan melalui interaksi Chrome terpisah; satu masalah backend dibuktikan pada validator di memori beserta penelusuran alur; satu masalah verifikasi URL dibuktikan dari kode trigger/repository tanpa menulis database.

Audit ini tidak memperbaiki source aplikasi. Hasilnya adalah laporan ini, [panduan belajar lengkap](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/docs/panduan-flow-dan-pondasi-proyek.md), dan bukti QA yang tetap lokal. Tidak ada commit, push, merge, perubahan kredensial atau penulisan ke SIKN. Tes browser menambahkan tiga record dummy DATA UJI ke PostgreSQL development terpisah, sesuai alur tes existing; tes backend PostgreSQL menggunakan database `_test` dan rollback.

## Cakupan dan hasil pemeriksaan

| Pemeriksaan yang benar-benar dijalankan | Hasil |
|---|---|
| `JIKN_DEV_PG_TEST=1 composer test` di backend | 67 tes, 364 assertions lulus |
| `composer lint` | Lulus |
| `npm run typecheck` di frontend | Lulus |
| `npm run lint` | Lulus |
| `npm test` | 50 tes lulus |
| `npm run build` | Lulus |
| `JIKN_DEV_E2E=1 SIKN_LOCAL_TEST=1 npm run test:e2e` | 30 tes browser lulus, sekitar 2,9 menit |
| Browser tambahan: jaringan refresh gagal dan tombol tutup popup | Menemukan dua bug, dijelaskan di bawah |
| Pemeriksaan browser in-app: Kerinci → provinsi Jambi | URL, dropdown dan lapisan berpindah sesuai; tidak ada error/warning console pada tab audit |
| HTTP filter kabupaten beda provinsi | 422, sesuai aturan |
| HTTP detail ID tidak ditemukan | 404, sesuai aturan |
| `composer audit --locked --format=json` | Tidak ada advisory paket/abandoned yang dilaporkan saat pemeriksaan |
| `npm audit --omit=dev --json` | 8 paket ditandai: 7 high, 1 low, terhubung ke dua advisory langsung |

Suite mencakup navigasi nasional/provinsi/kabupaten, cluster/spiderfy, hover/anchor, pergantian pilihan cepat, pencarian global, filter, detail, Landing Page, nilai nol/null, mode Excel, kontak SIKN nyata, serta form DATA UJI. Pengujian responsif mencakup viewport 390 px. Banyak tes menggunakan tile fixture agar tidak bergantung jaringan peta; tes live tidak mengganti API Laravel dengan mock. Audit tambahan kegagalan jaringan memang menggunakan interceptor khusus pada browser pengujian, tanpa menghentikan layanan nyata.

Tes lulus berarti skenario yang sudah ditulis bekerja. Itu tidak membuktikan semua kombinasi input, jaringan dan aksesibilitas sudah ditangani. Empat temuan di bawah memperlihatkan celah cakupan tes saat ini.

## Temuan aplikasi

### A1 — P2: peta DATA UJI menghilang ketika pembaruan otomatis gagal

**Status bukti:** direproduksi pada Chrome terpisah. Tidak memutus koneksi pengguna atau mengubah database.

**Langkah:** buka `/simpul-jaringan?data=dev`; simulasi revisi baru pada respons status; gagalkan request daftar instansi/referensi pada browser pengujian. Pada polling berikutnya, seluruh peta berubah menjadi layar “Data belum dapat dimuat / Failed to fetch”. Setelah simulasi dilepas, peta muncul kembali.

**Hasil aktual:** jumlah elemen peta berubah **1 → 0 → 1**. Data terakhir tidak dipertahankan saat request baru gagal, walaupun pesan composable menyatakan demikian.

**Penyebab:** callback refresh mengosongkan pratinjau lalu memanggil `refresh()`. Template memilih layar error apabila `error || !data`, termasuk ketika sebelumnya sudah ada data yang dapat digunakan.

**Lokasi:** [index.vue:393](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/frontend/app/pages/simpul-jaringan/index.vue:393), [cabang error:427](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/frontend/app/pages/simpul-jaringan/index.vue:427), [useDevelopmentRefresh.ts:13](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/frontend/app/composables/useDevelopmentRefresh.ts:13).

**Perbaikan yang disarankan:** ambil snapshot baru ke penampungan sementara; ganti data aktif hanya setelah pemuatan dan validasi sukses. Jika gagal, pertahankan instance peta/data terakhir dan tampilkan status koneksi. Pisahkan error pemuatan pertama dari error pembaruan.

**Kriteria tes baru:** sesudah data awal tampil, kegagalan refresh tidak menghilangkan peta; status offline terlihat; pemulihan jaringan memperbarui data tanpa menggandakan listener/marker.

### A2 — P2: tautan Landing Page duplikat dapat menggagalkan seluruh katalog DATA UJI

**Status bukti:** validator dijalankan pada salinan dua record dalam memori dan menghasilkan alasan `landing-duplicate`. Alur simpan → penolakan katalog ditelusuri pada kode. Tidak membuat kondisi duplikat pada database pengguna dan tidak mengklaim HTTP503 tersebut diuji dengan data persisten.

**Pemicu:** dua instansi berbeda disimpan dengan URL Landing Page yang sama. Form/API memeriksa bentuk URL tetapi tidak keunikannya; database hanya mempunyai indeks unik identifier sumber. Saat katalog dibaca kembali, validator menolak duplikasi URL untuk seluruh snapshot. `DevelopmentRepository` mengubah penolakan itu menjadi layanan tidak tersedia (503), sehingga dampaknya dapat mencakup peta, referensi dan detail mode dev.

**Lokasi:** [DevelopmentService.php:81](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/app/Services/DevelopmentService.php:81), [payload:134](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/app/Services/DevelopmentService.php:134), [DatasetValidator.php:244](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/app/Services/DatasetValidator.php:244), [DevelopmentRepository.php:81](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/app/Repositories/DevelopmentRepository.php:81).

**Perbaikan yang disarankan:** tolak konflik URL sebelum simpan dengan 409/422, dan tambahkan perlindungan keunikan URL canonical pada database. Record yang sedang diedit harus dikecualikan dari pengecekan dirinya sendiri; jangan menimpa instansi pemilik URL lain.

**Kriteria tes baru:** penyimpanan instansi kedua ditolak; instansi pertama tetap ada; daftar/referensi/detail tetap HTTP200. Uji melalui API dan transaksi database `_test`, termasuk perubahan huruf besar-kecil UUID.

### A3 — P2: perubahan URL lewat Adminer mempertahankan konfirmasi URL lama

**Status bukti:** temuan kode/trigger; belum direproduksi dengan penulisan database.

**Pemicu:** instansi DATA UJI sebelumnya mempunyai `landing_verified=true`. Penguji mengubah hanya `landing_page_url` lewat Adminer. Trigger mengubah versi/waktu update tetapi tidak membatalkan verifikasi tautan. Repository kemudian menganggap URL baru terverifikasi dan menggunakan `updated_at` sebagai waktu verifikasinya.

**Lokasi:** [schema.php:61](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/database/development/schema.php:61), [DevelopmentRepository.php:71](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/backend/app/Repositories/DevelopmentRepository.php:71).

**Perbaikan yang disarankan:** batalkan konfirmasi ketika URL berubah tanpa tindakan verifikasi baru. Simpan waktu konfirmasi tersendiri, misalnya kolom timestamp verifikasi, sehingga mengedit nama atau alamat tidak memperbarui bukti verifikasi tautan. Definisikan identitas pemeriksa ketika sistem pengelolaan produksi tersedia.

**Kriteria tes baru:** perubahan URL langsung menjadikannya `needs-review` dan tombol tidak aktif; setelah konfirmasi eksplisit baru tombol aktif. ID instansi tetap sama dan tidak membuat URL duplikat.

### A4 — P3: fokus keyboard hilang setelah menutup popup dengan tombol

**Status bukti:** direproduksi pada Chrome terpisah.

**Langkah:** cari ANRI secara global, tekan Enter, fokuskan tombol “Tutup popup”, lalu Enter. Popup tertutup, tetapi fokus berpindah ke `BODY`, bukan kembali ke marker/pemicu yang relevan. Escape memakai cabang penutupan yang berbeda.

**Penyebab:** `close(id)` memulihkan fokus hanya saat parameter ID tidak diberikan; tombol tutup meneruskan ID. Pemulihan fokus dan kepemilikan popup perlu dipisahkan.

**Lokasi:** [index.vue:161](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/frontend/app/pages/simpul-jaringan/index.vue:161), [MapView.client.vue:734](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/frontend/app/components/map/MapView.client.vue:734).

**Perbaikan yang disarankan:** bedakan penutupan otomatis karena pointer/marker dari penutupan eksplisit pengguna. Tombol tutup dan Escape seharusnya mengembalikan fokus ke elemen pemicu yang masih ada.

**Kriteria tes baru:** setelah menutup lewat tombol maupun Escape, fokus berada pada elemen yang dapat dipakai untuk melanjutkan navigasi; tidak membuka popup kembali karena focus handler.

## Dependensi: temuan audit terpisah dari bug aplikasi

Hasil npm menghitung paket yang terdampak secara transitif, bukan delapan celah berbeda. Rantai yang terpasang:

```text
nuxt@4.6.2 → @nuxt/nitro-server → nitropack@2.13.5
  → listhen@1.10.1 → node-forge@1.4.0
  → @rollup/plugin-terser@1.0.0 → serialize-javascript@7.1.2
```

`node-forge` ditandai high untuk kelemahan validasi tanda tangan RSA; advisory menyebut versi sampai 1.4.0 terdampak dan belum mencantumkan versi patched pada waktu pemeriksaan. `serialize-javascript` ditandai low untuk escaping fungsi ketika output disisipkan sebagai script; advisory mencantumkan perbaikan 7.1.3. Sumber: [advisory node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [advisory serialize-javascript](https://github.com/advisories/GHSA-m5mm-p8h7-m29v).

Audit ini belum membuktikan input dashboard dapat mencapai jalur eksploit tersebut. Rekomendasinya ialah memeriksa penggunaan rantai dependensi dan pembaruan upstream yang kompatibel sebelum publikasi. Tidak menjalankan `npm audit fix`, downgrade Nuxt, `--force`, reinstall, atau mengubah lockfile. Saran otomatis npm bahkan menunjuk perubahan Nuxt yang berpotensi mengubah arsitektur; itu tidak boleh diterapkan tanpa penilaian dan regression test.

## Dokumentasi aktif dan legacy masih bercampur

[README.md:3](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/README.md:3) sudah menyebut Nuxt/Laravel, tetapi bagian [README.md:45](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/README.md:45) masih menyebut hanya frontend. Instruksi [README.md:74](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/README.md:74) menjalankan npm dari root dan Vite5173; itu menjalankan React legacy, bukan dashboard Nuxt3000. Catatan migrasi juga memuat baseline historis 418/417 yang berbeda dari katalog sekarang.

Ini dapat membuat anggota tim menjalankan aplikasi berbeda dan mengira datanya rusak. Perlu satu panduan aktif, dengan lampiran legacy/historis yang jelas. Panduan belajar baru menjelaskan perbedaannya; README existing belum diubah pada audit ini.

## Kesiapan data dan integrasi

- Pilot sekarang memuat 643 identitas Excel, 627 pin rujukan publik, 16 tanpa pin, 38 provinsi, 514 kabupaten/kota. Ini kelengkapan katalog snapshot, bukan pengesahan seluruh lokasi lapangan.
- Mode Excel terpisah tetap 643 record tanpa pin/statistik simulasi. Mode demo sintetis dipertahankan untuk regresi.
- Mode SIKN membaca salinan Maret 2026. Sebanyak 354 identitas cocok dengan katalog; 289 belum cocok. ID lokal, tahun Excel dan pin kurasi tidak ditukar sembarangan.
- Audit kontak sebelumnya pada sumber yang sama menghasilkan 239 email dengan format valid dan bukan placeholder, 301 telepon, 324 instansi dengan setidaknya satu kontak. Kontak belum disahkan sebagai kontak publik/terbaru. Rincian: [kontak-instansi.md](/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/docs/kontak-instansi.md).
- Baru satu Landing Page terverifikasi pada pilot. Tautan lain belum diaktifkan secara massal.
- Definisi deskripsi arsip, entitas terkait dan metadata objek digital masih perlu konfirmasi vendor; jangan mengganti labelnya menjadi total arsip publik tanpa dasar.
- Geocoding tetap nonaktif. Tim memilih adapter dan verifikasi manual dahulu. Tidak ada alamat yang dikirim ke provider geocoding dalam audit.

## Catatan performa dari pengukuran lokal

Sampel satu kali saat audit, bukan load test:

| Request | HTTP | Body terbaca | Waktu kira-kira |
|---|---:|---:|---:|
| Referensi pilot | 200 | 2.746.440 byte | 343 ms |
| Halaman pertama katalog pilot | 200 | 710.238 byte | 446 ms |
| Referensi SIKN lokal | 200 | 2.746.855 byte | 673 ms |
| Detail satu instansi SIKN | 200 | 5.491 byte | 341 ms |

Pengukuran memakai loopback dan server development, bersamaan dengan aktivitas audit. Itu tidak menggambarkan koneksi mobile atau kapasitas pengguna serentak. Referensi sekitar 2,75 MB dan pengambilan seluruh halaman katalog masih masuk akal untuk pengujian 643 record, tetapi perlu ditinjau saat dataset/beban bertambah.

Peluang perbaikan: cache referensi/versioning/ETag, kompresi pada server produksi, validasi runtime payload daftar/detail, pembatasan concurrency pagination, serta memoization geometri development agar polygon tidak berulang dibaca untuk setiap instansi.

## Urutan pengembangan yang disarankan

1. **Stabilkan fondasi yang sudah ada:** selesaikan A1–A4 dan tambahkan regression test masing-masing; rapikan panduan aktif versus legacy; tinjau advisory dependency secara terarah.
2. **Finalisasi sumber data tim:** tabel identitas/UUID, lokasi dan bukti koordinat, tahun bergabung, URL per instansi, status pemeriksa serta hak publikasi kontak. Buat import staging yang idempoten dengan laporan konflik; jangan mengganti ID lama.
3. **Proof of concept API vendor:** dapatkan kontrak resmi, autentikasi, contoh payload, pagination, rate limit, status publikasi, definisi statistik dan aturan perubahan. Implementasikan adapter backend untuk satu instansi dahulu, bandingkan dengan sumber vendor, lalu perluas terkontrol.
4. **Atur kepemilikan field dan pemulihan:** bedakan data Excel/tim/vendor; jangan biarkan sinkronisasi otomatis menimpa koreksi manual tanpa aturan konflik. Tambahkan timeout, retry terbatas, cache dengan TTL dan status waktu data terakhir.
5. **Siapkan operasional produksi:** domain/HTTPS, autentikasi dan role pengelola, audit pelaku, jaringan database, backup dan uji restore, monitoring serta pengujian beban. Adminer lokal dan endpoint DATA UJI bukan panel pengelolaan produksi.
6. **Uji penerimaan bersama mentor/tim:** Chrome/Safari/Firefox, Windows fisik, perangkat sentuh, screen reader, zoom browser200%, jaringan lambat/putus, serta keputusan terhadap data yang belum lengkap.

## Bukti dan batas audit

Bukti lokal ada di `/Users/macbookair/dashboard-monitoring-simpul-jaringan-jikn/.local/qa/project-audit-2026-10-24/`: `frontend-reproduction.md`, `frontend-observations.json`, `dev-refresh-before.png`, `dev-refresh-failed.png`, `jambi-navigation.png`, `backend-reproduction.json`, `api-measurements.json`, dan `npm-audit.json`. Folder ini diabaikan Git; screenshot tambahan hanya memuat DATA UJI/error atau peta tanpa rincian kontak privat.

Tidak melakukan uji beban produksi, eksploitasi dependency, login vendor, pengambilan data massal dari internet, audit seluruh 22GB database, pengujian Windows fisik, maupun pengujian lengkap semua kombinasi browser/zoom. CI matrix Ubuntu/Windows yang tersedia dalam source bukan bukti CI remote sudah lulus. Temuan verifikasi URL melalui Adminer belum diuji dengan penulisan database; bukti URL duplikat terbatas pada validator di memori dan alur kode. Batas ini harus dipertahankan ketika menjelaskan hasil kepada mentor.
