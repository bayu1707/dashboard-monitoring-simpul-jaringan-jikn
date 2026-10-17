# Hasil review tahap casefile — 14 Oktober 2026

Laporan ini membahas snapshot Excel penuh. Tampilan default laptop kini memakai [percontohan Jakarta dan Banten](pilot-jakarta-banten.md). Tambahkan `?data=excel` pada URL peta untuk membuka kembali data yang dibahas dalam laporan ini; sumber aslinya tidak diubah.

Perubahan berada pada branch `fitur/peta-data-casefile-jikn` di clone GitHub. Tidak dilakukan commit, push, merge, atau deployment. Workbook dan hasil impor tetap lokal untuk review pengguna.

## Hasil impor

Sumber: workbook pengguna `Indonesia.xlsx`, sheet persis `pengelolaan casefile`, baris 4–646. Seluruh **643 instansi diterima**, **0 ditolak**, nama dan tahun bergabung terisi, rentang tahun **2015–2026**. Baseline jumlah/kategori/tahun cocok dengan hitungan aktual.

| Jenis | Jumlah |
| --- | ---: |
| K/L | 103 |
| LKD Provinsi | 35 |
| LKD Kabupaten | 365 |
| LKD Kota | 92 |
| PTN | 35 |
| PTKN | 3 |
| PTS | 5 |
| PTK | 2 |
| BUMN | 3 |

Hasil pencocokan wilayah: **467 verified**, **25 needs-review**, **151 unresolved**. Verified menunjukkan nama wilayah administratif cocok persis dan tunggal dengan registry, bukan verifikasi lokasi fisik kantor. Record yang belum cocok tetap bisa dibuka melalui katalog **Belum Terpetakan**. Daftar pengecualian lengkap disimpan pada `.local/casefile/exceptions.json`.

Koordinat kantor valid: **0**. Tanpa koordinat: **643**. URL Landing Page terverifikasi: **0**. URL belum tersedia: **643**. Statistik arsip, pencipta, kopi digital, tren, distribusi, status simpul, dan denominator nasional belum tersedia dari kolom yang diizinkan; semua tetap null/empty state.

## Pengecualian sumber

- Dua kode digunakan oleh masing-masing dua instansi: `31025-1` dan `25316-5`. Semua record dipertahankan dengan ID lokal terpisah. Nama, baris, ID, serta sumbernya tercantum pada laporan lokal.
- Empat sel kode numerik menggunakan format tanggal nonumum: C5, C19, C268, dan C642. Nilai XML asli dipertahankan sebagai kode referensi, dengan peringatan untuk ditinjau. Kode tidak dikonversi menjadi tanggal atau diperbaiki berdasarkan tebakan.
- Ringkasan I3 menyebut 34 LKD Provinsi, tetapi record aktual berjumlah 35. J3 menyebut 363 LKD Kabupaten, tetapi record aktual berjumlah 365. Baris ringkasan tidak menjadi sumber hitungan.
- Impor ulang setelah registry nasional selesai menghasilkan 0 ID ditambah/dihapus/berubah. Fixture pengujian membuktikan pengubahan urutan baris tidak menukar ID.

## Referensi wilayah dan interaksi

Registry dan geometri utama menyediakan **38 provinsi dan 514 kabupaten/kota**, termasuk enam provinsi wilayah Papua. Sumber komunitas `cahyadsn/wilayah` dan `cahyadsn/wilayah_boundaries` berlisensi MIT secara eksplisit pada berkas datanya dan memakai versi commit yang dipin. Registry mengikuti Kepmendagri 300.2.2-2430 Tahun 2025 menurut penerbit. Metadata sumber, SHA-256, timestamp, sistem koordinat, serta lisensi tersimpan di `public/data/geometry/`.

Polygon kabupaten/kota dimuat hanya untuk provinsi terpilih; instance peta tetap digunakan. Klik wilayah mengganti lapisan dan cakupan, dropdown ikut berubah. Daftar menyediakan akses untuk instansi tingkat provinsi, instansi tanpa wilayah, dan instansi tanpa koordinat. Pratinjau dari daftar tersedia pada semua cakupan; hover marker instansi tetap dibatasi pada lapisan instansi.

Geometri tampilan bukan penetapan batas hukum. Datum sumber tidak dinyatakan eksplisit. Sepuluh ring Sorong yang mempunyai hanya dua titik unik diabaikan dan dilaporkan, sementara area valid tetap tampil; tidak ditambahkan titik buatan. Seluruh 514 wilayah tetap mempunyai geometri valid untuk navigasi. Baca `reference-sources.md` untuk batas verifikasi.

Popup mempertahankan lifecycle Leaflet berbasis marker aktual, timer ID aktif, cleanup, dan anchor spiderfy dari audit sebelumnya. Tombol Landing Page ditambahkan sejajar dengan Lihat detail, bergaya outline, disabled bila belum tersedia. Mapping memerlukan ID stabil, nama yang sama, URL HTTPS JIKN dengan path resmi, sumber, waktu verifikasi, serta status verified. URL yang sama untuk instansi berbeda ditolak.

Pemeriksaan halaman publik JIKN mengalami 502/timeout. Sampel hyperlink belum dapat diverifikasi, dan akses tanpa login belum dapat dipastikan. Tidak dilakukan login otomatis atau pengumpulan massal. Template/importer mapping sudah tersedia untuk ekspor resmi atau maksimal lima sampel yang diperiksa pengguna; metode dan hasil sampel harus disetujui sebelum pengumpulan massal.

## Berkas implementasi

| Kelompok | Berkas |
| --- | --- |
| Impor | `scripts/import-casefile.py`, `scripts/import-landing-pages.ts`, `scripts/build-national-references.ts` |
| Model dan layanan | `src/types/domain.ts`, `localRepository.ts`, `validation.ts`, `session.ts`, `landingPage.ts` di `src/services/` |
| UI | `MapPage.tsx`, `InstansiDetailPage.tsx`, `ResultsList.tsx`, `RegionCounts.tsx`, `InstansiPopup.tsx`, `MarkerPopup.tsx`, `ProfileCard.tsx`, `useRegionGeometry.ts` |
| Gaya | `src/styles/map.css`, `src/styles/landing-page.css` |
| Wilayah | `public/data/references.json`, 38 GeoJSON kabupaten/kota, metadata dan lisensi di `public/data/geometry/` |
| Konfigurasi | `vite.config.ts`, `package.json`, `.env.example`, `.gitignore`; `.env.local` hanya pada laptop |
| Tes | `casefile-repository.test.ts`, `national-references.test.ts`, `landing-page.test.tsx`, `test_import_casefile.py`, tambahan `map-page.test.tsx`, `e2e/casefile.spec.ts`, penyesuaian skenario kosong `e2e/dashboard.spec.ts` |
| Dokumentasi | README, `casefile-import.md`, `import-snapshot.md`, `landing-pages.md`, template mapping, `reference-sources.md`, laporan ini |
| Lokal untuk review | `.local/casefile/{snapshot,raw-selected,validation-report,exceptions,identity-registry}.json`, screenshot `.local/qa/` |

Dataset demo, statistik contoh, source popup anchor/lifecycle, lockfile, dan pekerjaan tim yang tidak terkait dipertahankan. Tidak ada dependency frontend baru. Build tidak memuat workbook atau snapshot review lokal; snapshot publik pada build tetap kosong.

## Pengujian

- Typecheck, lint, build, validasi snapshot utama/demo serta snapshot Excel lulus.
- 107 tes unit/komponen/referensi lulus setelah koreksi navigasi dan popup marker. Sebelas tes importer Python lulus pada fase impor sebelumnya; importer tidak berubah pada koreksi ini.
- Seluruh 19 skenario browser lulus pada putaran akhir di localhost:5175: 13 regresi frontend/demo dan 6 review snapshot Excel, termasuk pemilihan satu ID wilayah per klik, hover tepat pada marker, dan keyboard. Putaran ini memakai Google Chrome dengan rendering software dan laptop dijaga aktif selama pengujian; konfigurasi sementara ini tidak mengubah konfigurasi proyek. Tidak ditemukan error runtime material. Tes nasional → Banten → Kota Serang memastikan zoom memfokuskan bounds kota. Tes Jakarta → Jakarta Selatan membuktikan perpindahan lapisan dan keterangan hasil kosong sesuai data; tes ini tidak mengklaim bahwa marker kantor Jakarta Selatan tersedia.
- Alur klik Banten → Kota Serang → pratinjau tanpa memilih jenis → detail → kembali, kategori dengan hasil kosong, katalog 643 record, Belum Terpetakan, pencarian nama, tile gagal, dropdown, serta wilayah Jawa/luar Jawa/Papua diperiksa nyata.
- Regresi marker memeriksa hover stabil, perpindahan ke tombol, timer lama, fokus/Escape, cluster/spiderfy, pan/zoom, empat tepi viewport, serta alternatif tap sentuh.
- Desktop 1440 dan mobile 390 diperiksa. Reflow pada lebar CSS 720 diuji sebagai simulasi zoom 200%. URL panjang pada catatan lokasi menyebabkan overflow pada pemeriksaan awal dan telah diperbaiki dengan pembungkusan teks.
- Screenshot snapshot lokal berada di `.local/qa/casefile-national.png`, `casefile-desktop-popup.png`, `casefile-mobile-popup.png`, dan `casefile-unmapped.png`. Screenshot demo/regresi tetap di `tmp/qa/` atau `docs/qa/popup/` dari audit sebelumnya.

Zoom browser aktual 200% pada perubahan casefile, perangkat sentuh fisik, Windows, dan akses halaman Landing Page yang valid belum diuji. Statistik/marker kantor dan tombol eksternal aktif pada data nyata memerlukan sumber yang belum tersedia; pengujian perilaku aktif URL menggunakan fixture terpisah, bukan data instansi resmi.

## Review lokal dan langkah berikutnya

Pembaruan akses peta: penanda jumlah muncul sejak peta nasional dibuka, memakai posisi navigasi wilayah dari sumber SQL dengan provenance. Setiap penanda memilih satu ID langsung: provinsi → kabupaten/kota → instansi. Label berdekatan dipisahkan dalam piksel dengan garis ke titik sumber, tanpa pemilih tambahan. Penanda administratif hilang pada lapisan instansi. Marker kantor berkoordinat membuka popup ringkas 320 px ketika di-hover; klik membuka detail dan tap membuka sheet. Hover daftar tidak membuka profil otomatis; Daftar serta tombol Pratinjau profil tetap menjadi alternatif eksplisit. Cakupan tanpa koordinat menampilkan keterangan dan tidak otomatis membuka daftar. Popup marker tetap memakai anchor/lifecycle native Leaflet yang telah diperbaiki. Seluruh 643 koordinat kantor tetap null. Snapshot juga belum mempunyai record yang terverifikasi di Jakarta Selatan (31.74); referensi wilayahnya tersedia. Tampilan seluruh marker instansi nyata masih memerlukan mapping wilayah dan koordinat dari sumber sah. Tidak ada koordinat label wilayah yang disalin sebagai koordinat kantor.

Screenshot marker hover ringkas: `.local/qa/compact-marker-hover-popup.png` (DATA DEMO). Pemeriksaan langsung halaman JIKN asli pada koreksi ini tidak berhasil: web fetch timeout, lalu kontrol browser menolak akses karena izin pengguna tidak disetujui. Tidak dilakukan akses alternatif untuk melewati penolakan tersebut.

Server review memakai `http://127.0.0.1:5175/simpul-jaringan`, dengan `.env.local` berisi `VITE_LOCAL_CASEFILE=1`. Untuk mulai ulang: `npm run dev -- --port 5175`. Mode demo tetap pada `?demo=1`. Build/preview memakai dataset publik kosong sampai ada keputusan berbagi hasil impor.

Tinjau 25 variasi nama wilayah, 151 lokasi yang belum dapat ditentukan, dua kode duplikat, dan empat peringatan format kode. Lengkapi koordinat kantor serta mapping Landing Page dari sumber sah. Setelah API resmi tersedia, verifikasi mapping ID lokal ke ID SIKN sebelum join; tahun bergabung tetap pelengkap Excel. Tidak ada pekerjaan API/backend pada tahap ini.
