# Pemeriksaan manual dashboard

Hasil implementasi pada 12 Oktober 2026: 56 tes unit/komponen dan 7 skenario browser lulus. Zoom Chrome aktual 200% pada peta/detail juga telah diperiksa tanpa overflow horizontal. Lihat [hasil pemeriksaan](hasil-pemeriksaan.md). Daftar di bawah dapat dipakai untuk pengujian ulang dan perluasan cakupan.

Checklist ini melengkapi tes otomatis pada `tests/e2e/dashboard.spec.ts`. Keberadaan skenario tes tidak berarti tes sudah lulus; jalankan perintah di README dan catat hasil pada lingkungan yang dipakai. Pemeriksaan perangkat fisik dan zoom browser aktual perlu dilakukan terpisah dari emulasi Playwright.

## Persiapan

Jalankan `npm run dev`. Buka `/simpul-jaringan` untuk mode utama dan `/simpul-jaringan?demo=1` untuk latihan. Gunakan browser desktop dengan lebar 1440 px, lalu emulasi layar 390 px dan input sentuh. Jika tersedia, ulangi pada telepon fisik. Catat browser, sistem operasi, ukuran layar, dan tanggal pemeriksaan.

## Alur yang diuji otomatis

- [ ] Klik geometri Banten: lapisan berubah menjadi kabupaten/kota dan Provinsi ikut memilih Banten.
- [ ] Klik Kota Serang: marker/cluster instansi langsung tampil; jenis masih Semua Jenis; Kab/Kota ikut berubah.
- [ ] Cluster menghitung instansi terpetakan. Klik cluster mengurai titik dan tidak mengganti lapisan wilayah.
- [ ] Hover Instansi Demo A membuka popup berlabel DATA DEMO. Pointer dapat berpindah ke tombol Lihat detail melewati jeda 200 ms tanpa popup menghilang.
- [ ] Detail memakai ID yang tepat, tidak memiliki tab internal, dan Kembali ke Peta memulihkan lapisan/filter/viewport.
- [ ] Mengubah cakupan menutup popup. Kembali ke Provinsi menaikkan satu lapisan.
- [ ] Daftar menghitung 7 hasil, 6 terpetakan, dan 1 tanpa koordinat. Instansi Demo C dapat dipratinjau serta dibuka walaupun tidak menjadi marker.
- [ ] Dataset utama tetap kosong dan tidak beralih sendiri ke demo. ID asing menampilkan Simpul tidak ditemukan.
- [ ] Query invalid dibuang; JSON rusak menampilkan kegagalan yang jelas; retry membaca sumber yang sama setelah sumber diperbaiki.
- [ ] Saat host tile diblokir, daftar/filter/marker tetap dapat dipakai dan pesan Peta dasar belum dapat dimuat muncul.
- [ ] Pada sentuh 390 px: Batal membuang draft filter, Terapkan provinsi saja membuka lapisan provinsi, tap Kota Serang langsung membuka instansi, dan tap marker membuka sheet sebelum detail.
- [ ] Reset mobile langsung menutup filter, membersihkan pilihan, serta kembali ke nasional. Tidak ada overflow horizontal pada peta/detail 390 px.
- [ ] Demo B menampilkan statistik 0; Demo C menampilkan Belum tersedia. Reflow dengan viewport 720 px tidak menimbulkan scroll horizontal.

## Pemeriksaan tambahan dengan browser

- [ ] Uji zoom browser aktual 200% pada jendela 1440 px melalui menu browser. Periksa peta, toolbar, dialog, daftar, detail, tabel, dan scroll horizontal. Tes viewport 720 px hanya mensimulasikan reflow; ia tidak membuktikan semua perilaku zoom aktual.
- [ ] Selesaikan navigasi memakai Tab, Shift+Tab, Enter, dan Space: skip-link, dropdown, tombol Daftar, wilayah pada daftar, tautan instansi, serta Lihat detail. Focus ring harus terlihat dan tidak tertutup panel.
- [ ] Hover/pratinjau instansi lalu tekan Escape. Popup harus tertutup dan fokus kembali ke marker/tombol pemicunya. Dari daftar, Enter pada nama instansi harus membuka detail tanpa mouse.
- [ ] Scroll Daftar, buka detail, lalu kembali melalui tombol dan browser Back. Posisi daftar, keadaan buka/tutup, pilihan wilayah, center, serta zoom harus pulih. Tutup/buka kembali daftar juga seharusnya mempertahankan posisi terbaru dalam sesi yang sama.
- [ ] Geser peta manual; jangan ubah cakupan. Hover, buka/tutup daftar, atau render ulang tidak boleh membatalkan geseran. Ganti jenis instansi: tingkat wilayah tetap dan hasil memakai AND.
- [ ] Klik cluster berulang hingga zoom maksimum di Kota Serang. Demo A dan B berada pada koordinat sintetis identik; spiderfy harus membuat masing-masing dapat dipilih, dan count tidak memasukkan Demo C yang tanpa koordinat.
- [ ] Geser marker mendekati keempat tepi peta lalu hover. Popup dan Lihat detail harus terbaca; auto-pan tidak boleh memindahkannya keluar area yang bisa diakses.
- [ ] Pilih provinsi di luar Banten lewat Daftar/dropdown. Tidak ada pointer/bounds perkiraan; keterangan batas belum tersedia muncul dan viewport dipertahankan jika tidak ada titik hasil valid.
- [ ] Pilih kabupaten/kota Banten yang tidak memiliki instansi demo, misalnya Kota Tangerang Selatan. Lapisan tetap instansi, hasil kosong dijelaskan, dan pengguna dapat mengganti wilayah atau Reset.
- [ ] Pada sheet mobile, ubah provinsi setelah kabupaten/kota dipilih: Kab/Kota dan jenis draft harus kosong. Batal harus mempertahankan pilihan yang diterapkan sebelumnya. Terapkan kab/kota dengan jenis kosong tetap membuka instansi.
- [ ] Ulangi tap sheet dan tombol 44 px pada perangkat fisik bila tersedia. Periksa peta tetap bisa digeser serta popup tidak menutupi kontrol penting.
- [ ] Periksa grafik Demo A: bar dan garis menyatakan seri input yang sama; rentang tahun konkret mengikuti tanggal acuan; tahun null kosong; tabel menyediakan nilai yang sama. Perluas daftar pencipta benar-benar membuka baris tambahan.
- [ ] Periksa profil parsial Demo C: tahun bergabung tidak diganti pembaruan sumber, status tidak diasumsikan, dan tiap metric/seri null memakai Belum tersedia.
- [ ] Dengan Network throttling, muat ulang halaman peta dan detail. Keadaan loading harus terbaca dan profil dari ID sebelumnya tidak boleh muncul ketika URL detail berganti.
- [ ] Uji logo gagal dengan fixture demo sementara: set `logoUrl` Demo A ke `/logo-demo-tidak-ada.png`, buka detail, pastikan placeholder netral, lalu kembalikan fixture. Jangan mengubah data produksi untuk pengujian.
- [ ] Blokir hanya request host tile melalui fitur Network request blocking browser, kemudian pakai filter/Daftar. Jangan mematikan seluruh jaringan saat menilai kegagalan tile karena sumber JSON juga dapat ikut gagal. Buka blokir dan tekan retry; posisi hasil tidak diganti titik palsu.
- [ ] Periksa timestamp: pembaruan sumber, pengambilan snapshot, dan tahun bergabung terpisah. Tidak ada label real time. Tidak ada tautan menu yang mati, login palsu, maupun tombol bahasa tanpa integrasi.
- [ ] Baca Console saat melakukan alur tersebut; tidak boleh ada error runtime material. Untuk masalah, catat URL/query, langkah reproduksi, ukuran layar, pesan Console, dan screenshot.

## Data dan aset sebelum tahap berikutnya

- [ ] Snapshot instansi publik/resmi beserta ID, relasi wilayah, kontak publik, tahun bergabung, status, dan koordinat sumber sudah diberikan serta diverifikasi.
- [ ] Definisi jumlah arsip, pencipta unik, kopi digital, seri input, kategori distribusi, dan denominator nasional kompatibel sudah tersedia.
- [ ] Sumber mentah tersimpan terpisah dari normalisasi; setiap dataset memiliki provenance dan capturedAt dengan zona waktu.
- [ ] Geometri kabupaten/kota di luar Banten serta geometri provinsi tambahan tersedia dari referensi sah bila dibutuhkan untuk navigasi nasional lengkap.
- [ ] URL publik menu dan API data resmi diperoleh sebelum kontrol/integrasi baru diaktifkan. Tidak ada deployment pada tahap frontend ini.
