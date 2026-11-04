# Email dan telepon instansi

Pembaruan 24 Oktober 2026 menyambungkan kontak salinan database SIKN ke halaman detail. Tidak mengubah salinan/sumber SIKN atau mengekspor kontak ke JSON publik. Mode pilot, Excel dan demo tetap terpisah.

## Membuka

Dengan PostgreSQL SIKN lokal, Laravel dan Nuxt aktif, buka `http://127.0.0.1:3000/simpul-jaringan?data=sikn`, pilih instansi, lalu **Lihat detail**. Contoh ANRI: `http://127.0.0.1:3000/simpul-jaringan/casefile-94a1000a341b5162a0f21d7a?data=sikn`.

Email/telepon tidak ditambahkan ke katalog JSON atau daftar massal. Keduanya dibaca melalui adapter hanya ketika detail/popup instansi yang bersangkutan diminta. Frontend tidak menyimpan respons detail SIKN dalam cache permanen; muat ulang detail untuk membaca kembali database. Ini salinan Maret 2026, bukan API vendor atau koneksi real-time ke SIKN pusat.

## Pemilihan yang aman

1. Identitas lokal harus cocok dengan UUID database melalui crosswalk yang diperiksa ulang; kode saja atau nama mirip tidak cukup.
2. Query hanya membaca `is_primary`, `email`, `phone` dari kontak instansi aktif dengan parent instansi aktif, menggunakan parameter repository ID dan transaksi read-only.
3. Pilih tepat satu kontak utama. Bila tidak ada penanda utama, hanya terima satu baris kontak aktif yang unik. Jangan mencampur email dari baris A dan nomor dari baris B.
4. Beberapa kontak utama, beberapa kontak tanpa penanda utama, format tidak valid, atau identitas belum cocok memerlukan peninjauan. Tidak menebak kontak, tidak meminjam dari instansi lain dan tidak mengambil kolom PIC/contact_person atau akun pengguna.
5. Field kosong dan placeholder (misalnya local-part email `null`/`unknown`, atau nomor seluruhnya nol) tetap null/“Belum tersedia”. Nomor disimpan sebagai teks, termasuk nol di depan. Satu nomor valid mendapat tautan `tel:`; satu email valid mendapat tautan `mailto:` dengan alamat di-encode. Data tampilan di-escape oleh Vue.
6. Profil menampilkan sumber dan catatan **belum dikonfirmasi sebagai kontak publik/terbaru**. Satu kontak utama di database masih mungkin diisi dengan kontak personal; tim perlu meninjau hak publikasinya sebelum produksi.

Kontrak instansi yang sudah ada tetap memakai `email`/`phone` nullable. Metadata tambahan opsional: `contactSource`, `contactVerificationStatus` (`needs-review`/`unavailable`), `contactNotes`. Repository mempunyai `detailContacts`; adapter sumber SIKN mempunyai `contacts(repositoryId)`. Adapter API resmi nanti dapat memetakan field vendor ke kontrak yang sama setelah dokumentasinya disepakati.

## Ketersediaan aktual

Audit baca-saja seluruh 643 ID katalog pada 24 Oktober 2026:

| Hasil | Jumlah |
|---|---:|
| Memiliki email dengan format valid, bukan placeholder, dari kontak terpilih | 239 |
| Memiliki telepon valid dari kontak terpilih | 301 |
| Memiliki setidaknya satu kontak | 324 |
| Belum memiliki kontak yang dapat dipasangkan | 319 |
| Dari 319: identitas belum cocok | 289 |
| Dari 319: kontak ambigu | 1 |
| Dari 319: kosong/placeholder/tidak valid | 29 |

Jumlah di atas bukan jaminan kontak masih aktif, publik, atau cakupan seluruh instansi SIKN. Laporan pengecualian hanya berisi ID/alasan, tersimpan lokal di `.local/qa/contacts/availability.json`; tidak berisi nilai email/telepon dan tidak masuk Git.

## Database pengujian

Form `http://127.0.0.1:3000/pengujian?data=dev` menambah/mengedit `dev_institutions.email` dan `phone`. Installer development menambahkan kolom nullable secara idempoten pada database development serta `_test`, bukan SIKN. Tidak mengisi data dummy ke instansi resmi. Data uji tersimpan di PostgreSQL terpisah dan dapat dilihat di Adminer profil Development.

Payload edit/sinkron tanpa kedua field mempertahankan nilai existing. Null/field kosong yang dikirim eksplisit mengosongkan nilai. Backend menolak email/telepon tidak valid sebelum menulis record. Form memuat kembali nilai ketika mengedit. Perubahan kontak ikut menaikkan revisi dan versi record sehingga detail DATA UJI terbuka dapat diperbarui oleh polling existing.

## Pengujian

Unit SQL memeriksa isolasi instansi dan soft-delete. Unit pemilihan memeriksa baris utama, ambiguitas, data kosong, format berbahaya, angka nol di depan, dan larangan mencampur baris. Feature test memeriksa kontak hanya di detail identitas cocok, pemisahan mode Excel, penyimpanan/clear/idempotensi dan penolakan input tidak valid. Browser test opt-in menggunakan database lokal untuk form → API → detail, link email/telepon, akses fokus keyboard dan tampilan mobile.

Tidak ada kredensial atau kontak aktual yang dimasukkan ke source code, screenshot publik, atau dataset Git. Bukti visual lokal disimpan di `.local/qa/contacts/` dan output Playwright yang diabaikan Git.

Hasil verifikasi akhir 24 Oktober 2026:

- Backend: 67 tes / 364 assertions lulus dengan `JIKN_DEV_PG_TEST=1`; `composer lint` lulus.
- Frontend: typecheck, lint, 50 unit tests dan build lulus.
- Browser: 12 tes terpilih lulus, mencakup SIKN nyata, development, regresi mode pilot/Excel, peta/popup, detail, keyboard dan viewport 390px. API/database tidak dimock pada tes ini; tile peta memakai fixture.
- SHA256 snapshot pilot sama sebelum/sesudah. Sebelum browser test menambah record dummy, checksum seluruh field lama dan ID pada 15 record development sama setelah penambahan schema. Browser tests hanya menambah record DATA UJI di database development.
- Jumlah repository SIKN tetap 776; akun pembaca tetap bukan superuser, tanpa INSERT/UPDATE pada contacts atau SELECT pada users. Tidak ada perubahan sumber SIKN, kredensial, maupun operasi Git add/commit/push.
- Email placeholder yang sempat terlihat pada pemeriksaan awal telah disaring. Hitungan awal sebelum penyaringan bukan hasil akhir; angka pada tabel ketersediaan di atas adalah hasil akhir.
