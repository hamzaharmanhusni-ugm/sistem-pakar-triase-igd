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


def _label(g, n, case_prefix=None):
    """Label tampilan singkat: nama manusiawi (prefLabel/label) bila ada, selain itu ID pendek."""
    short = engine.short_node(n)
    s = str(n)
    if case_prefix and s.startswith(case_prefix):
        if '_inf_' in s:
            return 'Inferensi ' + s.split('_inf_')[1][:3]
        return 'Pasien' if s.endswith('_pasien') else 'Kasus ini'
    lab = g.value(n, SKOS.prefLabel) or g.value(n, RDFS.label)
    text = str(lab) if lab else short.lstrip(':')
    return text if len(text) <= 34 else text[:32].rstrip() + '...'


def _pack(g, triples, focus=(), case_prefix=None):
    """Simpul dan sisi untuk Cytoscape. Nilai literal tidak dijadikan simpul, tetapi dilipat ke 'props' subjeknya
    agar graph tidak penuh angka dan teks panjang; nilainya tampil di panel info saat simpul diklik."""
    nodes, edges, seen = {}, [], set()

    def node(n):
        nid = engine.short_node(n)
        if nid not in nodes:
            kind = 'case' if case_prefix and str(n).startswith(case_prefix) and '_inf_' not in str(n) else _kind(g, n)
            label = nid.lstrip(':') if kind == 'tbox' else 'Aturan ' + nid[6:] if kind == 'rule' else _label(g, n, case_prefix)
            nodes[nid] = {'id': nid, 'label': label, 'kind': kind, 'iri': str(n), 'props': []}
        return nid

    for s, p, o in triples:
        if str(p) in SKIP_P or str(o) in NOISE or str(s) in NOISE:
            continue
        sid, pl = node(s), 'a' if p == RDF.type else engine.short_node(p)
        if isinstance(o, Literal):
            if [pl, str(o)] not in nodes[sid]['props']:
                nodes[sid]['props'].append([pl, str(o)])
            continue
        oid = node(o)
        if (sid, pl, oid) in seen:
            continue
        seen.add((sid, pl, oid))
        rel = 'type' if p == RDF.type else 'sub' if p in (RDFS.subClassOf, OWL.equivalentClass) else 'rel'
        edges.append({'id': f'{sid}|{pl}|{oid}', 'source': sid, 'target': oid, 'label': pl, 'rel': rel})
    for f in focus:
        if f in nodes:
            nodes[f]['focus'] = True
    for n in nodes.values():  # lengkapi props simpul KB dengan label dan komentar untuk panel info
        if n['kind'] in ('tbox', 'abox', 'rule'):
            u = URIRef(n['iri'])
            for p in (SKOS.prefLabel, RDFS.label, RDFS.comment, SKOS.notation):
                v = g.value(u, p)
                if v is not None and [engine.short_node(p), str(v)] not in n['props']:
                    n['props'].append([engine.short_node(p), str(v)])
            n['count'] = sum(1 for _ in g.subjects(RDF.type, u)) if n['kind'] == 'tbox' else None
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
    # ponytail: setiap inferensi dan aturan bertipe ex:Inference / ex:Rule; garis rdf:type-nya hanya menambah keruwetan,
    # jadi kelas itu disebut di judul lajur antarmuka, bukan digambar
    tr = [t for t in tr if not (t[1] == RDF.type and ('_inf_' in str(t[0]) or str(t[0]).startswith(EX + 'Rule_')))]
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
