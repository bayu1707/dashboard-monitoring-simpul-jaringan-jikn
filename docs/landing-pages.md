# Pemetaan Landing Page JIKN

Popup memakai dua aksi: **Lihat detail** untuk halaman internal dan **Landing Page** untuk halaman instansi pada JIKN. Tombol eksternal aktif hanya jika URL, sumber pencocokan, waktu verifikasi, dan status `verified` lengkap. URL kosong atau belum terverifikasi menampilkan tombol disabled dengan keterangan **Tautan belum tersedia**. Domain yang diizinkan hanya `https://jikn.anri.go.id` dengan path `/deskripsi-arsip/sj/<UUID>`.

Pemeriksaan bentuk URL bukan bukti bahwa URL milik instansi tersebut. Nama pada halaman tujuan harus dibandingkan dengan nama snapshot atau dokumen pemetaan resmi. Tidak ada pengumpulan massal maupun permintaan kredensial dalam importer.

## Mengisi mapping lokal

1. Salin `docs/landing-pages.template.json` ke `.local/casefile/landing-pages.json`. Template berupa array kosong supaya tidak memasukkan UUID contoh ke dataset.
2. Gunakan ID stabil dari snapshot hasil impor. Jangan memakai kode Excel sebagai UUID atau mencocokkan berdasarkan urutan baris.
3. Untuk setiap hasil verifikasi, isi objek dengan field berikut:

| Field | Isi yang diperlukan |
| --- | --- |
| `instansiId` | ID lokal persis seperti snapshot |
| `expectedName` | Nama persis seperti record snapshot, untuk mendeteksi salah pilih ID |
| `landingPageUrl` | URL halaman instansi yang sudah dibuka dan diperiksa |
| `landingPageSource` | Nama ekspor resmi atau URL sumber dan catatan bukti pencocokan nama; tanpa kredensial/data personal |
| `landingPageVerificationStatus` | `verified` setelah identitas tujuan diperiksa |
| `landingPageVerifiedAt` | Waktu verifikasi ISO 8601 dengan zona waktu |

Mulai dari maksimal lima instansi. Minta persetujuan metode serta hasil sampel sebelum mengumpulkan tautan massal. Jika halaman JIKN memerlukan login, pengguna login sendiri di browser; jangan menyalin password, OTP, cookie, atau token ke mapping, terminal, atau repositori. Hasil review lokal tidak otomatis berarti diizinkan untuk dipublikasikan.

Jalankan dari direktori proyek:

```sh
npx tsx scripts/import-landing-pages.ts .local/casefile/landing-pages.json
```

Parameter opsional berurutan: path snapshot, path output, dan path references. Default snapshot `.local/casefile/snapshot.json`, output `.local/casefile/snapshot-with-landing-pages.json`, references `public/data/references.json`. Jika referensi snapshot disimpan lokal, berikan path referensinya sebagai parameter keempat.

Importer menolak ID tidak dikenal/duplikat, nama yang berbeda, URL berulang untuk instansi berbeda, sumber kosong, timestamp tidak sah/masa depan, serta URL dengan protokol/domain/path/kredensial/query/fragment yang tidak diizinkan. Validasi seluruh baris selesai sebelum output ditulis. Snapshot sumber tidak ditimpa; output harus berada di `.local/` untuk review. Setelah meninjau hasil, gunakan hasil sebagai snapshot lokal melalui konfigurasi proyek; jangan menyalinnya ke aset publik sebelum izin berbagi data ditentukan.

## Hasil pemeriksaan akses awal

Pada 14 Oktober 2026, pembacaan halaman publik `https://jikn.anri.go.id/simpul-jaringan` melalui alat web mengembalikan HTTP 502. Belum ada hyperlink per instansi yang dapat diverifikasi dari pemeriksaan ini. URL contoh pada instruksi pengguna tidak dimasukkan ke record mana pun. Belum dapat dipastikan apakah semua halaman tujuan dapat diakses tanpa login. Pengumpulan sampel harus dilanjutkan ketika sumber pemetaan resmi atau akses interaktif tersedia.

Tahun bergabung tetap berasal dari **Data Pengelolaan Casefile**, terpisah dari sumber Landing Page. Penambahan mapping tidak mengubah nama, tahun, wilayah, koordinat, atau statistik instansi.

## Sampel ANRI dari pengguna — 17 Oktober 2026

Satu mapping untuk **Arsip Nasional RI** sudah diterapkan pada percontohan lokal, berdasarkan konfirmasi langsung pengguna atas hyperlink milik instansi tersebut. `landingPageSource` menyebut konfirmasi pengguna; ini bukan hasil pengumpulan otomatis atau bukti bahwa isi halaman JIKN telah diperiksa. Nama/tahun/koordinat dan statistik tidak berubah. Record lain tetap tidak memiliki URL dan tombolnya disabled.

Input mapping privat tersimpan di `.local/landing-zoom-review-20261017/landing-pages.json`. Untuk mempertahankan mapping saat membangun ulang pilot:

```sh
npm run build:pilot -- .local/coordinate-review-google-20261017/locations.json \
  --landing-pages .local/landing-zoom-review-20261017/landing-pages.json
```

Flag `--landing-pages` bersifat opsional. Tanpa flag, builder memakai tautan dari snapshot Excel sumber saja; mapping tambahan tidak diterapkan. Karena itu, sertakan flag ini ketika membangun ulang hasil review terbaru. Untuk staging, tambahkan `--output .local/landing-zoom-review-20261017/staging`. Template publik tetap kosong dan workbook asli tidak diubah.

Pada percobaan ini, alat web tidak dapat membaca URL tujuan; pengaturan izin browser yang tersimpan juga memblokir akses ke domain JIKN. Tidak mencoba jalur lain untuk melewati blokir atau mengambil kredensial. Fungsi href, `target="_blank"`, `rel="noopener noreferrer"`, hover dan tombol diuji secara lokal. Tes otomatis membuka halaman tujuan **fixture** yang dicegat tanpa koneksi JIKN; hasilnya membuktikan navigasi frontend, bukan ketersediaan situs, kecocokan isi atau kebutuhan login pada halaman asli. Pengguna dapat meninjau halaman asli lewat browser yang mereka izinkan.
