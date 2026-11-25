---
title: Perlu ke IGD - Sistem Pakar Triase
emoji: 🚑
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 6.32.0
app_file: space_app.py
python_version: "3.12"
short_description: Sistem pakar triase IGD (ESI v4) dengan knowledge graph
license: mit
---

# Perlu ke IGD? Sistem Pakar Triase IGD

Sistem pakar triase Instalasi Gawat Darurat berbasis **Emergency Severity Index (ESI) versi 4**: knowledge graph OWL/RDF, 24 aturan IF-THEN bersumber dari pedoman, penalaran *forward chaining*, dan penjelasan setiap kesimpulan.

- **Mode perawat:** formulir triase lengkap, hasil level ESI 1-5, serah terima SBAR.
- **Mode pasien atau keluarga:** pertanyaan sederhana, hasil berupa saran tindakan.
- **Penjelasan AI (Claude):** menjelaskan hasil dari jejak aturan dan knowledge graph. Level ESI tetap diputuskan aturan, bukan AI. Kuota gratis dibatasi per hari; setelah habis, pengunjung dapat memasukkan kunci API Claude sendiri.

> Aplikasi pendidikan, bukan alat diagnosis. Dalam keadaan darurat, telepon 119.

Kode sumber dan dokumentasi: https://github.com/hamzaharmanhusni-ugm/sistem-pakar-triase-igd

Project akhir mata kuliah Sistem Pakar Lanjut, Magister Kecerdasan Artifisial, FMIPA Universitas Gadjah Mada.
