"""Alur chatbot dalam mode lokal (tanpa Claude API)."""
import os

os.environ['LLM_ENABLED'] = '0'
os.environ['KG_BACKEND'] = 'rdflib'

from app import dialog, nlu


def chat(*msgs):
    s = dialog.Session()
    r = None
    for m in msgs:
        r = s.handle(m)
    return s, r


def test_nlu_vitals_and_negation():
    f = nlu.extract('nadi 128, napas 18, SpO2 97%, td 150/90, suhu 37,8', 'vitals')
    assert (f['hr'], f['rr'], f['spo2'], f['sbp'], f['temp']) == (128, 18, 97, 150, 37.8)
    f = nlu.extract('keseleo, tidak sesak', 'findings')
    assert f['findings'] == ['Sprain']


def test_duration_not_read_as_age():
    f = nlu.extract('demam sejak 2 hari', 'findings')
    assert 'age_months' not in f and 'Fever' in f['findings']


def test_chest_pain_stops_at_decision_point_b():
    s, r = chat('45 tahun', 'nyeri dada menjalar ke lengan kiri', 'A', 'nadi 128 napas 18 spo2 97 td 150/90')
    assert r['done'] and s.result['esi'] == 2
    assert not s.facts.get('resources_assessed')  # pertanyaan resource dilewati (algoritma berhenti di B)
    assert 'B01' in r['reply']


def test_minor_injury_full_algorithm():
    s, r = chat('25 tahun', 'keseleo pergelangan kaki', 'A', 'nadi 84 rr 16 spo2 99 td 120/80', '4', 'rontgen')
    assert r['done'] and s.result['esi'] == 4


def test_no_resources_gives_esi5():
    s, r = chat('30 tahun', 'gatal', 'A', 'nadi 80 rr 16 spo2 99', '0', 'tidak ada')
    assert r['done'] and s.result['esi'] == 5


def test_why_question_lists_rules():
    s = dialog.Session()
    r = s.handle('45 tahun')
    assert r['question']['slot'] == 'findings'
    assert {w['rule'] for w in r['question']['why']} == {'A01', 'B01', 'B02'}


def test_unrecognized_answer_reasks():
    s = dialog.Session()
    r = s.handle('hmm')
    assert r['question']['slot'] == 'age' and 'belum dapat saya kenali' in r['reply']
