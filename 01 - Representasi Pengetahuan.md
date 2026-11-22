---
title: Representasi Pengetahuan Sistem Pakar Triase IGD
mata_kuliah: Sistem Pakar Lanjut
jenis: dokumentasi
versi_ontologi: "2.1"
status: final
diperbarui: 2026-11-23
rujukan_materi: [Intro ES, KR-Knowledge-Graphs, RDFS, SPARQL-Reasoning]
tags: [spl, project-akhir, knowledge-representation, ontologi, owl, rdfs]
---

# Representasi Pengetahuan Sistem Pakar Triase IGD

Dokumen ini menjelaskan bagaimana pengetahuan triase IGD direpresentasikan dalam knowledge graph aplikasi **Perlu ke IGD?**. Penjelasannya mengikuti urutan dan istilah materi kuliah setelah UTS: *Intro ES*, *Knowledge Representation with Knowledge Graphs*, *RDF Schema*, serta *Querying and Reasoning with SPARQL*. Pembahasan penalaran dan fasilitas penjelasan ada di [Penalaran dan Penjelasan](<02 - Penalaran dan Penjelasan.md>).

## 1. Sistem pakar dan tiga blok pembangunnya

Materi *Intro ES* mendefinisikan sistem pakar sebagai program yang meniru pengambilan keputusan pakar pada domain sempit, memakai basis pengetahuan berupa fakta dan aturan IF-THEN yang ditulis eksplisit, sehingga penalarannya dapat dijelaskan langkah demi langkah. Triase IGD cocok dengan kriteria "kapan memakai sistem pakar" dalam materi tersebut:

- **Domain berbasis aturan yang stabil**: algoritma ESI v4 sudah baku (Decision Point A sampai D).
- **Keputusan kritis yang perlu diaudit**: setiap level ESI harus dapat dipertanggungjawabkan, bukan tebakan kotak hitam.

| Blok pembangun (Intro ES) | Wujud di aplikasi |
| --- | --- |
| Knowledge base | Ontologi OWL (TBox) + pengetahuan domain dan aturan sebagai individu (ABox) di GraphDB, repository `triage-es` |
| Inference engine | Reasoner OWL 2 RL GraphDB + siklus forward chaining 16 aturan SPARQL (`app/engine.py`) |
| User interface | Alur tanya-jawab untuk orang awam (`web/`) + panel "Detail teknis" untuk penjelasan |

Pakar domain diwakili oleh dokumen *ESI Implementation Handbook v4* (Gilboy dkk., 2012), yang menjadi sumber setiap aturan.

## 2. Piramida pengetahuan dalam knowledge graph

Materi *KR-Knowledge-Graphs* memetakan piramida pengetahuan Giarratano dan Riley ke istilah knowledge graph. Pemetaannya untuk proyek ini:

| Lapis piramida | Arti dalam KG (materi) | Contoh di proyek |
| --- | --- | --- |
| Wisdom | Di luar graph | Keputusan akhir perawat triase |
| Metaknowledge | Header ontologi, versi, provenance | `owl:versionInfo "2.1"`, `dcterms:source`, node `ex:Inference` (PROV-O), named graph |
| Knowledge | Aksioma TBox | `ex:HighRiskSituation rdfs:subClassOf ex:Finding`, `ex:moreAcuteThan` transitif |
| Information | Triple ABox yang dinyatakan | `ex:ChestPainACS a ex:HighRiskSituation`, ambang `ex:DZ_HR_3m_3y` |
| Data | Literal | `"170"^^xsd:decimal`, `"Demam"@id` |
| Noise | Masukan mentah sebelum dipetakan ke RDF | Teks keluhan "dada terasa berat sejak pagi" sebelum dikenali menjadi `ex:ChestPainACS` |

## 3. TBox dan ABox

Materi KR menegaskan bahwa TBox (terminologi) dan ABox (asersi) bersama-sama membentuk basis pengetahuan, sedangkan reasoner berperan sebagai inference engine. Proyek ini memisahkannya ke berkas dan named graph berbeda:

| Bagian | Isi | Berkas | Named graph |
| --- | --- | --- | --- |
| TBox | Kelas, property, aksioma OWL | `kb/triage-ontology.ttl` | `graph/tbox` |
| ABox pengetahuan | Level ESI, Decision Point, kelompok usia, ambang danger zone, resource, 43 temuan klinis + sinonim, 16 aturan, pertanyaan dialog | `kb/knowledge.ttl` | `graph/pengetahuan` |
| ABox bukti | Statistik agregat MC-MED per level ESI | `kb/evidence.ttl` | `graph/bukti` |
| Working memory | Fakta satu pasien + jejak penalaran, dihapus setelah konsultasi | dibuat aplikasi | default graph |

### Perbaikan dari Tugas 4

KG Tugas 4 berpusat pada **kunjungan** (118.385 node `ex:EDVisit`). Graph itu bagus untuk analisis data, tetapi tidak dapat menilai pasien baru. Versi akhir berpusat pada **pengetahuan**:

| Aspek | Tugas 4 | Versi akhir |
| --- | --- | --- |
| Isi utama | Data kunjungan | Konsep klinis, ambang, aturan, pertanyaan |
| Ambang danger zone | Tertulis di query, hanya dewasa | Individu `ex:DangerZoneThreshold`, empat kelompok usia |
| Aturan | Teks SPARQL di luar graph | Individu `ex:Rule` dengan sumber, prioritas, dan Decision Point |
| Pasien baru | Tidak dapat dinilai | Working memory sementara |
| Penjelasan | Tidak ada | Jejak `ex:Inference` (PROV-O) |
| Data MC-MED | Per kunjungan | Agregat sebagai bukti (`graph/bukti`) |

## 4. RDF: triple dan Turtle

Materi KR mendefinisikan knowledge graph sebagai himpunan triple (subjek, predikat, objek) yang membentuk graph berarah berlabel, sama dengan jaringan semantik. Contoh working memory seorang anak 2 tahun dalam Turtle:

```turtle
@prefix ex: <http://example.org/triage/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Pasien1 a ex:TriageCase ;
    ex:age 2 ;
    ex:presentsWith ex:Fever , ex:Cough ;
    ex:heartRate "170"^^xsd:decimal ;
    ex:temperatureC "39.4"^^xsd:decimal ;
    ex:painScore 4 ;
    ex:reportedByLayperson true .
```

Singkatan Turtle `a`, `;`, dan `,` mengikuti contoh di materi. Setiap nama adalah IRI global, sehingga graph pengetahuan dan working memory dapat digabung tanpa bentrok nama.

## 5. RDFS: kamus untuk kalimat

Materi RDFS memakai contoh medis "Budi" dan menyimpulkan bahwa RDF hanya menyatakan fakta, sedangkan RDFS menambahkan kamus: jenis benda yang ada dan hubungannya. Ontologi proyek memakai empat mekanisme RDFS berikut:

| Aturan entailment (RDF 1.1 Semantics) | Aksioma di ontologi | Fakta yang dinyatakan | Fakta yang diturunkan |
| --- | --- | --- | --- |
| rdfs2 (domain) | `ex:presentsWith rdfs:domain ex:TriageCase` | `ex:Pasien1 ex:presentsWith ex:ChestPainACS` | `ex:Pasien1 a ex:TriageCase` |
| rdfs3 (range) | `ex:presentsWith rdfs:range ex:Finding` | (sama) | `ex:ChestPainACS a ex:Finding` |
| rdfs9 (subclass) | `ex:HighRiskSituation rdfs:subClassOf ex:Finding` | `ex:ChestPainACS a ex:HighRiskSituation` | `ex:ChestPainACS a ex:Finding` |
| rdfs7 (subproperty) | `ex:heartRate rdfs:subPropertyOf ex:vitalValue` | `ex:Pasien1 ex:heartRate 128` | `ex:Pasien1 ex:vitalValue 128` |

Hasil di atas diverifikasi dengan `owlrl` (closure RDFS) pada graph proyek. Sesuai peringatan "common mistake" di materi, domain dan range adalah **aturan inferensi, bukan batasan**: menuliskan `ex:presentsWith` pada sesuatu yang bukan kasus tidak memunculkan galat, melainkan menurunkan tipe baru. Karena itu validasi dilakukan dengan SHACL (bagian 8).

## 6. OWL: logika di dalam ontologi

Materi KR menyajikan tabel padanan logika dan OWL. Konstruksi yang digunakan proyek:

| Logika (materi) | OWL | Penggunaan di proyek |
| --- | --- | --- |
| p → q | `rdfs:subClassOf` | `ex:UndertriageCandidate ⊑ ex:DangerZoneCase ⊑ ex:TriageCase` |
| p ↔ q | `owl:equivalentClass` | `ex:EDVisit ≡ ex:TriageCase`, `ex:DangerZoneVisit ≡ ex:DangerZoneCase` (kompatibel Tugas 4) |
| Kontradiksi | `owl:disjointWith` | `ex:Resource` disjoint `ex:NonResource`; `ex:LifeSavingIndicator` disjoint `ex:Symptom` |
| Kuantor nilai | `owl:hasValue` | `ex:ESI1Visit ≡ ∃ triageESI.{ESI_1}` |
| Aksioma property | `owl:TransitiveProperty` | `ex:moreAcuteThan` (ESI 1 > 2 > ... > 5), `ex:dependsOn` (rantai penjelasan) |
| Aksioma property | `owl:inverseOf` | `ex:hasVisit` ↔ `ex:ofPatient` |
| Property fungsional | `owl:FunctionalProperty` | `ex:recommendedESI`: satu kasus hanya satu level akhir |

Repository GraphDB memakai ruleset **OWL 2 RL**, profil yang menurut materi ditujukan untuk mesin penalaran berbasis aturan. Saat basis pengetahuan dimuat, GraphDB menyimpan 1.053 triple eksplisit dan menurunkan 1.775 triple tambahan dari aksioma ini.

## 7. Pengetahuan pakar sebagai data

Inti perbaikan representasi adalah memindahkan pengetahuan pakar dari kode ke graph, sehingga dapat di-query, diperiksa, dan diubah tanpa mengubah program.

**Ambang danger zone** (Gilboy 2012, Gambar 2-1 dan 5-1), masing-masing satu individu:

| Kelompok usia | Nadi lebih dari | Napas lebih dari | SpO2 kurang dari |
| --- | --- | --- | --- |
| < 3 bulan | 180 | 50 | 92% |
| 3 bulan sampai 3 tahun | 160 | 40 | 92% |
| 3 sampai 8 tahun | 140 | 30 | 92% |
| > 8 tahun | 100 | 20 | 92% |

```turtle
ex:DZ_HR_3m_3y a ex:DangerZoneThreshold ;
    ex:forAgeGroup ex:Age_3m_3y ; ex:onVital ex:HR ;
    ex:comparator "gt" ; ex:limit 160.0 ;
    ex:definedBy ex:Rule_D01 .
```

Pengetahuan lain yang juga disimpan sebagai data:

- **Resource ESI** dan bobotnya (prosedur kompleks berbobot 2), serta resource yang biasanya dibutuhkan setiap keluhan (`ex:typicalResource`).
- **43 temuan klinis** dikelompokkan menurut Decision Point (`ex:LifeSavingIndicator`, `ex:HighRiskSituation`, `ex:AlteredMentalStatus`, `ex:Symptom`, `ex:RiskFactor`) dan sistem organ Tabel 3-1, dengan sinonim bahasa Indonesia (`skos:altLabel`) untuk mengenali keluhan teks bebas.
- **16 aturan** sebagai individu `ex:Rule`: IF, THEN, prioritas, Decision Point, sumber, kalimat awam (`ex:layText`), dan berkas SPARQL-nya.
- **Pertanyaan dialog** sebagai individu `ex:Question` beserta aturan yang membutuhkannya (`ex:neededBy`), dasar penjelasan WHY.
- **Saran awam per level ESI** (`ex:layTitle`, `ex:layAdvice`).

## 8. Dunia terbuka, dunia tertutup, dan validasi

Materi KR membedakan asumsi dunia tertutup (Prolog, basis data: yang tidak diketahui benar dianggap salah) dan **asumsi dunia terbuka** RDF/OWL (yang tidak dinyatakan berarti tidak diketahui). Konsekuensinya bagi proyek:

| Kebutuhan | Masalah di dunia terbuka | Solusi |
| --- | --- | --- |
| Usia wajib diisi | OWL tidak dapat mewajibkan data | SHACL `kb/shapes.ttl` (dunia tertutup) |
| Rentang nilai masuk akal (nadi 20-300, dst.) | Domain/range bukan batasan | SHACL + validasi API |
| "Resource belum dinilai" berbeda dengan "nol resource" | Ketiadaan triple tidak berarti nol | Penanda eksplisit `ex:resourcesAssessed true` |
| Aturan C00 hanya berjalan bila resource belum dinilai | Butuh negasi | `FILTER NOT EXISTS`: *negation as failure* di dunia tertutup, sesuai materi SPARQL |

## 9. Ringkasan

| Konsep materi | Bukti di proyek |
| --- | --- |
| Tiga blok pembangun sistem pakar | Knowledge base GraphDB, mesin inferensi `app/engine.py`, antarmuka `web/` |
| Piramida pengetahuan | Bagian 2 |
| TBox/ABox, named graph | `graph/tbox`, `graph/pengetahuan`, `graph/bukti` |
| Entailment RDFS (rdfs2, 3, 7, 9) | Bagian 5, terverifikasi `owlrl` |
| OWL 2 RL: equivalentClass, hasValue, TransitiveProperty, disjointWith | Bagian 6, dimaterialisasi GraphDB |
| Dunia terbuka dan validasi SHACL | Bagian 8 |
| Metaknowledge (provenance, sumber) | `dcterms:source`, `ex:Inference` PROV-O |

## Referensi

1. Gilboy N, Tanabe P, Travers D, Rosenau AM. *Emergency Severity Index (ESI): A Triage Tool for Emergency Department Care, Version 4. Implementation Handbook 2012 Edition.* AHRQ Publication No. 12-0014, 2011.
2. Singer M, dkk. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). *JAMA* 2016;315(8):801-810.
3. Kansal A, dkk. MC-MED, multimodal clinical monitoring in the emergency department. *Scientific Data* 2025.
4. W3C. *RDF 1.1 Semantics*, *RDF Schema 1.1*, *OWL 2 Web Ontology Language Profiles*, *PROV-O*, *SHACL*.
5. Materi kuliah Sistem Pakar Lanjut: *An Introduction to Expert Systems*; *Knowledge Representation with Knowledge Graphs: RDF, RDFS & OWL*; *RDF Schema: Classes, Properties and Inheritance*; *Querying and Reasoning with SPARQL*.
