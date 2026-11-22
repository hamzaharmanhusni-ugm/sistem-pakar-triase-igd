---
title: Penalaran dan Penjelasan Sistem Pakar Triase IGD
mata_kuliah: Sistem Pakar Lanjut
jenis: dokumentasi
status: final
diperbarui: 2026-11-23
rujukan_materi: [Intro ES, KR-Knowledge-Graphs, SPARQL-Reasoning]
tags: [spl, project-akhir, reasoning, forward-chaining, sparql, penjelasan]
---

# Penalaran dan Penjelasan Sistem Pakar Triase IGD

Lanjutan dari [Representasi Pengetahuan](<01 - Representasi Pengetahuan.md>). Dokumen ini menjelaskan bagaimana mesin inferensi menurunkan kesimpulan baru dari fakta dan aturan, serta bagaimana alasan di balik setiap kesimpulan ditampilkan. Istilah mengikuti materi *Querying and Reasoning with SPARQL* dan *Intro ES*.

## 1. Tiga cara memperoleh jawaban implisit

Materi SPARQL menyebut tiga cara memperoleh jawaban yang hanya tersirat. Proyek ini memakai ketiganya, masing-masing untuk tujuan yang jelas:

| Cara (materi) | Penerapan di proyek | Untuk apa |
| --- | --- | --- |
| *Entailment regime*: mesin menerapkan semantik | GraphDB dengan ruleset OWL 2 RL | Subclass, equivalentClass, hasValue, TransitiveProperty dimaterialisasi otomatis |
| *Query rewriting*: penalaran saat query (property path) | `ex:dependsOn+` saat menyusun penjelasan | Menelusuri rantai alasan tanpa materialisasi |
| *Rules*: CONSTRUCT/INSERT, forward chaining, materialisasi | 16 aturan `INSERT {head} WHERE {body}` di `kb/rules/` | Pengetahuan pakar ESI yang tidak dapat dinyatakan OWL (angka, ambang, hitungan, negasi) |

Pembagian ini sama dengan slide "a practical combination" di materi: OWL untuk terminologi, mesin OWL RL untuk konsekuensi rutin, aturan SPARQL untuk pemeriksaan dunia tertutup, hitungan, dan peringatan, lalu SPARQL untuk pertanyaan akhir.

## 2. Aturan IF-THEN sebagai SPARQL

Materi menegaskan bahwa `INSERT {head} WHERE {body}` adalah aturan IF-THEN: `WHERE` adalah badan aturan (IF) dan templat `INSERT` adalah kepala aturan (THEN). Contoh aturan D01:

```sparql
# IF nilai tanda vital melewati ambang danger zone untuk kelompok usia pasien
# THEN kasus termasuk DangerZoneCase, dan catat alasannya
INSERT {
  ?case a ex:DangerZoneCase .
  ?inf a ex:Inference ; ex:usedRule ex:Rule_D01 ; ex:aboutCase ?case ;
       ex:concluded ex:DangerZoneCase ; prov:used ?t ; ex:reason ?why .
}
WHERE {
  ?case a ex:TriageCase ; ?p ?val .  ?p ex:measures ?vital .
  ?t a ex:DangerZoneThreshold ; ex:onVital ?vital ; ex:forAgeGroup ?g ;
     ex:comparator ?cmp ; ex:limit ?lim .
  ?g ex:minMonths ?lo ; ex:maxMonths ?hi .
  FILTER(?months >= ?lo && ?months < ?hi)
  FILTER((?cmp = "gt" && ?val > ?lim) || (?cmp = "lt" && ?val < ?lim))
}
```

Aturan ini generik: ambang dicari dari graph sesuai kelompok usia, bukan ditulis di kode. Daftar lengkap 16 aturan:

| Decision Point ESI | Aturan | Kesimpulan |
| --- | --- | --- |
| A: butuh penyelamatan nyawa | A01 temuan mengancam nyawa · A02 SpO2 < 90% · A03 AVPU = P/U | ESI 1 |
| B: risiko tinggi | B01 situasi risiko tinggi · B02 bingung baru / AVPU = V · B03 nyeri ≥ 7 · B04-B05 demam bayi < 3 bulan · F01 qSOFA ≥ 2 | ESI 2 |
| C: jumlah jenis resource | C00 perkiraan resource dari keluhan (pengguna awam) · C01 bobot resource · C02 demam anak 3 bulan-3 tahun | ESI 3, 4, atau 5 |
| D: danger zone | D01 tanda vital melewati ambang usia · E01 uptriage | naik ke ESI 2 |
| Resolusi | Z01 kandidat paling akut · G01 peringatan shock index | ESI akhir, peringatan |

## 3. Forward chaining sampai titik tetap

Materi menggambarkan forward chaining sebagai siklus *recognise-act* sistem produksi dengan SPARQL sebagai pencocok: ulangi sampai tidak ada yang berubah. Implementasinya di `app/engine.py`:

1. Agenda aturan (urutan prioritas dan berkas SPARQL) **dibaca dari graph**, bukan ditulis di kode.
2. Setiap siklus menjalankan semua aturan. Di GraphDB, aturan satu siklus dikirim sebagai satu permintaan SPARQL Update yang dipisah `;`, sesuai konsep *rule set* di materi.
3. Bila jumlah triple tidak bertambah, titik tetap tercapai.
4. Setelah titik tetap, aturan Z01 memilih kandidat ESI paling akut (resolusi konflik).

Tabel siklus untuk kasus anak 2 tahun, demam 39,4 °C, nadi 170 (mengikuti format tabel *fixpoint* di materi):

| Siklus | Aturan terpicu | Triple baru | Jumlah triple kasus |
| --- | --- | --- | --- |
| Awal | Working memory | 8 | 8 |
| 1 | D01 (+7), C00 (+10), C01 (+8), C02 (+5) | +30 | 38 |
| 2 | E01 (+8), bergantung pada C01 dan D01 | +8 | 46 |
| 3 | Tidak ada | +0 | 46: **titik tetap** |
| Resolusi | Z01 (+7) | +7 | 53 → ESI 2 |

Di backend GraphDB, reasoner OWL 2 RL ikut menambah triple implisit, misalnya `:Pasien a :DangerZoneVisit` dari `owl:equivalentClass`. Panel "Siklus inferensi" menampilkannya sebagai langkah tersendiri.

## 4. Jebakan forward chaining dan cara mengatasinya

Materi SPARQL mendaftar empat jebakan aturan. Penanganannya di proyek:

| Jebakan (materi) | Risiko | Penanganan |
| --- | --- | --- |
| Tidak berhenti (node baru terus dibuat) | Siklus tak berujung | IRI node `ex:Inference` dibentuk deterministik dari IRI kasus + ID aturan, sehingga aturan yang sama tidak membuat node baru di siklus berikutnya |
| Urutan dan negasi (stratifikasi) | Hasil bergantung urutan | Satu-satunya negasi (`FILTER NOT EXISTS` di C00) hanya memeriksa penanda yang ditulis C00 sendiri; Z01 dijalankan terpisah setelah titik tetap |
| Kesimpulan basi (truth maintenance) | Fakta lama tetap ada setelah jawaban diubah | Working memory dihitung ulang dari awal setiap kali, lalu dihapus |
| Tidak ada semantik standar | Hasil berbeda antar mesin | Uji paritas: GraphDB dan rdflib wajib memberi level ESI dan aturan terpicu yang sama |

## 5. Fasilitas penjelasan

Materi *Intro ES* menempatkan penjelasan langkah demi langkah sebagai keunggulan sistem pakar dibanding model kotak hitam. Materi KR menyebut metaknowledge "aturan mana yang menurunkan sebuah fakta" sebagai anotasi pada triple. Proyek ini mewujudkannya dengan node PROV-O:

```turtle
:Pasien_inf_E01 a ex:Inference ;           # ex:Inference rdfs:subClassOf prov:Activity
    ex:usedRule ex:Rule_E01 ;
    ex:aboutCase :Pasien ;
    ex:concluded ex:ESI_2 ;
    ex:dependsOn :Pasien_inf_C01 , :Pasien_inf_D01_DZ_HR_3m_3y ;
    ex:reason "Danger zone pada kasus dengan kandidat ESI 3: naikkan ke ESI 2" .
```

Dua jenis penjelasan klasik sistem pakar:

| Jenis | Pertanyaan | Cara menjawab |
| --- | --- | --- |
| **HOW** | Mengapa hasilnya ESI 2? | Dari node Z01, telusuri `ex:dependsOn+` (property path, penalaran saat query) sampai fakta masukan; setiap node membawa aturan, fakta yang digunakan (`prov:used`), alasan, dan sumber |
| **WHY** | Mengapa sistem menanyakan ini? | Setiap pertanyaan `ex:Question` menunjuk aturan yang membutuhkannya melalui `ex:neededBy`; mode dialog perawat menampilkannya pada tombol "Mengapa ditanyakan?" |

Penjelasan disajikan dalam dua lapis bahasa:

- **Untuk pasien**: alasan awam yang disusun dari jejak aturan dan fakta, misalnya "Denyut nadi 170 kali per menit, lebih cepat dari batas aman untuk usia 2 tahun (paling tinggi 160)".
- **Untuk pengajar dan mahasiswa**: laci "Detail teknis" berisi alur Decision Point A-D, working memory, jejak aturan (IF-THEN, fakta, sumber, SPARQL, triple baru), pemutar siklus inferensi, dan katalog basis aturan.

## 6. Peran LLM

Materi *Intro ES* menyebut masa depan sistem pakar sebagai sistem hibrida: komponen yang dipelajari ditambah jejak aturan dan antarmuka bahasa alami. Proyek ini mengikuti pola tersebut dengan batas tegas:

| Tugas | Pelaksana |
| --- | --- |
| Mengenali keluhan teks bebas menjadi ID temuan di KG | Claude API (bila aktif), selain itu pengenal lokal dari sinonim `skos:altLabel` |
| Menentukan level ESI | **Hanya aturan sistem pakar** |
| Menulis narasi penjelasan | Claude API dari jejak aturan (tanpa menambah fakta), selain itu templat |

## 7. Bentuk query SPARQL yang digunakan

| Bentuk (materi) | Penggunaan |
| --- | --- |
| `SELECT` | Katalog aturan, pertanyaan dialog, ringkasan hasil, jejak penjelasan |
| `ASK` / `COUNT` | Pemeriksaan titik tetap (jumlah triple kasus) |
| `CONSTRUCT` | Mengambil triple kasus dari GraphDB untuk menampilkan triple baru per siklus |
| `INSERT ... WHERE` | 16 aturan |
| `DELETE ... WHERE` | Menghapus working memory setelah konsultasi |
| `INSERT DATA` / unggah Turtle | Memuat fakta pasien dan basis pengetahuan |

## 8. Verifikasi

`python -m pytest -q` menjalankan 52 tes: 23 kasus emas aturan (termasuk batas ambang: nadi tepat 100, usia tepat 36 bulan), uji urutan siklus (D01 sebelum E01, Z01 terakhir), uji transitivitas `moreAcuteThan`, uji SHACL, 8 uji paritas GraphDB dan rdflib, uji dialog, dan 6 uji end-to-end Playwright.
