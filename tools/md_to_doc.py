"""Ubah dokumen Markdown menjadi DOCX dan PDF bergaya laporan memakai Microsoft Word (COM).
Pemakaian (Windows + Word):  .venv/Scripts/python tools/md_to_doc.py [pendukung|laporan]   (tanpa argumen: keduanya)
Keluaran di docs/: dokumen pendukung representasi pengetahuan, dan laporan akhir (dengan daftar isi)."""
import re
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / 'docs'
LOGO = ROOT.parent / 'Tugas 4 - Knowledge Graph Triase IGD' / 'logougm.png'
if not LOGO.exists():
    LOGO = ROOT / 'deck' / 'assets' / 'logougm.png'

JOBS = {
    'pendukung': {
        'sources': [ROOT / '01 - Representasi Pengetahuan.md', ROOT / '02 - Penalaran dan Penjelasan.md'],
        'name': 'Dokumen Pendukung - Representasi Pengetahuan dan Penalaran',
        'title': 'Representasi Pengetahuan dan Penalaran',
        'subtitle': 'Dokumen pendukung project akhir: Sistem Pakar Triase IGD "Perlu ke IGD?"',
        'toc': False,
        'figs': {  # gambar disisipkan setelah heading yang cocok
            '1. Sistem pakar dan tiga blok pembangunnya': ('screenshots/laptop-1366-07-hasil.png', 'Gambar 1. Antarmuka untuk orang awam: hasil, alasan dalam bahasa awam, dan ringkasan untuk petugas IGD.'),
            '5. Fasilitas penjelasan': ('screenshots/laptop-1366-10-teknis-jejak.png', 'Gambar 2. Laci "Detail teknis": jejak aturan per Decision Point, IF-THEN, sumber, SPARQL, dan triple baru.'),
        },
    },
    'laporan': {
        'sources': [DOCS_DIR / 'Laporan Akhir.md'],
        'name': 'Laporan Akhir - Sistem Pakar Triase IGD',
        'title': 'Perlu ke IGD? Sistem Pakar Triase IGD Berbasis Knowledge Graph',
        'subtitle': 'Laporan Project Akhir Mata Kuliah Sistem Pakar Lanjut',
        'toc': True,
        'figs': {},
    },
}

CSS = """
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #13201C; line-height: 1.35; text-align: justify; }
h1 { font-size: 18pt; color: #0F6B5C; margin: 0 0 8pt; }
h2 { font-size: 13.5pt; color: #0B5549; margin: 14pt 0 4pt; }
h3 { font-size: 12pt; color: #13201C; margin: 10pt 0 3pt; }
p, li { margin: 0 0 6pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 10pt; text-align: left; }
th { background: #0F6B5C; color: #FFFFFF; text-align: left; padding: 4pt 6pt; border: 1px solid #0F6B5C; }
td { padding: 4pt 6pt; border: 1px solid #D3DFD9; vertical-align: top; }
tr:nth-child(even) td { background: #EEF3F0; }
pre { background: #EEF3F0; border: 1px solid #D3DFD9; padding: 6pt 8pt; font-family: Consolas, monospace; font-size: 9pt; line-height: 1.2; text-align: left; }
code { font-family: Consolas, monospace; font-size: 9.5pt; color: #0B5549; }
pre code { color: #13201C; font-size: 9pt; }
.cover { text-align: left; }
.cover .t { font-size: 24pt; font-weight: bold; color: #0F6B5C; margin: 110pt 0 8pt; }
.cover .s { font-size: 14pt; color: #3F4F4A; margin-bottom: 40pt; }
.cover .m { font-size: 11pt; color: #3F4F4A; }
.toc-title { font-size: 18pt; color: #0F6B5C; font-weight: bold; }
.fig { text-align: center; margin: 8pt 0 2pt; }
.cap { font-size: 9.5pt; color: #56655F; font-style: italic; margin: 2pt 0 12pt; text-align: center; }
"""


def rules_table():
    sys.path.insert(0, str(ROOT))
    from app import engine
    esc = lambda s: s.replace('|', '/')
    return '\n'.join(f"| {r['id']} | {r['priority']} | {esc(r['if'])} | {esc(r['then'])} | {esc(r['source'])} |" for r in engine.rules_catalog())


def to_html(md_text, figs):
    md_text = re.sub(r'^---\n.*?\n---\n', '', md_text, flags=re.S)          # frontmatter Obsidian
    md_text = re.sub(r'\[([^\]]+)\]\(<?[^)]*\.md>?\)', r'\1', md_text)      # tautan antar-dokumen jadi teks
    if '{{RULES}}' in md_text:
        md_text = md_text.replace('{{RULES}}', rules_table())
    html = markdown.markdown(md_text, extensions=['tables', 'fenced_code'])
    # gambar Markdown: path relatif -> URI absolut; teks alt menjadi keterangan di bawah gambar
    html = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)"\s*/?></p>',
                  lambda m: f'<p class="fig"><img src="{(DOCS_DIR / m.group(2)).as_uri()}"></p><p class="cap">{m.group(1)}</p>', html)
    for head, (img, cap) in figs.items():
        html = html.replace(f'<h2>{head}</h2>', f'<h2>{head}</h2><p class="fig"><img src="{(DOCS_DIR / img).as_uri()}"></p><p class="cap">{cap}</p>', 1)
    return html.replace('<h1>', '<p>[[PB]]</p><h1>')                    # setiap bab mulai di halaman baru


def build(job):
    parts = ''.join(to_html(p.read_text(encoding='utf-8'), job['figs']) for p in job['sources'])
    toc = '<p class="toc-title">Daftar Isi</p><p>[[TOC]]</p>' if job['toc'] else ''
    if not job['toc']:
        parts = parts.replace('<p>[[PB]]</p>', '', 1)                   # tanpa daftar isi: sampul langsung diikuti bab 1
        toc = '<p>[[PB]]</p>'
    cover = f"""<div class="cover"><p><img src="{LOGO.as_uri()}"></p>
      <p class="t">{job['title']}</p><p class="s">{job['subtitle']}</p>
      <p class="m">Mata kuliah Sistem Pakar Lanjut<br>Magister Kecerdasan Artifisial, FMIPA Universitas Gadjah Mada<br><br>
      Disusun oleh: Hamzah Arman Husni<br>2026</p></div><p>[[PB]]</p>{toc}"""
    html = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{cover}{parts}</body></html>'
    tmp = DOCS_DIR / f'_{job["name"]}.html'
    tmp.write_text(html, encoding='utf-8')
    out = DOCS_DIR / job['name']
    ps = f"""
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$d = $w.Documents.Open('{tmp}')
$d.ActiveWindow.View.Type = 3
foreach ($s in $d.InlineShapes) {{
  if ($s.LinkFormat) {{ $s.LinkFormat.SavePictureWithDocument = $true; $s.LinkFormat.BreakLink() }}
  $ratio = $s.Height / $s.Width
  $target = if ($s.Width -gt 120) {{ 430 }} else {{ 70 }}
  $s.Width = $target; $s.Height = $target * $ratio
}}
$d.PageSetup.TopMargin = 72; $d.PageSetup.BottomMargin = 72; $d.PageSetup.LeftMargin = 72; $d.PageSetup.RightMargin = 72
# penanda [[PB]] -> page break (teks penanda ikut terganti)
while ($true) {{ $r = $d.Content; $f = $r.Find; $f.Text = '[[PB]]'; if (-not $f.Execute()) {{ break }}; $r.InsertBreak(7) }}
$r = $d.Content; $f = $r.Find; $f.Text = '[[TOC]]'
if ($f.Execute()) {{ $r.Text = ''; $toc = $d.TablesOfContents.Add($r, $true, 1, 2); $toc.Update() }}
# nomor halaman di footer
$ftr = $d.Sections.Item(1).Footers.Item(1); $ftr.PageNumbers.Add(2, $false) | Out-Null
if ($d.TablesOfContents.Count -gt 0) {{ $d.TablesOfContents.Item(1).Update() }}
$d.SaveAs2('{out}.docx', 16)
$d.ExportAsFixedFormat('{out}.pdf', 17)
$d.Close(); $w.Quit()
"""
    r = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
    tmp.unlink()
    if r.returncode:
        sys.exit(r.stderr)
    print('ditulis:', f'{out}.docx', '|', f'{out}.pdf')


if __name__ == '__main__':
    for key in (sys.argv[1:] or JOBS):
        build(JOBS[key])
