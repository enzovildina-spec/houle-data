#!/usr/bin/env python3
"""Houle : prépare les données météo mondiales (NOAA GFS + GFS-Wave) pour la carte.

Sortie dans le dossier `site/` (publié par GitHub Pages) :
  meta.json   cycle du modèle, heures de prévision, description des grilles
  wind.bin.gz entiers 16 bits : [pas][u, v, rafales][lat][lon]  (dixièmes de m/s)
  wave.bin.gz entiers 16 bits : [pas][hauteur, période, direction][lat][lon]  (cm, dixièmes de s, degrés)
  pres.json   isobares (tous les 4 hPa) et centres H / L pour chaque pas
Valeur absente (terre pour la houle) = -32768.
Les fichiers GRIB sont lus sur le bucket public AWS de la NOAA, uniquement les messages utiles (requêtes « Range »).
"""
import gzip, json, math, os, sys, tempfile, time
from datetime import datetime, timedelta, timezone

import numpy as np
import requests

BASE = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
OUT = os.environ.get("OUT_DIR", "site")
NODATA = -32768

WIND_HOURS = list(range(0, 73, 3))     # 25 pas
WAVE_HOURS = list(range(0, 73, 6))     # 13 pas
PRES_HOURS = list(range(0, 73, 6))     # 13 pas

# grilles de sortie : (lat de départ, lat de fin, pas, lon de départ, lon de fin, pas)
G_WIND = dict(la0=90.0, la1=-90.0, dla=2.0, lo0=0.0, lo1=358.0, dlo=2.0)
G_WAVE = dict(la0=80.0, la1=-80.0, dla=1.0, lo0=0.0, lo1=359.0, dlo=1.0)
G_PRES = dict(la0=90.0, la1=-90.0, dla=1.0, lo0=0.0, lo1=359.0, dlo=1.0)

S = requests.Session()
S.headers["User-Agent"] = "houle-data/1.0 (github pages)"


def log(*a):
    print(*a, flush=True)


# ---------- accès aux fichiers GRIB (index + plages d'octets) ----------
def urls(day, hh, fff, kind):
    if kind == "atmos":
        return f"{BASE}/gfs.{day}/{hh:02d}/atmos/gfs.t{hh:02d}z.pgrb2.0p25.f{fff:03d}"
    return f"{BASE}/gfs.{day}/{hh:02d}/wave/gridded/gfswave.t{hh:02d}z.global.0p25.f{fff:03d}.grib2"


def get(url, **kw):
    last = None
    for k in range(4):
        try:
            r = S.get(url, timeout=120, **kw)
            if r.status_code in (200, 206, 404):
                return r
            last = RuntimeError(f"HTTP {r.status_code} {url}")
        except requests.RequestException as e:
            last = e
        time.sleep(2 + 3 * k)
    raise last


def parse_idx(text):
    rows = []
    for line in text.strip().splitlines():
        p = line.split(":")
        if len(p) >= 6:
            rows.append(dict(n=int(p[0]), off=int(p[1]), var=p[3], lev=p[4], fc=p[5]))
    return rows


def wanted_ranges(rows, wanted):
    """wanted : liste de (variable, niveau). Renvoie [(début, fin | None, variable)]"""
    out = []
    for i, r in enumerate(rows):
        if (r["var"], r["lev"]) in wanted:
            end = rows[i + 1]["off"] - 1 if i + 1 < len(rows) else None
            out.append((r["off"], end, r["var"]))
    return out


def fetch_messages(url, wanted):
    """Télécharge seulement les messages demandés et renvoie les octets GRIB concaténés."""
    ri = get(url + ".idx")
    if ri.status_code != 200:
        return None
    rng = wanted_ranges(parse_idx(ri.text), wanted)
    if len(rng) < len(wanted):
        return None
    blob, names = b"", []
    for a, b, nm in rng:
        h = {"Range": f"bytes={a}-{b}" if b is not None else f"bytes={a}-"}
        r = get(url, headers=h)
        if r.status_code not in (200, 206):
            return None
        blob += r.content
        names.append(nm)
    return blob, names


def read_fields(blob, names):
    """Décode des octets GRIB -> {variable NOAA (UGRD, GUST…) : (tableau 2D, la1, lo1, dj, di)} (NaN = absent).
    Les messages sont dans l'ordre de `names` (même ordre que l'index)."""
    import eccodes
    out = {}
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as f:
        f.write(blob)
        path = f.name
    try:
        with open(path, "rb") as fh:
            while True:
                gid = eccodes.codes_grib_new_from_file(fh)
                if gid is None:
                    break
                try:
                    name = names[len(out)]
                    ni, nj = eccodes.codes_get(gid, "Ni"), eccodes.codes_get(gid, "Nj")
                    eccodes.codes_set(gid, "missingValue", 1e20)
                    v = eccodes.codes_get_values(gid).reshape(nj, ni).astype("float64")
                    v[v > 1e19] = np.nan
                    la1 = eccodes.codes_get(gid, "latitudeOfFirstGridPointInDegrees")
                    lo1 = eccodes.codes_get(gid, "longitudeOfFirstGridPointInDegrees")
                    di = eccodes.codes_get(gid, "iDirectionIncrementInDegrees")
                    dj = eccodes.codes_get(gid, "jDirectionIncrementInDegrees")
                    if not eccodes.codes_get(gid, "jScansPositively"):
                        dj = -abs(dj)
                    else:
                        dj = abs(dj)
                    out[name] = (v, la1, lo1, dj, di)
                finally:
                    eccodes.codes_release(gid)
    finally:
        os.unlink(path)
    return out


# ---------- changement de grille (plus proche voisin) ----------
def axis(a0, a1, d):
    n = int(round(abs(a1 - a0) / d)) + 1
    return a0 + np.sign(a1 - a0 if a1 != a0 else 1) * d * np.arange(n)


def regrid(field, g):
    v, la1, lo1, dj, di = field
    lats, lons = axis(g["la0"], g["la1"], g["dla"]), axis(g["lo0"], g["lo1"], g["dlo"])
    nj, ni = v.shape
    ii = np.round(((lons - lo1) % 360.0) / di).astype(int) % ni
    jj = np.round((lats - la1) / dj).astype(int)
    ok = (jj >= 0) & (jj < nj)
    jj = np.clip(jj, 0, nj - 1)
    res = v[np.ix_(jj, ii)]
    res[~ok, :] = np.nan
    return res


def q(a, scale):
    out = np.clip(np.round(np.nan_to_num(a * scale, nan=0.0)), -32767, 32767)
    out[~np.isfinite(a)] = NODATA
    return out.astype("<i2")


# ---------- isobares et centres de pression ----------
def isobars(p_hpa, g):
    from scipy.ndimage import gaussian_filter, maximum_filter, minimum_filter
    import contourpy
    lats, lons = axis(g["la0"], g["la1"], g["dla"]), axis(g["lo0"], g["lo1"], g["dlo"])
    z = gaussian_filter(np.nan_to_num(p_hpa, nan=1013.0), sigma=1.6, mode=("nearest", "wrap"))
    zz = np.concatenate([z, z[:, :1]], axis=1)          # la ligne traverse la longitude 0
    xs = np.append(lons, lons[-1] + g["dlo"])
    cg = contourpy.contour_generator(xs, lats, zz)
    levels = []
    for lv in range(940, 1065, 4):
        segs = []
        for line in cg.lines(float(lv)):
            if len(line) < 4:
                continue
            line = line[::2] if len(line) > 40 else line
            segs.append([round(float(c), 1) for c in line.reshape(-1)])
        if segs:
            levels.append({"p": lv, "l": segs})
    hl = []
    size = (23, 23)
    mx = maximum_filter(z, size=size, mode=("nearest", "wrap"))
    mn = minimum_filter(z, size=size, mode=("nearest", "wrap"))
    for (kind, arr, cond) in (("H", mx, lambda v: v >= 1018), ("L", mn, lambda v: v <= 1008)):
        ys, xs_ = np.where((z == arr) & cond(z) & (np.abs(lats)[:, None] < 78))
        for y, x in zip(ys, xs_):
            hl.append([round(float(lons[x]), 1), round(float(lats[y]), 1), kind, int(round(float(z[y, x])))])
    return {"iso": levels, "hl": hl}


# ---------- choix du cycle du modèle ----------
def pick_cycle(now=None):
    now = now or datetime.now(timezone.utc)
    base = now.replace(minute=0, second=0, microsecond=0)
    base -= timedelta(hours=base.hour % 6)
    for k in range(0, 6):
        c = base - timedelta(hours=6 * k)
        day, hh = c.strftime("%Y%m%d"), c.hour
        last_a = urls(day, hh, WIND_HOURS[-1], "atmos") + ".idx"
        last_w = urls(day, hh, WAVE_HOURS[-1], "wave") + ".idx"
        if get(last_a).status_code == 200 and get(last_w).status_code == 200:
            return c
    raise SystemExit("Aucun cycle GFS complet trouvé")


def main():
    os.makedirs(OUT, exist_ok=True)
    cyc = pick_cycle()
    day, hh = cyc.strftime("%Y%m%d"), cyc.hour
    log("cycle", day, hh)
    t0 = int(cyc.timestamp())

    wind, gust_missing = [], 0
    pres_steps = {}
    for f in sorted(set(WIND_HOURS) | set(PRES_HOURS)):
        want = {("UGRD", "10 m above ground"), ("VGRD", "10 m above ground"), ("GUST", "surface"), ("PRMSL", "mean sea level")}
        got = fetch_messages(urls(day, hh, f, "atmos"), want)
        if got is None:
            raise SystemExit(f"messages atmosphère manquants pour f{f:03d}")
        fl = read_fields(*got)
        if f in WIND_HOURS:
            u, v, gu = regrid(fl["UGRD"], G_WIND), regrid(fl["VGRD"], G_WIND), regrid(fl["GUST"], G_WIND)
            wind.append(np.stack([q(u, 10), q(v, 10), q(gu, 10)]))
        if f in PRES_HOURS:
            p = regrid(fl["PRMSL"], G_PRES) / 100.0
            pres_steps[f] = isobars(p, G_PRES)
        log("atmos", f)
    wave = []
    for f in WAVE_HOURS:
        want = {("HTSGW", "surface"), ("PERPW", "surface"), ("DIRPW", "surface")}
        got = fetch_messages(urls(day, hh, f, "wave"), want)
        if got is None:
            raise SystemExit(f"messages houle manquants pour f{f:03d}")
        fl = read_fields(*got)
        wave.append(np.stack([q(regrid(fl["HTSGW"], G_WAVE), 100), q(regrid(fl["PERPW"], G_WAVE), 10), q(regrid(fl["DIRPW"], G_WAVE), 1)]))
        log("wave", f)

    def dump(name, steps):
        arr = np.stack(steps)
        with gzip.open(os.path.join(OUT, name), "wb", compresslevel=9) as fh:
            fh.write(arr.tobytes())
        return list(arr.shape)

    def grid_info(g):
        la, lo = axis(g["la0"], g["la1"], g["dla"]), axis(g["lo0"], g["lo1"], g["dlo"])
        return dict(la0=g["la0"], dla=-g["dla"] if g["la1"] < g["la0"] else g["dla"], ny=len(la), lo0=g["lo0"], dlo=g["dlo"], nx=len(lo))

    meta = dict(
        model="NOAA GFS + GFS-Wave", cycle=cyc.strftime("%Y-%m-%dT%H:00:00Z"), t0=t0,
        generated=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        wind=dict(file="wind.bin.gz", hours=WIND_HOURS, vars=["u", "v", "gust"], scale=[10, 10, 10], shape=dump("wind.bin.gz", wind), **grid_info(G_WIND)),
        wave=dict(file="wave.bin.gz", hours=WAVE_HOURS, vars=["hs", "tp", "dir"], scale=[100, 10, 1], shape=dump("wave.bin.gz", wave), **grid_info(G_WAVE)),
        pres=dict(file="pres.json", hours=PRES_HOURS),
        nodata=NODATA,
    )
    with open(os.path.join(OUT, "pres.json"), "w") as fh:
        json.dump({"hours": PRES_HOURS, "steps": [pres_steps[f] for f in PRES_HOURS]}, fh, separators=(",", ":"))
    with open(os.path.join(OUT, "meta.json"), "w") as fh:
        json.dump(meta, fh, separators=(",", ":"))
    with open(os.path.join(OUT, "index.html"), "w") as fh:
        fh.write("<!doctype html><meta charset=utf-8><title>houle-data</title><p>Données météo pour l'appli Houle. Cycle " + meta["cycle"] + ". <a href=meta.json>meta.json</a>")
    log("terminé", {k: os.path.getsize(os.path.join(OUT, k)) for k in os.listdir(OUT)})


if __name__ == "__main__":
    main()
