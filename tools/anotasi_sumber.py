"""Beri stabilo dan komentar pada salinan buku ESI (Gilboy 2012) di kalimat yang menjadi sumber setiap aturan.
Pemakaian (butuh PyMuPDF, mis. Python Laragon):  python tools/anotasi_sumber.py "<path PDF Gilboy 2012>"
Keluaran: data/sumber/Gilboy 2012 ESI Handbook - beranotasi.pdf (folder data/ di-gitignore; PDF asli tidak diubah).
Warna stabilo: A merah, B oranye, C biru, D hijau, pendukung/model pasien ungu."""
import json
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'sumber' / 'Gilboy 2012 ESI Handbook - beranotasi.pdf'
COLOR = {'A': (1, 0.55, 0.55), 'B': (1, 0.78, 0.35), 'C': (0.55, 0.75, 1), 'D': (0.55, 0.9, 0.55), 'P': (0.8, 0.65, 1)}

# (halaman PDF, kalimat yang distabilo, kelompok warna, aturan, komentar)
ANCHORS = [
    (18, 'intubated, apneic, pulseless, severe respiratory distress', 'A', 'A01',
     'A01: temuan penyelamatan nyawa -> kandidat ESI 1. Dimodelkan sebagai individu ex:LifeSavingIndicator (Intubated, Apnea, Pulseless, SevereRespDistress, MajorBleeding, Unresponsive) di knowledge.ttl.'),
    (18, 'SpO2 < 90 percent', 'A', 'A02', 'A02: SpO2 < 90 -> kandidat ESI 1. Ambang ditulis di kb/rules/A02_spo2_kritis.rq.'),
    (19, 'AVPU (alert, verbal, pain, unresponsive)', 'A', 'A03', 'A03: AVPU P atau U -> ESI 1; AVPU V -> B02. Dibaca dari ex:avpu pada kasus.'),
    (17, 'the triage process is complete', 'A', 'Z01', 'Z01: algoritma berurutan A, B, C, D. Sistem menjalankan semua aturan lalu memilih kandidat paling akut (resolusi konflik).'),
    (20, 'Is the patient in severe pain or distress?', 'B', 'B03', 'B03: skala nyeri >= 7/10 -> kandidat ESI 2 (ambang 7 dari Gambar 2-1 B).'),
    (20, 'worst headache of my life', 'B', 'B11', 'B11 dan ex:ThunderclapHeadache: sakit kepala mendadak terhebat -> ESI 2 (curiga perdarahan subaraknoid).'),
    (20, "age and past medical history influence the triage nurse's determination of risk", 'P', 'B06-B12',
     'Dasar model pasien v2.2 (ex:Patient, ex:Condition, ex:MedicationClass, ex:riskFlag): usia dan riwayat penyakit mengubah risiko. Dipakai B06, B07, B08, B09, B10, B12.'),
    (21, 'Signs of a stroke, but does not meet level-1 criteria', 'B', 'B01', 'B01: ex:StrokeSigns sebagai ex:HighRiskSituation -> kandidat ESI 2.'),
    (21, 'A rule-out ectopic pregnancy, hemodynamically stable', 'B', 'B09', 'B09 dan ex:EctopicRisk: nyeri perut + hamil/mungkin hamil -> ESI 2.'),
    (21, 'A patient on chemotherapy and therefore immunocompromised, with a fever', 'B', 'B07',
     'B07: demam + penanda ex:Risk_Immunocompromised (kanker, transplantasi, HIV, steroid, kemoterapi) -> ESI 2.'),
    (21, 'A needle stick in a health care worker', 'B', 'B01', 'B01: ex:NeedleStick sebagai situasi risiko tinggi.'),
    (26, 'new onset confusion, lethargy, or disorientation', 'B', 'B02', 'B02: ex:NewConfusion (ex:AlteredMentalStatus) atau AVPU V -> kandidat ESI 2.'),
    (27, 'a frail elderly patient with severe abdominal pain is at a much higher risk', 'B', 'B08',
     'B08: nyeri perut (keluhan atau lokasi di bawah ex:Region_Abdomen) + usia >= 65 -> ESI 2. Ambang 65 tahun perlu validasi pakar.'),
    (28, 'Chest pain is also a very common chief complaint', 'B', 'B12',
     'B12 dan ex:ChestPainACS: nyeri dada + penanda ex:Risk_Cardiac -> ESI 2 (curiga sindrom koroner akut). Perlu validasi pakar.'),
    (29, 'Time from onset of symptoms is a critical factor', 'P', 'G02', 'G02: tanda stroke + onset <= 4,5 jam -> peringatan jendela trombolisis (ambang dari AHA/ASA 2019).'),
    (29, 'at risk for diabetic ketoacidosis', 'B', 'B10', 'B10: mual/muntah/diare + penanda ex:Risk_Metabolic (diabetes, insulin) -> ESI 2.'),
    (29, 'Hyperkalemia might be suspected in any renal dialysis patient', 'P', 'Cond_Dialysis',
     'ex:Cond_Dialysis diberi penanda ex:Risk_Hyperkalemia. Belum ada aturan yang membacanya (tercatat di analisis penyederhanaan).'),
    (29, 'Sepsis', 'P', 'F01', 'F01 qSOFA bersumber dari Sepsis-3 (Singer 2016); buku ESI menyebut sepsis sebagai situasi risiko tinggi.'),
    (31, 'status post-organ transplant are immunocompromised and considered high-risk', 'B', 'B07', 'B07: ex:Cond_Transplant -> ex:Risk_Immunocompromised.'),
    (32, 'High risk for acute abdominal', 'B', 'B08', 'B08: contoh Tabel 3-1, perempuan 88 tahun dengan nyeri perut kanan bawah = ESI 2.'),
    (33, 'High risk for possible ectopic', 'B', 'B09', 'B09: contoh Tabel 3-1, hamil 8 minggu dengan nyeri perut bawah = ESI 2.'),
    (39, 'differentiated by the nurse', 'C', 'C01', 'C01: ESI 3/4/5 dibedakan jumlah JENIS resource (bobot >= 2 / 1 / 0). Individu ex:Resource di knowledge.ttl.'),
    (41, 'Examples of ESI level-3, -4, and -5 patients are shown in Table 4-2', 'C', 'C00',
     'C00: perkiraan resource untuk pengisian awam (ex:typicalResource) disusun dari contoh Tabel 4-1 dan 4-2.'),
    (17, '1 to 28 days of age: assign at least ESI 2', 'B', 'B04', 'B04: usia 1-28 hari + suhu > 38,0 °C -> minimal ESI 2.'),
    (17, '1-3 months of age: consider assigning ESI 2', 'B', 'B05', 'B05: usia 1-3 bulan + suhu > 38,0 °C -> pertimbangkan ESI 2.'),
    (17, '3 months to 3 yrs of age: consider assigning ESI 3', 'C', 'C02', 'C02: usia 3 bulan-3 tahun + suhu > 39,0 °C atau imunisasi tidak lengkap -> ESI 3.'),
    (17, 'Consider uptriage to ESI 2 if any vital sign criterion is exceeded', 'D', 'D01/E01', 'D01 dan E01: tanda vital di danger zone -> pertimbangkan naik ke ESI 2.'),
    (43, 'must strongly consider up', 'D', 'E01', 'E01: DangerZoneCase pada kandidat ESI 3-5 -> kandidat ESI 2 (uptriage).'),
    (112, 'SaO2<92%', 'D', 'D01', 'D01: ex:DZ_SpO2_all (SpO2 < 92) di knowledge.ttl.'),
    (112, '>8y', 'D', 'D01', 'D01: ambang per kelompok usia, mis. ex:DZ_HR_8y_up (nadi > 100) dan ex:DZ_RR_8y_up (napas > 20). Sembilan individu ex:DangerZoneThreshold.'),
]


def main(src):
    doc = fitz.open(src)
    found, missing = [], []
    for page_no, phrase, group, rule, note in ANCHORS:
        page = doc[page_no - 1]
        quads = page.search_for(phrase, quads=True)
        if not quads:
            missing.append((page_no, rule, phrase))
            continue
        q = quads[:1] if len(phrase) < 12 else quads  # frasa pendek: tandai kemunculan pertama saja
        a = page.add_highlight_annot(q)
        a.set_colors(stroke=COLOR[group])
        a.set_info(title=f'Sistem Pakar Triase - {rule}', content=note)
        a.update()
        found.append((page_no, rule, group))
    # halaman peta di belakang
    legend = doc.new_page(-1, width=612, height=792)  # di belakang agar nomor halaman sama dengan PDF asli
    lines = ['PETA SUMBER ATURAN SISTEM PAKAR TRIASE IGD', 'Salinan beranotasi. Nomor halaman sama dengan PDF asli (halaman peta ini ditambahkan di akhir).', '',
             'Warna stabilo: merah = Decision Point A, oranye = B, biru = C, hijau = D, ungu = model pasien/pendukung.',
             'Arahkan kursor ke stabilo untuk membaca komentar: aturan dan IRI knowledge graph yang bersumber dari kalimat itu.', '']
    for page_no, rule, group in sorted(found):
        lines.append(f'  hal. {page_no:>3}   {rule:<14} kelompok {group}')
    lines += ['', 'Aturan yang tidak bersumber dari buku ini:', '  F01 qSOFA: Singer dkk. 2016 (Sepsis-3)', '  G01 shock index: Allgower dan Burri 1967',
              '  G02 ambang 4,5 jam: Powers dkk. 2019 (AHA/ASA)', '  Statistik ESI dan danger zone: MC-MED (lihat dokumen 06)']
    legend.insert_textbox(fitz.Rect(48, 48, 564, 760), '\n'.join(lines), fontsize=9.5, fontname='cour')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT, garbage=3, deflate=True)
    print(json.dumps({'ditulis': str(OUT), 'stabilo': len(found), 'tidak_ditemukan': missing}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main(sys.argv[1])
