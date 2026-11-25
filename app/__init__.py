"""Paket aplikasi. Memuat .env di akar proyek (bila ada) sebelum modul lain membaca variabel lingkungan.
Variabel yang sudah diset di sistem tidak ditimpa; nilai kosong diabaikan."""
import os
from pathlib import Path

_ENV = Path(__file__).resolve().parent.parent / '.env'
if _ENV.exists():  # ponytail: pembaca KEY=VALUE sederhana; pakai python-dotenv bila butuh sintaks lengkap
    for _line in _ENV.read_text(encoding='utf-8').splitlines():
        _k, _sep, _v = _line.strip().partition('=')
        _v = _v.strip().strip('"\'')
        if _sep and _k and not _k.startswith('#') and _v:
            os.environ.setdefault(_k.strip(), _v)
