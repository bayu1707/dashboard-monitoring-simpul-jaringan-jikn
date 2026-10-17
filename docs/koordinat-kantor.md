# Koordinat kantor dan unit layanan

Review lokal 17 Oktober 2026 menambahkan **108 pin Google Maps**, sesudah audit Jepara dan Jawa Tengah. Jumlah berubah dari **82 → 127 → 141 → 249 pin**, dengan **0 dari 249 record katalog tanpa pin**. Kelengkapan ini berlaku untuk katalog percontohan enam provinsi yang telah dipilih, bukan seluruh 643 record Excel dan bukan jaminan semua simpul Jawa. Ini pemeriksaan sumber publik, bukan pengesahan ANRI atau sinkronisasi API.

| Provinsi | Record | Pin publik/unit | Tanpa pin |
|---|---:|---:|---:|
| DKI Jakarta | 94 | 94 | 0 |
| Jawa Barat | 39 | 39 | 0 |
| Jawa Tengah | 41 | 41 | 0 |
| DI Yogyakarta | 7 | 7 | 0 |
| Jawa Timur | 55 | 55 | 0 |
| Banten | 13 | 13 | 0 |

Nama, kode, jenis, ID, dan tahun bergabung seluruh 249 record tetap sama dengan snapshot Excel. Workbook asli dan snapshot penuh 643 record tidak diubah. Statistik percontohan tetap **DATA SIMULASI**; menambah pin tidak membuktikan angka arsip atau status simpul.

## Bukti yang digunakan

- Fitur tempat Google Maps diperiksa nama/unit, alamat dan kabupaten/kotanya; perbedaan alamat tidak dianggap otomatis sama atau sudah dikonfirmasi oleh instansi. Koordinat memakai `!3d/!4d` fitur terpilih. Bagian `/@` adalah posisi kamera dan tidak dijadikan pin.
- Sematan peta pada situs resmi harus memuat fitur instansi yang cocok. Tautan pada footer dapat menunjuk badan penerbit halaman atau instansi lain; tidak otomatis menjadi lokasi record yang diriset.
- Marker eksplisit atau koordinat publik pada kontak resmi dapat dipakai setelah nama/unit dan alamatnya diperiksa. Nilai `center`, bbox, dan titik tengah wilayah tidak dipakai.
- HTTPS, metode, URL sumber, timestamp, pasangan koordinat, relasi wilayah, bounds dan polygon diperiksa oleh builder. Pemeriksaan numerik tidak menggantikan pemeriksaan identitas.

Domain pemerintah, perguruan tinggi, sekolah dan TNI diterima untuk metode publikasi resmi. Tautan Google Indonesia juga didukung. Allowlist host tetap menolak protokol selain HTTPS, kredensial URL, port khusus dan domain tiruan. Data lapangan tetap perlu diperiksa; allowlist bukan bukti bahwa isi halaman benar.

Instansi yang memiliki beberapa gedung memakai `coordinateLocationLabel` untuk menjelaskan titik yang dipilih, misalnya depo arsip, Unit I, layanan LPSE atau kampus utama. Label tampil di popup serta catatan sumber detail. Pin kompleks/kampus tidak menjanjikan posisi ruang pengelola arsip.

## Data yang masih memerlukan review

Hasil terbaru tersedia di `.local/coordinate-review-google-20261017/`. Tahap Jepara sebelumnya dipertahankan sebagai riwayat di `.local/coordinate-review-jepara-20261017/`.

- `koordinat-ditambahkan.csv` dan `updates.json`: 108 ID tambahan, titik sumber, label unit, sumber publik dan catatan.
- `pengecualian.csv` / `.json`: perbedaan alamat, rujukan historis, dan tiga tinjauan batas geometri.
- `laporan-audit.md` dan `summary.json`: perubahan jumlah dan audit integritas terhadap 643 record Excel serta 141 pin sebelumnya.
- `locations.json`: masukan lengkap 249 record untuk builder lokal. `baseline/` menyimpan keadaan sebelum tahap ini.
- `audit-119-kab-kota.csv`: membedakan wilayah tanpa record dalam katalog dan wilayah dengan record katalog berpin. Wilayah tanpa record tidak berarti instansinya tidak ada di dunia nyata.

**Tujuh pin masih memerlukan konfirmasi kesesuaian alamat**: Indramayu (nomor 4/49), Sumedang (Pacuan Kuda/Dano), Kabupaten Probolinggo (Kraksaan/Dringu), Kota Yogyakarta (Singonegoro/Soeprapto), Pandeglang (Abdul Halim/Kesehatan), Purworejo (pin Sindurjan dan alamat depo), serta Sragen (Solo–Sragen 80/Sukowati Barat 15D). Pin Google tetap ditampilkan atas permintaan pengguna dengan label sumber publik dan catatan perbedaannya. Ini bukan klaim bahwa kantor resmi terbaru sudah dipastikan. Alamat referensi lama disimpan pada `referenceAddress` di input privat.

**Dua pin rujukan historis**: KASN dan Wantannas. Identitas, kode dan tahun Excel dipertahankan; pin tidak membuktikan lembaga lama masih aktif atau keanggotaan otomatis beralih ke penerusnya.

**Tiga tinjauan batas geometri**: BNPB dan BPKP sekitar 30 m/26 m di sisi Jakarta Pusat pada polygon referensi, sedangkan alamat resmi menyebut Jakarta Timur. Kantor utama Kepulauan Seribu di Pulau Pramuka sekitar 89 m di luar garis pantai polygon. Builder menerima pengecualian hanya jika `geometryReview` memuat alasan, sumber alamat resmi HTTPS yang tercatat, serta batas jarak per record paling jauh 100 m. Jarak dihitung ke ruas polygon dengan proyeksi lokal. Tanpa tinjauan, sumber sah, geometri atau jika melampaui ambang, impor ditolak. Bounds tetap diperiksa. Titik Google tidak digeser dan geometri tidak diklaim salah.

**Koreksi wilayah fisik kantor**: Barantin dan PKP masuk Jakarta Pusat berdasarkan kantor rujukan terbaru; kantor utama Kepulauan Seribu masuk 31.01; kantor Dinas Kabupaten Tasikmalaya berada secara fisik di Kota Tasikmalaya 32.78, berbeda dari wilayah layanan Kabupaten 32.06. ID sebelumnya disimpan di `previousKabKotaId`, dengan alasan dan sumber. Tidak melakukan penggabungan berdasarkan nama.

Jepara tetap memakai gedung utama Demaan dan tahun Excel 2017; seluruh 141 titik lama dipertahankan. Unit layanan seperti perpustakaan Cimahi/Banjar, kompleks kampus dan gedung kantor diberi label sesuai sumber; posisi ruang pengelola arsip tidak diasumsikan.

Seluruh instansi tetap bisa ditemukan melalui **Daftar**, lalu **Pratinjau profil** atau tautan nama ke detail, termasuk yang belum memiliki marker. Cluster hanya menghitung instansi berkoordinat.

## Mengaktifkan kembali hasil review

```sh
npm run build:pilot -- .local/coordinate-review-google-20261017/locations.json \
  --landing-pages .local/landing-zoom-review-20261017/landing-pages.json
npm run dev -- --port 5175 --strictPort
```

Jika menambahkan berkas penelitian baru, gunakan masukan terbaru:

```sh
npm run prepare:java -- .local/coordinate-review-google-20261017/locations.json path/penelitian-baru.json
npm run build:pilot -- .local/java/locations.json --output .local/java/staged
```

Tinjau laporan staging sebelum mengaktifkannya. Jangan memakai lagi hasil penelitian lama untuk menimpa pin terbaru. Dua lokasi yang bertentangan harus ditinjau manual; builder menolak konflik, perubahan nama/tahun, serta koordinat tanpa alamat/sumber.

Snapshot dan cache penelitian tetap diabaikan Git. Tidak memindahkan hasil workbook ke `public/`, tidak mengunggah workbook mentah, dan tidak mengaktifkan Landing Page dengan URL peta. Pembagian dataset perlu review tersendiri.

## Pemeriksaan

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:import`, `npm run build`, dan `npm run test:e2e` menggunakan script proyek. Cache penelitian `.local/` dikecualikan dari lint karena memuat salinan halaman/skrip pihak lain, bukan kode aplikasi.

Regresi koordinat menguji pin baru di beberapa kabupaten, penguraian cluster Jember, alur Jepara desktop/mobile, badge Jawa Tengah yang tidak tertutup DIY pada zoom luas, hover hingga tombol, ketepatan panah, tahun Excel, detail/kembali, label unit, dan sheet sentuh 390 px. Dataset privat yang tidak tersedia menyebabkan tes berbasis data lokal dilewati; fixture sintetis tetap terpisah. Pengujian browser memverifikasi fungsi antarmuka, bukan ketepatan lokasi di lapangan.

Tes browser tahap Google mengarahkan pointer ke **setiap 108 pin baru** memakai pemulihan viewport aplikasi, mengurai cluster melalui UI jika diperlukan, memeriksa judul/tahun, panah, fokus tombol dan tautan detail. Tes tersebut memblokir tile untuk membuktikan pin tetap berfungsi saat peta dasar gagal; tes navigasi dan screenshot lain memakai pemuatan peta normal. Satu alur detail/kembali diuji per provinsi serta sentuh Kota Batu pada 390 px. Hasil aktual dicatat setelah tes dijalankan pada laporan lokal.

Satu mapping Landing Page ANRI kini ditambahkan berdasarkan konfirmasi pengguna. Lihat [panduan Landing Page](landing-pages.md); tautan peta sumber tetap terpisah dari tautan profil JIKN. Saat rebuild, sertakan flag mapping pada contoh di atas agar hasil review tersebut dipertahankan.
