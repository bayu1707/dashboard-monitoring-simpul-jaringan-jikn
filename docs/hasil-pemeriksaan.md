# Hasil pemeriksaan frontend JIKN

Pemeriksaan dilakukan pada 12 Oktober 2026, zona waktu Asia/Jakarta, dengan Node 24.19.0, npm 12.2.0, Google Chrome yang terpasang, dan Playwright 1.64.0. Proyek hanya berjalan lokal dan tidak dipublikasikan.

| Pemeriksaan | Hasil akhir |
| --- | --- |
| `npm run typecheck` | Lulus, TypeScript strict |
| `npm run lint` | Lulus tanpa error/warning |
| `npm test` | 56 pengujian lulus dalam 4 berkas |
| `npm run build` | Lulus; route peta dan detail dipisah dalam chunk, tanpa peringatan ukuran chunk |
| `npm run validate:data` | Lulus: dataset utama kosong dan 7 instansi demo sintetis |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 7 skenario browser lulus |
| Chrome 200% melalui kontrol zoom browser | Peta dan detail diperiksa langsung; lebar CSS 720 px dan devicePixelRatio 4, tanpa overflow horizontal. Zoom dikembalikan ke 100% setelah pemeriksaan. |

Pengujian unit/komponen mencakup validasi sumber/ID/relasi/kategori/tanggal/koordinat, duplikasi dengan ID serta sumber, query bertingkat, filter AND, jumlah ID unik, titik null, nol sah, tahun bergabung, rentang input kalender, rumus kontribusi dan snapshot berbeda, repository/retry, navigasi detail, pemulihan session, popup dan fokus, serta draft filter mobile. Pengujian komponen memakai fixture sintetis dan mock renderer peta; pengujian browser memakai Leaflet dan markercluster sebenarnya.

## Skenario browser yang lulus

1. Klik geometri Banten → Kota Serang → instansi, dropdown sinkron, jenis tetap Semua Jenis, cluster/spiderfy, hover → Lihat detail, lalu Kembali ke Peta dengan center/zoom yang sama. Tidak ditemukan page error atau error console aplikasi pada pengujian akhir; kegagalan resource jaringan yang sengaja diuji dikecualikan.
2. Popup tertutup saat cakupan berubah, kembali satu tingkat, daftar menampilkan instansi tanpa koordinat, Escape, profil parsial, dan browser Back memulihkan daftar.
3. Dataset utama kosong, ID tidak ditemukan, query tidak sah, JSON rusak, dan retry membaca sumber yang sama setelah diperbaiki.
4. Request tile sengaja digagalkan; pesan peta dasar gagal tampil dan daftar/hasil tetap tersedia.
5. Viewport 390 × 844 dengan emulasi sentuh: draft Batal, Terapkan provinsi saja, tap kab/kota, tap marker, bottom sheet, detail/kembali, perubahan provinsi mengosongkan pilihan turunan, serta Reset segera. Peta dan detail tanpa overflow horizontal.
6. Viewport 1440 × 900 untuk detail, metric nol sah, serta reflow pada lebar CSS 720 tanpa overflow horizontal.
7. Klik marker desktop langsung membuka detail; filter jenis mempersempit hasil dengan AND; mengganti kab/kota mengembalikan jenis ke Semua Jenis; hasil wilayah kosong dan fallback tanpa bounds menampilkan keterangan sambil mempertahankan viewport.

Popup saat auto-pan dan key unik antar kartu detail diperbaiki setelah pemeriksaan browser. Pengujian akhir juga mengawasi error console React agar peringatan key yang sama tidak berulang.

Screenshot peta/popup dan detail pada desktop serta mobile diperiksa secara visual di `tmp/qa/`. Struktur mengikuti referensi: header dua tingkat, peta dominan, popup ringkas, detail dua kolom 40/60 tanpa tab internal, lalu satu kolom pada layar kecil. Grafik memakai data demo berlabel, tahun null tetap kosong, serta ringkasan/tabel nilai tersedia. Logo ANRI resmi digunakan utuh sehingga bentuknya tidak persis ikon pada screenshot.

## Batas pemeriksaan dan data

Sentuh diuji dengan emulasi Chrome; telepon fisik dan pembaca layar belum diuji. Langkah lanjutan tersedia pada [checklist manual](checklist-manual.md), terutama pemeriksaan perangkat fisik, fokus menyeluruh, popup di seluruh tepi peta, dan variasi jaringan. Tile provider bergantung pada jaringan dan tidak dijanjikan selalu tersedia.

Tidak ada snapshot instansi JIKN terverifikasi dalam proyek. Data utama tetap kosong. Nama/kode 38 provinsi bersumber dari respons BIG; geometri yang berhasil dimuat baru Banten serta 8 kabupaten/kotanya. Query geometri nasional mengalami timeout dan tidak digantikan titik perkiraan. Batas kecocokan visual, provenance, sumber logo, serta metadata sumber tercatat pada [catatan sumber](reference-sources.md). Data demo tidak mewakili jumlah atau keadaan simpul ANRI.

Sebelum tahap data produksi diperlukan snapshot resmi, taksonomi jenis/kategori, koordinat dari sumber, definisi statistik dan total nasional yang kompatibel, serta referensi geometri tambahan. Backend/API resmi merupakan tahap pengembangan berikutnya.

## Pemeriksaan perapian UI 13 Oktober 2026

Pembaruan ini merapikan header, toolbar peta, navigasi ringkas, metadata snapshot, dan kontrol zoom tanpa mengubah dataset. Aset simbol ANRI resmi menggantikan logo horizontal di header. Build, typecheck, lint, serta 56 tes unit/komponen lulus. Tujuh skenario browser fungsional sebelumnya lulus kembali; dua tes regresi tata letak tambahan lulus pada desktop 1440 dan mobile 390 px. Pengujian tambahan memeriksa hit target 44 px, dropdown sebaris, toolbar ringkas, label aksesibel, fokus keyboard, navigasi daftar, Terapkan filter mobile, dan tidak adanya overflow horizontal. Screenshot hasil terbaru diperiksa pada `tmp/qa/ui-clean-desktop.png` dan `tmp/qa/ui-clean-mobile.png`.

Server lokal yang sebelumnya diminta pengguna tetap aktif; tidak dilakukan deployment. Cakupan data dan geometri tetap sama, sehingga perubahan UI tidak berarti data nasional telah dimuat.

## Persiapan repository tim 13 Oktober 2026

Instalasi `npm ci` dijalankan pada proyek dan salinan bersih yang hanya memuat berkas calon commit, tanpa `.env.local`, dokumen rancangan, dependency terpasang, atau artefak dari folder asal. Pada macOS dengan Node 24.19.0 dan npm 12.2.0, build, typecheck, lint, validasi data, 56 tes unit/komponen, serta 9 tes browser lulus. Audit npm pada instalasi tidak melaporkan kerentanan yang diketahui pada saat pemeriksaan.

Tes browser salinan bersih memakai server sendiri di port 5174 (`PLAYWRIGHT_PORT=5174`) dan Chrome terpasang; server pengembangan pengguna pada port 5173 tetap aktif. Satu kegagalan pada percobaan awal tidak terulang ketika skenario dijalankan sendiri. Penantian tetap 100 ms setelah klik cluster kemudian diganti dengan pemeriksaan selesainya animasi zoom/pan Leaflet; seluruh suite lulus setelah perubahan tersebut. Assertion bahwa popup bertahan setelah kursor masuk dan lebih dari 200 ms tetap dipertahankan. Source UI dan perilaku fitur dashboard tidak diubah pada tugas repository ini.

Pemeriksaan staging tidak menemukan pola kredensial maupun berkas rahasia/artefak yang dilarang. Dependency lockfile memakai registry npm resmi, seluruh import lokal dan casing berkas diperiksa, dan dokumentasi pemasangan menyediakan perintah Windows PowerShell serta macOS/Git Bash. Windows belum diuji langsung; dukungan konfigurasi lintas sistem tidak dianggap sebagai hasil uji Windows.
