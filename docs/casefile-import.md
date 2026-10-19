# Snapshot Pengelolaan Casefile

> Pembaruan kolaborasi 19 Oktober 2026: clone baru memakai snapshot bersama, bukan middleware `.local`. [Panduan dataset bersama](dataset-kolaborasi.md) menjadi acuan menjalankan aplikasi. Perintah impor/riset di bawah adalah proses pemeliharaan lokal, bukan syarat clone.


Alur data: **Excel → validasi/normalisasi → snapshot JSON → repository asinkron → peta, popup, detail**. Komponen tidak membaca Excel. Workbook pengguna tetap utuh dan tidak dimasukkan ke Git atau aset publik.

## Menjalankan dan mengimpor ulang

Gunakan Node 24.19.0, npm, dan Python 3.10 atau lebih baru. Importer Python hanya memakai pustaka standar, sehingga tidak perlu `pip install`.

```sh
npm ci
npm run import:casefile -- "/lokasi/Indonesia.xlsx"
npm run validate:data -- .local/casefile/snapshot.json
```

Sumber yang dipakai harus mempunyai sheet persis `pengelolaan casefile`. Header C1/D1/E1 dan H2:P2 diperiksa. Baris 3 adalah ringkasan dan tidak dihitung sebagai instansi. Hanya kolom C–E dan H–P yang diekstrak; kolom PIC, kontak pribadi, dan kolom internal lainnya tidak diekspor. Baris Total/kosong diabaikan dengan alasan dalam laporan. Bila baris gagal validasi, snapshot lama tidak ditimpa.

Output default di `.local/casefile/`:

| Berkas | Kegunaan |
| --- | --- |
| `snapshot.json` | Instansi normalisasi dan metadata, statistik kosong |
| `raw-selected.json` | Nilai sumber dari kolom yang diizinkan, terpisah dari normalisasi |
| `validation-report.json` | Jumlah, kategori, duplikat, peringatan, baseline, perubahan identitas |
| `exceptions.json` | Record yang belum dapat dipetakan, kode bermasalah, baris ditolak |
| `identity-registry.json` | Pemeriksaan kestabilan ID pada impor berikutnya |

`--references path/references.json`, `--output folder-review`, dan `--captured-at 2026-10-14T15:00:00+07:00` dapat diberikan. Timestamp harus memiliki zona waktu. Simpan folder review di `.local/` atau lokasi privat di luar proyek, bukan `public/` atau `src/`.

ID lokal memakai hash kode dan nama yang dinormalisasi, tanpa nomor baris, tahun, kategori, atau nama workbook. Pengubahan urutan baris tidak mengubah ID. Perubahan kode/nama dilaporkan sebagai ID ditambah/dihapus untuk ditinjau; perubahan tahun/kategori dilaporkan sebagai record berubah. Dua kode yang sama dengan nama berbeda tetap menjadi dua record. Identitas kode+nama berulang dianggap konflik dan tidak digabung otomatis. Kode teks mempertahankan nol di depan; nilai numerik berformat tanggal dibaca dari XML mentah dan ditandai untuk verifikasi.

## Mengaktifkan review lokal

Tambahkan `VITE_LOCAL_CASEFILE=1` pada `.env.local`, lalu mulai ulang server:

```sh
npm run dev -- --port 5175
```

Buka `http://127.0.0.1:5175/simpul-jaringan`. Vite melayani satu berkas `.local/casefile/snapshot.json` pada `/local-data/snapshot.json` hanya pada server pengembangan. Workbook, raw-selected, registry identitas, dan laporan tidak disajikan lewat jalur tersebut. Host tetap `127.0.0.1`. Build/preview menggunakan snapshot publik di `public/data/snapshot.json` yang masih kosong; data review tidak masuk `dist/`.

Tanpa konfigurasi lokal, clone baru menampilkan **Data simpul belum dimuat**. Set `VITE_LOCAL_CASEFILE=0` atau hapus variabel untuk kembali ke sumber publik. Mode `?demo=1` selalu membaca `public/demo/`, tanpa menggabungkan record Excel. Semua variabel `VITE_*` terlihat publik; jangan memasukkan rahasia.

## Kategori dan pencocokan wilayah

| Kolom | ID jenis | Baseline aktual workbook |
| --- | --- | ---: |
| H K/L | `kl` | 103 |
| I LKD Prov | `lkd-provinsi` | 35 |
| J LKD Kab | `lkd-kabupaten` | 365 |
| K LKD Kota | `lkd-kota` | 92 |
| L PTN | `ptn` | 35 |
| M PTKN | `ptkn` | 3 |
| N PTS | `pts` | 5 |
| O PTK | `ptk` | 2 |
| P BUMN | `bumn` | 3 |

Impor menghitung ulang nilai aktual. Baseline 643 dan rentang 2015–2026 adalah pemeriksaan pembanding, bukan angka yang dipaksakan. Metadata `coverage: full` berarti seluruh record sheet workbook, bukan seluruh simpul atau total arsip nasional JIKN. `nationalTotal` tetap null.

Nama administratif eksplisit pada kategori LKD dibandingkan dengan registry sah setelah normalisasi kapital, spasi, dan singkatan `Kab./Prov.`. Hanya kecocokan tunggal persis yang diberi `verified`. Nama ambigu, variasi ejaan, atau nama tanpa penanda administratif masuk `needs-review`. Kementerian, perguruan tinggi, serta BUMN masuk `unresolved` karena nama saja tidak membuktikan lokasi kantor.

`provinceId` dan `kabKotaId` nullable dan terpisah. Instansi yang hanya diketahui provinsinya tersedia pada daftar tingkat provinsi. **Daftar → Instansi dalam cakupan** memungkinkan mencari seluruh katalog berdasarkan nama/kode. **Daftar → Belum Terpetakan** menampilkan instansi tanpa provinsi terverifikasi. Query `daftar=instansi` atau `daftar=belum-terpetakan` dan `cari` memulihkan tampilan katalog ketika kembali dari detail.

Tidak ada geocoding otomatis. Lokasi administratif adalah wilayah identitas/layanan, bukan koordinat kantor. Snapshot ini mempunyai 0 koordinat kantor. Peta awal menampilkan jumlah ID instansi unik per provinsi menggunakan posisi navigasi dari sumber administratif. Klik provinsi langsung mengganti lapisan menjadi kabupaten/kota; klik kabupaten/kota langsung membuka lapisan instansi. Penanda wilayah tidak ditampilkan lagi pada lapisan instansi dan tidak masuk cluster spasial.

Setelah kabupaten/kota dipilih, peta tetap menjadi fokus utama. Instansi dengan koordinat valid langsung mempunyai marker kantor: hover tepat pada marker membuka popup native yang berpanah ke marker, klik desktop membuka detail, dan tap membuka sheet. Hover daftar tidak menggantikan interaksi marker. Popup ringkas berisi logo/placeholder, kategori, nama, statistik, tahun bergabung, Lihat detail, serta Landing Page. Bila seluruh koordinat dalam cakupan masih kosong, peta menjelaskan bahwa titik belum tersedia; Daftar dapat dibuka sebagai alternatif dan tombol Pratinjau profil merupakan aksi eksplisit. Data yang wilayahnya belum diketahui tetap tersedia melalui tombol Belum Terpetakan. Cluster hanya memakai marker kantor berkoordinat valid. Demo sintetis tetap menyediakan regresi cluster/spiderfy dan anchor popup.

Referensi nasional memuat 38 provinsi dan 514 kabupaten/kota. Geometri kabupaten/kota dimuat per provinsi, dengan cache dan retry; registry serta dropdown tetap tersedia ketika pemuatan geometri gagal. Baca [sumber wilayah](reference-sources.md) untuk lisensi, commit, jumlah, serta keterbatasan geometri.

Setiap penanda wilayah memilih satu ID secara langsung, tanpa langkah pemilih tambahan. Jika label berdekatan pada layar, label dipisahkan dalam piksel dan dihubungkan dengan garis ke titik sumbernya. Lat/lng wilayah tetap sama, koordinat kantor tidak diisi dari posisi label. Daftar dan dropdown tetap menjadi alternatif akses.

## Tahun, statistik, dan Landing Page

`joinedYear` berasal dari E pada sheet casefile, dengan `joinedYearSource` yang menunjuk sumber dan sel. Popup dan detail membaca record yang sama. Tahun tidak diganti tanggal pembaruan atau tanggal impor. `capturedAt` adalah waktu impor; `sourceUpdatedAt` tetap null karena tanggal pembaruan sumber tidak diberikan.

Jumlah arsip, pencipta, kopi digital, tren, distribusi, kontribusi, dan status simpul tidak disimpulkan dari Excel ini. Repository menyediakan metric null dan empty state. Angka nol yang tersedia pada sumber lain tetap dibedakan dari null.

Tombol Landing Page sejajar dengan Lihat detail. URL hanya aktif jika domain/path resmi, metadata sumber, waktu, dan status verified lengkap. Ikuti [panduan mapping](landing-pages.md). Maksimal lima sampel ditinjau dahulu; pengumpulan massal menunggu persetujuan metode dan hasil sampel. Setelah hasil mapping ditinjau, salin `snapshot-with-landing-pages.json` sebagai snapshot review lokal, lalu validasi lagi; jangan pindahkan ke aset publik sebelum izin berbagi ditentukan.

## Pemeriksaan dan API berikutnya

```sh
npm run test:import
npm run typecheck
npm run lint
npm run validate:data
npm test
npm run build
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PORT=5175 npm run test:e2e
```

Tes importer memakai workbook/record sintetis. Tes browser casefile hanya berjalan jika snapshot lokal sudah tersedia; pada clone tanpa workbook, empat skenario review lokal dilaporkan skip. Tes demo tetap berjalan. Screenshot yang memuat record pengguna berada di `.local/qa/` dan diabaikan Git.

Adapter API resmi nanti mengimplementasikan kontrak repository yang sama. Mapping ID lokal → ID resmi perlu diperiksa sebelum menggabungkan tahun Excel dengan profil API. Kode duplikat tidak boleh menjadi satu-satunya kunci join. Dokumentasi endpoint, definisi metric, autentikasi, dan izin penggunaan harus berasal dari SIKN/ANRI; tahap ini belum menyambungkan API.
