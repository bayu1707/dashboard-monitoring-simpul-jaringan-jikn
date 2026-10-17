# Percontohan peta Jakarta dan Banten

> **Riwayat sebelum perluasan Jawa, 16 Oktober 2026.** Angka 28/26/2 dan hasil uji di bawah menjelaskan tahap Jakarta–Banten. Untuk dataset development yang sekarang, gunakan [panduan Jawa](pilot-jawa.md) dan `.local/pilot/report.json`.

Percontohan ini mempersempit tampilan awal menjadi **Jakarta dan Banten** agar alur provinsi → kabupaten/kota → marker instansi → popup → detail dapat direview secara utuh. Versi nasional serta hasil impor Excel sebelumnya tetap disimpan. Ini bukan penghapusan proyek atau penggantian data resmi dengan angka contoh.

## Data yang ditampilkan

Dataset percontohan lokal kini memuat **28 instansi: 15 di Jakarta dan 13 di Banten**. Ada **26 pin kantor** dan **2 record tanpa pin**, semuanya tetap tersedia dalam Daftar. Referensi navigasinya memuat 2 provinsi dan 14 kabupaten/kota. Tidak semua kabupaten/kota mempunyai instansi dalam sampel ini. Jumlah pada peta dan daftar hanya menghitung ID instansi unik dalam percontohan, bukan seluruh simpul JIKN. Semua 9 LKD Banten dan 2 LKD Jakarta yang ditemukan di casefile masuk katalog ini; pengumpulan seluruh K/L dan jenis lain masih parsial.

| Bagian | Sumber dan arti |
|---|---|
| Nama, kode dan tahun bergabung | Record asli `Indonesia.xlsx`, sheet `pengelolaan casefile`; ID stabil dan sumber baris Excel dipertahankan. |
| Lokasi kantor | Pin Google Maps yang dicocokkan secara manual dengan alamat situs atau dokumen resmi instansi. Koordinat berasal dari titik tempat, bukan pusat viewport peta. |
| Statistik, tren, distribusi dan pencipta | **DATA SIMULASI**, dibuat khusus untuk menilai UI sesuai permintaan pengguna. Bukan statistik ANRI/JIKN. |
| Kontribusi pada percontohan | Jumlah arsip simulasi instansi dibagi total arsip simulasi seluruh instansi percontohan pada snapshot yang sama; bukan kontribusi nasional JIKN. |
| Status simpul, kontak dan logo | Tidak dibuat sebagai fakta bila belum ada sumber. Placeholder logo tetap netral. |
| Landing Page JIKN | Tidak ada URL yang direkayasa. Tombol disabled sampai tersedia mapping resmi yang terverifikasi. |

Label **DATA SIMULASI** ditampilkan pada halaman peta, popup dan detail. Bagian statistik/grafik juga menyatakan simulasi. Tahun bergabung tetap berasal dari Excel; angka simulasi tidak mengubah tahun tersebut. Dataset ini tidak real time dan tidak terhubung ke API SIKN.

Verifikasi publik lokasi berarti nama kantor dan alamat pembanding cocok saat pemeriksaan. Ini **bukan pengesahan koordinat resmi oleh ANRI**. Sebelum pemakaian operasional, pengelola instansi perlu mengonfirmasi lokasi serta mapping ke ID resmi SIKN.

## Cakupan dan pengecualian lokasi

Jakarta Selatan dalam sampel menampilkan antara lain Arsip Nasional RI, Kementerian Kesehatan, Kementerian Ketenagakerjaan, LKPP dan Kementerian Pertanian. Kota Serang menampilkan DPK Kota Serang, DPK Provinsi Banten serta DPK Kabupaten Serang. Kantor DPK Kabupaten Serang berada di Kota Serang menurut alamat resmi; jenis LKD Kabupaten dipertahankan. Lokasi kantor tidak disamakan dengan wilayah layanan atau tipe instansi.

Dua instansi masuk katalog tanpa marker karena pin kantor belum dapat dipastikan:

- **Kabupaten Pandeglang:** sumber resmi menyebut Jl. Kesehatan No.2, sedangkan pin Maps memakai Jl. KH Abdul Halim No.3. Lokasi perlu dikonfirmasi.
- **Sekretariat Kabupaten Administrasi Kepulauan Seribu:** sumber resmi menyebut kantor utama Pulau Pramuka dan kantor penghubung Gedung Mitra Praja. Provinsi diketahui, tetapi kab/kota kantor rujukan dan koordinat dibiarkan null sampai unit yang dimaksud dipastikan. Record ini tersedia di Daftar Jakarta.

**Pembaruan Kota Tangerang, 16 Oktober 2026:** pin kantor sudah dilengkapi pada **[-6.1719109, 106.6334132]**. [Profil resmi DPAD](https://dpad.tangerangkota.go.id/profile/tentang) membedakan kantor Jl. Mayjen Sutoyo No.2 dengan perpustakaan umum Jl. Jend. Ahmad Yani No.7 (Windu Karya). [Perjanjian Kinerja 2026](https://dpad.tangerangkota.go.id/assets/uploads/informationpublic_20260126_1769418517.pdf) menguatkan alamat kantor, termasuk untuk Bidang Kearsipan. Pin alamat lengkap Google Maps berlabel “Jalan Catur Jl. Mayjen Sutoyo No.2”; foto Street View Februari 2026 pada pin tersebut memperlihatkan papan nama DPAD dan alamat kantor yang sama. Koordinat diambil dari !3d/!4d pin alamat, bukan /@ pusat viewport atau listing instansi lama di Windu Karya. Ini verifikasi sumber publik untuk gedung kantor, bukan klaim lokasi ruangan arsip atau pengesahan koordinat oleh ANRI.

Bukti dan pemetaan lama disimpan di `.local/pilot/research-tangerang-20261016.json` serta cadangan `.local/backups/tangerang-sebelum-koordinat-20261016/`. Berkas riset bertanggal 15 Oktober merupakan riwayat sebelum konflik alamat terselesaikan; pemetaan aktif untuk membangun ulang tetap `.local/pilot/locations.json`. Nama, ID, kode 23671-6 dan tahun bergabung 2019 dari Excel tetap sama. Hasil penambahan ini: 28 instansi, 26 marker berkoordinat dan 2 record tanpa pin.

Dua tes browser khusus Kota Tangerang lulus: desktop 1440 memeriksa lingkaran provinsi/kota → marker → hover popup, panah ke marker, detail dan kembali; sentuh 390 memeriksa tap marker → sheet → detail dan kembali. Tidak ada error runtime material pada kedua tes. Build, typecheck dan lint lulus. Screenshot lokal: `.local/qa/tangerang-popup-20261016.png` dan `.local/qa/tangerang-mobile-20261016.png`.

Empat kampus Banten yang ditambahkan: Universitas Terbuka, Universitas Sultan Ageng Tirtayasa, PKN STAN dan Politeknik Industri Petrokimia Banten. Pin UNTIRTA memakai rektorat Sindangsari berdasarkan sumber resmi terkini; alamat referensi workbook Pakupatan dicatat sebagai alamat historis. Pin kampus menunjukkan lokasi institusi, bukan jaminan ruangan pengelola arsip.

Instansi lain dari 643 record Excel tidak hilang. Mereka tetap tersedia pada tampilan snapshot Excel sebelumnya. Tidak ada titik acak, `[0,0]`, pusat kabupaten/kota atau koordinat administratif yang dijadikan lokasi kantor.

Sumber pembanding Banten: [DPK Provinsi Banten](https://dpk.bantenprov.go.id/), [DPK Kota Serang](https://disperpusda.serangkota.go.id/), [DPK Tangerang Selatan](https://dpk.tangerangselatankota.go.id/), [Renstra Cilegon 2021–2026](https://dpk.cilegon.go.id/kelola/assets/documents/6e5e29d76ff4321b5545620cdc90e54e.pdf), dan [lokasi Disperpusip Kabupaten Tangerang](https://disperpusip.tangerangkab.go.id/profil-konten/187). URL Google Maps, alamat, tanggal pemeriksaan dan catatan setiap lokasi disimpan dalam hasil pemetaan lokal. Referensi wilayah menggunakan sumber yang sama dengan versi nasional; lihat [reference-sources.md](reference-sources.md).

## Menjalankan dan memilih sumber

Gunakan Node/npm yang tercatat pada README, lalu jalankan dari folder clone:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Environment lokal mengaktifkan sumber percontohan melalui `VITE_LOCAL_PILOT=1`. Buka [peta percontohan](http://127.0.0.1:5175/simpul-jaringan). Tampilan awal memakai lingkaran angka seperti halaman publik JIKN: **13** instansi di Banten dan **15** di Jakarta. Angka ini termasuk record tanpa pin, sehingga berbeda dari jumlah marker. Nama wilayah hanya muncul saat hover/fokus, tanpa kotak teks permanen atau garis penghubung yang memenuhi layar.

Klik lingkaran provinsi membuka lingkaran kabupaten/kota yang memiliki sampel; klik lingkaran kab/kota langsung membuka marker kantor. Angka administratif menghitung ID instansi unik dalam wilayah, termasuk record tanpa koordinat. Ini berbeda dari cluster instansi yang hanya menghitung marker kantor berkoordinat. Posisi geografis label administratif tetap berasal dari referensi wilayah. Label yang bertumpuk memakai pergeseran terdekat, maksimal 56 piksel, tanpa garis penghubung dan tanpa mengubah lat/lng sumber atau koordinat kantor. Jika ruang tidak cukup, pilihan wilayah tetap tersedia melalui polygon, dropdown dan Daftar; label tidak terus didorong menjauh.

Tampilan awal/nasional dapat diperkecil hingga zoom 3 (skala dunia), tanpa batas tambahan berdasarkan bounds percontohan. Hanya lapisan kab/kota dalam provinsi terpilih yang mengikuti batas minimum dari bounds sumber serta ukuran viewport, dengan ruang untuk toolbar. Tombol minus nonaktif saat batas itu tercapai; scroll dan keyboard juga mengikuti batas yang sama. Untuk berpindah ke cakupan lebih luas, gunakan **Kembali ke Nasional** atau **Reset**. Lapisan instansi tetap dapat diperkecil hingga zoom 3 untuk clustering. Batas provinsi dihitung ulang saat ukuran layar/cakupan berubah; sesi lama dengan zoom di bawah batas provinsi dinaikkan tanpa animasi yang bertabrakan dengan pemfokusan wilayah. Sesi tampilan awal yang sudah diperkecil tetap dipulihkan pada zoom pengguna. Panning dan viewport detail/kembali tetap disimpan.

Di bawah zoom 8, pergeseran label mengikuti skala proyeksi agar tidak terlihat bergeser ke daerah lain. Pada skala sangat luas, lingkaran provinsi yang berdekatan dapat saling menutupi; perbesar kembali atau gunakan dropdown, Daftar maupun fokus keyboard untuk memilih ID wilayah yang tepat. Lingkaran tersebut tidak digabung menjadi cluster instansi atau diberi total wilayah baru.

Saat provinsi dibuka dalam pilot, viewport difokuskan ke gabungan bounds sumber kab/kota yang memiliki sampel. Dengan demikian Jakarta daratan tidak tampil terlalu kecil karena wilayah Kepulauan Seribu yang belum memiliki sampel. Data batas tidak dipotong atau diubah; seluruh 14 kab/kota tetap dapat dipilih melalui dropdown dan Daftar. Polygon tetap dapat diklik sebagai alternatif. Kab/kota tanpa sampel tidak diberi lingkaran jumlah palsu.

- `?data=excel` membuka kembali sumber snapshot Excel nasional sebelumnya, selama `VITE_LOCAL_CASEFILE=1` dan hasil impor tersedia.
- `?demo=1` membuka fixture sintetis Banten lama, tetap berlabel **DATA DEMO**.
- `?provinsi=31&kabKota=31.74` membuka langsung Jakarta Selatan pada percontohan.
- `?provinsi=36&kabKota=36.73` membuka langsung Kota Serang pada percontohan.

Klik wilayah menerapkan navigasi langsung. Dropdown memakai state yang sama. Jenis instansi opsional; **Semua Jenis** tetap memungkinkan popup marker. Hover marker membuka popup; klik desktop membuka detail. Pada sentuh, tap pertama membuka sheet lalu **Lihat detail** membuka profil. Kembali ke Peta memulihkan wilayah dan viewport.

## File lokal dan pemulihan

Untuk membangun ulang dari pemetaan lokasi yang sudah direview:

```sh
npm run build:pilot -- .local/pilot/locations.json
```

Builder mempertahankan ID, nama, kode dan tahun dari snapshot Excel. Angka simulasi deterministik berdasarkan ID: tidak berubah setiap kali komponen dirender atau file dibangun ulang. Nama pencipta dan kategori arsip contoh menyatakan simulasi. Validator memeriksa relasi wilayah, batas/polygon, pasangan koordinat pin Google Maps, sumber alamat, serta jumlah simulasi yang konsisten.
Muat ulang halaman setelah membangun dataset agar repository membaca snapshot terbaru.

Snapshot serta referensi percontohan berada di `.local/pilot/snapshot.json` dan `.local/pilot/references.json`. Komponen mendapatkannya melalui repository asinkron yang sama dengan sumber lain. Frontend tidak membaca workbook secara langsung. Sumber lokal ini hanya disajikan oleh server development; build dan preview tidak memuat dataset privat tersebut.

Cadangan sebelum percontohan ada di `.local/backups/`:

- `sebelum-pilot-jakarta-banten-20261014.tar.gz`: arsip pekerjaan proyek sebelum perubahan percontohan.
- `snapshot-casefile-sebelum-pilot.json`: salinan dataset hasil impor nasional.
- `env-sebelum-pilot.txt`: konfigurasi sumber lokal sebelumnya.

Folder `.local/`, workbook dan `.env.local` diabaikan Git. Mengirim kode ke GitHub tidak otomatis mengirim dataset lokal tersebut. Komputer anggota tim perlu mendapatkan dataset yang telah diizinkan melalui mekanisme berbagi yang disepakati. Tidak ada commit, push atau merge otomatis pada pengerjaan ini.

Perluasan 15 Oktober menyimpan cadangan 11 record awal di `.local/backups/pilot-sebelum-pelengkapan-20261015/`. Riset per record beserta URL sumber ada pada `.local/pilot/research-jakarta.json`, `research-banten-lkd.json`, dan `research-banten-campus.json`. Laporan audit `.local/pilot/research-jakarta-kl-review.json` memisahkan K/L yang sudah diperiksa, identitas/lokasi yang perlu tinjauan, dan alamat yang belum diperiksa. Jangan menyebut seluruh 103 K/L telah dipetakan ke Jakarta.

Pemeriksaan perluasan: **119 tes unit/komponen/data** dan cakupan **26 skenario browser** lulus setelah tiga timeout pada helper pengujian cluster diperbaiki. Helper sekarang tidak menunggu elemen marker yang memang masih berada di dalam cluster; enam tes pilot dijalankan ulang dan seluruhnya lulus. Build, typecheck dan lint lulus. Perbandingan langsung ke workbook asli menunjukkan 0 perbedaan pada nama, kode, ID deterministik dan tahun 28 record. Kedua provinsi juga diperiksa pada 1440 dan 390 px: lingkaran tidak bertumpuk, tanpa caption/garis permanen. Tren simulasi kampus yang baru bergabung 2026 hanya berisi 2026, tidak dibuat mundur sebelum tahun bergabung.

Alamat dari sheet tambahan `daftar simpul` hanya menjadi referensi pencarian. Nama/ID/tahun tetap diambil dari `pengelolaan casefile`. Alamat tambahan bisa lama atau salah; contoh beberapa kantor memiliki alamat baru. Tidak ada PIC, nomor pribadi atau isi workbook mentah yang diekspor.

## Pemeriksaan

Putaran akhir pada 14 Oktober 2026: **116 tes unit/komponen/data**, **24 tes browser**, build, typecheck dan lint lulus. Browser memakai Google Chrome dengan rendering software sementara untuk mengatasi keterbatasan renderer lingkungan uji macOS. Desktop 1440, sentuh 390, dan reflow 720 px diperiksa; reflow 720 merupakan simulasi lebar CSS pada zoom 200%, bukan pengukuran zoom fisik pada perangkat lain.

Regresi tambahan membuktikan popup tetap terbuka saat mouseout marker atau akhir autopan datang setelah pointer sudah masuk ke popup. Jeda penutupan tetap 200 ms; handler dan timer memeriksa hover/fokus yang aktual sebelum menutup. Popup marker tetap memakai anchor Leaflet dan mengikuti posisi spiderfy. Tidak ada perubahan offset untuk menyembunyikan masalah.

Screenshot review lokal: `.local/qa/pilot-overview.png`, `pilot-jakarta-popup.png`, `pilot-banten-popup.png`, `pilot-jakarta-detail.png`, serta `pilot-mobile-popup.png`. Berkas screenshot tidak masuk Git atau build. Snapshot Excel penuh juga diperiksa tetap identik dengan cadangan sebelum pilot.

Penyempurnaan 15 Oktober 2026 mengganti label permanen menjadi lingkaran angka. Tes pilot juga memeriksa hitungan 6/5, pemilihan lingkaran melalui klik/keyboard/sentuh, pergantian ke lingkaran kab/kota, sinkronisasi URL/dropdown, serta tidak adanya caption atau garis penghubung permanen. Screenshot tambahan tingkat kab/kota: `.local/qa/pilot-banten-kab-kota.png`.

Pemeriksaan ulang 15 Oktober: 116 tes unit/komponen, seluruh 24 tes browser, build, typecheck dan lint lulus. Pemeriksaan browser tambahan mengukur bounding box lingkaran kab/kota Jakarta dan Banten pada lebar 1440, 720, serta 390 px: tidak ada pasangan lingkaran yang bertumpuk. Snapshot, koordinat kantor dan tahun bergabung tidak berubah dalam penyempurnaan tampilan ini.

Tes `tests/e2e/pilot.spec.ts` memeriksa alur Jakarta Selatan dan Kota Serang, hover dengan jenis opsional, tahun dari record Excel, identitas detail, label simulasi grafik, pemulihan viewport, penguraian cluster serta sentuh 390 px. Tes memakai hasil percontohan lokal yang nyata; tes dilewati bila file belum dibuat atau flag sumber lokal belum diaktifkan. Tes tidak menciptakan dataset pengguna untuk membuat skenario terlihat lulus.

Jalankan script aktual proyek:

```sh
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_PORT=5175 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/e2e/pilot.spec.ts
```

Hasil tes dilaporkan setelah perintah benar-benar dijalankan. Tile peta tetap dapat membutuhkan internet. Kegagalan tile tidak mengubah koordinat atau menghapus akses daftar instansi.
