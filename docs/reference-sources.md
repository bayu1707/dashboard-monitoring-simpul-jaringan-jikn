# Sumber referensi dan batas verifikasi

Referensi ini hanya menjelaskan wilayah dan aset identitas. Tidak ada data instansi, statistik arsip, atau total JIKN yang diambil dari screenshot.

Diperiksa pada `2026-10-12T19:49:29+07:00`.

## Lampiran rancangan

- `A_Spesifikasi_UI_UX_JIKN.docx` berhasil dibaca. Susunan dan perilakunya konsisten dengan permintaan pengguna; angka contoh tidak menjadi data produksi.
- `B_Wireframe_JIKN.pdf` berisi lima halaman. Kelima halaman berhasil dirender dan dilihat: peta awal, tiga lapisan navigasi, popup, detail tanpa tab, serta mobile.
- Tiga screenshot dapat dibaca dan hanya menjadi referensi visual. Ketentuan pengguna tentang tahun bergabung, status, nilai null, dan penghapusan tab lebih diutamakan daripada angka/kontak/tab pada screenshot.

## Referensi nasional yang dipakai sekarang — 14 Oktober 2026

Registry menggunakan [database wilayah Cahya DSN](https://github.com/cahyadsn/wilayah/tree/5d450ccbc94cc487f54bf2a262300efe97aa58af), commit `5d450ccbc94cc487f54bf2a262300efe97aa58af`. Penerbit menyatakan database mengikuti Kepmendagri Nomor 300.2.2-2430 Tahun 2025. Nama dan kode diambil dari `db/wilayah_level_1_2.sql`, bukan hasil geocoding nama instansi. Header historis file masih menyebut keputusan 2138/2025; perbedaan ini dicatat, tidak dianggap sebagai verifikasi hukum mandiri atas semua batas.

Geometri menggunakan [wilayah_boundaries Cahya DSN](https://github.com/cahyadsn/wilayah_boundaries/tree/28230eca6e787bac229db56825bd5b1843662c96), commit `28230eca6e787bac229db56825bd5b1843662c96`. Ini sumber komunitas beracuan administratif Kemendagri, bukan layanan resmi ANRI. Header setiap berkas data SQL memuat lisensi MIT; [README database](https://github.com/cahyadsn/wilayah/blob/5d450ccbc94cc487f54bf2a262300efe97aa58af/db/README.md) juga secara eksplisit melisensikan database sebagai MIT. Salinan atribusi/lisensi disertakan di `public/data/geometry/LICENSE-cahyadsn.txt`.

Hasil pembacaan dan validasi aktual:

- **38 provinsi, 514 kabupaten/kota**, seluruh ID unik dan parent kabupaten/kota sah. Enam provinsi di wilayah Papua menggunakan kode `91` sampai `96`; Kaimana `92.08` berada di Papua Barat dan Kabupaten Sorong `96.01` berada di Papua Barat Daya.
- **38 geometri provinsi, 514 geometri kabupaten/kota** tersedia. Provinsi disertakan dalam `public/data/references.json`; geometri kabupaten/kota dipisah menjadi 38 berkas `/data/geometry/kab-kota/{provinceId}.json` untuk dimuat hanya saat diperlukan.
- Sistem koordinat keluaran: GeoJSON longitude/latitude dalam derajat, ditampilkan dengan konvensi geografis WGS84 Leaflet. Sumber menyimpan pasangan latitude/longitude dan tidak menyatakan datum EPSG secara eksplisit. Urutan pasangan ditukar secara teruji; tidak ada proyeksi atau geocoding kantor.
- Batas telah disederhanakan oleh penerbit. Konverter mempertahankan hierarki polygon/multipolygon, menutup ring sesuai GeoJSON, dan membulatkan ke lima desimal. Ring pulau sangat kecil memakai presisi asli bila pembulatan akan menghilangkan area.
- Sepuluh ring sumber Kabupaten Sorong hanya mempunyai dua titik unik, sehingga tidak membentuk area. Ring ini **tidak digambar dan tidak dilengkapi dengan titik buatan**. Bagian poligon Sorong yang valid tetap tampil. Rincian serta URL sumber dicatat pada `geometry/metadata.json`.
- Registry sumber dan bounds hanya untuk navigasi wilayah. `labelPosition` memakai kolom `lat,lng` wilayah dari SQL penerbit, dengan URL provenance pada `labelPositionSource`. Seluruh 552 pasangan numerik diperiksa valid dan berada dalam bounds wilayahnya. Ini posisi penanda administratif, bukan koordinat kantor, centroid yang dihitung sendiri, atau titik hukum. Koordinat instansi tetap null jika kantor belum diketahui.
- Tanggal pengambilan dengan zona waktu, commit sumber, SHA-256 dan ukuran setiap berkas tersimpan pada `geometry/metadata.json`. Tanggal pengambilan bukan tanggal pembaruan seluruh batas; tanggal di header sumber bervariasi. Geometri ini untuk visualisasi, bukan penetapan batas legal atau pengukuran presisi.

Regenerasi dari root proyek dengan Node yang didukung:

```sh
npx tsx scripts/build-national-references.ts
```

Skrip hanya membaca literal SQL sebagai data; tidak menjalankan SQL, tidak memerlukan database, dan tidak membaca Excel. Unduhan mentah disimpan di `tmp/national-references/` yang diabaikan Git. Commit sumber dipin agar perubahan upstream tidak diam-diam mengubah hasil. Untuk memperbarui versi, ganti pin secara sadar, jalankan ulang, lalu tinjau count, relasi, metadata dan pengecualian sebelum menerima hasil. `REFERENCE_CAPTURED_AT` dapat diisi timestamp ISO saat mereproduksi snapshot audit yang sama.

## Wilayah BIG — sumber awal/demo, dipertahankan untuk riwayat

Sumber primer: [ArcGIS publik BIG](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer). Copyright layanan menyebut Badan Informasi Geospasial.

- [Layer area provinsi](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer/12): daftar nama `wadmpr` dan kode provinsi `kdppum`. Respons query memuat record kabupaten/kota; normalisasi daftar provinsi memakai pasangan kode dan nama sumber yang unik.
- [Layer area kabupaten/kota](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer/13): kode `kdpkab`, parent `kdppum`, nama `namobj`, dan poligon EPSG:4326.
- ID Banten `36`; ID Kota Serang `36.73`. Nama kabupaten yang hanya ditulis `Serang`, `Lebak`, `Pandeglang`, atau `Tangerang` tetap mengikuti nama asli sumber.
- Versi awal `public/data/references.json` memuat 38 nama/kode provinsi, geometri Banten dari gabungan 8 poligon kabupaten/kota, dan 8 kabupaten/kota Banten. Referensi utama kini diganti sumber nasional di atas. `public/demo/references.json` tetap menggunakan referensi awal agar fixture dan interaksi demo yang telah diaudit tetap stabil.
- Bounds Banten berasal dari respons `returnExtentOnly`; bounds kabupaten/kota diturunkan dari koordinat poligon sumber. `labelPosition` bernilai null, tidak ada titik label perkiraan.
- Extent nasional resmi layanan EPSG:4326: sudut barat daya `[-11.007552182999973, 94.97194993500005]`, sudut timur laut `[6.0767408680000585, 141.02004178900006]`. Ini hanya viewport awal nasional, bukan koordinat instansi.
- Query geometri memakai `maxAllowableOffset=0.003` derajat dari server BIG. Penyederhanaan ditujukan untuk tampilan.
- Penanda `metadata` record menyebut versi sumber 2022–2024. Tanggal pengambilan tidak boleh disebut sebagai tanggal pembaruan seluruh wilayah.
- Metadata layanan yang diperiksa tidak mencantumkan lisensi redistribusi eksplisit. Proyek mencantumkan provenance dan attribution BIG tanpa mengklaim lisensi CC/domain publik.

Respons mentah dan URL query tersimpan terpisah di `tmp/references/` untuk audit lokal: `province-data.json`, `kabkota-data.json`, `banten-bounds.json`, dan `banten-geometries.geojson`. Data normalisasi tidak mengganti sumber mentah.

## Logo dan tautan publik

Logo di `public/assets/logo-anri.png` diunduh utuh dari [aset resmi ANRI](https://anri.go.id/images/logo-anri.png), yang ditautkan oleh [halaman Layanan SIKN dan JIKN](https://www.anri.go.id/layanan-publik/sikn-dan-jikn). Aset horizontal ini tetap disimpan sebagai alternatif. Pada perapian UI 13 Oktober 2026, header menggunakan `public/assets/logo-anri-symbol.png`, diunduh utuh dari [aset simbol resmi](https://anri.go.id/storage/pages/1432882461-9wbymz.png) yang ditautkan [halaman Arti Logo ANRI](https://www.anri.go.id/profil/arti-logo). Logo tidak digambar ulang atau dipotong. [Penjelasan resmi logo](https://anri.go.id/profil/arti-logo) dapat dibaca.

Halaman [Layanan SIKN dan JIKN](https://www.anri.go.id/layanan-publik/sikn-dan-jikn) dan [beranda ANRI](https://anri.go.id) sah sebagai tautan eksternal. Pemeriksaan halaman `https://jikn.anri.go.id/simpul-jaringan` mengalami timeout; menu/search/login yang URL-nya belum terverifikasi harus tetap teks noninteraktif.

Halaman layanan ANRI memuat tautan publik [Data Simpul Jaringan di Datawrapper](https://datawrapper.dwcdn.net/81uDn/1/), namun timestamp, kelengkapan daftar, ID, koordinat, serta definisi statistiknya belum terverifikasi. Data tersebut belum diimpor. Angka lama dalam narasi layanan tidak dipakai sebagai total terkini. Dataset produksi tetap kosong sampai snapshot publik atau berkas resmi lolos validasi.
