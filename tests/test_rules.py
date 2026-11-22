"""Kasus emas: setiap aturan minimal satu kasus, termasuk kasus batas ambang."""
import os

os.environ['LLM_ENABLED'] = '0'
os.environ['KG_BACKEND'] = 'rdflib'  # deterministik tanpa server; paritas GraphDB diuji terpisah

import pytest
from pyshacl import validate
from rdflib import Graph

from app import engine

R3 = ['Res_Lab', 'Res_ECG_Xray', 'Res_IVFluid']
CASES = [
    # (nama, fakta, ESI harapan, aturan yang wajib terpicu)
    ('A01 apnea', dict(age_years=70, findings=['Apnea']), 1, {'A01'}),
    ('A02 SpO2 89', dict(age_years=50, spo2=89), 1, {'A02', 'D01'}),
    ('A03 AVPU P', dict(age_years=30, avpu='P'), 1, {'A03'}),
    ('B01 nyeri dada', dict(age_years=45, findings=['ChestPainACS']), 2, {'B01'}),
    ('B02 bingung baru', dict(age_years=80, findings=['NewConfusion']), 2, {'B02'}),
    ('B02 AVPU V', dict(age_years=40, avpu='V'), 2, {'B02'}),
    ('B03 nyeri 7', dict(age_years=30, pain=7), 2, {'B03'}),
    ('B03 batas nyeri 6', dict(age_years=30, pain=6, resources_assessed=True), 5, set()),
    ('B04 neonatus demam', dict(age_months=0.5, temp=38.3), 2, {'B04'}),
    ('B05 bayi 2 bulan demam', dict(age_months=2, temp=38.5), 2, {'B05'}),
    ('C01 dua resource', dict(age_years=30, resources=['Res_Lab', 'Res_ECG_Xray'], resources_assessed=True), 3, {'C01'}),
    ('C01 satu resource', dict(age_years=30, resources=['Res_ECG_Xray'], resources_assessed=True), 4, {'C01'}),
    ('C01 nol resource', dict(age_years=30, resources_assessed=True), 5, {'C01'}),
    ('C01 prosedur kompleks bobot 2', dict(age_years=30, resources=['Res_ComplexProc'], resources_assessed=True), 3, {'C01'}),
    ('C02 anak demam 39.5', dict(age_months=18, temp=39.5, resources_assessed=True), 3, {'C02'}),
    ('C02 imunisasi tidak lengkap', dict(age_months=18, findings=['Fever', 'IncompleteImmunization'], resources_assessed=True), 3, {'C02'}),
    ('D01+E01 dewasa HR 128', dict(age_years=40, hr=128, resources=R3, resources_assessed=True), 2, {'C01', 'D01', 'E01'}),
    ('D01 batas HR 100 tidak picu', dict(age_years=40, hr=100, resources=R3, resources_assessed=True), 3, {'C01'}),
    ('D01 anak 2 th HR 150 bukan danger zone', dict(age_months=24, hr=150, resources=R3, resources_assessed=True), 3, {'C01'}),
    ('D01 anak 2 th HR 170 danger zone', dict(age_months=24, hr=170, resources=R3, resources_assessed=True), 2, {'D01', 'E01'}),
    ('D01 batas usia 36 bulan masuk 3-8 th', dict(age_months=36, hr=150, resources=R3, resources_assessed=True), 2, {'D01'}),
    ('F01 qSOFA 2', dict(age_years=60, rr=24, sbp=95, avpu='A', resources_assessed=True), 2, {'F01'}),
    ('F01 tidak untuk anak', dict(age_years=10, rr=24, sbp=95, resources_assessed=True), 2, {'D01'}),
]


@pytest.mark.parametrize('name,facts,esi,must', CASES, ids=[c[0] for c in CASES])
def test_case(name, facts, esi, must):
    facts.setdefault('findings', [])
    facts.setdefault('resources', [])
    r = engine.infer(facts, 'Uji')
    fired = {t['rule'] for t in r['trace']}
    assert r['esi'] == esi, (r['esi'], fired)
    assert must <= fired, (must, fired)
    if 'D01' not in must and name.startswith('D01'):
        assert 'D01' not in fired


def test_f01_negative_for_child():
    r = engine.infer(dict(age_years=10, rr=24, sbp=95, findings=[], resources=[]), 'Uji')
    assert 'F01' not in {t['rule'] for t in r['trace']}


def test_shock_index_alert_does_not_change_esi():
    r = engine.infer(dict(age_years=30, hr=99, sbp=90, findings=[], resources=['Res_Lab'], resources_assessed=True), 'Uji')
    assert r['esi'] == 4 and r['alerts'] and 'G01' in {t['rule'] for t in r['trace']}


def test_explanation_chain_depends_on():
    r = engine.infer(dict(age_years=40, hr=128, findings=[], resources=R3, resources_assessed=True), 'Uji')
    z = next(t for t in r['trace'] if t['rule'] == 'Z01')
    assert {'C01', 'D01', 'E01'} <= set(z['depends_on'])
    assert r['evidence']['visits'] == 27880


def test_steps_record_forward_chaining():
    r = engine.infer(dict(age_years=40, hr=128, findings=[], resources=R3, resources_assessed=True), 'Uji')
    order = [s['rule'] for s in r['steps']]
    assert order[-1] == 'Z01' and order.index('D01') < order.index('E01')
    e01 = next(t for t in r['trace'] if t['rule'] == 'E01')
    assert e01['cycle'] == 2 and 'INSERT' in e01['sparql']
    assert (':Uji', ':candidateESI', ':ESI_2') in [tuple(x) for x in e01['added']]


def test_owl_transitive_acuity_order():
    from app.engine import EX
    assert (EX.ESI_1, EX.moreAcuteThan, EX.ESI_5) in engine.knowledge_base()


def test_agenda_read_from_graph():
    rules, final = engine.agenda()
    assert final[0] == 'Z01' and len(rules) == 15
    assert [r[1] for r in rules] == sorted(r[1] for r in rules)


def test_every_rule_has_source_and_question_coverage():
    cat = engine.rules_catalog()
    assert all(r['source'] for r in cat)
    asked = {rid for q in engine.questions() for rid in q['needed_by']}
    assert {'A01', 'A02', 'A03', 'B01', 'B02', 'B03', 'C01', 'D01'} <= asked


def test_shacl_case_graph_valid():
    kb = Graph()
    for f in ['triage-ontology.ttl', 'knowledge.ttl']:
        kb.parse(engine.KB / f)
    data = engine.case_graph('Uji', dict(age_years=45, hr=128, pain=8, findings=['ChestPainACS'], resources=['Res_Lab']))
    ok, _, report = validate(data, shacl_graph=Graph().parse(engine.KB / 'shapes.ttl'), ont_graph=kb, inference='rdfs')
    assert ok, report
    bad = engine.case_graph('Uji', dict(hr=400))
    ok, _, _ = validate(bad, shacl_graph=Graph().parse(engine.KB / 'shapes.ttl'), ont_graph=kb, inference='rdfs')
    assert not ok


@pytest.mark.skipif(not __import__('app.graphdb', fromlist=['x']).available(), reason='GraphDB triage-es tidak aktif')
@pytest.mark.parametrize('name,facts,esi,must', CASES[::3], ids=[c[0] for c in CASES[::3]])
def test_graphdb_parity(name, facts, esi, must):
    facts = dict(facts, findings=facts.get('findings', []), resources=facts.get('resources', []))
    a = engine.infer(dict(facts), 'Uji', using='rdflib')
    b = engine.infer(dict(facts), 'Uji', using='graphdb')
    assert (a['esi'], {t['rule'] for t in a['trace']}) == (b['esi'], {t['rule'] for t in b['trace']})
