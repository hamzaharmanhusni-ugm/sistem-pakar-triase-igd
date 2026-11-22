"""Pengenalan fakta dari teks bebas tanpa LLM: kosakata diambil dari knowledge graph (skos:prefLabel/altLabel).
Dipakai sebagai mode lokal dan cadangan bila Claude API tidak tersedia."""
import re

from . import engine

NEG = re.compile(r'(tidak|tdk|tanpa|bukan|menyangkal|belum ada)\s+(\w+\s+){0,1}$')
NONE = re.compile(r'^\s*(-|tidak ada|tdk ada|tidak|nihil|none|belum|belum diukur|tidak tahu|tidak diketahui|normal semua)\b')
NO_RES = re.compile(r'tidak ada|tidak perlu|tidak butuh|cukup (obat|diperiksa)|obat oral saja|tanpa pemeriksaan')
NUM = r'(\d{1,3}(?:\.\d+)?)'
VITALS = {
    'hr': rf'(?:\bhr|nadi|denyut(?: jantung)?|heart rate|\bfrekuensi nadi)\s*(?:[:=]|adalah|sekitar)?\s*{NUM}',
    'rr': rf'(?:\brr|napas|nafas|respirasi|\brespiratory rate)\s*(?:[:=]|adalah|sekitar)?\s*{NUM}',
    'spo2': rf'(?:spo2|sp02|saturasi(?: oksigen)?|\bsat)\s*(?:[:=]|adalah|sekitar)?\s*{NUM}',
    'sbp': rf'(?:\btd|tekanan darah|tensi|\bbp|\bsbp)\s*(?:[:=]|adalah|sekitar)?\s*{NUM}',
    'temp': rf'(?:suhu|temperatur|\btemp)\s*(?:[:=]|adalah|sekitar)?\s*{NUM}',
}
RANGE = {'hr': (20, 300), 'rr': (4, 100), 'spo2': (40, 100), 'sbp': (40, 300), 'temp': (30, 45)}


def _norm(text):
    t = text.lower().replace('°', ' ')
    return re.sub(r'(\d),(\d)', r'\1.\2', t)


def _terms(cls):
    pairs = [(term, k) for k, v in engine.lexicon(cls).items() for term in v['terms']]
    return sorted(pairs, key=lambda p: -len(p[0]))  # frasa terpanjang dicocokkan dulu


def _match(text, cls):
    found, taken = [], []
    for term, key in _terms(cls):
        for m in re.finditer(r'(?<!\w)' + re.escape(term) + r'(?!\w)', text):
            if any(a <= m.start() < b for a, b in taken):
                continue
            if not term.startswith('tidak') and NEG.search(text[max(0, m.start() - 25):m.start()]):
                continue
            taken.append((m.start(), m.end()))
            if key not in found:
                found.append(key)
    return found


def extract(message, slot=None):
    """Kembalikan dict fakta parsial + 'none' (pengguna menjawab tidak ada / belum)."""
    t = _norm(message)
    f = {}
    # usia hanya dibaca saat ditanya atau bila disebut eksplisit, agar "demam sejak 2 hari" tidak terbaca sebagai usia
    m = re.search(r'(\d+(?:\.\d+)?)\s*(tahun|thn|th\b|bulan|bln|minggu|mgg|hari)', t)
    if m and not (slot == 'age' or re.search(r'usia|umur|berusia', t)):
        m = None
    if m:
        n, unit = float(m.group(1)), m.group(2)
        if unit.startswith(('tah', 'th')):
            f['age_years'] = n
        else:
            f['age_months'] = round(n if unit.startswith('b') else n / 4.345 if unit.startswith('m') else n / 30.4, 2)
    elif slot == 'age' and re.fullmatch(r'\s*\d{1,3}\s*', t):
        f['age_years'] = float(t)

    for k, rx in VITALS.items():
        m = re.search(rx, t)
        if m and RANGE[k][0] <= float(m.group(1)) <= RANGE[k][1]:
            f[k] = float(m.group(1))
    m = re.search(r'(\d{2}(?:\.\d)?)\s*c\b', t)
    if 'temp' not in f and m and 30 <= float(m.group(1)) <= 45:
        f['temp'] = float(m.group(1))

    m = re.search(r'(\d{1,2})\s*/\s*10\b', t) or re.search(r'skala(?: nyeri)?\s*[:=]?\s*(\d{1,2})', t)
    if m and int(m.group(1)) <= 10:
        f['pain'] = int(m.group(1))
    elif slot == 'pain' and re.fullmatch(r'\s*\d{1,2}\s*', t) and int(t) <= 10:
        f['pain'] = int(t)

    if slot == 'avpu' and re.fullmatch(r'\s*[avpu]\s*\.?\s*', t):
        f['avpu'] = t.strip(' .').upper()
    elif re.search(r'sadar penuh|compos ?mentis|\balert\b|gcs 15', t):
        f['avpu'] = 'A'
    elif re.search(r'respons?\w* (terhadap |pada |dengan )?suara|\bverbal\b', t):
        f['avpu'] = 'V'
    elif re.search(r'respons?\w* (terhadap |pada |dengan )?(nyeri|rangsang)', t):
        f['avpu'] = 'P'
    elif re.search(r'tidak (merespons?|respons?|sadar)', t):
        f['avpu'] = 'U'

    findings = _match(t, 'Finding')
    if findings:
        f['findings'] = findings
    resources = _match(t, 'Resource')
    if resources:
        f['resources'] = resources
        f['resources_assessed'] = True
    elif slot == 'resources' and NO_RES.search(t):
        f['resources_assessed'] = True

    f['none'] = bool(NONE.search(t))
    return f
