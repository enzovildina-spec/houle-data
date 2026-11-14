/* Houle - mode « Conditions » : grille de points Open-Meteo, couleurs, marée, dessin sur la carte */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  /* ---------- grille ---------- */
  const STEPS = [0.0125, 0.025, 0.05, 0.1, 0.125, 0.2, 0.25, 0.5, 1, 2, 5, 10];
  const normLon = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

  /* points d'un réseau régulier qui couvre la zone visible (nœuds « arrondis » : le cache sert quand on déplace la carte) */
  function gridFor(b, nx, maxPts, minStep) {
    const w = Math.max(b.east - b.west, 0.01), hgt = Math.max(b.north - b.south, 0.01);
    const steps = minStep ? STEPS.filter((x) => x >= minStep) : STEPS;
    let si = steps.findIndex((s) => w / s <= nx + 1);
    if (si < 0) si = steps.length - 1;
    for (let k = si; k < steps.length; k++) {
      const step = steps[k];
      const lons = [], lats = [];
      for (let x = Math.ceil((b.west - step / 2) / step) * step; x <= b.east + step / 2 + 1e-9; x += step) lons.push(+x.toFixed(4));
      for (let y = Math.ceil((b.south - step / 2) / step) * step; y <= b.north + step / 2 + 1e-9; y += step) lats.push(+y.toFixed(4));
      const la = lats.filter((y) => y >= -85 && y <= 85);
      if (la.length * lons.length <= (maxPts || 64) || k === steps.length - 1) return { step, lats: la, lons };
    }
    return { step: 10, lats: [], lons: [] };
  }

  /* ---------- données ---------- */
  const qs = (o) => Object.keys(o).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');
  const MARINE_VARS = 'wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,sea_level_height_msl';

  async function getJson(f, url) {
    const res = await f(url);
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) {
      const err = new Error(res.status === 429 ? 'Trop de requêtes vers Open-Meteo : réessaie dans une minute.' : (body && body.reason) || 'Service de prévision indisponible (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return body;
  }
  const asList = (j) => (Array.isArray(j) ? j : j ? [j] : []);

  /* pts : [{lat, lon}] -> enregistrements. opts.marine / opts.wind (vrai par défaut) limitent les appels à ce qui est affiché.
     Les points partent par paquets de 100 ; les deux types d'appel sont indépendants (le vent s'affiche même si la houle échoue). */
  async function fetchPoints(pts, opts) {
    const f = (opts && opts.fetch) || globalThis.fetch.bind(globalThis);
    const wantM = !(opts && opts.marine === false), wantW = !(opts && opts.wind === false), CH = 100;
    const out = [];
    for (let c = 0; c < pts.length; c += CH) {
      const part = pts.slice(c, c + CH);
      const pos = { latitude: part.map((p) => p.lat.toFixed(3)).join(','), longitude: part.map((p) => normLon(p.lon).toFixed(3)).join(','), forecast_days: 4, timezone: 'UTC', timeformat: 'unixtime' };
      const jobs = [
        wantM ? getJson(f, 'https://marine-api.open-meteo.com/v1/marine?' + qs(Object.assign({ hourly: MARINE_VARS, cell_selection: 'sea' }, pos)))
          : Promise.resolve(null),
        wantW ? getJson(f, 'https://api.open-meteo.com/v1/forecast?' + qs(Object.assign({ hourly: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m', wind_speed_unit: 'kmh' }, pos)))
          : Promise.resolve(null),
      ];
      const [m, w] = await Promise.allSettled(jobs);
      const used = [wantM && m, wantW && w].filter(Boolean);
      if (used.length && used.every((r) => r.status === 'rejected')) throw used[0].reason;
      const ml = m.status === 'fulfilled' ? asList(m.value) : [], wl = w.status === 'fulfilled' ? asList(w.value) : [];
      part.forEach((p, i) => out.push(buildRecord(p, ml[i], wl[i])));
    }
    return out;
  }

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const arr = (a, n) => (Array.isArray(a) ? a.map(num) : new Array(n).fill(null));

  function buildRecord(p, m, w) {
    const mh = (m && m.hourly) || {}, wh = (w && w.hourly) || {};
    const t = (mh.time && mh.time.length ? mh.time : wh.time) || [];
    const n = t.length;
    const rec = {
      lat: p.lat, lon: p.lon, t, n,
      wave: arr(mh.wave_height, n), per: arr(mh.wave_period, n), wdir: arr(mh.wave_direction, n),
      sw: arr(mh.swell_wave_height, n), sper: arr(mh.swell_wave_period, n), sdir: arr(mh.swell_wave_direction, n),
      tide: arr(mh.sea_level_height_msl, n), wind: arr(wh.wind_speed_10m, n), gust: arr(wh.wind_gusts_10m, n), wd: arr(wh.wind_direction_10m, n),
      mlat: m && num(m.latitude), mlon: m && num(m.longitude),
    };
    // « mer » : la case de houle renvoyée est proche du point demandé (sinon on est dans les terres)
    const near = rec.mlat != null && rec.mlon != null && Math.hypot(rec.mlat - p.lat, normLon(rec.mlon - p.lon)) <= (p.step ? Math.max(0.3, p.step * 0.8) : 0.3);
    rec.sea = !!near && (rec.wave.some((v) => v != null) || rec.sw.some((v) => v != null));
    return rec;
  }

  /* indice de l'heure demandée dans les données (heures pleines UTC) */
  function hourIndex(rec, atMs) {
    if (!rec || !rec.n) return -1;
    const i = Math.floor((atMs / 1000 - rec.t[0]) / 3600);
    return i < 0 || i >= rec.n ? -1 : i;
  }

  function at(rec, atMs) {
    const i = hourIndex(rec, atMs);
    if (i < 0) return null;
    const useSw = rec.sw[i] != null;
    return {
      i,
      height: useSw ? rec.sw[i] : rec.wave[i], period: useSw ? rec.sper[i] : rec.per[i], dir: useSw ? rec.sdir[i] : rec.wdir[i],
      swell: useSw, wind: rec.wind[i], gust: rec.gust ? rec.gust[i] : null, windDir: rec.wd[i], tide: rec.tide[i],
    };
  }

  /* marée : hauteur, montante ou descendante, prochaine pleine/basse mer (modèle global, ordre de grandeur) */
  function tideInfo(rec, i) {
    const c = rec.tide[i];
    if (c == null) return null;
    const prev = i > 0 ? rec.tide[i - 1] : null, next = i < rec.n - 1 ? rec.tide[i + 1] : null;
    const ref = next != null && prev != null ? next - prev : next != null ? next - c : prev != null ? c - prev : 0;
    const rising = ref >= 0;
    let ext = null;
    for (let k = i + 1; k < rec.n - 1 && k < i + 30; k++) {
      const a = rec.tide[k - 1], b = rec.tide[k], d = rec.tide[k + 1];
      if (a == null || b == null || d == null) break;
      if (rising && b >= a && b > d) { ext = { type: 'high', i: k, h: b }; break; }
      if (!rising && b <= a && b < d) { ext = { type: 'low', i: k, h: b }; break; }
    }
    return { h: c, rising, ext };
  }


  /* ---------- détail d'un point : 7 jours, toutes les heures (tableau façon Windguru) ---------- */
  const power = (h, t) => (h != null && t != null ? 0.49 * h * h * t : null); // kW par mètre de front de vague
  const DMARINE = 'wave_height,wave_period,wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction';
  async function fetchDetail(lat, lon, opts) {
    const f = (opts && opts.fetch) || globalThis.fetch.bind(globalThis);
    const pos = { latitude: lat.toFixed(3), longitude: normLon(lon).toFixed(3), forecast_days: 7, timezone: 'UTC', timeformat: 'unixtime' };
    const [m, w] = await Promise.allSettled([
      getJson(f, 'https://marine-api.open-meteo.com/v1/marine?' + qs(Object.assign({ hourly: DMARINE, cell_selection: 'sea' }, pos))),
      getJson(f, 'https://api.open-meteo.com/v1/forecast?' + qs(Object.assign({ hourly: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m', daily: 'sunrise,sunset', wind_speed_unit: 'kmh' }, pos))),
    ]);
    if (m.status === 'rejected' && w.status === 'rejected') throw w.reason;
    const mj = m.status === 'fulfilled' ? asList(m.value)[0] : null, wj = w.status === 'fulfilled' ? asList(w.value)[0] : null;
    const mh = (mj && mj.hourly) || {}, wh = (wj && wj.hourly) || {};
    const t = (wh.time && wh.time.length ? wh.time : mh.time) || [];
    const n = t.length;
    // les deux séries peuvent avoir des longueurs différentes : on aligne sur l'heure
    const align = (h, a) => {
      if (!h.time || !Array.isArray(a)) return new Array(n).fill(null);
      if (h.time === t || (h.time.length === n && h.time[0] === t[0])) return a.map(num);
      const idx = new Map(h.time.map((x, i) => [x, i]));
      return t.map((x) => (idx.has(x) ? num(a[idx.get(x)]) : null));
    };
    const d = {
      lat, lon, t, n,
      wind: align(wh, wh.wind_speed_10m), gust: align(wh, wh.wind_gusts_10m), wdir: align(wh, wh.wind_direction_10m),
      h: align(mh, mh.wave_height), per: align(mh, mh.wave_period), dir: align(mh, mh.wave_direction),
      sh: align(mh, mh.swell_wave_height), sp: align(mh, mh.swell_wave_period), sd: align(mh, mh.swell_wave_direction),
      s2h: align(mh, mh.secondary_swell_wave_height), s2p: align(mh, mh.secondary_swell_wave_period), s2d: align(mh, mh.secondary_swell_wave_direction),
      wh: align(mh, mh.wind_wave_height), wp: align(mh, mh.wind_wave_period), wd2: align(mh, mh.wind_wave_direction),
      rise: (wj && wj.daily && wj.daily.sunrise) || [], set: (wj && wj.daily && wj.daily.sunset) || [],
    };
    const near = mj && num(mj.latitude) != null && Math.hypot(mj.latitude - lat, normLon(mj.longitude - lon)) <= 0.35;
    d.sea = !!near && d.h.some((v) => v != null);
    // houle principale : la houle de fond si le modèle la fournit, sinon la hauteur totale
    d.main = t.map((_, i) => (d.sh[i] != null ? { h: d.sh[i], t: d.sp[i], d: d.sd[i] } : { h: d.h[i], t: d.per[i], d: d.dir[i] }));
    d.power = d.main.map((x) => power(x.h, x.t));
    return d;
  }

  /* ---------- couleurs ---------- */
  const WIND_STOPS = [[0, [94, 111, 184]], [10, [63, 159, 199]], [20, [54, 183, 154]], [30, [143, 203, 74]], [40, [232, 210, 58]], [55, [242, 154, 46]], [70, [226, 72, 43]], [90, [163, 38, 122]]];
  const WAVE_STOPS = [[0, [28, 58, 188]], [0.5, [38, 112, 222]], [1, [36, 190, 232]], [1.5, [58, 202, 142]], [2, [150, 216, 70]], [3, [246, 226, 58]], [4, [246, 150, 40]], [5.5, [226, 56, 46]], [8, [150, 30, 122]]];
  function ramp(stops, v) {
    if (v <= stops[0][0]) return stops[0][1].slice();
    for (let k = 1; k < stops.length; k++) {
      if (v <= stops[k][0]) {
        const [a, ca] = stops[k - 1], [b, cb] = stops[k], t = (v - a) / (b - a);
        return ca.map((x, j) => Math.round(x + (cb[j] - x) * t));
      }
    }
    return stops[stops.length - 1][1].slice();
  }
  const windColor = (kmh) => ramp(WIND_STOPS, kmh);
  const waveColor = (m) => ramp(WAVE_STOPS, m);
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  H.cond = { power, fetchDetail, STEPS, normLon, gridFor, fetchPoints, buildRecord, hourIndex, at, tideInfo, windColor, waveColor, rgba, WIND_STOPS, WAVE_STOPS };
})();
