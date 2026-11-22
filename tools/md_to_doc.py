"""Gabungkan dokumen Markdown pendukung menjadi satu HTML bergaya dokumen, lalu Word (COM) menyimpannya sebagai DOCX dan PDF.
Pemakaian (Windows + Microsoft Word):  python tools/md_to_doc.py
Keluaran: docs/Dokumen Pendukung - Representasi Pengetahuan dan Penalaran.{docx,pdf}"""
import re
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
DOCS = ['01 - Representasi Pengetahuan.md', '02 - Penalaran dan Penjelasan.md']
NAME = 'Dokumen Pendukung - Representasi Pengetahuan dan Penalaran'
OUT = ROOT / 'docs'
FIGS = {  # gambar disisipkan setelah heading yang cocok
    '5. Fasilitas penjelasan': ('screenshots/laptop-1366-10-teknis-jejak.png', 'Gambar 2. Laci "Detail teknis": jejak aturan per Decision Point, IF-THEN, sumber, SPARQL, dan triple baru.'),
    '1. Sistem pakar dan tiga blok pembangunnya': ('screenshots/laptop-1366-07-hasil.png', 'Gambar 1. Antarmuka untuk orang awam: hasil, alasan dalam bahasa awam, dan ringkasan untuk petugas IGD.'),
}

CSS = """
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #13201C; line-height: 1.35; }
h1 { font-size: 20pt; color: #0F6B5C; margin: 18pt 0 6pt; page-break-before: always; }
h1.first { page-break-before: auto; }
h2 { font-size: 14pt; color: #0B5549; margin: 14pt 0 4pt; }
h3 { font-size: 12pt; color: #13201C; margin: 10pt 0 3pt; }
p, li { margin: 0 0 6pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 10pt; }
th { background: #0F6B5C; color: #FFFFFF; text-align: left; padding: 4pt 6pt; border: 1px solid #0F6B5C; }
td { padding: 4pt 6pt; border: 1px solid #D3DFD9; vertical-align: top; }
tr:nth-child(even) td { background: #EEF3F0; }
pre { background: #EEF3F0; border: 1px solid #D3DFD9; padding: 6pt 8pt; font-family: Consolas, monospace; font-size: 9pt; line-height: 1.2; }
code { font-family: Consolas, monospace; font-size: 9.5pt; color: #0B5549; }
pre code { color: #13201C; font-size: 9pt; }
.cover { text-align: left; }
.cover .t { font-size: 26pt; font-weight: bold; color: #0F6B5C; margin: 120pt 0 8pt; }
.cover .s { font-size: 14pt; color: #3F4F4A; margin-bottom: 40pt; }
.cover .m { font-size: 11pt; color: #3F4F4A; }
.cap { font-size: 9.5pt; color: #56655F; font-style: italic; margin: 2pt 0 10pt; }
"""


def body(md_text):
    md_text = re.sub(r'^---\n.*?\n---\n', '', md_text, flags=re.S)          # buang frontmatter Obsidian
    md_text = re.sub(r'\[([^\]]+)\]\(<?[^)]*\.md>?\)', r'\1', md_text)      # tautan antar-dokumen jadi teks
    html = markdown.markdown(md_text, extensions=['tables', 'fenced_code'])
    for head, (img, cap) in FIGS.items():
        html = html.replace(f'<h2>{head}</h2>', f'<h2>{head}</h2><p><img src="{(OUT / img).as_uri()}"></p><p class="cap">{cap}</p>', 1)
    return html


def main():
    parts = [body((ROOT / d).read_text(encoding='utf-8')) for d in DOCS]
    parts[0] = parts[0].replace('<h1>', '<h1 class="first">', 1)
    logo = (ROOT.parent / 'Tugas 4 - Knowledge Graph Triase IGD' / 'logougm.png')
    cover = f"""<div class="cover">
      {'<p><img src="' + logo.as_uri() + '"></p>' if logo.exists() else ''}
      <p class="t">Representasi Pengetahuan dan Penalaran</p>
      <p class="s">Dokumen pendukung project akhir: Sistem Pakar Triase IGD "Perlu ke IGD?"</p>
      <p class="m">Mata kuliah Sistem Pakar Lanjut<br>Magister Kecerdasan Artifisial, FMIPA Universitas Gadjah Mada<br><br>Hamzah Arman Husni<br>2026</p></div>
      <p style="page-break-before: always"></p>"""
    html = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{cover}{"".join(parts)}</body></html>'
    tmp = OUT / '_dokumen.html'
    tmp.write_text(html, encoding='utf-8')
    ps = f"""
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$d = $w.Documents.Open('{tmp}')
$d.ActiveWindow.View.Type = 3
foreach ($s in $d.InlineShapes) {{
  if ($s.LinkFormat) {{ $s.LinkFormat.SavePictureWithDocument = $true; $s.LinkFormat.BreakLink() }}
  $ratio = $s.Height / $s.Width
  $target = if ($s.Width -gt 120) {{ 400 }} else {{ 70 }}
  $s.Width = $target; $s.Height = $target * $ratio
}}
# halaman sampul terpisah: page break tepat sebelum Heading 1 pertama (range diciutkan agar judul tidak tertimpa)
foreach ($p in $d.Paragraphs) {{ if ($p.OutlineLevel -eq 1) {{ $r = $p.Range; $r.Collapse(1); $r.InsertBreak(7); break }} }}
$d.PageSetup.TopMargin = 72; $d.PageSetup.BottomMargin = 72; $d.PageSetup.LeftMargin = 72; $d.PageSetup.RightMargin = 72
$d.SaveAs2('{OUT / (NAME + '.docx')}', 16)
$d.ExportAsFixedFormat('{OUT / (NAME + '.pdf')}', 17)
$d.Close(); $w.Quit()
"""
    r = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
    tmp.unlink()
    if r.returncode:
        sys.exit(r.stderr)
    print('ditulis:', OUT / (NAME + '.docx'), '\n         ', OUT / (NAME + '.pdf'))


if __name__ == '__main__':
    main()
