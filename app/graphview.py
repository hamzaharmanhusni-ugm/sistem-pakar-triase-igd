"""Data untuk penjelajah knowledge graph di antarmuka (tab Graph): simpul dan sisi siap digambar Cytoscape.js.
Tiga sumber: graph satu kasus (fakta + jejak penalaran + konteks KB), kerangka TBox, dan tetangga satu simpul."""
from rdflib import OWL, RDF, RDFS, Literal, URIRef

from . import engine

EX = str(engine.EX)
SKOS = engine.SKOS
NOISE = {str(OWL.Thing), str(OWL.sameAs), str(RDFS.Resource), str(OWL.NamedIndividual), str(OWL.Class), str(OWL.ObjectProperty),
         str(OWL.DatatypeProperty), str(RDF.Property), str(OWL.TransitiveProperty), str(OWL.FunctionalProperty)}
SKIP_P = {str(OWL.sameAs), str(SKOS.altLabel), str(RDFS.comment), str(OWL.equivalentProperty)}


def _kind(g, n):
    """Jenis simpul untuk pewarnaan: tbox (kelas/property), case, inference, rule, abox, literal."""
    if isinstance(n, Literal):
        return 'literal'
    s = str(n)
    if '_inf_' in s:
        return 'inference'
    if s.startswith(EX + 'Rule_'):
        return 'rule'
    if (n, RDF.type, OWL.Class) in g or (n, RDF.type, OWL.ObjectProperty) in g or (n, RDF.type, OWL.DatatypeProperty) in g:
        return 'tbox'
    return 'abox'


def _label(g, n):
    if isinstance(n, Literal):
        return str(n)[:40]
    lab = g.value(n, SKOS.prefLabel) or g.value(n, RDFS.label)
    short = engine.short_node(n)
    return f'{short}\n{str(lab)[:38]}' if lab and str(lab) != short.lstrip(':') else short


def _pack(g, triples, focus=(), case_prefix=None):
    nodes, edges = {}, []
    for i, (s, p, o) in enumerate(triples):
        if str(p) in SKIP_P or str(o) in NOISE or str(s) in NOISE:
            continue
        sid = engine.short_node(s)
        oid = f'lit{i}' if isinstance(o, Literal) else engine.short_node(o)
        for nid, n in ((sid, s), (oid, o)):
            if nid not in nodes:
                kind = 'case' if case_prefix and str(n).startswith(case_prefix) and '_inf_' not in str(n) else _kind(g, n)
                nodes[nid] = {'id': nid, 'label': _label(g, n), 'kind': kind, 'iri': None if isinstance(n, Literal) else str(n)}
        edges.append({'id': f'e{i}', 'source': sid, 'target': oid, 'label': 'a' if p == RDF.type else engine.short_node(p)})
    for f in focus:
        if f in nodes:
            nodes[f]['focus'] = True
    return {'nodes': list(nodes.values()), 'edges': edges}


def case_graph(result, case_iri):
    """Graph satu kasus: fakta kasus dan pasien, node Inference (usedRule, concluded, dependsOn, prov:used),
    lalu satu lompatan ke knowledge base untuk individu yang disentuh (kelas, penanda risiko, induk wilayah)."""
    g = engine.knowledge_base()
    tr = []
    for s, p, o in _case_triples(result):
        tr.append((s, p, o))
    touched = {o for _, _, o in tr if isinstance(o, URIRef) and not str(o).startswith(case_iri)}
    for n in touched:
        for p in (RDF.type, engine.EX.riskFlag, SKOS.broader, engine.EX.onVital, engine.EX.forAgeGroup):
            for o in g.objects(n, p):
                if str(o).startswith(EX):
                    tr.append((n, p, o))
    return _pack(g, tr, focus=(engine.short_node(URIRef(case_iri)),), case_prefix=case_iri)


def to_node(t):
    """Token pendek hasil inferensi (':x', 'a', 'prov:used', '"lit"') kembali menjadi node RDF."""
    if t.startswith('"'):
        return Literal(t.strip('"'))
    if t == 'a':
        return RDF.type
    for pre, ns in (('rdf:', str(RDF)), ('rdfs:', str(RDFS)), ('prov:', 'http://www.w3.org/ns/prov#'), ('owl:', str(OWL)), ('skos:', str(SKOS))):
        if t.startswith(pre):
            return URIRef(ns + t[len(pre):])
    return URIRef(EX + t.lstrip(':'))


def _case_triples(result):
    """Ubah triple pendek dari hasil inferensi kembali menjadi node RDF."""
    seen = set()
    for triple in list(result['working_memory']) + [x for s in result['steps'] for x in s['added']]:
        key = tuple(triple)
        if key not in seen:
            seen.add(key)
            yield tuple(to_node(t) for t in triple)


def tbox_graph():
    """Kerangka TBox: hierarki kelas (subClassOf) dan object property domain -> range."""
    g = engine.knowledge_base()
    tr = []
    for c in g.subjects(RDF.type, OWL.Class):
        if not str(c).startswith(EX):
            continue
        for sup in g.objects(c, RDFS.subClassOf):
            if str(sup).startswith(EX) or 'prov' in str(sup):
                if sup != c:
                    tr.append((c, RDFS.subClassOf, sup))
        for eq in g.objects(c, OWL.equivalentClass):
            if eq != c and str(eq).startswith(EX):
                tr.append((c, OWL.equivalentClass, eq))
    for p in g.subjects(RDF.type, OWL.ObjectProperty):
        r = g.value(p, RDFS.range)
        doms = [x for x in g.objects(p, RDFS.domain) if str(x).startswith(EX)]
        if doms and r is not None and str(r).startswith(EX) and str(p).startswith(EX):
            tr.append((doms[0], p, r))
    return _pack(g, tr)


def neighbors(iri, limit=80):
    """Semua triple yang menyentuh satu simpul knowledge base (sebagai subjek atau objek), untuk penjelajahan."""
    g = engine.knowledge_base()
    n = URIRef(iri if iri.startswith('http') else EX + iri.lstrip(':'))
    out = [(n, p, o) for p, o in g.predicate_objects(n)]
    inc = [(s, p, n) for s, p in g.subject_predicates(n)]
    tr = [t for t in out + inc if str(t[1]) not in SKIP_P and str(t[2]) not in NOISE and str(t[0]) not in NOISE]
    data = _pack(g, tr[:limit], focus=(engine.short_node(n),))
    data['total'] = len(tr)
    data['label'] = _label(g, n)
    return data
