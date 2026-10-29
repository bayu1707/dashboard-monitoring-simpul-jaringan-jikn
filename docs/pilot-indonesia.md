# Pilot Indonesia — katalog snapshot nasional

Ditinjau 23 Oktober 2026. Melanjutkan Nuxt/Vue + Laravel dan pipeline data existing. Tidak mengubah kontrak API, desain, geometri, navigasi, popup atau kode React legacy. API resmi SIKN belum diintegrasikan.

## Cakupan dan sumber

- **643 instansi, 643 tahun bergabung, 627 pin, 16 tanpa pin; 38 provinsi dan 514 kabupaten/kota referensi.** Semua 643 identitas pada snapshot Excel tercakup. Ini bukan klaim seluruh instansi SIKN aktif atau koordinat yang disahkan ANRI.
- Penambahan terakhir: **90 identitas/78 pin**, termasuk Bali, NTB, NTT, Maluku, Maluku Utara, enam provinsi Papua, serta 15 nama/alias kementerian, badan, kampus dan wilayah yang sebelumnya belum dipetakan. Dua belas tambahan tanpa pin; empat pengecualian sebelumnya dipertahankan.
- **553 record/549 pin sebelumnya tetap utuh**, termasuk nama, ID, kode, kategori, tahun, alamat/koordinat, sumber dan Landing Page ANRI. Nilai statistik lama tidak berubah; konteks snapshot dan penyebut kontribusi diperbarui untuk katalog gabungan.
- Nama/kode/ID/kategori/tahun berasal dari `Indonesia.xlsx`, sheet **pengelolaan casefile**. Workbook tidak diubah/disalin. Snapshot sumber `public/data/datasets/excel/snapshot.json` tidak berubah: SHA-256 `da653f461b63fd8bd9bc4b2e451f7549080a761eb5a3f69feacddd89f9293fa0`.
- Mode `?data=excel` tetap 643 record/0 pin/0 statistik; `?demo=1` tetap 7 instansi sintetis/6 pin. Mode pilot berisi statistik, tren, distribusi dan pencipta **DATA SIMULASI**, bukan API resmi atau real-time. Tahun bergabung bukan simulasi. Total arsip nasional tetap `null`.

| Kategori Excel | Instansi |
| --- | ---: |
| Kementerian/Lembaga | 103 |
| LKD Provinsi | 35 |
| LKD Kabupaten | 365 |
| LKD Kota | 92 |
| Perguruan Tinggi Negeri | 35 |
| Perguruan Tinggi Keagamaan Negeri | 3 |
| Perguruan Tinggi Swasta | 5 |
| Perguruan Tinggi Kedinasan | 2 |
| Badan Usaha Milik Negara | 3 |

## Wilayah dan koordinat

Navigasi tetap **Indonesia → provinsi → kabupaten/kota → instansi**. Klik wilayah mengubah filter/level, bukan hanya zoom. Pin kantor baru tampil pada level instansi; hanya record berkoordinat yang dihitung cluster. Instansi tanpa pin tetap tampil dalam hasil wilayah, Daftar, pratinjau dan detail; pencarian global juga menemukannya.

Referensi kode/geometri existing tidak dimodifikasi. Sumber Cahya DSN beserta commit/version, CRS WGS84, provenance dan lisensi MIT tetap tercatat pada referensi dan `public/data/geometry/`. Geometri kab/kota dimuat per provinsi melalui API Laravel existing; tidak merender 514 polygon sekaligus. Kode wilayah Papua mengikuti referensi 38 provinsi, misalnya Kaimana di Papua Barat dan Mamberamo Tengah di Papua Pegunungan. Lokasi fisik kampus/kantor pusat ditinjau terpisah dari kategori pemilik instansi.

Koordinat tambahan memakai fitur tempat publik Google Maps yang ditinjau berdasarkan nama/alamat dan polygon, bukan pusat kamera, titik acak atau centroid wilayah. Sumber resmi dipakai untuk membantu identitas/alamat ketika tersedia. Bahan kurasi mencatat ID fitur, URL, label lokasi, alamat publik, pasangan koordinat, waktu tinjauan, dan alasan pemilihan/penolakan. Foto, ulasan, kontak personal, kredensial dan data pengguna Maps tidak disalin. Sumber Maps tidak disebut berlisensi MIT; lisensi MIT hanya untuk referensi geometri yang sudah ada.

Satu tinjauan batas tambahan: layanan **Gedung C Kemendikdasmen**, sesuai [alamat resmi Biro Komunikasi](https://bkhm.kemendikdasmen.go.id/hubungi-kami/), berjarak 16,9 m di luar garis generalisasi Jakarta Pusat. Pin sumber tidak dipindahkan; tinjauan memakai aturan existing maksimal 100 m dengan alamat resmi. Pin Kaimana, Kabupaten Sorong dan BPKS Sabang ditolak sementara karena konflik batas/bukti belum cukup. Aturan validasi tidak diperlonggar.

Nama historis BATAN, Angkasa Pura I, kementerian yang berubah dan dua record pariwisata tetap memakai identitas Excel yang berbeda. Pin bisa merujuk kompleks/kampus/unit layanan atau kantor sementara Papua Tengah; tidak mengklaim lokasi ruang arsip atau identitas penerus resmi SIKN. Catatan per record menjelaskan kebutuhan konfirmasi tim.

| Provinsi | Instansi | Pin | Kab/kota referensi |
| --- | ---: | ---: | ---: |
| Aceh | 26 | 25 | 23 |
| Bali | 12 | 12 | 9 |
| Banten | 13 | 13 | 8 |
| Bengkulu | 11 | 11 | 10 |
| Daerah Istimewa Yogyakarta | 7 | 7 | 5 |
| Daerah Khusus Ibukota Jakarta | 102 | 102 | 6 |
| Gorontalo | 7 | 7 | 6 |
| Jambi | 12 | 12 | 11 |
| Jawa Barat | 39 | 39 | 27 |
| Jawa Tengah | 41 | 41 | 35 |
| Jawa Timur | 55 | 55 | 38 |
| Kalimantan Barat | 15 | 15 | 14 |
| Kalimantan Selatan | 15 | 15 | 13 |
| Kalimantan Tengah | 15 | 15 | 14 |
| Kalimantan Timur | 11 | 11 | 10 |
| Kalimantan Utara | 6 | 6 | 5 |
| Kepulauan Bangka Belitung | 8 | 8 | 7 |
| Kepulauan Riau | 9 | 9 | 7 |
| Lampung | 17 | 17 | 15 |
| Maluku | 7 | 7 | 11 |
| Maluku Utara | 9 | 6 | 10 |
| Nusa Tenggara Barat | 11 | 11 | 10 |
| Nusa Tenggara Timur | 23 | 21 | 22 |
| Papua | 2 | 2 | 9 |
| Papua Barat | 5 | 4 | 7 |
| Papua Barat Daya | 2 | 1 | 6 |
| Papua Pegunungan | 4 | 1 | 8 |
| Papua Selatan | 2 | 2 | 4 |
| Papua Tengah | 3 | 2 | 8 |
| Riau | 13 | 13 | 12 |
| Sulawesi Barat | 8 | 8 | 6 |
| Sulawesi Selatan | 21 | 19 | 24 |
| Sulawesi Tengah | 13 | 13 | 13 |
| Sulawesi Tenggara | 13 | 12 | 17 |
| Sulawesi Utara | 11 | 11 | 15 |
| Sumatera Barat | 21 | 21 | 19 |
| Sumatera Selatan | 19 | 18 | 17 |
| Sumatera Utara | 35 | 35 | 33 |

## Pengecualian koordinat

Seluruh record berikut tetap tersedia. Tim dapat mengganti koordinat menggunakan ID stabil, tanpa mengubah nama/tahun/kode atau menyusun ulang identitas. Alasan lengkap dan sumber ada pada catatan record serta file kurasi. Tidak memakai lokasi instansi lain sekadar agar popup muncul.

| Instansi | ID stabil | Masalah yang perlu dikonfirmasi |
| --- | --- | --- |
| Dinas Perpustakaan dan Kearsipan Kabupaten Sorong | `casefile-19f9fea14acfc1ab0e8b7bce` | Pin publik Kabupaten Sorong 3,01 km di luar polygon referensi. |
| Dinas Kearsipan dan Perpustakaan Daerah Kabupaten Pegunungan Bintang | `casefile-21041d5e70066c929bedc97f` | Hasil pusat Oksibil/Bupati/Dinas Pendidikan, bukan kantor perpustakaan. |
| Dinas Perpustakaan dan Kearsipan Kabupaten Halmahera Barat | `casefile-3d0cef02238bc8361aada01e` | Hasil instansi kabupaten lain/perpustakaan desa, bukan Dinas Halmahera Barat. |
| Dinas Perpustakaan Kota Parepare | `casefile-4d38343a923ea5817d9ae016` | Pin Parepare 57,74 m di luar polygon; alamat resmi/batas belum pasti. |
| Dinas Kearsipan dan Perpustakaan Kabupaten Kupang | `casefile-6f6c21b465cbe699e7c6e6c3` | Hasil Kota Kupang/NTT, bukan Kabupaten Kupang. |
| Dinas Perpustakaan dan Kearsipan Kabupaten Kaimana | `casefile-73ece091bc2cb474bb139b9a` | Pin Kaimana 14,68 m di luar polygon; bukti publik belum memenuhi tinjauan batas. |
| Dinas Kearsipan dan Perpustakaan Daerah Kabupaten Halmahera Selatan | `casefile-7666e02290640ff0f744c92b` | Hasil komunitas Gerilia dan instansi lain, bukan Dinas Halmahera Selatan. |
| Dinas Perpustakaan dan Arsip Daerah Kabupaten Jayawijaya | `casefile-944668cc66a1db8e74a4fd44` | Hasil publik belum cocok dengan Dinas Jayawijaya. |
| Dinas Kearsipan dan Perpustakaan Kabupaten Kepulauan Sula | `casefile-a189061db487788b8dc3f42b` | Hasil pelabuhan/instansi lain; kantor Kepulauan Sula belum pasti. |
| Dinas Perpustakaan dan Kearsipan Daerah Kabupaten Mammberamo Tengah | `casefile-a23fa92695af7586e7667659` | Nama wilayah terpetakan, titik kantor Mamberamo Tengah belum ditemukan. |
| Dinas Perpustakaan dan Kearsipan Kabupaten Sumba Barat Daya | `casefile-ac502e577a83844609b82e9f` | Fitur SBD ditemukan tanpa alamat yang dapat dicocokkan. |
| Dinas Kearsipan dan Perpustakaan Kabupaten Ogan Komering Ilir | `casefile-adadd4ae25edba10ef95bf6b` | Konflik listing/alamat Ogan Komering Ilir dari tahap Sumatra. |
| Dinas Perpustakaan dan Kearsipan Kabupaten Sinjai | `casefile-bf1032193988af5c61840d5b` | Pasangan koordinat dalam teks alamat Sinjai berbeda jauh dari titik fitur. |
| Dinas Kearsipan dan Perpustakaan Kabupaten Puncak Jaya | `casefile-c76352efec0af0fc933412fd` | Hasil kantor dinas lain, bukan Perpustakaan Puncak Jaya. |
| Dinas Perpustakaan dan Kearsipan Kabupaten Kolaka | `casefile-e155d6b135b6848523b25714` | Hasil Kolaka Timur/nama historis Bapersikom belum memastikan kantor Kolaka. |
| Badan Pengusahaan Kawasan Perdagangan Bebas dan Pelabuhan Bebas Sabang | `casefile-f9402e91eab11b72ce3bb5d5` | Alamat BPKS sesuai kontak resmi, tetapi pin 230 m di luar polygon Sabang. |

## Menghasilkan ulang dan mengganti data tim

File terkait:

- `data/curation/national-completion-locations.json`: 90 review tambahan; tidak berisi workbook/credential/kontak personal.
- `scripts/build-national-pilot.ts`: validasi pin dan penggabungan berdasarkan ID, bukan urutan baris/kode unik saja.
- `public/data/datasets/pilot/{snapshot,references}.json`: paket runtime bersama untuk clone.
- `public/data/datasets/manifest.json`: jumlah dan SHA-256; tidak mengubah konfirmasi izin existing.
- `tests/national-catalogue.test.ts` dan `frontend/tests/e2e/national.spec.ts`: regresi data dan interaksi nasional.

```sh
# Dari root, dependency sudah terpasang
npm run build:indonesia
# Menulis dua JSON pilot + manifest lokal, bukan Git/deployment
npm run build:indonesia -- --publish
npm run validate:shared
```

Keluaran review dan pengecualian lengkap tersimpan lokal di `.local/national-pilot/staged/report.json`. Builder menolak ID/tahun/nama/kategori yang berbeda, ID ganda, cakupan yang kehilangan record Excel, serta pin tanpa bukti/batas yang sah. Rebuild deterministik dan mempertahankan record di luar 90 ID tambahan. Setelah memperbarui pipeline wilayah lama, jalankan builder Indonesia kembali agar katalog gabungan tetap 643 record. Jangan menerbitkan keluaran pipeline Sumatra/Jawa lama sebagai pengganti katalog nasional.

Ketika tabel final tim tersedia, cocokkan dahulu ID snapshot dengan ID SIKN resmi; kode Excel duplikat `31025-1` dan `25316-5` tidak boleh menjadi kunci tunggal. Review koordinat, alamat, tanggal dan sumber serta mapping Landing Page terpisah. Jangan menyalin satu UUID untuk semua instansi. Saat ini **1 Landing Page terverifikasi (ANRI), 642 belum tersedia** dan tombolnya disabled. Tahun tetap berasal dari Excel sampai ada sumber resmi pengganti yang disepakati.

## Menjalankan dan memeriksa

Jalankan Laravel di `http://127.0.0.1:8000` dan Nuxt di `http://127.0.0.1:3000` sesuai README. Data bersama tidak bergantung pada `.local`/workbook. Contoh: Bali → Denpasar (`provinsi=51&kabKota=51.71`), Maluku → Ambon (`81`/`81.71`), Papua Pegunungan → Yahukimo (`95`/`95.03`). Mamberamo Tengah (`95`/`95.05`) menyediakan Daftar/detail tanpa membuat pin palsu.

Pengujian data memeriksa kesamaan 643 identitas/tahun dengan Excel, 627 pin, 16 null, 38/514 referensi, taksonomi dan mode, perlindungan 553 record sebelumnya, determinisme, ID ganda, hash sumber dan statistik simulasi. Browser test memakai data/API Laravel sungguhan; tile fixture menghindari ketergantungan provider dalam tes otomatis. Pengujian tambahan mencakup desktop 1440 px, sentuh 390 px, popup, anchor, pencarian, detail/back serta record tanpa marker. Hasil aktual dicatat terpisah pada laporan QA lokal; Windows fisik dan verifikasi lapangan belum dilakukan.
