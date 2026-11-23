"""Mesin inferensi sistem pakar triase: forward chaining aturan SPARQL di atas knowledge graph RDF/OWL.

Agenda aturan (urutan, prioritas, file SPARQL) dibaca dari graph (individu ex:Rule), bukan ditulis di kode.
Setiap aturan yang terpicu menulis node ex:Inference (PROV-O) sehingga kesimpulan dapat dijelaskan."""
from functools import lru_cache
from pathlib import Path
import os
import threading
import time

from owlrl import DeductiveClosure, OWLRL_Semantics
from rdflib import RDF, XSD, Graph, Literal, Namespace
from rdflib.plugins.sparql import prepareQuery, prepareUpdate

from . import graphdb

KB = Path(__file__).resolve().parent.parent / 'kb'
EX = Namespace('http://example.org/triage/')
SKOS = Namespace('http://www.w3.org/2004/02/skos/core#')
PREFIX = '''PREFIX ex: <http://example.org/triage/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dcterms: <http://purl.org/dc/terms/>
'''
FINAL_RULE = 'Z01'


@lru_cache(maxsize=1)
def knowledge_base():
    """Muat ontologi + pengetahuan + bukti, lalu hitung closure OWL 2 RL sekali saja."""
    g = Graph()
    for f in ['triage-ontology.ttl', 'knowledge.ttl', 'evidence.ttl']:
        g.parse(KB / f)
    DeductiveClosure(OWLRL_Semantics).expand(g)
    return g


@lru_cache(maxsize=1)
def agenda():
    """Daftar aturan terurut prioritas, diambil dari graph."""
    q = PREFIX + 'SELECT ?id ?prio ?file WHERE { ?r a ex:Rule ; ex:ruleId ?id ; ex:priority ?prio ; ex:sparqlFile ?file } ORDER BY ?prio ?id'
    # aturan di-parse sekali (parsing SPARQL rdflib ~100 ms per aturan, eksekusinya < 10 ms)
    rows = []
    for r in knowledge_base().query(q):
        text = (KB / str(r.file)).read_text(encoding='utf-8')
        rows.append((str(r.id), int(r.prio), prepareUpdate(text), text))
    return [r for r in rows if r[0] != FINAL_RULE], next(r for r in rows if r[0] == FINAL_RULE)


def case_graph(case, facts):
    """Ubah fakta (dict dari dialog) menjadi triple working memory."""
    g = Graph()
    c = EX[case]
    g.add((c, RDF.type, EX.TriageCase))
    num = {'age_years': EX.age, 'age_months': EX.ageMonths, 'hr': EX.heartRate, 'rr': EX.respRate,
           'spo2': EX.o2Sat, 'sbp': EX.sbp, 'temp': EX.temperatureC}
    for k, p in num.items():
        if facts.get(k) is not None:
            g.add((c, p, Literal(round(float(facts[k]), 2), datatype=XSD.decimal)))
    if facts.get('pain') is not None:
        g.add((c, EX.painScore, Literal(int(facts['pain']))))
    if facts.get('avpu'):
        g.add((c, EX.avpu, Literal(facts['avpu'])))
    for f in facts.get('findings', []):
        g.add((c, EX.presentsWith, EX[f]))
    for r in facts.get('resources', []):
        g.add((c, EX.needsResource, EX[r]))
    if facts.get('resources_assessed'):
        g.add((c, EX.resourcesAssessed, Literal(True)))
    if facts.get('self_report'):
        g.add((c, EX.reportedByLayperson, Literal(True)))
    for s in facts.get('pain_sites', []):
        g.add((c, EX.painSite, EX[s]))
    if facts.get('onset'):
        g.add((c, EX.onset, EX[facts['onset']]))
    if facts.get('onset_sudden') is not None:
        g.add((c, EX.onsetSudden, Literal(bool(facts['onset_sudden']))))
    # pasien terpisah dari kunjungan; IRI diawali IRI kasus agar ikut dibersihkan bersama working memory
    pt = EX[f'{case}_pasien']
    g.add((pt, RDF.type, EX.Patient))
    g.add((c, EX.ofPatient, pt))
    for k, p in [('conditions', EX.hasCondition), ('medications', EX.takesMedication)]:
        for x in facts.get(k, []):
            g.add((pt, p, EX[x]))
    for k, p in [('pregnancy', EX.pregnancyStatus), ('sex', EX.sex)]:
        if facts.get(k):
            g.add((pt, p, EX[facts[k]]))
    return g


def backend():
    """'graphdb' bila repository triage-es aktif (atau dipaksa KG_BACKEND), selain itu 'rdflib' in-memory."""
    want = os.getenv('KG_BACKEND', 'auto')
    if want == 'auto':
        return 'graphdb' if graphdb.available() else 'rdflib'
    return want


def _chain(run, snapshot, size, rules, final):
    """Siklus match-resolve-act sampai titik tetap. run() mengeksekusi aturan, size() menghitung triple kasus
    (murah), snapshot() mengambil triple kasus (hanya saat jumlahnya berubah)."""
    cycles, steps = 0, []
    snap = snapshot()
    while True:
        cycles += 1
        start = len(snap)
        for rid, _, prepared, text in rules:
            run(prepared, text)
            if size() != len(snap):
                now = snapshot()  # catat triple baru yang ditambahkan aturan ini pada siklus ini
                steps.append({'cycle': cycles, 'rule': rid, 'added': sorted(short(x) for x in now - snap)})
                snap = now
        if len(snap) == start:
            break
    run(final[2], final[3])
    now = snapshot()
    steps.append({'cycle': cycles + 1, 'rule': final[0], 'added': sorted(short(x) for x in now - snap)})
    return cycles, steps


def _chain_graphdb(q, c, rules, final):
    """Versi GraphDB: satu permintaan SPARQL Update per siklus (setiap update memicu commit + reasoner ~80 ms),
    lalu triple baru dikelompokkan per aturan lewat node ex:Inference-nya. Sisanya adalah hasil reasoner OWL 2 RL."""
    order = [r[0] for r in rules]
    snap, cycles, steps = set(graphdb.construct(q)), 0, []
    while True:
        cycles += 1
        graphdb.update(' ;\n'.join(r[3] for r in rules))
        now = set(graphdb.construct(q))
        if len(now) == len(snap):
            break
        steps += _attribute(now - snap, cycles, order, c)
        snap = now
    graphdb.update(final[3])
    now = set(graphdb.construct(q))
    steps += _attribute(now - snap, cycles + 1, [final[0]], c)
    return cycles, steps


def _attribute(new, cycle, order, c):
    concluded = {}
    for s, p, o in new:
        if p == EX.concluded and '_inf_' in str(s):
            concluded.setdefault(str(s).split('_inf_')[1][:3], set()).add(o)
    groups = {rid: [] for rid in order + ['OWL']}
    for t in new:
        s, p, o = t
        rid = str(s).split('_inf_')[1][:3] if '_inf_' in str(s) else None
        if rid is None and p in (EX.candidateESI, EX.recommendedESI, EX.hasAlert, RDF.type):
            rid = next((r for r in order if o in concluded.get(r, ())), None)
        groups[rid if rid in groups else 'OWL'].append(short(t))
    return [{'cycle': cycle, 'rule': rid, 'added': sorted(v)} for rid, v in groups.items() if v]


_gdb_lock = threading.Lock()  # ponytail: satu konsultasi per waktu di GraphDB; pakai named graph per sesi bila banyak pengguna


def infer(facts, case='Kasus', using=None):
    """Forward chaining sampai titik tetap, lalu resolusi konflik. Mengembalikan hasil + jejak penjelasan."""
    t0 = time.perf_counter()
    using = using or backend()
    wm_graph = case_graph(case, facts)
    wm = sorted(short(t) for t in wm_graph)
    rules, final = agenda()
    c = str(EX[case])
    mine = lambda t: str(t[0]).startswith(c)  # triple milik kasus ini (kasus + node inferensinya)
    stats = {}
    if using == 'graphdb':
        q = f'CONSTRUCT {{ ?s ?p ?o }} WHERE {{ ?s ?p ?o FILTER(STRSTARTS(STR(?s), "{c}")) }}'
        drop = f'DELETE {{ ?s ?p ?o }} WHERE {{ ?s ?p ?o FILTER(STRSTARTS(STR(?s), "{c}")) }}'
        with _gdb_lock:
            graphdb.update(drop)
            graphdb.add_graph(wm_graph)
            cycles, steps = _chain_graphdb(q, c, rules, final)
            fetched = graphdb.construct(q)
            explicit = int(graphdb.select(f'SELECT (COUNT(*) AS ?n) FROM <http://www.ontotext.com/explicit> '
                                          f'WHERE {{ ?s ?p ?o FILTER(STRSTARTS(STR(?s), "{c}")) }}')[0]['n'])
            graphdb.update(drop)
        stats = {'case_triples': len(fetched), 'case_explicit': explicit, 'case_inferred_by_reasoner': len(fetched) - explicit}
        g = Graph()
        g += knowledge_base()
        g += fetched
    else:
        g = Graph()
        g += knowledge_base()
        g += wm_graph
        cycles, steps = _chain(lambda p, text: g.update(p), lambda: {t for t in g if mine(t)},
                               lambda: sum(1 for t in g if mine(t)), rules, final)
        # ponytail: closure OWL penuh per kasus memakan ~5 detik di rdflib; dependsOn transitif dibaca dengan property path ex:dependsOn+
    out = summarize(g, EX[case])
    detail = {r[0]: r[3] for r in rules + [final]}
    cat = {r['id']: r for r in rules_catalog()}
    for t in out['trace']:
        t['if'], t['then'], t['lay'] = cat[t['rule']]['if'], cat[t['rule']]['then'], cat[t['rule']]['lay']
        t['sparql'] = '\n'.join(l for l in detail[t['rule']].splitlines() if not l.startswith('PREFIX'))
        fired = [s for s in steps if s['rule'] == t['rule']]
        t['cycle'] = fired[0]['cycle'] if fired else None
        t['added'] = [x for s in fired for x in s['added'] if x[0] in (t['inf'], short_node(EX[case]))]
    out.update(cycles=cycles, steps=steps, working_memory=wm, backend=using, backend_stats=stats,
               ms=round((time.perf_counter() - t0) * 1000), triples=len(g))
    return out


def short_node(n):
    s = str(n)
    for ns, pre in [(str(EX), ''), ('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:'),
                    ('http://www.w3.org/2000/01/rdf-schema#', 'rdfs:'), ('http://www.w3.org/ns/prov#', 'prov:'),
                    ('http://www.w3.org/2002/07/owl#', 'owl:'), ('http://www.w3.org/2004/02/skos/core#', 'skos:'),
                    ('http://www.w3.org/2001/XMLSchema#', 'xsd:')]:
        if s.startswith(ns):
            return pre + s[len(ns):] if pre else ':' + s[len(ns):]
    return s


def short(triple):
    """Triple dalam bentuk pendek untuk ditampilkan, mis. (':Kasus_x', ':candidateESI', ':ESI_2')."""
    s, p, o = triple
    o = f'"{o}"' if isinstance(o, Literal) else short_node(o)
    return (short_node(s), 'a' if p == RDF.type else short_node(p), o)


@lru_cache(maxsize=None)
def _prepared(s):
    return prepareQuery(PREFIX + s)


def summarize(g, c):
    def q(s, **b):
        return list(g.query(_prepared(s), initBindings=b))

    rec = q('SELECT ?n ?l ?lt ?la WHERE { ?c ex:recommendedESI ?e . ?e ex:levelNumber ?n ; rdfs:label ?l ; ex:layTitle ?lt ; ex:layAdvice ?la }', c=c)
    cands = sorted({int(r.n) for r in q('SELECT ?n WHERE { ?c ex:candidateESI/ex:levelNumber ?n }', c=c)})
    trace = []
    for r in q('''SELECT ?inf ?id ?prio ?dp ?reason ?cite ?concl WHERE {
            ?inf ex:aboutCase ?c ; ex:usedRule ?rule ; ex:reason ?reason ; ex:concluded ?k .
            ?rule ex:ruleId ?id ; ex:priority ?prio ; dcterms:bibliographicCitation ?cite .
            OPTIONAL { ?rule ex:atDecisionPoint/rdfs:label ?dp }
            OPTIONAL { ?k rdfs:label ?kl } OPTIONAL { ?k ex:alertText ?kt }
            BIND(COALESCE(?kl, ?kt, STRAFTER(STR(?k), "triage/")) AS ?concl)
            BIND(COALESCE(?dp, IF(?id = "Z01", "Z", "E")) AS ?ord)
        } ORDER BY ?ord ?id''', c=c):
        deps = [str(d.id) for d in q('SELECT DISTINCT ?id WHERE { ?i ex:dependsOn+ ?d . ?d ex:usedRule/ex:ruleId ?id } ORDER BY ?id', i=r.inf)]
        used = [str(u.l) for u in q('''SELECT ?l WHERE { ?i prov:used ?u . OPTIONAL { ?u skos:prefLabel ?pl }
            BIND(COALESCE(?pl, STRAFTER(STR(?u), "triage/")) AS ?l) }''', i=r.inf)]
        trace.append({'inf': short_node(r.inf), 'used': used,
                      'rule': str(r.id), 'decision_point': str(r.dp) if r.dp else None, 'reason': str(r.reason),
                      'conclusion': str(r.concl), 'source': str(r.cite), 'depends_on': deps})
    alerts = [str(r.t) for r in q('SELECT ?t WHERE { ?c ex:hasAlert/ex:alertText ?t }', c=c)]
    classes = [str(r.k).split('/')[-1] for r in q('SELECT ?k WHERE { ?c a ?k . FILTER(?k IN (ex:DangerZoneCase, ex:QSOFAPositiveCase)) }', c=c)]
    evidence = None
    if rec:
        e = q('SELECT ?v ?a ?k WHERE { ?s ex:aboutLevel ?e ; ex:visits ?v ; ex:admitRate ?a ; ex:criticalRate ?k . ?e ex:levelNumber ?n }', n=rec[0].n)
        if e:
            evidence = {'visits': int(e[0].v), 'admit_rate': float(e[0].a), 'critical_rate': float(e[0].k)}
    return {'esi': int(rec[0].n) if rec else None, 'esi_label': str(rec[0].l) if rec else None, 'candidates': cands,
            'lay_title': str(rec[0].lt) if rec else None, 'lay_advice': str(rec[0].la) if rec else None,
            'trace': trace, 'alerts': alerts, 'case_classes': classes, 'evidence': evidence}


@lru_cache(maxsize=None)
def rules_catalog():
    q = PREFIX + '''SELECT ?id ?prio ?if ?then ?cite ?lay (SAMPLE(?dpl) AS ?dp) WHERE {
        ?r a ex:Rule ; ex:ruleId ?id ; ex:priority ?prio ; ex:ifText ?if ; ex:thenText ?then ; dcterms:bibliographicCitation ?cite .
        OPTIONAL { ?r ex:layText ?lay } OPTIONAL { ?r ex:atDecisionPoint/rdfs:label ?dpl } } GROUP BY ?id ?prio ?if ?then ?cite ?lay ORDER BY ?prio ?id'''
    return [{'id': str(r.id), 'priority': int(r.prio), 'if': str(r['if']), 'then': str(r.then), 'lay': str(r.lay) if r.lay else None,
             'source': str(r.cite), 'decision_point': str(r.dp) if r.dp else None} for r in knowledge_base().query(q)]


@lru_cache(maxsize=None)
def questions():
    q = PREFIX + '''SELECT ?q ?order ?slot ?text ?skip (GROUP_CONCAT(?rid; separator=",") AS ?rules) WHERE {
        ?q a ex:Question ; ex:askOrder ?order ; ex:slot ?slot ; ex:questionText ?text ; ex:neededBy/ex:ruleId ?rid .
        OPTIONAL { ?q ex:skipIfAcuityAtMost ?skip } } GROUP BY ?q ?order ?slot ?text ?skip ORDER BY ?order'''
    return [{'slot': str(r.slot), 'text': str(r.text), 'skip_if_at_most': int(r.skip) if r.skip else None,
             'needed_by': sorted(str(r.rules).split(','))} for r in knowledge_base().query(q)]


VOCAB = {'conditions': 'Condition', 'medications': 'MedicationClass', 'pain_sites': 'BodyRegion', 'onset': 'OnsetCategory',
         'pregnancy': 'PregnancyStatus', 'sex': 'Sex', 'resources': 'Resource'}


@lru_cache(maxsize=None)
def vocab():
    """Pilihan jawaban yang dibaca antarmuka dari knowledge graph: {slot: [{id, label}]}, temuan per kelas."""
    q = PREFIX + 'SELECT ?x ?l WHERE { ?x a ?cls ; skos:prefLabel ?l . OPTIONAL { ?x ex:maxHours ?h } } ORDER BY ?h ?x'
    out = {slot: [{'id': str(r.x).split('/')[-1], 'label': str(r.l)} for r in knowledge_base().query(q, initBindings={'cls': EX[c]})]
           for slot, c in VOCAB.items()}
    out['findings'] = {c: [{'id': str(r.x).split('/')[-1], 'label': str(r.l)} for r in knowledge_base().query(q, initBindings={'cls': EX[c]})]
                       for c in ['LifeSavingIndicator', 'HighRiskSituation', 'AlteredMentalStatus', 'Symptom', 'RiskFactor']}
    return out


@lru_cache(maxsize=None)
def lexicon(cls):
    """Label + sinonim (skos) untuk semua individu kelas Finding atau Resource: dipakai NLU."""
    q = PREFIX + '''SELECT ?x ?pref ?lab WHERE { ?x a ?cls ; skos:prefLabel ?pref .
        { ?x skos:altLabel ?lab } UNION { ?x skos:prefLabel ?lab } }'''
    out = {}
    for r in knowledge_base().query(q, initBindings={'cls': EX[cls]}):
        out.setdefault(str(r.x).split('/')[-1], {'label': str(r.pref), 'terms': set()})['terms'].add(str(r.lab).lower())
    return out
