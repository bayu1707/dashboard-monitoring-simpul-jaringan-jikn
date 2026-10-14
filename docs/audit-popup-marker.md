# Audit dan perbaikan popup marker JIKN

Tanggal pengujian: 14 Oktober 2026. Proyek: clone `dashboard-monitoring-simpul-jaringan-jikn`, commit dasar `ebea893`. Perubahan belum di-commit, merge, atau push.

## Ruang lingkup dan kondisi awal

Tidak ditemukan `AGENTS.md` yang berlaku. Git clone bersih sebelum pekerjaan. Commit tim terbaru hanya mengubah README; isinya dipertahankan. Tidak ditemukan implementasi Landing Page terpisah pada checkout ini. Halaman detail, snapshot, dependensi, lockfile, dan integrasi data tidak diubah.

Dua server lokal telah berjalan: salinan awal pada port 5173 dan clone GitHub pilihan pengguna pada port 5175. Kode popup awal keduanya identik; versi awal pada 5173 digunakan sebagai pembanding read-only. URL utama pengujian:

`http://127.0.0.1:5175/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1`

## Penyebab dan reproduksi

### Popup berkedip atau hilang saat menuju isi popup

Kode awal menempatkan event pointerenter/pointerleave pada section React `.instansi-popup`. Wrapper dan segitiga Leaflet berada di luar section tersebut. Setelah pointer meninggalkan marker, timer 200 ms tetap berjalan ketika pointer berada di segitiga. Popup kemudian hilang meskipun pengguna masih berada pada bagian popup.

Reproduksi Chrome desktop 1440 × 900:

1. Buka Kota Serang dengan Jenis Instansi tetap Semua Jenis.
2. Klik cluster hingga A/B yang berkoordinat sama terurai.
3. Hover A, lalu pindahkan pointer ke tengah segitiga popup.
4. Berhenti 350 ms di segitiga.
5. Versi awal: section popup hilang. Versi perbaikan: tetap terbuka, lanjut ke Lihat detail dan navigasi berhasil.

Timer awal juga tidak terikat ID pemilik, dan penangguhan tutup saat autoPan memakai tenggat waktu tetap 500 ms. Ini diperbaiki agar event lama tidak dapat menutup instansi baru dan perpindahan peta sendiri tidak dianggap sebagai pengguna meninggalkan popup.

Pengujian tambahan selama perbaikan menemukan container popup lama masih berada di DOM selama animasi fade bawaan Leaflet 200 ms. Pergantian cepat A/B sempat menghasilkan beberapa elemen panah sekaligus. Cleanup sekarang segera melepas container milik popup lama setelah melepas layer Leaflet.

### Panah tidak menuju marker yang dipilih

Popup awal adalah Leaflet Popup standalone melalui komponen React Leaflet, dengan isi React melalui portal internal. Posisi popup berasal dari `detail.instansi.coordinates`. Pada spiderfy, markercluster mengubah posisi marker visual dengan `setLatLng`, sementara koordinat JSON tetap sama.

Pengukuran sebelum perbaikan: pusat horizontal marker A 732 px, B 802 px, panah 767 px. Popup A menunjuk ke tengah A/B, bergeser 35 px dari A. Marker memiliki `iconAnchor: [22,44]` tetapi popup belum memakai sumber marker dan `popupAnchor` eksplisit.

Sesudah perbaikan, pengujian membandingkan pusat panah dan ujung bawah segitiga terhadap tengah sisi atas target ikon aktif, dengan toleransi maksimum 2 CSS px. Lulus untuk A dan B setelah spiderfy, zoom, pan, serta empat tepi viewport.

## Perubahan teknis

| File | Perubahan |
| --- | --- |
| `src/components/map/ClusterLayer.tsx` | Registry instance marker, popupAnchor `[0,-44]` untuk ikon 44 × 44, event leave membawa ID, cleanup registry. |
| `src/components/map/MarkerPopup.tsx` | Adapter popup Leaflet dengan source marker aktual dan portal React; mengikuti getLatLng/move/remove; seluruh container menjadi area hover/fokus; cleanup listener, ResizeObserver, dan DOM; autoPan berdasarkan kejadian gerak, bukan tenggat tetap. |
| `src/components/map/InstansiPopup.tsx` | Tombol Tutup memanggil aksi tanpa meneruskan event klik sebagai ID selection. |
| `src/components/map/MapView.tsx` | Menghubungkan registry dan adapter; menghapus popup standalone yang memakai koordinat JSON; pratinjau dari daftar memakai panel agar tidak membuat panah ke marker yang tersembunyi dalam cluster. |
| `src/pages/MapPage.tsx` | Timer 200 ms terikat selection/ID; event leave lama diabaikan; fokus keyboard menjaga popup; state pemilik dan asal pratinjau. |
| `src/styles/map.css` | Segitiga CSS 10 px mengisi padding bawah 10 px; titik akhirnya mengikuti popupAnchor, tanpa transform atau offset layar tambahan. |
| `tests/map-page.test.tsx` | Tiga regresi tambahan: leave ID lama, pembatalan timer A saat B dipilih, serta respons detail lama. |
| `tests/e2e/popup-regression.spec.ts` | Empat skenario browser untuk hover/panah, A/B cepat + keyboard, zoom/pan/tepi, dan sentuhan 390 px. |

Adapter menggunakan `L.popup(options, marker)` dan event publik `move/remove`, tanpa `bindPopup` yang akan menambahkan perilaku klik default. Klik marker desktop tetap membuka detail; sentuhan tetap membuka sheet. Lifecycle popup dibuat sekali per marker aktif dan dibersihkan saat selection berubah. Koordinat dataset tidak dimodifikasi.

Referensi teknis: [Leaflet Popup](https://leafletjs.com/reference.html#popup), [React Leaflet Popup](https://react-leaflet.js.org/docs/api-components/#popup), [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster). Audit juga membaca implementasi versi yang benar-benar terpasang di node_modules.

## Hasil sebelum dan sesudah

| Pemeriksaan | Sebelum | Sesudah |
| --- | --- | --- |
| Diam 350 ms pada segitiga | Popup hilang; tes gagal | Tetap terbuka; lulus |
| A/B setelah spiderfy | Panah A bergeser 35 px horizontal; tes gagal | Kedua sumbu dalam toleransi 2 px; lulus |
| Pointer diam dan lintasan perlahan ke tombol | Area panah belum tercakup | Monitor DOM tidak mendeteksi pelepasan popup selama lintasan; tombol detail berhasil |
| A/B cepat, timer lama | Belum dilindungi tes khusus | Empat putaran pergantian, ID terakhir dan nilai nol benar |
| Keyboard | Mouseleave bisa mengabaikan fokus | Link tetap fokus, Escape menutup dan fokus kembali ke marker |
| Pan, zoom in/out, kiri/kanan/atas/bawah | Belum dilindungi tes anchor | Popup terlihat, autoPan dan anchor lulus |
| Mobile 390 × 844 | Perilaku sheet tersedia | Tap hasil spiderfy, sheet, detail, kembali lulus |
| Navigasi wilayah/dropdown/cluster | Tes lama tersedia | Tetap lulus, jenis tetap opsional |
| Daftar, null/0, state kembali, tile gagal, ID asing, data kosong | Tes lama tersedia | Tetap lulus |

Dua tes regresi yang sama dijalankan terhadap server awal 5173 dan **keduanya gagal pada pemeriksaan bug yang dituju**. Seluruh tes kemudian dijalankan terhadap clone 5175 dan lulus.

Zoom **200% benar-benar diubah melalui menu Chrome**, dengan label Zoom: 200%, viewport CSS 720 × 389 dan devicePixelRatio 4 (normal: 1440 × 778, DPR 2). Tidak ada horizontal overflow; daftar, pratinjau A, Lihat detail, dan kembali ke peta dapat dipakai. Zoom dikembalikan ke 100% sesudah pengujian. Tes otomatis lama juga memeriksa reflow lebar 720 px.

Tidak ada error runtime material pada pemuatan halaman baru maupun pengujian browser otomatis. Saat pengeditan live sempat ada peringatan React Fast Refresh tentang perubahan panjang dependency effect; sesudah reload halaman, peringatan tidak terulang.

## Perintah dan hasil

Jalankan dari folder clone, menggunakan Node v24.19.0 dan npm 11.17.0:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
PLAYWRIGHT_PORT=5175 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
npm run validate:data
```

| Pemeriksaan | Hasil |
| --- | --- |
| Typecheck | Lulus |
| ESLint | Lulus, tanpa error/peringatan |
| Unit/component | 59 tes, 4 berkas, lulus |
| Build produksi | Lulus |
| Browser Chrome | 13 tes, lulus |
| Validasi data | Utama 0 instansi; demo 7 instansi; valid |
| git diff --check | Lulus |

Server yang sudah berjalan tetap tersedia di port 5175. Untuk menyalakan lagi jika telah dihentikan:

```sh
cd ~/dashboard-monitoring-simpul-jaringan-jikn
npm run dev -- --port 5175 --strictPort
```

## Bukti visual

Semua gambar merupakan tangkapan aplikasi yang benar-benar dijalankan.

- [Sebelum: panah menunjuk pusat A/B](qa/popup/sebelum-spiderfy.png)
- [Sesudah: popup A stabil, Jenis Semua Jenis](qa/popup/popup-stabil-spiderfy-desktop.png)
- [Sentuhan 390 px](qa/popup/popup-sentuh-390.png)
- [Sisi kiri](qa/popup/popup-tepi-kiri.png), [kanan](qa/popup/popup-tepi-kanan.png), [atas](qa/popup/popup-tepi-atas.png), [bawah](qa/popup/popup-tepi-bawah.png)
- [Catatan pemeriksaan zoom Chrome 200%](qa/popup/zoom-200.json)

Tidak ada bug popup tersisa yang ditemukan pada skenario di atas. Batas verifikasi: sentuhan menggunakan emulasi Chrome, belum perangkat fisik; Safari/Firefox dan pembaca layar belum diuji. Hasil ini tidak mengklaim kompatibilitas di semua browser.
