"""Pengaman SPARQL hanya-baca dan kamus query (tanpa Claude)."""
import pytest

from app import engine, sparql

FACTS = {'age_years': 58.0, 'findings': ['ChestPainACS'], 'hr': 130, 'rr': 24, 'conditions': ['Cond_Diabetes'],
         'pain_sites': ['Region_Chest'], 'medications': [], 'resources': [], 'self_report': True}


@pytest.mark.parametrize('q', ['INSERT DATA { ex:a ex:b ex:c }', 'DELETE WHERE { ?s ?p ?o }', 'LOAD <http://x.org/a.ttl>',
                               'SELECT * WHERE { SERVICE <http://x.org/sparql> { ?s ?p ?o } }',
                               'SELECT * FROM <http://x.org/g> WHERE { ?s ?p ?o }', '', 'SELEC ?x'])
def test_tolak_query_berbahaya_atau_salah(q):
    with pytest.raises(sparql.QueryError):
        sparql.run(q)


def test_kata_from_di_dalam_string_boleh():
    assert sparql.run('SELECT ?s WHERE { ?s rdfs:label "FROM sini" }')['count'] == 0


def test_semua_query_kamus_berjalan_dan_berisi():
    r = engine.infer(FACTS, sparql.CASE)
    for it in sparql.library():
        out = sparql.run(it['query'], r, FACTS)
        assert out['count'] > 0, it['id']


def test_kasus_ini_terbaca_dengan_tipe_angka():
    r = engine.infer(FACTS, sparql.CASE)
    rows = sparql.run('SELECT ?n WHERE { ex:KasusIni ex:heartRate ?n FILTER(?n > 100) }', r, FACTS)['rows']
    assert rows == [[130.0]]


def test_graph_kasus_memuat_skala_esi_utuh():
    from app import graphview
    r = engine.infer(FACTS, sparql.CASE)
    esi = {n['id']: n['esi'] for n in graphview.case_graph(r, str(engine.EX) + sparql.CASE)['nodes'] if n['kind'] == 'esi'}
    assert esi == {':ESI_1': 'none', ':ESI_2': 'final', ':ESI_3': 'none', ':ESI_4': 'none', ':ESI_5': 'candidate'}


def test_graph_kb_mengelompokkan_individu_per_kelas():
    from app import graphview
    d = graphview.kb_graph()
    boxes = {n['id']: n['count'] for n in d['nodes'] if n.get('box')}
    assert boxes['box:ESILevel'] == 5 and boxes['box:Rule'] == 24
    assert sum(boxes.values()) == sum(1 for n in d['nodes'] if not n.get('box'))
