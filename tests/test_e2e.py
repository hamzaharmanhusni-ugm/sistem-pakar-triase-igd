"""Uji end-to-end dengan Playwright: server asli dijalankan, browser mengisi alur "Perlu ke IGD?" seperti pasien."""
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
PORT = 8765


@pytest.fixture(scope='module')
def server():
    env = {**os.environ, 'LLM_ENABLED': '0'}
    p = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', str(PORT)], cwd=ROOT, env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f'http://127.0.0.1:{PORT}'
    for _ in range(60):
        try:
            urllib.request.urlopen(url + '/api/health', timeout=2)
            break
        except Exception:
            time.sleep(0.5)
    yield url
    p.terminate()


def start(page, url, age, who='Saya sendiri', unit='tahun', width=1440):
    page.set_viewport_size({'width': width, 'height': 900})
    page.goto(url)
    assert page.locator('#next').is_disabled()  # wajib memilih siapa yang sakit
    page.click(f'text={who}')
    page.click('text=Mulai cek')
    page.fill('#age', age)
    if unit != 'tahun':
        page.click(f'.seg button:text-is("{unit}")')
    page.click('[data-act=next]')


def test_child_fever_tachycardia_gets_esi2_with_plain_reasons(server, page):
    start(page, server, '2', who='Anak saya')
    page.click('[data-act=dangerNone]')
    page.click('[data-act=next]')
    page.click('text=Demam')
    page.click('text=Batuk atau pilek')
    page.click('[data-act=next]')
    page.click('[data-act=pain][data-v="4"]')  # balita: skala perilaku
    page.click('[data-act=next]')
    page.fill('[data-m=temp]', '39,4')
    page.fill('[data-m=hr]', '170')
    page.click('[data-act=finish]')
    page.locator('.verdict').wait_for()
    assert 'Tingkat 2' in page.locator('.level').inner_text()
    assert 'Segera ke IGD' in page.locator('.verdict h1').inner_text()
    reasons = page.locator('.reasons').inner_text()
    assert 'Denyut nadi 170' in reasons and 'Demam 39,4' in reasons
    for jargon in ['SPARQL', 'ESI', 'DZ_', 'resource', 'MC-MED']:
        assert jargon not in reasons  # bahasa awam, tanpa istilah teknis
    assert 'Anak' in page.locator('.handover').inner_text()
    # panel cara berpikir untuk presentasi
    page.locator('.side [data-act=think]').click()
    assert page.locator('#mind').is_visible()
    page.click('[data-pane=m-trace]')
    for rid in ['C00', 'C01', 'D01', 'E01', 'Z01']:
        assert page.locator(f'#ledger details.rule[data-rule={rid}]').count() >= 1
    e01 = page.locator('#ledger details.rule[data-rule=E01]')
    e01.locator('summary').first.click()
    e01.locator('details.deep summary').click()
    assert 'INSERT' in e01.locator('pre.code').inner_text()
    page.click('[data-pane=m-cycle]')
    assert 'titik tetap' in page.locator('#timeline').inner_text().lower()


def test_danger_sign_short_circuits_to_esi1(server, page):
    start(page, server, '70')
    page.click('text=Tidak bernapas, atau napasnya megap-megap')
    page.click('text=Lanjut ke hasil')
    page.locator('.verdict').wait_for()
    assert 'Tingkat 1' in page.locator('.level').inner_text()
    assert page.locator('.verdict a[href="tel:119"]').count() == 1


def test_minor_complaint_goes_to_clinic(server, page):
    start(page, server, '30')
    page.click('[data-act=dangerNone]')
    page.click('[data-act=next]')
    page.click('text=Gatal atau ruam')
    page.click('[data-act=next]')
    page.click('[data-act=pain][data-v="1"]')
    page.click('[data-act=next]')
    page.click('text=Lewati, belum mengukur')
    page.locator('.verdict').wait_for()
    assert 'Tingkat 5' in page.locator('.level').inner_text()
    assert 'klinik' in page.locator('.verdict').inner_text()


def test_free_text_complaint_is_recognised(server, page):
    start(page, server, '45')
    page.click('[data-act=dangerNone]')
    page.click('[data-act=next]')
    page.fill('#own', 'dada terasa sakit dan bicara pelo sejak tadi')
    page.click('text=Kenali')
    page.locator('#found', has_text='Dikenali').wait_for()
    assert page.locator('.chip[aria-pressed=true]').count() >= 1


def test_mobile_layout_no_horizontal_scroll(server, page):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(server)
    page.click('text=Anak saya')
    page.click('text=Mulai cek')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')


def test_self_report_requires_plausible_age(server, page):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(server)
    page.click('text=Saya sendiri')
    page.click('text=Mulai cek')
    assert page.locator('.seg button').count() == 1  # hanya satuan tahun
    page.fill('#age', '2')
    assert page.locator('#next').is_disabled()
    assert 'Anak saya' in page.locator('#age-hint').inner_text()
    page.fill('#age', '25')
    assert page.locator('#next').is_enabled()
