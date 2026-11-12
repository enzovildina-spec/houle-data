/* Houle - données mondiales préparées par GitHub (NOAA GFS + GFS-Wave) : vent, rafales, houle, isobares */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const DEFAULT_URL = 'https://enzovildina-spec.github.io/houle-data/';
  const G = (H.global = { ready: false, state: '', meta: null, wind: null, wave: null, pres: null, url: DEFAULT_URL });

  const rad = Math.PI / 180;
  const norm360 = (x) => ((x % 360) + 360) % 360;

  async function readGz(url, fetchFn) {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
    if (typeof DecompressionStream === 'undefined') throw new Error('Navigateur trop ancien (DecompressionStream)');
    const ds = res.body.pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(ds).arrayBuffer();
    return new Int16Array(buf);
  }

  /* charge meta.json, les deux grilles et les isobares ; opts.fetch / opts.url pour les tests */
  G.load = async function (opts) {
    if (G.state === 'loading' || G.ready) return G.ready;
    const f = (opts && opts.fetch) || globalThis.fetch.bind(globalThis);
    const cfg = globalThis.HOULE_CONFIG || {};
    G.url = ((opts && opts.url) || cfg.dataUrl || DEFAULT_URL).replace(/\/?$/, '/');
    G.state = 'loading';
    try {
      const mr = await f(G.url + 'meta.json?_=' + Math.floor(Date.now() / 600000));
      if (!mr.ok) throw new Error('HTTP ' + mr.status);
      const meta = await mr.json();
      const [wind, wave, pr] = await Promise.all([
        readGz(G.url + meta.wind.file, f), readGz(G.url + meta.wave.file, f),
        f(G.url + meta.pres.file).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      G.meta = meta; G.wind = wind; G.wave = wave; G.pres = pr;
      G.ready = true; G.state = 'ok';
    } catch (e) {
      G.state = 'fail'; G.error = e.message;
    }
    return G.ready;
  };

  /* valeur lissée à (lat, lon) dans une grille [pas][variable][ny][nx] ; ignore les cases sans donnée.
     renvoie {v, w} : valeur et poids total (1 = les 4 cases valides) */
  function spatial(arr, info, nvar, s, v, lat, lon, ND, fn) {
    const fi = (lat - info.la0) / info.dla, fj = norm360(lon - info.lo0) / info.dlo;
    if (fi < -0.5 || fi > info.ny - 0.5) return null;
    const i0 = Math.max(0, Math.min(info.ny - 2, Math.floor(fi))), ty = Math.max(0, Math.min(1, fi - i0));
    const j0 = Math.floor(fj), tx = fj - j0, nx = info.nx;
    const base = (s * nvar + v) * info.ny * nx;
    let sum = 0, wsum = 0;
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
      const val = arr[base + (i0 + a) * nx + ((j0 + c) % nx)], wt = (a ? ty : 1 - ty) * (c ? tx : 1 - tx);
      if (val !== ND && wt > 0) { sum += (fn ? fn(val) : val) * wt; wsum += wt; }
    }
    return wsum ? { v: sum / wsum, w: wsum } : null;
  }

  /* un enregistrement horaire (comme Open-Meteo) pour chaque nœud : lat/lon -> rec compatible avec Houle.cond.at() */
  G.records = function (pts) {
    const m = G.meta, ND = m.nodata, W = m.wind, V = m.wave;
    const N = W.hours[W.hours.length - 1] + 1, t = Array.from({ length: N }, (_, i) => m.t0 + i * 3600);
    const lerpAt = (series, hours, h, f) => {
      let k = 0;
      while (k < hours.length - 2 && h >= hours[k + 1]) k++;
      const a = series[k], b = series[k + 1];
      if (a == null || b == null) return a != null ? a : b != null ? b : null;
      return f ? f(a, b, (h - hours[k]) / (hours[k + 1] - hours[k])) : a + (b - a) * ((h - hours[k]) / (hours[k + 1] - hours[k]));
    };
    return pts.map((p) => {
      const us = [], vs = [], gs = [], hs = [], tp = [], ds = [], dc = [];
      W.hours.forEach((_, s) => {
        const u = spatial(G.wind, W, 3, s, 0, p.lat, p.lon, ND), v = spatial(G.wind, W, 3, s, 1, p.lat, p.lon, ND), g = spatial(G.wind, W, 3, s, 2, p.lat, p.lon, ND);
        us.push(u ? u.v / W.scale[0] : null); vs.push(v ? v.v / W.scale[1] : null); gs.push(g ? g.v / W.scale[2] : null);
      });
      let seaW = 0;
      V.hours.forEach((_, s) => {
        const h = spatial(G.wave, V, 3, s, 0, p.lat, p.lon, ND), pe = spatial(G.wave, V, 3, s, 1, p.lat, p.lon, ND);
        const d = spatial(G.wave, V, 3, s, 2, p.lat, p.lon, ND, (x) => Math.sin(x * rad)), d2 = spatial(G.wave, V, 3, s, 2, p.lat, p.lon, ND, (x) => Math.cos(x * rad));
        hs.push(h ? h.v / V.scale[0] : null); tp.push(pe ? pe.v / V.scale[1] : null);
        ds.push(d && d2 ? d.v : null); dc.push(d && d2 ? d2.v : null);
        if (s === 0) seaW = h ? h.w : 0;
      });
      const n = N, rec = { lat: p.lat, lon: p.lon, t, n, sea: seaW >= 0.5 && hs.some((x) => x != null), global: true };
      const nulls = () => new Array(n).fill(null);
      rec.wind = nulls(); rec.gust = nulls(); rec.wd = nulls(); rec.wave = nulls(); rec.per = nulls(); rec.wdir = nulls();
      rec.sw = nulls(); rec.sper = nulls(); rec.sdir = nulls(); rec.tide = nulls();
      for (let h = 0; h < n; h++) {
        const u = lerpAt(us, W.hours, h), v = lerpAt(vs, W.hours, h), g = lerpAt(gs, W.hours, h);
        if (u != null && v != null) { rec.wind[h] = Math.hypot(u, v) * 3.6; rec.wd[h] = norm360(270 - Math.atan2(v, u) / rad); }
        if (g != null) rec.gust[h] = g * 3.6;
        if (rec.sea) {
          const hv = lerpAt(hs, V.hours, h), pv = lerpAt(tp, V.hours, h), sv = lerpAt(ds, V.hours, h), cv = lerpAt(dc, V.hours, h);
          rec.wave[h] = hv; rec.per[h] = pv;
          if (sv != null && cv != null) rec.wdir[h] = norm360(Math.atan2(sv, cv) / rad);
        }
      }
      return rec;
    });
  };

  /* isobares du pas le plus proche de l'instant demandé (ms) */
  G.pressureAt = function (ms) {
    if (!G.ready || !G.pres || !G.pres.steps.length) return null;
    const hrs = (ms / 1000 - G.meta.t0) / 3600, hours = G.pres.hours;
    let best = 0;
    hours.forEach((h, i) => { if (Math.abs(h - hrs) < Math.abs(hours[best] - hrs)) best = i; });
    return G.pres.steps[best];
  };

  G.cycleLabel = () => (G.meta ? new Date(G.meta.cycle).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
})();
