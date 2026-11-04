# Uji database SIKN lokal melalui Laravel

Mode ini membuktikan alur **salinan PostgreSQL → adapter Laravel → API dashboard → Nuxt → popup/detail peta**. Ini bukan integrasi API vendor, bukan sinkronisasi langsung dengan server SIKN, dan belum disiapkan untuk publikasi.

## Membuka percobaan

Ketika salinan inspeksi PostgreSQL, Laravel di `127.0.0.1:8000` dan Nuxt di `127.0.0.1:3000` sudah aktif, buka:

```text
http://127.0.0.1:3000/simpul-jaringan?data=sikn
```

Cari **Arsip Nasional RI**. Hasil pencarian atau hover marker membuka popup; Lihat detail membuka profil dengan sumber database yang sama. Filter, reset, kembali ke peta, dan tautan logo mempertahankan `data=sikn`.

Tanpa parameter tersebut, aplikasi tetap menggunakan pilot dengan label **DATA SIMULASI**. `?data=excel` dan `?demo=1` tetap terpisah.

## Apa yang dibaca

- Identitas/tahun: katalog Excel yang ada. ID lokal tidak diganti oleh ID numerik database.
- Koordinat kantor dan wilayah: hasil kurasi sebelumnya, termasuk keterbatasan per record; tidak diganti otomatis oleh kontak database lama. Referensi tetap 38 provinsi/514 kabupaten-kota.
- Statistik: hanya untuk pasangan unik kode + nama yang dinormalisasi. Alias ANRI diterima berdasarkan tautan resmi yang sebelumnya dikonfirmasi pengguna. Nama mirip atau kode duplikat saja tidak cukup. Pencocokan diperiksa ulang terhadap identitas database setiap request.
- Instansi yang belum cocok tetap tersedia; statistik `null`, bukan angka simulasi. Nilai nol hasil hitungan ditampilkan sebagai `0`.
- Email/telepon detail: satu kontak utama aktif dari instansi yang identitasnya sudah cocok, atau satu baris kontak aktif yang unik jika tidak ada penanda utama. Tidak menggabungkan baris berbeda. Kontak ambigu/kosong/tidak valid tetap null; sumber Maret 2026 dan kebutuhan verifikasi publik ditampilkan di profil. Lihat [aturan kontak instansi](kontak-instansi.md).

Definisi sementara yang harus disepakati dengan vendor:

| Field kontrak | Label mode database | Hitungan |
|---|---|---|
| `jumlahArsip` | Deskripsi arsip | ID deskripsi unik semua level, deskripsi dan relasi instansi tidak dihapus; tanpa filter publikasi |
| `penciptaArsip` | Entitas terkait | ID entitas unik nondeleted pada relasi deskripsi terhitung; peran pencipta belum dikonfirmasi |
| `kopiDigital` | Metadata objek digital | ID metadata objek digital unik nondeleted; tidak membuktikan file fisik dapat dibuka |

Query memakai parameter terikat, `DISTINCT`, soft-delete pada parent/relasi/anak, transaksi read-only, connect timeout 3 detik dan statement timeout 8 detik. Agregasi hanya dijalankan ketika detail diminta, tidak untuk setiap marker saat katalog dimuat. Tren, distribusi, rincian pencipta dan total nasional tetap kosong; `created_at` impor tidak dianggap tahun bergabung atau tren input arsip.

## Konfigurasi privat

Adapter membaca `.local/sikn-poc/config.json` dan `crosswalk.json` hanya dalam mode uji. Keduanya diabaikan Git. Jangan memindahkannya ke `public`, mengunggah database, atau memasukkan kredensial ke Nuxt.

Konfigurasi berisi: `enabled`, `host` (hanya `127.0.0.1`), `port`, `database`, `username`, `credentialFile`, `sourceId`, `capturedAt`, `referenceDate`. `credentialFile` menunjuk berkas privat berformat objek JSON dengan field `password`. Jangan menaruh password pada URL atau perintah terminal yang dibagikan.

`crosswalk.json` berformat `{"mappings":[{"localId":"…","siknUuid":"…","matchBasis":"kode-dan-nama-sama"}]}`. Entri ganda atau target UUID ganda ditolak. Peta tidak otomatis menambahkan seluruh repository database yang tidak ada di katalog Excel.

Mode ini hanya diizinkan pada environment Laravel `local`/`testing` dan request loopback. Koneksi menolak superuser dan akun yang default transaksi read-only-nya tidak aktif. Akun salinan inspeksi diberi SELECT terbatas, tanpa akses tabel pengguna. API mengeluarkan field katalog, angka agregat, serta email/telepon kontak instansi saat detail diminta. Tidak mengambil kolom nama/contact_person atau kontak akun pengguna, isi arsip, HTML landing page, token, atau path file digital. Penanda kontak utama belum membuktikan email/nomor tersebut merupakan kontak kantor yang diizinkan untuk publikasi; perlu pemeriksaan tim sebelum dirilis ke masyarakat.

Jika SSD/server/config tidak tersedia, API mengembalikan **503 `SIKN_LOCAL_UNAVAILABLE`**, tanpa DSN atau pesan driver. UI menyediakan retry dan kembali ke pilot, tanpa mengganti sumber secara diam-diam. Jangan membuka mode ini ke jaringan publik melalui proxy/tunnel; pembatasan loopback bukan autentikasi produksi.

Salinan inspeksi dan kredensial saat ini dibuat untuk sesi analisis lokal. Setelah restart/eject SSD, salinan harus dipasang dan PostgreSQL inspeksi diaktifkan kembali dengan pengaturan baca-saja. Clone tim tidak otomatis membawa database maupun konfigurasi privat ini.

## File utama

- `backend/app/Repositories/DashboardRepository.php`: pemilihan adapter, pencocokan identitas, penggabungan katalog dan statistik.
- `backend/app/Services/PostgresSiknSource.php`: query allowlist PostgreSQL.
- `backend/app/Services/SiknLocalConfig.php`: konfigurasi privat.
- `frontend/app/services/apiRepository.ts` dan `composables/useInstansiRepository.ts`: mode sumber REST.
- `frontend/app/components/instansi/InstansiPopup.vue` dan `StatisticCards.vue`: label statistik database.

## Pengujian

Jalankan `composer test` dan `composer lint` di `backend`. Di `frontend`, jalankan `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` dan `npm run test:e2e`.

Pengujian browser database nyata sengaja opt-in dan tidak diwajibkan pada CI/clone:

```sh
SIKN_LOCAL_TEST=1 npm run test:e2e -- tests/e2e/sikn-local.spec.ts
```

Tes tersebut memakai PostgreSQL dan Laravel sebenarnya, dengan tile fixture agar tidak mengunduh banyak tile. Pengecekan visual terpisah dapat menggunakan peta dasar asli. Tes SQL unit memakai SQLite fixture, bukan database pengguna; memeriksa duplikasi relasi, soft-delete, isolasi instansi dan nilai nol. Tes backend juga memeriksa pasangan ambigu, `null`, konfigurasi hilang, koneksi gagal, dan larangan akses non-loopback.

## Sebelum integrasi produksi

Konfirmasi kontrak API vendor, izin publikasi, arti status publikasi dan entitas pencipta, level hitungan arsip, pemetaan UUID yang belum cocok, autentikasi, cache/versi data, serta akses media. Adapter API resmi nanti dapat menggantikan pembaca salinan tanpa membuat ulang peta. Tahun bergabung tetap berasal dari Excel sampai sumber resmi menyediakan field tersebut.
