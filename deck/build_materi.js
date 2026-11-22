// Materi pendukung: representasi pengetahuan dan penalaran, disusun mengikuti materi kuliah setelah UTS
// (Intro ES, KR with Knowledge Graphs, RDFS, Querying and Reasoning with SPARQL) dengan contoh triase IGD.
// Pemakaian: cd deck && node build_materi.js
const pptxgen = require('pptxgenjs');
const path = require('path');

const OUT = path.join(__dirname, 'Materi Representasi Pengetahuan dan Penalaran.pptx');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Hamzah Arman Husni';
pres.title = 'Representasi Pengetahuan dan Penalaran: Sistem Pakar Triase IGD';
const { K, FONT, A, T, box, circle, arrow, bullets, shadow, add, section } = require('./lib')(pres, 'Materi pendukung · Representasi pengetahuan dan penalaran · Triase IGD');

const code = (s, text, o) => s.addText(text, { isTextBox: true, fontFace: 'Consolas', fontSize: 13, color: 'DFE9E4', fill: { color: K.dark }, margin: 12, valign: 'top', ...o });
const table = (s, rows, o) => s.addTable(rows.map((r, i) => r.map(c => ({ text: c, options: { bold: i === 0, color: i === 0 ? K.white : K.ink, fill: { color: i === 0 ? K.teal : (i % 2 ? K.white : K.sage) } } }))),
  { fontFace: FONT, fontSize: 14, border: { type: 'solid', color: K.line, pt: 0.75 }, valign: 'middle', margin: 0.07, ...o });
const lecture = (s, text) => { box(s, { x: 0.6, y: 6.25, w: 12.1, h: 0.55, fill: K.soft }); T(s, [{ text: 'Materi kuliah: ', options: { bold: true } }, { text }], { x: 0.85, y: 6.25, w: 11.6, h: 0.55, fontSize: 13, valign: 'middle', color: K.ink2 }); };

// =====================================================================
section('Pembuka');
{
  const s = add('GELAP', null, 'Deck ini adalah materi pendukung. Setiap slide mengambil satu konsep dari materi kuliah setelah UTS lalu menunjukkan wujudnya di sistem pakar triase IGD.');
  s.addImage({ path: A('logougm.png'), x: 0.8, y: 0.7, w: 0.85, h: 0.86 });
  T(s, 'Sistem Pakar Lanjut · Materi pendukung project akhir', { x: 1.85, y: 0.95, w: 9, h: 0.5, fontSize: 14, color: K.mintText });
  T(s, 'Representasi Pengetahuan dan Penalaran', { x: 0.8, y: 2.0, w: 11.5, h: 1.0, fontSize: 48, bold: true, color: K.white });
  T(s, 'Dari materi kuliah ke sistem pakar triase IGD: RDF, RDFS, OWL, aturan SPARQL, forward chaining, dan penjelasan', { x: 0.8, y: 3.1, w: 10.8, h: 1.0, fontSize: 22, color: K.mint });
  const parts = ['Intro ES', 'KR + Knowledge Graph', 'RDFS', 'SPARQL + Reasoning'];
  parts.forEach((p, i) => { box(s, { x: 0.8 + i * 2.95, y: 4.9, w: 2.75, h: 0.75, fill: K.dark2 }); T(s, p, { x: 0.8 + i * 2.95, y: 4.9, w: 2.75, h: 0.75, align: 'center', valign: 'middle', fontSize: 15, bold: true, color: K.white }); });
  T(s, 'Hamzah Arman Husni', { x: 0.8, y: 6.15, w: 8, h: 0.4, fontSize: 16, bold: true, color: K.white });
}

// =====================================================================
section('Intro ES');
{
  const s = add('ISI', 'Tiga blok pembangun sistem pakar', 'Mirip diagram di materi Intro ES: pakar domain membangun knowledge base, pengguna bertanya melalui antarmuka, inference engine menalar di antaranya. Di proyek, pakar diwakili handbook ESI v4.');
  const blk = (x, title, sub, fill, color = K.white) => { box(s, { x, y: 2.3, w: 3.2, h: 2.3, fill, shadow: shadow() }); T(s, title, { x: x + 0.25, y: 2.5, w: 2.7, h: 0.5, fontSize: 19, bold: true, color }); T(s, sub, { x: x + 0.25, y: 3.05, w: 2.7, h: 1.5, fontSize: 14, color: color === K.white ? 'D9EDE6' : K.ink2 }); };
  blk(0.9, 'Knowledge base', 'Ontologi OWL (TBox) + pengetahuan ESI dan aturan (ABox) di GraphDB', K.teal);
  blk(5.05, 'Inference engine', 'Reasoner OWL 2 RL + forward chaining 16 aturan SPARQL', K.ink);
  blk(9.2, 'User interface', 'Tanya-jawab untuk orang awam + panel "Detail teknis"', K.sage, K.ink);
  arrow(s, 4.1, 3.45, 5.05, 3.45); arrow(s, 8.25, 3.45, 9.2, 3.45);
  T(s, 'Pakar domain: ESI v4 Implementation Handbook (Gilboy 2012)', { x: 0.9, y: 1.55, w: 6, h: 0.5, fontSize: 15, bold: true, color: K.teal2 });
  arrow(s, 2.5, 2.0, 2.5, 2.3, K.teal);
  T(s, 'Pengguna awam: pasien atau keluarga', { x: 8.0, y: 4.85, w: 4.4, h: 0.5, fontSize: 15, bold: true, color: K.teal2, align: 'right' });
  lecture(s, 'Intro ES, "Three core building blocks" dan "How does it reason?": aturan produksi IF-THEN, forward chaining berbasis data.');
}
{
  const s = add('ISI', 'Mengapa triase cocok untuk sistem pakar', 'Materi Intro ES memberi empat kriteria kapan memakai sistem pakar. Triase IGD memenuhi dua yang paling kuat: domain berbasis aturan yang stabil, dan keputusan kritis yang perlu dijelaskan dan diaudit.');
  const crit = [['Belum ada data untuk melatih ML', 'Sebagian: data MC-MED hanya dewasa dan berlisensi', false],
    ['Domain berbasis aturan yang stabil', 'Ya: algoritma ESI v4, Decision Point A-D', true],
    ['Ingin aturan yang dapat dipahami', 'Ya: perawat dan dosen dapat membaca IF-THEN', true],
    ['Keputusan kritis perlu penjelasan dan audit', 'Ya: setiap level ESI dapat ditelusuri ke aturan dan sumbernya', true]];
  crit.forEach(([c, a, ok], i) => {
    const y = 1.6 + i * 1.1;
    box(s, { x: 0.6, y, w: 12.1, h: 0.95, fill: i % 2 ? K.white : K.sage });
    circle(s, 0.85, y + 0.2, 0.55, ok ? K.teal : K.ink3, ok ? 'Ya' : '~', K.white, 14);
    T(s, c, { x: 1.7, y, w: 4.6, h: 0.95, fontSize: 17, bold: true, valign: 'middle' });
    T(s, a, { x: 6.4, y, w: 6.1, h: 0.95, fontSize: 15, color: K.ink2, valign: 'middle' });
  });
  lecture(s, 'Intro ES, "When should you consider an expert system?" dan tabel sistem pakar vs machine learning.');
}

// =====================================================================
section('KR dan knowledge graph');
{
  const s = add('ISI', 'Piramida pengetahuan dalam knowledge graph', 'Mengikuti piramida Giarratano dan Riley versi knowledge graph di materi KR. Dari atas ke bawah: wisdom di luar graph, metaknowledge, knowledge (TBox), information (ABox), data (literal), noise (masukan mentah).');
  const lv = [['Wisdom', 'Keputusan akhir perawat triase', 'di luar graph'], ['Metaknowledge', 'versi ontologi, sumber aturan, jejak ex:Inference (PROV-O)', 'header + provenance'],
    ['Knowledge', 'HighRiskSituation ⊑ Finding; moreAcuteThan transitif', 'TBox'], ['Information', 'ChestPainACS a HighRiskSituation; ambang DZ_HR_3m_3y', 'ABox'],
    ['Data', '"170"^^xsd:decimal, "Demam"@id', 'literal'], ['Noise', '"dada terasa berat sejak pagi" sebelum dikenali', 'teks mentah']];
  lv.forEach(([n, ex, t], i) => {
    const y = 1.55 + i * 0.75, w = 3.0 + i * 0.55;
    box(s, { x: 0.6 + (5.75 - w) / 2, y, w, h: 0.65, fill: i < 2 ? K.ink : i < 4 ? K.teal : K.sage });
    T(s, n, { x: 0.6 + (5.75 - w) / 2, y, w, h: 0.65, align: 'center', valign: 'middle', fontSize: 15, bold: true, color: i < 4 ? K.white : K.ink });
    T(s, [{ text: ex, options: { color: K.ink } }, { text: '   ' + t, options: { color: K.ink3, italic: true } }], { x: 6.7, y, w: 6.0, h: 0.65, fontSize: 14, valign: 'middle' });
  });
  lecture(s, 'KR-Knowledge-Graphs, piramida pengetahuan dalam istilah KG; TBox dan ABox membentuk knowledge base, reasoner berperan sebagai inference engine.');
}
{
  const s = add('ISI', 'TBox dan ABox, dipisah dengan named graph', 'TBox berisi terminologi: kelas, property, aksioma. ABox berisi asersi tentang individu. Proyek ini juga memisahkan bukti empiris dan working memory pasien. Named graph adalah cara materi KR membagi knowledge base dan mencatat metaknowledge.');
  code(s, `# TBox  (graph/tbox)
ex:HighRiskSituation rdfs:subClassOf ex:Finding .
ex:presentsWith rdfs:domain ex:TriageCase ;
                rdfs:range  ex:Finding .
ex:moreAcuteThan a owl:TransitiveProperty .
ex:DangerZoneVisit owl:equivalentClass ex:DangerZoneCase .`, { x: 0.6, y: 1.55, w: 6.0, h: 2.3 });
  code(s, `# ABox pengetahuan  (graph/pengetahuan)
ex:ChestPainACS a ex:HighRiskSituation ;
    skos:altLabel "nyeri dada"@id .
ex:ESI_1 ex:moreAcuteThan ex:ESI_2 .

# Working memory pasien (sementara)
ex:Pasien1 ex:presentsWith ex:Fever .`, { x: 6.7, y: 1.55, w: 6.0, h: 2.3 });
  table(s, [['Named graph', 'Isi', 'Triple'], ['graph/tbox', 'kelas, property, aksioma OWL', 'ontologi'], ['graph/pengetahuan', 'ESI, ambang, resource, 43 temuan, 16 aturan, pertanyaan', 'mayoritas'],
    ['graph/bukti', 'statistik agregat MC-MED per ESI', '7 node'], ['(default, sementara)', 'fakta pasien + jejak ex:Inference', 'dihapus']], { x: 0.6, y: 4.05, w: 12.1, colW: [2.6, 7.3, 2.2], rowH: 0.36, fontSize: 13 });
  lecture(s, 'KR-Knowledge-Graphs, TBox/ABox dan dataset RDF (default graph + named graph).');
}
{
  const s = add('ISI', 'RDF: pengetahuan sebagai himpunan triple', 'Triple subjek-predikat-objek membentuk graph berarah berlabel, sama dengan jaringan semantik di materi. Singkatan Turtle a, titik koma, dan koma. Setiap nama adalah IRI global sehingga graph pengetahuan dan working memory dapat digabung.');
  code(s, `ex:Pasien1 a ex:TriageCase ;
    ex:age 2 ;
    ex:presentsWith ex:Fever , ex:Cough ;
    ex:heartRate "170"^^xsd:decimal ;
    ex:temperatureC "39.4"^^xsd:decimal ;
    ex:painScore 4 .`, { x: 0.6, y: 1.6, w: 6.3, h: 2.6, fontSize: 15 });
  // graph kecil
  const nd = (x, y, w, t, f, c = K.white) => { box(s, { x, y, w, h: 0.55, fill: f, rectRadius: 0.27 }); T(s, t, { x, y, w, h: 0.55, align: 'center', valign: 'middle', fontSize: 13, bold: true, color: c }); };
  nd(8.6, 2.6, 1.8, ':Pasien1', K.ink);
  nd(10.9, 1.5, 1.8, ':Fever', K.teal); nd(10.9, 2.6, 1.8, ':Cough', K.teal); nd(10.9, 3.7, 1.8, '"170"', K.sage, K.ink); nd(7.4, 4.3, 1.8, ':TriageCase', K.teal2);
  arrow(s, 10.4, 2.75, 10.9, 1.8); arrow(s, 10.4, 2.87, 10.9, 2.87); arrow(s, 10.4, 3.0, 10.9, 3.95); arrow(s, 9.0, 3.15, 8.5, 4.3);
  T(s, 'presentsWith', { x: 10.0, y: 1.85, w: 1.2, h: 0.3, fontSize: 10, color: K.ink3 }); T(s, 'heartRate', { x: 10.05, y: 3.55, w: 1.0, h: 0.3, fontSize: 10, color: K.ink3 }); T(s, 'a', { x: 8.95, y: 3.65, w: 0.3, h: 0.3, fontSize: 10, color: K.ink3 });
  T(s, bullets(['IRI: nama global, mis. ex:ChestPainACS', 'Literal: bentuk leksikal + tipe data, mis. "39.4"^^xsd:decimal, "Demam"@id', 'Working memory satu pasien = 8 triple sebelum penalaran']), { x: 0.6, y: 4.45, w: 12, h: 1.6, fontSize: 15 });
  lecture(s, 'KR-Knowledge-Graphs, model data RDF: graph = himpunan triple; istilah RDF (IRI, literal, blank node).');
}

// =====================================================================
section('RDFS');
{
  const s = add('ISI', 'RDFS: kamus untuk kalimat, inferensi melalui entailment', 'Materi RDFS: RDF hanya menyatakan fakta; RDFS menambahkan kamus. Domain dan range adalah aturan inferensi, bukan batasan. Tabel ini diverifikasi dengan closure RDFS owlrl pada graph proyek: dua fakta menghasilkan fakta baru.');
  table(s, [['Aturan', 'Aksioma di ontologi', 'Fakta dinyatakan', 'Fakta diturunkan'],
    ['rdfs2 (domain)', 'presentsWith rdfs:domain TriageCase', 'Pasien1 presentsWith ChestPainACS', 'Pasien1 a TriageCase'],
    ['rdfs3 (range)', 'presentsWith rdfs:range Finding', '(sama)', 'ChestPainACS a Finding'],
    ['rdfs9 (subclass)', 'HighRiskSituation ⊑ Finding', 'ChestPainACS a HighRiskSituation', 'ChestPainACS a Finding'],
    ['rdfs7 (subproperty)', 'heartRate ⊑ vitalValue', 'Pasien1 heartRate 128', 'Pasien1 vitalValue 128']],
    { x: 0.6, y: 1.6, w: 12.1, colW: [2.1, 3.4, 3.4, 3.2], rowH: 0.62, fontSize: 14 });
  box(s, { x: 0.6, y: 4.95, w: 12.1, h: 1.05, fill: K.sosSoft });
  T(s, [{ text: 'Kesalahan umum (materi RDFS): ', options: { bold: true } }, { text: 'domain/range tidak menolak data salah, hanya menurunkan tipe baru. Validasi (usia wajib, nadi 20-300) dilakukan dengan SHACL di kb/shapes.ttl.' }],
    { x: 0.85, y: 4.95, w: 11.6, h: 1.05, fontSize: 15, valign: 'middle', color: '7D1D10' });
  lecture(s, 'RDFS, "RDFS in plain words", aturan entailment rdfs2/3/7/9, dan kotak "common mistake".');
}

// =====================================================================
section('OWL');
{
  const s = add('ISI', 'OWL: logika di dalam ontologi', 'Tabel padanan logika dan OWL dari materi KR, diisi dengan konstruksi yang benar-benar ada di ontologi proyek. GraphDB memakai ruleset OWL 2 RL, profil yang menurut materi ditujukan untuk mesin penalaran berbasis aturan.');
  table(s, [['Logika', 'OWL', 'Di ontologi triase'],
    ['p → q', 'rdfs:subClassOf', 'UndertriageCandidate ⊑ DangerZoneCase ⊑ TriageCase'],
    ['p ↔ q', 'owl:equivalentClass', 'EDVisit ≡ TriageCase; DangerZoneVisit ≡ DangerZoneCase'],
    ['kontradiksi', 'owl:disjointWith', 'Resource ⊓ NonResource = ∅'],
    ['∃ nilai tertentu', 'owl:hasValue', 'ESI1Visit ≡ ∃ triageESI.{ESI_1}'],
    ['aturan Prolog berulang', 'owl:TransitiveProperty', 'ESI_1 moreAcuteThan ESI_2 ... ⇒ ESI_1 moreAcuteThan ESI_5'],
    ['satu nilai', 'owl:FunctionalProperty', 'recommendedESI: satu level akhir per kasus']],
    { x: 0.6, y: 1.55, w: 8.4, colW: [1.9, 2.4, 4.1], rowH: 0.55, fontSize: 13 });
  box(s, { x: 9.3, y: 1.55, w: 3.4, h: 4.45, fill: K.dark });
  T(s, '1.053', { x: 9.55, y: 1.8, w: 3.0, h: 0.8, fontSize: 44, bold: true, color: K.white });
  T(s, 'triple eksplisit', { x: 9.55, y: 2.6, w: 3.0, h: 0.4, fontSize: 14, color: K.mintText });
  T(s, '+1.775', { x: 9.55, y: 3.2, w: 3.0, h: 0.8, fontSize: 44, bold: true, color: K.mint });
  T(s, 'triple diturunkan reasoner OWL 2 RL GraphDB saat KB dimuat', { x: 9.55, y: 4.0, w: 3.0, h: 0.9, fontSize: 14, color: K.mintText });
  lecture(s, 'KR-Knowledge-Graphs, tabel logika ↔ OWL, aksioma property, dan profil OWL 2 (EL, QL, RL).');
}
{
  const s = add('ISI', 'Dunia terbuka vs dunia tertutup', 'RDF/OWL memakai asumsi dunia terbuka: yang tidak dinyatakan berarti tidak diketahui. Untuk triase, beberapa hal justru perlu dunia tertutup: data wajib dan "belum dinilai". Solusinya SHACL, penanda eksplisit, dan FILTER NOT EXISTS (negation as failure) pada aturan.');
  const col = (x, h, sub, items, fill, color) => { box(s, { x, y: 1.55, w: 5.9, h: 4.45, fill }); T(s, h, { x: x + 0.3, y: 1.75, w: 5.3, h: 0.5, fontSize: 20, bold: true, color }); T(s, sub, { x: x + 0.3, y: 2.25, w: 5.3, h: 0.5, fontSize: 14, color, italic: true }); T(s, bullets(items), { x: x + 0.3, y: 2.85, w: 5.3, h: 3.0, fontSize: 15, color }); };
  col(0.6, 'Dunia terbuka (OWL)', 'Yang tidak dinyatakan: tidak diketahui', ['Penalaran subclass, equivalentClass, transitif', 'Usia kosong tidak memicu galat', 'Monoton: fakta hanya bertambah'], K.sage, K.ink);
  col(6.8, 'Dunia tertutup (di mana perlu)', 'Yang tidak dinyatakan: dianggap tidak ada', ['SHACL: usia wajib, rentang nadi 20-300', 'Penanda ex:resourcesAssessed membedakan "nol" dan "belum dinilai"', 'C00: FILTER NOT EXISTS { ?case ex:resourcesAssessed true }'], K.dark, K.white);
  lecture(s, 'KR-Knowledge-Graphs (open world, monoton) dan SPARQL-Reasoning (NOT EXISTS = closed-world negation as failure).');
}

// =====================================================================
section('SPARQL dan penalaran');
{
  const s = add('ISI_GELAP', 'INSERT {head} WHERE {body} adalah aturan IF-THEN', 'Kalimat kunci materi SPARQL. WHERE = badan aturan (IF), templat INSERT = kepala aturan (THEN). Beberapa operasi dipisah titik koma menjadi satu rule set; di GraphDB satu siklus dikirim sebagai satu permintaan.');
  T(s, [{ text: 'IF ', options: { bold: true, color: K.mint } }, { text: 'kasus danger zone DAN kandidat ESI dari resource 3-5', options: { color: K.white, breakLine: true } }, { text: 'THEN ', options: { bold: true, color: K.mint } }, { text: 'kandidat ESI 2 (uptriage), catat ketergantungan pada C01 dan D01', options: { color: K.white } }],
    { x: 0.6, y: 1.45, w: 12.1, h: 0.85, fontSize: 19 });
  code(s, `# E01  (Gilboy 2012, Gambar 2-1 D)
INSERT {                                   # THEN  (kepala aturan)
  ?case ex:candidateESI ex:ESI_2 .
  ?inf a ex:Inference ; ex:usedRule ex:Rule_E01 ; ex:aboutCase ?case ;
       ex:concluded ex:ESI_2 ; ex:dependsOn ?infC , ?infD ; ex:reason ?why .
}
WHERE {                                    # IF  (badan aturan)
  ?case a ex:DangerZoneCase .
  ?infC ex:usedRule ex:Rule_C01 ; ex:aboutCase ?case ; ex:concluded ?c .
  ?c ex:levelNumber ?n .  FILTER(?n >= 3)
  ?infD ex:usedRule ex:Rule_D01 ; ex:aboutCase ?case .
}`, { x: 0.6, y: 2.45, w: 12.1, h: 3.6, fontSize: 14, fill: { color: '0A110E' } });
  T(s, 'Materi kuliah: SPARQL-Reasoning, "Rules as CONSTRUCT/INSERT" dan SPARQL 1.1 Update.', { x: 0.6, y: 6.25, w: 12, h: 0.4, fontSize: 13, color: K.mintText });
}
{
  const s = add('ISI', 'Forward chaining sampai titik tetap', 'Seperti tabel fixpoint di materi: ulangi sampai tidak ada yang berubah. Kasus anak 2 tahun, demam 39,4 °C, nadi 170: dari 8 triple menjadi 46 lalu stabil; Z01 memilih ESI 2. Ini siklus recognise-act sistem produksi dengan SPARQL sebagai pencocok.');
  table(s, [['Siklus', 'Aturan terpicu', 'Triple baru', 'Jumlah'],
    ['Awal', 'working memory', '8', '8'], ['1', 'D01 (+7), C00 (+10), C01 (+8), C02 (+5)', '+30', '38'], ['2', 'E01 (+8), bergantung C01 dan D01', '+8', '46'],
    ['3', 'tidak ada', '+0', '46: titik tetap'], ['Resolusi', 'Z01: kandidat paling akut → ESI 2', '+7', '53']],
    { x: 0.6, y: 1.55, w: 7.6, colW: [1.3, 3.9, 1.1, 1.3], rowH: 0.6, fontSize: 14 });
  s.addChart(pres.charts.BAR, [{ name: 'Jumlah triple kasus', labels: ['Awal', 'Siklus 1', 'Siklus 2', 'Siklus 3', 'Z01'], values: [8, 38, 46, 46, 53] }], {
    x: 8.5, y: 1.5, w: 4.2, h: 4.4, barDir: 'col', chartColors: [K.teal], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontFace: FONT, dataLabelFontSize: 12, dataLabelColor: K.ink,
    showTitle: true, title: 'Triple kasus per siklus', titleFontFace: FONT, titleFontSize: 14, titleColor: K.ink, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
    catAxisLabelColor: K.ink2, valAxisLabelColor: K.ink3, valGridLine: { color: 'E6EEE9', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false, valAxisMaxVal: 60,
  });
  lecture(s, 'SPARQL-Reasoning, "Forward chaining to a fixpoint" dan Intro ES, forward chaining berbasis data.');
}
{
  const s = add('ISI', 'Tiga cara memperoleh jawaban implisit', 'Materi SPARQL menyebut tiga cara. Proyek memakai ketiganya: entailment regime GraphDB untuk OWL, query rewriting dengan property path untuk menelusuri penjelasan, dan aturan INSERT untuk pengetahuan pakar.');
  const c3 = [['Entailment regime', 'Mesin menerapkan semantik', 'GraphDB ruleset OWL 2 RL: subclass, equivalentClass, hasValue, transitif dimaterialisasi', K.teal],
    ['Query rewriting', 'Penalaran saat query', 'ex:dependsOn+ menelusuri rantai alasan dari Z01 sampai fakta masukan (penjelasan HOW)', K.teal2],
    ['Rules', 'Forward chaining, materialisasi', '16 aturan INSERT: ambang angka, hitungan resource, negasi; tidak dapat dinyatakan OWL', K.ink]];
  c3.forEach(([h, sub, b, f], i) => {
    const x = 0.6 + i * 4.1;
    box(s, { x, y: 1.55, w: 3.85, h: 4.4, fill: f, shadow: shadow() });
    circle(s, x + 0.3, 1.85, 0.6, K.white, String(i + 1), f, 20);
    T(s, h, { x: x + 0.3, y: 2.65, w: 3.3, h: 0.5, fontSize: 20, bold: true, color: K.white });
    T(s, sub, { x: x + 0.3, y: 3.15, w: 3.3, h: 0.45, fontSize: 14, italic: true, color: 'CFE7DF' });
    T(s, b, { x: x + 0.3, y: 3.7, w: 3.3, h: 2.1, fontSize: 15, color: K.white });
  });
  lecture(s, 'SPARQL-Reasoning, "three ways to obtain answers that are only implicit" dan slide "a practical combination".');
}
{
  const s = add('ISI', 'Jebakan aturan dan cara proyek mengatasinya', 'Empat jebakan aturan dari materi SPARQL. Proyek menghindarinya dengan IRI inferensi yang deterministik, satu negasi yang terkendali, working memory yang dihitung ulang, dan uji paritas dua mesin.');
  table(s, [['Jebakan (materi)', 'Risiko', 'Penanganan di proyek'],
    ['Tidak berhenti', 'Node baru dibuat terus', 'IRI ex:Inference = IRI kasus + ID aturan: deterministik, tidak bertambah di siklus berikutnya'],
    ['Urutan dan negasi (stratifikasi)', 'Hasil bergantung urutan', 'Negasi hanya di C00 atas penandanya sendiri; Z01 dijalankan setelah titik tetap'],
    ['Kesimpulan basi', 'Fakta lama bertahan', 'Working memory dibangun ulang setiap penilaian, lalu dihapus'],
    ['Tanpa semantik standar', 'Beda mesin beda hasil', 'Uji paritas: GraphDB = rdflib untuk level ESI dan aturan terpicu']],
    { x: 0.6, y: 1.55, w: 12.1, colW: [3.0, 2.8, 6.3], rowH: 0.85, fontSize: 14 });
  lecture(s, 'SPARQL-Reasoning, pitfalls: non-termination, order and negation, stale conclusions, no standard semantics.');
}
{
  const s = add('ISI', 'Metaknowledge dan fasilitas penjelasan', 'Materi KR menyebut metaknowledge: aturan mana yang menurunkan fakta, sumber, kepastian. Proyek memakai node PROV-O ex:Inference. Dari node ini sistem menjawab HOW (mengapa ESI 2) dan WHY (mengapa ditanyakan, melalui ex:neededBy).');
  code(s, `:Pasien_inf_E01 a ex:Inference ;     # ⊑ prov:Activity
    ex:usedRule  ex:Rule_E01 ;
    ex:aboutCase :Pasien ;
    ex:concluded ex:ESI_2 ;
    ex:dependsOn :Pasien_inf_C01 ,
                 :Pasien_inf_D01_DZ_HR_3m_3y ;
    ex:reason "Danger zone pada kasus dengan
               kandidat ESI 3: naikkan ke ESI 2" .`, { x: 0.6, y: 1.55, w: 6.6, h: 3.4, fontSize: 14 });
  T(s, [{ text: 'HOW: mengapa ESI 2?', options: { bold: true, fontSize: 18, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Telusuri ex:dependsOn+ dari Z01 sampai fakta masukan; setiap langkah membawa aturan, fakta (prov:used), alasan, sumber.', options: { color: K.ink2, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'WHY: mengapa ditanyakan?', options: { bold: true, fontSize: 18, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'ex:Question ex:neededBy ex:Rule_...: pertanyaan tahu aturan mana yang menunggu jawabannya.', options: { color: K.ink2, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'Dua lapis bahasa', options: { bold: true, fontSize: 18, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Pasien membaca alasan awam (ex:layText); kelas membuka IF-THEN, SPARQL, triple.', options: { color: K.ink2 } }],
    { x: 7.55, y: 1.55, w: 5.15, h: 4.5, fontSize: 15 });
  lecture(s, 'KR-Knowledge-Graphs (anotasi RDF 1.2: metaknowledge "which rule derived a fact") dan Intro ES (penjelasan langkah demi langkah).');
}

// =====================================================================
section('Penutup');
{
  const s = add('GELAP', null, 'Rangkum pemetaan materi ke proyek. Setiap konsep kuliah memiliki bukti konkret di repository.');
  T(s, 'Ringkasan: materi kuliah → proyek', { x: 0.8, y: 0.7, w: 11.5, h: 0.8, fontSize: 36, bold: true, color: K.white });
  const m = [['Tiga blok pembangun', 'GraphDB · app/engine.py · web/'], ['TBox / ABox / named graph', 'graph/tbox · pengetahuan · bukti'], ['Entailment RDFS', 'rdfs2, 3, 7, 9 terverifikasi'],
    ['OWL 2 RL', '+1.775 triple dari reasoner'], ['INSERT = IF-THEN', '16 aturan di kb/rules/'], ['Fixpoint', '8 → 38 → 46 → 46'], ['Dunia tertutup', 'SHACL + NOT EXISTS'], ['Metaknowledge', 'ex:Inference PROV-O: HOW + WHY']];
  m.forEach(([a, b], i) => {
    const x = 0.8 + (i % 2) * 6.0, y = 1.8 + Math.floor(i / 2) * 1.15;
    box(s, { x, y, w: 5.75, h: 0.95, fill: K.dark2 });
    T(s, a, { x: x + 0.25, y, w: 2.8, h: 0.95, fontSize: 16, bold: true, color: K.white, valign: 'middle' });
    T(s, b, { x: x + 3.0, y, w: 2.6, h: 0.95, fontSize: 14, color: K.mint, valign: 'middle' });
  });
  T(s, 'Dokumen lengkap: 01 - Representasi Pengetahuan.md · 02 - Penalaran dan Penjelasan.md', { x: 0.8, y: 6.55, w: 11.5, h: 0.4, fontSize: 13, color: K.mintText });
}

pres.writeFile({ fileName: OUT }).then(f => console.log('ditulis:', f));
