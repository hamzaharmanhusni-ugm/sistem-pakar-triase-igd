"""Jalankan sistem pakar versi ringkas (tanda vital dewasa) pada beberapa contoh kasus.
Pemakaian dari folder proyek:  .venv/Scripts/python kb-tanda-vital/jalankan.py
Mencetak: jumlah triple TBox/ABox, fakta baru dari reasoner, lalu hasil dan jejak setiap kasus.
Berdiri sendiri: tidak membaca folder kb/ milik versi lengkap."""
from pathlib import Path

from owlrl import DeductiveClosure, OWLRL_Semantics
from rdflib import RDF, Graph, Literal, Namespace, XSD

HERE = Path(__file__).resolve().parent
EX = Namespace('http://example.org/triage-vital/')
PRE = 'PREFIX ex: <http://example.org/triage-vital/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n'

CASES = [  # (nama, tanda vital, ESI harapan, aturan yang wajib terpicu)
    ('SpO2 88', dict(o2Sat=88, heartRate=96, respRate=24), 1, {'A02', 'D01', 'E01'}),
    ('Nadi 120', dict(heartRate=120, respRate=18, o2Sat=97, sbp=130), 2, {'D01', 'E01'}),
    ('qSOFA: napas 23, TD 96, kesadaran V', dict(respRate=23, sbp=96, avpu='V', heartRate=92), 2, {'F01', 'D01'}),
    ('Shock index 1,1', dict(heartRate=110, sbp=100, respRate=18, o2Sat=98), 2, {'G01', 'D01'}),
    ('Semua aman', dict(heartRate=80, respRate=16, o2Sat=98, sbp=120, avpu='A'), 3, set()),
    ('Batas: nadi tepat 100', dict(heartRate=100, respRate=20, o2Sat=92), 3, set()),
]


def knowledge():
    g = Graph()
    g.parse(HERE / 'ontologi.ttl')
    g.parse(HERE / 'pengetahuan.ttl')
    explicit = len(g)
    before = set(g)
    DeductiveClosure(OWLRL_Semantics).expand(g)
    acute = sorted((s.split('/')[-1], o.split('/')[-1]) for s, _, o in set(g) - before if _ == EX.moreAcuteThan)
    return g, explicit, acute


def rules(g):
    rows = g.query(PRE + 'SELECT ?id ?prio ?f WHERE { ?r a ex:Rule ; ex:ruleId ?id ; ex:priority ?prio ; ex:sparqlFile ?f } ORDER BY ?prio ?id')
    return [(str(r.id), int(r.prio), (HERE / str(r.f)).read_text(encoding='utf-8')) for r in rows]


def infer(kb, agenda, name, vitals):
    g = Graph()
    g += kb
    c = EX[name]
    g.add((c, RDF.type, EX.TriageCase))
    for p, v in vitals.items():
        g.add((c, EX[p], Literal(v) if p == 'avpu' else Literal(float(v), datatype=XSD.decimal)))
    normal, final = [r for r in agenda if r[1] < 9], [r for r in agenda if r[1] == 9]
    cycles = 0
    while True:  # forward chaining sampai titik tetap
        cycles += 1
        n = len(g)
        for _, _, text in normal:
            g.update(text)
        if len(g) == n:
            break
    for _, _, text in final:
        g.update(text)
    q = lambda s: list(g.query(PRE + s, initBindings={'c': c}))
    rec = q('SELECT ?l WHERE { ?c ex:recommendedESI ?e . ?e rdfs:label ?l ; ex:levelNumber ?n }')
    trace = q('SELECT ?id ?why WHERE { ?i ex:aboutCase ?c ; ex:usedRule/ex:ruleId ?id ; ex:reason ?why } ORDER BY ?id')
    level = q('SELECT ?n WHERE { ?c ex:recommendedESI/ex:levelNumber ?n }')
    return int(level[0].n), str(rec[0].l), [(str(t.id), str(t.why)) for t in trace], cycles


def main():
    kb, explicit, acute = knowledge()
    agenda = rules(kb)
    print(f'Triple ditulis tangan: {explicit} | setelah reasoner OWL 2 RL: {len(kb)}')
    print('Disimpulkan reasoner dari ex:moreAcuteThan (transitif):', ', '.join(f'{a} > {b}' for a, b in acute))
    print(f'Aturan dibaca dari graph: {", ".join(r[0] for r in agenda)}\n')
    for i, (name, vitals, esi, must) in enumerate(CASES, start=1):
        level, label, trace, cycles = infer(kb, agenda, f'Kasus_{i}', vitals)
        print(f'[{name}] {vitals}\n  -> {label}  ({cycles} siklus)')
        for rid, why in trace:
            print(f'     {rid}: {why}')
        fired = {rid for rid, _ in trace}
        assert level == esi and must <= fired, (name, level, fired)  # cek mandiri: hasil sesuai harapan
    print('\nSemua kasus sesuai harapan.')


if __name__ == '__main__':
    main()
