# Versi ringkas: triase pasien dewasa berdasarkan tanda vital

Folder ini berisi knowledge graph versi ringkas (pilihan **2b + 3b**): **pasien dewasa** dan **tanda vital saja**. Versi ini berdiri sendiri dan tidak mengubah apa pun di folder `kb/` milik versi lengkap.

Tujuannya agar berkas TTL mudah dijelaskan ke dosen. Seluruh pengetahuan cukup diterangkan dengan **4 pola** di ABox, masing-masing dengan satu contoh.

## Isi folder

| Berkas | Isi | Baris isi (tanpa komentar) |
| --- | --- | --- |
| `ontologi.ttl` | TBox: 9 kelas, 11 object property, 14 datatype property | 49 |
| `pengetahuan.ttl` | ABox: 3 sumber, 3 level ESI, 4 jenis tanda vital, 7 ambang, 1 peringatan, 6 aturan | 52 |
| `aturan/*.rq` | 6 aturan SPARQL `INSERT ... WHERE` | 6 berkas |
| `jalankan.py` | Menjalankan 6 contoh kasus dan memeriksa hasilnya | |

Sebagai pembanding, versi lengkap berisi 355 baris pengetahuan dan 136 baris ontologi.

Jumlah triple: **221** ditulis tangan, menjadi **672** setelah reasoner OWL 2 RL.

## Empat pola di `pengetahuan.ttl`

| Pola | Satu contoh untuk dijelaskan | Konsep kuliah |
| --- | --- | --- |
| 1. Sumber | `ex:Src_Sepsis3 a ex:Source ; rdfs:label "Singer M, dkk. Sepsis-3 ..."` | Provenance: setiap aturan menunjuk sumbernya |
| 2. Level ESI | `ex:ESI_1 ex:moreAcuteThan ex:ESI_2 .` | Property transitif dan inferensi reasoner |
| 3. Ambang | `ex:Limit_HR_DZ ex:onVital ex:HR ; ex:comparator "gt" ; ex:limit 100.0 ; ex:usedBy ex:Rule_D01 .` | Pengetahuan disimpan sebagai data, bukan ditulis di program |
| 4. Aturan | `ex:Rule_D01 ex:ifText "..." ; dcterms:source ex:Src_ESIv4 ; ex:sparqlFile "aturan/D01_danger_zone.rq"` | Aturan IF-THEN sebagai individu yang bersumber |

Pola 3 adalah inti versi ini. Ketujuh ambang ditulis sebagai data:

| Individu | Tanda vital | Ambang | Digunakan aturan |
| --- | --- | --- | --- |
| `Limit_SpO2_Critical` | SpO2 | < 90 | A02 (ESI 1) |
| `Limit_HR_DZ` | Nadi | > 100 | D01 (danger zone) |
| `Limit_RR_DZ` | Napas | > 20 | D01 |
| `Limit_SpO2_DZ` | SpO2 | < 92 | D01 |
| `Limit_RR_qSOFA` | Napas | >= 22 | F01 (qSOFA) |
| `Limit_SBP_qSOFA` | TD sistolik | <= 100 | F01 |
| `Limit_ShockIndex` | Nadi / TD sistolik | >= 1,0 | G01 (peringatan) |

Aturan D01 hanya satu berkas untuk tiga tanda vital. Aturan membaca ambang, arah perbandingan, dan jenis tanda vital dari data. Bila pedoman berubah (misalnya ambang nadi menjadi 110), cukup satu angka di `pengetahuan.ttl` yang diganti.

## Enam aturan

| ID | IF | THEN | Sumber |
| --- | --- | --- | --- |
| A02 | SpO2 < 90 | Kandidat ESI 1 | Gilboy 2012, Gambar 2-1 (A) |
| F01 | Minimal 2 dari 3: napas >= 22, TD sistolik <= 100, kesadaran bukan A | QSOFAPositiveCase, kandidat ESI 2 | Singer 2016 (Sepsis-3) |
| D01 | Nadi > 100, napas > 20, atau SpO2 < 92 | DangerZoneCase | Gilboy 2012, Gambar 2-1 (D) |
| E01 | Kasus adalah DangerZoneCase | Kandidat ESI 2 | Gilboy 2012, Gambar 2-1 (D) |
| G01 | Nadi / TD sistolik >= 1,0 | Peringatan shock index, ESI tidak berubah | Allgöwer dan Burri 1967 |
| Z01 | Setelah titik tetap | Rekomendasi = kandidat paling akut; tanpa kandidat = ESI 3-5 | Gilboy 2012, Bab 2 |

E01 bergantung pada hasil D01. Ketergantungan ini dicatat dengan `ex:dependsOn`, sehingga terbentuk rantai penalaran: D01 menghasilkan DangerZoneCase, lalu E01 membaca fakta itu pada siklus berikutnya. Inilah forward chaining dua siklus yang terlihat di keluaran.

## Informasi baru dari TBox

| Aksioma di `ontologi.ttl` | Fakta baru yang disimpulkan reasoner |
| --- | --- |
| `ex:moreAcuteThan` transitif | Hanya ditulis ESI 1 > ESI 2 dan ESI 2 > ESI 3-5. Reasoner menambah **ESI 1 > ESI 3-5** |
| `ex:DangerZoneCase rdfs:subClassOf ex:TriageCase` | Kasus yang disimpulkan D01 sebagai DangerZoneCase tetap dikenali sebagai kasus triase |
| `ex:heartRate rdfs:subPropertyOf ex:vitalValue` | Nadi, napas, SpO2, dan TD otomatis menjadi "nilai tanda vital", sehingga dapat diambil dengan satu query |
| `ex:Source rdfs:subClassOf prov:Entity`, `ex:Inference rdfs:subClassOf prov:Activity` | Sumber dan jejak aturan terbaca sebagai standar W3C PROV |
| `ex:recommendedESI` fungsional | Satu kasus hanya boleh memiliki satu rekomendasi; dua rekomendasi berbeda akan terdeteksi sebagai kesalahan |

## Menjalankan

```powershell
.venv\Scripts\python kb-tanda-vital\jalankan.py
```

Keluaran (diringkas):

```text
Triple ditulis tangan: 221 | setelah reasoner OWL 2 RL: 672
Disimpulkan reasoner dari ex:moreAcuteThan (transitif): ESI_1 > ESI_3to5

[SpO2 88] -> ESI 1: Resusitasi (2 siklus)
     A02: SpO2 88.0 memenuhi SpO2 < 90
     D01: Danger zone: nilai 24.0 memenuhi Napas > 20
     D01: Danger zone: nilai 88.0 memenuhi SpO2 < 92
     E01: Tanda vital di danger zone: naikkan ke ESI 2
     Z01: Kandidat paling akut: ESI 1
[qSOFA: napas 23, TD 96, kesadaran V] -> ESI 2: Gawat
     F01: qSOFA 3 dari 3 kriteria (ambang >= 2): curiga sepsis
[Semua aman] -> ESI 3-5: tanda vital aman, tentukan dari jumlah resource
[Batas: nadi tepat 100] -> ESI 3-5   (ambang "> 100", bukan ">= 100")

Semua kasus sesuai harapan.
```

Untuk mencoba di GraphDB, muat `ontologi.ttl` dan `pengetahuan.ttl` ke repository baru (bukan `triage-es`, agar tidak tercampur dengan versi lengkap).

## Batasan versi ini

- **Hanya dewasa.** Ambang tanda vital anak berbeda per usia, sehingga kelompok usia tidak dimodelkan.
- **ESI 3, 4, dan 5 digabung.** Ketiganya dibedakan oleh jumlah resource (Decision Point C), yang tidak termasuk cakupan.
- **Tidak ada keluhan klinis.** Tidak ada temuan, sinonim, riwayat penyakit, atau hierarki kelas temuan. Kesimpulan murni dari angka.
- **Kesadaran hanya digunakan sebagai kriteria qSOFA.** Aturan AVPU P/U = ESI 1 (A03) tidak dimasukkan agar cakupan tetap pada tanda vital.

## Perbandingan dengan versi lengkap

| Aspek | Versi ringkas (folder ini) | Versi lengkap (`kb/`) |
| --- | --- | --- |
| Baris pengetahuan | 52 | 355 |
| Pola yang perlu dijelaskan | 4 | ±15 |
| Aturan | 6 | 24 |
| Decision Point | A (sebagian) dan D | A, B, C, D |
| Rentang hasil | ESI 1, ESI 2, ESI 3-5 | ESI 1-5 |
| Konsep kuliah yang tampil | Transitif, subkelas, subproperty, fungsional, PROV-O, forward chaining, pengetahuan sebagai data | Semua itu, ditambah SKOS, hierarki konsep, model pasien, SHACL, dialog WHY |
