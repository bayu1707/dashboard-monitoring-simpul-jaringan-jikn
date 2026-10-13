# Lapisan data

Komponen membaca data melalui `src/services/localRepository.ts`; jangan mengimpor JSON langsung ke komponen.

- `public/data/references.json`: ID/nama wilayah dan geometri yang bersumber sah, taksonomi produksi.
- `public/data/snapshot.json`: dataset utama kosong sampai snapshot publik terverifikasi tersedia.
- `public/data/import-template.json`: bentuk impor awal yang sengaja kosong.
- `public/data/raw/`: salinan impor mentah dengan nama sumber dan waktu pengambilan; jangan menimpanya dengan hasil normalisasi.
- `public/demo/`: data sintetis terpisah, hanya aktif melalui `?demo=1`. Seluruh UI menampilkan DATA DEMO.

Domain, relasi, kategori, koordinat, tanggal, tahun bergabung dan metric diperiksa sebelum data diberikan ke UI. Kesalahan duplikasi menyertakan ID dan sumber; tidak digabungkan berdasarkan nama.
