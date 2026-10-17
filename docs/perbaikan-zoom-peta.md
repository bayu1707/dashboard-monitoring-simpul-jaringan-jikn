# Perbaikan zoom out peta — 16 Oktober 2026

## Reproduksi dan penyebab

Pada localhost port 5175, buka `/simpul-jaringan?provinsi=36`, lalu kecilkan peta berulang dari zoom 9 ke 8, 7, 6, 5 dan 4. Sebelum perbaikan, lingkaran kab/kota bergeser hingga sekitar **158 piksel** dari posisi referensinya. Algoritma menghindari tabrakan dengan langkah 56 piksel hingga radius lima langkah, tanpa menyesuaikan cakupan geografis yang makin kecil. Dalam tampilan percontohan, garis penghubung tidak ditampilkan sehingga lingkaran tampak berada di Lampung, laut atau Jawa Barat.

Koordinat referensi dan kantor bukan penyebabnya. Lapisan administratif juga berbeda dari cluster marker instansi.

Bukti sebelum perubahan tersimpan lokal dalam `.local/qa/zoomout-before.json` dan `zoomout-before.png`.

## Perubahan

- `src/services/regionSummaries.ts`: pencarian posisi terdekat dengan radius maksimum 56 piksel. Kondisi terlalu padat mempertahankan anchor sumber; akses wilayah lewat polygon, dropdown dan Daftar tetap tersedia.
- `src/components/map/MapView.tsx`: batas zoom minimum lapisan kab/kota dalam provinsi terpilih mengikuti bounds sumber dan ukuran viewport dengan ruang toolbar. Tampilan awal/nasional dapat diperkecil hingga zoom 3 tanpa batas tambahan berdasarkan bounds percontohan, sesuai revisi pengguna. Batas provinsi dihitung ulang saat cakupan atau ukuran layar berubah. Peningkatan zoom untuk sesi provinsi lama dilakukan tanpa animasi agar tidak bertabrakan dengan `fitBounds`.
- Zoom pada lapisan instansi tetap boleh diperkecil hingga 3 untuk clustering. Untuk cakupan administratif lebih luas, gunakan Kembali ke Nasional atau Reset. Perubahan batas tidak mengganti ID/filter atau membuat ulang map instance.
- `tests/region-summaries.test.ts`: regresi radius terbatas pada 38 label padat, pencarian posisi terdekat, ID deterministik dan koordinat sumber tetap utuh.
- `tests/e2e/region-zoom.spec.ts`: lima regresi browser untuk Banten/Jakarta pada 1440/390 px, tombol/keyboard/scroll zoom, pemilihan kota setelah zoom out, pelepasan batas saat masuk instansi, sesi lama, resize dan kembali nasional. Posisi visual diukur terhadap proyeksi koordinat referensi.
- `tests/e2e/pilot.spec.ts`: helper penguraian cluster menangani elemen yang sudah dilepas sebelum `boundingBox` dibaca.
- README dan panduan percontohan menjelaskan perilaku batas zoom.

## Hasil pemeriksaan

- `npm run build`: lulus.
- `npm run typecheck`: lulus.
- `npm run lint`: lulus.
- `npm run test`: **121 tes**, 10 berkas, lulus.
- Lima tes zoom baru: **5/5 lulus** pada Google Chrome, desktop 1440 dan mobile 390.
- Rangkaian seluruh browser: **32/33 lulus** pada putaran pertama. Satu timeout berasal dari helper yang menunggu elemen cluster yang telah terurai, ketika ketiga marker kantor sudah tersedia. Sesudah helper diperbaiki, seluruh berkas pilot dijalankan ulang: **8/8 lulus**, termasuk skenario yang sebelumnya timeout. Dengan demikian semua 33 skenario telah memperoleh hasil lulus; bukan klaim satu putaran penuh 33/33.
- Regresi hover stabil, pergantian marker, posisi panah pada empat tepi viewport, pan/zoom, spiderfy, keyboard dan sentuh lulus pada rangkaian tersebut. Reflow lebar CSS setara zoom 200% juga lulus; zoom browser fisik tidak diuji ulang pada pekerjaan ini.
- Tes zoom baru tidak mencatat `pageerror`; regresi pilot memeriksa `pageerror` dan console error aplikasi. Pengujian menggunakan rendering software Chrome sementara karena keterbatasan renderer macOS lingkungan uji.

Script browser yang dijalankan adalah `npm run test:e2e`, menggunakan port 5175 dan konfigurasi sementara di luar repository yang menambahkan argumen Chrome `--disable-gpu`. Putaran pertama memakai `--ignore-snapshots`; proyek ini tidak mempunyai assertion snapshot (`toHaveScreenshot`/`toMatchSnapshot`). Screenshot bukti dibuat langsung dan diperiksa visual.

Screenshot sesudah perbaikan, disimpan lokal dan tidak dimasukkan Git:

- `.local/qa/zoomout-after-36-1440.png`
- `.local/qa/zoomout-after-31-1440.png`
- `.local/qa/zoomout-after-36-390.png`
- `.local/qa/zoomout-after-31-390.png`

Server development tetap tersedia di `http://127.0.0.1:5175`. Tidak ada commit, push, merge atau deployment pada pekerjaan ini.

## Revisi tampilan awal sesuai permintaan pengguna

Batas tambahan berdasarkan bounds pada tampilan awal/nasional dilepas. Lapisan ini kini dapat diperkecil hingga zoom 3 dan mempertahankan zoom/center pilihan pengguna setelah refresh. Batas menurut cakupan hanya berlaku saat kab/kota provinsi terpilih ditampilkan. Dua tes tambahan memeriksa tampilan awal desktop 1440 dan mobile 390: zoom keluar hingga skala dunia, query tetap nasional, reload memulihkan viewport dan pemilihan Banten tetap membuka delapan kab/kota.

`RegionCounts.tsx` juga mengecilkan pergeseran label bersama proyeksi peta di bawah zoom 8, sehingga label tidak terus menjauh dalam satuan geografis. Tes mengukur kedua lingkaran provinsi terhadap koordinat referensi pada zoom luas, dengan toleransi pembulatan satu piksel. Saat sangat diperkecil, provinsi yang berdekatan dapat bertumpuk secara visual; pemilihan melalui keyboard, dropdown dan Daftar tetap tersedia. Tidak ada penggabungan ID wilayah atau cluster instansi pada lapisan ini.

Sesudah revisi ini, **7/7 tes pada `region-zoom.spec.ts`**, build, typecheck dan lint lulus. Tes unit serta seluruh rangkaian browser sebelumnya tidak diulang pada revisi kecil ini. Screenshot tambahan: `.local/qa/overview-free-zoom-1440.png` dan `.local/qa/overview-free-zoom-390.png`.


## Audit Jepara, 17 Oktober 2026

Pada percontohan enam provinsi, layout badge kini dihitung pada **zoom aktual** dan pergeseran layar dibatasi 56 px seperti badge kab/kota. Perhitungan lama pada minimal zoom 8 yang kemudian diperkecil membuat badge DIY menutupi pusat tombol Jawa Tengah di mobile, karena diameter tombol tetap 48 px. Koordinat referensi maupun pin kantor tidak berubah. Overview nasional lengkap 38 provinsi tetap memakai proyeksi sebelumnya.

Regresi `region-zoom.spec.ts` memeriksa seluruh pusat tombol provinsi dapat dipilih pada zoom 3 serta pergeseran maksimal 57 px (termasuk pembulatan). `jepara-review.spec.ts` memeriksa tap Jawa Tengah → Jepara → pin → detail pada 390 px, selain hover dan ketepatan panah di desktop. Ini tidak menambah batas zoom minimum.


## Zoom lebih halus — 17 Oktober 2026

`MapZoomControls.tsx` mempertahankan kontrol Leaflet beserta judul/akses keyboard, tetapi mengarahkan tombol dan keyboard ke API publik `flyTo` dengan durasi 320 ms dan langkah 0,5. Wheel digabung dalam jendela 80 ms, dibatasi 0,25–0,5 level per burst, mempertahankan titik di bawah kursor pada akhir animasi. Double click juga memakai animasi dan setengah level. Pinch bawaan tetap berjalan dengan snap 0,25. Min/max dan aturan cakupan tetap dipatuhi; zoom tidak mengubah query filter atau level navigasi.

Transisi CSS `zoomAnimation` tetap nonaktif karena timeout Leaflet 1.9 saat unmount yang ditemukan pada audit sebelumnya. `flyTo` memakai animation frame yang dibatalkan oleh lifecycle `map.remove()`. Timer wheel serta event listener dibersihkan, termasuk ketika map unload; perubahan cakupan membatalkan antrean wheel melalui event `viewreset`. Tidak memodifikasi properti privat Leaflet, menggeser koordinat, menunda tautan detail atau membuat ulang map instance per filter.

`prefers-reduced-motion: reduce` menggunakan perubahan langsung dengan langkah sama. Tes baru mengamati beberapa transform tile yang benar-benar dirender selama animasi pada tiga level navigasi, memeriksa langkah tombol/keyboard/wheel, serta reduced motion. Regresi lama disesuaikan untuk langkah setengah level dan penjepitan pada batas fraksional; tidak lagi mengasumsikan setiap klik turun satu level.

Hasil dan screenshot tahap ini disimpan di `.local/landing-zoom-review-20261017/`; hasil akhir dicatat setelah pengujian selesai. Dokumentasi API: [flyTo](https://leafletjs.com/reference.html#map-flyto), [zoomSnap/zoomDelta](https://leafletjs.com/reference.html#map-zoomsnap), dan [remove](https://leafletjs.com/reference.html#map-remove).

## Koreksi konflik zoom browser — 17 Oktober 2026

Handler wheel sebelumnya melewatkan event dengan `ctrlKey`. Padahal browser Chromium juga mengirim pinch trackpad sebagai Ctrl+wheel. Akibatnya peta tidak menangani gestur tersebut dan aksi bawaan browser memperbesar halaman. Handler keyboard juga melewatkan Cmd/Ctrl dengan tombol +/− saat fokus berada pada peta. Regresi awal membuktikan event pinch tidak dibatalkan (`defaultPrevented: false`); log sebelum perbaikan ada di `.local/gesture-fix-20261017/before.log`.

`MapZoomControls.tsx` kini menangkap wheel pada fase capture dengan listener nonpasif di container peta. Pinch dibatalkan dan diteruskan ke antrean zoom peta yang sama, termasuk jika pointer berada di kontrol atau popup. Scroll biasa pada isi popup tetap memakai perilaku scroll kontennya. Cmd/Ctrl +/− hanya diarahkan ke peta saat fokus berada di peta dan bukan input teks. Listener tidak dipasang pada `document` atau `window`, sehingga pintasan browser di luar peta tetap tersedia.

Safari desktop mendapat handler `gesturestart/change/end` lokal; perubahan skala relatif diproses melalui antrean yang sama. Wheel yang datang selama gestur tersebut tidak dihitung dua kali. Perangkat layar sentuh tetap menggunakan TouchZoom bawaan Leaflet. Semua listener/timer dilepas ketika komponen dilepas. Tidak ada perubahan pada koordinat, dataset, hyperlink ANRI, pengaturan browser, atau viewport meta yang mematikan zoom aksesibilitas.

Regresi `tests/e2e/map-zoom-gestures.spec.ts` memeriksa tiga tingkat navigasi, input Ctrl+wheel lewat browser, Cmd/Ctrl +/−, kontrol dan popup, pinch dua jari pada viewport 390 px, serta pelepasan handler setelah membuka detail. Pengukuran membandingkan zoom peta yang disimpan aplikasi dan ukuran halaman (`innerWidth`, `devicePixelRatio`, `visualViewport.scale`). Event Safari diuji secara sintetis di Chrome; pengujian ini bukan klaim verifikasi trackpad fisik Safari. Rangkaian regresi lama juga memeriksa hover/anchor, cluster, sentuh, tombol Landing Page, dan batas wilayah.

Referensi: [MDN wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event) menjelaskan Ctrl+wheel saat pinch; [MDN GestureEvent](https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent) menjelaskan event khusus WebKit. Hasil pelaksanaan dan screenshot lokal tersimpan di `.local/gesture-fix-20261017/` dan output Playwright.

Hasil setelah koreksi: build, typecheck, lint, **133 tes unit/komponen**, dan **27/27 tes browser** pada keempat berkas terkait lulus. Browser memakai Google Chrome dengan rendering software, viewport 1440 dan 390 px. Sembilan tes gestur baru lulus; input Ctrl+wheel melalui Playwright dan input sentuh dua jari melalui protokol Chrome mempertahankan ukuran halaman. Regresi popup, batas zoom wilayah, animasi dan tombol ANRI juga lulus. Tautan eksternal ANRI diuji melalui intersepsi fixture lokal, tanpa mengakses situs tujuan. Tidak ada `pageerror` pada skenario tersebut. Trackpad fisik dan Safari asli belum diuji. Localhost 5175 merespons HTTP 200; tidak ada commit, push, merge, atau deployment.

Jika halaman telanjur membesar sebelum versi ini, pengguna dapat menekan **⌘0** sekali untuk mengembalikan skala halaman, lalu **⌘R** untuk memuat ulang. Gestur cubit/scroll di atas peta kemudian mengubah peta; Cmd/Ctrl +/− mengubah peta ketika fokus ada di dalamnya.
