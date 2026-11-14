#!/usr/bin/env python3
"""Houle - construit des tuiles de trait de côte précises (~30 m) à partir des « land polygons » d'OpenStreetMap.

Usage : python3 scripts/build_coast.py land_polygons.shp dossier_sortie
Sans dépendance (numpy seulement). Le shapefile est lu à la main (type Polygon).
Sortie : dossier_sortie/index.json  = {"v":1,"cell":1,"cells":{"lat,lon":1|0}}  (1 = terre dans la case, 0 = eau seule)
         dossier_sortie/c_<lat>_<lon>.json = {"o":[lat,lon],"p":[[ [x,y,x,y,…], … ], …]}
         coordonnées entières : (valeur / 100000) degrés à partir de l'angle sud-ouest de la case de 1°.
Données © contributeurs OpenStreetMap (ODbL) ; à citer dans l'appli.
"""
import json, math, os, struct, sys
import numpy as np

# zones couvertes : (lat_min, lat_max, lon_min, lon_max) en degrés entiers (cases de 1°)
REGIONS = [
    (36, 55, -11, 10),   # Europe de l'Ouest : Portugal, Espagne, France, îles Britanniques, Benelux
    (15, 17, -62, -60),  # Guadeloupe
    (-7, -3, 102, 106),  # Sumatra sud-ouest (Krui)
]
TOL = 0.0003        # ≈ 30 m
SCALE = 100000


def region_cells():
    cells = set()
    for a, b, c, d in REGIONS:
        for la in range(a, b):
            for lo in range(c, d):
                cells.add((la, lo))
    return cells


def read_shp(path):
    """Génère (bbox, [anneaux numpy (n,2)]) pour chaque polygone du shapefile."""
    buf = np.memmap(path, dtype=np.uint8, mode='r')
    data = memoryview(buf)
    pos, n = 100, len(buf)
    while pos + 8 <= n:
        clen = struct.unpack('>i', data[pos + 4:pos + 8])[0] * 2
        c = pos + 8
        st = struct.unpack('<i', data[c:c + 4])[0]
        if st == 5:
            bbox = struct.unpack('<4d', data[c + 4:c + 36])
            nparts, npts = struct.unpack('<2i', data[c + 36:c + 44])
            parts = list(struct.unpack('<%di' % nparts, data[c + 44:c + 44 + 4 * nparts])) + [npts]
            off = c + 44 + 4 * nparts
            yield bbox, (parts, off, npts, data)
        pos = c + clen


def rings_of(rec):
    parts, off, npts, data = rec
    pts = np.frombuffer(data[off:off + 16 * npts], dtype='<f8').reshape(-1, 2)
    return [pts[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]


def dp(pts, tol):
    """Douglas-Peucker itératif (numpy). Garde le premier et le dernier point."""
    n = len(pts)
    if n < 3:
        return pts
    keep = np.zeros(n, dtype=bool); keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b, seg = pts[i], pts[j], pts[i + 1:j]
        d = b - a
        L = math.hypot(d[0], d[1])
        if L == 0:
            dist = np.hypot(seg[:, 0] - a[0], seg[:, 1] - a[1])
        else:
            dist = np.abs(d[0] * (seg[:, 1] - a[1]) - d[1] * (seg[:, 0] - a[0])) / L
        k = int(np.argmax(dist))
        if dist[k] > tol:
            m = i + 1 + k
            keep[m] = True
            stack.append((i, m)); stack.append((m, j))
    return pts[keep]


def clip_ring(poly, x0, y0, x1, y1):
    """Sutherland-Hodgman : découpe un anneau (liste de (x,y)) dans un rectangle."""
    def run(pts, inside, inter):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out
    def ix(xc):
        return lambda p, q: (xc, p[1] + (q[1] - p[1]) * (xc - p[0]) / (q[0] - p[0]))
    def iy(yc):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (yc - p[1]) / (q[1] - p[1]), yc)
    pts = poly
    pts = run(pts, lambda p: p[0] >= x0, ix(x0))
    pts = run(pts, lambda p: p[0] <= x1, ix(x1))
    pts = run(pts, lambda p: p[1] >= y0, iy(y0))
    pts = run(pts, lambda p: p[1] <= y1, iy(y1))
    return pts


def build(shp, outdir, regions_cells=None, tol=TOL):
    cells = regions_cells if regions_cells is not None else region_cells()
    la0 = min(c[0] for c in cells); la1 = max(c[0] for c in cells) + 1
    lo0 = min(c[1] for c in cells); lo1 = max(c[1] for c in cells) + 1
    tiles = {}
    seen = 0
    for bbox, rec in read_shp(shp):
        if bbox[2] < lo0 or bbox[0] > lo1 or bbox[3] < la0 or bbox[1] > la1:
            continue
        rings = [dp(r, tol) for r in rings_of(rec)]
        rings = [r for r in rings if len(r) >= 4]
        if not rings:
            continue
        xs0, xs1 = min(r[:, 0].min() for r in rings), max(r[:, 0].max() for r in rings)
        ys0, ys1 = min(r[:, 1].min() for r in rings), max(r[:, 1].max() for r in rings)
        for la in range(math.floor(ys0), math.floor(ys1) + 1):
            for lo in range(math.floor(xs0), math.floor(xs1) + 1):
                if (la, lo) not in cells:
                    continue
                out = []
                for r in rings:
                    c = clip_ring([(float(x), float(y)) for x, y in r[:-1]], lo, la, lo + 1, la + 1)
                    if len(c) >= 3:
                        flat = []
                        for x, y in c:
                            flat += [int(round((x - lo) * SCALE)), int(round((y - la) * SCALE))]
                        out.append(flat)
                if out:
                    tiles.setdefault((la, lo), []).append(out)
        seen += 1
    os.makedirs(outdir, exist_ok=True)
    index = {}
    for (la, lo) in sorted(cells):
        has = (la, lo) in tiles
        index['%d,%d' % (la, lo)] = 1 if has else 0
        if has:
            with open(os.path.join(outdir, 'c_%d_%d.json' % (la, lo)), 'w') as f:
                json.dump({'o': [la, lo], 'p': tiles[(la, lo)]}, f, separators=(',', ':'))
    with open(os.path.join(outdir, 'index.json'), 'w') as f:
        json.dump({'v': 1, 'cell': 1, 'scale': SCALE, 'src': "© contributeurs OpenStreetMap (ODbL), land polygons", 'cells': index}, f, separators=(',', ':'))
    return seen, len(tiles)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('Usage : build_coast.py land_polygons.shp dossier_sortie')
    s, t = build(sys.argv[1], sys.argv[2])
    print(s, 'polygones utilisés,', t, 'cases avec de la terre')
