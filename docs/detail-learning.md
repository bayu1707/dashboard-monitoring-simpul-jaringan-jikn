# Memahami halaman detail simpul

Halaman `src/pages/InstansiDetailPage.tsx` membaca profil dan referensi melalui `InstansiRepository`. Komponen tidak membaca berkas JSON langsung. Saat sumber REST resmi tersedia, kontrak repository tetap dapat dipakai dengan adapter lain.

Urutan belajar yang disarankan:

1. Baca `src/types/domain.ts`: `Instansi` menyimpan identitas, `StatistikSimpul` menyimpan tiga metric, dan `SnapshotMetadata` menjelaskan waktu, sumber, serta cakupan. Nilai belum diketahui selalu `null`, bukan `0`.
2. Perhatikan pembacaan asinkron di halaman detail. Hasil request memiliki ID, repository, dan nomor percobaan sehingga profil sebelumnya tidak muncul ketika ID berganti. Cleanup mencegah request lama menimpa halaman baru. Tombol **Coba lagi** membaca repository yang sama.
3. Buka `ProfileCard.tsx` dan `StatisticCards.tsx`. Tahun bergabung terpisah dari tanggal pembaruan sumber. Status ditampilkan hanya dari nilai sumber. Email dan telepon menjadi tautan setelah validasi.
4. Baca `src/services/metrics.ts`. Kontribusi memakai numerator instansi dan denominator nasional yang kompatibel. Cakupan parsial, tanggal berbeda, snapshot berbeda, definisi berbeda, atau denominator kosong menyebabkan hasil `null`.
5. Baca komponen grafik di `src/components/charts`. Tren menampilkan tambahan record berdasarkan tahun input. Pilihan 1/5 tahun mengikuti tahun kalender tanggal acuan dataset. Tahun tanpa nilai tetap kosong. Bar dan garis memakai seri yang sama. **Lihat tabel tren** menyediakan alternatif tekstual. Distribusi memakai kategori sumber; kategori tidak diketahui tidak diisi otomatis. Tombol **Perluas daftar** menampilkan pencipta tambahan yang benar-benar ada.
6. Baca `src/services/session.ts` untuk tombol **Kembali ke Peta**. URL dan session memulihkan lapisan, filter, pusat peta, zoom, serta posisi daftar. Profil yang dibuka langsung menurunkan pasangan wilayah dari data profil. Tombol tidak menggunakan `history.back()` secara buta.
7. Buka `src/styles/detail.css`. Desktop memakai kolom 40%/60% dengan gap 24 px; tablet dan mobile memakai satu kolom dengan urutan profil, informasi, statistik, kontribusi, pembaruan, tren, distribusi, pencipta, serta catatan sumber. Tidak ada tab internal.

`tests/detail.test.tsx` memakai fixture **sintetis** yang terpisah dari data utama. Pengujian memeriksa nilai null versus nol, tahun bergabung yang kosong, status yang tidak diasumsikan, ID tidak ditemukan, retry, navigasi kembali, rentang tahun kosong, cakupan distribusi parsial, perluasan pencipta, dan kecocokan denominator kontribusi. SVG grafik dan ukuran layar perlu diperiksa juga di browser; pengujian unit membaca tabel serta ringkasan nilai aksesibel.

Tanggal **Pembaruan sumber** menjelaskan kapan data sumber berubah. **Snapshot diambil** menjelaskan kapan snapshot diperoleh. Keduanya tidak menunjukkan pemantauan real time. Nilai **Record ditambahkan bulan acuan** hanya ditampilkan ketika `monthlyAdded.yearMonth` cocok dengan bulan `metadata.referenceDate`.

Saat mengimpor data resmi, jangan mengganti metric kosong dengan angka contoh. Pertahankan kartu serta keadaan **Belum tersedia** sampai seri dan definisi sumber diberikan.
