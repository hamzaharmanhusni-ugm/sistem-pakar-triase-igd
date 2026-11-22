"""API chatbot sistem pakar triase IGD. Jalankan: uvicorn app.main:app --port 8000"""
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import dialog, engine, graphdb, llm, nlu

STATIC = Path(__file__).resolve().parent.parent / 'web'  # frontend dipisah di folder web/
SESSIONS: dict[str, dialog.Session] = {}  # ponytail: sesi di memori proses; pindahkan ke Redis/DB bila multi-worker


@asynccontextmanager
async def lifespan(_):
    engine.infer({'findings': [], 'resources': []}, 'Pemanasan')  # muat KB + parse aturan sebelum request pertama
    yield


app = FastAPI(title='Sistem Pakar Triase IGD', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=STATIC), name='static')


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


@app.post('/api/assess')
def assess(body: AssessIn):
    facts = body.model_dump()
    known = engine.lexicon('Finding')
    bad = [f for f in facts['findings'] if f not in known]
    if bad:
        raise HTTPException(422, f'Temuan tidak dikenal: {bad}')
    if facts['age_years'] is None and facts['age_months'] is None:
        raise HTTPException(422, 'Usia wajib diisi.')
    facts.update(resources=[], self_report=True)
    r = engine.infer(facts, f'Mandiri_{uuid.uuid4().hex[:12]}')
    return {'result': r, 'narrative': (llm.narrate(r) if r['esi'] else None) or dialog.template_narrative(r), 'llm': llm.status()}


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
    return {'triples_kb': len(engine.knowledge_base()), 'rules': len(engine.rules_catalog()), 'llm': llm.status(),
            'backend': engine.backend(), 'graphdb': {'url': graphdb.URL, 'repo': graphdb.REPO}}
