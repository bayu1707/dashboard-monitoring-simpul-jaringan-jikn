# Sumber referensi dan batas verifikasi

Referensi ini hanya menjelaskan wilayah dan aset identitas. Tidak ada data instansi, statistik arsip, atau total JIKN yang diambil dari screenshot.

Diperiksa pada `2026-10-12T19:49:29+07:00`.

## Lampiran rancangan

- `A_Spesifikasi_UI_UX_JIKN.docx` berhasil dibaca. Susunan dan perilakunya konsisten dengan permintaan pengguna; angka contoh tidak menjadi data produksi.
- `B_Wireframe_JIKN.pdf` berisi lima halaman. Kelima halaman berhasil dirender dan dilihat: peta awal, tiga lapisan navigasi, popup, detail tanpa tab, serta mobile.
- Tiga screenshot dapat dibaca dan hanya menjadi referensi visual. Ketentuan pengguna tentang tahun bergabung, status, nilai null, dan penghapusan tab lebih diutamakan daripada angka/kontak/tab pada screenshot.

## Wilayah BIG

Sumber primer: [ArcGIS publik BIG](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer). Copyright layanan menyebut Badan Informasi Geospasial.

- [Layer area provinsi](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer/12): daftar nama `wadmpr` dan kode provinsi `kdppum`. Respons query memuat record kabupaten/kota; normalisasi daftar provinsi memakai pasangan kode dan nama sumber yang unik.
- [Layer area kabupaten/kota](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_WILAYAH/MapServer/13): kode `kdpkab`, parent `kdppum`, nama `namobj`, dan poligon EPSG:4326.
- ID Banten `36`; ID Kota Serang `36.73`. Nama kabupaten yang hanya ditulis `Serang`, `Lebak`, `Pandeglang`, atau `Tangerang` tetap mengikuti nama asli sumber.
- `public/data/references.json` memuat 38 nama/kode provinsi, geometri Banten dari gabungan 8 poligon kabupaten/kota, dan 8 kabupaten/kota Banten. Cakupan sengaja `partial`: geometri nasional dan kabupaten/kota di luar Banten belum tersedia dalam proyek.
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
