## Kolaborasi Tim

Proyek Dashboard Monitoring Simpul Jaringan JIKN
dikembangkan secara kolaboratif menggunakan GitHub.

ppppppp bayu nathannya kocak


# Dashboard Monitoring Simpul Jaringan JIKN

Frontend untuk mempelajari dan mengembangkan halaman Simpul Jaringan ANRI. Aplikasi menyediakan peta nasional di `/simpul-jaringan` dan detail instansi di `/simpul-jaringan/:id`, dengan antarmuka bahasa Indonesia. Data dibaca melalui repository asinkron sehingga sumber lokal dapat diganti dengan REST API resmi pada tahap berikutnya.

Dataset publik di Git tetap **kosong**. Tampilan development lokal diperluas ke **enam provinsi Jawa dan 119 kabupaten/kota**. Katalog memuat **249 instansi**, termasuk **120 record LKD** yang teridentifikasi dari Excel: **249 sudah mempunyai pin rujukan publik kantor/unit layanan** dan **0 tanpa pin** setelah penambahan 108 pin Google Maps (review 17 Oktober 2026). Tujuh pin mempunyai perbedaan alamat yang perlu dikonfirmasi, dua merupakan rujukan historis, dan tiga mempunyai tinjauan batas geometri yang dicatat per record. Nama/kode/tahun berasal dari Excel; statistik dan grafik berlabel **DATA SIMULASI**. Kelengkapan pin berlaku untuk 249 record percontohan yang dipilih, belum seluruh 643 record Excel atau jaminan seluruh instansi Jawa. Pin publik bukan pengesahan koordinat lapangan oleh ANRI. Baca [panduan koordinat](docs/koordinat-kantor.md) dan [panduan Jawa](docs/pilot-jawa.md); [panduan Jakarta–Banten](docs/pilot-jakarta-banten.md) merupakan riwayat tahap 28 record sebelumnya.

Tampilan awal dapat diperkecil hingga skala dunia, tanpa batas tambahan berdasarkan cakupan percontohan. Saat kab/kota suatu provinsi ditampilkan, batas zoom out mengikuti cakupannya agar lingkaran tidak menyebar keluar daerah. Gunakan **Kembali ke Nasional** atau **Reset** untuk kembali ke tampilan awal. Zoom pada lapisan instansi tetap tersedia untuk clustering. Tombol dan keyboard kini berubah 0,5 level dengan transisi 320 ms; scroll dibatasi 0,25–0,5 level per burst. Preferensi reduced motion tetap dihormati. Satu sampel Landing Page **Arsip Nasional RI** sudah aktif pada pilot lokal berdasarkan hyperlink dari pengguna; lihat [panduan mapping](docs/landing-pages.md).

Hasil impor penuh **643 instansi** tetap tersimpan di `.local/casefile/` dan dapat direview dengan `?data=excel`. Mode **DATA DEMO** sintetis lama tetap terpisah melalui `demo=1`. Koordinat, kontak, dan hyperlink yang belum diketahui tetap null; statistik simulasi tidak ditambahkan ke snapshot Excel penuh. Cadangan sebelum penyederhanaan berada di `.local/backups/`.

Data instansi resmi belum terintegrasi dengan SIKN/JIKN. Proyek saat ini hanya frontend dengan JSON lokal; tidak membutuhkan backend atau database untuk dijalankan tim.

## Persiapan laptop Windows dan macOS

Siapkan Git, Node.js **24.19.0**, npm, browser modern, dan akses internet untuk clone, pemasangan dependensi, serta tile peta. Akun GitHub anggota perlu diberi akses ke repositori **PRIVATE** oleh pemilik; dashboard lokal sendiri tidak memerlukan login. Folder proyek boleh berada di lokasi pilihan masing-masing anggota dan tidak memerlukan konfigurasi khusus laptop pengembang awal.

| Sistem | Memasang Git | Memasang Node.js |
| --- | --- | --- |
| Windows | Unduh installer dari [Git for Windows melalui situs resmi Git](https://git-scm.com/install/windows), lalu ikuti pemasangan. Gunakan PowerShell, Command Prompt, atau Git Bash. | Buka [arsip resmi Node.js 24.19.0](https://nodejs.org/en/download/archive/v24.19.0), pilih installer `.msi` sesuai arsitektur x64/ARM64, lalu pasang. npm ikut tersedia. |
| macOS | Ikuti [panduan resmi Git untuk macOS](https://git-scm.com/install/mac). Salah satu pilihan ialah `xcode-select --install` untuk memasang Xcode Command Line Tools yang memuat Git. | Buka [arsip resmi Node.js 24.19.0](https://nodejs.org/en/download/archive/v24.19.0), lalu pasang installer `.pkg`. npm ikut tersedia. |

Buka ulang terminal setelah pemasangan, lalu periksa:

```sh
git --version
node --version
npm --version
```

Gunakan `v24.19.0` sesuai `.nvmrc`; rentang engine yang diterima proyek adalah `>=24.15.0 <25`. Untuk anggota yang sudah memakai nvm pada macOS, `nvm install 24.19.0` lalu `nvm use` dapat dijalankan dari folder proyek. nvm tidak wajib untuk menjalankan aplikasi. Panduan instalasinya ada di [repositori resmi nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

Pemeriksaan perubahan casefile memakai **Node 24.19.0 dan npm 11.17.0 pada macOS**. Importer Excel memakai Python 3.10+ dan pustaka standar tanpa dependency baru. Seluruh dependency frontend tercatat dalam `package.json` dan lockfile. Pengujian pada laptop Windows belum dilakukan.

## Clone dan menjalankan secara lokal

Repositori PRIVATE tim: [bayu1707/dashboard-monitoring-simpul-jaringan-jikn](https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn). Sebelum clone, terima undangan collaborator dan autentikasikan GitHub pada laptop sendiri melalui Git Credential Manager atau GitHub CLI; lihat [panduan autentikasi tim](docs/kolaborasi-tim.md#akses-dan-autentikasi).

Jalankan dari folder tempat Anda ingin menyimpan proyek:

```sh
git clone https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn.git
cd dashboard-monitoring-simpul-jaringan-jikn
npm ci
npm run dev
```

[`npm ci`](https://docs.npmjs.com/cli/v12/commands/npm-ci/) memasang dependency sesuai `package-lock.json` tanpa mengubah lockfile. Jangan menghapus lockfile atau memakai `--force`/`--legacy-peer-deps` untuk menyembunyikan konflik. `npm install` dipakai hanya ketika sengaja mengubah dependency; perubahan `package.json` dan lockfile harus ditinjau bersama.

Buka URL **Local** yang dicetak Vite, biasanya [peta lokal](http://127.0.0.1:5173/simpul-jaringan). Script memakai host `127.0.0.1`, sehingga server hanya berjalan pada laptop masing-masing. Jika port 5173 terpakai, ikuti port yang dicetak terminal. Hentikan server dengan `Ctrl+C`. Mode demo tersedia dengan membuka `/simpul-jaringan?demo=1` pada host/port yang sama.

Untuk melihat hasil build secara lokal:

```sh
npm run build
npm run preview
```

Preview biasanya tersedia di [127.0.0.1:4173](http://127.0.0.1:4173/simpul-jaringan). Perintah ini tidak melakukan deployment.

## Versi aktual

Versi berikut dibaca dari instalasi dan lockfile, bukan hanya rentang di `package.json`:

| Bagian | Versi |
| --- | --- |
| React, React DOM, React Is | 19.3.0 |
| Vite / plugin React | 8.3.4 / 6.1.2 |
| TypeScript | 5.9.3, mode strict |
| React Router DOM | 7.18.4 |
| Leaflet / React Leaflet | 1.9.4 / 5.0.0 |
| Leaflet.markercluster | 1.5.3 |
| Recharts | 3.10.1 |
| Lucide React | 0.577.0 |
| ESLint / typescript-eslint | 9.39.5 / 8.71.1 |
| Vitest / jsdom | 5.0.4 / 27.4.0 |
| Playwright | 1.64.0 |
| Testing Library React | 16.3.3 |
| tsx | 4.23.15 |

React Leaflet 5 menerima React 19 dan Leaflet 1.9; markercluster 1.5.3 menerima Leaflet `^1.3.1`. Cluster menggunakan adapter lifecycle sendiri di `ClusterLayer.tsx`: group dibuat saat efek aktif, seluruh event dan layer dilepas saat cleanup. Tidak ada wrapper React tambahan dengan peer dependency yang bertentangan. Recharts menerima React 19; `react-is` disamakan dengan versi React. Periksa instalasi lokal dengan `npm list --depth=0`.

Dokumentasi primer: [React dan TypeScript](https://react.dev/learn/typescript), [Vite](https://vite.dev/guide/), [React Leaflet](https://react-leaflet.js.org/docs/start-installation/), [Leaflet](https://leafletjs.com/reference.html), [markercluster](https://github.com/Leaflet/Leaflet.markercluster), dan [Recharts](https://recharts.github.io/en-US/).

## Mencoba alur DATA DEMO

Buka [mode demo lokal](http://127.0.0.1:5173/simpul-jaringan?demo=1). Header, ringkasan, popup, dan detail menandai mode demo. Tautan **Keluar demo** kembali ke sumber utama yang dikonfigurasi pada laptop.

1. Klik geometri **Banten**, atau pilih Banten pada dropdown Provinsi. Lapisan berganti menjadi kabupaten/kota dan dropdown ikut berubah.
2. Klik **Kota Serang**, atau pilih Kota Serang pada dropdown Kab/Kota. Instansi langsung tampil dengan jenis tetap **Semua Jenis**.
3. Ringkasan menunjukkan **7 hasil, 6 terpetakan, 1 tanpa koordinat** dari snapshot demo. Klik cluster untuk mengurai titik. Instansi Demo A dan B sengaja memiliki koordinat sintetis yang sama; pada zoom maksimum spiderfy memisahkan marker bertumpuk.
4. Hover tepat pada marker membuka ringkasan. Kursor dapat dipindahkan ke popup; jeda tutup 200 ms dibatalkan ketika pointer/fokus masuk popup. Klik marker pada desktop, atau tekan **Lihat detail**, untuk membuka profil.
5. Pada layar sentuh, tap marker pertama membuka ringkasan di sheet; **Lihat detail** membuka profil. Jenis instansi tetap opsional. Klik cluster hanya mengurai marker.
6. **Daftar** menyediakan alternatif tekstual dan keyboard. Instansi Demo C tidak memiliki koordinat dan tetap muncul dalam hasil serta dapat dibuka. Demo B memiliki angka nol yang sah; Demo C memiliki metric dan tahun bergabung null yang tampil sebagai **Belum tersedia**.
7. **Kembali ke Peta** memulihkan wilayah, filter, viewport, dan daftar. **Kembali ke Provinsi**, **Kembali ke Nasional**, dan **Reset** mengganti lapisan serta menutup popup.

Pada mobile, **Filter** membuka pilihan draft. **Terapkan** dapat menyimpan provinsi saja, atau provinsi dan kabupaten/kota; jenis tetap tambahan. **Batal/Tutup** membuang draft. **Reset** berlaku langsung dan menutup sheet. Klik wilayah peta menerapkan navigasi langsung tanpa tombol Terapkan.

Nama instansi, statistik, kontak, dan koordinat pada demo adalah sintetis. Geometri wilayah referensi berasal dari BIG; data sintetis tidak ditempelkan pada nama instansi nyata.

## Struktur dan urutan belajar

```text
src/
  pages/                 MapPage dan InstansiDetailPage
  components/layout/     Header dan keadaan loading/error
  components/map/        Filter, peta, adapter cluster, popup, daftar
  components/instansi/   Profil, logo, kartu statistik
  components/charts/     Tren, distribusi, pencipta, tabel aksesibel
  data/                  Konfigurasi tile dan bounds nasional
  services/              Repository, validasi, filter/query, metric, session
  types/                 Model domain TypeScript
  hooks/                 Deteksi layar/input dan pemuatan geometri per provinsi
  styles/                Design tokens, layout, peta, detail
public/
  assets/                Logo ANRI bersumber resmi
  data/                  Referensi dan snapshot utama kosong
    geometry/kab-kota/   GeoJSON kabupaten/kota per provinsi
  demo/                  Referensi taksonomi dan snapshot demo opt-in
tests/                   Unit, komponen, fixture sintetis, browser E2E
scripts/                 Validator JSON, importer Excel/mapping, generator wilayah
.local/casefile/          Hasil impor dan laporan lokal; diabaikan Git
docs/                    Panduan sumber, impor, detail, pemeriksaan manual
```

File pendukung untuk clone meliputi `package.json`, `package-lock.json`, `.nvmrc`, konfigurasi Vite/TypeScript/ESLint/Playwright, `.gitignore`, `.gitattributes`, `.env.example`, serta template Pull Request di `.github/pull_request_template.md`. Source, aset frontend, JSON utama kosong/demo, validator, tes, dan dokumentasi ikut dipakai dari repositori. Lampiran rancangan serta screenshot pribadi di folder awal tidak diperlukan untuk menjalankan aplikasi dan tetap diabaikan Git.

Dependency terpasang, hasil build, environment lokal, log, trace, screenshot pengujian, dan cache dibuat pada laptop masing-masing. Workbook dan hasil impor disimpan di luar aset `public/`; `.local/`, `.env.local`, dan workbook diabaikan Git. Jangan menaruh berkas internal di `public/data/raw/`, karena folder publik disajikan kepada browser walaupun diabaikan Git.

Mulai dari `src/types/domain.ts`, lalu baca `services/validation.ts` dan `localRepository.ts`. Model utama meliputi `Instansi`, `Wilayah`, `StatistikSimpul`, `TrenInput`, `DistribusiArsip`, `PenciptaArsip`, serta `SnapshotMetadata`. Komponen meminta data melalui `InstansiRepository`; komponen tidak mengimpor JSON mentah.

Berikutnya, baca `services/exploration.ts`. Query memakai `provinsi`, `kabKota`, dan `jenis`; `demo=1` hanya untuk opt-in demo. ID kabupaten/kota harus berelasi dengan provinsi. Provinsi saja memulihkan lapisan provinsi; pasangan wilayah valid memulihkan lapisan instansi. Jenis tidak menjadi syarat `canPreviewInstansi`. Filter memakai AND. Mengganti provinsi atau kabupaten/kota mengosongkan pilihan turunannya.

`MapPage.tsx` menyatukan pilihan dropdown dan klik peta. `MapView.tsx` memisahkan lapisan wilayah dengan lapisan marker instansi. `FocusController` mengubah viewport ketika cakupan berubah atau Reset dipakai, sehingga render ulang atau perubahan jenis tidak membatalkan geseran peta pengguna. Bounds wilayah diprioritaskan; bila tidak tersedia, peta mengikuti titik hasil valid; bila keduanya kosong, viewport dipertahankan dan keterangan ditampilkan.

`services/session.ts` menyimpan query, center, zoom, posisi scroll daftar, dan keadaan daftar di `sessionStorage`. Tombol kembali dari detail memakai URL peta yang jelas. Detail yang dibuka langsung memakai pasangan wilayah profil yang valid; aplikasi tidak memakai history back secara buta. Lihat [panduan mempelajari detail](docs/detail-learning.md).

## Data utama, referensi, dan impor

`public/data/references.json` memisahkan provinsi, kabupaten/kota, taksonomi jenis instansi, dan kategori arsip. `public/data/snapshot.json` memisahkan metadata, instansi, dan statistik. `public/data/import-template.json` menyediakan template kosong. `public/demo/` tidak menjadi fallback otomatis apabila data utama gagal dimuat.

Referensi utama kini mencakup **38 provinsi dan 514 kabupaten/kota**, termasuk pemekaran Papua. Registry dan geometri publik berasal dari `cahyadsn/wilayah` serta `cahyadsn/wilayah_boundaries`, dengan lisensi MIT dan commit sumber yang dikunci. Geometri provinsi dimuat pada awal; GeoJSON kabupaten/kota dimuat hanya untuk provinsi yang dipilih. Banten memakai ID `36`, Kota Serang `36.73`. Penanda jumlah menggunakan posisi navigasi wilayah dari kolom lat/lng sumber, dengan provenance terpisah dari koordinat kantor. Geometri komunitas ini adalah referensi tampilan, bukan penetapan batas hukum atau lokasi kantor.

Sumber beracuan Kepmendagri 300.2.2-2430 Tahun 2025 menurut penerbit. [Catatan sumber](docs/reference-sources.md) menjelaskan versi, lisensi, sistem koordinat, keterbatasan datum, serta perbaikan validasi ring degeneratif. Geometri demo Banten tetap memakai referensi BIG sebelumnya agar fixture interaksi tidak berubah. Header memakai aset simbol ANRI resmi yang diunduh utuh dari halaman Arti Logo.

Snapshot Excel pengguna tersedia untuk review lokal. Nama, kode, kategori, dan tahun bergabung berasal dari sheet `pengelolaan casefile`. Nilai pada screenshot tidak diimpor. Tidak dilakukan geocoding otomatis atau akses admin. Petunjuk impor ulang tersedia pada [panduan casefile](docs/casefile-import.md), sedangkan [panduan Landing Page](docs/landing-pages.md) menjelaskan mapping hyperlink.

Untuk mengisi snapshot:

1. Dapatkan sumber publik JIKN atau berkas resmi; catat URL/nama berkas, definisi metric, tanggal acuan, dan cakupan.
2. Simpan sumber mentah terpisah. Folder `public` dapat diakses browser, sehingga hanya berkas yang memang boleh dipublikasikan diletakkan di sana.
3. Isi template mengikuti domain, referensi ID/nama asli wilayah, serta taksonomi resmi. Nilai tidak diketahui memakai null. Koordinat null tidak diganti `[0,0]`, pusat kota, atau titik acak.
4. Validasi hasil normalisasi sebelum mengganti dataset utama:

```sh
npm run validate:data -- path/snapshot-normalisasi.json path/references.json
```

5. Tinjau provenance dan ubah `datasetKind` menjadi `verified` hanya setelah sumber benar-benar diperiksa. Jalankan pemeriksaan proyek dan UI.

[Panduan impor lengkap](docs/import-snapshot.md) menjelaskan setiap kelompok field. Validator menolak ID ganda, relasi wilayah salah, kategori tidak sah, koordinat/tanggal salah, tahun bergabung masa depan, nilai negatif, serta denominator yang tidak konsisten. Duplikasi dilaporkan dengan ID dan sumber, tidak digabungkan berdasarkan nama.

Setiap kelompok data memiliki metadata sumber, `capturedAt` dengan zona waktu, `referenceDate`, cakupan `full`/`partial`, definisi metric, dan catatan verifikasi. `capturedAt`, pembaruan sumber (`sourceUpdatedAt`), dan tahun bergabung (`joinedYear`) adalah informasi berbeda.

## Arti statistik

- Null berarti belum diketahui; nol berarti nilai yang dinyatakan sumber. Kartu dan keadaan **Belum tersedia** tetap tampil saat metric/seri belum ada.
- Jumlah arsip mengikuti unit record sumber. Pencipta arsip menghitung entitas pencipta unik. Kopi digital mengikuti definisi sumber dan tidak disamakan dengan jumlah arsip yang mempunyai file.
- Kontribusi memakai jumlah arsip instansi dibagi total nasional resmi. Implementasi mensyaratkan cakupan metadata penuh, definisi/ID snapshot/tanggal acuan cocok, scope instansi/nasional tepat, dan denominator lebih besar dari nol. Total nasional tidak dihitung dari sampel array instansi.
- Tren menampilkan tambahan record berdasarkan waktu input. Pilihan 1 dan 5 tahun mengikuti kalender yang berakhir pada tahun tanggal acuan; misalnya acuan 2026 berarti 2026 atau 2022–2026. **Semua** memakai seluruh periode tersedia. Tahun kosong tetap null; bar dan garis memakai seri yang sama.
- Distribusi mengikuti kategori sumber. Catatan cakupan muncul jika kategori tidak lengkap; persentase tidak dipaksa menjadi 100. Daftar pencipta menjelaskan hubungan banyak pencipta per record bila dinyatakan sumber.
- Tambahan bulan acuan hanya tampil bila periode input cocok dengan bulan pada tanggal acuan dataset. Snapshot lama tidak dilabeli sebagai kondisi bulan sekarang.

Grafik berisi data dilengkapi tabel/ringkasan tekstual. Tidak ada tab internal Profil/Statistik/Arsip/Aktivitas pada detail. Status simpul ditampilkan hanya jika tersedia dalam sumber.

## Peta dasar dan environment

Konfigurasi bawaan sudah cukup untuk menjalankan aplikasi; berkas environment tambahan tidak wajib. Salin `.env.example` menjadi `.env.local` hanya bila ingin mengganti konfigurasi tile.

macOS atau Git Bash:

```sh
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`VITE_TILE_URL` adalah URL template tile; `VITE_TILE_ATTRIBUTION` adalah attribution provider. Semua variabel `VITE_*` terlihat publik di browser, sehingga tidak boleh berisi rahasia. Ketika mengganti provider, ganti attribution sesuai persyaratannya dan periksa dukungan URL tile. Provider bawaan adalah OpenStreetMap; lihat [ketentuan tile OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).

Tile dapat membutuhkan internet walaupun JSON instansi disimpan lokal. Aplikasi tidak menjanjikan offline penuh. Bila tile gagal, pesan **Peta dasar belum dapat dimuat** muncul; filter, wilayah, daftar, dan posisi marker tetap tersedia. Tombol retry membaca sumber tile yang sama. Pemakaian tile bukan integrasi API data SIKN/JIKN.

## Pemeriksaan proyek

```sh
npm run typecheck
npm run lint
npm run validate:data
npm run test:import
npm test
npm run build
```

`npm test` memeriksa domain, query bertingkat, relasi/filter, null versus nol, metric, repository/retry, session/detail, dan komponen statistik. Fixture memakai data sintetis terpisah. `validate:data` tanpa argumen memeriksa dataset utama dan demo.

Untuk uji browser, pilih salah satu cara:

```sh
# Chromium milik Playwright; pemasangan browser hanya perlu sekali.
npx playwright install chromium
npm run test:e2e
```

Google Chrome yang sudah terpasang juga dapat digunakan. Pada macOS/Linux/Git Bash:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Pada Windows PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Port uji dapat dipisahkan dari server dev menggunakan `PLAYWRIGHT_PORT` (default 5173). Pilih port kosong, misalnya 5174. Pada macOS/Linux/Git Bash:

```sh
PLAYWRIGHT_PORT=5174 npm run test:e2e
```

Pada Windows PowerShell:

```powershell
$env:PLAYWRIGHT_PORT = "5174"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_PORT
```

Variabel `PLAYWRIGHT_PORT` dapat dipakai bersama `PLAYWRIGHT_CHANNEL`. Konfigurasi memvalidasi nomor port 1–65535, memakai host `127.0.0.1`, dan otomatis menjalankan Vite pada port yang dipilih. Di luar CI, server pada port tersebut dapat dipakai kembali; pastikan server itu menjalankan proyek ini, bukan aplikasi lain. Pengujian mencakup klik geometri Banten → Kota Serang, cluster, hover dengan Semua Jenis, detail/kembali, daftar tanpa koordinat, data kosong/rusak, retry, tile gagal, serta viewport 1440 dan sentuh 390. Tes otomatis reflow 200% memakai viewport 720 px. Zoom Chrome aktual 200% juga telah diperiksa langsung pada peta dan detail: lebar CSS 720 px, devicePixelRatio 4, tanpa overflow horizontal. Perangkat sentuh fisik belum diperiksa.

Screenshot demo berada di `tmp/qa/`, screenshot review Excel di `.local/qa/`, dan trace kegagalan di `test-results/`; semuanya diabaikan Git. Skenario browser `casefile.spec.ts` memerlukan snapshot lokal dan dilewati pada clone tanpa workbook. Laporan tahap casefile ada di [review casefile](docs/review-casefile.md). Daftar langkah manual ada pada [checklist manual](docs/checklist-manual.md). Pengujian Windows dan perangkat sentuh fisik belum dilakukan.

## Troubleshooting laptop tim

| Kendala | Langkah pemeriksaan |
| --- | --- |
| `git`, `node`, atau `npm` tidak dikenali | Pasang dari sumber resmi di atas, buka ulang terminal, lalu ulangi pemeriksaan versi. Pastikan terminal memakai instalasi Node 24.19.0 yang dimaksud. |
| Clone menghasilkan `Repository not found` atau gagal autentikasi | Periksa URL, akun GitHub yang sedang aktif, dan undangan collaborator yang sudah diterima. Repositori PRIVATE tidak dapat di-clone tanpa akses. Ikuti autentikasi dalam panduan tim; jangan menempelkan token pada URL. |
| `EBADENGINE` atau pesan versi Node tidak kompatibel | Jalankan `node --version`; gunakan Node 24.19.0 dalam rentang `>=24.15.0 <25`, kemudian ulangi `npm ci`. |
| `npm.ps1 cannot be loaded` pada PowerShell | Gunakan Command Prompt/Git Bash, atau panggil `npm.cmd ci` dan `npm.cmd run dev` dari PowerShell. Tidak perlu mengubah kebijakan keamanan PowerShell sistem. |
| `npm ci`/`npm install` gagal membaca `package.json` | Pastikan terminal sudah berada di folder `dashboard-monitoring-simpul-jaringan-jikn` hasil clone, bukan folder induknya. |
| Lockfile tidak cocok atau konflik peer dependency | Ambil versi branch yang benar dan periksa perubahan `package.json` serta `package-lock.json`. Laporkan pesan error kepada pengelola dependency. Jangan menghapus lockfile atau menambahkan `--force`/`--legacy-peer-deps`. |
| Pemasangan berhenti karena jaringan | Periksa koneksi internet/proxy yang dipakai laptop, lalu ulangi `npm ci`. Hindari menonaktifkan pemeriksaan TLS untuk mengatasi koneksi. |
| Port 5173 sedang dipakai | Ikuti URL baru dari Vite atau jalankan `npm run dev -- --port 5174`. Untuk uji E2E terpisah, gunakan `PLAYWRIGHT_PORT` dengan nomor port kosong; jangan memakai kembali server aplikasi lain. |
| Browser tidak dapat membuka website | Pastikan `npm run dev` masih berjalan, gunakan host dan port **Local** dari terminal, lalu buka `/simpul-jaringan`. `npm run preview` dijalankan setelah build dan biasanya memakai port 4173. |
| Tile peta gagal atau layar awal tidak memuat instansi | Tile membutuhkan koneksi ke provider; gunakan **Daftar** ketika tile gagal. Dataset utama memang kosong. Buka `?demo=1` untuk latihan; jangan menambahkan data contoh sebagai fallback produksi. |
| Playwright tidak menemukan browser | Jalankan `npx playwright install chromium`, lalu ulangi `npm run test:e2e`, atau gunakan Chrome dengan contoh environment sesuai sistem operasi di atas. |

## Kolaborasi empat anggota

Tim terdiri dari **Pranata Komputer 1**, **Pranata Komputer 2**, **Statistisi 1**, dan **Statistisi 2**. Setiap pekerjaan dibuat pada branch tersendiri dan diajukan melalui Pull Request ke `main`, dengan pemeriksaan serta tinjauan anggota lain sebelum digabungkan. Username anggota belum ditetapkan dalam proyek ini; undangan dikirim pemilik setelah identitas akun dikonfirmasi.

Alur singkat dari working tree yang bersih:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/pk1-nama-pekerjaan
```

Setelah mengerjakan perubahan, periksa `git diff`, jalankan lint/typecheck/tes/build yang relevan, stage **file yang memang diubah**, commit, dan push branch. Contoh jika pekerjaan hanya mengubah README:

```sh
git add README.md
git commit -m "docs: perjelas panduan menjalankan proyek"
git push -u origin feature/pk1-nama-pekerjaan
```

Buka repositori pada GitHub dan buat Pull Request dari branch tersebut ke `main`. Sinkronkan branch dengan pembaruan `main` sebelum merge. Jangan melakukan force push atau menimpa pekerjaan anggota lain. Panduan pembagian branch, review, konflik, autentikasi, dan undangan collaborator tersedia di [panduan kolaborasi tim](docs/kolaborasi-tim.md).

## Tahap integrasi berikutnya

Navigasi peta memakai tiga lapisan: **Indonesia → Provinsi → Kabupaten/Kota → Instansi**. Klik provinsi langsung menampilkan kabupaten/kota, lalu klik kabupaten/kota menampilkan instansi berkoordinat tanpa mensyaratkan jenis tertentu. Setiap penanda wilayah memilih satu ID. Pada lapisan instansi, hover tepat pada marker kantor membuka popup profil; klik desktop membuka detail dan tap membuka sheet. Jika koordinat kantor belum tersedia, titik tidak dibuat dan peta menampilkan keterangan. Daftar tetap dibuka melalui tombol Daftar, dengan tautan detail dan tombol Pratinjau profil yang eksplisit. Popup ringkas mengikuti susunan logo, kategori, nama, tiga informasi, Lihat detail, dan Landing Page. Tombol eksternal hanya aktif untuk URL terverifikasi.

Implementasikan adapter baru yang memenuhi kontrak `InstansiRepository`: `getReferenceData`, `listInstansi`, dan `getInstansiDetail`. Adapter dapat memetakan respons REST resmi ke model domain yang sama, mempertahankan null, provenance, definisi metric, dan perilaku query. Titik pemilihan repository berada di `App.tsx`. Komponen peta/detail tetap membaca kontrak yang sama.

Endpoint, autentikasi, dan kebijakan sinkronisasi baru ditentukan setelah dokumentasi API resmi tersedia. Tahun bergabung dari Excel dapat menjadi data pelengkap melalui mapping ID lokal ke ID resmi yang telah diverifikasi. Yang masih diperlukan adalah statistik beserta definisinya, koordinat kantor dari sumber, mapping ID resmi, dan hyperlink Landing Page per instansi. Repository menyediakan `getKabKotaGeometry` opsional untuk aset peta; ini terpisah dari akses data SIKN.

## Pembaruan tampilan 13 Oktober 2026

Header dan peta dirapikan mengikuti tampilan halaman JIKN asli. Toolbar memakai tiga dropdown mandiri tanpa kartu putih besar, tombol Reset berbentuk ikon, dan Daftar tetap menjadi akses tekstual/keyboard. Label dropdown tetap tersedia untuk pembaca layar. Navigasi wilayah memakai tombol kembali yang ringkas, metadata snapshot disatukan di bagian bawah, dan kontrol zoom berada di kanan bawah. Warna cluster mengikuti jumlah marker instansi unik: hijau, kuning, lalu jingga. Latar peta dibuat lebih lembut; data dan perilaku navigasi tetap sama.

Pemeriksaan tampilan tersedia di `tests/e2e/layout-clean.spec.ts` dengan screenshot `tmp/qa/ui-clean-desktop.png` dan `tmp/qa/ui-clean-mobile.png`. Implementasi berada pada `src/components/layout/SiteHeader.tsx`, `src/components/map/MapFilters.tsx`, `src/pages/MapPage.tsx`, serta CSS layout dan peta. Referensi utama diperluas ke nasional pada tahap casefile; demo tetap terpisah.
