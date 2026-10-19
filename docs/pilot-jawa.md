# Perluasan percontohan ke Jawa

> Pembaruan kolaborasi 19 Oktober 2026: clone baru memakai snapshot bersama, bukan middleware `.local`. [Panduan dataset bersama](dataset-kolaborasi.md) menjadi acuan menjalankan aplikasi. Perintah impor/riset di bawah adalah proses pemeliharaan lokal, bukan syarat clone.


Tampilan development sekarang mencakup enam provinsi: DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, Jawa Timur, dan Banten. Referensi navigasi menyediakan **119 kabupaten/kota**. Ini perluasan kode lama; adapter repository, popup Leaflet, cluster/spiderfy, halaman detail dan pemulihan state tetap digunakan.

**Cakupan peta bukan jaminan seluruh pin kantor atau seluruh simpul Jawa sudah lengkap.** Katalog memasukkan record yang wilayahnya dapat diidentifikasi dari Excel dan sumber publik. Record tanpa pin tersedia melalui **Daftar**. Identitas lembaga yang berubah karena reorganisasi ditahan untuk review dan tetap ada pada snapshot Excel penuh. Jumlah terbaru per provinsi, jenis, status, dan pin tersedia di `.local/pilot/report.json`.

## Sumber dan pemisahan fakta

- Nama, kode, kategori, dan tahun bergabung: `Indonesia.xlsx`, sheet **pengelolaan casefile**, baris 4–646. Snapshot penuh memuat 643 ID. Bukan sheet PIN/daftar simpul dan bukan hasil API. Workbook asli tidak diubah.
- Alamat: kontak, PPID, profil, atau dokumen resmi instansi. Alamat sheet tambahan hanya petunjuk pencarian; dapat sudah berubah. Tidak mengekspor PIC atau kontak pribadi.
- Referensi wilayah/geometri: sumber nasional yang sudah dipakai proyek; [versi dan lisensi](reference-sources.md). Hanya enam provinsi dipilih untuk percontohan. Geometri kab/kota dimuat saat provinsi dipilih.
- Koordinat kantor: fitur tempat Google Maps yang diperiksa manual; kecocokan atau konflik alamat dicatat per record,, koordinat fitur pada sematan resmi, atau pasangan koordinat yang dipublikasikan resmi. URL, waktu, metode, serta catatan presisi disimpan per record. Nilai pusat kamera (`/@`, `!2d/!3d` viewport) tidak dipakai sebagai pin kantor.
- Statistik/grafik: **DATA SIMULASI**, sesuai mode percontohan. Tidak menyatakan jumlah arsip nyata atau kontribusi nasional. Tahun Excel tetap terpisah dari simulasi.
- Landing Page JIKN: hanya mapping HTTPS resmi yang sudah diverifikasi dapat aktif. Tanpa mapping, tombol tetap disabled dengan keterangan. URL peta sumber bukan URL Landing Page.

Pin kampus/kompleks menunjukkan institusi atau gedung yang disebut sumber, bukan jaminan ruang pengelola arsip. Verifikasi publik ini bukan pengesahan koordinat oleh ANRI. Nama lama dan tahun keanggotaan tidak otomatis dipindahkan ke kementerian atau badan penerus.

## Memperbarui dataset lokal

Review koordinat 17 Oktober 2026 menambahkan 45 pin pada tahap sebelumnya, kemudian 14 pin pada audit Jepara dan Jawa Tengah. Tahap berikutnya melengkapi 108 pin fitur Google Maps. Sumber lokal aktif memuat **249 pin dan 0 record tanpa pin**. Tujuh pin berstatus tinjauan kesesuaian alamat dan dua merupakan rujukan historis; lihat catatan tiap record sebelum penggunaan operasional. **Input paling baru adalah `.local/coordinate-review-google-20261017/locations.json`**; contoh penelitian di bawah merupakan riwayat penyusunan katalog. Gunakan sumber terbaru sebagai masukan awal agar hasil verifikasi sebelumnya tetap tersimpan. Lihat [proses dan pengecualian koordinat](koordinat-kantor.md).

Semua hasil yang berasal dari workbook berada di `.local/`, diabaikan Git dan tidak dibundel dalam build production. Jangan memindahkannya ke `public/` sebelum disetujui untuk dibagikan.

1. Impor ulang workbook dengan [importer casefile](casefile-import.md). Periksa laporan kode ganda dan perubahan identitas. Snapshot penuh berada di `.local/casefile/snapshot.json`.
2. Catat riset lokasi menurut **ID stabil**, nama dan tahun sumber. Satu record per ID; sumber alamat wajib. Koordinat yang belum terbukti tetap `null`.
3. Gabungkan katalog administratif dan hasil riset, lalu bangun ke folder staging:

```sh
npm run prepare:java -- \
  .local/backups/sebelum-perluasan-jawa-20261016/locations.json \
  .local/java/research-west.json \
  .local/java/research-central.json \
  .local/java/research-east.json \
  .local/java/research-root.json \
  .local/java/research-kl-central.json \
  .local/java/research-kl-east.json \
  .local/java/research-kl-west.json
npm run build:pilot -- .local/java/locations.json --output .local/java/staged
```

Input pertama adalah cadangan 28 record sebelum perluasan; jangan menggantinya dengan keluaran terbaru tanpa meninjau konflik riset. `prepare:java` menjaga ID, menolak nama/tahun yang berbeda, dan menolak dua hasil penelitian wilayah/pin yang bertentangan. Koreksi kantor fisik terhadap wilayah layanan harus mempunyai sumber yang jelas. Dua instansi dengan nama/kode mirip tidak digabung. Kode duplikat Excel tetap terpisah melalui ID lokal.

Builder memvalidasi jenis/relasi wilayah, koordinat numerik, bounds dan polygon kab/kota, provenance pin dan kesesuaian pasangan koordinat sumber. Hasil yang mempunyai koordinat tidak dapat berstatus wilayah `needs-review`. Status wilayah berbeda dari kesesuaian pin publik dengan alamat kantor terbaru; perbedaan alamat dijelaskan pada `coordinateLocationLabel` dan catatan sumber. `geometryReview` hanya untuk pengecualian per record di luar polygon dalam jarak paling jauh 100 m dengan sumber alamat resmi, alasan dan ambang jarak eksplisit; tanpa tinjauan tersebut titik tetap ditolak. Titik tidak dipindahkan untuk menyesuaikan geometri. Validasi numerik tidak menggantikan pemeriksaan identitas kantor secara manual.

4. Tinjau `.local/java/staged/report.json`, `coverage-report.json`, dan catatan pengecualian penelitian. `missingPins` menjelaskan record tanpa marker; `notYetIncluded` membedakan record luar Jawa dan yang belum teridentifikasi. `exceptions` pada berkas riset tidak otomatis diberi lokasi.
5. Setelah tinjauan lokal, aktifkan hasil valid:

```sh
npm run build:pilot -- .local/coordinate-review-google-20261017/locations.json \
  --landing-pages .local/landing-zoom-review-20261017/landing-pages.json
npm run dev -- --port 5175 --strictPort
```

Jika server sudah berjalan, cukup muat ulang browser setelah membangun dataset. `VITE_LOCAL_PILOT=1` di `.env.local` memilih sumber percontohan. `VITE_LOCAL_CASEFILE=1` menyediakan alternatif snapshot penuh lewat `?data=excel`. Mode sintetis lama tetap terpisah pada `?demo=1`.

Alur data tetap **Excel → normalisasi/riset → snapshot JSON → repository asinkron → komponen**. Komponen tidak membaca workbook. Ketika API SIKN tersedia, adapter resmi dapat mengganti/melengkapi repository; tahun Excel digabung lewat pemetaan ID resmi yang disepakati.

## Interaksi dan batas peta

Klik lingkaran provinsi membuka kab/kota; klik kab/kota langsung membuka marker instansi yang mempunyai pin. Dropdown memakai state/query yang sama. Jenis opsional, default **Semua Jenis**. Hover marker menampilkan popup; klik desktop membuka detail. Sentuh membuka sheet, kemudian **Lihat detail**. **Daftar** menyediakan pencarian dan akses keyboard termasuk record tanpa koordinat atau yang baru diketahui provinsinya.

Angka wilayah menghitung ID katalog, termasuk record tanpa pin. Cluster hanya menghitung ID marker kantor berkoordinat. Koordinat administratif tidak dijadikan titik kantor. Reset/kembali satu tingkat menutup popup; kembali dari detail memulihkan pilihan dan viewport.

Lingkaran kab/kota dihitung pada zoom aktual agar ukuran target sentuh tidak ikut dipadatkan. Pergeseran dibatasi 56 px; bila ruang penuh, celah terdekat yang paling lapang dipilih. Sudut transparan kotak marker tidak menerima pointer, sehingga tidak menghalangi lingkaran tetangga. Pada percontohan enam provinsi, badge provinsi juga dihitung pada zoom aktual sehingga target tetap dapat dipilih di mobile dan saat diperkecil. Pergeseran layar tetap maksimal 56 px; lat/lng referensi tidak berubah. Overview nasional 38 provinsi mempertahankan proyeksi sebelumnya; gunakan dropdown/Daftar bila berdekatan. Tidak ada penggabungan cluster administratif lintas batas.

Tampilan awal dan lapisan instansi dapat diperkecil hingga zoom 3. Lapisan kab/kota mempertahankan batas berdasarkan bounds dan viewport dari perbaikan sebelumnya; batas ini bukan perubahan audit Jepara. Panning tidak mengubah cakupan pilihan. Tile dapat membutuhkan internet; kegagalan tile tidak menghilangkan hasil daftar atau memindahkan pin.

Animasi zoom CSS dimatikan melalui opsi publik [`zoomAnimation`](https://leafletjs.com/reference.html#map-zoomanimation). Pada pengujian sentuh ditemukan callback akhir transisi Leaflet 1.9.4 mengakses pane yang sudah dihapus ketika detail dibuka cepat setelah zoom. Pada revisi berikutnya, tombol/keyboard/wheel memakai `flyTo` berdurasi 320 ms yang dibersihkan Leaflet ketika map dilepas. Langkah tombol/keyboard 0,5 level, wheel per burst 0,25–0,5 level, dan snap pinch 0,25. `zoomAnimation` CSS tetap dimatikan; tidak memodifikasi properti privat Leaflet, menunda navigasi atau mengubah anchor popup. Preferensi reduced motion menggunakan perubahan langsung. Tes regresi sengaja membuka detail segera setelah zoom dan menunggu melampaui timeout 250 ms.

## Pemeriksaan

```sh
npm run typecheck
npm run lint
npm test
npm run test:import
npm run build
PLAYWRIGHT_PORT=5175 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Tes Jawa memakai dataset lokal yang benar-benar tersedia; dilewati pada clone yang belum memiliki sumber privat. Fixtures sintetis untuk unit/komponen tetap terpisah. Regresi mencakup klik provinsi/kab/kota, hitungan ID, sumber tahun, pin null, hover/tombol, detail/kembali, sentuh 390 px, serta lingkaran yang tidak terhalang sudut transparan marker lain. Tes demo lama tetap memeriksa cluster/spiderfy, null vs 0, tile gagal dan keyboard.

Screenshot review dan hasil audit terperinci berada di `.local/qa/` dan `.local/java/`. Hasil pengujian dilaporkan setelah benar-benar dijalankan. Tidak ada commit, push, merge, atau deployment otomatis.
