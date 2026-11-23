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
const S = { step: 0, who: null, age: '', unit: 'tahun', danger: [], dangerNone: false, findings: [], pain: null, m: {}, result: null };
const STEPS = ['welcome', 'age', 'danger', 'complaint', 'pain', 'measure', 'result'];
const Q_STEPS = 5;
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
  for (const k of ['temp', 'hr', 'rr', 'spo2']) if (S.m[k]) f[k] = parseFloat(String(S.m[k]).replace(',', '.'));
  return f;
}

async function assess() {
  const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(facts()) });
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
      <h1>Sakit mendadak? Cek dulu, perlu ke IGD atau cukup ke klinik.</h1>
      <p class="lead">Jawab 5 pertanyaan singkat. Kami menilai tingkat kegawatan dengan aturan triase yang digunakan IGD rumah sakit, lalu menjelaskan alasannya.</p>
      <div class="q-body">
        <p class="sub-label">Siapa yang sedang sakit?</p>
        <div class="who">
          ${[['self', 'Saya sendiri'], ['child', 'Anak saya'], ['adult', 'Orang lain (dewasa)']].map(([k, t]) =>
            `<button class="opt" type="button" data-act="who" data-v="${k}" ${pressed(S.who === k)}>${tick}${t}</button>`).join('')}
        </div>
      </div>
      ${cta('Mulai cek', !!S.who, 'Pilih dulu siapa yang sedang sakit.')}</div>`,

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

  result: () => {
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
        ${r.alerts.filter(a => !a.startsWith('Resource')).map(a => `<p class="alert-box">${esc(a.replace('Shock index >= 1,0: waspadai syok tersembunyi, evaluasi ulang tanda vital.', 'Perbandingan nadi dan tekanan darah menunjukkan kemungkinan syok. Sampaikan hal ini kepada petugas.'))}</p>`).join('')}
        ${S.findings.includes('SuicidalIdeation') ? '<p class="alert-box">Anda tidak sendiri. Bicarakan dengan seseorang sekarang: layanan kesehatan jiwa SEJIWA di 119 ekstensi 8.</p>' : ''}
        ${l <= 2 ? `<div><h2>Selama menuju IGD</h2><ul class="tips">
          <li>${S.who === 'self' ? 'Jangan menyetir sendiri; minta diantar keluarga atau ambulans.' : 'Temani terus dan jangan biarkan sendirian.'}</li>
          <li>Bawa kartu identitas atau BPJS dan daftar obat yang sedang diminum.</li>
          <li>Bila memburuk di jalan (tidak sadar, sesak berat, kejang), telepon 119.</li></ul></div>` : `<div><h2>Sambil menunggu</h2><ul class="tips">
          <li>Perhatikan perubahan keluhan. Segera ke IGD bila muncul tanda bahaya seperti sesak berat atau sulit dibangunkan.</li>
          <li>Bawa kartu identitas atau BPJS saat berobat.</li></ul></div>`}
      </section></div>`;
  },
};

function layReasons(r) {
  const out = [];
  const f = facts();
  const vitalWord = { 'Denyut jantung': ['Denyut nadi', 'kali per menit', 'lebih cepat dari'], 'Laju napas': ['Napas', 'kali per menit', 'lebih cepat dari'], 'SpO2': ['Kadar oksigen', '%', 'di bawah'] };
  const ORDER = ['A01', 'A02', 'A03', 'B01', 'B02', 'B03', 'B04', 'B05', 'F01', 'D01', 'C02'];  // urutan keakutan algoritma ESI
  const trace = [...r.trace].sort((a, b) => (ORDER.indexOf(a.rule) + 99) % 99 - (ORDER.indexOf(b.rule) + 99) % 99);
  for (const t of trace) {
    if (['C00', 'C01', 'E01', 'Z01', 'G01'].includes(t.rule)) continue;
    if (t.rule === 'D01') {
      const m = t.reason.match(/^(Denyut jantung|Laju napas|SpO2)[^=]*= ([\d.]+) [<>] ([\d.]+)/);
      if (m) { const [w, u, cmp] = vitalWord[m[1]]; out.push(`${w} ${num(m[2])} ${u}, ${cmp} batas aman untuk usia ${ageText()} (${cmp === 'di bawah' ? 'minimal' : 'paling tinggi'} ${num(m[3])}).`); }
      continue;
    }
    if (t.rule === 'C02') { out.push(f.temp > 39 ? `Demam ${dec(f.temp)} °C pada anak di bawah 3 tahun perlu segera diperiksa dokter.` : 'Anak di bawah 3 tahun yang demam dengan imunisasi belum lengkap perlu segera diperiksa dokter.'); continue; }
    if (t.rule === 'B04' || t.rule === 'B05') { out.push(`Bayi berusia ${ageText()} dengan suhu ${dec(f.temp)} °C. Demam pada bayi semuda ini perlu segera diperiksa dokter.`); continue; }
    if (t.rule === 'B03') { out.push(`Rasa nyerinya sangat berat (${f.pain} dari 10).`); continue; }
    const items = t.used.map(u => LABEL[PREF2ID[u]] || '').filter(Boolean);
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
    <div class="card"><h2>Yang akan ditanyakan</h2><ol class="steps"><li>Usia</li><li>Tanda bahaya</li><li>Keluhan</li><li>Rasa nyeri</li><li>Hasil ukur (bila ada)</li></ol></div>
    <div class="card sos-card"><p>Bila tidak sadar, tidak bernapas, atau perdarahan hebat: <a href="tel:119">telepon 119 sekarang</a>.</p></div>`;
  const f = facts();
  const vit = [f.temp && `suhu ${dec(f.temp)} °C`, f.hr && `nadi ${f.hr}`, f.rr && `napas ${f.rr}`, f.spo2 && `oksigen ${f.spo2}%`].filter(Boolean).join(', ');
  const painTxt = S.pain === null ? '' : (S.who === 'child' && (ageYears() ?? 9) < 4 ? KID_PAIN.find(k => k[0] === S.pain)?.[1] : `${S.pain} dari 10`);
  const rows = [
    ['Untuk', { self: 'Saya sendiri', child: 'Anak', adult: 'Orang lain (dewasa)' }[S.who], 0],
    ['Usia', ageText(), 1],
    ['Tanda bahaya', S.danger.length ? S.danger.map((d, i) => i ? LABEL[d].toLowerCase() : LABEL[d]).join(', ') : S.dangerNone ? 'Tidak ada' : '', 2],
    ['Keluhan', S.findings.map((d, i) => i ? LABEL[d].toLowerCase() : LABEL[d]).join(', '), 3],
    ['Nyeri', painTxt, 4],
    ['Hasil ukur', vit || (S.step >= 6 ? 'Tidak diukur' : ''), 5],
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
  if (STEPS[S.step] === 'age') $('#age')?.focus();
}

async function go(to) {
  S.step = Math.max(0, Math.min(to, STEPS.length - 1));
  if (STEPS[S.step] === 'result') {
    try { await assess(); } catch (e) { alert('Gagal menghubungi server: ' + e.message); S.step = 5; }
  } else if (S.step >= 2 && ageOk() && !$('#mind').hidden) assess().catch(() => {});
  draw();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function reset() {
  Object.assign(S, { step: 0, who: null, age: '', unit: 'tahun', danger: [], dangerNone: false, findings: [], pain: null, m: {}, result: null });
  renderMind();
  go(0);
}

/* ---------- interaksi ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'FORM' || b.disabled) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case 'who': if (S.who !== v) { S.who = v; S.unit = 'tahun'; S.age = ''; } draw(); break;
    case 'next': go(S.step === 2 && S.danger.length ? 6 : S.step + 1); break;
    case 'back': go(S.step - 1); break;
    case 'goto': go(+v); break;
    case 'unit': S.unit = v; draw(); break;
    case 'danger': S.danger = S.danger.includes(v) ? S.danger.filter(x => x !== v) : [...S.danger, v]; S.dangerNone = false; draw(); break;
    case 'dangerNone': S.danger = []; S.dangerNone = !S.dangerNone; draw(); break;
    case 'finding': S.findings = S.findings.includes(v) ? S.findings.filter(x => x !== v) : [...S.findings, v]; draw(); break;
    case 'pain': S.pain = +v; draw(); break;
    case 'finish-skip': S.m = {}; go(6); break;
    case 'finish': {
      const lim = { temp: [30, 45, 'Suhu', '°C'], hr: [20, 300, 'Denyut nadi', 'kali/menit'], rr: [4, 100, 'Napas', 'kali/menit'], spo2: [50, 100, 'Kadar oksigen', '%'] };
      const bad = Object.entries(lim).find(([k, [lo, hi]]) => S.m[k] && !(parseFloat(String(S.m[k]).replace(',', '.')) >= lo && parseFloat(String(S.m[k]).replace(',', '.')) <= hi));
      if (bad) { const [, [lo, hi, t, u]] = bad; $('#measure-err').textContent = `${t} sepertinya tidak sesuai (seharusnya antara ${lo} dan ${hi} ${u}). Periksa lagi atau kosongkan.`; break; }
      go(6); break;
    }
    case 'restart': reset(); break;
    case 'think': openMind(true); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'age') {
    S.age = e.target.value; $('#next').disabled = !ageOk(); $('#age-hint').textContent = ageHint(); $('#side').innerHTML = side();
    const h = document.querySelector('.cta-hint'); if (h) h.hidden = ageOk();
  }
  if (e.target.dataset.m) S.m[e.target.dataset.m] = e.target.value;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'age' && ageOk()) go(S.step + 1);
  if (e.key === 'Escape' && !$('#mind').hidden) openMind(false);
});
document.addEventListener('submit', async e => {
  if (e.target.dataset.act !== 'parse') return;
  e.preventDefault();
  const text = $('#own').value.trim();
  if (!text) return;
  $('#found').textContent = 'Mengenali keluhan…';
  try {
    const r = await (await fetch('/api/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })).json();
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
});

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
    else if (S.step >= ({ A: 3, B: 5, C: 6, D: 6 })[k]) st = 'tidak';
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
fetch('/api/findings').then(r => r.json()).then(m => { PREF2ID = Object.fromEntries(Object.entries(m).map(([id, label]) => [label, id])); });
fetch('/api/rules').then(r => r.json()).then(rs => {
  $('#rules').innerHTML = '<tr><th>ID</th><th>IF</th><th>THEN</th><th>Sumber</th></tr>' +
    rs.map(r => `<tr data-rule="${esc(r.id)}"><td>${esc(r.id)}</td><td>${esc(r.if)}</td><td>${esc(r.then)}</td><td>${esc(r.source)}</td></tr>`).join('');
});
fetch('/api/health').then(r => r.json()).then(h => {
  $('#kb-stats').innerHTML = `<div><b>${fmt(h.triples_kb)}</b>triple pengetahuan</div><div><b>${h.rules}</b>aturan IF-THEN</div><div><b>${h.backend === 'graphdb' ? 'GraphDB' : 'rdflib'}</b>${h.backend === 'graphdb' ? 'localhost:7201' : 'in-memory'}</div>`;
});
if (new URLSearchParams(location.search).has('presentasi')) openMind(true);
renderMind();
draw();
