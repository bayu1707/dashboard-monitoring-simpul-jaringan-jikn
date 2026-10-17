# Mengisi snapshot simpul

Dataset publik tetap kosong karena screenshot rancangan bukan sumber data instansi. Snapshot Excel pengguna direview lokal sesuai [panduan casefile](casefile-import.md). Statistik baru tampil setelah sumber metric tersedia. DATA DEMO selalu terpisah di `public/demo/` dan hanya aktif melalui query `demo=1`.

1. Dapatkan snapshot publik JIKN atau berkas resmi yang sah. Catat URL/nama berkas, tanggal pengambilan dengan zona waktu, tanggal acuan, definisi setiap metric dan apakah cakupannya `full` atau `partial`. Tidak perlu kredensial admin dan jangan melakukan geocoding otomatis.
2. Simpan berkas asli terpisah dari normalisasi, di lokasi privat di luar aset publik atau `.local/` yang diabaikan Git. Folder `public` ikut disajikan ke browser. Jangan menaruh workbook internal di sana.
3. Salin `public/data/import-template.json` ke berkas kerja. Isi `metadata`, `instansi`, dan `statistics` sesuai domain di `src/types/domain.ts`. Nilai yang tidak diketahui harus `null`, bukan angka nol, string kosong atau koordinat pusat kota.
4. Cocokkan `provinceId` dan `kabKotaId` dengan `references.json`. ID wilayah mengikuti kode administratif registry (`36`, `36.73`) dan nama asli referensinya. Wilayah yang belum diketahui memakai null, tanpa koordinat perkiraan. ID instansi resmi diprioritaskan; jika belum tersedia, gunakan ID lokal stabil dengan provenance. Jangan deduplikasi berdasarkan nama atau kode duplikat.
5. Isi `jenisInstansi` dan `archiveCategories` pada referensi hanya berdasarkan taksonomi sumber resmi. Nilai `jenisId` dan `categoryId` wajib ada di taksonomi. Dua statistik bernama sama tidak otomatis memiliki definisi sama.
6. Jalankan `npm run validate:data -- path/snapshot-normalisasi.json path/references.json`. Laporan menolak ID ganda, relasi wilayah salah, kategori tidak sah, koordinat bukan pasangan lat/lng atau di luar rentang, tanggal tidak valid, tahun bergabung melampaui acuan dan metric negatif. Perbaiki berdasarkan sumber; jangan menggabungkan atau menebak otomatis.
7. Setelah pemeriksaan sumber selesai, ganti `public/data/snapshot.json` dan referensinya dengan hasil normalisasi serta metadata `datasetKind: "verified"`. Jalankan seluruh pemeriksaan proyek dan tinjau UI pada kondisi parsial.

`capturedAt` adalah waktu pengambilan sumber; `sourceUpdatedAt` adalah tanggal sumber memperbarui profil. Keduanya berbeda dari `joinedYear`. Timestamp bawaan template/demo adalah waktu pembuatan fixture, bukan pengambilan data JIKN.

`statistik` selalu memiliki tiga metric (`jumlahArsip`, `penciptaArsip`, `kopiDigital`) dengan `value`, `definition`, `scope`, `snapshotId` dan `referenceDate`. Value `0` sah. `penciptaArsip` menghitung entitas pencipta unik; `kopiDigital` menghitung objek menurut definisi sumber, bukan otomatis record dengan file. Bila satu profil belum memiliki statistik, repository menyediakan metric null dan empty state.

`nationalTotal` hanya diisi dari total resmi dengan definisi, tanggal acuan, dan ID snapshot yang cocok. Repository tidak menghitung total nasional dari array simpul. Kontribusi ditampilkan hanya jika cakupan metadata `full`, numerator berscope `instansi`, denominator berscope `nasional` dan bernilai positif. Jika sumber denominator berbeda snapshot/waktu, kontribusi tetap Belum tersedia.

`trenInput` berisi tambahan record berdasarkan waktu input. Jangan gunakan tahun penciptaan arsip atau total kumulatif. Tahun yang datanya belum diketahui bernilai null. Untuk `1 tahun` dan `5 tahun`, UI menggunakan kalender yang berakhir pada tahun `referenceDate`; tahun tanpa nilai ditandai Belum tersedia. `Semua` memakai periode yang tersedia. `monthlyAdded` hanya diisi jika sumber menyediakan input bulan kalender yang sama dengan tanggal acuan.

Distribusi memakai taksonomi sumber. Jangan memaksa persentase menjadi 100; cantumkan kategori belum diklasifikasikan jika jumlahnya diketahui dan jelaskan cakupan. Pencipta memiliki ID stabil; jika satu record terkait banyak pencipta, isi `multiCreator: true` agar UI menjelaskan penjumlahan antarbaris.

Adapter REST resmi berikutnya dapat mengimplementasikan `InstansiRepository` (`getReferenceData`, `listInstansi`, `getInstansiDetail`) tanpa mengganti komponen. Gunakan endpoint resmi yang diberikan kemudian; aplikasi ini tidak membuat atau menebak endpoint.
