---
title: Asal Pengetahuan (Buku dan Data)
mata_kuliah: Sistem Pakar Lanjut
jenis: dokumentasi provenance
versi_ontologi: "2.2"
tags: [spl, project-akhir, provenance, akuisisi-pengetahuan]
---

# Asal Pengetahuan: dari Buku dan Data CSV

Dokumen ini menunjukkan **dari mana setiap bagian pengetahuan diambil**: halaman buku pedoman ESI untuk aturan dan konsep klinis, serta kolom dan rumus data CSV MC-MED untuk bukti statistik. Tujuannya agar setiap isi knowledge graph dapat dicek ulang ke sumber aslinya.

## 1. Berkas pendamping

| Berkas | Isi | Di Git |
| --- | --- | --- |
| `data/sumber/Gilboy 2012 ESI Handbook - beranotasi.pdf` | Salinan buku ESI v4 dengan **stabilo** pada kalimat sumber setiap aturan dan **komentar** berisi aturan serta IRI knowledge graph terkait. Halaman terakhir berisi peta stabilo | Tidak (folder `data/`) |
| `data/processed/MC-MED Data Kunjungan IGD.xlsx` | Data CSV dalam bentuk Excel, sheet Ringkasan ESI menghitung ulang setiap angka bukti dengan rumus | Tidak (lisensi PhysioNet) |
| `tools/anotasi_sumber.py` | Skrip pembuat PDF beranotasi; daftar jangkar (halaman, kalimat, aturan) ada di dalamnya | Ya |
| `tools/visits_to_excel.py`, `kb/build_evidence.py` | Skrip pembuat Excel dan statistik bukti | Ya |

**Cara membaca PDF beranotasi.** Buka dengan pembaca PDF apa pun (Adobe Reader, Edge, Foxit). Warna stabilo menunjukkan kelompok: merah = Decision Point A, oranye = B, biru = C, hijau = D, ungu = model pasien atau pendukung. Arahkan kursor atau klik stabilo untuk membaca komentarnya. Nomor halaman sama dengan PDF asli.

PDF asli tetap di `Thesis Preparation/01 - Naskah Proposal/Rujukan Proposal Revisi-15/19 - Gilboy 2012 - ...pdf` dan tidak diubah.

## 2. Pengetahuan dari buku ESI (Gilboy dkk., 2012)

Nomor halaman adalah nomor halaman PDF (bukan nomor yang tercetak di kaki halaman).

### 2.1 Aturan

| Aturan | Isi aturan | Halaman PDF | Kalimat sumber (ringkas) |
| --- | --- | --- | --- |
| A01 | Temuan penyelamatan nyawa → ESI 1 | 18 | "intubated, apneic, pulseless, severe respiratory distress" |
| A02 | SpO2 < 90 → ESI 1 | 18 | "SpO2 < 90 percent" |
| A03 | AVPU P atau U → ESI 1 | 19 | "AVPU (alert, verbal, pain, unresponsive)" |
| B01 | Situasi risiko tinggi → ESI 2 | 21, 31-34 | Daftar contoh risiko tinggi dan Tabel 3-1 |
| B02 | Bingung, letargi, disorientasi baru → ESI 2 | 26 | "new onset confusion, lethargy, or disorientation" |
| B03 | Nyeri ≥ 7/10 → ESI 2 | 20 | "Is the patient in severe pain or distress?" |
| B04 | Usia 1-28 hari, suhu > 38,0 °C → minimal ESI 2 | 17 | "1 to 28 days of age: assign at least ESI 2" |
| B05 | Usia 1-3 bulan, suhu > 38,0 °C → pertimbangkan ESI 2 | 17 | "1-3 months of age: consider assigning ESI 2" |
| B06 | Cedera kepala + risiko perdarahan → ESI 2 | 20 | "age and past medical history influence ... determination of risk" (prinsip umum; kombinasi spesifik perlu validasi pakar) |
| B07 | Demam + imunokompromais → ESI 2 | 21, 31 | "on chemotherapy and therefore immunocompromised, with a fever"; "post-organ transplant are immunocompromised" |
| B08 | Nyeri perut + usia ≥ 65 → ESI 2 | 27, 32 | "a frail elderly patient with severe abdominal pain is at a much higher risk"; contoh perempuan 88 tahun di Tabel 3-1 (ambang 65 tahun perlu validasi pakar) |
| B09 | Nyeri perut + hamil atau mungkin hamil → ESI 2 | 21, 33 | "A rule-out ectopic pregnancy"; contoh hamil 8 minggu di Tabel 3-1 |
| B10 | Muntah atau diare + diabetes → ESI 2 | 29 | "at risk for diabetic ketoacidosis" |
| B11 | Sakit kepala mendadak → ESI 2 | 20 | "worst headache of my life" |
| B12 | Nyeri dada + faktor risiko jantung → ESI 2 | 28 | "Chest pain is also a very common chief complaint", "high risk for cardiac ischemia" (perlu validasi pakar) |
| C00 | Perkiraan resource untuk pengisian awam | 39-41 | Tabel 4-1 dan contoh pasien ESI 3-5 di Tabel 4-2 |
| C01 | Jumlah jenis resource → ESI 3/4/5 | 39 | "differentiated by the nurse's determination of how many different resources" |
| C02 | Usia 3 bulan-3 tahun dengan demam tinggi → ESI 3 | 17 | "3 months to 3 yrs of age: consider assigning ESI 3" |
| D01 | Tanda vital di danger zone | 17, 112 | "Consider uptriage to ESI 2 if any vital sign criterion is exceeded"; tabel ambang pada bagan algoritma |
| E01 | Danger zone → naikkan ke ESI 2 | 43 | "must strongly consider up-triaging the patient from a level 3 to a level 2" |
| Z01 | Pilih kandidat paling akut | 17 | Algoritma berurutan: "the triage process is complete" bila Decision Point terpenuhi |

### 2.2 Konsep dan data di `knowledge.ttl`

| Bagian knowledge graph | Diambil dari | Halaman PDF |
| --- | --- | --- |
| Level ESI 1-5 dan Decision Point A-D (`ex:ESI_*`, `ex:DP_*`) | Bagan algoritma ESI v4 | 17, 112 |
| 9 ambang danger zone (`ex:DZ_*`) dan kelompok usia (`ex:Age_*`) | Tabel danger zone pada bagan algoritma | 112 |
| 6 temuan Decision Point A (`ex:LifeSavingIndicator`) | Kriteria intervensi penyelamatan nyawa | 18 |
| 25 situasi risiko tinggi (`ex:HighRiskSituation`) | Contoh risiko tinggi Bab 2 dan Tabel 3-1 | 21, 27-34 |
| 8 resource dan 4 non-resource (`ex:Res_*`, `ex:NR_*`) | Tabel 4-1 | 39-40 |
| Penanda `ex:Risk_Hyperkalemia` pada cuci darah | "Hyperkalemia might be suspected in any renal dialysis patient" | 29 |
| Model pasien v2.2 (riwayat, obat, penanda risiko) | Prinsip "age and past medical history influence ... risk" | 20, 27 |

## 3. Pengetahuan dari sumber lain

| Bagian | Sumber | Keterangan |
| --- | --- | --- |
| F01 qSOFA (napas ≥ 22, TD sistolik ≤ 100, perubahan kesadaran) | Singer dkk. 2016, *JAMA* (Sepsis-3) | Buku ESI hanya menyebut sepsis sebagai risiko tinggi (hal. 29); kriterianya dari Sepsis-3 |
| G01 shock index ≥ 1,0 | Allgöwer dan Burri 1967 | Peringatan saja, tidak mengubah ESI |
| G02 jendela 4,5 jam | Powers dkk. 2019 (AHA/ASA) | Buku ESI menyebut pentingnya waktu onset (hal. 29); angka 4,5 jam dari pedoman stroke |
| Kode ICD-10 pada riwayat (`skos:notation`) | Klasifikasi WHO ICD-10 | Kode blok, mis. E10-E14 untuk diabetes |

## 4. Pengetahuan hasil rancangan (bukan kutipan langsung)

Bagian berikut disusun oleh pengembang dari prinsip di buku, sehingga **perlu ditinjau pakar** sebelum penggunaan klinis. Aturan terkait juga diberi `skos:editorialNote "Perlu validasi pakar klinis"`.

| Bagian | Alasan disusun |
| --- | --- |
| `ex:typicalResource` (resource khas per keluhan, untuk C00) | Orang awam tidak dapat memperkirakan resource; perkiraan disusun dari contoh Tabel 4-1 dan 4-2 |
| Pemetaan riwayat dan obat ke penanda risiko (`ex:riskFlag`) | Agar aturan membaca satu penanda, bukan daftar penyakit |
| Ambang usia 65 tahun (B08) | Buku menyebut "elderly" tanpa angka |
| Kategori onset (`ex:Onset_*`) dan wilayah tubuh (`ex:Region_*`) | Pilihan formulir; batas 4,5 jam mengikuti G02 |
| Sinonim bahasa Indonesia (`skos:altLabel`) | Bahasa sehari-hari pasien untuk pengenalan teks bebas |
| Kalimat awam (`ex:layText`, `ex:layAdvice`) | Terjemahan ringkas kriteria untuk pasien |

## 5. Pengetahuan dari data CSV (MC-MED)

Sumber: `data/raw/mc-med-1.0.0/visits.csv` (118.385 kunjungan, PhysioNet). Hasilnya hanya angka agregat di `kb/evidence.ttl`. Setiap baris di bawah dapat dicek ulang pada sheet **Ringkasan ESI** di Excel.

| Individu di `evidence.ttl` | Kolom CSV yang dibaca | Rumus | Nilai |
| --- | --- | --- | --- |
| `ex:Ev_ESI_1` sampai `ex:Ev_ESI_5`: `ex:visits` | `Triage_acuity` | Jumlah baris per angka depan `Triage_acuity` (1-5) | 1.066 / 27.880 / 77.259 / 10.973 / 680 |
| `ex:admitRate` | `ED_dispo` | Proporsi `ED_dispo` = Inpatient atau ICU | 85,4% / 49,1% / 22,3% / 2,1% / 1,3% |
| `ex:criticalRate` | `ED_dispo`, `DC_dispo` | Proporsi `ED_dispo` = ICU atau `DC_dispo` = Expired | 58,1% / 7,1% / 0,8% / 0,1% / 0,0% |
| `ex:Ev_D01_yes`, `ex:Ev_D01_no` | `Triage_acuity`, `Triage_HR`, `Triage_RR`, `Triage_SpO2` | Pasien ESI 3-5, danger zone bila nadi > 100, napas > 20, atau SpO2 < 92 | Ya: 17.239 kunjungan, 29,8% dirawat, 1,34% kritis. Tidak: 71.673, 17,2%, 0,60% |

**Kegunaan di sistem.** Angka per level ESI ditampilkan sebagai bukti di layar hasil ("dari 27.880 kunjungan ESI 2, 49% dirawat inap"). Perbandingan danger zone ya dan tidak menjadi **dasar empiris aturan E01**: pasien ESI 3-5 dengan tanda vital di danger zone lebih sering dirawat (29,8% dibanding 17,2%).

**Yang tidak diambil dari CSV.** Aturan dan ambang tidak dipelajari dari data; semuanya dari buku dan pedoman. Data hanya digunakan sebagai bukti pendukung dan bahan validasi. Ini sesuai prinsip sistem pakar: pengetahuan berasal dari pakar, bukan dari pola statistik.

## 6. Ringkasan

| Asal | Bagian knowledge graph | Cara memeriksa |
| --- | --- | --- |
| Buku ESI (Gilboy 2012) | 21 aturan (semua kecuali F01, G01, G02), level ESI, ambang, temuan, resource | PDF beranotasi: cari stabilo sesuai aturan |
| Pedoman lain (Sepsis-3, shock index, AHA/ASA, ICD-10) | F01, G01, G02, kode riwayat | Rujukan di `dcterms:source` setiap aturan |
| Rancangan pengembang | Resource khas, penanda risiko, ambang 65 tahun, sinonim, kalimat awam | Ditandai "perlu validasi pakar" |
| Data CSV MC-MED | Statistik di `evidence.ttl` | Sheet Ringkasan ESI pada Excel |
