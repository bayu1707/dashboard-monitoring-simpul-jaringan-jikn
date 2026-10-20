# Pilot Sumatra — 19 Oktober 2026

Perluasan ini memakai komponen dan kontrak repository yang sama dengan Jawa. Default `/simpul-jaringan` sekarang mencakup **418 instansi: 249 Jawa + 169 Sumatra**, **417 pin: 249 Jawa + 168 Sumatra**, serta **16 provinsi/273 kabupaten-kota**. Referensi Sumatra mencakup 10 provinsi dan 154 kabupaten/kota, termasuk Kepulauan Riau dan Kepulauan Bangka Belitung. Geometri kab/kota tetap dimuat per provinsi saat dibutuhkan.

**Katalog bukan berarti seluruh pin selesai.** Satu instansi Sumatra, Dinas Kearsipan dan Perpustakaan Kabupaten Ogan Komering Ilir, belum diberi pin karena tiga listing bernama sama memiliki alamat berbeda. Record tetap dihitung dan dapat dibuka dari **Daftar**. Jumlah lingkaran provinsi/kabupaten adalah jumlah ID instansi, sedangkan angka cluster hanya menghitung pin instansi yang tersedia. Wilayah tanpa record tidak dibuatkan angka/instansi sintetis; tetap dapat dipilih melalui polygon atau dropdown.

## Cakupan

| Provinsi | Instansi | Pin publik | Tanpa pin |
| --- | ---: | ---: | ---: |
| Aceh | 25 | 25 | 0 |
| Bengkulu | 11 | 11 | 0 |
| Jambi | 12 | 12 | 0 |
| Kepulauan Bangka Belitung | 8 | 8 | 0 |
| Kepulauan Riau | 8 | 8 | 0 |
| Lampung | 17 | 17 | 0 |
| Riau | 13 | 13 | 0 |
| Sumatera Barat | 21 | 21 | 0 |
| Sumatera Selatan | 19 | 18 | 1 |
| Sumatera Utara | 35 | 35 | 0 |
| **Sumatra** | **169** | **168** | **1** |

Kategori Sumatra: 120 LKD Kabupaten, 34 LKD Kota, 10 LKD Provinsi, 5 PTN. **154 LKD kabupaten/kota tetap mempunyai ID berbeda.** Pengelompokan peta mengikuti lokasi fisik pin yang diperiksa: kantor Kabupaten Padang Pariaman berada pada wilayah Kota Pariaman (13.77), sehingga 13.05 tidak mempunyai pin kantor tersebut dan 13.77 memuat dua LKD. Nama pemilik Kabupaten Padang Pariaman dan riwayat pemetaan sebelumnya tetap dicatat; titik tidak dipindahkan agar masuk batas kabupaten. Sebanyak 149 record mempunyai kecocokan wilayah pada snapshot Excel; 20 lainnya ditambahkan melalui review alias administratif dan kampus. Semua 169 mempunyai wilayah administratif pada tingkat provinsi; seluruhnya sekarang mempunyai kab/kota untuk navigasi. Status administratif `verified` tidak berarti koordinat kantor telah tersedia atau disahkan lapangan. Cakupan instansi tetap parsial: tidak mengklaim semua K/L/kampus di Sumatra sudah diidentifikasi dari 643 record.

## Sumber dan pemeriksaan

- Identitas, ID, kategori dan tahun berasal dari snapshot turunan **Indonesia.xlsx, sheet pengelolaan casefile** yang sebelumnya diizinkan untuk kolaborasi. Tidak membaca ulang PIC/kontak atau mengubah workbook. `public/data/datasets/excel/snapshot.json` tetap 643 record dan tidak diberi pin/statistik simulasi.
- Referensi administratif: paket nasional proyek, kode/nama acuan Kepmendagri 300.2.2-2430 Tahun 2025 sebagaimana dicatat penerbit. Geometri: [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), lisensi MIT dalam `public/data/geometry/LICENSE-cahyadsn.txt`, koordinat GeoJSON WGS84 `[longitude, latitude]`. Metadata/tanggal sumber ada di `public/data/geometry/metadata.json`. Domain aplikasi menyimpan titik `[latitude, longitude]`.
- [Direktori resmi Dispusip Sumut](https://dronesumut.sumutprov.go.id/direktori): fitur marker dinas/unit layanan, alamat dan wilayah diperiksa. Field `const lat/lng` yang dipakai marker dibedakan dari fallback Medan dan tahun berdiri perpustakaan. Tahun bergabung tetap Excel. Kontak dan jumlah koleksi direktori tidak diimpor.
- Fitur Google Maps yang tertanam pada situs resmi [Aceh](https://arpus.acehprov.go.id/), [Riau](https://dipersip.riau.go.id/gedung-dan-ruangan), [Sumatera Selatan](https://arsip.sumselprov.go.id/), [Bengkulu](https://perpusda.bengkuluprov.go.id/kontak-kami/), [Bangka Belitung](https://dkpus.babelprov.go.id/) dan [Kepri](https://dpk.kepriprov.go.id/kontak). Pasangan fitur bernama pada `initEmbed` diperiksa; koordinat pusat kamera di URL `pb` tidak dipakai sebagai titik kantor. Pin Riau adalah **unit layanan Perpustakaan Soeman HS**, tidak diklaim sebagai ruang penyimpanan arsip.
- [Situs resmi Dispusip Tebo](https://dispusip.tebokab.go.id/): koordinat marker kantor dan petunjuk arah dipublikasikan pada halaman kontak.
- Kampus dicocokkan menggunakan situs resmi masing-masing. Sriwijaya kini menggunakan fitur gedung arsip kampus Indralaya dan Andalas memakai fitur unit kearsipan. USK dan Unila menggunakan fitur kampus publik, dengan label **pin kampus**; bukan klaim koordinat ruang arsip. Nama asli, termasuk salah eja dan baris baru Excel, tidak diganti. Alias hanya mengubah pemetaan wilayah pada ID yang sama.

Semua pin baru lolos pasangan/rentang angka, hubungan provinsi-kab/kota dan bounds. Sebanyak 139 pin tambahan berada dalam polygon; pin Karimun sekitar 5 m di luar garis pantai referensi dicatat sebagai tinjauan batas per record, tanpa mengubah koordinat. Tidak melakukan geocoding otomatis, mengisi koordinat dari pusat wilayah, atau menambahkan instansi baru yang tidak ada pada Excel. Sebagian pin menunjuk unit layanan publik dinas; perlu konfirmasi instansi sebelum dipakai operasional. Fakta numerik/identitas diekstrak dengan rujukan sumber; halaman HTML dan gambar sumber tidak dipaketkan atau dilisensikan ulang.

## Pengecualian yang perlu dilanjutkan

- **1 tanpa pin** (Ogan Komering Ilir) dapat ditinjau melalui keluaran lokal `report.json` → `missingPins` setelah menjalankan builder di bawah. Setiap baris mempunyai ID tetap, nama, wilayah dan alasan; jangan menggabungkan berdasarkan kemiripan nama.
- Direktori Sumut mencantumkan `0,0` untuk beberapa unit, termasuk Toba, Samosir, Labuhanbatu, Pakpak Bharat dan Humbang Hasundutan. Titik tersebut ditolak, tidak diganti titik default Medan.
- Situs Sumbar/Jambi mengalami masalah sertifikat pada saat review; sebagian situs lain membatasi akses atau menampilkan tantangan browser. Tidak melewati pembatasan. Alamat/fitur yang belum dapat dipastikan tetap tanpa marker.
- **Tidak ada Landing Page baru Sumatra yang diverifikasi.** Tombol terlihat disabled dengan keterangan tautan belum tersedia. Satu mapping ANRI di Jawa dipertahankan. Pengumpulan massal Landing Page belum dilakukan.

## Penambahan pin publik — 19 Oktober 2026

Atas permintaan pengguna, **140 pin tambahan** dicocokkan melalui antarmuka publik Google Maps. `publicPlaceOnly: true` pada berkas kurasi berarti nama fitur dan alamat/Plus Code ditinjau, tetapi alamat operasional terkini belum dikonfirmasi instansi. Ini berbeda dengan bukti koordinat pada situs resmi. Flag ini tidak menghapus pemeriksaan ID, tahun, pasangan `!3d/!4d`, relasi wilayah, bounds atau polygon. Koordinat kamera `/@` tidak dipakai. Tidak ada geocoding otomatis atau koordinat pusat kota.

Sumber tunggal Maps diterima hanya dengan penanda tersebut; URL fitur, label unit, waktu pemeriksaan dan keterbatasan disimpan per record. Jika ada beberapa listing atau listing bertanda tutup, catatan tidak mengklaim lokasi aktif. Pin kampus/perpustakaan adalah rujukan unit layanan yang tertulis, bukan kepastian ruang arsip. Pin Karimun mempunyai pengecualian garis pantai **5,0 m**, sumbernya pin yang sama, batas maksimum tinjauan publik 10 m; titik tidak digeser. Tinjauan bersumber alamat resmi yang telah ada tetap maksimal 100 m.

**Pengecualian tersisa:** `casefile-adadd4ae25edba10ef95bf6b` — Dinas Kearsipan dan Perpustakaan Kabupaten Ogan Komering Ilir. Tiga fitur Maps menunjuk Tj. Rancing, Jalan Kapten Soelaiman dan Jl. Letnan Hamid Sulaiman, sedangkan referensi publik lain menyebut Celikah/Jl. Letnan Muchtar Saleh. Ketiganya dicatat dalam `sourceUrls`; koordinat tetap null, status `needs-review`. Konfirmasi kantor/unit yang dimaksud diperlukan sebelum memilih pin. Daftar dan detail tetap berfungsi.

Nama/kode/ID/tahun seluruh 418 record tidak berubah; 249 identitas beserta pin Jawa identik dengan baseline. Seluruh 28 pin Sumatra sebelumnya juga dipertahankan. Snapshot Excel 643 record tidak diubah. Tidak ada Landing Page baru ataupun statistik resmi yang ditambahkan.

## Membangun ulang tanpa workbook atau folder pribadi MacBook

```sh
npm ci
npm run build:sumatra
```

Builder membaca tiga sumber yang ikut paket: snapshot Excel yang sudah disanitasi, record Jawa pada snapshot pilot, dan `data/curation/sumatra-locations.json`. Semua output ditulis ke `.local/sumatra/staged/` untuk review, tidak langsung mengganti dataset runtime. Isi `snapshot.json`, `references.json`, dan `report.json` dapat diperiksa. Tidak memerlukan workbook mentah. Builder dapat dijalankan ulang pada paket gabungan; record Sumatra lama dibangun ulang berdasarkan ID, bukan ditambahkan dua kali.

Sesudah hasil perubahan data diaudit dan diizinkan dibagikan, ekspor eksplisit:

```sh
npm run export:shared -- --approved --approved-at YYYY-MM-DD --release nama-rilis --pilot-source .local/sumatra/staged --excel-source public/data/datasets/excel/snapshot.json
npm run validate:shared
```

Jangan menjalankan exporter dengan sumber pilot lama secara tidak sengaja. Flag `--pilot-source` menunjukkan folder hasil review yang dimaksud. Exporter tidak melakukan operasi Git. Mengubah urutan Excel/review tidak mengganti ID. Konflik dua pemetaan/pin pada ID sama menghasilkan error, bukan penggabungan otomatis.

Untuk menambah pin, edit review berdasarkan ID sumber, isi metode, URL resmi, bukti fitur, alamat kantor/unit, timestamp zona waktu serta catatan. Titik null boleh tetap ada. Jalankan ulang builder agar pemeriksaan geometri dilakukan sebelum ekspor. Jangan memasukkan cookie, token, kontak personal atau halaman HTML hasil pengambilan ke berkas review.

## Perilaku dan integrasi berikutnya

Alur tetap **provinsi → kabupaten/kota → instansi**. Jenis instansi opsional. Hover hanya pada marker instansi; desktop klik membuka detail dan sentuh tap membuka sheet. Popup memakai lifecycle/anchor lama yang sudah diperbaiki. Daftar menyediakan akses untuk titik null dan keyboard. Tidak ada API SIKN, backend, tab detail baru, atau perubahan halaman detail di tahap ini.

Statistik, grafik dan kontribusi percontohan tetap **DATA SIMULASI**, bukan statistik Excel atau API. Nilai Java tidak diubah. Snapshot ID metric disamakan dengan rilis gabungan dan denominator percontohan dihitung ulang dari record pilot pada snapshot sama; denominator nasional tetap null. Data bukan real time. Tahun bergabung Excel tetap dapat digabung dengan ID resmi pada adapter API mendatang.

## Pengujian

Jalankan `npm run validate:shared`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:import`, `npm run build`. Browser: `npm run test:e2e -- tests/e2e/sumatra.spec.ts tests/e2e/java.spec.ts tests/e2e/collaboration.spec.ts`. Pengaturan channel/port dapat memakai `PLAYWRIGHT_CHANNEL=chrome` dan `PLAYWRIGHT_PORT=5181`; pada PowerShell set lewat `$env:PLAYWRIGHT_CHANNEL`/`$env:PLAYWRIGHT_PORT` atau gunakan Chromium Playwright yang terpasang.

Regresi mencakup 10 pilihan provinsi Sumatra, klik wilayah ke kab/kota dan instansi, popup tanpa memilih jenis, tahun Excel, detail/kembali, record tanpa pin lewat keyboard, reset, mobile sentuh 390 px dan tile gagal. Unit test memeriksa 169 ID, alias, hubungan wilayah, penolakan 0,0, stabilitas urutan/merge dan 249 record Jawa tetap utuh. Bukti screenshot/hasil percobaan berada lokal di `.local/qa/`; bukan data sumber.

### Hasil verifikasi awal perluasan (sebelum penambahan 140 pin)

- macOS, Node 24.19.0: validasi dataset bersama dan data empty/demo lulus.
- Typecheck, lint dan build produksi lulus.
- Vitest: hasil penambahan pin diperbarui pada laporan penyelesaian di bawah.
- Python importer: 11 tes lulus.
- Playwright Chrome: **38 tes lulus, 0 skipped** pada suite Sumatra, kolaborasi, Jawa, pilot, popup dan gesture zoom. Satu asumsi lama bahwa overview selalu berpusat di Jawa diperbarui menjadi bounds cakupan aktual; pengujian Jawa yang semula hanya menerima enam provinsi kini tetap berjalan pada paket gabungan.
- Verifikasi tambahan localhost:5175 dengan tile asli: hover Aceh, tombol detail dan kembali lulus, tanpa pageerror. Screenshot lokal `.local/qa/sumatra-live-1440.png`; pengujian tile gagal/sentuh 390 px memakai konteks terpisah.
- Rebuild ulang menghasilkan snapshot yang sama setelah sanitasi. Semua field 249 instansi Jawa identik dengan baseline; nilai statistiknya tetap sama, konteks snapshot metric/denominator percontohan diperbarui untuk gabungan. Checksum snapshot Excel penuh tidak berubah.
- Workflow CI diperluas untuk menjalankan smoke Sumatra pada Ubuntu/Windows. CI perubahan ini **belum dijalankan di GitHub** karena belum commit/push. Laptop Windows fisik dan browser zoom halaman 200% masih perlu pemeriksaan manual; gesture zoom peta sudah diuji otomatis.

Tidak ada deployment, commit, push atau integrasi API. Workbook, sumber privat lama, dokumen handoff dan pekerjaan pengguna yang tidak terkait dipertahankan.

### Hasil verifikasi penambahan 140 pin

- **168/169 pin Sumatra**, gabungan **417/418 pin**; satu pengecualian OKI di atas. Pemeriksaan 140 kandidat terhadap pasangan URL/koordinat, identitas Excel dan geometri lulus; 139 dalam polygon, satu tinjauan garis pantai Karimun 5,0 m.
- `npm run validate:shared`, `npm run validate:data`, `npm run typecheck`, `npm run lint`, `npm run build`, serta `git diff --check`: lulus.
- `npm test`: **141 tes lulus**. `npm run test:import`: **11 tes lulus**.
- Playwright Chrome: **39 tes lulus** (25 suite kolaborasi/Jawa/pilot/Sumatra, 14 popup/gesture). Pengujian meliputi tiga pin Banda Aceh, identitas/tahun popup, panah, perpindahan pointer ke tombol, navigasi detail/kembali, filter, cluster/spiderfy, tile gagal dan sentuh 390 px.
- Verifikasi localhost:5175 dengan tile asli: tiga pin Banda Aceh tampil, hover stabil, detail/kembali berhasil, selisih horizontal panah terhadap marker **0 px**, **0 pageerror**; 24 tile termuat. Screenshot lokal `.local/qa/sumatra-live-pins-1440.png`; hasil terstruktur `.local/qa/sumatra-live-pins-result.json`.
- Audit pembandingan: **249 record Jawa identik**, seluruh **277 pin lama** tetap, semua nama/kode/ID/tahun 418 record sesuai snapshot Excel. Checksum Excel penuh tidak berubah. Rebuild dapat diulang dengan sumber kurasi yang ikut proyek, tanpa workbook atau folder pribadi.
- CI GitHub, laptop Windows fisik, konfirmasi alamat operasional instansi dan browser zoom halaman 200% belum diuji pada penambahan ini. Tidak melakukan Git add/commit/push/merge atau deployment.
