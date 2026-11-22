"""Tangkap layar setiap tahap aplikasi pada ukuran laptop umum dan HP, untuk audit UI/UX dan bahan PPT.
Pemakaian (server harus berjalan di :8000):  .venv/Scripts/python tools/capture.py [folder_keluaran]
Skenario: orang tua mengisi untuk anak 2 tahun ("Anak saya") yang demam dan nadi cepat."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8000'
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / '.impeccable' / 'review')
SIZES = {'laptop-1366': (1366, 768), 'laptop-1536': (1536, 864), 'laptop-1280': (1280, 720), 'mobile-390': (390, 844)}


def run(page, name, size):
    shots = []

    def snap(step):
        page.wait_for_timeout(700)
        f = OUT / f'{name}-{step}.png'
        page.screenshot(path=str(f))
        shots.append(f)

    page.goto(URL)
    page.wait_for_timeout(1800)
    snap('01-sambutan')
    page.click('text=Anak saya')
    page.click('text=Mulai cek')
    page.fill('#age', '2')
    snap('02-usia')
    page.click('[data-act=next]')
    snap('03-tanda-bahaya')
    page.click('[data-act=dangerNone]')
    page.click('[data-act=next]')
    page.click('[data-act=finding][data-v=Fever]')
    page.click('[data-act=finding][data-v=Cough]')
    snap('04-keluhan')
    page.click('[data-act=next]')
    page.click('[data-act=pain][data-v="4"]')
    snap('05-nyeri')
    page.click('[data-act=next]')
    page.fill('[data-m=temp]', '39,4')
    page.fill('[data-m=hr]', '170')
    snap('06-pengukuran')
    page.click('[data-act=finish]')
    page.locator('.verdict').wait_for()
    snap('07-hasil')
    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    snap('08-hasil-bawah')
    page.locator('.side [data-act=think]').click()
    snap('09-teknis-alur')
    page.click('[data-pane=m-trace]')
    page.locator('#ledger details.rule[data-rule=E01] summary').first.click()
    snap('10-teknis-jejak')
    return shots


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome')
        for name, (w, h) in SIZES.items():
            page = b.new_page(viewport={'width': w, 'height': h})
            for f in run(page, name, (w, h)):
                print(f)
            page.close()
        b.close()
