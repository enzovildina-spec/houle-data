"""Test de scripts/build_coast.py avec un petit shapefile synthétique (une île carrée à cheval sur 2 cases, avec un lac)."""
import json, os, struct, sys, tempfile
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import build_coast as B

def poly_rec(num, rings):
    pts = [p for r in rings for p in r]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    parts = []; i = 0
    for r in rings: parts.append(i); i += len(r)
    body = struct.pack('<i4d2i', 5, min(xs), min(ys), max(xs), max(ys), len(rings), len(pts)) + struct.pack('<%di' % len(parts), *parts)
    for x, y in pts: body += struct.pack('<2d', x, y)
    return struct.pack('>2i', num, len(body) // 2) + body

d = tempfile.mkdtemp(); shp = os.path.join(d, 'l.shp')
outer = [(-4.9, 48.1), (-4.9, 48.9), (-3.9, 48.9), (-3.9, 48.1), (-4.9, 48.1)]  # à cheval sur les cases lon -5 et -4
lake = [(-4.5, 48.4), (-4.4, 48.4), (-4.4, 48.5), (-4.5, 48.5), (-4.5, 48.4)]
recs = poly_rec(1, [outer, lake]) + poly_rec(2, [[(100, 10), (100, 11), (101, 11), (100, 10)]])
open(shp, 'wb').write(b'\0' * 100 + recs)
cells = {(48, -5), (48, -4), (49, -5), (47, -5)}
seen, n = B.build(shp, os.path.join(d, 'out'), regions_cells=cells)
idx = json.load(open(os.path.join(d, 'out', 'index.json')))
assert seen == 1 and n == 2, (seen, n)
assert idx['cells'] == {'47,-5': 0, '48,-5': 1, '48,-4': 1, '49,-5': 0}, idx['cells']
t = json.load(open(os.path.join(d, 'out', 'c_48_-5.json')))
assert t['o'] == [48, -5] and len(t['p']) == 1 and len(t['p'][0]) == 2, 'terre + lac'
xs = t['p'][0][0][0::2]; assert max(xs) == 100000 and min(xs) == 10000, (min(xs), max(xs))  # bord est de la case, île commence à -4.9
# simplification : un anneau très bruité de 1 mètre de large garde peu de points
import numpy as np
pts = np.array([(i * 1e-4, 1e-6 * (i % 2)) for i in range(1000)])
assert len(B.dp(pts, 0.0003)) <= 3
print('ok  trait de côte : tuiles, lac, index, simplification')
