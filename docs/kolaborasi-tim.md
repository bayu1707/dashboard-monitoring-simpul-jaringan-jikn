# Panduan kolaborasi tim Dashboard Monitoring JIKN

Panduan ini dipakai empat anggota untuk mengembangkan dashboard yang sama melalui repositori **Public**. Versi aktif Nuxt/Laravel berada di `main`; setiap anggota mempunyai clone dan instalasi dependency sendiri. Pilot berjalan dari snapshot bersama tanpa folder privat, environment rahasia, atau database SSD pengembang awal.

Repositori tim: [bayu1707/dashboard-monitoring-simpul-jaringan-jikn](https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn). Gunakan riwayat commit pada branch `main` untuk memeriksa versi yang sudah di-push.

## Akses dan autentikasi

Semua orang dapat melihat dan clone repository Public tanpa undangan. Untuk mengirim perubahan melalui push, pemilik memberi akses collaborator setelah mendapatkan username GitHub yang benar. Belum ada daftar username atau undangan otomatis dalam proyek. Anggota menerima undangan melalui akun GitHub miliknya sebelum push.

Untuk autentikasi HTTPS, gunakan Git Credential Manager atau GitHub CLI dengan login melalui browser, sesuai [panduan autentikasi resmi GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github). Password akun GitHub tidak digunakan sebagai password Git. Token, password, session, dan cookie tidak disimpan dalam source, URL remote, ataupun dokumen proyek.

Jika memilih GitHub CLI, pasang dari [situs resmi GitHub CLI](https://cli.github.com/), lalu jalankan pada laptop masing-masing:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Ikuti login yang dibuka di browser. Tidak perlu mengirimkan token kepada anggota lain atau ke percakapan. Pilihan `--web` dijelaskan pada [dokumentasi resmi `gh auth login`](https://cli.github.com/manual/gh_auth_login). GitHub CLI bersifat opsional untuk menjalankan dashboard.

## Clone dan mulai bekerja

Pasang Git, Node 24.19.0, PHP 8.4+ dan Composer 2 sesuai [panduan Nuxt/Laravel tanpa database](kolaborasi-tanpa-database.md#prasyarat-laptop-tim), lalu jalankan dari folder pilihan Anda:

```sh
git clone https://github.com/bayu1707/dashboard-monitoring-simpul-jaringan-jikn.git
cd dashboard-monitoring-simpul-jaringan-jikn
```

Ikuti [penyiapan backend](kolaborasi-tanpa-database.md#pemasangan-pertama-backend) dan [frontend](kolaborasi-tanpa-database.md#pemasangan-pertama-frontend) pada dua terminal. Buka `http://127.0.0.1:3000/simpul-jaringan` setelah keduanya aktif. Root `npm run dev` tetap menjalankan React legacy; aplikasi Nuxt dijalankan dari `frontend/`. API resmi vendor SIKN/JIKN belum diintegrasikan dan statistik pilot tetap berlabel DATA SIMULASI.

Jika Git meminta identitas saat commit, atur `user.name` dan `user.email` **pada repositori lokal** menggunakan nama Anda dan email yang terkait dengan akun GitHub atau alamat noreply GitHub Anda. Identitas commit bukan kredensial login.

## Pembagian branch dan tanggung jawab

Pembagian berikut adalah usulan awal dan dapat disepakati ulang. Prefix tidak berisi username serta tidak membatasi siapa yang boleh melakukan review. Buat branch baru per pekerjaan, bukan satu branch yang terus dipakai setelah merge.

| Anggota | Contoh branch | Fokus yang dapat dikoordinasikan |
| --- | --- | --- |
| Pranata Komputer 1 | `feature/pk1-filter-peta` | Komponen peta, filter, query, dan navigasi |
| Pranata Komputer 2 | `feature/pk2-profil-simpul` | Halaman detail, repository, aksesibilitas, dan pengujian |
| Statistisi 1 | `data/stat1-validasi-snapshot` | Definisi metric, kualitas data, provenance, dan validasi snapshot |
| Statistisi 2 | `data/stat2-tren-distribusi` | Cakupan tren/distribusi, interpretasi, serta dokumentasi statistik |

Sebelum mengubah berkas yang sama, sepakati penanggung jawab melalui komunikasi tim atau issue GitHub. Perubahan `package.json`/lockfile, tipe domain, dan dataset referensi berdampak pada banyak komponen; koordinasikan lebih dulu. Statistik sintetis tetap berada pada fixture/demo dan tidak dilabeli sebagai data instansi nyata.

## Alur kerja harian

Mulai dengan working tree bersih; `git status` harus menunjukkan tidak ada perubahan yang belum disimpan. Jika masih ada pekerjaan lokal, commit pada branch pekerjaan yang tepat sebelum berpindah. Jangan memakai reset untuk membuang pekerjaan anggota sendiri atau orang lain.

```sh
git status
git switch main
git pull --ff-only origin main
git switch -c feature/pk1-filter-peta
```

Ganti nama branch contoh sesuai pekerjaan Anda. `git pull --ff-only` memperbarui `main` tanpa membuat merge yang tidak direncanakan; jika gagal karena riwayat menyimpang, tinjau bersama pengelola. Jangan memakai force push untuk melewati kegagalan tersebut.

Kerjakan perubahan dalam cakupan kecil yang mudah ditinjau. Setelah mengambil pembaruan yang mengubah lockfile, hentikan dev server sementara dan jalankan `npm ci`, lalu mulai kembali server.

## Memeriksa, commit, dan push branch

Sebelum commit, periksa hasil perubahan dan jalankan pemeriksaan dari folder proyek:

```sh
git status
git diff
npm run typecheck
npm run lint
npm run validate:data
npm test
npm run build
```

Jalankan `npm run test:e2e` jika perubahan memengaruhi alur peta, popup, detail, atau responsivitas. Ikuti pemasangan browser pada README. Jangan menyertakan `node_modules/`, `dist/`, `.env*` lokal, log, cache, artefak tes, database asli, atau data internal. `.env.example` hanya boleh berisi nilai contoh publik. Folder `public` dapat dibaca browser; data di dalamnya harus boleh dibagikan.

Stage hanya berkas yang terkait pekerjaan. Contoh untuk perubahan dokumentasi:

```sh
git add README.md docs/kolaborasi-tim.md
git diff --cached
git commit -m "docs: perjelas alur kolaborasi tim"
git push -u origin feature/pk1-filter-peta
```

Ganti daftar berkas, pesan commit, dan nama branch sesuai perubahan yang sebenarnya. `git diff --cached` adalah kesempatan meninjau apa yang akan masuk commit. Gunakan pesan yang menjelaskan hasil, misalnya `fix: pulihkan filter saat kembali dari detail` atau `data: dokumentasikan cakupan snapshot resmi`.

## Membuat dan meninjau Pull Request

Buka repositori pada GitHub, pilih **Pull requests → New pull request**, kemudian gunakan **base: main** dan **compare: branch pekerjaan Anda**. Beri judul singkat, penjelasan perubahan, cara menguji, serta keterbatasan data yang relevan. Panduan resmi: [membuat Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

Minta setidaknya satu anggota lain melakukan review sebagai kesepakatan tim. Reviewer memeriksa cakupan, data/metric, perilaku navigasi, akses keyboard, hasil pemeriksaan, serta file yang disertakan. Persyaratan review ini adalah alur yang disarankan; dokumen tidak mengklaim aturan proteksi branch sudah diaktifkan pada GitHub. Perbaikan review di-commit dan di-push ke branch PR yang sama. Pengelola menggabungkan PR setelah pemeriksaan dan review selesai.

Sesudah PR digabungkan:

```sh
git switch main
git pull --ff-only origin main
npm ci
```

Mulai pekerjaan berikutnya dari `main` terbaru dengan nama branch baru.

## Mengambil pembaruan ketika branch pekerjaan belum selesai

Commit pekerjaan lokal terlebih dahulu. Pada branch pekerjaan, gabungkan pembaruan `main` dengan merge agar riwayat branch yang sudah dibagikan tetap dipertahankan:

```sh
git fetch origin
git merge origin/main
```

Jika tidak ada konflik, jalankan kembali pemeriksaan yang relevan dan push branch dengan `git push`. Jangan melakukan rebase atau force push terhadap branch bersama tanpa kesepakatan tim.

## Menangani konflik tanpa menimpa pekerjaan

`git status` menunjukkan berkas yang konflik. Buka setiap berkas, baca kedua perubahan di antara penanda `<<<<<<<`, `=======`, dan `>>>>>>>`, lalu diskusikan maksudnya dengan penulis terkait. Susun hasil akhir yang mempertahankan perubahan yang diperlukan, hapus penanda konflik, dan periksa kembali tampilan/perilakunya. Langkah resmi tersedia pada [panduan konflik GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-using-the-command-line).

Setelah konflik diselesaikan, stage berkas yang benar-benar sudah diperiksa, jalankan tes yang relevan, lalu selesaikan merge:

```sh
git add README.md
git diff --cached
git commit
git push
```

`README.md` hanya contoh nama berkas; gunakan nama berkas konflik Anda. Jangan memilih seluruh versi "ours" atau "theirs" tanpa membaca perubahannya. Jika belum siap menyelesaikan merge, `git merge --abort` membatalkan merge yang baru dilakukan; langkah ini diasumsikan dimulai dari working tree bersih dengan pekerjaan lokal sudah di-commit. Jangan menghapus `.git`, memakai `git reset --hard`, atau force push sebagai jalan pintas.

Untuk konflik dependency, tinjau perubahan `package.json` bersama pengelola terlebih dahulu. Setelah keputusan versi disepakati, perbarui lockfile dengan npm pada Node yang sesuai, lalu pastikan `npm ci` dan pemeriksaan proyek lulus. Jangan menghapus lockfile hanya untuk membuat konflik terlihat hilang.

## Mengundang empat anggota sebagai collaborator

Pemilik membuka repository Public pada GitHub, lalu **Settings → Collaborators → Add people** di bagian **Access**. Cari username yang sudah dikonfirmasi, pilih akun yang tepat, dan kirim undangan untuk hak push. Setiap anggota menerima undangannya pada akun GitHub sendiri sebelum push; clone tidak memerlukan undangan. Visibility Public sudah disetujui pemilik. Langkah ini mengikuti [panduan resmi undangan collaborator](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

Undangan dilakukan pemilik setelah username diberikan; panduan ini tidak mengirim undangan atau menetapkan akun siapa pun. Empat peran dalam tabel adalah pembagian pekerjaan, bukan identitas akun GitHub.

## Batas pemeriksaan lintas sistem

Perintah utama `git clone`, `cd`, `composer install`, `npm ci`, `npm run dev`, build, lint, typecheck, dan tes tidak memerlukan path macOS khusus. Ikuti penyiapan dua terminal pada panduan Nuxt/Laravel. Empat job CI validasi clone/dataset dan Nuxt/Laravel pada Ubuntu serta Windows lulus sebelum PR #4 digabung. Anggota Windows tetap perlu menjalankan checklist lokal; runner CI berbeda dari laptop Windows dan perangkat sentuh fisik.
