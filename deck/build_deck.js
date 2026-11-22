// Presentasi kelas: Sistem Pakar Triase IGD "Perlu ke IGD?"
// Pemakaian: cd deck && node build_deck.js   -> Presentasi Sistem Pakar Triase IGD.pptx
const pptxgen = require('pptxgenjs');
const path = require('path');

const OUT = path.join(__dirname, 'Presentasi Sistem Pakar Triase IGD.pptx');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.author = 'Hamzah Arman Husni';
pres.title = 'Sistem Pakar Triase IGD: Perlu ke IGD?';
const { K, FONT, A, T, box, circle, arrow, bullets, shadow, shot, add, section } = require('./lib')(pres, 'Sistem Pakar Lanjut · Project Akhir · Triase IGD');

// =====================================================================
section('Pembuka');
{
  const s = add('GELAP', null, 'Perkenalan kelompok dan judul. Sampaikan satu kalimat inti: aplikasi ini membantu orang awam memutuskan perlu ke IGD atau cukup ke klinik, dan setiap keputusan dihasilkan sistem pakar yang dapat ditelusuri sampai aturan dan sumbernya. Lengkapi nama anggota kelompok sebelum presentasi.');
  s.addImage({ path: A('logougm.png'), x: 0.8, y: 0.7, w: 0.85, h: 0.86 });
  T(s, 'Magister Kecerdasan Artifisial · FMIPA UGM\nSistem Pakar Lanjut · Project Akhir', { x: 1.85, y: 0.78, w: 8, h: 0.8, fontSize: 14, color: K.mintText });
  T(s, 'Perlu ke IGD?', { x: 0.8, y: 2.1, w: 11.5, h: 1.2, fontSize: 60, bold: true, color: K.white });
  T(s, 'Sistem pakar triase IGD berbasis knowledge graph, aturan ESI v4, dan forward chaining yang dapat dijelaskan', { x: 0.8, y: 3.35, w: 10.5, h: 1.0, fontSize: 24, color: K.mint });
  T(s, 'Hamzah Arman Husni', { x: 0.8, y: 5.6, w: 8, h: 0.4, fontSize: 18, bold: true, color: K.white });
  T(s, 'Dosen: Prof. Dra. Sri Hartati, M.Sc., Ph.D. · Dr. techn. Kabul Kurniawan, S.Kom., M.Cs.', { x: 0.8, y: 6.05, w: 11, h: 0.4, fontSize: 14, color: K.mintText });
  ['1', '2', '3', '4', '5'].forEach((n, i) => circle(s, 10.0 + i * 0.6, 5.7, 0.48, K.esi[i], n, K.white, 16));
}

// =====================================================================
section('Masalah dan tujuan');
{
  const s = add('ISI', 'Masalah: orang awam sulit menilai tingkat kegawatan', 'Mulai dari masalah nyata. Pasien atau keluarga sering tidak tahu tingkat kegawatan. Di IGD, perawat memakai Emergency Severity Index (ESI) lima level. Grafik dari MC-MED (118.385 kunjungan IGD) memperlihatkan bahwa level ESI benar-benar membedakan luaran: ESI 1 lebih dari separuh berakhir kritis, ESI 4-5 hampir tidak ada. Artinya, keputusan triase yang tepat sangat penting.');
  T(s, [
    { text: 'Masalah', options: { bold: true, fontSize: 20, breakLine: true, paraSpaceAfter: 6 } },
    ...bullets(['Pasien dan keluarga menilai kegawatan dengan tebakan; ada yang terlambat, ada yang memadati IGD tanpa perlu.',
      'Di IGD, perawat menggunakan Emergency Severity Index (ESI) 1-5 sebagai standar triase.',
      'Chatbot LLM murni sulit dipertanggungjawabkan: alasannya tidak dapat ditelusuri.']),
  ], { x: 0.6, y: 1.55, w: 5.4, h: 4.6, fontSize: 16 });
  s.addChart(pres.charts.BAR, [
    { name: 'Rawat inap atau ICU (%)', labels: ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'], values: [85.4, 49.1, 22.3, 2.1, 1.3] },
    { name: 'Luaran kritis (%)', labels: ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'], values: [58.1, 7.1, 0.8, 0.1, 0.0] },
  ], {
    x: 6.4, y: 1.5, w: 6.3, h: 4.7, barDir: 'col', barGrouping: 'clustered', chartColors: [K.teal, K.sos],
    showTitle: true, title: 'Luaran per level ESI, MC-MED (n = 118.385)', titleFontFace: FONT, titleFontSize: 14, titleColor: K.ink,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontFace: FONT, dataLabelFontSize: 10, dataLabelColor: K.ink2, dataLabelFormatCode: '0.0',
    catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, valAxisLabelFontSize: 10, catAxisLabelColor: K.ink2, valAxisLabelColor: K.ink3,
    valGridLine: { color: 'E6EEE9', size: 0.5 }, catGridLine: { style: 'none' }, valAxisMaxVal: 100,
    showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 11, legendColor: K.ink2,
  });
  T(s, 'Sumber: Kansal dkk., MC-MED, Scientific Data 2025; dihitung agregat (kb/evidence.ttl).', { x: 6.4, y: 6.3, w: 6.3, h: 0.3, fontSize: 10, color: K.ink3 });
}
{
  const s = add('ISI', 'Tujuan: chatbot untuk orang awam, otaknya sistem pakar', 'Tiga komponen wajib dari soal dipetakan langsung ke sistem. LLM hanya pelengkap di tepi: mengenali keluhan teks bebas dan merangkai narasi. Level ESI selalu diputuskan aturan.');
  const cols = [
    ['Representasi pengetahuan', 'Ontologi OWL + knowledge graph RDF di GraphDB: konsep klinis, ambang, aturan, dan pertanyaan sebagai data.', K.teal],
    ['Aturan dari pakar', '16 aturan IF-THEN dari ESI Implementation Handbook v4 (Gilboy 2012), Sepsis-3, dan shock index; setiap aturan mencantumkan sumbernya.', K.teal2],
    ['Penalaran + penjelasan', 'Forward chaining SPARQL + reasoner OWL 2 RL. Setiap kesimpulan meninggalkan jejak PROV-O: aturan, fakta, alasan.', K.ink],
  ];
  cols.forEach(([h, b, c], i) => {
    const x = 0.6 + i * 4.1;
    box(s, { x, y: 1.6, w: 3.85, h: 3.55, fill: K.sage, shadow: shadow() });
    circle(s, x + 0.3, 1.9, 0.62, c, String(i + 1), K.white, 20);
    T(s, h, { x: x + 0.3, y: 2.7, w: 3.3, h: 0.5, fontSize: 20, bold: true });
    T(s, b, { x: x + 0.3, y: 3.25, w: 3.3, h: 1.8, fontSize: 15, color: K.ink2 });
  });
  box(s, { x: 0.6, y: 5.45, w: 12.1, h: 1.15, fill: K.soft });
  T(s, [{ text: 'Peran LLM (Claude API): ', options: { bold: true } }, { text: 'hanya mengenali keluhan teks bebas dan menulis narasi penjelasan. Tanpa kunci API, aplikasi tetap berjalan penuh dengan pengenal lokal dari sinonim di knowledge graph.' }],
    { x: 0.9, y: 5.62, w: 11.5, h: 0.85, fontSize: 16, valign: 'middle', color: K.ink });
}

// =====================================================================
section('Arsitektur');
{
  const s = add('ISI', 'Arsitektur: antarmuka awam di depan, sistem pakar di belakang', 'Jelaskan alur dari kiri ke kanan. Jawaban pasien menjadi fakta (working memory). Mesin inferensi menjalankan aturan di GraphDB; reasoner OWL 2 RL GraphDB ikut menurunkan fakta. Hasil dan jejaknya kembali ke antarmuka. Claude bersifat opsional.');
  const node = (x, y, w, h, title, sub, fill, color = K.white) => {
    box(s, { x, y, w, h, fill, shadow: shadow() });
    T(s, title, { x: x + 0.2, y: y + 0.18, w: w - 0.4, h: 0.45, fontSize: 17, bold: true, color });
    T(s, sub, { x: x + 0.2, y: y + 0.62, w: w - 0.4, h: h - 0.75, fontSize: 13, color: color === K.white ? 'D9EDE6' : K.ink2 });
  };
  node(0.6, 2.0, 2.6, 2.1, 'Pasien / keluarga', 'Menjawab 5 pertanyaan: usia, tanda bahaya, keluhan, nyeri, hasil ukur', K.sage, K.ink);
  node(3.75, 2.0, 2.7, 2.1, 'Web (folder web/)', 'HTML/CSS/JS statis; panel "Detail teknis" untuk kuliah', K.teal);
  node(7.0, 2.0, 2.7, 2.1, 'API FastAPI (app/)', '/api/assess, /api/parse, /api/rules; manajer dialog', K.teal2);
  node(10.25, 1.2, 2.45, 2.2, 'Mesin inferensi', 'Agenda aturan dibaca dari graph; siklus sampai titik tetap; resolusi konflik', K.ink);
  node(10.25, 3.8, 2.45, 2.4, 'GraphDB 11', 'Docker · repository triage-es · 127.0.0.1:7201 · ruleset OWL 2 RL; cadangan rdflib in-memory', K.dark);
  arrow(s, 3.2, 3.05, 3.75, 3.05); arrow(s, 6.45, 3.05, 7.0, 3.05); arrow(s, 9.7, 2.6, 10.25, 2.3); arrow(s, 11.47, 3.4, 11.47, 3.8);
  node(7.0, 4.75, 2.7, 1.45, 'Claude API (opsional)', 'Ekstraksi keluhan + narasi', K.sosSoft, K.ink);
  arrow(s, 8.35, 4.1, 8.35, 4.75, K.sos);
  T(s, 'Bukti empiris: statistik agregat MC-MED disimpan sebagai graph/bukti, bukan data per pasien.', { x: 0.6, y: 4.75, w: 6.0, h: 0.9, fontSize: 14, color: K.ink2 });
}

// =====================================================================
section('Representasi pengetahuan');
{
  const s = add('ISI', 'Representasi: dari gudang kunjungan menjadi basis pengetahuan', 'Tugas 4 menyimpan 118 ribu node kunjungan: berguna untuk analisis, tetapi tidak dapat menilai pasien baru. Versi akhir menyimpan pengetahuan (konsep, ambang, aturan) dan memperlakukan pasien sebagai working memory sementara. Data MC-MED tetap digunakan sebagai bukti agregat.');
  const col = (x, head, fill, color, items) => {
    box(s, { x, y: 1.6, w: 5.75, h: 4.85, fill });
    T(s, head, { x: x + 0.35, y: 1.85, w: 5.1, h: 0.5, fontSize: 20, bold: true, color });
    T(s, bullets(items), { x: x + 0.35, y: 2.5, w: 5.1, h: 3.8, fontSize: 15, color });
  };
  col(0.6, 'Tugas 4: berpusat pada kunjungan', K.sage, K.ink, [
    '118.385 node ex:EDVisit dengan angka tanda vital',
    'Aturan R1-R3 hanya teks SPARQL di luar graph',
    'Ambang danger zone hanya dewasa, tertulis di kode',
    'Kesimpulan tanpa jejak: fakta pemicu tidak tercatat',
    'Tidak dapat menilai pasien baru']);
  col(6.95, 'Akhir: berpusat pada pengetahuan', K.dark, K.white, [
    'Konsep klinis sebagai kelas: Finding, Resource, DecisionPoint, AgeGroup',
    'Ambang, resource, sinonim, dan pertanyaan dialog sebagai data di graph',
    '16 aturan sebagai individu ex:Rule dengan sumber dan prioritas',
    'Pasien = working memory satu konsultasi, lalu dihapus',
    'Jejak ex:Inference (PROV-O) untuk setiap kesimpulan']);
  arrow(s, 6.38, 4.0, 6.92, 4.0, K.teal);
}
{
  const s = add('ISI', 'Ontologi OWL: kelas inti dan relasinya', 'Tunjukkan hierarki. Finding dipecah menurut Decision Point ESI: LifeSavingIndicator untuk A, HighRiskSituation dan AlteredMentalStatus untuk B. Kasus yang terdeteksi danger zone menjadi anggota DangerZoneCase. Inference adalah subkelas prov:Activity sehingga penjelasan mengikuti standar W3C.');
  const n = (x, y, w, label, fill, color = K.white) => { box(s, { x, y, w, h: 0.62, fill }); T(s, label, { x, y, w, h: 0.62, align: 'center', valign: 'middle', fontSize: 14, bold: true, color }); };
  n(0.6, 1.6, 2.6, 'ex:Finding', K.teal);
  [['LifeSavingIndicator', 'Decision Point A'], ['HighRiskSituation', 'Decision Point B'], ['AlteredMentalStatus', 'Decision Point B'], ['Symptom', 'gejala umum'], ['RiskFactor', 'mis. imunisasi']].forEach(([c, d], i) => {
    const y = 2.55 + i * 0.78;
    s.addShape(pres.shapes.LINE, { x: 0.95, y: 2.22, w: 0.001, h: y + 0.31 - 2.22, line: { color: K.line, width: 1.25 } });
    s.addShape(pres.shapes.LINE, { x: 0.95, y: y + 0.31, w: 0.35, h: 0.001, line: { color: K.line, width: 1.25 } });
    n(1.3, y, 2.6, c, K.sage, K.ink);
    T(s, d, { x: 4.05, y: y + 0.17, w: 1.9, h: 0.35, fontSize: 12, color: K.ink3 });
  });
  n(6.2, 1.6, 2.6, 'ex:TriageCase', K.ink);
  [['DangerZoneCase', '≡ DangerZoneVisit'], ['QSOFAPositiveCase', 'curiga sepsis']].forEach(([c, d], i) => {
    const y = 2.55 + i * 0.78;
    s.addShape(pres.shapes.LINE, { x: 6.55, y: 2.22, w: 0.001, h: y + 0.31 - 2.22, line: { color: K.line, width: 1.25 } });
    s.addShape(pres.shapes.LINE, { x: 6.55, y: y + 0.31, w: 0.35, h: 0.001, line: { color: K.line, width: 1.25 } });
    n(6.9, y, 2.6, c, K.sage, K.ink);
    T(s, d, { x: 9.65, y: y + 0.17, w: 1.9, h: 0.35, fontSize: 12, color: K.ink3 });
  });
  const props = [['presentsWith', 'TriageCase → Finding'], ['needsResource', 'TriageCase → Resource'], ['candidateESI / recommendedESI', 'TriageCase → ESILevel'],
    ['moreAcuteThan (transitif)', 'ESILevel → ESILevel'], ['usedRule, dependsOn (transitif)', 'Inference ⊑ prov:Activity']];
  box(s, { x: 6.2, y: 4.25, w: 6.5, h: 2.35, fill: K.sage });
  T(s, 'Object property utama', { x: 6.45, y: 4.4, w: 6, h: 0.4, fontSize: 15, bold: true });
  props.forEach(([p, r], i) => T(s, [{ text: p, options: { bold: true, color: K.teal2 } }, { text: '   ' + r, options: { color: K.ink2 } }], { x: 6.45, y: 4.85 + i * 0.33, w: 6.1, h: 0.33, fontSize: 13 }));
}
{
  const s = add('ISI', 'Pengetahuan pakar disimpan sebagai data, bukan kode', 'Inti perbaikan representasi. Sembilan ambang danger zone ESI v4 menjadi individu DangerZoneThreshold. Satu aturan generik D01 membaca ambang dari graph sesuai kelompok usia pasien. Mengubah ambang tidak mengubah kode, dan pengetahuan dapat di-query.');
  const rows = [
    ['Kelompok usia', 'Nadi lebih dari', 'Napas lebih dari', 'SpO2 kurang dari'],
    ['< 3 bulan', '180', '50', '92%'], ['3 bulan - 3 tahun', '160', '40', '92%'], ['3 - 8 tahun', '140', '30', '92%'], ['> 8 tahun', '100', '20', '92%'],
  ].map((r, i) => r.map(c => ({ text: c, options: { bold: i === 0, color: i === 0 ? K.white : K.ink, fill: { color: i === 0 ? K.teal : (i % 2 ? K.white : K.sage) } } })));
  s.addTable(rows, { x: 0.6, y: 1.65, w: 6.6, colW: [2.1, 1.5, 1.5, 1.5], fontFace: FONT, fontSize: 15, rowH: 0.55, border: { type: 'solid', color: K.line, pt: 0.75 }, valign: 'middle', margin: 0.08 });
  T(s, 'Sumber: Gilboy dkk., ESI v4 Implementation Handbook 2012, Gambar 2-1 dan 5-1', { x: 0.6, y: 4.6, w: 6.6, h: 0.3, fontSize: 11, color: K.ink3 });
  s.addText([
    { text: 'ex:DZ_HR_3m_3y', options: { color: K.gold, breakLine: true } },
    { text: '  a ex:DangerZoneThreshold ;', options: { breakLine: true } },
    { text: '  ex:forAgeGroup ex:Age_3m_3y ;', options: { breakLine: true } },
    { text: '  ex:onVital ex:HR ;', options: { breakLine: true } },
    { text: '  ex:comparator "gt" ; ex:limit 160.0 ;', options: { breakLine: true } },
    { text: '  ex:definedBy ex:Rule_D01 .', options: {} },
  ], { isTextBox: true, x: 7.6, y: 1.65, w: 5.1, h: 2.6, fontFace: 'Consolas', fontSize: 13, color: 'DFE9E4', fill: { color: K.dark }, margin: 12, valign: 'middle', rectRadius: 0.12, shape: pres.shapes.ROUNDED_RECTANGLE });
  box(s, { x: 7.6, y: 4.5, w: 5.1, h: 2.1, fill: K.soft });
  T(s, [{ text: 'Data lain di graph yang sama', options: { bold: true, breakLine: true, paraSpaceAfter: 6 } },
    ...bullets(['Resource ESI dan bobotnya (prosedur kompleks = 2)', '43 temuan klinis + sinonim bahasa Indonesia (skos:altLabel)', 'Pertanyaan dialog + aturan yang membutuhkannya'], { fontSize: 14 })],
    { x: 7.85, y: 4.68, w: 4.7, h: 1.8, fontSize: 15 });
}

// =====================================================================
section('Aturan dan penalaran');
{
  const s = add('ISI', '16 aturan IF-THEN mengikuti algoritma ESI v4', 'Aturan dikelompokkan per Decision Point. A: butuh intervensi penyelamatan nyawa. B: risiko tinggi, bingung, nyeri berat, demam bayi. C: jumlah jenis resource. D: danger zone dan uptriage. Ditambah qSOFA, shock index, dan Z01 untuk resolusi konflik. Prioritas aturan dan file SPARQL-nya disimpan di graph.');
  const g = [
    ['A', 'Penyelamatan nyawa → ESI 1', 'A01 temuan mengancam nyawa · A02 SpO2 < 90% · A03 AVPU = P/U', K.esi[0]],
    ['B', 'Risiko tinggi → ESI 2', 'B01 situasi risiko tinggi · B02 bingung baru / AVPU = V · B03 nyeri ≥ 7 · B04-B05 demam bayi < 3 bulan · F01 qSOFA ≥ 2', K.esi[1]],
    ['C', 'Jenis resource → ESI 3 / 4 / 5', 'C00 perkiraan resource dari keluhan (pengguna awam) · C01 hitung bobot resource · C02 demam anak 3 bulan-3 tahun', K.esi[2]],
    ['D', 'Danger zone → naik ke ESI 2', 'D01 tanda vital melewati ambang usia · E01 uptriage bila kandidat ESI 3-5', K.esi[4]],
    ['Z', 'Resolusi konflik', 'Z01 ambil kandidat paling akut · G01 peringatan shock index (tidak mengubah ESI)', K.ink],
  ];
  g.forEach(([k, h, b, c], i) => {
    const y = 1.55 + i * 1.04;
    box(s, { x: 0.6, y, w: 12.1, h: 0.92, fill: i % 2 ? K.white : K.sage });
    circle(s, 0.82, y + 0.17, 0.58, c, k, K.white, 18);
    T(s, h, { x: 1.65, y: y + 0.1, w: 3.6, h: 0.72, fontSize: 17, bold: true, valign: 'middle' });
    T(s, b, { x: 5.3, y: y + 0.1, w: 7.2, h: 0.72, fontSize: 14, color: K.ink2, valign: 'middle' });
  });
  T(s, 'Sumber: Gilboy 2012 (ESI v4) · Singer 2016 (Sepsis-3) · Allgöwer & Burri 1967 (shock index)', { x: 0.6, y: 6.8 - 0.1, w: 10, h: 0.25, fontSize: 10, color: K.ink3 });
}
{
  const s = add('ISI_GELAP', 'Contoh aturan: D01 membaca ambang dari graph', 'Bacakan IF-THEN-nya dulu, baru SPARQL. Aturan ini generik: ambang dicari dari individu DangerZoneThreshold yang cocok dengan kelompok usia. Bagian INSERT menulis kesimpulan sekaligus node ex:Inference berisi alasan; inilah bahan penjelasan.');
  T(s, [{ text: 'IF ', options: { bold: true, color: K.mint } }, { text: 'nilai tanda vital melewati ambang danger zone untuk kelompok usia pasien', options: { color: K.white, breakLine: true } },
    { text: 'THEN ', options: { bold: true, color: K.mint } }, { text: 'kasus termasuk DangerZoneCase, dan catat alasannya', options: { color: K.white } }],
    { x: 0.6, y: 1.5, w: 12.1, h: 0.9, fontSize: 20 });
  const code = `INSERT {
  ?case a ex:DangerZoneCase .
  ?inf a ex:Inference ; ex:usedRule ex:Rule_D01 ; ex:aboutCase ?case ;
       ex:concluded ex:DangerZoneCase ; prov:used ?t ; ex:reason ?why .
}
WHERE {
  ?case a ex:TriageCase ; ?p ?val .  ?p ex:measures ?vital .
  BIND(COALESCE(?m, ?y * 12) AS ?months)
  ?t a ex:DangerZoneThreshold ; ex:onVital ?vital ; ex:forAgeGroup ?g ;
     ex:comparator ?cmp ; ex:limit ?lim .
  ?g ex:minMonths ?lo ; ex:maxMonths ?hi .
  FILTER(?months >= ?lo && ?months < ?hi)
  FILTER((?cmp = "gt" && ?val > ?lim) || (?cmp = "lt" && ?val < ?lim))
}`;
  s.addText(code, { isTextBox: true, x: 0.6, y: 2.6, w: 8.3, h: 3.95, fontFace: 'Consolas', fontSize: 12.5, color: 'CFE0D8', fill: { color: '0A110E' }, margin: 12, valign: 'top', line: { color: K.darkLine, width: 1 } });
  box(s, { x: 9.2, y: 2.6, w: 3.5, h: 3.95, fill: K.dark2 });
  T(s, [{ text: 'Hasil pada anak 2 tahun, nadi 170', options: { bold: true, color: K.white, breakLine: true, paraSpaceAfter: 8 } },
    { text: '"Denyut jantung = 170 > 160 (kelompok usia 3 bulan - 3 tahun)"', options: { color: K.gold, italic: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: 'Ambang 160 dipilih otomatis dari graph. Dengan ambang dewasa Tugas 4 (100), anak 2 tahun dengan nadi 150 akan keliru ditandai.', options: { color: K.mintText } }],
    { x: 9.45, y: 2.85, w: 3.05, h: 3.5, fontSize: 14 });
}
{
  const s = add('ISI', 'Penalaran: forward chaining sampai titik tetap', 'Tiga lapis penalaran: entailment RDFS, OWL 2 RL oleh reasoner GraphDB, dan aturan produksi SPARQL. Siklus match-resolve-act diulang karena E01 membutuhkan hasil C01 dan D01. Setelah tidak ada triple baru, Z01 memilih kandidat paling akut.');
  const steps = [['Fakta pasien', 'working memory (triple)', K.sage, K.ink], ['Cocokkan aturan', 'urut prioritas dari graph', K.teal, K.white], ['Tambah fakta', 'INSERT + node Inference', K.teal2, K.white],
    ['Titik tetap?', 'ulang bila ada triple baru', K.ink, K.white], ['Resolusi konflik', 'Z01: kandidat paling akut', K.esi[1], K.white]];
  steps.forEach(([h, b, f, c], i) => {
    const x = 0.6 + i * 2.48;
    box(s, { x, y: 1.75, w: 2.2, h: 1.55, fill: f, shadow: shadow() });
    T(s, h, { x: x + 0.18, y: 1.92, w: 1.9, h: 0.5, fontSize: 17, bold: true, color: c });
    T(s, b, { x: x + 0.18, y: 2.42, w: 1.9, h: 0.75, fontSize: 13, color: c === K.white ? 'D9EDE6' : K.ink2 });
    if (i < 4) arrow(s, x + 2.2, 2.52, x + 2.48, 2.52);
  });
  s.addShape(pres.shapes.LINE, { x: 8.05, y: 3.3, w: 0.001, h: 0.4, line: { color: K.ink3, width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: 3.18, y: 3.7, w: 4.87, h: 0.001, line: { color: K.ink3, width: 1.5 } });
  arrow(s, 3.18, 3.7, 3.18, 3.3);
  T(s, 'ya, ada triple baru', { x: 4.6, y: 3.78, w: 2.4, h: 0.3, fontSize: 12, color: K.ink3, italic: true });
  const lay = [['RDFS', 'subClassOf, subPropertyOf, domain, range'], ['OWL 2 RL (GraphDB)', 'equivalentClass, TransitiveProperty, hasValue: mis. DangerZoneCase ≡ DangerZoneVisit'], ['Aturan SPARQL', '16 aturan produksi, menulis kesimpulan + jejak PROV-O']];
  lay.forEach(([h, b], i) => {
    const x = 0.6 + i * 4.1;
    box(s, { x, y: 4.45, w: 3.85, h: 2.05, fill: K.sage });
    T(s, `Lapis ${i + 1}`, { x: x + 0.25, y: 4.62, w: 3.4, h: 0.3, fontSize: 12, color: K.ink3, bold: true });
    T(s, h, { x: x + 0.25, y: 4.92, w: 3.4, h: 0.45, fontSize: 18, bold: true });
    T(s, b, { x: x + 0.25, y: 5.4, w: 3.4, h: 1.0, fontSize: 14, color: K.ink2 });
  });
}
{
  const s = add('ISI', 'Jejak penalaran: anak 2 tahun, demam 39,4 °C, nadi 170', 'Ikuti satu kasus. Siklus 1: C00 memperkirakan resource dari keluhan, C01 menghitungnya menjadi ESI 3, C02 demam anak juga ESI 3, D01 mendeteksi danger zone, dan reasoner GraphDB menurunkan DangerZoneVisit. Siklus 2: E01 menaikkan ke ESI 2 karena bergantung pada C01 dan D01. Siklus 3 tidak ada triple baru, lalu Z01 memilih ESI 2.');
  const tl = [
    ['Siklus 1', 'C00', 'Perkiraan resource dari keluhan: lab, rontgen', 'resource dinilai', K.teal],
    ['Siklus 1', 'C01', 'Bobot resource = 2', 'kandidat ESI 3', K.esi[2]],
    ['Siklus 1', 'C02', 'Anak 3 bulan-3 tahun, suhu 39,4 °C > 39,0 °C', 'kandidat ESI 3', K.esi[2]],
    ['Siklus 1', 'D01', 'Nadi 170 > 160 untuk usia 3 bulan-3 tahun', 'DangerZoneCase', K.esi[4]],
    ['Siklus 1', 'OWL', 'Reasoner GraphDB: DangerZoneCase ≡ DangerZoneVisit', '+1 triple implisit', K.ink3],
    ['Siklus 2', 'E01', 'Danger zone + kandidat ESI 3 → naikkan (bergantung C01, D01)', 'kandidat ESI 2', K.esi[1]],
    ['Siklus 3', 'Z01', 'Tidak ada triple baru → pilih kandidat paling akut', 'ESI 2: Gawat', K.esi[1]],
  ];
  s.addShape(pres.shapes.LINE, { x: 2.0, y: 1.7, w: 0.001, h: 4.95, line: { color: K.line, width: 2 } });
  tl.forEach(([c, id, r, out, col], i) => {
    const y = 1.55 + i * 0.72;
    T(s, c, { x: 0.6, y: y + 0.18, w: 1.2, h: 0.3, fontSize: 12, color: K.ink3, bold: true });
    s.addShape(pres.shapes.OVAL, { x: 1.88, y: y + 0.21, w: 0.24, h: 0.24, fill: { color: col }, line: { color: K.white, width: 1.5 } });
    box(s, { x: 2.35, y, w: 10.35, h: 0.62, fill: i % 2 ? K.white : K.sage });
    T(s, id, { x: 2.55, y, w: 0.8, h: 0.62, fontSize: 15, bold: true, color: col, valign: 'middle', fontFace: 'Consolas' });
    T(s, r, { x: 3.45, y, w: 6.5, h: 0.62, fontSize: 14, valign: 'middle', color: K.ink });
    T(s, out, { x: 10.05, y, w: 2.5, h: 0.62, fontSize: 14, valign: 'middle', bold: true, color: col, align: 'right' });
  });
}
{
  const s = add('ISI', 'Fasilitas penjelasan: HOW dan WHY', 'Dua jenis penjelasan klasik sistem pakar. HOW: mengapa kesimpulannya ESI 2, ditelusuri mundur melalui dependsOn sampai fakta masukan. WHY: mengapa sistem menanyakan sesuatu, dijawab oleh aturan yang membutuhkan pertanyaan itu (ex:neededBy). Untuk pasien, penjelasan ditulis ulang dalam bahasa awam; detail teknis ada di laci tersendiri.');
  shot(s, 'laptop-1366-10-teknis-jejak.png', 6.3, 1.6, 6.4);
  T(s, [
    { text: 'HOW: mengapa ESI 2?', options: { bold: true, fontSize: 19, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Setiap aturan yang terpicu menulis node ex:Inference: aturan, fakta yang digunakan (prov:used), alasan, dan ex:dependsOn (transitif) ke inferensi sebelumnya.', options: { color: K.ink2, breakLine: true, paraSpaceAfter: 14 } },
    { text: 'WHY: mengapa ditanyakan?', options: { bold: true, fontSize: 19, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Setiap pertanyaan dialog adalah individu ex:Question dengan ex:neededBy ke aturan yang membutuhkan jawabannya.', options: { color: K.ink2, breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Dua lapis bahasa', options: { bold: true, fontSize: 19, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Pasien membaca alasan awam (ex:layText); dosen dan mahasiswa membuka IF-THEN, SPARQL, dan triple.', options: { color: K.ink2 } },
  ], { x: 0.6, y: 1.6, w: 5.3, h: 5.0, fontSize: 15 });
}

// =====================================================================
section('Aplikasi');
{
  const s = add('ISI', 'Aplikasi untuk orang awam: satu pertanyaan per layar', 'Demo langsung di bagian ini. Tunjukkan pilihan siapa yang sakit, pertanyaan tanda bahaya yang langsung ke hasil bila ada, daftar keluhan yang disaring per usia, dan tombol 119 yang selalu terlihat.');
  shot(s, 'laptop-1366-01-sambutan.png', 0.6, 1.6, 5.9);
  shot(s, 'laptop-1366-04-keluhan.png', 6.8, 1.6, 5.9);
  T(s, 'Persona jelas: saya, anak saya, orang lain · logika usia (balita: skala nyeri perilaku)', { x: 0.6, y: 5.05, w: 5.9, h: 0.7, fontSize: 14, color: K.ink2 });
  T(s, 'Keluhan mendesak di atas, disaring per usia · ringkasan jawaban dengan tautan Ubah', { x: 6.8, y: 5.05, w: 5.9, h: 0.7, fontSize: 14, color: K.ink2 });
  box(s, { x: 0.6, y: 5.9, w: 12.1, h: 0.75, fill: K.sosSoft });
  T(s, 'Tombol "Darurat? Telepon 119" (PSC 119, layanan gawat darurat medis nasional) selalu terlihat di setiap layar.', { x: 0.85, y: 5.9, w: 11.6, h: 0.75, fontSize: 15, valign: 'middle', color: '7D1D10' });
}
{
  const s = add('ISI', 'Hasil: apa yang dilakukan sekarang, dan mengapa', 'Hasil menjawab tiga hal: tindakan (segera ke IGD, telepon 119, cari IGD terdekat), alasan dalam bahasa awam yang disusun dari jejak aturan, dan ringkasan untuk petugas IGD. Level ESI tetap terlihat sebagai tingkat 1-5.');
  shot(s, 'laptop-1366-07-hasil.png', 0.6, 1.6, 7.6);
  s.addImage({ path: A('mobile-390-07-hasil.png'), x: 8.7, y: 1.55, w: 2.2, h: 2.2 * 844 / 390 });
  T(s, [{ text: 'Laptop dan HP', options: { bold: true, breakLine: true, paraSpaceAfter: 6 } }, ...bullets(['Tingkat 1-5 + warna + kata', 'Alasan awam dari aturan', 'Ringkasan untuk petugas', 'Bukan diagnosis'], { fontSize: 14 })],
    { x: 11.1, y: 1.6, w: 1.65, h: 3.5, fontSize: 15 });
}

// =====================================================================
section('Evaluasi');
{
  const s = add('ISI', 'Pengujian: 52 tes otomatis + 2 putaran audit UX', 'Pengujian berlapis. Kasus emas per aturan termasuk kasus batas ambang (nadi tepat 100, usia tepat 36 bulan). Paritas memastikan GraphDB dan rdflib memberi hasil yang sama. Playwright menguji alur pengguna di browser sungguhan. Audit UX dilakukan agen terpisah dari sudut pandang pengguna awam.');
  const stats = [['23', 'kasus emas aturan', 'termasuk batas ambang'], ['8', 'uji paritas', 'GraphDB = rdflib'], ['6', 'uji end-to-end', 'Playwright di Chrome'], ['52', 'total tes lulus', 'pytest']];
  stats.forEach(([n, h, b], i) => {
    const x = 0.6 + i * 3.08;
    box(s, { x, y: 1.6, w: 2.85, h: 2.2, fill: i === 3 ? K.teal : K.sage });
    T(s, n, { x: x + 0.25, y: 1.75, w: 2.4, h: 0.95, fontSize: 54, bold: true, color: i === 3 ? K.white : K.teal });
    T(s, h, { x: x + 0.25, y: 2.75, w: 2.4, h: 0.4, fontSize: 16, bold: true, color: i === 3 ? K.white : K.ink });
    T(s, b, { x: x + 0.25, y: 3.15, w: 2.4, h: 0.4, fontSize: 13, color: i === 3 ? 'D9EDE6' : K.ink3 });
  });
  T(s, 'Contoh kasus emas', { x: 0.6, y: 4.15, w: 6, h: 0.4, fontSize: 17, bold: true });
  const rows = [['Kasus', 'ESI', 'Aturan'], ['Lansia apnea', '1', 'A01'], ['Dewasa nyeri dada', '2', 'B01'], ['Anak 2 th, nadi 150', '3', 'C01 (bukan danger zone)'], ['Anak 2 th, nadi 170', '2', 'D01 + E01'], ['Dewasa ruam, tanpa resource', '5', 'C00 + C01']]
    .map((r, i) => r.map(c => ({ text: c, options: { bold: i === 0, color: i === 0 ? K.white : K.ink, fill: { color: i === 0 ? K.ink : (i % 2 ? K.white : K.sage) } } })));
  s.addTable(rows, { x: 0.6, y: 4.6, w: 7.2, colW: [3.2, 0.8, 3.2], fontFace: FONT, fontSize: 13, rowH: 0.34, border: { type: 'solid', color: K.line, pt: 0.5 }, margin: 0.06 });
  box(s, { x: 8.2, y: 4.15, w: 4.5, h: 2.5, fill: K.soft });
  T(s, [{ text: 'Audit UX oleh agen ux-auditor', options: { bold: true, breakLine: true, paraSpaceAfter: 6 } },
    ...bullets(['Putaran 1: 4 P1, 13 P2 (tombol di bawah lipatan, persona ambigu, istilah teknis)', 'Putaran 2: 20 dari 23 selesai; P1 baru diperbaiki', 'Pelajaran dicatat di skill ui-audit'], { fontSize: 13 })],
    { x: 8.45, y: 4.3, w: 4.05, h: 2.25, fontSize: 15 });
}
{
  const s = add('ISI', 'Keterbatasan dan pengembangan berikutnya', 'Sampaikan keterbatasan dengan jujur. Sistem belum divalidasi pakar klinis; MC-MED hanya dewasa sehingga aturan anak belum diuji pada data; perkiraan resource dari keluhan masih pendekatan. Pengembangan: validasi pakar, evaluasi pada MIMIC-IV-ED, dan penanganan ketidakpastian.');
  const items = [
    ['Belum divalidasi pakar klinis', 'Aturan bersumber dari handbook ESI; perlu ditinjau perawat atau dokter IGD sebelum digunakan nyata.', 'Validasi pakar + revisi aturan'],
    ['Data validasi hanya dewasa', 'MC-MED berusia 18-90 tahun; aturan pediatrik belum diuji pada data.', 'Evaluasi di MIMIC-IV-ED dan data pediatrik'],
    ['Perkiraan resource dari keluhan', 'ex:typicalResource masih pendekatan dari contoh kasus handbook.', 'Kalibrasi dengan data kunjungan'],
    ['Ketidakpastian belum dimodelkan', 'Aturan bersifat tegas; jawaban awam dapat ragu-ragu.', 'Certainty factor atau logika fuzzy (materi sebelum UTS)'],
  ];
  items.forEach(([h, b, n], i) => {
    const y = 1.55 + i * 1.27;
    box(s, { x: 0.6, y, w: 12.1, h: 1.12, fill: i % 2 ? K.white : K.sage });
    T(s, h, { x: 0.9, y: y + 0.15, w: 3.6, h: 0.85, fontSize: 17, bold: true, valign: 'middle' });
    T(s, b, { x: 4.6, y: y + 0.15, w: 4.9, h: 0.85, fontSize: 14, color: K.ink2, valign: 'middle' });
    T(s, n, { x: 9.7, y: y + 0.15, w: 2.8, h: 0.85, fontSize: 14, bold: true, color: K.teal2, valign: 'middle' });
  });
}

// =====================================================================
section('Penutup');
{
  const s = add('GELAP', null, 'Tutup dengan tiga kesimpulan, lalu buka sesi tanya jawab dan demo bila diminta. Sebutkan bahwa kode dan cara menjalankan tersedia di repository.');
  T(s, 'Kesimpulan', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 40, bold: true, color: K.white });
  const k = [
    ['Representasi', 'Knowledge graph berpusat pada pengetahuan: konsep, ambang, aturan, dan pertanyaan sebagai data di GraphDB.'],
    ['Penalaran', '16 aturan ESI v4 dijalankan forward chaining bersama reasoner OWL 2 RL; setiap kesimpulan dapat ditelusuri.'],
    ['Manfaat', 'Orang awam mendapat saran yang jelas dalam bahasa sehari-hari; pengajar dapat membuka penalarannya lapis demi lapis.'],
  ];
  k.forEach(([h, b], i) => {
    const x = 0.8 + i * 4.0;
    box(s, { x, y: 2.0, w: 3.7, h: 3.0, fill: K.dark2 });
    circle(s, x + 0.3, 2.3, 0.6, K.mint, String(i + 1), K.dark, 20);
    T(s, h, { x: x + 0.3, y: 3.05, w: 3.1, h: 0.45, fontSize: 20, bold: true, color: K.white });
    T(s, b, { x: x + 0.3, y: 3.55, w: 3.1, h: 1.4, fontSize: 14, color: 'CFE0D8' });
  });
  T(s, 'Terima kasih · Pertanyaan dan demo', { x: 0.8, y: 5.6, w: 11, h: 0.6, fontSize: 26, bold: true, color: K.mint });
  T(s, 'Jalankan: python -m app.graphdb  →  uvicorn app.main:app  →  http://localhost:8000', { x: 0.8, y: 6.25, w: 11.5, h: 0.4, fontSize: 14, color: K.mintText, fontFace: 'Consolas' });
}

pres.writeFile({ fileName: OUT }).then(f => console.log('ditulis:', f));
