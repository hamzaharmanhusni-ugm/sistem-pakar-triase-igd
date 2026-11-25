"""Penjelasan AI (KG-RAG): konteks yang dikirim ke Claude harus berasal dari knowledge graph dan jejak aturan kasus ini.
Tidak memanggil Claude API (LLM_ENABLED=0), sehingga gratis dan deterministik."""
import os

os.environ['LLM_ENABLED'] = '0'
os.environ['KG_BACKEND'] = 'rdflib'

from fastapi.testclient import TestClient

from app import engine, llm
from app.main import app

CASE = dict(age_years=58, pain=6, hr=104, rr=22, spo2=95, sbp=165, conditions=['Cond_Hypertension'],
            pain_sites=['Region_Chest'], resources=['Res_Lab', 'Res_ECG_Xray'], resources_assessed=True, findings=[])


def test_kg_context_contains_tbox_abox_and_trace():
    ctx = llm._kg_context(engine.infer(dict(CASE), 'Ctx'), CASE)
    assert 'HASIL: ESI 2' in ctx
    # TBox: property dan kelas yang menyentuh kasus
    assert 'property :heartRate' in ctx and 'subPropertyOf :vitalValue' in ctx
    assert 'property :ofPatient' in ctx and 'FunctionalProperty' in ctx
    assert 'kelas :Condition' in ctx
    # ABox: individu, ambang yang dibaca D01, dan kartu aturan yang terpicu
    assert ':Cond_Hypertension (anggota kelas :Condition)' in ctx and ':Risk_Cardiac' in ctx
    assert ':DZ_HR_8y_up' in ctx and 'limit 100' in ctx
    assert 'kartu aturan :Rule_B12' in ctx
    # jejak penalaran
    assert 'E01' in ctx and 'bergantung pada' in ctx and 'siklus' in ctx


def test_explain_unavailable_without_llm():
    c = TestClient(app)
    r = c.post('/api/explain', json=dict(mode='nurse', age_years=40, hr=120, aspect='tbox'))
    assert r.status_code == 503 and 'tidak tersedia' in r.json()['detail']
    assert c.post('/api/explain', json=dict(mode='nurse', age_years=40, aspect='bebas')).status_code == 422
