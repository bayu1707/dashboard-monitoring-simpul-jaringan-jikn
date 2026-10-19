# Dataset kolaborasi JIKN

Paket dirilis setelah pengguna mengonfirmasi telah memperoleh izin berbagi seluruh dataset yang diaudit, pada 19 Oktober 2026. Ini mencatat konfirmasi pemilik proyek; bukan klaim lisensi terbuka universal atau pengesahan ANRI atas lokasi/statistik. Repository private tidak otomatis memberi hak redistribusi. Penambahan data/sumber baru harus ditinjau kembali.

## Menjalankan pada macOS dan Windows

Gunakan Node 24.19.0 (engine >=24.15.0 <25), Git, dan npm. Dari root hasil clone:

```sh
npm ci
npm run validate:shared
npm run dev -- --port 5175
```

Buka alamat yang dicetak Vite:

| URL | Sumber |
| --- | --- |
| `/simpul-jaringan` | Pilot Jawa: 249 instansi, 249 pin, 249 tahun, satu Landing Page ANRI |
| `/simpul-jaringan?data=excel` | Excel penuh: 643 instansi, 643 tahun, 0 pin; statistik belum tersedia |
| `/simpul-jaringan?demo=1` | Tujuh instansi sintetis, enam pin; DATA DEMO |

Tidak perlu workbook, Python, `.local`, `.env.local`, kredensial atau backend untuk menjalankan clone. Flag VITE_LOCAL_PILOT/VITE_LOCAL_CASEFILE lama tidak mengendalikan App lagi. `.env.example` hanya untuk pengaturan tile opsional. `npm run build` dan `npm run preview` memakai paket yang sama dengan dev. Aplikasi belum terhubung ke API resmi SIKN/JIKN; tile tetap dapat memerlukan internet. Tombol Landing Page yang belum memiliki mapping tetap disabled; satu mapping ANRI berasal dari konfirmasi pengguna, bukan bukti halaman dapat diakses tanpa login.

## Isi paket runtime

- `public/data/datasets/manifest.json`: versi, konfirmasi izin, jumlah, path dan SHA-256 dependensi.
- `public/data/datasets/pilot/snapshot.json`: 249 identitas, tahun, pin bersumber, mapping dan statistik **DATA SIMULASI**.
- `public/data/datasets/pilot/references.json`: enam provinsi, 119 kab/kota, taksonomi pilot.
- `public/data/datasets/excel/snapshot.json`: 643 record hasil normalisasi sheet `pengelolaan casefile`, tanpa statistik simulasi dan tanpa memaksakan pin.
- `public/data/references.json`: referensi nasional 38 provinsi/514 kab/kota.
- `public/data/geometry/`: geometri kab/kota lazy, provenance dan lisensi MIT Cahya DSN. Pilot memakai kode 31–36; mode Excel memerlukan seluruh referensi.
- Aset ANRI dan demo yang sudah ada tetap digunakan; tidak ada logo instansi baru.

`SnapshotData` tetap berisi metadata/instansi/statistics; `ReferenceData` berisi provinces/kabKota/jenisInstansi/archiveCategories/metadata. Komponen tidak membaca Excel. `createSharedRepository` memakai path dari `src/data/sharedDatasets.ts` yang dicocokkan dengan manifest oleh validator dan memeriksa datasetKind. Adapter lama tetap tersedia bagi pengujian dan pemeliharaan; App tidak meminta `/local-data/` lagi.

Nama/kode/jenis/tahun dan ID pilot sama dengan subset Excel. Perbedaan wilayah kantor fisik yang tercatat tetap dipertahankan; bukan pencocokan ulang berdasarkan urutan/nama. Jangan regenerasi ID. Kelengkapan 249 pin hanya untuk katalog percontohan terpilih, bukan seluruh instansi Jawa/nasional. Tujuh perbedaan alamat, dua lokasi historis dan tiga catatan batas geometri tetap perlu ditinjau per record. Penanda verified administratif bukan pengesahan koordinat lapangan.

Statistik/tren/distribusi/pencipta pilot adalah simulasi. `datasetKind: pilot`, `coverage: partial`, definisi SIMULASI, `sampleTotal` percontohan dan `nationalTotal: null` dipertahankan. Tahun bergabung berasal dari Excel, bukan simulasi. Mode Excel tidak menerima statistik pilot; null tidak diubah menjadi nol. Timestamp snapshot sumber tidak diganti menjadi tanggal ekspor atau disebut real time.

## Batas berbagi dan provenance

Workbook, raw-selected, registry internal, riset/cache halaman pihak ketiga, laporan privat, backup, `.env.local`, kredensial dan kedua PROJECT_HANDOFF tetap lokal. Tidak diperlukan untuk runtime. File `.local` asli tidak diubah. Referensi path lokal pada salinan publik diganti penanda bukti-review-lokal-tidak-disertakan; URL sumber dan catatan keterbatasan tetap tersedia. Email/telepon snapshot bersama kosong. File di `public` dapat diambil melalui browser meskipun repository GitHub private; jangan menaruh data yang hanya boleh dilihat admin di sana.

Lisensi geometri dan attribution provider harus dipertahankan. Izin berbagi paket ini tidak menjadikan konten Google Maps atau logo ANRI berlisensi MIT. Catatan provenance dan pengecualian tidak boleh dihapus untuk memberi kesan seluruh titik telah diverifikasi lapangan. Gunakan peta secara interaktif, jangan mengunduh tile massal untuk paket offline.

## Memperbarui paket setelah review

Operator yang berizin memelihara sumber di `.local`. Anggota tim yang hanya menjalankan aplikasi tidak melakukan langkah ini. Bangun ulang pilot menggunakan input koordinat terbaru dan flag mapping Landing Page sesuai panduan lokal; jangan kehilangan mapping ANRI saat rebuild. Tinjau perubahan sumber dan izin baru dahulu, lalu ekspor:

```sh
python3 scripts/export-collaboration.py --approved --approved-at 2026-10-19 --release kolaborasi-2026-10-19
npm run validate:shared
npm run typecheck
npm run lint
npm test
npm run build
```

Windows: gunakan `py -3 scripts/export-collaboration.py ...` jika executable Python bernama `py`. Tanggal/versi contoh harus diganti sesuai persetujuan dan rilis baru; flag --approved bukan pengganti memperoleh izin. Exporter hanya menulis tiga snapshot dan manifest yang ditentukan. Kontak/field tambahan memerlukan review baru. Validator memeriksa checksum, schema, relasi, ID, tahun, mode, jumlah dan pola privat; scan otomatis tidak menggantikan review manusia atas izin dan isi catatan.

Jangan memasukkan seluruh `.local` atau menggunakan `git add .` untuk pembaruan data. Tinjau daftar file staged; kedua dokumen handoff dilindungi `.gitignore` pada semua clone. Sumber mentah tetap di jalur berizin terpisah, tidak dimasukkan ke repository.

## Pengujian tim

Pada clone bersih, jalankan install/validator/typecheck/lint/unit/build seperti di atas. Untuk browser:

```sh
npx playwright install chromium
npm run test:e2e -- tests/e2e/collaboration.spec.ts
```

`collaboration.spec.ts` memakai tile fixture sehingga tidak membebani provider. Regresi utama mencakup klik Jawa Tengah–Jepara–instansi–hover, tahun, popup stabil, detail/kembali, filter, mode Excel tanpa pin, lebar 390 px dan error runtime. Suite lain mencakup cluster/spiderfy, sentuh, zoom dan mapping ANRI (tujuan eksternal dicegat fixture, bukan pengujian ketersediaan JIKN). Skenario audit historis yang perlu berkas riset privat boleh skipped; paket runtime tidak boleh skipped karena `.local` tidak ada.

Workflow GitHub menjalankan pemeriksaan dan smoke browser pada Ubuntu/Windows. Status berhasil hanya boleh diklaim setelah run selesai. Pemeriksaan di laptop Windows fisik tetap diperlukan untuk trackpad/touch/browser pengguna. Build/preview diuji pada server terpisah tanpa middleware privat; pengiriman GitHub tidak melakukan deployment.

## Hasil pemeriksaan 19 Oktober 2026

- MacBook: validasi paket (249 pilot/249 pin dan 643 Excel/0 pin), typecheck, lint dan build lulus.
- Unit/komponen: 135 tes pada 13 file lulus; importer Python: 11 tes lulus.
- Browser Chrome desktop/mobile: 49 skenario pada delapan suite terkait lulus, termasuk cluster/spiderfy, null/nol, popup/anchor, zoom, ANRI dan navigasi kembali. Tile memakai fixture; akses JIKN asli tidak diuji.
- Salinan bersih hanya berisi file calon commit, tanpa `.local`/`.env.local`: `npm ci`, kedua validator, typecheck, lint, 135 tes dan build lulus; dua smoke browser kolaborasi lulus. Folder asal dan lokasi clone berbeda.
- Preview hasil build salinan bersih memuat pilot enam provinsi dan katalog Excel 643 record, tanpa request `/local-data/` atau error runtime.
- Windows fisik belum diuji. Hasil workflow Windows/Ubuntu dilihat pada run GitHub yang menyertai PR, bukan diasumsikan dari hasil MacBook.
