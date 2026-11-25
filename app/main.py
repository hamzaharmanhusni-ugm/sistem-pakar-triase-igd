"""API chatbot sistem pakar triase IGD. Jalankan: uvicorn app.main:app --port 8000"""
import os
import time
import uuid
from collections import defaultdict, deque
from typing import Literal
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import dialog, engine, graphdb, graphview, llm, nlu, sparql

STATIC = Path(__file__).resolve().parent.parent / 'web'  # frontend dipisah di folder web/
SESSIONS: dict[str, dialog.Session] = {}  # ponytail: sesi di memori proses; pindahkan ke Redis/DB bila multi-worker


@asynccontextmanager
async def lifespan(_):
    engine.infer({'findings': [], 'resources': []}, 'Pemanasan')  # muat KB + parse aturan sebelum request pertama
    yield


app = FastAPI(title='Sistem Pakar Triase IGD', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=STATIC), name='static')

AI_PATHS = {'/api/explain', '/api/parse', '/api/assess', '/api/sparql/ask'}
LIMITED = {'/api/explain', '/api/sparql/ask'}  # panggilan AI berbiaya besar, dibatasi per IP
AI_PER_IP = int(os.getenv('AI_REQUESTS_PER_IP', '30'))  # per jendela waktu, hanya untuk kunci server
AI_WINDOW_S = 600
_hits: dict[str, deque] = defaultdict(deque)  # ponytail: di memori proses; cukup untuk satu instance Space


@app.middleware('http')
async def visitor_key_and_rate_limit(request: Request, call_next):
    """Kunci API pengunjung (header X-Anthropic-Key) hanya hidup selama satu permintaan: tidak disimpan, tidak dicatat.
    Permintaan AI dengan kunci server dibatasi per IP agar satu pengunjung tidak menghabiskan anggaran harian."""
    key = (request.headers.get('x-anthropic-key') or '').strip()
    if key and not (key.startswith('sk-ant-') and 20 < len(key) < 300):
        return JSONResponse({'detail': 'Format kunci API tidak dikenal (harus diawali sk-ant-).'}, status_code=400)
    if request.url.path in AI_PATHS and not key and request.method == 'POST' and llm.status()['enabled']:
        ip = (request.headers.get('x-forwarded-for') or (request.client.host if request.client else '')).split(',')[0].strip()
        now, q = time.monotonic(), _hits[ip]
        while q and now - q[0] > AI_WINDOW_S:
            q.popleft()
        if request.url.path in LIMITED and len(q) >= AI_PER_IP:
            return JSONResponse({'detail': f'Batas {AI_PER_IP} permintaan AI per 10 menit tercapai. Coba lagi nanti atau masukkan kunci API sendiri.'}, status_code=429)
        q.append(now)
    token = llm.VISITOR_KEY.set(key or None)
    try:
        return await call_next(request)
    finally:
        llm.VISITOR_KEY.reset(token)


class ChatIn(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=2000)


@app.get('/')
def index():
    return FileResponse(STATIC / 'index.html')


@app.post('/api/session')
def new_session():
    s = dialog.Session()
    SESSIONS[s.id] = s
    q = s.next_question()
    return s.payload(dialog.GREETING + q['text'], nxt=q)


@app.post('/api/chat')
def chat(body: ChatIn):
    s = SESSIONS.get(body.session_id)
    if s is None:
        raise HTTPException(404, 'Sesi tidak ditemukan, mulai sesi baru.')
    if body.message.strip().lower() in {'ulang', 'reset', 'mulai ulang'}:
        SESSIONS.pop(s.id, None)
        return new_session()
    if s.done:
        return s.payload('Konsultasi ini sudah selesai. Ketik "ulang" untuk kasus baru.')
    return s.handle(body.message)


class AssessIn(BaseModel):
    """Jawaban terstruktur dari alur pasien/keluarga (tombol pilihan, bukan teks bebas)."""
    age_years: float | None = Field(None, ge=0, le=120)
    age_months: float | None = Field(None, ge=0, le=36)
    findings: list[str] = []
    avpu: str | None = Field(None, pattern='^[AVPU]$')
    hr: float | None = Field(None, ge=20, le=300)
    rr: float | None = Field(None, ge=4, le=100)
    spo2: float | None = Field(None, ge=40, le=100)
    sbp: float | None = Field(None, ge=40, le=300)
    temp: float | None = Field(None, ge=30, le=45)
    pain: int | None = Field(None, ge=0, le=10)
    # anamnesis terstruktur (v2.2): ID individu di knowledge graph, divalidasi terhadap /api/vocab
    mode: Literal['lay', 'nurse'] = 'lay'
    sex: str | None = None
    pregnancy: str | None = None
    conditions: list[str] = []
    medications: list[str] = []
    pain_sites: list[str] = []
    onset: str | None = None
    onset_sudden: bool | None = None
    resources: list[str] = []  # hanya dipakai mode perawat; mode awam diperkirakan aturan C00


@app.get('/api/vocab')
def vocab():
    return engine.vocab()


def _run(body: AssessIn, case: str | None = None):
    """Validasi jawaban terhadap knowledge graph lalu jalankan inferensi. Dipakai /api/assess dan /api/explain."""
    facts = body.model_dump(include=set(AssessIn.model_fields))
    known = engine.lexicon('Finding')
    bad = [f for f in facts['findings'] if f not in known]
    v = engine.vocab()
    for slot in engine.VOCAB:
        ids = {o['id'] for o in v[slot]}
        got = facts[slot] if isinstance(facts[slot], list) else [facts[slot]] if facts[slot] else []
        bad += [x for x in got if x not in ids]
    if bad:
        raise HTTPException(422, f'Pilihan tidak dikenal: {bad}')
    if facts['age_years'] is None and facts['age_months'] is None:
        raise HTTPException(422, 'Usia wajib diisi.')
    nurse = facts.pop('mode') == 'nurse'
    if nurse:  # perawat menilai resource sendiri (Decision Point C), termasuk "nol resource"
        facts.update(resources_assessed=True)
    else:
        facts.update(resources=[], self_report=True)
    return engine.infer(facts, case or f'{"Triase" if nurse else "Mandiri"}_{uuid.uuid4().hex[:12]}'), facts, nurse


@app.post('/api/assess')
def assess(body: AssessIn):
    r, _, _ = _run(body)
    return {'result': r, 'narrative': (llm.narrate(r) if r['esi'] else None) or dialog.template_narrative(r), 'llm': llm.status()}


@app.post('/api/graph/case')
def graph_case(body: AssessIn):
    """Graph satu kasus untuk tab Graph: fakta, jejak penalaran, dan konteks knowledge base yang disentuh."""
    r, _, _ = _run(body, sparql.CASE)
    return graphview.case_graph(r, str(engine.EX) + sparql.CASE)


@app.get('/api/graph/kb')
def graph_kb():
    """Seluruh knowledge base untuk tampilan "Knowledge base lengkap"."""
    return graphview.kb_graph()


@app.get('/api/graph/tbox')
def graph_tbox():
    return graphview.tbox_graph()


@app.get('/api/graph/node')
def graph_node(iri: str = Query(min_length=2, max_length=300, pattern=r'^[:\w./#-]+$')):
    """Tetangga satu simpul knowledge base, untuk menjelajah dengan klik."""
    return graphview.neighbors(iri)


class ExplainIn(AssessIn):
    aspect: Literal['klinis', 'insight', 'teknis', 'tbox', 'abox'] = 'klinis'
    question: str | None = Field(None, max_length=500)


@app.post('/api/explain')
def explain(body: ExplainIn):
    """Penjelasan Claude (KG-RAG) atas hasil sistem pakar. Inferensi dijalankan ulang di server dari jawaban yang sama,
    sehingga yang dijelaskan selalu hasil aturan, bukan data kiriman klien."""
    if body.question and body.question.strip():  # pertanyaan bebas: agent Claude yang dapat menjalankan query SPARQL
        r, facts, nurse = _run(body, sparql.CASE)
        out = llm.ask(body.question.strip(), 'nurse' if nurse else 'lay', r, facts)
        if out is None:
            raise HTTPException(503, 'Penjelasan AI tidak tersedia: ' + (llm.LAST_ERROR.get() or llm.status()['reason'] or 'panggilan Claude gagal'))
        return {'text': out['text'], 'aspect': 'tanya', 'model': llm.MODEL, 'n_queries': len(out['queries']),
                'queries': out['queries'] if nurse else []}  # pasien/keluarga: query tidak ditampilkan
    r, facts, nurse = _run(body)
    if not r['esi']:
        raise HTTPException(422, 'Belum ada hasil untuk dijelaskan.')
    text = llm.explain(r, facts, body.aspect, None, 'nurse' if nurse else 'lay')
    if text is None:
        raise HTTPException(503, 'Penjelasan AI tidak tersedia: ' + (llm.LAST_ERROR.get() or llm.status()['reason'] or 'panggilan Claude gagal'))
    return {'text': text, 'aspect': body.aspect, 'model': llm.MODEL, 'queries': [], 'n_queries': 0}


class SparqlIn(BaseModel):
    query: str = Field(min_length=1, max_length=5000)
    facts: AssessIn | None = None  # fakta kasus yang sedang dibuka; bila ada, query juga membaca ex:KasusIni


@app.get('/api/queries')
def queries():
    """Kamus query SPARQL (kb/queries/*.rq)."""
    return sparql.library()


@app.post('/api/sparql')
def run_sparql(body: SparqlIn):
    """Editor SPARQL manual, hanya-baca. Tidak memakai Claude, jadi tidak memakan kuota AI."""
    r = facts = None
    if body.facts is not None:
        r, facts, _ = _run(body.facts, sparql.CASE)
    try:
        return sparql.run(body.query, r, facts)
    except sparql.QueryError as e:
        raise HTTPException(400, str(e))


class KgAskIn(BaseModel):
    question: str | None = Field(None, max_length=500)
    query: str | None = Field(None, max_length=5000)  # mode perbaikan: query yang gagal
    error: str | None = Field(None, max_length=1000)
    facts: AssessIn | None = None


@app.post('/api/sparql/ask')
def kg_ask(body: KgAskIn):
    """Agent Claude untuk tab Query SPARQL: menjawab pertanyaan atau memperbaiki query yang gagal."""
    if body.query:
        task = ('Perbaiki query SPARQL berikut agar valid dan menjawab maksudnya. Jalankan versi perbaikan dengan alat, '
                f'lalu jelaskan singkat apa yang diubah.\nQuery:\n{body.query}\nPesan error: {body.error or "(hasil kosong atau tidak sesuai)"}')
    elif body.question and body.question.strip():
        task = body.question.strip()
    else:
        raise HTTPException(422, 'Isi pertanyaan atau query.')
    r = facts = None
    if body.facts is not None:
        r, facts, _ = _run(body.facts, sparql.CASE)
    out = llm.ask(task, 'nurse', r, facts)
    if out is None:
        raise HTTPException(503, 'Claude tidak tersedia: ' + (llm.LAST_ERROR.get() or llm.status()['reason'] or 'panggilan Claude gagal'))
    return {**out, 'model': llm.MODEL}


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@app.post('/api/parse')
def parse(body: ParseIn):
    """Keluhan teks bebas -> ID temuan di knowledge graph (Claude bila aktif, selain itu sinonim lokal)."""
    got = llm.extract(body.text, 'Apa keluhan pasien?') or nlu.extract(body.text, 'findings')
    lex = engine.lexicon('Finding')
    ids = [f for f in got.get('findings', []) if f in lex]
    return {'findings': [{'id': f, 'label': lex[f]['label']} for f in ids],
            'source': 'claude' if llm.status()['enabled'] else 'lokal'}


@app.get('/api/findings')
def findings():
    return {k: v['label'] for k, v in sorted(engine.lexicon('Finding').items())}


@app.get('/api/rules')
def rules():
    return engine.rules_catalog()


@app.get('/api/health')
def health():
    backend = engine.backend()
    triples = len(engine.knowledge_base())
    if backend == 'graphdb':  # jumlah di GraphDB (eksplisit + hasil reasoner OWL 2 RL)
        try:
            triples = int(graphdb.select('SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }')[0]['n'])
        except Exception:
            pass
    return {'triples_kb': triples, 'rules': len(engine.rules_catalog()), 'llm': llm.status(),
            'backend': backend, 'graphdb': {'url': graphdb.URL, 'repo': graphdb.REPO}}
