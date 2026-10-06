"""Turns dist/ into a folder the Artifact host can serve.

The host adds its own <html>/<head>/<body>, so those wrappers are removed, and
because it does not serve .glb files the model is also written as base64 JSON
(src/main.js falls back to it automatically).

usage: python3 tools/make-artifact.py <out-dir>
"""
import base64, json, pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
dist = root / 'dist'
out = root / sys.argv[1]
if out.exists():
    shutil.rmtree(out)
(out / 'models').mkdir(parents=True)
# Everything Vite built except the page itself and the .glb (served as JSON below).
for f in dist.rglob('*'):
    rel = f.relative_to(dist)
    if f.is_dir() or rel.as_posix() == 'index.html' or f.suffix == '.glb' or f.name == 'README.txt':
        continue
    (out / rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, out / rel)

html = (dist / 'index.html').read_text()
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*',
            r'<head>\s*', r'</head>\s*', r'<body[^>]*>\s*', r'</body>\s*', r'</html>\s*']:
    html = re.sub(pat, '', html, count=1, flags=re.I)
(out / 'index.html').write_text(html)

glb = (root / 'public' / 'models' / 'teeth.glb').read_bytes()
(out / 'models' / 'teeth.json').write_text(json.dumps({'glb': base64.b64encode(glb).decode()}))
print('wrote', out, sorted(p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_file()))
