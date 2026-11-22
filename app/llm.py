"""Integrasi Claude API di tepi sistem pakar.
1. extract(): ubah teks bebas menjadi fakta terstruktur (structured outputs, ID dibatasi katalog knowledge graph).
2. narrate(): rangkai jejak penalaran menjadi paragraf. Claude TIDAK menentukan level ESI.
Bila kredensial tidak ada atau panggilan gagal, aplikasi kembali ke mode lokal (app/nlu.py dan templat)."""
import json
import logging
import os
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel

from . import engine

log = logging.getLogger('llm')
MODEL = os.getenv('CLAUDE_MODEL', 'claude-opus-5-5')
_state = {'client': None, 'disabled': os.getenv('LLM_ENABLED', '1') == '0', 'reason': 'dimatikan (LLM_ENABLED=0)'}


class Extraction(BaseModel):
    age_years: Optional[float] = None
    age_months: Optional[float] = None
    findings: list[str] = []
    avpu: Optional[Literal['A', 'V', 'P', 'U']] = None
    hr: Optional[float] = None
    rr: Optional[float] = None
    spo2: Optional[float] = None
    sbp: Optional[float] = None
    temp: Optional[float] = None
    pain: Optional[int] = None
    resources: list[str] = []
    no_resources: bool = False
    none: bool = False


def _client():
    if _state['disabled']:
        return None
    if _state['client'] is None:
        try:
            import anthropic
            if not any(os.getenv(k) for k in ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_PROFILE']) \
                    and not (Path.home() / '.config' / 'anthropic').exists():
                raise RuntimeError('kredensial tidak ditemukan (set ANTHROPIC_API_KEY atau jalankan ant auth login)')
            _state['client'] = anthropic.Anthropic()
        except Exception as e:  # SDK tidak terpasang atau kredensial tidak ditemukan
            _disable(e)
    return _state['client']


def _disable(e):
    _state.update(disabled=True, client=None, reason=f'{type(e).__name__}: {e}'[:200])
    log.warning('Claude API dinonaktifkan, beralih ke mode lokal: %s', _state['reason'])


def status():
    _client()
    return {'enabled': not _state['disabled'], 'model': MODEL, 'reason': None if not _state['disabled'] else _state['reason']}


def _catalog():
    lines = ['TEMUAN (findings):']
    for k, v in sorted(engine.lexicon('Finding').items()):
        lines.append(f'- {k}: {v["label"]} | sinonim: {", ".join(sorted(v["terms"]))}')
    lines.append('\nRESOURCE (resources):')
    for k, v in sorted(engine.lexicon('Resource').items()):
        lines.append(f'- {k}: {v["label"]} | sinonim: {", ".join(sorted(v["terms"]))}')
    return '\n'.join(lines)


SYSTEM_EXTRACT = '''Anda adalah modul ekstraksi fakta untuk chatbot sistem pakar triase IGD (Emergency Severity Index v4).
Tugas Anda HANYA mengubah jawaban perawat menjadi fakta terstruktur. Anda tidak menilai level ESI.

Aturan:
- Isi hanya fakta yang disebut eksplisit. Field yang tidak disebut biarkan null atau daftar kosong.
- findings dan resources hanya boleh berisi ID dari katalog di bawah. Jangan membuat ID baru.
- Temuan yang disangkal ("tidak sesak", "tanpa demam") JANGAN dimasukkan.
- Usia bayi dalam bulan isi age_months (hari dibagi 30,4; minggu dibagi 4,345); usia lain isi age_years.
- hr = denyut nadi, rr = laju napas, spo2 = saturasi oksigen (%), sbp = tekanan darah sistolik, temp = suhu Celsius.
- avpu: A sadar penuh, V merespons suara, P hanya merespons nyeri, U tidak merespons.
- pain = skala nyeri 0-10.
- no_resources = true bila perawat menyatakan tidak perlu pemeriksaan/tindakan yang dihitung sebagai resource.
- none = true bila jawaban berarti "tidak ada", "belum diukur", atau "tidak tahu" untuk pertanyaan yang diajukan.

''' + '{catalog}'


def extract(message, question_text):
    c = _client()
    if c is None:
        return None
    try:
        r = c.messages.parse(
            model=MODEL, max_tokens=4000,
            system=[{'type': 'text', 'text': SYSTEM_EXTRACT.format(catalog=_catalog()), 'cache_control': {'type': 'ephemeral'}}],
            messages=[{'role': 'user', 'content': f'Pertanyaan yang sedang diajukan: {question_text}\nJawaban perawat: {message}'}],
            output_format=Extraction,
        )
    except Exception as e:
        _handle(e)
        return None
    if r.stop_reason == 'refusal' or r.parsed_output is None:
        return None
    x = r.parsed_output
    valid_f, valid_r = engine.lexicon('Finding'), engine.lexicon('Resource')
    f = {k: getattr(x, k) for k in ['age_years', 'age_months', 'avpu', 'hr', 'rr', 'spo2', 'sbp', 'temp', 'pain'] if getattr(x, k) is not None}
    if x.findings:
        f['findings'] = [i for i in x.findings if i in valid_f]
    if x.resources:
        f['resources'] = [i for i in x.resources if i in valid_r]
    if f.get('resources') or x.no_resources:
        f['resources_assessed'] = True
    f['none'] = x.none
    return f


SYSTEM_NARRATE = '''Anda menulis penjelasan singkat untuk perawat triase, dalam bahasa Indonesia baku.
Bahan Anda adalah hasil sistem pakar (JSON): level ESI, jejak aturan yang terpicu beserta alasannya, peringatan, dan statistik MC-MED.
Aturan:
- Jangan mengubah level ESI dan jangan menambah fakta, diagnosis, atau saran yang tidak ada di JSON.
- Sebutkan ID aturan (mis. B01) saat menjelaskan alasan.
- Maksimal 4 kalimat, tanpa daftar berbutir, tanpa salam pembuka.'''


def narrate(result):
    c = _client()
    if c is None:
        return None
    payload = {k: result[k] for k in ['esi_label', 'trace', 'alerts', 'evidence']}
    try:
        r = c.messages.create(
            model=MODEL, max_tokens=2000, output_config={'effort': 'low'},
            system=SYSTEM_NARRATE,
            messages=[{'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}],
        )
    except Exception as e:
        _handle(e)
        return None
    if r.stop_reason == 'refusal':
        return None
    text = ''.join(b.text for b in r.content if b.type == 'text').strip()
    return text or None


def _handle(e):
    import anthropic
    if isinstance(e, (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.NotFoundError, TypeError)):
        _disable(e)  # tidak akan berhasil bila diulang
    else:
        log.warning('Panggilan Claude gagal, giliran ini memakai mode lokal: %s', e)
