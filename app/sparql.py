"""SPARQL hanya-baca ke knowledge graph: editor manual, kamus query (kb/queries/*.rq), dan alat agent Claude.
Query dijalankan pada salinan rdflib (knowledge base + closure OWL 2 RL), ditambah fakta kasus yang sedang dibuka bila ada."""
import re
import time
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
from functools import lru_cache

import rdflib.plugins.sparql as rdf_sparql
from rdflib import Graph, Literal, URIRef
from rdflib.plugins.sparql import prepareQuery

from . import engine, graphview

rdf_sparql.SPARQL_LOAD_GRAPHS = False  # FROM <url> tidak boleh membuat server mengunduh graph dari luar
CASE = 'KasusIni'  # nama tetap kasus yang sedang dibuka, agar query dapat menulis ex:KasusIni dan ex:KasusIni_pasien
MAX_ROWS = 200
TIMEOUT_S = 8
PREFIX = engine.PREFIX + '''PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
'''
# SERVICE memanggil endpoint luar dan FROM/FROM NAMED memuat graph luar: ditolak. Update (INSERT, DELETE, LOAD, ...)
# sudah ditolak oleh prepareQuery karena hanya menerima bentuk query.
BANNED = re.compile(r'\b(SERVICE|FROM)\b', re.I)
_pool = ThreadPoolExecutor(max_workers=2)  # ponytail: query yang melewati batas waktu tetap berjalan di thread sampai selesai


class QueryError(ValueError):
    pass


def _strip_comments(q):
    return re.sub(r'(^|\s)#[^\n]*', r'\1', q)


def check(query):
    """Validasi: hanya SELECT/ASK/CONSTRUCT/DESCRIBE, tanpa SERVICE/FROM. Mengembalikan query siap jalan."""
    q = (query or '').strip()
    if not q:
        raise QueryError('Query kosong.')
    if len(q) > 5000:
        raise QueryError('Query terlalu panjang (maksimal 5000 karakter).')
    if BANNED.search(_strip_comments(re.sub(r'"[^"\n]*"|\'[^\'\n]*\'', '""', q))):
        raise QueryError('SERVICE dan FROM tidak diizinkan: query hanya boleh membaca knowledge graph aplikasi ini.')
    try:
        prepareQuery(PREFIX + q)
    except Exception as e:
        msg = str(e).split('\n')[0][:300]
        raise QueryError(f'Query tidak valid atau bukan query baca (hanya SELECT, ASK, CONSTRUCT, DESCRIBE): {msg}') from None
    return PREFIX + q


def case_graph(result, facts):
    """Fakta kasus (working memory bertipe data asli) + triple yang ditambahkan aturan selama inferensi."""
    g = engine.case_graph(CASE, facts)
    for s in result['steps']:
        for t in s['added']:
            g.add(tuple(graphview.to_node(x) for x in t))
    return g


def _cell(v):
    if v is None:
        return None
    if isinstance(v, Literal):
        py = v.toPython()
        return float(py) if isinstance(py, Decimal) else py if isinstance(py, (int, float, bool)) else str(v)
    return engine.short_node(v) if isinstance(v, URIRef) else str(v)


def run(query, result=None, facts=None):
    """Jalankan query baca. Hasil: {kind, vars, rows, count, truncated, ms} atau QueryError."""
    q = check(query)
    g = Graph()
    g += engine.knowledge_base()
    if result is not None:
        g += case_graph(result, facts)
    t0 = time.perf_counter()
    try:
        res = _pool.submit(lambda: list(_exec(g, q))).result(timeout=TIMEOUT_S)
    except FutTimeout:
        raise QueryError(f'Query melebihi batas waktu {TIMEOUT_S} detik. Persempit pola atau tambahkan LIMIT.') from None
    except QueryError:
        raise
    except Exception as e:
        raise QueryError(f'Query gagal dijalankan: {str(e)[:300]}') from None
    kind, vars_, rows = res[0]
    out = {'kind': kind, 'vars': vars_, 'rows': rows[:MAX_ROWS], 'count': len(rows), 'truncated': len(rows) > MAX_ROWS,
           'ms': round((time.perf_counter() - t0) * 1000), 'case': CASE if result is not None else None}
    return out


def _exec(g, q):
    r = g.query(q)
    if r.type == 'ASK':
        yield 'ask', ['jawaban'], [[bool(r.askAnswer)]]
    elif r.type in ('CONSTRUCT', 'DESCRIBE'):
        yield 'graph', ['subjek', 'predikat', 'objek'], [[_cell(s), _cell(p), _cell(o)] for s, p, o in r.graph]
    else:
        vars_ = [str(v) for v in r.vars]
        yield 'select', vars_, [[_cell(row[v]) for v in r.vars] for row in r]


@lru_cache(maxsize=1)
def library():
    """Kamus query: kb/queries/*.rq. Baris '# Pertanyaan:' dan '# Catatan:' di awal berkas menjadi judul dan keterangan."""
    items = []
    for f in sorted((engine.KB / 'queries').glob('*.rq')):
        text = f.read_text(encoding='utf-8')
        meta = dict(re.findall(r'^#\s*(Pertanyaan|Catatan|Kelompok):\s*(.+)$', text, re.M))
        body = '\n'.join(l for l in text.splitlines() if not re.match(r'#\s*(Pertanyaan|Catatan|Kelompok):', l)).strip()
        items.append({'id': f.stem, 'question': meta.get('Pertanyaan', f.stem), 'note': meta.get('Catatan', ''),
                      'group': meta.get('Kelompok', 'Umum'), 'query': body, 'needs_case': 'KasusIni' in body})
    return items


@lru_cache(maxsize=1)
def schema():
    """Ringkasan skema untuk agent Claude: prefix, kelas, property (domain -> range), dan contoh dari kamus."""
    from rdflib import OWL, RDF, RDFS
    g = engine.knowledge_base()
    ex, short = str(engine.EX), engine.short_node
    lab = lambda n: str(g.value(n, RDFS.label) or g.value(n, engine.SKOS.prefLabel) or '')
    classes = sorted({c for c in g.subjects(RDF.type, OWL.Class) if str(c).startswith(ex)}, key=str)
    lines = ['KELAS (jumlah individu):']
    for c in classes:
        sup = [short(s) for s in g.objects(c, RDFS.subClassOf) if str(s).startswith(ex) and s != c]
        n = sum(1 for _ in g.subjects(RDF.type, c))
        lines.append(f'- {short(c)} ({n}) {lab(c)}' + (f' subClassOf {", ".join(sup)}' if sup else ''))
    lines.append('\nPROPERTY yang dipakai (contoh subjek -> objek):')
    preds = sorted({p for _, p, _ in g if str(p).startswith(ex)}, key=str)
    for p in preds:
        s, o = next(((s, o) for s, _, o in g.triples((None, p, None))), (None, None))
        dom = [short(d) for d in g.objects(p, RDFS.domain) if str(d).startswith(ex)]
        rng = [short(r) for r in g.objects(p, RDFS.range)]
        ex_o = f'"{str(o)[:30]}"' if isinstance(o, Literal) else short(o)
        lines.append(f'- {short(p)}' + (f' domain {dom[0]}' if dom else '') + (f' range {rng[0]}' if rng else '') + f'; contoh: {short(s)} -> {ex_o}')
    lines.append('\nCONTOH QUERY DARI KAMUS:')
    for it in library()[:6]:
        lines.append(f'# {it["question"]}\n{it["query"]}\n')
    return '\n'.join(lines)
