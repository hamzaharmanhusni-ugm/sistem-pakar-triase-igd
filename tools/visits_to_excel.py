"""Ubah data mentah MC-MED visits.csv menjadi Excel yang rapi dan berkomentar.
Pemakaian (butuh pandas + openpyxl, mis. Python Laragon):  python tools/visits_to_excel.py
Masukan : data/raw/mc-med-1.0.0/visits.csv
Keluaran: data/processed/MC-MED Data Kunjungan IGD.xlsx  (folder data/ di-gitignore: lisensi PhysioNet credentialed)
Setelah ditulis, Excel (COM) digunakan untuk menghitung ulang rumus lalu menyimpan nilainya."""
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'raw' / 'mc-med-1.0.0' / 'visits.csv'
OUT = ROOT / 'data' / 'processed' / 'MC-MED Data Kunjungan IGD.xlsx'
DATA = 'Data Kunjungan'

GROUPS = {  # kelompok kolom: warna judul
    'Identitas': '3F4F4A', 'Demografi': '5B6C8F', 'Triase': '0F6B5C', 'Keluhan dan diagnosis': '8A5A00',
    'Hasil kunjungan': 'A23B2A', 'Waktu': '56655F', 'Turunan (rumus)': '6B3FA0',
}

# kolom asli -> (nama Indonesia, kelompok, arti, satuan atau nilai, kaitan dengan sistem pakar, jenis)
DICT = {
    'MRN': ('ID pasien', 'Identitas', 'Nomor rekam medis samaran. Satu pasien dapat memiliki beberapa kunjungan.', 'kode acak', 'Setara node ex:Patient (ontologi v2.2): riwayat melekat pada pasien, bukan pada kunjungan.', 'text'),
    'CSN': ('ID kunjungan', 'Identitas', 'Nomor kunjungan samaran. Satu baris = satu kunjungan IGD.', 'kode acak, unik', 'Setara satu ex:TriageCase (dulu ex:EDVisit di Tugas 4).', 'text'),
    'Visit_no': ('Kunjungan ke-', 'Identitas', 'Urutan kunjungan pasien ini dalam periode data.', 'angka', 'Tidak digunakan aturan.', 'int'),
    'Visits': ('Total kunjungan pasien', 'Identitas', 'Jumlah seluruh kunjungan pasien ini.', 'angka', 'Tidak digunakan aturan. Pasien yang sering kembali dapat menjadi bahan analisis lanjutan.', 'int'),
    'Age': ('Usia', 'Demografi', 'Usia saat kunjungan. Dataset hanya berisi pasien dewasa; usia 90 atau lebih dicatat 90 (de-identifikasi).', 'tahun, 18-90', 'ex:age. Menentukan kelompok usia ambang danger zone (D01), lansia >= 65 (B08), dewasa untuk qSOFA (F01).', 'int'),
    'Gender': ('Jenis kelamin', 'Demografi', 'F = perempuan, M = laki-laki, U = tidak diketahui.', 'F / M / U', 'ex:sex (Sex_F / Sex_M) pada pasien; dibaca aturan B09 bersama status kehamilan.', 'text'),
    'Race': ('Ras', 'Demografi', 'Ras menurut pencatatan rumah sakit di Amerika Serikat.', 'kategori', 'Tidak digunakan. Ras bukan kriteria ESI.', 'text'),
    'Ethnicity': ('Etnis', 'Demografi', 'Hispanik atau bukan.', 'kategori', 'Tidak digunakan. Etnis bukan kriteria ESI.', 'text'),
    'Means_of_arrival': ('Cara datang', 'Triase', 'EMS = diantar ambulans, Self = datang sendiri, Other/Unknown = lainnya.', 'kategori', 'Belum digunakan aturan. Kedatangan dengan ambulans sering menyertai kasus lebih gawat.', 'text'),
    'Triage_Temp': ('Suhu triase', 'Triase', 'Suhu tubuh saat triase.', '°C', 'ex:temperatureC. Aturan B04, B05 (bayi), C02 (anak), B07 (demam >= 38 pada imunokompromais).', 'float'),
    'Triage_HR': ('Nadi triase', 'Triase', 'Denyut jantung saat triase.', 'kali/menit', 'ex:heartRate. D01: dewasa > 100 = danger zone. G01: nadi/TD sistolik >= 1 = peringatan syok.', 'float'),
    'Triage_RR': ('Napas triase', 'Triase', 'Laju napas saat triase.', 'kali/menit', 'ex:respRate. D01: dewasa > 20 = danger zone. F01: >= 22 = satu kriteria qSOFA.', 'float'),
    'Triage_SpO2': ('SpO2 triase', 'Triase', 'Saturasi oksigen saat triase.', '%', 'ex:o2Sat. A02: < 90 = ESI 1. D01: < 92 = danger zone.', 'float'),
    'Triage_SBP': ('TD sistolik', 'Triase', 'Tekanan darah sistolik saat triase.', 'mmHg', 'ex:sbp. F01: <= 100 = satu kriteria qSOFA. G01: shock index.', 'float'),
    'Triage_DBP': ('TD diastolik', 'Triase', 'Tekanan darah diastolik saat triase.', 'mmHg', 'Tidak digunakan aturan.', 'float'),
    'Triage_acuity': ('ESI dari perawat', 'Triase', 'Level ESI yang ditetapkan perawat triase: 1-Resuscitation sampai 5-Non-Urgent.', '1-5 dengan nama level', 'ex:triageESI. Inilah "jawaban perawat" yang menjadi pembanding hasil sistem pakar, dan dasar statistik Ev_ESI_1-5 di evidence.ttl.', 'text'),
    'CC': ('Keluhan utama', 'Keluhan dan diagnosis', 'Keluhan utama (chief complaint) dalam teks bebas berbahasa Inggris, ditulis saat triase.', 'teks', 'Padanan ex:presentsWith. Teks seperti CHEST PAIN dipetakan ke ex:Finding melalui sinonim (skos:altLabel) atau Claude API.', 'text'),
    'ED_dispo': ('Disposisi IGD', 'Hasil kunjungan', 'Keputusan akhir di IGD: Discharge (pulang), Observation, Inpatient (rawat inap), ICU.', 'kategori', 'Inpatient atau ICU = dirawat (admitRate). ICU = luaran kritis (criticalRate). Ini luaran yang digunakan untuk menilai ketepatan ESI.', 'text'),
    'Hours_to_next_visit': ('Jam sampai kunjungan berikutnya', 'Hasil kunjungan', 'Jarak ke kunjungan IGD berikutnya. Kosong = tidak kembali dalam periode data.', 'jam', 'Belum digunakan. Kembali < 72 jam dapat menandai kemungkinan undertriage (bahan validasi).', 'float'),
    'Dispo_class_next_visit': ('Disposisi kunjungan berikutnya', 'Hasil kunjungan', 'Disposisi pada kunjungan berikutnya, bila ada.', 'kategori', 'Belum digunakan.', 'text'),
    'ED_LOS': ('Lama di IGD', 'Hasil kunjungan', 'Lama pasien berada di IGD (length of stay).', 'jam', 'Belum digunakan. Dapat menggambarkan beban resource.', 'float'),
    'Hosp_LOS': ('Lama rawat inap', 'Hasil kunjungan', 'Lama rawat inap bila dirawat. Kosong = tidak dirawat.', 'hari', 'Belum digunakan.', 'float'),
    'DC_dispo': ('Disposisi pulang RS', 'Hasil kunjungan', 'Tujuan saat keluar rumah sakit, mis. rumah, panti rawat, Expired (meninggal).', 'kategori', 'Expired = luaran kritis (criticalRate) di evidence.ttl.', 'text'),
    'Payor_class': ('Penjamin', 'Demografi', 'Medicare atau Medicaid; kosong = penjamin lain (asuransi swasta atau tidak diketahui).', 'kategori', 'Tidak digunakan.', 'text'),
    'Admit_service': ('Unit perawatan', 'Hasil kunjungan', 'Unit yang merawat bila pasien dirawat inap.', 'kategori', 'Belum digunakan. Dapat digunakan untuk memeriksa ketepatan resource Konsultasi spesialis.', 'text'),
    'Dx_ICD9': ('Diagnosis ICD-9', 'Keluhan dan diagnosis', 'Kode diagnosis utama versi ICD-9.', 'kode', 'Tidak digunakan (versi lama).', 'text'),
    'Dx_ICD10': ('Diagnosis ICD-10', 'Keluhan dan diagnosis', 'Kode diagnosis utama versi ICD-10.', 'kode', 'Sistem kode yang sama dengan skos:notation pada ex:Condition (riwayat penyakit), mis. I10 hipertensi.', 'text'),
    'Dx_name': ('Nama diagnosis', 'Keluhan dan diagnosis', 'Nama diagnosis utama dalam bahasa Inggris.', 'teks', 'Bahan validasi: apakah keluhan + aturan mengarah ke diagnosis yang serius.', 'text'),
    'Arrival_time': ('Waktu tiba', 'Waktu', 'Waktu pasien tiba di IGD (UTC). Tanggal digeser ke abad 22-23 untuk de-identifikasi; selisih antarwaktu tetap benar.', 'tanggal dan jam', 'Belum digunakan. Selisih dengan waktu masuk ruang = waktu tunggu (kolom turunan).', 'time'),
    'Roomed_time': ('Waktu masuk ruang', 'Waktu', 'Waktu pasien ditempatkan di ruang periksa.', 'tanggal dan jam', 'Digunakan kolom turunan waktu tunggu. ESI yang lebih gawat seharusnya menunggu lebih singkat.', 'time'),
    'Dispo_time': ('Waktu keputusan disposisi', 'Waktu', 'Waktu keputusan pulang atau rawat dibuat.', 'tanggal dan jam', 'Belum digunakan.', 'time'),
    'Admit_time': ('Waktu masuk rawat inap', 'Waktu', 'Waktu pasien resmi dirawat inap. Kosong = tidak dirawat.', 'tanggal dan jam', 'Belum digunakan.', 'time'),
    'Departure_time': ('Waktu keluar IGD', 'Waktu', 'Waktu pasien meninggalkan IGD.', 'tanggal dan jam', 'Belum digunakan.', 'time'),
}
COLS = list(DICT)
L = {c: get_column_letter(i + 1) for i, c in enumerate(COLS)}  # huruf kolom data asli

# kolom turunan berupa rumus Excel agar logikanya terlihat (baris {r})
DERIVED = [
    ('ESI (angka)', f'=IFERROR(VALUE(LEFT({L["Triage_acuity"]}{{r}},1)),"")',
     'Angka depan kolom ESI dari perawat (1-5). Kosong bila ESI tidak tercatat.', 'Memudahkan filter dan ringkasan per level ESI.', '0'),
    ('Dirawat (inap/ICU)', f'=IF(OR({L["ED_dispo"]}{{r}}="Inpatient",{L["ED_dispo"]}{{r}}="ICU"),"Ya","Tidak")',
     'Ya bila disposisi IGD Inpatient atau ICU.', 'Definisi admitRate di kb/build_evidence.py dan evidence.ttl.', '@'),
    ('Luaran kritis', f'=IF(OR({L["ED_dispo"]}{{r}}="ICU",{L["DC_dispo"]}{{r}}="Expired"),"Ya","Tidak")',
     'Ya bila masuk ICU atau meninggal di rumah sakit.', 'Definisi criticalRate di evidence.ttl.', '@'),
    ('Danger zone (D01)', '=IF(OR(AND({hr}{{r}}<>"",{hr}{{r}}>100),AND({rr}{{r}}<>"",{rr}{{r}}>20),AND({sp}{{r}}<>"",{sp}{{r}}<92)),"Ya","Tidak")'.format(
        hr=L['Triage_HR'], rr=L['Triage_RR'], sp=L['Triage_SpO2']),
     'Ya bila nadi > 100, napas > 20, atau SpO2 < 92 (ambang dewasa).', 'Sama dengan aturan D01 untuk usia > 8 tahun (Gilboy 2012, Gambar 2-1 D).', '@'),
    ('Shock index', f'=IF(AND(ISNUMBER({L["Triage_HR"]}{{r}}),ISNUMBER({L["Triage_SBP"]}{{r}}),{L["Triage_SBP"]}{{r}}>0),{L["Triage_HR"]}{{r}}/{L["Triage_SBP"]}{{r}},"")',
     'Nadi dibagi TD sistolik.', 'Aturan G01: >= 1,0 memunculkan peringatan syok (Allgöwer dan Burri 1967).', '0.00'),
    ('Waktu tunggu (menit)', f'=IF(AND(ISNUMBER({L["Arrival_time"]}{{r}}),ISNUMBER({L["Roomed_time"]}{{r}})),({L["Roomed_time"]}{{r}}-{L["Arrival_time"]}{{r}})*1440,"")',
     'Menit dari tiba sampai masuk ruang periksa.', 'Pembanding: ESI 1-2 seharusnya menunggu paling singkat.', '0'),
]
# nama kolom turunan di sheet data (bahasa Inggris, seragam dengan kolom asli); nama Indonesia di komentar
EN = {'ESI (angka)': 'ESI_level', 'Dirawat (inap/ICU)': 'Admitted', 'Luaran kritis': 'Critical_outcome',
      'Danger zone (D01)': 'Danger_zone_D01', 'Shock index': 'Shock_index', 'Waktu tunggu (menit)': 'Wait_minutes'}
D = {name: get_column_letter(len(COLS) + i + 1) for i, (name, *_) in enumerate(DERIVED)}

FONT = 'Arial'
thin = Side(style='thin', color='D3DFD9')
fill = lambda h: PatternFill('solid', fgColor=h)


def convert(v, kind):
    if pd.isna(v) or v == '':
        return None
    if kind == 'int':
        return int(v)
    if kind == 'float':
        return float(v)
    if kind == 'time':
        return datetime.strptime(v, '%Y-%m-%dT%H:%M:%SZ')
    return str(v)


def header(ws, name, group, note):
    c = WriteOnlyCell(ws, value=name)
    c.font = Font(name=FONT, bold=True, color='FFFFFF', size=10)
    c.fill = fill(GROUPS[group])
    c.alignment = Alignment(wrap_text=True, vertical='center')
    c.comment = Comment(note, 'Kamus data')
    c.comment.width, c.comment.height = 380, 190
    return c


def build():
    df = pd.read_csv(SRC, dtype=str, keep_default_na=False)
    n = len(df)
    last = n + 1
    wb = Workbook(write_only=True)

    # ---------------- Baca Saya ----------------
    ws = wb.create_sheet('Baca Saya')
    ws.column_dimensions['A'].width = 26
    ws.column_dimensions['B'].width = 110
    rows = [
        ('MC-MED: Data Kunjungan IGD', None),
        (None, None),
        ('Isi', f'{n:,} kunjungan IGD dewasa (satu baris satu kunjungan), 33 kolom asli + 6 kolom turunan berupa rumus.'.replace(',', '.')),
        ('Sumber', 'MC-MED 1.0.0, Kansal A, dkk. Scientific Data 2025 (PhysioNet). Berkas asli: data/raw/mc-med-1.0.0/visits.csv.'),
        ('Lisensi', 'PhysioNet credentialed. Jangan dibagikan atau diunggah. Folder data/ sengaja di-gitignore.'),
        ('De-identifikasi', 'ID pasien dan kunjungan berupa kode samaran. Tanggal digeser ke abad 22-23, tetapi selisih antarwaktu tetap benar. Usia 90 berarti 90 tahun atau lebih.'),
        ('Hubungan dengan proyek', 'Sistem pakar TIDAK membaca data ini saat berjalan. Data hanya diringkas menjadi angka agregat di kb/evidence.ttl (bukti empiris), dan menjadi bahan validasi aturan.'),
        (None, None),
        ('Cara membaca', None),
        ('Sheet Data Kunjungan', 'Judul kolom menggunakan nama asli dataset (bahasa Inggris). Arahkan kursor ke judul kolom: komentar berisi nama Indonesia, arti, satuan, dan kaitannya dengan aturan sistem pakar. Gunakan tombol filter di baris judul.'),
        ('Sheet Kamus Data', 'Daftar semua kolom dalam satu tabel, termasuk jumlah sel kosong (dihitung dengan rumus).'),
        ('Sheet Ringkasan ESI', 'Statistik per level ESI dihitung dengan rumus dari sheet data, lalu dibandingkan dengan angka di kb/evidence.ttl.'),
        (None, None),
        ('Warna judul kolom', None),
    ] + [(g, None) for g in GROUPS] + [
        (None, None),
        ('Dibuat dengan', 'python tools/visits_to_excel.py (dapat dijalankan ulang).'),
    ]
    for a, b in rows:
        ca = WriteOnlyCell(ws, value=a)
        ca.font = Font(name=FONT, bold=bool(a), size=16 if a == rows[0][0] else 11, color='FFFFFF' if a in GROUPS else '13201C')
        if a in GROUPS:
            ca.fill = fill(GROUPS[a])
        cb = WriteOnlyCell(ws, value=b)
        cb.font = Font(name=FONT, size=11)
        cb.alignment = Alignment(wrap_text=True, vertical='top')
        ws.append([ca, cb])

    # ---------------- Data Kunjungan ----------------
    ws = wb.create_sheet(DATA)
    ws.freeze_panes = 'C2'
    widths = {'text': 16, 'int': 9, 'float': 10, 'time': 17}
    for c, (_, _, _, _, _, kind) in DICT.items():
        ws.column_dimensions[L[c]].width = {'CC': 28, 'Dx_name': 40, 'DC_dispo': 26, 'Triage_acuity': 16, 'Admit_service': 24}.get(c, widths[kind])
    for name in D:
        ws.column_dimensions[D[name]].width = 13
    ws.auto_filter.ref = f'A1:{get_column_letter(len(COLS) + len(DERIVED))}{last}'
    heads = [header(ws, c, g, f'{nm}\n\nArti: {arti}\nSatuan/nilai: {sat}\n\nKaitan dengan sistem pakar: {kait}')
             for c, (nm, g, arti, sat, kait, _) in DICT.items()]
    heads += [header(ws, EN[nm], 'Turunan (rumus)', f'{nm} (kolom turunan, rumus Excel: lihat isi sel)\n\nArti: {arti}\n\nKaitan dengan sistem pakar: {kait}')
              for nm, _, arti, kait, _ in DERIVED]
    ws.append(heads)
    fmt = {'float': '0.0#', 'int': '0', 'time': 'yyyy-mm-dd hh:mm'}
    body = Font(name=FONT, size=10)
    kinds = [DICT[c][5] for c in COLS]
    for i, rec in enumerate(df[COLS].itertuples(index=False, name=None), start=2):
        out = []
        for v, kind in zip(rec, kinds):
            cell = WriteOnlyCell(ws, value=convert(v, kind))
            cell.font = body
            if kind in fmt:
                cell.number_format = fmt[kind]
            out.append(cell)
        for _, f, _, _, nf in DERIVED:
            cell = WriteOnlyCell(ws, value=f.format(r=i))
            cell.font = body
            cell.number_format = nf if nf != '@' else 'General'
            out.append(cell)
        ws.append(out)

    # ---------------- Kamus Data ----------------
    ws = wb.create_sheet('Kamus Data')
    ws.freeze_panes = 'A2'
    cols = [('No', 5), ('Kolom asli', 22), ('Nama Indonesia', 26), ('Kelompok', 20), ('Arti', 60), ('Satuan / nilai', 20),
            ('Kaitan dengan sistem pakar', 70), ('Sel kosong', 11), ('% kosong', 10)]
    for k, (_, w) in enumerate(cols, start=1):
        ws.column_dimensions[get_column_letter(k)].width = w
    hc = []
    for t, _ in cols:
        c = WriteOnlyCell(ws, value=t)
        c.font = Font(name=FONT, bold=True, color='FFFFFF')
        c.fill = fill('0F6B5C')
        hc.append(c)
    ws.append(hc)
    entries = [(c, *DICT[c][:5], L[c]) for c in COLS] + [(EN[nm], nm, 'Turunan (rumus)', arti, '', kait, D[nm]) for nm, _, arti, kait, _ in DERIVED]
    for k, (orig, nm, g, arti, sat, kait, col) in enumerate(entries, start=1):
        r = k + 1
        vals = [k, orig, nm, g, arti, sat, kait,
                f"=COUNTBLANK('{DATA}'!{col}2:{col}{last})", f'=H{r}/{n}']
        row = []
        for j, v in enumerate(vals):
            c = WriteOnlyCell(ws, value=v)
            c.font = Font(name=FONT, size=10, bold=(j == 2), color='FFFFFF' if j == 3 else '13201C')
            if j == 3:
                c.fill = fill(GROUPS[g])
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = Border(bottom=thin)
            c.number_format = '0.0%' if j == 8 else '#,##0' if j == 7 else 'General'
            row.append(c)
        ws.append(row)

    # ---------------- Ringkasan ESI ----------------
    ws = wb.create_sheet('Ringkasan ESI')
    for k, w in enumerate([30, 14, 16, 16, 18, 18, 14, 14], start=1):
        ws.column_dimensions[get_column_letter(k)].width = w
    esi, adm, crit, dz = (f"'{DATA}'!${D[x]}$2:${D[x]}${last}" for x in ['ESI (angka)', 'Dirawat (inap/ICU)', 'Luaran kritis', 'Danger zone (D01)'])
    wait = f"'{DATA}'!${D['Waktu tunggu (menit)']}$2:${D['Waktu tunggu (menit)']}${last}"
    title = WriteOnlyCell(ws, value='Ringkasan per level ESI (dihitung dengan rumus dari sheet Data Kunjungan)')
    title.font = Font(name=FONT, bold=True, size=13)
    ws.append([title])
    note = WriteOnlyCell(ws, value='Kolom E-F adalah angka di kb/evidence.ttl (hasil kb/build_evidence.py). Kolom G-H selisihnya; nilai 0,0% berarti Excel dan evidence.ttl sepakat.')
    note.font = Font(name=FONT, italic=True, size=10, color='56655F')
    ws.append([note])
    heads = ['Kelompok', 'Kunjungan', 'Dirawat (inap/ICU)', 'Luaran kritis', 'evidence.ttl: dirawat', 'evidence.ttl: kritis', 'Selisih dirawat', 'Selisih kritis', 'Median tunggu (menit)']
    hc = []
    for t in heads:
        c = WriteOnlyCell(ws, value=t)
        c.font = Font(name=FONT, bold=True, color='FFFFFF')
        c.fill = fill('0F6B5C')
        c.alignment = Alignment(wrap_text=True)
        hc.append(c)
    ws.append(hc)
    EV = {1: (0.8537, 0.5807), 2: (0.4911, 0.0705), 3: (0.2232, 0.0084), 4: (0.0209, 0.0012), 5: (0.0132, 0.0)}
    EVDZ = {'Ya': (0.2983, 0.0134), 'Tidak': (0.1721, 0.0060)}
    lines = [(f'ESI {k}', f'{esi},{k}', EV[k], f'{esi},{k}') for k in range(1, 6)]
    lines += [(f'ESI 3-5, danger zone = {y}', f'{esi},">=3",{dz},"{y}"', EVDZ[y], None) for y in ['Ya', 'Tidak']]
    for k, (label, crit_, ev, wcrit) in enumerate(lines, start=4):
        vals = [label, f'=COUNTIFS({crit_})', f'=COUNTIFS({crit_},{adm},"Ya")/B{k}', f'=COUNTIFS({crit_},{crit},"Ya")/B{k}',
                ev[0], ev[1], f'=C{k}-E{k}', f'=D{k}-F{k}',
                (f'=_xlfn.AGGREGATE(17,6,{wait}/({esi}={wcrit.split(",")[1]}),2)' if wcrit else '')]  # kuartil 2 = median, abaikan error
        row = []
        for j, v in enumerate(vals):
            c = WriteOnlyCell(ws, value=v)
            c.font = Font(name=FONT, size=10, color='0000FF' if j in (4, 5) else '000000')
            c.number_format = '#,##0' if j == 1 else '0' if j == 8 else '0.0%' if j else 'General'
            if j in (4, 5):
                c.comment = Comment('Angka tetap dari kb/evidence.ttl (sumber: MC-MED, dihitung kb/build_evidence.py).', 'Kamus data')
            row.append(c)
        ws.append(row)
    foot = WriteOnlyCell(ws, value='Danger zone memakai ambang dewasa aturan D01 (nadi > 100, napas > 20, SpO2 < 92). Pasien danger zone lebih sering dirawat: dasar empiris aturan E01 (naikkan ke ESI 2).')
    foot.font = Font(name=FONT, italic=True, size=10, color='56655F')
    ws.append([])
    ws.append([foot])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print('ditulis:', OUT, n, 'baris')


def recalc():
    """Hitung ulang rumus dengan Microsoft Excel (COM), lalu simpan nilainya."""
    ps = f"""
$x = New-Object -ComObject Excel.Application
$x.Visible = $false; $x.DisplayAlerts = $false
$b = $x.Workbooks.Open('{OUT}')
$x.CalculateFull()
$b.Worksheets.Item('Baca Saya').Activate()
$b.Save(); $b.Close($false); $x.Quit()
"""
    r = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)
    print('dihitung ulang dengan Excel')


if __name__ == '__main__':
    build()
    recalc()
