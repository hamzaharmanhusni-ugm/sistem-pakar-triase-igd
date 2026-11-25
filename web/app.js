// "Perlu ke IGD?": alur tanya-jawab untuk pasien/keluarga di atas backend sistem pakar triase (ESI v4).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = s => String(s).replace(/(\d)\.0\b/g, '$1').replace(/(\d)\.(\d)/g, '$1,$2');
const dec = v => String(v).replace('.', ',');
const fmt = n => Number(n).toLocaleString('id-ID');
const pct = x => (x * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + '%';

/* ---------- label awam yang dipetakan ke ID temuan di knowledge graph ---------- */
const DANGER = [
  ['Unresponsive', 'Tidak sadar atau tidak dapat dibangunkan'],
  ['Apnea', 'Tidak bernapas, atau napasnya megap-megap'],
  ['SevereRespDistress', 'Sesak berat sampai sulit bicara, atau bibir kebiruan'],
  ['MajorBleeding', 'Perdarahan hebat yang tidak mau berhenti'],
];
// [id, label, untuk siapa]: all = semua usia, adult = 12 tahun ke atas, kid = di bawah 5 tahun
const URGENT = [
  ['ChestPainACS', 'Nyeri dada seperti ditekan', 'adult'], ['StrokeSigns', 'Wajah mencong, bicara pelo, atau lemah sebelah badan', 'adult'],
  ['NewConfusion', 'Bingung atau mengantuk terus (baru terjadi)', 'all'], ['ModerateRespDistress', 'Sesak napas atau napas berbunyi', 'all'],
  ['ThunderclapHeadache', 'Sakit kepala hebat yang tiba-tiba', 'adult'], ['GIBleeding', 'Muntah darah atau BAB hitam', 'all'],
  ['HeadInjuryLOC', 'Kepala terbentur lalu pingsan atau muntah', 'all'], ['HighRiskMechanism', 'Kecelakaan atau jatuh dari ketinggian', 'all'],
  ['EctopicRisk', 'Hamil muda dengan nyeri perut atau perdarahan', 'adult'], ['DroolingDysphagia', 'Sulit menelan sampai air liur menetes', 'all'],
  ['InfantSevereDehydration', 'Tidak mau minum atau tidak pipis sejak lama', 'kid'], ['SuicidalIdeation', 'Ingin menyakiti diri sendiri', 'adult'],
];
const COMMON = [
  ['Fever', 'Demam', 'all'], ['Cough', 'Batuk atau pilek', 'all'], ['SoreThroat', 'Sakit tenggorokan', 'all'], ['VomitingDiarrhea', 'Mual, muntah, atau diare', 'all'],
  ['AbdominalPain', 'Nyeri perut', 'all'], ['Headache', 'Sakit kepala biasa', 'all'], ['Sprain', 'Keseleo atau terkilir', 'all'], ['MinorLaceration', 'Luka kecil atau tergores', 'all'],
  ['UrinarySymptom', 'Nyeri saat buang air kecil', 'all'], ['MinorRash', 'Gatal atau ruam', 'all'], ['IncompleteImmunization', 'Imunisasi belum lengkap', 'toddler'],
];
const LABEL = Object.fromEntries([...DANGER, ...URGENT, ...COMMON].map(([id, t]) => [id, t]));
const RES_LAY = { 'Laboratorium (darah, urin)': 'cek darah atau urin', 'EKG atau rontgen': 'rekam jantung atau rontgen', 'CT, MRI, USG, atau angiografi': 'CT scan atau USG',
  'Cairan IV (hidrasi)': 'infus', 'Obat IV, IM, atau nebulisasi': 'obat suntik atau uap', 'Konsultasi spesialis': 'dokter spesialis', 'Prosedur sederhana': 'tindakan kecil seperti jahit luka',
  'Prosedur kompleks (sedasi)': 'tindakan dengan obat bius' };
const PAIN_WORD = ['Tidak nyeri', 'Sangat ringan', 'Ringan', 'Ringan', 'Sedang', 'Sedang', 'Cukup berat', 'Berat', 'Sangat berat', 'Sangat berat', 'Tak tertahankan'];
const PAIN_COLOR = i => `hsl(${Math.round(150 - i * 14)} 55% ${i > 6 ? 42 : 38}%)`;
const KID_PAIN = [[0, 'Tenang', 'bermain atau tidur seperti biasa'], [4, 'Rewel, tetapi dapat ditenangkan', 'mau digendong atau disusui'], [8, 'Menangis terus, tidak dapat ditenangkan', 'atau terlihat sangat kesakitan']];
const ESI_WORD = ['', 'Darurat', 'Gawat', 'Mendesak', 'Kurang mendesak', 'Tidak mendesak'];
const DPS = [['A', 'Butuh pertolongan untuk menyelamatkan nyawa?'], ['B', 'Situasi berisiko tinggi, bingung, atau nyeri berat?'],
  ['C', 'Berapa jenis pemeriksaan yang dibutuhkan?'], ['D', 'Tanda vital di luar batas aman?']];
const MAPS = q => `https://www.google.com/maps/search/${encodeURIComponent(q)}`;

/* ---------- state ---------- */
const BLANK = () => ({ step: 0, mode: null, who: null, age: '', unit: 'tahun', danger: [], dangerNone: false, findings: [], pain: null, m: {}, result: null,
  sex: null, preg: null, cond: [], meds: [], sites: [], onset: null, sudden: null, avpu: null, res: [] });
const S = BLANK();
const STEPS = ['welcome', 'age', 'danger', 'complaint', 'history', 'pain', 'measure', 'result', 'nurse'];
const I = Object.fromEntries(STEPS.map((k, i) => [k, i]));
const Q_STEPS = 6;
let VOC = null, VL = {};  // pilihan jawaban dari knowledge graph (/api/vocab), VL: id -> label
const nurse = () => S.mode === 'nurse';
const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
const WHO = { self: ['Anda', 'Anda'], child: ['anak Anda', 'Anak Anda'], adult: ['orang yang sakit', 'Orang yang sakit'] };
const subj = (cap = false) => (WHO[S.who] || WHO.adult)[cap ? 1 : 0];
const MIN_AGE = { self: 12, adult: 18 };  // ponytail: anak di bawah 12 tahun diisi orang tua lewat "Anak saya"

const ageVal = () => parseFloat(String(S.age).replace(',', '.'));
function ageYears() {
  const v = ageVal();
  if (isNaN(v)) return null;
  return S.unit === 'tahun' ? v : S.unit === 'bulan' ? v / 12 : v / 365;
}
function ageOk() {
  const v = ageVal();
  if (isNaN(v) || v < 0) return false;
  if (nurse()) return S.unit === 'tahun' ? v <= 120 : S.unit === 'bulan' ? v <= 36 : v <= 1095;
  if (S.who === 'child') return S.unit === 'tahun' ? v <= 17 : S.unit === 'bulan' ? v <= 36 : v <= 1095;
  return S.unit === 'tahun' && v >= MIN_AGE[S.who] && v <= 120;
}
function ageHint() {
  const v = ageVal();
  if (isNaN(v)) return '';
  if (S.who === 'child' && S.unit === 'tahun' && v > 17) return 'Untuk usia 18 tahun ke atas, kembali ke awal dan pilih "Orang lain (dewasa)".';
  if (S.who !== 'child' && v < MIN_AGE[S.who]) return `Untuk anak di bawah ${MIN_AGE[S.who]} tahun, kembali ke awal dan pilih "Anak saya".`;
  return '';
}
const ageText = () => isNaN(ageVal()) ? '' : `${dec(S.age)} ${S.unit}`;
const fits = tag => { const y = ageYears() ?? 30; return tag === 'all' || (tag === 'adult' && y >= 12) || (tag === 'kid' && y < 5) || (tag === 'toddler' && y < 3); };

function safeLimits() {  // ambang danger zone ESI v4 (sama dengan kb/knowledge.ttl), untuk teks bantu
  const m = (ageYears() ?? 30) * 12;
  return m < 3 ? [180, 50] : m < 36 ? [160, 40] : m < 96 ? [140, 30] : [100, 20];
}

function facts() {
  const f = { findings: [...new Set([...S.danger, ...S.findings])] };
  const v = ageVal();
  if (!isNaN(v)) {
    if (S.unit === 'tahun') f.age_years = v;
    else f.age_months = Math.min(36, S.unit === 'bulan' ? v : +(v / 30.4).toFixed(2));
  }
  if (S.pain !== null) f.pain = S.pain;
  for (const k of ['temp', 'hr', 'rr', 'spo2', 'sbp']) if (S.m[k]) f[k] = parseFloat(String(S.m[k]).replace(',', '.'));
  Object.assign(f, { conditions: S.cond, medications: S.meds, pain_sites: S.sites });
  for (const [k, v] of [['onset', S.onset], ['onset_sudden', S.sudden], ['pregnancy', S.preg], ['sex', S.preg && S.preg !== 'Preg_No' ? 'Sex_F' : S.sex]]) if (v !== null) f[k] = v;
  if (nurse()) Object.assign(f, { mode: 'nurse', resources: S.res }, S.avpu ? { avpu: S.avpu } : {});
  return f;
}
function vitalError() {
  const lim = { temp: [30, 45, 'Suhu', '°C'], hr: [20, 300, 'Denyut nadi', 'kali/menit'], rr: [4, 100, 'Napas', 'kali/menit'], spo2: [50, 100, 'Kadar oksigen', '%'], sbp: [40, 300, 'Tekanan darah sistolik', 'mmHg'] };
  const val = k => parseFloat(String(S.m[k]).replace(',', '.'));
  const bad = Object.entries(lim).find(([k, [lo, hi]]) => S.m[k] && !(val(k) >= lo && val(k) <= hi));
  return bad ? `${bad[1][2]} sepertinya tidak sesuai (seharusnya antara ${bad[1][0]} dan ${bad[1][1]} ${bad[1][3]}). Periksa lagi atau kosongkan.` : '';
}

async function assess() {
  const res = await fetch('/api/assess', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(facts()) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  const data = await res.json();
  S.result = data.result;
  renderMind();
  return data;
}

/* ---------- komponen ---------- */
const pressed = b => `aria-pressed="${!!b}"`;
const tick = '<span class="tick"><svg class="ic"><use href="#i-check"/></svg></span>';
const arrow = '<svg class="ic"><use href="#i-next"/></svg>';
function progress() {
  const i = S.step;
  return `<div class="progress">
    <button class="back" type="button" data-act="back" aria-label="Kembali"><svg class="ic"><use href="#i-back"/></svg></button>
    <div class="bar" aria-hidden="true">${Array.from({ length: Q_STEPS }, (_, k) => `<span class="${k + 1 < i ? 'done' : k + 1 === i ? 'now' : ''}"></span>`).join('')}</div>
    <span class="count">Langkah ${i} dari ${Q_STEPS}</span></div>`;
}
const cta = (label, ok, hint, act = 'next', cls = 'primary') =>
  `<div class="cta"><button class="btn ${cls}" type="button" data-act="${act}" id="next" ${ok ? '' : 'disabled'}>${label} ${arrow}</button>${ok || !hint ? '' : `<span class="cta-hint">${hint}</span>`}</div>`;

/* ---------- layar ---------- */
const VIEWS = {
  welcome: () => `<div class="welcome">
      <h1>Triase IGD dengan sistem pakar ESI.</h1>
      <p class="lead">Perawat menentukan level ESI 1-5 dari formulir triase lengkap. Pasien atau keluarga dapat memeriksa perlu ke IGD atau cukup ke klinik. Setiap hasil disertai alasan dan sumber aturannya.</p>
      <div class="q-body">
        <p class="sub-label">Anda menggunakan aplikasi ini sebagai</p>
        <div class="roles">
          <button class="opt" type="button" data-act="mode" data-v="nurse" ${pressed(S.mode === 'nurse')}>${tick}<span>Perawat triase<small>Formulir lengkap: keluhan, onset, riwayat, tanda vital, AVPU, resource</small></span></button>
          <button class="opt" type="button" data-act="mode" data-v="lay" ${pressed(S.mode === 'lay')}>${tick}<span>Pasien atau keluarga<small>6 pertanyaan sederhana, hasil berupa saran tindakan</small></span></button>
        </div>
        ${S.mode === 'lay' ? `<p class="sub-label">Siapa yang sedang sakit?</p>
        <div class="who">
          ${[['self', 'Saya sendiri'], ['child', 'Anak saya'], ['adult', 'Orang lain (dewasa)']].map(([k, t]) =>
            `<button class="opt" type="button" data-act="who" data-v="${k}" ${pressed(S.who === k)}>${tick}${t}</button>`).join('')}
        </div>` : ''}
      </div>
      ${keyBox()}
      ${S.mode === 'nurse' ? cta('Buka formulir triase', !!VOC, 'Memuat pilihan dari knowledge graph...', 'nurse-open') : cta('Mulai cek', S.mode === 'lay' && !!S.who, S.mode ? 'Pilih dulu siapa yang sedang sakit.' : 'Pilih peran Anda.')}</div>`,

  age: () => `${progress()}
    <h1 class="q-title">Berapa usia ${subj()}?</h1>
    <p class="q-help">Usia menentukan batas aman denyut nadi, napas, dan suhu.${S.who === 'child' ? ' Untuk bayi, pilih bulan atau hari.' : ''}</p>
    <div class="q-body">
      <div class="age">
        <input class="field" id="age" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(S.age)}" aria-label="Usia">
        <div class="seg" role="group" aria-label="Satuan usia">${(S.who === 'child' ? ['tahun', 'bulan', 'hari'] : ['tahun']).map(u =>
          `<button type="button" data-act="unit" data-v="${u}" ${pressed(S.unit === u)}>${u}</button>`).join('')}</div>
      </div>
      <p class="note warn" id="age-hint">${ageHint()}</p>
    </div>
    ${cta('Lanjut', ageOk(), 'Isi usia untuk melanjutkan.')}`,

  danger: () => `${progress()}
    <h1 class="q-title">Apakah ${subj()} mengalami salah satu kondisi ini sekarang?</h1>
    <p class="q-help">Ini tanda bahaya yang paling penting. Pilih semua yang sesuai.</p>
    <div class="q-body">
      ${DANGER.map(([id, t]) => `<button class="opt danger" type="button" data-act="danger" data-v="${id}" ${pressed(S.danger.includes(id))}>${tick}${t}</button>`).join('')}
      <button class="opt" type="button" data-act="dangerNone" ${pressed(S.dangerNone)}>${tick}Tidak ada yang sesuai</button>
    </div>
    ${S.danger.length ? `<div class="cta"><p class="note warn" role="status" style="flex-basis:100%;margin:0">Ada tanda bahaya yang mengancam nyawa, sehingga pertanyaan lain dilewati. Segera telepon 119 atau ke IGD terdekat.</p><a class="btn sos-btn" href="tel:119"><svg class="ic"><use href="#i-phone"/></svg>Telepon 119</a><button class="btn ghost" type="button" data-act="next" id="next">Lanjut ke hasil ${arrow}</button></div>` : cta('Lanjut', S.dangerNone, 'Pilih kondisi yang sesuai, atau "Tidak ada yang sesuai".')}`,

  complaint: () => {
    const chip = ([id, t], alarm) => `<button class="chip ${alarm ? 'alarm' : ''}" type="button" data-act="finding" data-v="${id}" ${pressed(S.findings.includes(id))}>${t}</button>`;
    return `${progress()}
    <h1 class="q-title">Apa yang dirasakan ${subj()}?</h1>
    <p class="q-help">Pilih semua keluhan yang sesuai, atau ceritakan dengan kata-kata sendiri.</p>
    <div class="q-body">
      <p class="sub-label">Perlu perhatian segera</p>
      <div class="chips">${URGENT.filter(([, , g]) => fits(g)).map(x => chip(x, true)).join('')}</div>
      <p class="sub-label">Keluhan umum</p>
      <div class="chips">${COMMON.filter(([, , g]) => fits(g) && (g !== 'toddler' || S.who === 'child')).map(x => chip(x)).join('')}</div>
      <p class="sub-label">Ceritakan sendiri</p>
      <form class="own" data-act="parse"><input class="field" id="own" autocomplete="off" placeholder="Contoh: dada terasa berat sejak tadi pagi" aria-label="Ceritakan keluhan"><button class="btn ghost sm" type="submit">Kenali</button></form>
      <p class="note" id="found"></p>
    </div>
    ${cta('Lanjut', S.findings.length > 0, 'Pilih minimal satu keluhan.')}`;
  },

  history: () => {
    const chips = (list, sel, act) => list.map(o => `<button class="chip" type="button" data-act="${act}" data-v="${o.id}" ${pressed(sel(o.id))}>${esc(o.label)}</button>`).join('');
    const canPregnant = S.who !== 'child' && (ageYears() ?? 0) >= 12 && (ageYears() ?? 0) <= 55;
    if (!VOC) return `${progress()}<p class="q-help">Memuat pilihan...</p>`;
    return `${progress()}
    <h1 class="q-title">Sejak kapan, dan adakah riwayat penyakit?</h1>
    <p class="q-help">Riwayat penyakit dan obat yang diminum dapat membuat keluhan yang sama menjadi lebih berbahaya. Lewati yang tidak diketahui.</p>
    <div class="q-body">
      <p class="sub-label">Sejak kapan keluhan dirasakan?</p>
      <div class="chips">${chips(VOC.onset, id => S.onset === id, 'onset')}</div>
      <p class="sub-label">Apakah muncul tiba-tiba (dalam hitungan detik atau menit)?</p>
      <div class="seg" role="group" aria-label="Muncul tiba-tiba">${[[true, 'Ya, tiba-tiba'], [false, 'Perlahan'], [null, 'Tidak tahu']].map(([v, t]) =>
        `<button type="button" data-act="sudden" data-v="${v}" ${pressed(S.sudden === v)}>${t}</button>`).join('')}</div>
      <p class="sub-label">Riwayat penyakit</p>
      <div class="chips">${chips(VOC.conditions, id => S.cond.includes(id), 'cond')}</div>
      <p class="sub-label">Obat yang rutin diminum</p>
      <div class="chips">${chips(VOC.medications, id => S.meds.includes(id), 'med')}</div>
      ${canPregnant ? `<p class="sub-label">Kehamilan (bila perempuan)</p>
      <div class="chips">${chips(VOC.pregnancy, id => S.preg === id, 'preg')}</div>` : ''}
    </div>
    ${cta('Lanjut', true)}`;
  },

  pain: () => {
    const toddler = S.who === 'child' && (ageYears() ?? 9) < 4;
    if (toddler) return `${progress()}
      <h1 class="q-title">Seberapa kesakitan anak Anda terlihat?</h1>
      <p class="q-help">Anak kecil belum dapat menilai nyeri dengan angka. Pilih yang paling menggambarkan sikapnya sekarang.</p>
      <div class="q-body">${KID_PAIN.map(([v, t, s]) => `<button class="opt" type="button" data-act="pain" data-v="${v}" ${pressed(S.pain === v)}>${tick}<span>${t}<small>${s}</small></span></button>`).join('')}</div>
      ${cta('Lanjut', S.pain !== null, 'Pilih salah satu.')}`;
    return `${progress()}
      <h1 class="q-title">Seberapa sakit yang dirasakan ${subj()}?</h1>
      <p class="q-help">0 berarti tidak nyeri, 10 berarti nyeri terberat yang dapat dibayangkan.</p>
      <div class="q-body">
        <div class="pain" role="group" aria-label="Skala nyeri">${Array.from({ length: 11 }, (_, i) =>
          `<button type="button" data-act="pain" data-v="${i}" style="--c:${PAIN_COLOR(i)}" ${pressed(S.pain === i)} aria-label="${i}: ${PAIN_WORD[i]}">${i}</button>`).join('')}</div>
        <div class="pain-words"><span>Tidak nyeri</span><span>Terberat</span></div>
        <p class="pain-now">${S.pain === null ? '' : `${S.pain}: ${PAIN_WORD[S.pain]}`}</p>
        ${S.pain > 0 && VOC ? `<p class="sub-label">Di bagian mana sakitnya? (boleh lebih dari satu)</p>
        <div class="chips">${VOC.pain_sites.map(o => `<button class="chip" type="button" data-act="site" data-v="${o.id}" ${pressed(S.sites.includes(o.id))}>${esc(o.label)}</button>`).join('')}</div>` : ''}
      </div>
      ${cta('Lanjut', S.pain !== null, 'Pilih angka nyeri.')}`;
  },

  measure: () => {
    const [hr, rr] = safeLimits();
    const rows = [
      ['temp', 'Suhu tubuh', 'Dari termometer. Normal sekitar 36,5-37,5', '°C'],
      ['hr', 'Denyut nadi', `Raba di pergelangan atau leher, hitung 1 menit. Batas aman usia ini: di bawah ${hr}`, 'kali/menit'],
      ['rr', 'Napas', `Hitung naik-turun dada selama 1 menit. Batas aman usia ini: di bawah ${rr}`, 'kali/menit'],
      ['spo2', 'Kadar oksigen', 'Dari oksimeter jari. Normal 95-100; di bawah 92 berbahaya', '%'],
    ];
    return `${progress()}
    <h1 class="q-title">Sudah sempat mengukur?</h1>
    <p class="q-help">Tidak wajib. Isi hanya yang sudah diukur, kosongkan yang lain.</p>
    <div class="q-body measures">${rows.map(([k, t, h, u]) => `
      <label class="measure"><span><b>${t}</b><small>${h}</small></span>
        <input inputmode="decimal" data-m="${k}" value="${esc(S.m[k] ?? '')}" aria-label="${t} (${u})"><span class="u">${u}</span></label>`).join('')}
    </div>
    <p class="note warn" id="measure-err"></p>
    <div class="cta"><button class="btn primary" type="button" data-act="finish">Lihat hasil ${arrow}</button>
      <button class="skip" type="button" data-act="finish-skip">Lewati, belum mengukur</button></div>`;
  },

  nurse: () => {
    if (!VOC) return '<p class="q-help">Memuat pilihan dari knowledge graph...</p>';
    const chips = (list, sel, act, alarm) => list.map(o => `<button class="chip ${alarm ? 'alarm' : ''}" type="button" data-act="${act}" data-v="${o.id}" ${pressed(sel(o.id))}>${esc(o.label)}</button>`).join('');
    const fx = c => chips(VOC.findings[c], id => S.findings.includes(id), 'finding', c !== 'Symptom' && c !== 'RiskFactor');
    const vit = [['temp', 'Suhu', '°C'], ['hr', 'Nadi', 'x/menit'], ['rr', 'Napas', 'x/menit'], ['spo2', 'SpO2', '%'], ['sbp', 'TD sistolik', 'mmHg']];
    const [hr, rr] = safeLimits();
    return `<div class="nform">
    <div class="progress"><button class="back" type="button" data-act="back" aria-label="Kembali"><svg class="ic"><use href="#i-back"/></svg></button><span class="count">Mode perawat triase</span></div>
    <h1 class="q-title">Formulir triase ESI</h1>
    <p class="q-help">Isi sesuai pengkajian. Kolom kosong dianggap belum dinilai, bukan normal.</p>

    <section class="nsec"><h2><i>1</i>Pasien</h2>
      <div class="age">
        <input class="field" id="age" inputmode="decimal" autocomplete="off" placeholder="Usia" value="${esc(S.age)}" aria-label="Usia">
        <div class="seg" role="group" aria-label="Satuan usia">${['tahun', 'bulan', 'hari'].map(u => `<button type="button" data-act="unit" data-v="${u}" ${pressed(S.unit === u)}>${u}</button>`).join('')}</div>
      </div>
      <div class="seg" role="group" aria-label="Jenis kelamin">${VOC.sex.map(o => `<button type="button" data-act="sex" data-v="${o.id}" ${pressed(S.sex === o.id)}>${esc(o.label)}</button>`).join('')}</div>
      ${S.sex === 'Sex_F' ? `<div class="chips">${chips(VOC.pregnancy, id => S.preg === id, 'preg')}</div>` : ''}
    </section>

    <section class="nsec"><h2><i>A</i>Butuh intervensi penyelamatan nyawa?</h2>
      <div class="chips">${fx('LifeSavingIndicator')}</div></section>

    <section class="nsec"><h2><i>B</i>Situasi risiko tinggi atau perubahan kesadaran</h2>
      <div class="chips">${fx('HighRiskSituation')}${fx('AlteredMentalStatus')}</div></section>

    <section class="nsec"><h2><i>2</i>Keluhan lain</h2>
      <div class="chips">${fx('Symptom')}${fx('RiskFactor')}</div></section>

    <section class="nsec"><h2><i>3</i>Onset dan nyeri (OPQRST)</h2>
      <div class="chips">${chips(VOC.onset, id => S.onset === id, 'onset')}</div>
      <div class="seg" role="group" aria-label="Onset">${[[true, 'Mendadak'], [false, 'Perlahan'], [null, 'Belum dinilai']].map(([v, t]) => `<button type="button" data-act="sudden" data-v="${v}" ${pressed(S.sudden === v)}>${t}</button>`).join('')}</div>
      <p class="sub-label">Skala nyeri (NRS 0-10)</p>
      <div class="pain" role="group" aria-label="Skala nyeri">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-act="pain" data-v="${i}" style="--c:${PAIN_COLOR(i)}" ${pressed(S.pain === i)}>${i}</button>`).join('')}</div>
      <p class="sub-label">Lokasi nyeri</p>
      <div class="chips">${chips(VOC.pain_sites, id => S.sites.includes(id), 'site')}</div></section>

    <section class="nsec"><h2><i>4</i>Riwayat (SAMPLE)</h2>
      <p class="sub-label">Riwayat penyakit dan alergi</p><div class="chips">${chips(VOC.conditions, id => S.cond.includes(id), 'cond')}</div>
      <p class="sub-label">Obat</p><div class="chips">${chips(VOC.medications, id => S.meds.includes(id), 'med')}</div></section>

    <section class="nsec"><h2><i>D</i>Tanda vital dan kesadaran</h2>
      <div class="vitals">${vit.map(([k, t, u]) => `<label><span>${t}</span><input inputmode="decimal" data-m="${k}" value="${esc(S.m[k] ?? '')}" aria-label="${t} (${u})"><em>${u}</em></label>`).join('')}</div>
      <p class="fine">Batas danger zone usia ini: nadi &gt; ${hr}, napas &gt; ${rr}, SpO2 &lt; 92.</p>
      <div class="seg" role="group" aria-label="AVPU">${[['A', 'A: sadar'], ['V', 'V: suara'], ['P', 'P: nyeri'], ['U', 'U: tidak respons']].map(([v, t]) => `<button type="button" data-act="avpu" data-v="${v}" ${pressed(S.avpu === v)}>${t}</button>`).join('')}</div></section>

    <section class="nsec"><h2><i>C</i>Perkiraan resource</h2>
      <p class="q-help">Jenis resource yang diperkirakan dibutuhkan. Kosongkan bila cukup anamnesis, pemeriksaan fisik, atau obat oral.</p>
      <div class="chips">${chips(VOC.resources, id => S.res.includes(id), 'res')}</div></section>

    <p class="note warn" id="measure-err"></p>
    ${cta('Tentukan level ESI', ageOk(), 'Isi usia pasien untuk melanjutkan.', 'nurse-go')}</div>`;
  },

  result: () => {
    if (nurse()) return nurseResult();
    const r = S.result;
    if (!r || !r.esi) return `<div class="screen"><h1 class="q-title">Hasil belum tersedia.</h1>${cta('Mulai lagi', true, '', 'restart')}</div>`;
    const l = r.esi;
    const [first, ...rest] = r.lay_advice.split('. ');
    const reasons = layReasons(r);
    return `<div class="screen result l${l}" id="screen">
      <section class="verdict">
        <span class="level"><b>${l}</b>Tingkat ${l} dari 5 (1 paling gawat): ${ESI_WORD[l]}</span>
        <h1>${esc(first.replace(/\.$/, ''))}.</h1>
        <p>${esc(rest.join('. '))}</p>
        <div class="acts">
          ${l <= 2 ? `<a class="btn" href="tel:119"><svg class="ic"><use href="#i-phone"/></svg>Telepon 119</a>` : ''}
          <a class="btn ${l <= 2 ? 'line' : ''}" href="${MAPS(l <= 3 ? 'IGD terdekat' : 'puskesmas terdekat')}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-pin"/></svg>${l <= 3 ? 'Cari IGD terdekat' : 'Cari klinik atau puskesmas'}</a>
        </div>
      </section>
      <section class="why-box">
        <h2>Mengapa hasilnya begini?</h2>
        <ol class="reasons">${reasons.map((t, i) => `<li style="--i:${i}"><span class="n">${i + 1}</span><p>${esc(t)}</p></li>`).join('')}</ol>
        ${r.alerts.filter(a => !a.startsWith('Resource')).map(a => `<p class="alert-box">${esc(a.replace('Shock index >= 1,0: waspadai syok tersembunyi, evaluasi ulang tanda vital.', 'Perbandingan nadi dan tekanan darah menunjukkan kemungkinan syok. Sampaikan hal ini kepada petugas.').replace(/^Tanda stroke.*/, 'Tanda stroke yang muncul kurang dari 4,5 jam: segera ke IGD. Pengobatan stroke paling efektif bila diberikan secepatnya.'))}</p>`).join('')}
        ${S.findings.includes('SuicidalIdeation') ? '<p class="alert-box">Anda tidak sendiri. Bicarakan dengan seseorang sekarang: layanan kesehatan jiwa SEJIWA di 119 ekstensi 8.</p>' : ''}
        ${l <= 2 ? `<div><h2>Selama menuju IGD</h2><ul class="tips">
          <li>${S.who === 'self' ? 'Jangan menyetir sendiri; minta diantar keluarga atau ambulans.' : 'Temani terus dan jangan biarkan sendirian.'}</li>
          <li>Bawa kartu identitas atau BPJS dan daftar obat yang sedang diminum.</li>
          <li>Bila memburuk di jalan (tidak sadar, sesak berat, kejang), telepon 119.</li></ul></div>` : `<div><h2>Sambil menunggu</h2><ul class="tips">
          <li>Perhatikan perubahan keluhan. Segera ke IGD bila muncul tanda bahaya seperti sesak berat atau sulit dibangunkan.</li>
          <li>Bawa kartu identitas atau BPJS saat berobat.</li></ul></div>`}
        ${aiBox('lay')}
      </section></div>`;
  },
};

const ESI_ACTION = ['', 'Bawa ke ruang resusitasi sekarang dan aktifkan tim resusitasi.', 'Tempatkan di area gawat; dokter menilai segera. Pantau tanda vital berkala.',
  'Area observasi; evaluasi ulang tanda vital selama menunggu.', 'Area fast track atau poliklinik.', 'Area fast track atau poliklinik.'];
function nurseResult() {
  const r = S.result;
  if (!r || !r.esi) return `<div class="screen"><h1 class="q-title">Hasil belum tersedia.</h1>${cta('Kembali ke formulir', true, '', 'back')}</div>`;
  const l = r.esi;
  const reasons = r.trace.filter(t => !['Z01', 'C00'].includes(t.rule));
  return `<div class="screen result l${l}" id="screen">
    <section class="verdict">
      <span class="level"><b>${l}</b>${esc(r.esi_label)}</span>
      <h1>${esc(ESI_ACTION[l])}</h1>
      <p>Kandidat dari aturan: ${r.candidates.map(c => 'ESI ' + c).join(', ')}. Level akhir adalah kandidat paling akut.</p>
    </section>
    <section class="why-box">
      <h2>Dasar keputusan</h2>
      <ol class="reasons nurse-reasons">${reasons.map((t, i) => `<li style="--i:${i}"><span class="n">${esc(t.rule)}</span><p>${esc(num(t.reason))}<small>${esc(t.source)}</small></p></li>`).join('')}</ol>
      ${r.alerts.filter(a => !a.startsWith('Resource')).map(a => `<p class="alert-box">${esc(a)}</p>`).join('')}
      <div class="acts"><button class="btn ghost sm" type="button" data-act="back">Ubah data triase</button><button class="btn ghost sm" type="button" data-act="restart">Pasien baru</button></div>
      ${aiBox('nurse')}
    </section></div>`;
}

/* ---------- penjelasan AI (Claude, KG-RAG): hanya menjelaskan, level ESI tetap dari aturan ---------- */
let SERVER_AI = false, AI_INFO = null;
let USER_KEY = (() => { try { return sessionStorage.getItem('claudeKey') || ''; } catch { return ''; } })();
const aiOn = () => SERVER_AI || !!USER_KEY;
const apiHeaders = () => ({ 'Content-Type': 'application/json', ...(USER_KEY ? { 'X-Anthropic-Key': USER_KEY } : {}) });
function keyBox(inline = false) {
  if (SERVER_AI && !USER_KEY) return '';
  const b = AI_INFO?.budget;
  const st = USER_KEY ? 'aktif dengan kunci API Anda'
    : SERVER_AI ? `aktif (anggaran server hari ini tersisa $${b ? b.remaining_usd.toFixed(2) : '-'} dari $${b ? b.daily_usd.toFixed(0) : '-'})`
    : b && b.remaining_usd <= 0 ? `kuota gratis hari ini ($${b.daily_usd.toFixed(0)}) sudah habis. Masukkan kunci API Claude Anda untuk melanjutkan`
    : 'nonaktif. Masukkan kunci API Claude untuk mengaktifkan';
  return `<details class="keybox" ${inline || (!SERVER_AI && !USER_KEY) ? 'open' : ''}>
    <summary><b>Penjelasan AI (Claude)</b>: ${esc(st)}</summary>
    <p class="fine">Opsional. Dengan kunci API Claude sendiri, penjelasan AI memakai kuota Anda dan tidak terkena batas harian server.
      Kunci hanya disimpan di tab ini dan terhapus saat tab ditutup; server memakainya untuk satu permintaan tanpa menyimpan atau mencatatnya.</p>
    <form class="own" data-act="savekey"><input class="field" id="ukey" type="password" autocomplete="off" placeholder="${USER_KEY ? 'Kunci tersimpan di tab ini' : 'sk-ant-...'}" aria-label="Kunci API Claude">
      <button class="btn ghost sm" type="submit">Simpan</button>${USER_KEY ? '<button class="btn ghost sm" type="button" data-act="clearkey">Hapus</button>' : ''}</form>
    <p class="note warn" id="key-err"></p></details>`;
}
const AI_BTN = {
  nurse: [['klinis', 'Detail klinis'], ['insight', 'Insight'], ['teknis', 'Detail teknis'], ['tbox', 'TBox'], ['abox', 'ABox']],
  lay: [['klinis', 'Jelaskan hasil ini'], ['insight', 'Apa yang perlu diperhatikan']],
};
function aiBox(aud) {
  if (!aiOn()) return AI_INFO ? `<section class="ai-box"><h2>Penjelasan AI</h2>${keyBox(true)}</section>` : '';
  return `<section class="ai-box">
    <h2>Penjelasan AI</h2>
    <p class="ai-note">Dirangkai Claude dari jejak sistem pakar dan knowledge graph kasus ini. Level ESI tetap diputuskan aturan, bukan AI.</p>
    <div class="ai-btns">${AI_BTN[aud].map(([k, t]) => `<button class="btn ghost sm" type="button" data-act="explain" data-v="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
    <form class="own" data-act="ask"><input class="field" id="ask" maxlength="500" autocomplete="off" aria-label="Pertanyaan lanjutan"
      placeholder="${aud === 'lay' ? 'Tanyakan sesuatu tentang hasil ini' : 'Pertanyaan lanjutan, mis. mengapa bukan ESI 3?'}"><button class="btn ghost sm" type="submit">Tanya</button></form>
    <div id="ai-out" class="ai-out" aria-live="polite"></div></section>`;
}
function md(text) {  // Markdown sederhana dari Claude -> HTML aman (semua teks di-escape lebih dulu)
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  const out = [];
  let list = null;
  for (const raw of String(text).split('\n')) {
    const l = raw.trim();
    const li = l.match(/^(?:[-*]|\d+\.)\s+(.*)/);
    if (li) { (list = list || []).push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (!l) continue;
    const h = l.match(/^#{1,4}\s+(.*)/);
    out.push(h ? `<h4>${inline(h[1])}</h4>` : `<p>${inline(l)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('');
}
async function explainAI(aspect, question) {
  const out = $('#ai-out');
  if (!out) return;
  document.querySelectorAll('[data-act=explain]').forEach(b => b.setAttribute('aria-pressed', !question && b.dataset.v === aspect));
  out.innerHTML = '<p class="ai-wait">Claude sedang menyusun penjelasan...</p>';
  try {
    const res = await fetch('/api/explain', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ ...facts(), aspect, question }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail || res.statusText);
    out.innerHTML = (question ? `<p class="ai-q">${esc(question)}</p>` : '') + md(j.text)
      + (j.queries?.length ? qList(j.queries) : j.n_queries ? `<p class="fine">Dijawab dari knowledge graph (${j.n_queries} query).</p>` : '');
  } catch (e) {
    out.innerHTML = `<p class="note warn">${esc(e.message)}</p>`;
    if (!USER_KEY) fetch('/api/health').then(r => r.json()).then(h => { SERVER_AI = !!h.llm?.enabled; AI_INFO = h.llm; if (!SERVER_AI) draw(); });
  }
}

function sbar() {
  const r = S.result, f = facts();
  const L = ids => ids.map(id => VL[id] || LABEL[id] || id).join(', ');
  const vit = [f.hr && `N ${f.hr}`, f.rr && `RR ${f.rr}`, f.spo2 && `SpO2 ${f.spo2}%`, f.sbp && `TD ${f.sbp}`, f.temp && `S ${dec(f.temp)} °C`, S.avpu && `AVPU ${S.avpu}`].filter(Boolean).join(', ');
  const top = r.trace.find(t => t.rule === 'Z01');
  return [
    ['S (situasi)', [L(f.findings), S.sites.length && `nyeri di ${L(S.sites).toLowerCase()}`, f.pain != null && `NRS ${f.pain}/10`, S.onset && `onset ${VL[S.onset].toLowerCase()}`, S.sudden && 'mendadak'].filter(Boolean).join('; ') || '-'],
    ['B (latar)', [ageText(), S.sex && VL[S.sex], S.preg && VL[S.preg], S.cond.length && 'riwayat ' + L(S.cond), S.meds.length && 'obat ' + L(S.meds)].filter(Boolean).join('; ')],
    ['A (penilaian)', `${r.esi_label}. ${top ? num(top.reason) : ''}${vit ? '. TTV: ' + vit : ''}`],
    ['R (rekomendasi)', ESI_ACTION[r.esi]],
  ];
}

function layReasons(r) {
  const out = [];
  const f = facts();
  const vitalWord = { 'Denyut jantung': ['Denyut nadi', 'kali per menit', 'lebih cepat dari'], 'Laju napas': ['Napas', 'kali per menit', 'lebih cepat dari'], 'SpO2': ['Kadar oksigen', '%', 'di bawah'] };
  const ORDER = ['A01', 'A02', 'A03', 'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'F01', 'D01', 'C02'];  // urutan keakutan algoritma ESI
  const trace = [...r.trace].sort((a, b) => (ORDER.indexOf(a.rule) + 99) % 99 - (ORDER.indexOf(b.rule) + 99) % 99);
  for (const t of trace) {
    if (['C00', 'C01', 'E01', 'Z01', 'G01', 'G02'].includes(t.rule)) continue;
    if (t.rule === 'D01') {
      const m = t.reason.match(/^(Denyut jantung|Laju napas|SpO2)[^=]*= ([\d.]+) [<>] ([\d.]+)/);
      if (m) { const [w, u, cmp] = vitalWord[m[1]]; out.push(`${w} ${num(m[2])} ${u}, ${cmp} batas aman untuk usia ${ageText()} (${cmp === 'di bawah' ? 'minimal' : 'paling tinggi'} ${num(m[3])}).`); }
      continue;
    }
    if (t.rule === 'C02') { out.push(f.temp > 39 ? `Demam ${dec(f.temp)} °C pada anak di bawah 3 tahun perlu segera diperiksa dokter.` : 'Anak di bawah 3 tahun yang demam dengan imunisasi belum lengkap perlu segera diperiksa dokter.'); continue; }
    if (t.rule === 'B04' || t.rule === 'B05') { out.push(`Bayi berusia ${ageText()} dengan suhu ${dec(f.temp)} °C. Demam pada bayi semuda ini perlu segera diperiksa dokter.`); continue; }
    if (t.rule === 'B03') { out.push(`Rasa nyerinya sangat berat (${f.pain} dari 10).`); continue; }
    const items = ['A01', 'B01', 'B02'].includes(t.rule) ? t.used.map(u => LABEL[PREF2ID[u]] || '').filter(Boolean) : [];  // aturan kategori: sebutkan keluhannya
    out.push(items.length ? `${t.lay}: ${items.join(', ').toLowerCase()}.` : `${t.lay}.`);
  }
  if (r.esi >= 3) {
    const res = (r.trace.find(t => t.rule === 'C01')?.used || []).map(u => RES_LAY[u]).filter(Boolean);
    out.push(res.length ? `Keluhan ini biasanya memerlukan ${res.join(', ')}${res.length > 1 ? ', yang tersedia di IGD' : ''}.`
      : 'Keluhan ini umumnya cukup ditangani dengan pemeriksaan dokter dan obat minum.');
  }
  return [...new Set(out)];
}

/* ---------- panel samping ---------- */
function side() {
  const step = STEPS[S.step];
  if (step === 'welcome') return `
    <div class="card"><h2>${S.mode === 'nurse' ? 'Isi formulir perawat' : 'Yang akan ditanyakan'}</h2><ol class="steps">${(S.mode === 'nurse'
      ? ['Pasien dan kehamilan', 'Decision Point A dan B', 'Onset, nyeri, lokasi', 'Riwayat dan obat', 'Tanda vital, AVPU', 'Perkiraan resource']
      : ['Usia', 'Tanda bahaya', 'Keluhan', 'Sejak kapan dan riwayat', 'Rasa nyeri', 'Hasil ukur (bila ada)']).map(t => `<li>${t}</li>`).join('')}</ol></div>
    <div class="card sos-card"><p>Bila tidak sadar, tidak bernapas, atau perdarahan hebat: <a href="tel:119">telepon 119 sekarang</a>.</p></div>`;
  if (nurse()) {
    if (step === 'result' && S.result?.esi) return `
    <div class="card handover"><h2>Serah terima (SBAR)</h2><dl>${sbar().map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
    <button class="tech-link" type="button" data-act="think">Detail teknis sistem pakar (${new Set(S.result.trace.map(t => t.rule)).size} aturan)</button>`;
    const done = [['Usia', ageOk()], ['Keluhan', S.findings.length > 0], ['Onset', !!S.onset], ['Nyeri', S.pain !== null], ['Riwayat', S.cond.length + S.meds.length > 0],
      ['Tanda vital', ['hr', 'rr', 'spo2', 'sbp', 'temp'].filter(k => S.m[k]).length + ' dari 5'], ['AVPU', S.avpu || false], ['Resource', S.res.length + ' jenis']];
    return `<div class="card"><h2>Kelengkapan pengkajian</h2><ul class="sum">${done.map(([k, v]) =>
      `<li><span><span>${k}</span><b class="${v ? '' : 'empty'}">${v === true ? 'terisi' : v || 'belum'}</b></span></li>`).join('')}</ul></div>
    <div class="card sos-card"><p>Pasien memburuk saat menunggu? Lakukan triase ulang.</p></div>`;
  }
  const f = facts();
  const vit = [f.temp && `suhu ${dec(f.temp)} °C`, f.hr && `nadi ${f.hr}`, f.rr && `napas ${f.rr}`, f.spo2 && `oksigen ${f.spo2}%`].filter(Boolean).join(', ');
  const painTxt = S.pain === null ? '' : (S.who === 'child' && (ageYears() ?? 9) < 4 ? KID_PAIN.find(k => k[0] === S.pain)?.[1] : `${S.pain} dari 10`);
  const rows = [
    ['Untuk', { self: 'Saya sendiri', child: 'Anak', adult: 'Orang lain (dewasa)' }[S.who], 0],
    ['Usia', ageText(), 1],
    ['Tanda bahaya', S.danger.length ? S.danger.map((d, i) => i ? LABEL[d].toLowerCase() : LABEL[d]).join(', ') : S.dangerNone ? 'Tidak ada' : '', 2],
    ['Keluhan', S.findings.map((d, i) => i ? LABEL[d].toLowerCase() : LABEL[d]).join(', '), 3],
    ['Riwayat', [S.onset && 'sejak ' + VL[S.onset].toLowerCase(), S.sudden && 'tiba-tiba', ...[...S.cond, ...S.meds, S.preg].filter(Boolean).map(id => VL[id].toLowerCase())].filter(Boolean).join(', '), 4],
    ['Nyeri', painTxt + (S.sites.length ? ` (${S.sites.map(id => VL[id].toLowerCase()).join(', ')})` : ''), 5],
    ['Hasil ukur', vit || (S.step >= I.result ? 'Tidak diukur' : ''), 6],
  ];
  if (step === 'result' && S.result?.esi) return `
    <div class="card handover"><h2>Ringkasan untuk petugas IGD</h2><dl>${rows.filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
    <div class="card"><button class="btn ghost sm" type="button" data-act="restart">Cek ulang dari awal</button></div>
    <button class="tech-link" type="button" data-act="think">Detail teknis sistem pakar (${new Set(S.result.trace.map(t => t.rule)).size} aturan)</button>`;
  return `
    <div class="card"><h2>Ringkasan jawaban</h2><ul class="sum">${rows.map(([k, v, s]) =>
      `<li><span><span>${k}</span><b class="${v ? '' : 'empty'}">${esc(v || 'belum diisi')}</b></span>${v && s < S.step ? `<button class="edit" type="button" data-act="goto" data-v="${s}">Ubah</button>` : ''}</li>`).join('')}</ul></div>
    <div class="card sos-card"><p>Kondisi memburuk? <a href="tel:119">Telepon 119</a>.</p></div>`;
}

function draw() {
  const el = $('#screen');
  const view = VIEWS[STEPS[S.step]]();
  if (STEPS[S.step] === 'result') el.outerHTML = view.startsWith('<div class="screen') ? view : `<div class="screen" id="screen">${view}</div>`;
  else { el.className = 'screen'; el.innerHTML = view; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  $('#side').innerHTML = side();
  document.body.classList.toggle('on-result', STEPS[S.step] === 'result');  // satu pintu masuk detail teknis di layar hasil
  if (STEPS[S.step] === 'age' || (STEPS[S.step] === 'nurse' && !S.age)) $('#age')?.focus();
}

async function go(to) {
  S.step = Math.max(0, Math.min(to, STEPS.length - 1));
  if (STEPS[S.step] === 'result') {
    try { await assess(); } catch (e) { alert('Gagal menghubungi server: ' + e.message); S.step = nurse() ? I.nurse : I.measure; }
  } else if (S.step >= 2 && ageOk() && !$('#mind').hidden) assess().catch(() => {});
  draw();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function reset() {
  Object.assign(S, BLANK());
  renderMind();
  go(0);
}

/* ---------- interaksi ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'FORM' || b.disabled) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case 'mode': S.mode = v; S.who = null; S.unit = 'tahun'; S.age = ''; draw(); break;
    case 'nurse-open': go(I.nurse); break;
    case 'nurse-go': { const err = vitalError(); if (err) { $('#measure-err').textContent = err; break; } go(I.result); break; }
    case 'who': if (S.who !== v) { S.who = v; S.unit = 'tahun'; S.age = ''; } draw(); break;
    case 'next': go(S.step === I.danger && S.danger.length ? I.result : S.step + 1); break;
    case 'back': go(nurse() ? (S.step === I.result ? I.nurse : 0) : S.step - 1); break;
    case 'sex': S.sex = S.sex === v ? null : v; if (S.sex !== 'Sex_F') S.preg = null; draw(); break;
    case 'preg': S.preg = S.preg === v ? null : v; draw(); break;
    case 'onset': S.onset = S.onset === v ? null : v; draw(); break;
    case 'sudden': S.sudden = JSON.parse(v); draw(); break;
    case 'cond': S.cond = toggle(S.cond, v); draw(); break;
    case 'med': S.meds = toggle(S.meds, v); draw(); break;
    case 'site': S.sites = toggle(S.sites, v); draw(); break;
    case 'res': S.res = toggle(S.res, v); draw(); break;
    case 'avpu': S.avpu = S.avpu === v ? null : v; draw(); break;
    case 'goto': go(+v); break;
    case 'unit': S.unit = v; draw(); break;
    case 'danger': S.danger = S.danger.includes(v) ? S.danger.filter(x => x !== v) : [...S.danger, v]; S.dangerNone = false; draw(); break;
    case 'dangerNone': S.danger = []; S.dangerNone = !S.dangerNone; draw(); break;
    case 'finding': S.findings = S.findings.includes(v) ? S.findings.filter(x => x !== v) : [...S.findings, v]; draw(); break;
    case 'pain': S.pain = +v; draw(); break;
    case 'finish-skip': S.m = {}; go(I.result); break;
    case 'finish': { const err = vitalError(); if (err) { $('#measure-err').textContent = err; break; } go(I.result); break; }
    case 'restart': reset(); break;
    case 'think': openMind(true); break;
    case 'explain': explainAI(v); break;
    case 'clearkey': USER_KEY = ''; try { sessionStorage.removeItem('claudeKey'); } catch {} draw(); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'age') {
    S.age = e.target.value; $('#next').disabled = !ageOk(); if ($('#age-hint')) $('#age-hint').textContent = ageHint(); $('#side').innerHTML = side();
    const h = document.querySelector('.cta-hint'); if (h) h.hidden = ageOk();
  }
  if (e.target.dataset.m) S.m[e.target.dataset.m] = e.target.value;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'age' && ageOk() && !nurse()) go(S.step + 1);
  if (e.key === 'Escape' && !$('#mind').hidden) openMind(false);
});
document.addEventListener('submit', e => {
  if (e.target.dataset.act !== 'savekey') return;
  e.preventDefault();
  const k = $('#ukey').value.trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(k)) { $('#key-err').textContent = 'Kunci API Claude diawali "sk-ant-". Periksa kembali.'; return; }
  USER_KEY = k;
  try { sessionStorage.setItem('claudeKey', k); } catch {}
  draw();
});
document.addEventListener('submit', e => {
  if (e.target.dataset.act !== 'ask') return;
  e.preventDefault();
  const q = $('#ask').value.trim();
  if (q) explainAI('klinis', q);
});
document.addEventListener('submit', async e => {
  if (e.target.dataset.act !== 'parse') return;
  e.preventDefault();
  const text = $('#own').value.trim();
  if (!text) return;
  $('#found').textContent = 'Mengenali keluhan…';
  try {
    const r = await (await fetch('/api/parse', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ text }) })).json();
    const ids = r.findings.map(x => x.id);
    const isDanger = id => DANGER.some(([d]) => d === id);
    S.findings = [...new Set([...S.findings, ...ids.filter(id => !isDanger(id))])];
    S.danger = [...new Set([...S.danger, ...ids.filter(isDanger)])];
    draw();
    $('#found').textContent = ids.length ? `Dikenali: ${ids.map(id => LABEL[id] || id).join(', ')}.` : 'Belum dikenali. Coba pilih dari daftar di atas.';
  } catch { $('#found').textContent = 'Gagal mengenali, coba pilih dari daftar.'; }
});

/* ---------- laci "cara sistem pakar berpikir" ---------- */
function openMind(on) {
  $('#mind').hidden = !on;
  $('#backdrop').hidden = !on;
  if (on) { if (ageOk() && S.step >= 2 && !S.result) assess().catch(() => {}); $('#mind-close').focus(); }
}
function setWide(on) {
  $('#mind').classList.toggle('wide', on);
  $('#mind-wide').setAttribute('aria-pressed', on);
  $('#mind-wide').setAttribute('aria-label', on ? 'Kembalikan lebar detail teknis' : 'Perlebar detail teknis');
  try { localStorage.setItem('mindWide', on ? '1' : ''); } catch {}
}
try { setWide(localStorage.getItem('mindWide') === '1'); } catch {}
$('#mind-wide').onclick = () => setWide(!$('#mind').classList.contains('wide'));
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'f' && !$('#mind').hidden && !/INPUT|TEXTAREA/.test(e.target.tagName)) setWide(!$('#mind').classList.contains('wide'));
});
$('#mind-close').onclick = () => openMind(false);
$('#backdrop').onclick = () => openMind(false);
document.querySelectorAll('.mtabs button').forEach(t => t.onclick = () => {
  document.querySelectorAll('.mtabs button').forEach(x => x.setAttribute('aria-selected', x === t));
  document.querySelectorAll('.mpane').forEach(p => p.hidden = p.id !== t.dataset.pane);
  if (t.dataset.pane === 'm-graph' && (!CY || (GMODE === 'case' && GFOR !== JSON.stringify(facts())))) showGraph(S.result ? 'case' : 'tbox');
  if (t.dataset.pane === 'm-sparql' && !QLIB) loadLib();
});

/* ---------- Query SPARQL: agent Claude, kamus query, dan editor manual ---------- */
let QLIB = null, QLAST_ERR = null;
const QBUF = [];  // query dari jawaban Claude, dirujuk tombol "Buka di editor"
function qList(qs) {
  return `<details class="qused"><summary>Query yang digunakan (${qs.length})</summary>${qs.map(q => {
    QBUF.push(q.query);
    return `<div class="qitem"><pre class="code">${sparqlHtml(q.query)}</pre><p class="fine">${q.error ? 'Gagal: ' + esc(q.error) : q.count + ' baris'}
      <button class="btn ghost sm" type="button" data-qopen="${QBUF.length - 1}">Buka di editor</button></p></div>`;
  }).join('')}</details>`;
}
const caseFacts = () => S.result && $('#q-case')?.checked !== false ? facts() : null;
async function loadLib() {
  try {
    QLIB = await (await fetch('/api/queries')).json();
    const groups = [...new Set(QLIB.map(q => q.group))];
    $('#qlib').innerHTML = groups.map(g => `<div class="qgroup"><b>${esc(g)}</b>${QLIB.map((q, i) => q.group !== g ? '' :
      `<button type="button" class="qpick" data-qlib="${i}" title="${esc(q.note)}">${esc(q.question)}${q.needs_case ? ' <small>(butuh hasil triase)</small>' : ''}</button>`).join('')}</div>`).join('');
  } catch (e) { $('#qlib').innerHTML = `<p class="note warn">Kamus gagal dimuat: ${esc(e.message)}</p>`; }
}
function openQuery(text, run = true) {
  $('#q-text').value = text;
  document.querySelector('[data-pane="m-sparql"]').click();
  $('#q-text').scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (run) runQuery();
}
async function runQuery() {
  const out = $('#q-out'), query = $('#q-text').value.trim();
  if (!query) return;
  out.innerHTML = '<p class="fine">Menjalankan query...</p>';
  try {
    const res = await fetch('/api/sparql', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ query, facts: caseFacts() }) });
    const j = await res.json();
    if (!res.ok) throw new Error(typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail));
    QLAST_ERR = j.count ? null : 'hasil kosong';
    const cell = v => v === null ? '' : esc(typeof v === 'number' ? String(v).replace('.', ',') : v);
    out.innerHTML = `<p class="fine">${j.count} baris${j.truncated ? ' (ditampilkan 200)' : ''}, ${j.ms} ms${j.case ? ', termasuk kasus ex:KasusIni' : ''}.</p>`
      + (j.count ? `<div class="qtable"><table class="dense"><thead><tr>${j.vars.map(v => `<th>${esc(v)}</th>`).join('')}</tr></thead>
        <tbody>${j.rows.map(r => `<tr>${r.map(v => `<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<p class="note">Tidak ada baris yang cocok. Periksa nama kelas atau property, atau minta Claude memperbaikinya.</p>');
  } catch (e) {
    QLAST_ERR = e.message;
    out.innerHTML = `<p class="note warn">${esc(e.message)}</p>`;
  }
}
async function kgAsk(body, label) {
  const out = $('#kg-ans');
  out.innerHTML = '<p class="ai-wait">Claude sedang menulis dan menjalankan query...</p>';
  try {
    const res = await fetch('/api/sparql/ask', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ ...body, facts: caseFacts() }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail || res.statusText);
    out.innerHTML = `<p class="ai-q">${esc(label)}</p>${md(j.text)}${j.queries.length ? qList(j.queries) : ''}`;
    const ok = [...j.queries].reverse().find(q => !q.error);
    if (body.query && ok) openQuery(ok.query);  // mode perbaikan: query hasil perbaikan langsung masuk editor
  } catch (e) { out.innerHTML = `<p class="note warn">${esc(e.message)}</p>`; }
}
$('#q-run').onclick = runQuery;
$('#q-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runQuery(); });
$('#q-fix').onclick = () => {
  const query = $('#q-text').value.trim();
  if (query) kgAsk({ query, error: QLAST_ERR }, 'Perbaiki query di editor');
};
$('#kg-ask').onsubmit = e => {
  e.preventDefault();
  const q = $('#kg-q').value.trim();
  if (q) kgAsk({ question: q }, q);
};
document.addEventListener('click', e => {
  const lib = e.target.closest('[data-qlib]'), open = e.target.closest('[data-qopen]');
  if (lib) openQuery(QLIB[+lib.dataset.qlib].query);
  if (open) { openMind(true); openQuery(QBUF[+open.dataset.qopen]); }
});

/* ---------- penjelajah knowledge graph (Cytoscape.js + dagre, dimuat saat tab Graph dibuka) ---------- */
let CY = null, GMODE = null, GFOR = null;
const GKIND = { case: ['Kasus dan pasien', '#0f6b5c'], inference: ['Inferensi (jejak aturan)', '#c2410c'], rule: ['Aturan', '#7c3aed'],
  esi: ['Skala ESI', '#b91c1c'], abox: ['ABox: individu', '#2563eb'], tbox: ['TBox: kelas dan property', '#475569'] };
const GLIBS = ['https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js', 'https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js',
  'https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.js'];
const loadScript = src => new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => no(new Error('Pustaka graph gagal dimuat (periksa koneksi).'));
  document.head.append(s);
});
const loadCy = async () => { if (!window.cytoscape) for (const src of GLIBS) await loadScript(src); };  // urutan penting: cytoscape-dagre mendaftar ke cytoscape
const GLAYOUT = { case: { name: 'dagre', rankDir: 'LR', nodeSep: 12, rankSep: 80, edgeSep: 6, padding: 16 },
  tbox: { name: 'dagre', rankDir: 'BT', nodeSep: 18, rankSep: 55, padding: 16 } };
const toEls = d => [...d.nodes.map(n => ({ data: { ...n, color: GKIND[n.kind]?.[1] || '#475569' } })), ...d.edges.map(e => ({ data: e }))];
// Graph kasus disusun per lajur agar terbaca sebagai alur: aturan -> inferensi -> kasus -> individu ABox -> kelas TBox
const LANES = [['rule', 'Aturan IF-THEN', 'yang terpicu (kelas ex:Rule)'], ['inference', 'Inferensi', 'jejak penalaran (kelas ex:Inference)'], ['esi', 'Skala ESI', '1 paling gawat, 5 paling ringan'],
  ['case', 'Kasus ini', 'fakta pasien (ABox kasus)'],
  ['abox', 'ABox', 'individu di knowledge base'], ['tbox', 'TBox', 'kelas di ontologi']];
const LANE_W = 230, ROW_H = 54;
function laneLayout(animate = false) {
  CY.remove('[kind="lane"]');
  const vis = n => n.style('display') !== 'none';
  const cols = LANES.map(([k]) => CY.nodes(`[kind="${k}"]`).filter(vis).toArray());
  const y = {};
  cols.forEach(c => c.sort((a, b) => (a.data('order') ?? 0) - (b.data('order') ?? 0)).forEach((n, i) => { y[n.id()] = i * ROW_H; }));
  for (let pass = 0; pass < 4; pass++) cols.forEach(c => {
    if (c[0]?.data('kind') === 'esi') return;  // skala ESI tetap berurutan 1 sampai 5  // urutkan tiap lajur menurut rata-rata posisi tetangga (mengurangi garis bersilang)
    const key = n => { const nb = n.neighborhood('node').filter(m => m.data('kind') !== n.data('kind') && y[m.id()] != null); return nb.length ? nb.toArray().reduce((s, m) => s + y[m.id()], 0) / nb.length : y[n.id()]; };
    c.sort((a, b) => key(a) - key(b)).forEach((n, i) => { y[n.id()] = i * ROW_H; });
  });
  const tallest = Math.max(1, ...cols.map(c => c.length));
  const pos = {};
  cols.forEach((c, ci) => c.forEach(n => { pos[n.id()] = { x: ci * LANE_W, y: y[n.id()] + (tallest - c.length) * ROW_H / 2 }; }));
  CY.add(LANES.map(([k, t, sub], ci) => ({ data: { id: 'lane_' + k, kind: 'lane', label: `${t}\n${sub}` }, position: { x: ci * LANE_W, y: -70 }, selectable: false, grabbable: false })));
  CY.layout({ name: 'preset', positions: n => pos[n.id()] || n.position(), fit: true, padding: 24, animate, animationDuration: 300 }).run();
}
// Knowledge base lengkap: kotak kelas (compound node) berisi individunya, disusun seperti rak
function kbLayout() {
  const COLW = 140, ROWH = 50, GAP = 60, pos = {};
  const shape = n => { const c = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(n * 1.5)))); return [c, c * COLW, Math.ceil(n / c) * ROWH]; };
  const vis = b => b.children().filter(k => k.style('display') !== 'none').toArray();
  const area = CY.nodes('[?box]').toArray().reduce((s, b) => { const [, w, h] = shape(vis(b).length); return s + (w + GAP) * (h + GAP + 30); }, 0);
  const MAXW = Math.max(900, Math.sqrt(area * CY.width() / Math.max(1, CY.height())) * 1.1);  // rak mengikuti rasio layar
  let x = 0, y = 0, rowH = 0;
  CY.nodes('[?box]').forEach(b => {
    const kids = vis(b);
    const [cols, w, h] = shape(kids.length);
    if (x > 0 && x + w > MAXW) { x = 0; y += rowH + GAP + 30; rowH = 0; }
    kids.forEach((k, i) => { pos[k.id()] = { x: x + (i % cols) * COLW + COLW / 2, y: y + Math.floor(i / cols) * ROWH }; });
    x += w + GAP; rowH = Math.max(rowH, h);
  });
  CY.layout({ name: 'preset', positions: n => pos[n.id()] || n.position(), fit: true, padding: 20 }).run();
}
const relayout = (animate = true) => GMODE === 'case' ? laneLayout(animate) : GMODE === 'kb' ? kbLayout()
  : CY.layout({ ...GLAYOUT.tbox, animate, animationDuration: 350 }).run();
const GSTYLE = [
  { selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', 'font-size': 10, 'font-family': 'system-ui, sans-serif', color: '#1f2937',
    'text-wrap': 'wrap', 'text-max-width': 120, 'text-valign': 'bottom', 'text-margin-y': 4, width: 16, height: 16, 'border-width': 0 } },
  { selector: 'node[kind="tbox"], node[kind="case"]', style: { shape: 'round-rectangle', width: 'label', height: 'label', padding: 7, 'text-valign': 'center', 'text-margin-y': 0,
    color: '#fff', 'font-weight': 600, 'text-max-width': 150 } },
  { selector: 'node[kind="case"]', style: { 'font-size': 12, padding: 10 } },
  { selector: 'node[kind="rule"]', style: { shape: 'diamond', width: 20, height: 20 } },
  { selector: 'node[kind="inference"]', style: { shape: 'hexagon', width: 18, height: 18 } },
  { selector: 'node[?focus]', style: { 'border-width': 3, 'border-color': '#f59e0b' } },
  { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#111827' } },
  { selector: 'edge', style: { width: 1.3, 'line-color': '#cbd5e1', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier' } },
  { selector: 'edge[rel="type"]', style: { 'line-style': 'dashed', 'line-color': '#b6c2cf' } },
  { selector: 'edge[rel="sub"]', style: { 'line-color': '#64748b', 'target-arrow-color': '#64748b', 'target-arrow-fill': 'hollow', 'arrow-scale': 1.2 } },
  { selector: 'edge.hl', style: { label: 'data(label)', 'font-size': 9, color: '#334155', 'text-rotation': 'autorotate', 'text-background-color': '#fff', 'text-background-opacity': 0.9,
    'text-background-padding': 2, 'line-color': '#475569', 'target-arrow-color': '#475569', width: 2 } },
  { selector: 'node[kind="esi"]', style: { shape: 'round-rectangle', width: 'label', height: 'label', padding: 6, 'text-valign': 'center', 'text-margin-y': 0, color: '#fff', 'font-weight': 600 } },
  { selector: 'node[esi="final"]', style: { 'border-width': 4, 'border-color': '#111827', 'font-size': 12 } },
  { selector: 'node[esi="candidate"]', style: { 'background-color': '#fff', color: '#b91c1c', 'border-width': 2, 'border-style': 'dashed', 'border-color': '#b91c1c' } },
  { selector: 'node[esi="none"]', style: { 'background-color': '#e5e7eb', color: '#6b7280' } },
  { selector: 'node[?box]', style: { shape: 'round-rectangle', 'background-color': '#eef2f1', 'background-opacity': 1, 'border-width': 1, 'border-color': '#b6c2cf',
    label: 'data(label)', 'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -4, color: '#334155', 'font-size': 12, 'font-weight': 700, padding: 16 } },
  { selector: 'edge[?kb]', style: { display: 'none' } },
  { selector: 'edge[?kb].hl', style: { display: 'element' } },
  { selector: '.faded', style: { opacity: 0.12 } },
  { selector: 'node[kind="lane"]', style: { shape: 'round-rectangle', width: LANE_W - 24, height: 40, 'background-color': '#e7eeeb', color: '#334155', 'font-size': 11,
    'font-weight': 700, 'text-valign': 'center', 'text-margin-y': 0, 'text-wrap': 'wrap', 'text-max-width': LANE_W - 30, events: 'no', opacity: 1 } },
];
async function showGraph(kind) {
  const info = $('#ginfo');
  if (kind === 'case' && !S.result) kind = 'tbox';
  info.innerHTML = '<p class="fine">Memuat graph...</p>';
  document.querySelectorAll('#g-case, #g-kb, #g-tbox').forEach(b => b.setAttribute('aria-pressed', b.id === 'g-' + kind));
  try {
    await loadCy();
    const res = kind === 'case'
      ? await fetch('/api/graph/case', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(facts()) })
      : await fetch(kind === 'kb' ? '/api/graph/kb' : '/api/graph/tbox');
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
    const d = await res.json();
    CY?.destroy();
    GMODE = kind; GFOR = JSON.stringify(facts());
    CY = cytoscape({ container: $('#gview'), elements: toEls(d), style: GSTYLE, wheelSensitivity: 0.25, minZoom: 0.15, maxZoom: 3, layout: kind === 'tbox' ? GLAYOUT.tbox : { name: 'preset' } });
    CY.on('mouseover', 'node', e => focusNode(e.target));
    CY.on('mouseout', 'node', () => { if (!CY.$(':selected').length) unfocus(); });
    CY.on('tap', 'node', e => { focusNode(e.target); nodeInfo(e.target); });
    CY.on('tap', e => { if (e.target === CY) { unfocus(); graphHint(); } });
    applyFilter();
    if (kind !== 'tbox') relayout(false);
    graphHint();
  } catch (e) { info.innerHTML = `<p class="note warn">Graph gagal dimuat: ${esc(e.message)}</p>`; }
}
function graphHint() {
  $('#ginfo').innerHTML = `<p class="fine">${GMODE === 'kb'
    ? 'Seluruh knowledge base: setiap kotak adalah kelas TBox, isinya individu ABox anggota kelas itu (angka = jumlah anggota). Relasi antarindividu muncul saat simpul disorot. Cari konsep dengan kotak cari.'
    : GMODE === 'case'
    ? 'Baca dari kiri ke kanan: aturan yang terpicu membuat inferensi yang mengusulkan level di skala ESI (kotak tebal = hasil akhir, garis putus-putus = kandidat yang kalah di resolusi konflik, abu-abu = tidak diusulkan); kasus merujuk individu di knowledge base (ABox), dan setiap individu adalah anggota kelas di ontologi (TBox, garis putus-putus = rdf:type).'
    : 'Kerangka TBox: kelas dan property. Panah berujung kosong adalah subClassOf; garis lain adalah object property dari domain ke range.'}
    ${CY.nodes('[kind!="lane"][^box]').length} simpul, ${CY.edges().length} relasi. Arahkan kursor untuk menyorot hubungan, klik simpul untuk melihat detail.</p>`;
}
const unfocus = () => CY.elements().removeClass('faded hl');
function focusNode(n) {
  unfocus();
  CY.elements().not(n.closedNeighborhood()).not('[kind="lane"], [?box]').addClass('faded');
  n.connectedEdges().addClass('hl');
}
const sparqlId = id => id.startsWith(':') ? 'ex' + id : id;
function nodeInfo(n) {
  const d = n.data(), props = d.props || [];
  $('#ginfo').innerHTML = `<div class="gcard"><p><b>${esc(d.label)}</b> <span class="gchip" style="background:${d.color}">${esc(GKIND[d.kind]?.[0] || d.kind)}</span></p>
    <p class="fine"><code>${esc(sparqlId(d.id))}</code>${d.count != null ? ` · ${d.count} individu` : ''} · ${n.degree()} relasi tampil</p>
    ${props.length ? `<table class="dense gprops">${props.map(([p, v]) => `<tr><th>${esc(p)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
    <div class="gbar"><button class="btn ghost sm" type="button" data-gact="expand">Tampilkan tetangga</button>
      <button class="btn ghost sm" type="button" data-gact="query">Query di SPARQL</button>
      <button class="btn ghost sm" type="button" data-gact="hide">Sembunyikan</button></div></div>`;
  $('#ginfo').onclick = e => {
    const a = e.target.closest('[data-gact]')?.dataset.gact;
    if (a === 'expand') expandNode(n);
    if (a === 'hide') { n.remove(); unfocus(); graphHint(); }
    if (a === 'query') openQuery(`SELECT ?arah ?predikat ?nilai WHERE {\n  { ${sparqlId(d.id)} ?predikat ?nilai BIND("keluar" AS ?arah) }\n  UNION\n  { ?nilai ?predikat ${sparqlId(d.id)} BIND("masuk" AS ?arah) }\n} ORDER BY ?arah ?predikat LIMIT 100`);
  };
}
async function expandNode(n) {
  try {
    const res = await fetch('/api/graph/node?iri=' + encodeURIComponent(n.data('iri')));
    if (!res.ok) throw new Error(res.statusText);
    const d = await res.json();
    const add = toEls(d).filter(el => !CY.getElementById(el.data.id).length);
    add.forEach(el => { delete el.data.focus; });
    CY.add(add);
    applyFilter();
    relayout();
    focusNode(n);
    const fresh = add.filter(x => !x.data.source).length;
    $('#ginfo').insertAdjacentHTML('beforeend', `<p class="fine">${d.total} triple menyentuh simpul ini${d.total > d.edges.length ? ` (ditampilkan ${d.edges.length})` : ''}; ${fresh ? fresh + ' simpul baru ditambahkan.' : 'semua tetangga sudah tampil.'}</p>`);
  } catch (e) { $('#ginfo').insertAdjacentHTML('beforeend', `<p class="note warn">Tetangga gagal dimuat: ${esc(e.message)}</p>`); }
}
function applyFilter() {
  if (!CY) return;
  document.querySelectorAll('[data-gkind]').forEach(c => CY.nodes(`[kind="${c.dataset.gkind}"]`).style('display', c.checked ? 'element' : 'none'));
}
$('#gfilter').innerHTML = Object.entries(GKIND).map(([k, [t, c]]) => `<label><input type="checkbox" data-gkind="${k}" checked><i style="background:${c}"></i>${t}</label>`).join('');
$('#gfilter').onchange = () => { applyFilter(); if (CY) relayout(); };
$('#g-case').onclick = () => showGraph('case');
$('#g-tbox').onclick = () => showGraph('tbox');
$('#g-kb').onclick = () => showGraph('kb');
$('#g-search').onsubmit = e => {
  e.preventDefault();
  const q = $('#g-q').value.trim().toLowerCase();
  if (!CY || !q) return;
  const hit = CY.nodes('[kind!="lane"]').filter(n => n.style('display') !== 'none' && (String(n.data('label')).toLowerCase().includes(q) || n.id().toLowerCase().includes(q)));
  if (!hit.length) { $('#ginfo').innerHTML = `<p class="note">Tidak ada simpul berisi "${esc(q)}" di tampilan ini. Coba tampilan Knowledge base lengkap.</p>`; return; }
  CY.$(':selected').unselect();
  hit.select();
  unfocus();
  CY.elements().not(hit.closedNeighborhood()).not('[kind="lane"], [?box]').addClass('faded');
  hit.connectedEdges().addClass('hl');
  CY.animate({ fit: { eles: hit.closedNeighborhood(), padding: 60 } }, { duration: 350 });
  if (hit.length === 1) { focusNode(hit[0]); nodeInfo(hit[0]); }
  else $('#ginfo').innerHTML = `<p class="fine">${hit.length} simpul cocok: ${hit.map(n => esc(n.data('label'))).slice(0, 12).join(', ')}${hit.length > 12 ? ', ...' : ''}. Klik salah satu untuk detail.</p>`;
};
$('#g-fit').onclick = () => CY?.fit(undefined, 16);
$('#g-relayout').onclick = () => CY && relayout();

const tidy = x => String(x).replace(/Mandiri_[0-9a-f]{12}/g, 'pasien');
const tripleList = (ts, owl) => `<ul class="triples">${ts.map(([s, p, o]) => `<li class="${owl ? 'owl' : ''}"><span class="s">${esc(tidy(s))}</span><span class="p">${esc(p)}</span><span class="o">${esc(tidy(o))}</span></li>`).join('')}</ul>`;
const sparqlHtml = s => esc(s).replace(/(#.*)$/gm, '<span class="cm">$1</span>')
  .replace(/\b(INSERT|WHERE|SELECT|FILTER|BIND|OPTIONAL|UNION|EXISTS|NOT|IF|CONCAT|STR|IRI|COALESCE|BOUND|GROUP BY|GROUP_CONCAT|AS|IN)\b/g, '<span class="kw">$1</span>')
  .replace(/(\?[a-zA-Z0-9_]+)/g, '<span class="var">$1</span>');

function renderMind() {
  const r = S.result;
  if (!r) {
    $('#flow').innerHTML = DPS.map(([k, q]) => `<li><span class="k">${k}</span><span><b>Decision Point ${k}</b><small>${q}</small></span><span class="st">menunggu</span></li>`).join('');
    $('#evidence').textContent = '';
    return;
  }
  const top = r.esi || Math.min(...r.candidates, 9);
  const fired = k => r.trace.filter(t => t.decision_point === `Decision Point ${k}`);
  $('#flow').innerHTML = DPS.map(([k, q]) => {
    const fr = fired(k);
    let cls = '', st = 'menunggu';
    if (fr.length) {
      cls = 'yes';
      const lv = [...new Set(fr.filter(t => t.conclusion.startsWith('ESI')).map(t => t.conclusion.split(':')[0]))];
      st = k === 'D' && !fr.some(t => t.rule === 'E01') ? 'danger zone' : lv.length ? 'ya: ' + lv.join(', ') : 'ya';
    } else if (top <= 2 && (k === 'C' || k === 'D')) { cls = 'skip'; st = 'dilewati'; }
    else if (S.step >= ({ A: I.complaint, B: I.measure, C: I.result, D: I.result })[k]) st = 'tidak';
    return `<li class="${cls}"><span class="k">${k}</span><span><b>Decision Point ${k}</b><small>${q}</small></span><span class="st">${esc(st)}</span></li>`;
  }).join('') + `<li class="${r.esi ? 'yes' : ''}"><span class="k">Z</span><span><b>Resolusi konflik</b><small>Ambil tingkat paling gawat dari semua kandidat</small></span><span class="st">${r.esi ? 'ESI ' + r.esi : 'menunggu'}</span></li>`;
  const ev = r.evidence;
  $('#evidence').textContent = ev ? `Bukti empiris MC-MED: dari ${fmt(ev.visits)} kunjungan IGD dengan ESI ${r.esi}, ${pct(ev.admit_rate)} dirawat inap/ICU dan ${pct(ev.critical_rate)} mengalami luaran kritis.` : '';
  $('#wm').innerHTML = r.working_memory.map(([s, p, o]) => `<li><span class="s"></span><span class="p">${esc(p)}</span><span class="o">${esc(num(o))}</span></li>`).join('');

  const groups = [...DPS.map(([k]) => [k, `Decision Point ${k}`, fired(k)]),
    ['+', 'Pendukung', r.trace.filter(t => !t.decision_point && t.rule !== 'Z01')], ['Z', 'Resolusi konflik', r.trace.filter(t => t.rule === 'Z01')]];
  $('#ledger').innerHTML = groups.filter(g => g[2].length).map(([k, name, items]) => `<div class="gh"><i>${k}</i>${name}</div>` + items.map(t => `
    <details class="rule" data-rule="${esc(t.rule)}"><summary><span class="rid">${esc(t.rule)}</span><span><span class="reason">${esc(num(t.reason))}</span><span class="concl">→ ${esc(t.conclusion)}</span></span><svg class="chev"><use href="#i-chev"/></svg></summary>
      <div class="rbody">
        <dl class="ifthen"><dt>IF</dt><dd>${esc(t.if)}</dd><dt>THEN</dt><dd>${esc(t.then)}</dd></dl>
        ${t.used.length ? `<div><span class="kv">Fakta yang digunakan</span><div class="tags">${t.used.map(u => `<span>${esc(u)}</span>`).join('')}</div></div>` : ''}
        ${t.depends_on.length ? `<div><span class="kv">Bergantung pada</span><div class="tags">${t.depends_on.map(u => `<span>${esc(u)}</span>`).join('')}</div></div>` : ''}
        <div><span class="kv">Sumber</span>${esc(t.source)}</div>
        <details class="deep"><summary>SPARQL dan triple baru (siklus ${t.cycle ?? '-'})</summary><pre class="code">${sparqlHtml(t.sparql)}</pre>${tripleList(t.added)}</details>
      </div></details>`).join('')).join('') || '<p class="empty">Belum ada aturan yang terpicu.</p>';

  const desc = Object.fromEntries(r.trace.map(t => [t.rule, num(t.reason)]));
  let html = '', cyc = 0;
  r.steps.forEach((s, i) => {
    if (s.cycle !== cyc) {
      cyc = s.cycle;
      html += s.rule === 'Z01' ? `<li class="lbl">Siklus ${r.cycles}: tidak ada fakta baru (titik tetap)</li><li class="lbl">Resolusi konflik</li>` : `<li class="lbl">Siklus ${cyc}</li>`;
    }
    const owl = s.rule === 'OWL';
    html += `<li><div class="step" data-i="${i}"><h4>${owl ? 'Reasoner OWL 2 RL (GraphDB)' : `<span class="rid">${esc(s.rule)}</span> terpicu`}<em>+${s.added.length} triple</em></h4>
      <p>${owl ? 'Fakta yang diturunkan GraphDB dari aksioma ontologi, bukan dari aturan.' : esc(desc[s.rule] || '')}</p>${tripleList(s.added, owl)}</div></li>`;
  });
  $('#timeline').innerHTML = html || '<li class="empty">Belum ada aturan yang terpicu.</li>';
  const st = r.backend_stats || {};
  $('#engine-stats').textContent = `${r.backend === 'graphdb' ? 'GraphDB, repository triage-es' : 'rdflib in-memory'} · ${r.cycles} siklus · ${r.ms} ms` +
    (st.case_inferred_by_reasoner != null ? ` · ${st.case_explicit} triple eksplisit + ${st.case_inferred_by_reasoner} dari reasoner` : '');
  stopPlay(true);
  document.querySelectorAll('#rules tr[data-rule]').forEach(tr => tr.classList.toggle('fired', r.trace.some(t => t.rule === tr.dataset.rule)));
  $('#mind-sub').textContent = r.esi ? `Kesimpulan: ESI ${r.esi} (${ESI_WORD[r.esi]}) dari ${new Set(r.trace.map(t => t.rule)).size} aturan yang terpicu.` : 'Setiap jawaban menjadi fakta di knowledge graph, lalu aturan triase ESI diuji satu per satu.';
}

let cursor = -1, timer = null;
function show(i) {
  const n = document.querySelectorAll('#timeline .step').length;
  cursor = Math.max(-1, Math.min(i, n - 1));
  document.querySelectorAll('#timeline .step').forEach(el => { const k = +el.dataset.i; el.classList.toggle('current', k === cursor); el.classList.toggle('seen', k < cursor); });
  $('#timeline').classList.toggle('playing', cursor >= 0);
  document.querySelector(`#timeline .step[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function stopPlay(resetCursor) {
  clearInterval(timer); timer = null;
  $('#p-play').innerHTML = '<svg class="ic"><use href="#i-play"/></svg><span>Putar penalaran</span>';
  if (resetCursor) { cursor = -1; $('#timeline').classList.remove('playing'); }
}
$('#p-play').onclick = () => {
  if (timer) return stopPlay(false);
  const n = document.querySelectorAll('#timeline .step').length;
  if (!n) return;
  if (cursor >= n - 1) show(-1);
  $('#p-play').innerHTML = '<svg class="ic"><use href="#i-pause"/></svg><span>Jeda</span>';
  show(cursor + 1);
  timer = setInterval(() => cursor >= n - 1 ? stopPlay(false) : show(cursor + 1), 1700);
};
document.addEventListener('keydown', e => {
  if ($('#m-cycle').hidden || $('#mind').hidden || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') { stopPlay(false); show(cursor + 1); }
  if (e.key === 'ArrowLeft') { stopPlay(false); show(cursor - 1); }
});

let PREF2ID = {};
fetch('/api/vocab').then(r => r.json()).then(v => {
  VOC = v;
  for (const list of [...Object.values(v).filter(Array.isArray), ...Object.values(v.findings)]) for (const o of list) VL[o.id] = o.label;
  draw();
});
fetch('/api/findings').then(r => r.json()).then(m => { PREF2ID = Object.fromEntries(Object.entries(m).map(([id, label]) => [label, id])); });
fetch('/api/rules').then(r => r.json()).then(rs => {
  $('#rules').innerHTML = '<tr><th>ID</th><th>IF</th><th>THEN</th><th>Sumber</th></tr>' +
    rs.map(r => `<tr data-rule="${esc(r.id)}"><td>${esc(r.id)}</td><td>${esc(r.if)}</td><td>${esc(r.then)}</td><td>${esc(r.source)}</td></tr>`).join('');
});
fetch('/api/health').then(r => r.json()).then(h => {
  SERVER_AI = !!h.llm?.enabled; AI_INFO = h.llm; if (STEPS[S.step] === 'welcome') draw();
  $('#kb-stats').innerHTML = `<div><b>${fmt(h.triples_kb)}</b>triple pengetahuan</div><div><b>${h.rules}</b>aturan IF-THEN</div><div><b>${h.backend === 'graphdb' ? 'GraphDB' : 'rdflib'}</b>${h.backend === 'graphdb' ? 'localhost:7201' : 'in-memory'}</div>`;
});
if (new URLSearchParams(location.search).has('presentasi')) openMind(true);
renderMind();
draw();
