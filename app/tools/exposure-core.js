/* Houle - calcul d'exposition d'un spot à partir d'un trait de côte (CommonJS, utilisé hors de l'appli)
   Entrée : des anneaux [[lon,lat],...] de TERRES (Natural Earth, domaine public). Sortie par spot :
   o = fenêtre de houle [de, à] (directions d'où vient la houle), w = vent offshore [de, à], f = distance libre (km) par tranche de 10°. */
'use strict';
const STEP = 5;          // un rayon tous les 5°
const START_KM = 2;      // on démarre 2 km au large (le spot est sur la plage, pas en mer)
const MAX_KM = 300;      // distance maximale regardée
const OPEN_KM = 80;      // une direction est « ouverte » si rien ne gêne sur au moins 80 km
const CLOSED_KM = 15;    // « fermée » (terre proche) sous 15 km
const mod = (a) => ((a % 360) + 360) % 360;

function segmentsOf(rings) {
  const out = [];
  for (const r of rings) for (let i = 0; i + 1 < r.length; i++) out.push(r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]);
  return Float64Array.from(out);
}

/* point sur la terre ? (parité, rayon vers l'est) sur une liste de segments à plat */
function isLand(seg, px, py) {
  let inside = false;
  for (let i = 0; i < seg.length; i += 4) {
    const x1 = seg[i], y1 = seg[i + 1], x2 = seg[i + 2], y2 = seg[i + 3];
    if ((y1 > py) === (y2 > py)) continue;
    if (px < x1 + ((py - y1) / (y2 - y1)) * (x2 - x1)) inside = !inside;
  }
  return inside;
}

/* extrait les segments qui touchent un cadre (en degrés) */
function near(seg, lat, lon, dLat, dLon) {
  const out = [];
  for (let i = 0; i < seg.length; i += 4) {
    const a = seg[i], b = seg[i + 1], c = seg[i + 2], d = seg[i + 3];
    if (Math.max(b, d) < lat - dLat || Math.min(b, d) > lat + dLat || Math.max(a, c) < lon - dLon || Math.min(a, c) > lon + dLon) continue;
    out.push(a, b, c, d);
  }
  return Float64Array.from(out);
}

function largestRun(flags) { // flags circulaire ; renvoie {start, len} de la plus longue suite de true
  const n = flags.length;
  if (flags.every(Boolean)) return { start: 0, len: n, all: true };
  let best = { start: 0, len: 0 };
  for (let s = 0; s < n; s++) {
    if (!flags[s] || flags[(s - 1 + n) % n]) continue;
    let l = 0;
    while (l < n && flags[(s + l) % n]) l++;
    if (l > best.len) best = { start: s, len: l };
  }
  return best;
}

function computeExposure(seg, lat, lon) {
  const band = near(seg, lat, lon, 0.1, 360); // même latitude, pour le test terre/mer
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 110.57;
  const loc = near(seg, lat, lon, MAX_KM / ky + 0.2, MAX_KM / kx + 0.2);
  const lat0 = lat; const lon0 = lon;
  const free = [];
  for (let az = 0; az < 360; az += STEP) {
    const dx = Math.sin((az * Math.PI) / 180), dy = Math.cos((az * Math.PI) / 180);
    const sx = lon0 + (START_KM * dx) / kx, sy = lat0 + (START_KM * dy) / ky;
    if (isLand(band, sx, sy)) { free.push(0); continue; }
    let best = MAX_KM;
    for (let i = 0; i < loc.length; i += 4) {
      // intersection rayon / segment en km locaux
      const x1 = (loc[i] - lon0) * kx, y1 = (loc[i + 1] - lat0) * ky, x2 = (loc[i + 2] - lon0) * kx, y2 = (loc[i + 3] - lat0) * ky;
      const ex = x2 - x1, ey = y2 - y1;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den;
      const u = (x1 * dy - y1 * dx) / den;
      if (t > START_KM && t < best && u >= 0 && u <= 1) best = t;
    }
    free.push(Math.round(best));
  }
  return summarize(free);
}

function summarize(free) {
  const n = free.length;
  // fenêtre de houle : on comble les trous d'un seul rayon (petite île, pointe)
  let open = free.map((v) => v >= OPEN_KM);
  const bridged = open.map((v, i) => v || (open[(i - 1 + n) % n] && open[(i + 1) % n]));
  const run = largestRun(bridged);
  let o = null;
  if (run.all) o = [0, 360];
  else if (run.len > 0) o = [mod(run.start * STEP), mod((run.start + run.len - 1) * STEP)];
  // vent offshore : centre de la plus grande zone de terre proche, ±50°
  const closed = free.map((v) => v < CLOSED_KM);
  const cr = largestRun(closed);
  let w = null;
  if (cr.len > 0 && !cr.all) {
    const c = (cr.start + (cr.len - 1) / 2) * STEP;
    w = [mod(Math.round(c - 50)), mod(Math.round(c + 50))];
  }
  const f = [];
  for (let b = 0; b < 36; b++) f.push(Math.min(free[(b * 2) % n], free[(b * 2 + 1) % n]));
  return { o, w, f, width: run.all ? 360 : run.len * STEP };
}

function ringsFromGeoJSON(gj) {
  const rings = [];
  const geom = (g) => {
    if (!g) return;
    if (g.type === 'Polygon') g.coordinates.forEach((r) => rings.push(r));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => rings.push(r)));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(geom);
  };
  if (gj.type === 'FeatureCollection') gj.features.forEach((f) => geom(f.geometry));
  else if (gj.type === 'Feature') geom(gj.geometry);
  else geom(gj);
  return rings;
}

const key = (lat, lon) => lat.toFixed(4) + ',' + lon.toFixed(4);
module.exports = { computeExposure, segmentsOf, ringsFromGeoJSON, isLand, summarize, key, STEP };
