"""Titik masuk Hugging Face Space (SDK Gradio, perangkat keras ZeroGPU).
Akun gratis hanya boleh menjalankan Space Gradio di ZeroGPU, jadi aplikasi FastAPI kita dipasang ke gr.Server
(turunan FastAPI) dan satu fungsi GPU kosong ditambahkan sebagai syarat ZeroGPU. GPU tidak pernah dipakai."""
import os

os.environ.setdefault('KG_BACKEND', 'rdflib')  # tanpa GraphDB di Space; hasil penalaran identik

import spaces  # noqa: E402  ZeroGPU: harus diimpor sebelum pustaka lain
from gradio import Server  # noqa: E402

from app import engine, main  # noqa: E402


@spaces.GPU(duration=1)
def _noop():
    """ZeroGPU mewajibkan minimal satu fungsi GPU. Fungsi ini tidak pernah dipanggil."""


engine.infer({'findings': [], 'resources': []}, 'Pemanasan')  # pengganti lifespan FastAPI: muat KB dan aturan sekali

demo = Server(title='Perlu ke IGD? Sistem Pakar Triase IGD', docs_url=None, redoc_url=None)
demo.middleware('http')(main.visitor_key_and_rate_limit)  # kunci pengunjung + batas permintaan per IP
for route in main.app.router.routes:  # semua rute aplikasi: /, /static, /api/*
    if getattr(route, 'path', '') not in ('/openapi.json', '/docs', '/docs/oauth2-redirect', '/redoc'):
        demo.router.routes.append(route)

if __name__ == '__main__':
    demo.launch(ssr_mode=False, server_name='0.0.0.0', server_port=int(os.getenv('PORT', '7860')))
