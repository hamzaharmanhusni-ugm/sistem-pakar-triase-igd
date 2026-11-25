"""Rakit paket Hugging Face Space di build/hf-space/ (folder ini di-gitignore).
Isi: berkas space/ (README berfrontmatter, space_app.py, requirements.txt) + app/, kb/, web/.
Tidak membawa data/, .env, tes, dokumen, maupun berkas GraphDB lokal.
Pemakaian:  python tools/build_space.py   lalu   hf upload <user>/<space> build/hf-space . --repo-type space"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build' / 'hf-space'
SKIP = shutil.ignore_patterns('__pycache__', '*.pyc', 'triagekg.*', 'visits.csv', 'build_evidence.py')

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for f in (ROOT / 'space').iterdir():
    shutil.copy2(f, OUT / f.name)
for d in ['app', 'kb', 'web']:
    shutil.copytree(ROOT / d, OUT / d, ignore=SKIP)
files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file())
assert not any(n.endswith('.env') or n.startswith('data/') for n in files), 'berkas rahasia/data ikut terbawa'
print(f'{len(files)} berkas di {OUT}')
