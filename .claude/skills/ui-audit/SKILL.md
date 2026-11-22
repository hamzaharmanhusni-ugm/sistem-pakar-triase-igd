---
name: ui-audit
description: Alur wajib audit dan perbaikan tampilan aplikasi "Perlu ke IGD?" (folder web/). Gunakan setiap kali mengubah UI, sebelum demo atau presentasi kelas, atau ketika pengguna mengeluh tampilan aneh, kaku, membingungkan, atau terlihat seperti AI slop. Menangkap layar di ukuran laptop dan HP, menjalankan agent ux-auditor, memperbaiki temuan, lalu memverifikasi ulang.
---

# Audit UI/UX "Perlu ke IGD?"

Pengguna utama aplikasi adalah **pasien atau keluarga (orang awam)**. Mode "Detail teknis" untuk presentasi kuliah adalah lapisan kedua yang tertutup secara bawaan.

## Langkah

1. **Jalankan server** (bila belum): `.venv/Scripts/python -m uvicorn app.main:app --port 8000`.
2. **Tangkap layar** semua tahap di empat ukuran:
   `.venv/Scripts/python tools/capture.py` → `.impeccable/review/<viewport>-<NN>-<layar>.png`
   (laptop-1280, laptop-1366, laptop-1536, mobile-390). Skenario bawaan logis: orang tua mengisi untuk anak 2 tahun.
3. **Audit** dengan agent `ux-auditor` (subagent baru, tanpa riwayat percakapan). Berikan: folder tangkapan layar, `web/`, `PRODUCT.md`, dan permintaan pengguna terakhir apa adanya. Bila tipe agent belum terdaftar di sesi, jalankan agent umum dan minta ia membaca `.claude/agents/ux-auditor.md` sebagai perannya.
4. **Perbaiki** semua temuan P1 dan P2 dalam satu batch. P3 boleh ditunda dengan alasan.
5. **Verifikasi**: tangkap ulang (langkah 2), periksa sendiri berkas yang terkait temuan, lalu jalankan `.venv/Scripts/python -m pytest -q`. Maksimal dua putaran audit; setelah itu laporkan sisa temuan kepada pengguna.

## Pelajaran yang sudah terjadi (jangan diulang)

| Kesalahan | Aturan |
| --- | --- |
| "Saya sendiri" lalu usia 2 tahun | Isi sendiri: usia hanya tahun, minimal 12 tahun; anak lewat "Anak saya" (satuan tahun/bulan/hari). |
| ID teknis (`DZ_HR_3m_3y`) tampil di layar hasil pasien | Layar pasien hanya memakai `layText` aturan dan label awam. |
| Kartu 640px mengambang di laptop dengan ruang kosong besar | Desain dan tangkap layar wajib di 1280, 1366, 1536; bukan hanya 1440. |
| Tampilan klinis/teknis untuk awam ("lembar triase", SPARQL di depan) | Detail teknis di panel tertutup yang dapat diciutkan. |
| Gradien ungu, glass, kartu generik | Lihat daftar "AI slop" di `.claude/agents/ux-auditor.md`. |
| Screenshot diambil saat animasi belum selesai | Tunggu animasi (≥ 700 ms) sebelum menangkap layar. |
| "Saya sendiri" terpilih bawaan, orang tua bingung | Tidak ada pilihan persona bawaan; tiga opsi: Saya sendiri, Anak saya, Orang lain (dewasa). |
| Tanda risiko tinggi di bawah keluhan umum (risiko under-triage) | Kelompok "Perlu perhatian segera" selalu di atas, disaring per usia. |
| `.app { overflow: hidden }` mematikan tombol sticky | Gunakan `overflow: clip`; tombol sticky berlatar pekat agar tidak menimpa konten. |
| Laci teknis menutup tombol 119 | Laci mulai di bawah header; 119 tidak boleh tertutup elemen apa pun. |
| Skala nyeri 0-10 untuk balita | Anak < 4 tahun memakai skala perilaku (tenang/rewel/menangis terus). |
| Alasan hasil memuat ID/istilah teknis | Alasan awam disusun ulang dari fakta (nadi, suhu, usia); kode aturan hanya di panel teknis. |

## Selesai bila

- Tidak ada temuan P1 dari `ux-auditor`.
- Semua tes lulus.
- Tangkapan layar terbaru di `.impeccable/review/` dan salinan pilihan di `docs/screenshots/`.
