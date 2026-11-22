"""Manajer dialog chatbot. Urutan pertanyaan, aturan yang membutuhkan setiap pertanyaan, dan kapan pertanyaan
dilewati semuanya dibaca dari knowledge graph (individu ex:Question). Kesimpulan selalu dari engine.infer()."""
import uuid

from . import engine, llm, nlu

SCALARS = ['age_years', 'age_months', 'avpu', 'hr', 'rr', 'spo2', 'sbp', 'temp', 'pain']
VITAL_KEYS = ['hr', 'rr', 'spo2', 'sbp', 'temp']
LABEL = {'age_years': 'usia (tahun)', 'age_months': 'usia (bulan)', 'avpu': 'AVPU', 'hr': 'HR', 'rr': 'RR',
         'spo2': 'SpO2', 'sbp': 'TD sistolik', 'temp': 'suhu', 'pain': 'nyeri'}


class Session:
    def __init__(self):
        self.id = uuid.uuid4().hex[:12]
        self.facts = {'findings': [], 'resources': []}
        self.answered = set()   # slot yang dijawab "tidak ada" / "belum diukur"
        self.result = engine.infer(self.facts, self.case)
        self.done = False

    @property
    def case(self):
        return f'Kasus_{self.id}'

    def filled(self, slot):
        f = self.facts
        return slot in self.answered or {
            'age': 'age_years' in f or 'age_months' in f,
            'findings': bool(f['findings']),
            'avpu': 'avpu' in f,
            'vitals': any(k in f for k in VITAL_KEYS),
            'pain': 'pain' in f,
            'resources': bool(f.get('resources_assessed')),
        }[slot]

    def next_question(self):
        top = min(self.result['candidates'], default=9)
        for q in engine.questions():
            if self.filled(q['slot']):
                continue
            if q['skip_if_at_most'] is not None and top <= q['skip_if_at_most']:
                continue
            return q
        return None

    def merge(self, new):
        added = []
        if new.get('age_years') is not None or new.get('age_months') is not None:
            self.facts.pop('age_years', None)
            self.facts.pop('age_months', None)  # satu satuan usia saja agar tidak saling menimpa di aturan
        for k in SCALARS:
            if new.get(k) is not None and self.facts.get(k) != new[k]:
                self.facts[k] = new[k]
                added.append(f'{LABEL[k]} {new[k]:g}' if isinstance(new[k], (int, float)) else f'{LABEL[k]} {new[k]}')
        lex = {'findings': engine.lexicon('Finding'), 'resources': engine.lexicon('Resource')}
        for k in ['findings', 'resources']:
            for x in new.get(k, []):
                if x not in self.facts[k]:
                    self.facts[k].append(x)
                    added.append(lex[k][x]['label'])
        if new.get('resources_assessed') and not self.facts.get('resources_assessed'):
            self.facts['resources_assessed'] = True
            if not new.get('resources'):
                added.append('tanpa resource')
        return added

    def handle(self, message):
        q = self.next_question()
        slot = q['slot'] if q else None
        new = llm.extract(message, q['text'] if q else '')
        source = 'claude'
        if new is None:
            new, source = nlu.extract(message, slot), 'lokal'
        added = self.merge(new)
        if slot and not self.filled(slot) and new.get('none'):
            self.answered.add(slot)
            if slot == 'resources':
                self.facts['resources_assessed'] = True
        before = self.result['candidates']
        self.result = engine.infer(self.facts, self.case)
        nxt = self.next_question()
        self.done = nxt is None
        return self.reply(added, source, nxt, slot, before)

    def reply(self, added, source, nxt, asked_slot, before):
        parts = []
        if added:
            parts.append('Dicatat: ' + '; '.join(added) + '.')
        elif asked_slot and nxt and nxt['slot'] == asked_slot:
            parts.append('Maaf, jawaban itu belum dapat saya kenali.')
        r = self.result
        if r['candidates'] and r['candidates'] != before and not self.done:
            fired = [t for t in r['trace'] if t['rule'] != 'Z01']
            parts.append(f'Sementara: kandidat paling akut ESI {min(r["candidates"])} (aturan {", ".join(sorted({t["rule"] for t in fired}))}).')
        narrative = None
        if self.done:
            narrative = llm.narrate(r) or template_narrative(r)
            parts.append(f'Rekomendasi sistem: **{r["esi_label"]}**.' if r['esi'] else 'Belum ada aturan yang terpicu.')
            parts.append(narrative)
            for a in r['alerts']:
                parts.append('Peringatan: ' + a)
            parts.append('Keputusan akhir tetap pada perawat triase. Ketik "ulang" untuk kasus baru.')
        else:
            parts.append(nxt['text'])
        return self.payload(' '.join(parts), source, nxt, narrative)

    def payload(self, text, source='lokal', nxt=None, narrative=None):
        why = None
        if nxt:
            cat = {r['id']: r for r in engine.rules_catalog()}
            why = [{'rule': i, 'if': cat[i]['if'], 'decision_point': cat[i]['decision_point']} for i in nxt['needed_by']]
        return {'session_id': self.id, 'reply': text, 'done': self.done, 'nlu': source, 'llm': llm.status(),
                'question': {'slot': nxt['slot'], 'text': nxt['text'], 'why': why} if nxt else None,
                'facts': self.facts_view(), 'result': self.result, 'narrative': narrative}

    def facts_view(self):
        f = self.facts
        lexf, lexr = engine.lexicon('Finding'), engine.lexicon('Resource')
        out = {LABEL[k]: f[k] for k in SCALARS if k in f}
        out['temuan'] = [lexf[x]['label'] for x in f['findings']]
        out['resource'] = [lexr[x]['label'] for x in f['resources']] if f.get('resources_assessed') else None
        return out


def template_narrative(r):
    """Penjelasan tanpa LLM: rangkai alasan aturan yang menurunkan level akhir."""
    if not r['esi']:
        return ''
    z = next(t for t in r['trace'] if t['rule'] == 'Z01')
    chain = [t for t in r['trace'] if t['rule'] in z['depends_on']]
    reasons = '; '.join(f'{t["reason"]} [{t["rule"]}]' for t in chain)
    text = f'Level ini diturunkan dari: {reasons}.'
    if r['evidence']:
        e = r['evidence']
        pct = lambda x: f'{x * 100:.1f}'.replace('.', ',')
        visits = f'{e["visits"]:,}'.replace(',', '.')
        text += (f' Sebagai pembanding, pada {visits} kunjungan MC-MED dengan level yang sama, '
                 f'{pct(e["admit_rate"])}% dirawat inap/ICU dan {pct(e["critical_rate"])}% mengalami luaran kritis.')
    return text


GREETING = ('Halo, saya asisten triase berbasis sistem pakar ESI versi 4. Saya akan menanyakan data pasien secara bertahap, '
            'lalu menjelaskan aturan yang menghasilkan rekomendasi level ESI. ')
