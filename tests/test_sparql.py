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
