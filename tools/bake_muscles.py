#!/usr/bin/env python3
"""Serve the app folder and accept the images rendered by tools/bake-muscles.html.

    python3 tools/bake_muscles.py            # then open http://localhost:8010/tools/bake-muscles.html
    python3 tools/bake_muscles.py --root DIR # serve and save into a copy of the folder instead

Only needed when the model, the muscle groups or the status colours (reports/palette.js) change.
Files are written to <root>/assets/muscles/. Only PUTs under /save/assets/muscles/ are accepted.
"""
import argparse, functools, http.server, os, re

ap = argparse.ArgumentParser()
ap.add_argument('--root', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ap.add_argument('--port', type=int, default=8010)
a = ap.parse_args()
ROOT = os.path.abspath(a.root)
SAFE = re.compile(r'^/save/assets/muscles/([a-z-]+-[a-z]+\.webp)$')


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.glb': 'model/gltf-binary', '.js': 'text/javascript'}

    def do_PUT(self):
        m = SAFE.match(self.path)
        if not m:
            self.send_error(403); return
        data = self.rfile.read(int(self.headers['Content-Length']))
        os.makedirs(os.path.join(ROOT, 'assets', 'muscles'), exist_ok=True)
        with open(os.path.join(ROOT, 'assets', 'muscles', m.group(1)), 'wb') as f:
            f.write(data)
        self.send_response(204); self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


print(f'Serving {ROOT} on http://localhost:{a.port}/tools/bake-muscles.html')
http.server.ThreadingHTTPServer(('127.0.0.1', a.port), functools.partial(H, directory=ROOT)).serve_forever()
