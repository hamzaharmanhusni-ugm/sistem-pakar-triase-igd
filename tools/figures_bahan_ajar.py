"""Gambar diagram untuk bahan ajar TBox, ABox, dan aturan (HTML -> PNG lewat Playwright + Chrome).
Pemakaian: .venv/Scripts/python tools/figures_bahan_ajar.py   -> docs/figures/ba-*.png"""
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / 'docs' / 'figures'

CSS = """
* { box-sizing: border-box; margin: 0; }
body { font-family: Calibri, Arial, sans-serif; background: #fff; color: #13201C; width: 1150px; }
#w { padding: 24px; }
.row { display: flex; gap: 18px; align-items: stretch; }
.box { border-radius: 14px; padding: 16px 18px; flex: 1; }
.t { background: #E6F2EF; border: 2px solid #0F6B5C; }
.a { background: #FFF6E5; border: 2px solid #B7791F; }
.m { background: #EEF0F8; border: 2px solid #5B6C8F; }
h2 { font-size: 22px; margin-bottom: 4px; }
h3 { font-size: 16px; margin: 10px 0 4px; }
p.sub { font-size: 14px; color: #3F4F4A; margin-bottom: 8px; }
.chip { display: inline-block; font: 13px Consolas, monospace; background: #fff; border: 1px solid #C9D6D1; border-radius: 6px; padding: 3px 7px; margin: 2px 2px 2px 0; }
.chip.c { border-color: #0F6B5C; color: #0B5549; font-weight: bold; }
.chip.i { border-color: #B7791F; color: #7A4F0B; }
.arrow { text-align: center; font-size: 14px; color: #3F4F4A; padding: 6px 0; }
.dp { display: flex; gap: 10px; }
.step { flex: 1; border-radius: 12px; padding: 12px; border: 2px solid #0F6B5C; background: #F4FAF8; }
.step b.k { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: #0F6B5C; color: #fff; margin-right: 6px; }
.step .q { font-size: 14px; margin: 6px 0; min-height: 38px; }
.step .then { font-size: 13px; color: #A23B2A; font-weight: bold; margin-top: 6px; }
.tree { font: 14px Consolas, monospace; line-height: 1.55; white-space: pre; }
"""

TBOX_ABOX = """
<div class="row">
  <div class="box t">
    <h2>TBox: triage-ontology.ttl</h2>
    <p class="sub">Kamus istilah: JENIS benda dan JENIS hubungan (298 triple)</p>
    <h3>Kelas (jenis benda)</h3>
    <span class="chip c">Finding</span><span class="chip c">Symptom</span><span class="chip c">HighRiskSituation</span>
    <span class="chip c">DangerZoneThreshold</span><span class="chip c">Condition</span><span class="chip c">BodyRegion</span>
    <span class="chip c">TriageCase</span><span class="chip c">Patient</span><span class="chip c">Rule</span><span class="chip c">Question</span>
    <h3>Property (jenis hubungan)</h3>
    <span class="chip c">presentsWith</span><span class="chip c">hasCondition</span><span class="chip c">heartRate</span><span class="chip c">moreAcuteThan</span>
    <h3>Aksioma (hukum)</h3>
    <span class="chip">Symptom subClassOf Finding</span><span class="chip">moreAcuteThan transitif</span>
    <span class="chip">heartRate subPropertyOf vitalValue</span><span class="chip">recommendedESI fungsional</span>
  </div>
  <div class="box a">
    <h2>ABox: knowledge.ttl, evidence.ttl</h2>
    <p class="sub">Isi pengetahuan: BENDA nyata dan nilainya (1.077 triple)</p>
    <h3>A1. Pengetahuan klinis</h3>
    <span class="chip i">Fever a Symptom</span><span class="chip i">DZ_HR_8y_up limit 100</span><span class="chip i">Cond_Diabetes riskFlag Risk_Metabolic</span>
    <span class="chip i">Region_RLQ broader Region_Abdomen</span><span class="chip i">ESI_1 moreAcuteThan ESI_2</span>
    <h3>A2. Meta-pengetahuan sistem pakar</h3>
    <span class="chip i">Rule_B10 ifText "..."</span><span class="chip i">Q_History neededBy Rule_B10</span><span class="chip i">Src_ESIv4</span>
    <h3>A3. Bukti empiris</h3>
    <span class="chip i">Ev_ESI_2 admitRate 0.4911</span>
    <h3>A4. Fakta kasus (sementara)</h3>
    <span class="chip i">Kasus heartRate 104</span><span class="chip i">Kasus_pasien hasCondition Cond_Hypertension</span>
  </div>
</div>
<div class="arrow">Setiap benda di ABox adalah anggota sebuah kelas di TBox (contoh: <b>Fever</b> anggota <b>Symptom</b>). Reasoner membaca aksioma TBox lalu menambah fakta baru ke ABox.</div>
<div class="row">
  <div class="box m"><h2>Di luar TBox dan ABox</h2>
    <span class="chip">rules/*.rq: 24 aturan IF-THEN (basis aturan)</span>
    <span class="chip">shapes.ttl: pemeriksa kelengkapan data (SHACL)</span>
    <span class="chip">engine.py: mesin inferensi (forward chaining)</span>
  </div>
</div>
"""

HIERARCHY = """
<div class="row">
<div class="box t"><h2>Hierarki kelas TBox (v2.2)</h2><p class="sub">Garis = rdfs:subClassOf ("setiap ... adalah ...")</p>
<div class="tree">Finding (temuan klinis)
 |- LifeSavingIndicator   Decision Point A
 |- HighRiskSituation     Decision Point B
 |- AlteredMentalStatus   Decision Point B
 |- Symptom               gejala umum
 '- RiskFactor            faktor risiko

TriageCase (satu kunjungan)  = EDVisit
 |- DangerZoneCase          = DangerZoneVisit
 '- QSOFAPositiveCase

prov:Activity
 '- Inference (jejak aturan)
prov:Entity
 |- Source (sumber pedoman)
 '- EvidenceStat (statistik MC-MED)</div></div>
<div class="box t"><h2>Hubungan utama (property)</h2><p class="sub">Panah = object property (domain -> range)</p>
<div class="tree">TriageCase --presentsWith-->  Finding
TriageCase --ofPatient----->  Patient
TriageCase --painSite------>  BodyRegion
TriageCase --onset--------->  OnsetCategory
TriageCase --candidateESI-->  ESILevel
TriageCase --recommendedESI>  ESILevel (fungsional)
Patient    --hasCondition-->  Condition
Patient    --takesMedication> MedicationClass
Condition  --riskFlag------>  RiskFlag
ESILevel   --moreAcuteThan->  ESILevel (transitif)
Inference  --usedRule------>  Rule
Inference  --dependsOn----->  Inference (transitif)
Question   --neededBy------>  Rule

Angka pada kasus (datatype property):
heartRate, respRate, o2Sat, sbp, temperatureC
  semuanya subPropertyOf vitalValue</div></div>
</div>
"""

FLOW = """
<h2 style="margin-bottom:10px">Aturan dikelompokkan menurut Decision Point ESI</h2>
<div class="dp">
  <div class="step"><b class="k">A</b><b>Penyelamatan nyawa</b><div class="q">Butuh intervensi segera?</div>
    <span class="chip">A01 temuan A</span><span class="chip">A02 SpO2 &lt; 90</span><span class="chip">A03 AVPU P/U</span><div class="then">Ya: ESI 1</div></div>
  <div class="step"><b class="k">B</b><b>Risiko tinggi</b><div class="q">Risiko tinggi, bingung, atau nyeri berat?</div>
    <span class="chip">B01</span><span class="chip">B02</span><span class="chip">B03</span><span class="chip">B04</span><span class="chip">B05</span>
    <span class="chip">B06</span><span class="chip">B07</span><span class="chip">B08</span><span class="chip">B09</span><span class="chip">B10</span>
    <span class="chip">B11</span><span class="chip">B12</span><span class="chip">F01 qSOFA</span><div class="then">Ya: ESI 2</div></div>
  <div class="step"><b class="k">C</b><b>Resource</b><div class="q">Berapa jenis resource dibutuhkan?</div>
    <span class="chip">C00 perkiraan (awam)</span><span class="chip">C01 hitung</span><span class="chip">C02 anak demam</span><div class="then">2+: ESI 3, 1: ESI 4, 0: ESI 5</div></div>
  <div class="step"><b class="k">D</b><b>Tanda vital</b><div class="q">Tanda vital di danger zone?</div>
    <span class="chip">D01 danger zone</span><span class="chip">E01 naikkan</span><div class="then">Ya: pertimbangkan ESI 2</div></div>
</div>
<div class="row" style="margin-top:14px">
  <div class="box m"><b>Pendukung (tidak mengubah ESI):</b> <span class="chip">G01 shock index</span><span class="chip">G02 jendela stroke 4,5 jam</span></div>
  <div class="box a"><b>Resolusi konflik (paling akhir):</b> <span class="chip">Z01</span> rekomendasi = kandidat ESI paling akut</div>
</div>
<div class="arrow">Semua aturan A-G dijalankan berulang (forward chaining) sampai tidak ada fakta baru, lalu Z01 dijalankan sekali.</div>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome')
        page = b.new_page(device_scale_factor=2)
        for name, body in [('ba-tbox-abox', TBOX_ABOX), ('ba-hierarki-tbox', HIERARCHY), ('ba-alur-aturan', FLOW)]:
            page.set_content(f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div id="w">{body}</div></body></html>')
            page.locator('#w').screenshot(path=str(OUT / f'{name}.png'))
            print('ditulis:', OUT / f'{name}.png')
        b.close()


if __name__ == '__main__':
    main()
