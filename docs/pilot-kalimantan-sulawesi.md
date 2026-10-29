> Riwayat tahap Kalimantan–Sulawesi. Default terbaru mencakup Indonesia; gunakan [builder Indonesia](pilot-indonesia.md) setelah memperbarui kurasi tahap lama.

# Pilot Kalimantan dan Sulawesi

Ditinjau pada 23 Oktober 2026. Perluasan memakai Nuxt/Vue + Laravel baca snapshot existing, dengan kontrak repository yang sama. API resmi SIKN belum terhubung.

## Cakupan

- Tambahan **135 instansi**, dengan **132 pin publik** dan **3 tanpa pin**. Kalimantan 62 instansi/62 pin; Sulawesi 73 instansi/70 pin.
- Gabungan Jawa–Sumatra–Kalimantan–Sulawesi: **553 instansi, 549 pin, 27 provinsi, 410 kabupaten/kota**. Empat record tanpa pin termasuk satu pengecualian Sumatra sebelumnya.
- Ke-418 record Jawa–Sumatra beserta 417 pin, tahun bergabung, identitas, dan tautan ANRI dipertahankan. Nilai statistik lama tetap sama; ID konteks snapshot dan penyebut kontribusi mengikuti paket gabungan.
- Nama, kode, ID, kategori, dan tahun mengikuti snapshot 643 instansi dari sheet **pengelolaan casefile**. Workbook sumber dan snapshot Excel penuh tidak diubah. Snapshot penuh tetap 643 record/0 pin melalui `?data=excel`; mode demo tetap terpisah.
- Kategori tambahan: 99 LKD Kabupaten, 20 LKD Kota, 11 LKD Provinsi, dan 5 PTN. Tidak mengklaim seluruh kampus/K/L di kedua pulau sudah tercakup.

| Provinsi | Instansi | Pin | Kab/kota referensi |
| --- | ---: | ---: | ---: |
| Gorontalo | 7 | 7 | 6 |
| Kalimantan Barat | 15 | 15 | 14 |
| Kalimantan Selatan | 15 | 15 | 13 |
| Kalimantan Tengah | 15 | 15 | 14 |
| Kalimantan Timur | 11 | 11 | 10 |
| Kalimantan Utara | 6 | 6 | 5 |
| Sulawesi Barat | 8 | 8 | 6 |
| Sulawesi Selatan | 21 | 19 | 24 |
| Sulawesi Tengah | 13 | 13 | 13 |
| Sulawesi Tenggara | 13 | 12 | 17 |
| Sulawesi Utara | 11 | 11 | 15 |

## Lokasi dan sumber

- Kurasi dapat diperiksa di `data/curation/kalimantan-sulawesi-locations.json`. Setiap pin memiliki ID fitur Google Maps, URL tempat, label, alamat publik, koordinat fitur, waktu pemeriksaan, dan catatan. Hasil publik dibaca dari tautan data pada halaman pencarian Google Maps; nama/alamat kandidat ditinjau sebelum dipilih. Tidak menyalin foto, ulasan, nomor telepon, atau data pengguna Maps.
- Koordinat fitur digunakan apa adanya, bukan koordinat pusat kamera, geocoding alamat, atau pusat kabupaten/kota. Pemeriksaan polygon memakai geometri existing dengan sumber dan lisensi MIT yang tercatat pada referensi. Tidak mengunduh ulang atau mengubah geometri.
- Seluruh 132 pin lolos bounds/polygon kab/kota. Pin publik tetap membutuhkan konfirmasi instansi sebelum penggunaan operasional; status verified di pipeline berarti bukti publik dan penempatan wilayah lolos, bukan verifikasi lapangan ANRI.
- Dinas tingkat provinsi ditempatkan menurut wilayah fisik pin tanpa mengubah kategori LKD Provinsi. Beberapa titik merupakan unit layanan, depo arsip, kompleks pemerintah atau kampus, bukan lokasi pasti ruang arsip. Label lokasi dan catatan per record menjelaskan keterbatasannya.
- Rujukan resmi tambahan antara lain situs Dinas Kalbar, Dinas Sulteng, Singkawang, Unsulbar, Sekretariat Daerah Katingan, serta PPID Kolaka. Peta tertanam Sekretariat Daerah Katingan mengacu pada fitur kompleks Kantor Bupati yang sama; pusat kamera iframe tidak digunakan.
- Perbedaan antar-kandidat kantor/layanan dicatat, antara lain Palu, Sigi, Palangka Raya, Baubau, Barru, Sintang, Konawe Selatan dan Mamuju Tengah. Pilihan pin merupakan rujukan publik yang ditinjau, bukan jaminan gedung operasional terbaru.

## Pengecualian yang perlu ditinjau tim

| Instansi | ID | Alasan marker belum dibuat |
| --- | --- | --- |
| Dinas Perpustakaan Kota Parepare | `casefile-4d38343a923ea5817d9ae016` | XJRC+CGR, Ujung Sabbang, Kec. Ujung, Kota Parepare, Sulawesi Selatan 91114. Fitur Perpustakaan Umum Kota Parepare ditemukan, tetapi titik berada sekitar 57,74 meter di luar polygon referensi dekat pesisir. Alamat resmi/ketelitian batas belum berhasil dikonfirmasi. Titik sumber tidak digeser; menunggu pemeriksaan geometri atau koordinat kantor oleh tim. Sumber tinjauan: https://www.google.com/maps/place/Perpustakaan%20Umum%20Kota%20Parepare/data=!4m5!3m4!1s0x2d95bb23feaa5731:0xecb5a49787887d!8m2!3d-4.0088836!4d119.6212623 |
| Dinas Perpustakaan dan Kearsipan Kabupaten Sinjai | `casefile-bf1032193988af5c61840d5b` | Alamat kantor belum tersedia. Pin Google Maps memuat pasangan angka koordinat di teks alamat yang berbeda jauh dari koordinat fitur. Menunggu konfirmasi lokasi kantor Sinjai; tidak memilih salah satu secara spekulatif. Sumber tinjauan: https://www.google.com/maps/search/Dinas%20Perpustakaan%20dan%20Kearsipan%20Kabupaten%20Sinjai?hl=id |
| Dinas Perpustakaan dan Kearsipan Kabupaten Kolaka | `casefile-e155d6b135b6848523b25714` | Alamat kantor belum tersedia. Hasil pencarian utama justru menunjuk Kolaka Timur. Fitur Bapersikom di Jl. Pemuda memakai nama organisasi historis; belum ada bukti cukup bahwa titik itu masih kantor Dinas Perpustakaan Kabupaten Kolaka. Alamat resmi Jl. Pemuda belum cukup untuk menetapkan koordinat. Sumber tinjauan: https://dispusip.kolakakab.go.id/ | https://sinole-ppid.kolakakab.go.id/satuan-dan-unit-kerja/ | https://www.google.com/maps/search/Dinas%20Perpustakaan%20dan%20Kearsipan%20Kabupaten%20Kolaka?hl=id |

Ketiganya tetap dapat ditemukan melalui pencarian global, dropdown wilayah dan Daftar, membuka pratinjau profil serta halaman detail. Titik tidak dibuat di lokasi perkiraan.

## Landing Page dan statistik

Belum ada URL Landing Page baru yang terverifikasi untuk tambahan ini. Tombol tampil disabled dengan keterangan Tautan belum tersedia. Tautan ANRI existing dipertahankan. Statistik, tren, distribusi, pencipta dan kontribusi tetap **DATA SIMULASI**, bukan statistik resmi atau real-time.

## Menghasilkan ulang paket

Dari root repository, dengan Node sesuai `.nvmrc` dan dependency root sudah terpasang:

```sh
npm run build:kalimantan-sulawesi
npm run build:kalimantan-sulawesi -- --publish
npm run validate:shared
```

Perintah pertama hanya membuat hasil review di `.local/kalimantan-sulawesi/staged/`. `--publish` berarti menulis JSON pilot dan checksum manifest lokal ke `public/data/datasets`; bukan deployment atau Git push. Metadata persetujuan berbagi yang sudah ada dipertahankan. Workbook, `.env`, handoff, bukti mentah, dan snapshot Excel penuh tidak disalin.

Perubahan sumber dilakukan pada file kurasi setelah mencocokkan ID Excel dan meninjau bukti lokasi. Builder menolak identitas/tahun yang berbeda, URL pin tidak cocok, dan titik di luar polygon. Rebuild mengganti hanya cakupan Kalimantan–Sulawesi, sehingga penambahan wilayah yang lain tetap dipertahankan.

Pipeline Sumatra lama adalah tahap sebelumnya dan menghasilkan paket Jawa–Sumatra. Jika dijalankan ulang, jalankan builder perluasan ini sesudahnya sebelum memakai `--publish`. Jangan memakai ekspor lama untuk menimpa paket gabungan tanpa pemeriksaan cakupan.

## Menjalankan dan memeriksa

Jalankan Laravel pada `127.0.0.1:8000` dan Nuxt pada `127.0.0.1:3000` sesuai README. Data runtime Laravel tetap membaca folder `public` root; anggota tim tidak membutuhkan `.local`. Tile peta membutuhkan akses provider/internet.

Contoh:

- Kalimantan Barat → Pontianak: `/simpul-jaringan?provinsi=61&kabKota=61.71`.
- Sulawesi Selatan → Makassar: `/simpul-jaringan?provinsi=73&kabKota=73.71`.
- Sulawesi Tenggara → Kolaka: `/simpul-jaringan?provinsi=74&kabKota=74.01`, lalu Daftar untuk record tanpa pin.

Pengujian tambahan: `tests/kalimantan-sulawesi-catalogue.test.ts` menguji identitas, null/pin, perlindungan data lama, duplikasi, dan determinisme. `frontend/tests/e2e/kalimantan-sulawesi.spec.ts` memakai Laravel sungguhan dengan tile fixture untuk navigasi 11 provinsi, popup, detail/back, pengecualian serta perangkat sentuh 390 px. Hasil aktual pengujian dicatat di laporan QA lokal. Laptop Windows fisik dan konfirmasi lapangan belum dilakukan.
