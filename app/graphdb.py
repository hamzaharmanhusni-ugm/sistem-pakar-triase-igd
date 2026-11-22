"""Klien GraphDB (SPARQL 1.1 Protocol, hanya stdlib). Knowledge base disimpan di repository 'triage-es'.

Penyiapan sekali: python -m app.graphdb   (membuat repository dan memuat kb/*.ttl ke named graph)."""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from rdflib import Graph

URL = os.getenv('GRAPHDB_URL', 'http://127.0.0.1:7201')  # 127.0.0.1: di Windows 'localhost' mencoba IPv6 dulu
REPO = os.getenv('GRAPHDB_REPO', 'triage-es')
KB = Path(__file__).resolve().parent.parent / 'kb'
G = 'http://example.org/triage/graph/'
FILES = {'triage-ontology.ttl': 'tbox', 'knowledge.ttl': 'pengetahuan', 'evidence.ttl': 'bukti'}


def _call(path, data=None, headers=None, method=None, timeout=30):
    req = urllib.request.Request(URL + path, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def available():
    try:
        return any(r['id'] == REPO for r in json.loads(_call('/rest/repositories', timeout=2)))
    except Exception:
        return False


def update(sparql):
    _call(f'/repositories/{REPO}/statements', urllib.parse.urlencode({'update': sparql}).encode(),
          {'Content-Type': 'application/x-www-form-urlencoded'})


def select(sparql):
    body = urllib.parse.urlencode({'query': sparql}).encode()
    res = json.loads(_call(f'/repositories/{REPO}', body, {'Content-Type': 'application/x-www-form-urlencoded',
                                                          'Accept': 'application/sparql-results+json'}))
    return [{k: v['value'] for k, v in b.items()} for b in res['results']['bindings']]


def construct(sparql):
    body = urllib.parse.urlencode({'query': sparql}).encode()
    data = _call(f'/repositories/{REPO}', body, {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/turtle'})
    return Graph().parse(data=data.decode('utf-8'), format='turtle')


def add_graph(g):
    """Masukkan triple working memory (rdflib Graph) ke default graph."""
    _call(f'/repositories/{REPO}/statements', g.serialize(format='nt').encode('utf-8'), {'Content-Type': 'application/n-triples'})


def setup(reload=False):
    repos = [r['id'] for r in json.loads(_call('/rest/repositories'))]
    if REPO not in repos:
        b = '----triage'
        cfg = (KB / 'graphdb' / 'repo-config.ttl').read_bytes()
        body = (f'--{b}\r\nContent-Disposition: form-data; name="config"; filename="repo-config.ttl"\r\n'
                f'Content-Type: text/turtle\r\n\r\n').encode() + cfg + f'\r\n--{b}--\r\n'.encode()
        _call('/rest/repositories', body, {'Content-Type': f'multipart/form-data; boundary={b}'}, 'POST')
        print('repository dibuat:', REPO)
    for f, name in FILES.items():
        ctx = urllib.parse.quote(f'<{G}{name}>')
        if reload:
            _call(f'/repositories/{REPO}/statements?context={ctx}', method='DELETE')
        _call(f'/repositories/{REPO}/statements?context={ctx}', (KB / f).read_bytes(), {'Content-Type': 'text/turtle'}, 'POST')
        print('dimuat:', f, '->', G + name)
    n = select('SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }')[0]['n']
    e = select('SELECT (COUNT(*) AS ?n) FROM <http://www.ontotext.com/explicit> WHERE { ?s ?p ?o }')[0]['n']
    print(f'triple total {n} (eksplisit {e}, hasil reasoner OWL 2 RL {int(n) - int(e)})')


if __name__ == '__main__':
    setup(reload=True)
