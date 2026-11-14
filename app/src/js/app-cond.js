/* Houle - mode « Conditions » : vent animé (façon Windy) ou houle (façon Windguru), un seul à la fois ; clic = tableau heure par heure */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, K = H.cond;
  const esc = U.esc;
  const $ = (s) => document.querySelector(s);

  const C = (A.cond = {
    active: false, view: 'wind', pressure: true, source: '', res: '5', offset: 0, maxOffset: 48,
    grid: null, cacheW: new Map(), cacheM: new Map(), token: 0, status: '', loading: false, timer: 0,
    canvas: null, ctx: null, pcv: null, pctx: null, work: null, land: null, landState: '', vec: null, raf: 0, parts: [], det: null, dtoken: 0,
  });
  const TTL = 30 * 60 * 1000;
  /* unité des hauteurs dans le tableau : mètres ou pieds (choix gardé sur l'appareil) */
  const FT = 3.28084;
  let unit = 'm';
  try { if (localStorage.getItem('houle.unit') === 'ft') unit = 'ft'; } catch (e) { /* pas de stockage : mètres */ }
  const hv = (m) => (m == null ? '–' : unit === 'ft' ? String(Math.round(m * FT)) : m.toFixed(1));
  const hUnit = () => (unit === 'ft' ? 'pieds' : 'mètres');
  /* définitions courtes, affichées en touchant le nom d'une ligne */
  const DEFS = {
    tide: ['Marée (niveau)', 'Hauteur de la mer par rapport au niveau moyen, en mètres, d\'après un modèle mondial (cases d\'environ 8 km). C\'est un ordre de grandeur : près des côtes, l\'amplitude réelle et les heures de pleine et basse mer peuvent différer de la marée officielle (SHOM). Pour te décider, croise avec ton annuaire des marées habituel.'],
    power: ['Puissance (kW/m)', 'Puissance de la houle principale par mètre de front de vague : 0,49 × hauteur² × période (hauteur en mètres, période en secondes). Elle double quand la hauteur monte de 40 %, et grimpe vite avec la période : une houle longue pousse plus qu\'une houle courte de même taille.'],
    energy: ['Énergie (kJ)', 'Énergie par mètre de front de vague, additionnée sur toutes les houles : 0,98 × hauteur² × période² pour chacune (mètres, secondes). C\'est une estimation proche de l\'échelle de Surf-Forecast (≈ 100 : petit mais surfable ; 200 à 1 000 : de plus en plus puissant ; au-delà de 1 000 : très lourd), mais leur formule exacte n\'est pas publiée : les chiffres peuvent différer.'],
    wind: ['Mer de vent', 'Vagues fabriquées par le vent local, courtes et désordonnées (période souvent 3 à 7 secondes). Elles abîment la houle de fond : surface clapoteuse, vagues moins propres.'],
    s2: ['2e houle', 'Un deuxième train de houle, qui arrive d\'une autre direction ou avec une autre période. Même direction : les deux s\'ajoutent, les séries sont plus grosses. Directions croisées : mer croisée, vagues chaotiques et moins propres. Une 2e houle courte sur une longue houle principale crée du fouillis.'],
  };
  // finesse de la maille : pas minimal en degrés (1° ≈ 111 km) et nombre maximal de points par vue (quota Open-Meteo)
  const RES = { '15': { min: 0.125, max: 150, km: 15, label: '15 km' }, '5': { min: 0.05, max: 400, km: 5, label: '5 km' }, '1.3': { min: 0.0125, max: 600, km: 1.3, label: '1,3 km' } };
  const keyOf = (p) => p.lat.toFixed(3) + ',' + K.normLon(p.lon).toFixed(3);
  const hourNow = () => Math.floor(Date.now() / 3600000) * 3600000;
  const atMs = () => hourNow() + C.offset * 3600000;
  const fmtWhen = (ms) => (C.offset === 0 ? 'Maintenant' : new Date(ms).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', hour: 'numeric' }).replace(':00', ''));
  const reduced = () => !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- trait de côte (pour que la houle reste dans l'eau) ---------- */
  async function loadLand() {
    if (C.landState) return;
    C.landState = 'loading';
    try {
      await U.loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json');
      if (!res.ok) throw new Error('land ' + res.status);
      const topo = await res.json();
      const f = globalThis.topojson.feature(topo, topo.objects.land);
      const geoms = f.type === 'FeatureCollection' ? f.features.map((x) => x.geometry) : [f.geometry];
      const polys = [];
      geoms.forEach((g) => {
        const list = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
        list.forEach((rings) => {
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          rings[0].forEach(([lo, la]) => { if (lo < x0) x0 = lo; if (lo > x1) x1 = lo; if (la < y0) y0 = la; if (la > y1) y1 = la; });
          polys.push({ rings, x0, x1, y0, y1 });
        });
      });
      C.land = polys; C.landState = 'ok';
      draw();
    } catch (e) {
      C.landState = 'fail';
      renderPanel();
    }
  }
  /* ---------- côte précise (~30 m, OpenStreetMap) : tuiles de 1° chargées là où on regarde, quand on zoome ---------- */
  const FINE = { idx: null, state: '', tiles: {}, pending: {} };
  C.fine = FINE;
  const fineBase = () => { try { return new URL('coast/', globalThis.location.href).href; } catch (e) { return ''; } };
  async function loadFine() {
    const map = S.mapObj && S.mapObj.raw;
    if (!map || map.getZoom() < 8 || FINE.state === 'off') return;
    const base = fineBase();
    if (!/^https?:/.test(base)) { FINE.state = 'off'; return; }
    if (!FINE.idx) {
      if (FINE.state === 'loading') return;
      FINE.state = 'loading';
      try { const r = await fetch(base + 'index.json'); if (!r.ok) throw new Error(r.status); FINE.idx = await r.json(); FINE.state = 'ok'; }
      catch (e) { FINE.state = 'off'; return; }
    }
    const b = map.getBounds();
    const la0 = Math.floor(b.getSouth()), la1 = Math.floor(b.getNorth()), lo0 = Math.floor(b.getWest()), lo1 = Math.floor(b.getEast());
    let started = 0;
    for (let la = la0; la <= la1 && started < 6; la++) for (let lo = lo0; lo <= lo1 && started < 6; lo++) {
      const k = la + ',' + lo;
      if (FINE.idx.cells[k] !== 1 || FINE.tiles[k] || FINE.pending[k]) continue;
      FINE.pending[k] = 1; started++;
      fetch(base + 'c_' + la + '_' + lo + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((t) => {
        const sc = FINE.idx.scale || 100000;
        FINE.tiles[k] = t.p.map((rings) => rings.map((flat) => { const out = new Array(flat.length); for (let i = 0; i < flat.length; i += 2) { out[i] = lo + flat[i] / sc; out[i + 1] = la + flat[i + 1] / sc; } return out; }));
        delete FINE.pending[k]; draw();
      }).catch(() => { FINE.tiles[k] = []; delete FINE.pending[k]; });
    }
  }
  // cases fines disponibles dans la vue (terre ou eau seule) : là, on remplace la côte grossière
  function fineCells(map) {
    if (!FINE.idx || map.getZoom() < 8) return [];
    const b = map.getBounds(), out = [];
    for (let la = Math.floor(b.getSouth()); la <= Math.floor(b.getNorth()); la++) for (let lo = Math.floor(b.getWest()); lo <= Math.floor(b.getEast()); lo++) {
      const k = la + ',' + lo, v = FINE.idx.cells[k];
      if (v === 0 || (v === 1 && FINE.tiles[k] && FINE.tiles[k].length)) out.push({ la, lo, k, land: v === 1 });
    }
    return out;
  }
  // efface la terre sur le canvas de travail (destination-out)
  function maskLand(ctx, w, h) {
    const map = S.mapObj.raw;
    if (!C.land) return false;
    const z = map.getZoom(), scale = 256 * Math.pow(2, z), b = map.getBounds();
    const fast = typeof map.project === 'function', o = fast ? map.project(map.containerPointToLatLng([0, 0]), z) : null;
    const W = b.getWest(), E = b.getEast(), So = b.getSouth(), No = b.getNorth();
    const stride = z < 5 ? 3 : z < 7 ? 2 : 1;
    const slow = (lat, lon) => { const q = map.latLngToContainerPoint([lat, lon]); return [q.x, q.y]; };
    const X = (lon, lat) => (fast ? ((lon + 180) / 360) * scale - o.x : slow(lat, lon)[0]);
    const Y = (lat, lon) => { if (!fast) return slow(lat, lon)[1]; const la = clamp(lat, -85.05, 85.05); return (0.5 - Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360)) / (2 * Math.PI)) * scale - o.y; };
    const cells = fineCells(map);
    const px = (lon, lat) => [X(lon, lat), Y(lat, lon)];
    ctx.save();
    if (cells.length) { // la côte grossière ne sert pas là où la côte précise est chargée
      ctx.beginPath(); ctx.rect(0, 0, w, h);
      cells.forEach((c) => { const a = px(c.lo, c.la + 1), d = px(c.lo + 1, c.la); ctx.rect(a[0] - 0.5, a[1] - 0.5, d[0] - a[0] + 1, d[1] - a[1] + 1); });
      ctx.clip('evenodd');
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    C.land.forEach((p) => {
      if (p.y1 < So || p.y0 > No) return;
      if (p.x1 < W || p.x0 > E) return;
      ctx.beginPath();
      p.rings.forEach((ring) => {
        const last = ring.length - 1;
        for (let k = 0; k <= last; k += stride) {
          const pt = ring[k], x = X(pt[0]), y = Y(pt[1]);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(X(ring[last][0], ring[last][1]), Y(ring[last][1], ring[last][0]));
        ctx.closePath();
      });
      ctx.fill('evenodd');
    });
    ctx.restore();
    if (cells.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      cells.forEach((c) => {
        if (!c.land) return;
        FINE.tiles[c.k].forEach((rings) => {
          ctx.beginPath();
          rings.forEach((ring) => {
            for (let i = 0; i < ring.length; i += 2) { const q = px(ring[i], ring[i + 1]); if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }
            ctx.closePath();
          });
          ctx.fill('evenodd');
        });
      });
      ctx.restore();
    }
    loadFine();
    return true;
  }

  /* ---------- données de la zone ---------- */
  /* la vue Profondeur est une option (masquée par défaut), choix gardé sur l'appareil */
  let showDepth = false;
  try { showDepth = localStorage.getItem('houle.opt.depth') === '1'; } catch (e) { /* pas de stockage */ }
  const depthOpt = () => '<p class="cp-hint"><button type="button" class="btn btn-small" data-act="condDepthOpt">' + (showDepth ? 'Masquer la vue Profondeur' : 'Option : afficher la vue Profondeur') + '</button></p>';
  /* ---------- profondeur : fonds marins GEBCO (carte en couleurs, cases d'environ 450 m) ---------- */
  function syncDepth() {
    const map = S.mapObj && S.mapObj.raw, L = globalThis.L, on = C.active && C.view === 'depth';
    if (!map || !L) return;
    if (on && !C.depthLayer && L.tileLayer && L.tileLayer.wms) {
      C.depthLayer = L.tileLayer.wms('https://wms.gebco.net/mapserv?', { layers: 'gebco_latest_2', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.8, attribution: 'Bathymétrie &copy; GEBCO Compilation Group (GEBCO_2026 Grid)' });
    }
    if (on && C.depthLayer && !map.hasLayer(C.depthLayer)) C.depthLayer.addTo(map);
    if (!on && C.depthLayer && map.hasLayer(C.depthLayer)) map.removeLayer(C.depthLayer);
  }

  async function refresh() {
    if (C.view === 'depth') { syncDepth(); return; }
    if (!C.active || !S.mapObj || !S.mapObj.raw) return;
    const map = S.mapObj.raw, b = map.getBounds(), size = map.getSize(), GL = H.global;
    const bb = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    if (map.getZoom() <= 5 && GL) {
      if (GL.ready) { refreshGlobal(bb); return; }
      if (GL.state === 'loading') { C.status = 'Chargement des données mondiales…'; renderPanel(); return; }
    }
    const R = RES[C.res] || RES['5'], swell = C.view === 'swell', cache = swell ? C.cacheM : C.cacheW;
    // la houle du modèle gratuit a des mailles d'environ 8 km : inutile de la demander plus fin que 0,1°
    const g = K.gridFor(bb, 999, R.max, swell ? Math.max(R.min, 0.1) : R.min);
    const nodes = [];
    g.lats.forEach((lat) => g.lons.forEach((lon) => nodes.push({ lat, lon, step: g.step })));
    const now = Date.now();
    const missing = nodes.filter((p) => { const c = cache.get(keyOf(p)); return !c || now - c.at > TTL; });
    const token = ++C.token;
    if (missing.length) {
      C.loading = true; C.status = 'Chargement de ' + missing.length + ' points…'; renderPanel();
      try {
        const recs = await K.fetchPoints(missing, { marine: swell, wind: !swell });
        recs.forEach((r, i) => cache.set(keyOf(missing[i]), { rec: r, at: Date.now() }));
      } catch (e) {
        C.loading = false;
        if (GL && GL.ready) { refreshGlobal(bb); return; } // Open-Meteo saturé : on garde la carte mondiale
        C.status = e.message || 'Données indisponibles';
        renderPanel();
        if (token === C.token) A.toast(C.status, 'error');
        return;
      }
      C.loading = false;
    }
    if (token !== C.token) return; // la carte a encore bougé : une autre mise à jour est en cours
    C.source = 'om';
    C.grid = { step: g.step, lats: g.lats, lons: g.lons, rec: g.lats.map((lat) => g.lons.map((lon) => { const c = cache.get(keyOf({ lat, lon })); return c ? c.rec : null; })) };
    const withData = nodes.filter((p) => { const c = cache.get(keyOf(p)); return c && c.rec.n; }).length;
    const first = nodes.map((p) => cache.get(keyOf(p))).find((c) => c && c.rec.n);
    if (first) C.maxOffset = Math.max(0, Math.min(96, first.rec.n - 1 - K.hourIndex(first.rec, hourNow())));
    if (C.offset > C.maxOffset) C.offset = C.maxOffset;
    const km = g.step * 111, kmTxt = km < 3 ? km.toFixed(1).replace('.', ',') : Math.round(km);
    C.status = withData ? 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' · maille ≈ ' + kmTxt + ' km' + (km > R.km * 1.6 ? ' (zoome pour affiner)' : '') + ' · Open-Meteo' : 'Aucune donnée pour cette zone';
    renderPanel();
    draw();
  }

  // carte mondiale : tout vient des fichiers préparés par GitHub, aucun appel Open-Meteo
  function refreshGlobal(bb) {
    ++C.token;
    const g = K.gridFor(bb, 80, 2600, 1), nodes = [];
    g.lats.forEach((lat) => g.lons.forEach((lon) => nodes.push({ lat, lon })));
    const recs = H.global.records(nodes);
    let k = 0;
    C.source = 'global';
    C.grid = { step: g.step, lats: g.lats, lons: g.lons, rec: g.lats.map(() => g.lons.map(() => recs[k++])) };
    const first = recs[0];
    if (first) C.maxOffset = Math.max(0, Math.min(72, first.n - 1 - K.hourIndex(first, hourNow())));
    if (C.offset > C.maxOffset) C.offset = C.maxOffset;
    C.status = 'Monde · NOAA GFS du ' + H.global.cycleLabel();
    renderPanel();
    draw();
  }
  const scheduleRefresh = () => { clearTimeout(C.timer); C.timer = setTimeout(refresh, 600); };

  /* ---------- dessin ---------- */
  function sizeCanvas() {
    const el = S.mapObj.raw.getContainer(), dpr = globalThis.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    [C.canvas, C.pcv].forEach((cv, k) => {
      if (!cv) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        if (k === 1) C.parts = [];
      }
      (k ? C.pctx : C.ctx).setTransform(dpr, 0, 0, dpr, 0, 0);
      if (C.inPane) globalThis.L.DomUtil.setPosition(cv, S.mapObj.raw.containerPointToLayerPoint([0, 0]));
    });
    return { w, h };
  }

  function arrow(ctx, x, y, from, len, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((from + 180) * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -len); ctx.lineTo(len * 0.62, len * 0.7); ctx.lineTo(0, len * 0.3); ctx.lineTo(-len * 0.62, len * 0.7); ctx.closePath();
    ctx.fillStyle = fill; ctx.strokeStyle = 'rgba(8,24,30,.85)'; ctx.lineWidth = 1.4; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function label(ctx, text, x, y, color) {
    ctx.font = '700 11.5px "Hanken Grotesk", system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(8,24,30,.9)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color || '#fff'; ctx.fillText(text, x, y);
  }
  const textW = (ctx, t) => { ctx.font = '700 11.5px "Hanken Grotesk", system-ui, sans-serif'; return ctx.measureText(t).width; };

  // valeur lissée entre les 4 nœuds voisins ; get(r, v) renvoie un nombre ou null (null = nœud ignoré)
  function sampler(g, nodes, minW) {
    const NI = g.lats.length, NJ = g.lons.length, span = (NJ - 1) * g.step;
    // écart de longitude depuis le premier nœud, du bon côté du globe (marche aussi pour une vue de plus de 180°)
    const relLon = (lon) => { let d = (((lon - g.lons[0]) % 360) + 360) % 360; if (d > span + (360 - span) / 2) d -= 360; return d; };
    return (lat, lon) => {
      if (NI < 2 || NJ < 2) return null;
      const fi = clamp((lat - g.lats[0]) / g.step, 0, NI - 1.0001), fj = clamp(relLon(lon) / g.step, 0, NJ - 1.0001);
      const i0 = Math.floor(fi), j0 = Math.floor(fj), ty = fi - i0, tx = fj - j0;
      let sum = 0, wsum = 0;
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        const v = nodes[i0 + a][j0 + c], wt = (a ? ty : 1 - ty) * (c ? tx : 1 - tx);
        if (v != null && wt > 0) { sum += v * wt; wsum += wt; }
      }
      return wsum < minW ? null : sum / wsum;
    };
  }

  // peint un champ continu à basse résolution puis l'étire en lissant : pas de carrés visibles
  function field(ctx, w, h, fn, alpha) {
    const map = S.mapObj.raw, cell = 6, cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
    const off = document.createElement('canvas'); off.width = cw; off.height = ch;
    const octx = off.getContext('2d'), img = octx.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const ll = map.containerPointToLatLng([(x + 0.5) * cell, (y + 0.5) * cell]);
      const col = fn(ll.lat, ll.lng);
      if (!col) continue;
      const o = (y * cw + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(alpha * 255);
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, cw * cell, ch * cell);
  }

  function drawPressure(ctx, w, h) {
    const GL = H.global;
    if (!C.pressure || !GL || !GL.ready) return;
    const st = GL.pressureAt(atMs());
    if (!st) return;
    const map = S.mapObj.raw, pt = (lat, lon) => map.latLngToContainerPoint([lat, lon]);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.font = '700 10.5px "Hanken Grotesk", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const labels = [];
    [0, -360, 360].forEach((off) => {
      st.iso.forEach((lv) => lv.l.forEach((flat) => {
        const pts = [];
        let inView = false;
        for (let k = 0; k < flat.length; k += 2) {
          const p = pt(flat[k + 1], flat[k] + off);
          pts.push(p);
          if (p.x > -20 && p.x < w + 20 && p.y > -20 && p.y < h + 20) inView = true;
        }
        if (!inView) return;
        ctx.beginPath();
        pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = lv.p % 20 === 0 ? 1.8 : 1.1; ctx.stroke();
        const m = pts[Math.floor(pts.length / 2)];
        if (pts.length > 8 && m.x > 14 && m.x < w - 14 && m.y > 10 && m.y < h - 10) labels.push([m.x, m.y, lv.p]);
      }));
    });
    labels.forEach(([x, y, p]) => { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,24,30,.75)'; ctx.strokeText(p, x, y); ctx.fillStyle = '#fff'; ctx.fillText(p, x, y); });
    ctx.font = '800 26px "Hanken Grotesk", system-ui, sans-serif';
    [0, -360, 360].forEach((off) => st.hl.forEach(([lo, la, kind, v]) => {
      const p = pt(la, lo + off);
      if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,24,30,.85)'; ctx.fillStyle = kind === 'H' ? '#7cc4ff' : '#ff8a7a';
      ctx.strokeText(kind, p.x, p.y); ctx.fillText(kind, p.x, p.y);
      ctx.font = '700 11px "Hanken Grotesk", system-ui, sans-serif'; ctx.lineWidth = 3; ctx.fillStyle = '#fff';
      ctx.strokeText(v, p.x, p.y + 17); ctx.fillText(v, p.x, p.y + 17);
      ctx.font = '800 26px "Hanken Grotesk", system-ui, sans-serif';
    }));
    ctx.restore();
  }

  let rafDraw = 0;
  const requestDraw = () => { if (rafDraw) return; rafDraw = requestAnimationFrame(() => { rafDraw = 0; draw(); }); };

  function draw() {
    if (!C.active || !C.ctx) return;
    const map = S.mapObj.raw, { w, h } = sizeCanvas(), ctx = C.ctx;
    ctx.clearRect(0, 0, w, h);
    C.vec = null;
    if (C.view === 'depth') { stopParticles(); return; }
    const g = C.grid;
    if (!g || !g.lats.length) { stopParticles(); return; }
    const t = atMs();
    const vals = g.rec.map((row) => row.map((r) => (r && r.n ? K.at(r, t) : null)));

    if (C.vec_prev && C.vec_prev !== C.view) stopParticles();
    C.vec_prev = C.view;
    if (C.view === 'wind') {
      const spd = vals.map((row) => row.map((v) => (v && v.wind != null ? v.wind : null)));
      const sm = sampler(g, spd, 0.3);
      field(ctx, w, h, (la, lo) => { const v = sm(la, lo); return v == null ? null : K.windColor(v); }, 0.62);
      // vecteurs (est, nord) lissés pour les particules
      const uu = vals.map((row) => row.map((v) => (v && v.wind != null && v.windDir != null ? -v.wind * Math.sin((v.windDir * Math.PI) / 180) : null)));
      const vv = vals.map((row) => row.map((v) => (v && v.wind != null && v.windDir != null ? -v.wind * Math.cos((v.windDir * Math.PI) / 180) : null)));
      const su = sampler(g, uu, 0.3), sv = sampler(g, vv, 0.3), cell = 14, cw = Math.ceil(w / cell) + 1, ch = Math.ceil(h / cell) + 1;
      const U1 = new Float32Array(cw * ch), V1 = new Float32Array(cw * ch), OK = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const ll = map.containerPointToLatLng([x * cell, y * cell]), a = su(ll.lat, ll.lng), b = sv(ll.lat, ll.lng);
        if (a != null && b != null) { const o = y * cw + x; U1[o] = a; V1[o] = b; OK[o] = 1; }
      }
      drawPressure(ctx, w, h);
      C.vec = { kind: 'wind', cell, cw, ch, U1, V1, OK, w, h };
      if (reduced()) {
        for (let y = 30; y < h; y += 56) for (let x = 30; x < w; x += 56) {
          const o = Math.round(y / cell) * cw + Math.round(x / cell);
          if (OK[o]) { const sp = Math.hypot(U1[o], V1[o]); arrow(ctx, x, y, (Math.atan2(-U1[o], -V1[o]) * 180) / Math.PI, 7 + Math.min(sp, 40) / 8, '#fff'); }
        }
      } else if (!C.raf) startParticles();
      return;
    }

    // houle : champ lissé sur les seules cases de mer, puis la terre est effacée par le trait de côte
    if (!C.work) C.work = document.createElement('canvas');
    if (C.work.width !== w || C.work.height !== h) { C.work.width = w; C.work.height = h; }
    const wctx = C.work.getContext('2d');
    wctx.clearRect(0, 0, w, h);
    const hs = vals.map((row, i) => row.map((v, j) => { const r = g.rec[i][j]; return r && r.sea && v && v.height != null ? v.height : null; }));
    const sm = sampler(g, hs, C.land ? 0.01 : 0.3);
    field(wctx, w, h, (la, lo) => { const v = sm(la, lo); return v == null ? null : K.waveColor(v); }, 0.72);
    maskLand(wctx, w, h);
    ctx.drawImage(C.work, 0, 0, w, h);
    drawPressure(ctx, w, h);

    // flèches de direction et chiffres sur les points en mer
    const px = (lat, lon) => map.latLngToContainerPoint([lat, lon]);
    const p00 = px(g.lats[0], g.lons[0]), p01 = px(g.lats[0], g.lons[0] + g.step), p10 = px(g.lats[0] + g.step, g.lons[0]);
    const sp = Math.max(Math.abs(p01.x - p00.x), Math.abs(p10.y - p00.y), 10);
    const showText = sp >= 56, every = sp < 28 ? Math.ceil(28 / sp) : 1;
    g.lats.forEach((lat, i) => g.lons.forEach((lon, j) => {
      if (i % every || j % every) return;
      const r = g.rec[i][j], v = vals[i][j];
      if (!r || !r.sea || !v || v.height == null) return;
      const p = px(lat, lon);
      if (p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) return;
      const txt = v.height.toFixed(1) + 'm' + (v.period != null ? ' ' + Math.round(v.period) + 's' : '');
      const tw = showText ? textW(ctx, txt) + 3 : 0, x0 = p.x - (10 + tw) / 2;
      if (v.dir != null && reduced()) arrow(ctx, x0 + 5, p.y, v.dir, 6, '#fff');
      if (showText) label(ctx, txt, x0 + 14, p.y, '#e6f6ff');
    }));

    // houle animée : filets qui coulent dans le sens de propagation, plus lents pour les longues périodes,
    // colorés par hauteur ; ils s'arrêtent à la côte (masque de mer lu sur le dessin déjà découpé)
    const dirs = vals.map((row, i) => row.map((v, j) => { const r = g.rec[i][j]; return r && r.sea && v && v.height != null && v.dir != null ? v.dir : null; }));
    const per = vals.map((row, i) => row.map((v, j) => { const r = g.rec[i][j]; return r && r.sea && v && v.height != null ? (v.period != null ? v.period : 8) : null; }));
    const su = sampler(g, dirs.map((row) => row.map((d) => (d == null ? null : -Math.sin((d * Math.PI) / 180)))), 0.3);
    const sv = sampler(g, dirs.map((row) => row.map((d) => (d == null ? null : -Math.cos((d * Math.PI) / 180)))), 0.3);
    const spr = sampler(g, per, 0.3);
    const cell = 14, cw = Math.ceil(w / cell) + 1, ch = Math.ceil(h / cell) + 1;
    const U1 = new Float32Array(cw * ch), V1 = new Float32Array(cw * ch), OK = new Uint8Array(cw * ch), HT = new Float32Array(cw * ch), PR = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const ll = map.containerPointToLatLng([x * cell, y * cell]), a = su(ll.lat, ll.lng), b = sv(ll.lat, ll.lng), hh = sm(ll.lat, ll.lng), pp = spr(ll.lat, ll.lng);
      if (a != null && b != null && hh != null) {
        const o = y * cw + x, m = Math.hypot(a, b) || 1, sp2 = 30 * Math.pow(8 / clamp(pp == null ? 8 : pp, 4, 18), 0.7);
        U1[o] = (a / m) * sp2; V1[o] = (b / m) * sp2; HT[o] = hh; PR[o] = pp == null ? 8 : pp; OK[o] = 1;
      }
    }
    // masque de mer : le dessin de houle (déjà découpé par la côte) réduit au 1/8
    const sc = 8, mw = Math.ceil(w / sc), mh = Math.ceil(h / sc);
    if (!C.maskCv) C.maskCv = document.createElement('canvas');
    C.maskCv.width = mw; C.maskCv.height = mh;
    const mctx = C.maskCv.getContext('2d');
    mctx.clearRect(0, 0, mw, mh); mctx.drawImage(C.work, 0, 0, mw, mh);
    let sea = null;
    try { const id = mctx.getImageData(0, 0, mw, mh).data; sea = new Uint8Array(mw * mh); for (let k = 0; k < sea.length; k++) sea[k] = id[k * 4 + 3] > 120 ? 1 : 0; } catch (e) { sea = null; }
    C.vec = { kind: 'swell', cell, cw, ch, U1, V1, OK, HT, PR, w, h, sea, sc, mw, mh };
    if (!reduced() && !C.raf) startParticles();
  }

  /* ---------- particules de vent ---------- */
  function sampleVec(x, y) {
    const v = C.vec;
    if (!v) return null;
    const fx = x / v.cell, fy = y / v.cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 >= v.cw - 1 || y0 >= v.ch - 1) return null;
    if (v.sea) { const mx = Math.floor(x / v.sc), my = Math.floor(y / v.sc); if (mx < 0 || my < 0 || mx >= v.mw || my >= v.mh || !v.sea[my * v.mw + mx]) return null; }
    const tx = fx - x0, ty = fy - y0;
    let u = 0, w2 = 0, vv = 0, ht = 0, pr = 0;
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
      const o = (y0 + a) * v.cw + x0 + c, wt = (a ? ty : 1 - ty) * (c ? tx : 1 - tx);
      if (v.OK[o] && wt > 0) { u += v.U1[o] * wt; vv += v.V1[o] * wt; w2 += wt; if (v.HT) { ht += v.HT[o] * wt; pr += v.PR[o] * wt; } }
    }
    return w2 < 0.3 ? null : [u / w2, vv / w2, ht / w2, pr / w2];
  }
  function stopParticles() {
    if (C.raf) { cancelAnimationFrame(C.raf); C.raf = 0; }
    if (C.pctx && C.pcv) C.pctx.clearRect(0, 0, C.pcv.width, C.pcv.height);
    C.parts = [];
  }
  function startParticles() {
    if (!C.active || !C.vec || !C.pctx) return;
    const kind = C.vec.kind, { w, h } = C.vec, swell = kind === 'swell';
    const n = Math.round(clamp((w * h) / (swell ? 1100 : 1400), 200, swell ? 2400 : 1800));
    const seed = (p) => { p.x = Math.random() * w; p.y = Math.random() * h; p.age = Math.floor(Math.random() * 70); p.life = 90; return p; };
    C.parts = Array.from({ length: n }, () => seed({}));
    const ctx = C.pctx;
    ctx.clearRect(0, 0, w, h);
    // couleurs de filets par classe de hauteur (houle), pour ne faire qu'un tracé par couleur
    const bins = {};
    const colorOf = (hm) => { const k = Math.min(15, Math.round(hm * 3)); return bins[k] || (bins[k] = K.rgba(K.waveColor(k / 3), 0.95)); };
    const step = () => {
      C.raf = 0;
      if (!C.active || !C.vec || C.vec.kind !== kind) return;
      if (!document.hidden) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = swell ? 'rgba(0,0,0,0.055)' : 'rgba(0,0,0,0.1)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        if (!swell) {
          ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 1.25;
          ctx.beginPath();
          C.parts.forEach((p) => {
            const v = sampleVec(p.x, p.y);
            if (!v || ++p.age > 90) { seed(p); p.age = 0; return; }
            const nx = p.x + v[0] * 0.055, ny = p.y - v[1] * 0.055;
            ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
            p.x = nx; p.y = ny;
          });
          ctx.stroke();
        } else {
          const groups = {};
          C.parts.forEach((p) => {
            const v = sampleVec(p.x, p.y);
            if (!v) { seed(p); p.age = 0; return; }
            if (p.age === 0 || !p.life) p.life = 90 + Math.round(v[3] * 6); // plus longtemps (donc plus long) pour les grandes périodes
            if (++p.age > p.life) { seed(p); p.age = 0; return; }
            const nx = p.x + v[0] * 0.05, ny = p.y - v[1] * 0.05, k = Math.min(15, Math.round(v[2] * 3));
            (groups[k] = groups[k] || []).push(p.x, p.y, nx, ny, v[2]);
            p.x = nx; p.y = ny;
          });
          Object.keys(groups).forEach((k) => {
            const arr = groups[k];
            ctx.strokeStyle = colorOf(+k / 3); ctx.lineWidth = 1.6 + Math.min(1.4, +k / 8);
            ctx.beginPath();
            for (let i = 0; i < arr.length; i += 5) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
            ctx.stroke();
          });
        }
      }
      C.raf = requestAnimationFrame(step);
    };
    C.raf = requestAnimationFrame(step);
  }

  /* ---------- détail d'un point : tableau heure par heure (façon Windguru) ---------- */
  const dirTxt = (d) => (d == null ? '–' : U.compass(d) + ' ' + Math.round(d) + '°');
  const rot = (d) => (d == null ? '' : '<i class="ar" style="transform:rotate(' + Math.round(d + 180) + 'deg)">↑</i>');
  const lerp = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  const localKey = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function buildDays(d) {
    const days = [], map = new Map();
    d.t.forEach((s, i) => {
      const k = localKey(s * 1000);
      if (!map.has(k)) { const o = { key: k, idx: [], ms: s * 1000 }; map.set(k, o); days.push(o); }
      map.get(k).idx.push(i);
    });
    const todayKey = localKey(Date.now());
    return days.slice(0, 8).map((o) => {
      const dt = new Date(o.ms);
      o.label = o.key === todayKey ? 'Auj.' : dt.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') + ' ' + dt.getDate();
      return o;
    });
  }
  function isNight(d, s) {
    if (d.rise.length && d.set.length) { for (let k = 0; k < d.rise.length; k++) if (s >= d.rise[k] && s <= d.set[k]) return false; return true; }
    const hr = new Date(s * 1000).getHours();
    return hr < 7 || hr >= 21;
  }
  const FAR_MS = 4 * 86400000;

  function summarySvg(D) {
    const { d, days, sel } = D, n = d.n, Wd = 720, Ht = 112, pl = 4, pr = 4, pt = 8, pb = 22;
    const iw = Wd - pl - pr, ih = Ht - pt - pb;
    const wmax = Math.max(40, ...d.gust.filter((v) => v != null), ...d.wind.filter((v) => v != null)), hmax = Math.max(2.5, ...d.main.map((x) => x.h || 0));
    const X = (i) => pl + (i / Math.max(1, n - 1)) * iw;
    const Yw = (v) => pt + ih - (v / wmax) * ih, Yh = (v) => pt + ih - (v / hmax) * ih;
    const poly = (arr, Y) => { const pts = []; arr.forEach((v, i) => { if (v != null) pts.push(X(i).toFixed(1) + ',' + Y(v).toFixed(1)); }); return pts; };
    const wavePts = poly(d.main.map((x) => x.h), Yh), windPts = poly(d.wind, Yw), gustPts = poly(d.gust, Yw);
    const nowI = Math.max(0, d.t.findIndex((s) => s * 1000 >= hourNow()));
    const farI = d.t.findIndex((s) => s * 1000 - hourNow() > FAR_MS);
    let g = '';
    if (farI > 0) g += '<rect x="' + X(farI).toFixed(1) + '" y="' + pt + '" width="' + (pl + iw - X(farI)).toFixed(1) + '" height="' + ih + '" class="far-bg"/>';
    days.forEach((o, k) => {
      const x0 = X(o.idx[0]), x1 = X(o.idx[o.idx.length - 1]);
      if (k === sel) g += '<rect x="' + x0.toFixed(1) + '" y="' + pt + '" width="' + Math.max(2, x1 - x0).toFixed(1) + '" height="' + ih + '" class="sel-bg"/>';
      g += '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + pt + '" y2="' + (pt + ih) + '" class="sep"/>';
      g += '<text x="' + ((k === days.length - 1 && (x1 - x0) < 60 ? x1 : (x0 + x1) / 2)).toFixed(1) + '" y="' + (Ht - 7) + '" text-anchor="' + (k === days.length - 1 && (x1 - x0) < 60 ? 'end' : 'middle') + '" class="dl">' + esc(o.label) + '</text>';
      g += '<rect x="' + x0.toFixed(1) + '" y="0" width="' + Math.max(8, x1 - x0).toFixed(1) + '" height="' + Ht + '" fill="transparent" data-act="wgDay" data-i="' + k + '" style="cursor:pointer"><title>' + esc(o.label) + '</title></rect>';
    });
    const area = wavePts.length ? '<polygon class="wave-a" points="' + X(d.main.findIndex((x) => x.h != null)).toFixed(1) + ',' + (pt + ih) + ' ' + wavePts.join(' ') + ' ' + wavePts[wavePts.length - 1].split(',')[0] + ',' + (pt + ih) + '"/><polyline class="wave-l" points="' + wavePts.join(' ') + '"/>' : '';
    const nowX = X(nowI).toFixed(1);
    return '<svg class="wg-sum" viewBox="0 0 ' + Wd + ' ' + Ht + '" role="img" aria-label="Résumé sur 7 jours : vent en orange, houle en bleu">' + g + area +
      (gustPts.length ? '<polyline class="gust-l" points="' + gustPts.join(' ') + '"/>' : '') +
      (windPts.length ? '<polyline class="wind-l" points="' + windPts.join(' ') + '"/>' : '') +
      '<line x1="' + nowX + '" x2="' + nowX + '" y1="' + pt + '" y2="' + (pt + ih) + '" class="now"/>' +
      '<text x="' + (pl + 2) + '" y="' + (pt + 9) + '" class="ax">vent max ' + Math.round(wmax) + ' km/h</text><text x="' + (Wd - pr - 2) + '" y="' + (pt + 9) + '" text-anchor="end" class="ax ax-w">houle max ' + hv(hmax) + (unit === 'ft' ? ' pieds' : ' m') + '</text></svg>';
  }

  function dayTable(D) {
    const { d } = D, day = D.days[D.sel], sea = d.sea, sel = atMs();
    const cols = day.idx;
    const cell = (cls, inner, style, i) => '<td class="' + cls + (isNight(d, d.t[i]) ? ' night' : '') + (d.t[i] * 1000 - hourNow() > FAR_MS ? ' far' : '') + (d.t[i] * 1000 === sel ? ' cur' : '') + '"' + (style ? ' style="' + style + '"' : '') + '>' + inner + '</td>';
    const row = (name, unitTxt, fn, def) => '<tr><th scope="row" class="rowh' + (def ? ' hasdef' : '') + '"' + (def ? ' data-act="wgDef" data-k="' + def + '" tabindex="0" role="button" title="Toucher pour la définition"' : '') + '>' + name + (def ? ' <b class="qm" aria-hidden="true">?</b>' : '') + (unitTxt ? '<small>' + unitTxt + '</small>' : '') + '</th>' + cols.map(fn).join('') + '</tr>';
    const bg = (c) => 'background:' + lerp(c);
    const txtOn = (c) => ((c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 150 ? 'color:#0b1b22;' : 'color:#fff;');
    let html = '<table class="wgt"><thead><tr><th class="rowh"></th>' + cols.map((i) => '<th class="hh' + (isNight(d, d.t[i]) ? ' night' : '') + (d.t[i] * 1000 === sel ? ' cur' : '') + '">' + new Date(d.t[i] * 1000).getHours() + 'h</th>').join('') + '</tr></thead><tbody>';
    html += '<tr class="sec"><th class="rowh" colspan="' + (cols.length + 1) + '">Vent</th></tr>';
    html += row('Vent', 'km/h', (i) => { const v = d.wind[i]; if (v == null) return cell('nd', '–', '', i); const c = K.windColor(v); return cell('v', Math.round(v), bg(c) + ';' + txtOn(c), i); });
    html += row('Rafales', 'km/h', (i) => { const v = d.gust[i]; if (v == null) return cell('nd', '–', '', i); const c = K.windColor(v); return cell('v', Math.round(v), bg(c) + ';' + txtOn(c), i); });
    html += row('Direction', '', (i) => cell('dr', d.wdir[i] == null ? '–' : rot(d.wdir[i]) + '<small>' + U.compass(d.wdir[i]) + '</small>', '', i));
    if (sea) {
      html += '<tr class="sec"><th class="rowh" colspan="' + (cols.length + 1) + '">Houle</th></tr>';
      html += row('Hauteur', '(' + hUnit() + ')', (i) => { const v = d.main[i].h; if (v == null) return cell('nd', '–', '', i); const c = K.waveColor(v); return cell('v', hv(v), bg(c) + ';' + txtOn(c), i); });
      html += row('Période', '(secondes)', (i) => { const v = d.main[i].t; return cell('v2', v == null ? '–' : Math.round(v), '', i); });
      html += row('Direction', '', (i) => cell('dr', d.main[i].d == null ? '–' : rot(d.main[i].d) + '<small>' + U.compass(d.main[i].d) + '</small>', '', i));
      html += row('Puissance', 'kW/m', (i) => { const v = d.power[i]; return cell('v2', v == null ? '–' : Math.round(v), '', i); }, 'power');
      if (d.energy && d.energy.some((v) => v != null)) html += row('Énergie', 'kJ', (i) => { const v = d.energy[i]; return cell('v2', v == null ? '–' : Math.round(v), '', i); }, 'energy');
      if (d.sh.some((v) => v != null)) {
        html += row('Mer de vent', unit === 'ft' ? 'pieds · s' : 'mètres · s', (i) => cell('v2', d.wh[i] == null ? '–' : hv(d.wh[i]) + '<small>' + (d.wp[i] == null ? '' : Math.round(d.wp[i]) + 's') + '</small>', '', i), 'wind');
        if (d.s2h.some((v) => v != null)) {
          html += row('2e houle', unit === 'ft' ? 'pieds · s' : 'mètres · s', (i) => cell('v2', d.s2h[i] == null ? '–' : hv(d.s2h[i]) + '<small>' + (d.s2p[i] == null ? '' : Math.round(d.s2p[i]) + 's') + '</small>', '', i), 's2');
          if (d.s2d && d.s2d.some((v) => v != null)) html += row('2e houle, direction', '', (i) => cell('dr', d.s2d[i] == null ? '–' : rot(d.s2d[i]) + '<small>' + U.compass(d.s2d[i]) + '</small>', '', i));
        }
      }
    }
    if (d.tide && d.tide.some((v) => v != null)) {
      const vs = d.tide.filter((v) => v != null), lo = Math.min(...vs), hi = Math.max(...vs), rng = Math.max(0.2, hi - lo);
      const extAt = new Map();
      (d.tideExt || []).forEach((e) => { const k = Math.round((e.t - d.t[0]) / 3600); if (!extAt.has(k)) extAt.set(k, e); });
      const sg = (m) => (m < 0 ? '−' : '+') + hv(Math.abs(m));
      html += '<tr class="sec"><th class="rowh" colspan="' + (cols.length + 1) + '">Marée</th></tr>';
      html += row('Niveau', '(' + hUnit() + ')', (i) => {
        const v = d.tide[i]; if (v == null) return cell('nd', '–', '', i);
        const f = (v - lo) / rng, e = extAt.get(i);
        return cell('v2', sg(v) + (e ? '<small>' + (e.type === 'high' ? '▲ pleine' : '▼ basse') + '</small>' : ''), 'background:rgba(40,120,220,' + (0.08 + 0.4 * f).toFixed(2) + ')', i);
      }, 'tide');
    }
    return html + '</tbody></table>';
  }
  /* résumé de la marée du jour affiché : heures de pleine et basse mer */
  function tideLine(D) {
    const { d } = D, day = D.days[D.sel];
    if (!d.tideExt || !d.tideExt.length) return '';
    const t0 = d.t[day.idx[0]], t1 = d.t[day.idx[day.idx.length - 1]] + 3599;
    const list = d.tideExt.filter((e) => e.t >= t0 && e.t <= t1).map((e) => (e.type === 'high' ? 'Pleine mer ' : 'Basse mer ') + new Date(e.t * 1000).toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ') + ' (' + (e.h < 0 ? '−' : '+') + hv(Math.abs(e.h)) + ' ' + (unit === 'ft' ? 'pieds' : 'm') + ')');
    return list.length ? '<p class="wg-tide"><b>Marée du jour :</b> ' + list.map(esc).join(' · ') + '</p>' : '';
  }

  function renderDetail() {
    const D = C.det, el = $('#wgBody');
    if (!D || !el) return;
    const d = D.d;
    el.innerHTML =
      summarySvg(D) +
      '<div class="wg-days" role="group" aria-label="Jour affiché">' + D.days.map((o, k) => '<button type="button" class="kf" data-act="wgDay" data-i="' + k + '" aria-pressed="' + (k === D.sel) + '">' + esc(o.label) + '</button>').join('') + '</div>' +
      '<div class="wg-days" role="group" aria-label="Unité des hauteurs">' + ['m', 'ft'].map((u) => '<button type="button" class="kf" data-act="wgUnit" data-u="' + u + '" aria-pressed="' + (u === unit) + '">' + (u === 'm' ? 'Mètres' : 'Pieds') + '</button>').join('') + '</div>' +
      '<div class="wg-scroll">' + dayTable(D) + '</div>' +
      tideLine(D) +
      '<div id="wgDef" class="wg-def" role="note" hidden></div>' +
      '<p class="fine">Heures de ton appareil (' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'locale') + '). La nuit est grisée. Au-delà de 4 jours, les colonnes sont ternes : la prévision est moins fiable.</p>' +
      (d.sea ? '<p class="fine">Houle principale du modèle de vagues (cases de 10 à 25 km, plutôt au large). Touche le nom d\'une ligne marquée ? pour sa définition. Direction : d\'où vient la houle ou le vent, la flèche montre où ça va.</p>'
        : '<p class="cp-warn" role="note">Ce point est à terre ou trop loin de la mer : pas de données de houle, seulement le vent.</p>');
  }

  async function showDetail(lat, lon) {
    const tok = ++C.dtoken;
    const dlg = A.dialog.open('<div class="dlg wg"><h2>Prévisions</h2><p class="fine">Chargement de 7 jours de prévisions…</p><div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button></div></div>', null, { onclose: () => { C.dtoken++; dlg.classList.remove('wide'); } });
    dlg.classList.add('wide');
    let d;
    try { d = await K.fetchDetail(lat, lon); } catch (e) {
      if (tok !== C.dtoken) return;
      dlg.innerHTML = '<div class="dlg"><h2>Prévisions</h2><p class="knote">' + esc(e.message || 'Prévisions indisponibles') + '</p><div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button></div></div>';
      return;
    }
    if (tok !== C.dtoken) return;
    const days = buildDays(d);
    const cur = localKey(atMs());
    C.det = { d, days, sel: Math.max(0, days.findIndex((o) => o.key === cur)), lat, lon };
    dlg.innerHTML =
      '<div class="dlg wg"><h2>Prévisions · ' + esc(U.fmtCoords(lat, lon)) + '</h2>' +
      '<p class="fine">' + (d.sea ? 'En mer ou près de la côte' : 'À terre') + ' · l\'heure choisie sur la carte est encadrée dans le tableau</p>' +
      '<div id="wgBody"></div>' +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span><button class="btn btn-primary" data-act="condAdd" data-lat="' + lat + '" data-lon="' + lon + '">Ajouter un spot ici</button></div></div>';
    renderDetail();
  }
  A.cond.click = (lat, lon) => { if (!C.active || C.view === 'depth') return false; showDetail(lat, lon); return true; };

  /* ---------- panneau ---------- */
  function legendHtml() {
    const wind = C.view === 'wind', stops = wind ? K.WIND_STOPS : K.WAVE_STOPS, max = stops[stops.length - 1][0];
    const ticks = (wind ? [0, 10, 20, 30, 40, 55, 70, 90] : [0, 1, 2, 3, 4, 5.5, 8]).map((v) => '<span style="left:' + (v / max) * 100 + '%">' + v + '</span>').join('');
    return '<div class="cp-row cp-legend"><span class="lg"><b>' + (wind ? 'Vent' : 'Houle') + '</b> ' + (wind ? 'km/h' : 'mètres') + '</span>' +
      '<span class="scale"><i class="bar" style="background:linear-gradient(90deg,' + stops.map((s) => lerp(s[1]) + ' ' + (s[0] / max) * 100 + '%').join(',') + ')"></i><span class="ticks">' + ticks + '</span></span></div>';
  }
  function renderPanel() {
    const el = $('#condPanel');
    if (!el || el.hidden) return;
    if (C.view === 'depth') {
      el.innerHTML = '<div class="cp-row">' + ['wind', 'swell', 'depth'].map((k) => '<button type="button" class="kf" data-act="condView" data-k="' + k + '" aria-pressed="' + (C.view === k) + '">' + (k === 'wind' ? 'Vent' : k === 'swell' ? 'Houle' : 'Profondeur') + '</button>').join('') + '</div>' +
        '<div class="cp-row cp-legend"><span class="lg"><b>Profondeur</b></span><span class="scale"><i class="bar" style="background:linear-gradient(90deg,#0b1f5c,#1f4e9c,#3f86c9,#7fc0e8,#cfeaf6)"></i><span class="ticks"><span style="left:0">profond</span><span style="left:100%">peu profond</span></span></span></div>' +
        '<p class="cp-warn" role="note">Carte des fonds marins GEBCO (précision d\'environ 450 m, moins près des côtes). Plus c\'est foncé, plus c\'est profond. À titre d\'information : ne sert pas à naviguer ni pour la sécurité en mer.</p>' + depthOpt();
      return;
    }
    const chip = (k, name) => '<button type="button" class="kf" data-act="condView" data-k="' + k + '" aria-pressed="' + (C.view === k) + '">' + name + '</button>';
    const fine = C.view === 'swell' && C.source === 'om' && RES[C.res].km < 5 ? '<p class="cp-warn" role="note">Le modèle de houle gratuit a des mailles d\'environ 8 km. La côte est dessinée au kilomètre près, mais la houle elle-même est lissée entre ces mailles.</p>' : '';
    const note = fine + (C.view === 'swell' && C.landState === 'fail' ? '<p class="cp-warn" role="note">Trait de côte non chargé : la houle peut déborder un peu sur la terre.</p>' : '');
    el.innerHTML =
      '<div class="cp-row">' + chip('wind', 'Vent') + chip('swell', 'Houle') + (showDepth ? chip('depth', 'Profondeur') : '') + (H.global && H.global.ready ? '<button type="button" class="kf" data-act="condPres" aria-pressed="' + C.pressure + '">Pression</button>' : '') + '<span class="cp-status" aria-live="polite">' + esc(C.status) + '</span></div>' +
      '<div class="cp-row cp-res"><span class="cp-lbl">Maille</span>' + ['1.3', '5', '15'].map((k) => '<button type="button" class="kf" data-act="condRes" data-k="' + k + '" aria-pressed="' + (C.res === k) + '">' + RES[k].label + '</button>').join('') + '</div>' +
      '<div class="cp-row"><label class="cp-time">' + esc(fmtWhen(atMs())) + '<input id="condTime" type="range" min="0" max="' + C.maxOffset + '" step="1" value="' + C.offset + '" aria-label="Heure affichée"></label>' +
      '<button type="button" class="btn btn-small" data-act="condNow">Maintenant</button></div>' +
      legendHtml() + note +
      '<p class="cp-hint"><span class="cp-more">Touche la carte pour le détail heure par heure.</span></p>' + depthOpt();
    const t = $('#condTime');
    if (t) t.addEventListener('input', () => { C.offset = parseInt(t.value, 10) || 0; renderPanelLabelOnly(); requestDraw(); });
  }
  function renderPanelLabelOnly() { const l = document.querySelector('.cp-time'); if (l) l.firstChild.textContent = fmtWhen(atMs()); }

  /* ---------- bascule de mode ---------- */
  function setMode(m) {
    const on = m === 'cond';
    if (on === C.active) return;
    if (!S.mapObj || !S.mapObj.ready) { A.toast('Carte indisponible', 'error'); return; }
    C.active = on;
    document.querySelectorAll('#modeSwitch [data-act="mode"]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.m === 'cond') === on)));
    const known = $('#btnKnown');
    if (on) {
      if (!C.canvas) {
        C.canvas = document.createElement('canvas'); C.canvas.className = 'condcanvas';
        C.pcv = document.createElement('canvas'); C.pcv.className = 'condcanvas condparticles';
        const raw = S.mapObj.raw, LL = globalThis.L;
        if (raw.createPane && LL && LL.DomUtil) {
          // volet de la carte entre les fonds et les repères : les spots restent visibles au-dessus des couleurs
          const pane = raw.getPane('houleCond') || raw.createPane('houleCond');
          pane.style.zIndex = 450; pane.style.pointerEvents = 'none';
          pane.appendChild(C.canvas); pane.appendChild(C.pcv); C.inPane = true;
        } else { raw.getContainer().appendChild(C.canvas); raw.getContainer().appendChild(C.pcv); }
        C.ctx = C.canvas.getContext('2d'); C.pctx = C.pcv.getContext('2d');
        raw.on('move zoom resize', requestDraw);
        raw.on('movestart zoomstart', stopParticles);
        raw.on('moveend', scheduleRefresh);
      }
      C.canvas.hidden = false; C.pcv.hidden = false;
      $('#condPanel').hidden = false;
      $('#kFilter').hidden = true;
      S.mapObj.setKnownVisible(false);
      renderPanel();
      if (H.global && !H.global.ready && H.global.state !== 'loading') H.global.load().then(() => { if (C.active) { renderPanel(); refresh(); } });
      refresh();
      loadLand();
    } else {
      stopParticles();
      syncDepth();
      if (C.canvas) { C.canvas.hidden = true; C.pcv.hidden = true; C.ctx.clearRect(0, 0, C.canvas.width, C.canvas.height); }
      $('#condPanel').hidden = true;
      const kn = !known || known.getAttribute('aria-pressed') === 'true';
      S.mapObj.setKnownVisible(kn);
      $('#kFilter').hidden = !kn;
    }
    document.getElementById('app').classList.toggle('is-cond', on);
    setTimeout(() => S.mapObj.invalidate(), 60);
  }

  Object.assign(A.actions, {
    mode(el) { setMode(el.dataset.m); },
    condDepthOpt() {
      showDepth = !showDepth;
      try { localStorage.setItem('houle.opt.depth', showDepth ? '1' : '0'); } catch (e) { /* tant pis */ }
      if (!showDepth && C.view === 'depth') { C.view = 'wind'; syncDepth(); refresh(); draw(); }
      renderPanel();
    },
    condView(el) { const k = el.dataset.k; C.view = k === 'swell' ? 'swell' : k === 'depth' ? 'depth' : 'wind'; syncDepth(); stopParticles(); renderPanel(); if (C.view === 'depth') { draw(); return; } refresh(); draw(); },
    condRes(el) { C.res = RES[el.dataset.k] ? el.dataset.k : '5'; renderPanel(); refresh(); },
    condPres() { C.pressure = !C.pressure; renderPanel(); draw(); },
    condNow() { C.offset = 0; renderPanel(); draw(); },
    condAdd(el) { const lat = parseFloat(el.dataset.lat), lon = parseFloat(el.dataset.lon); A.dialog.close(); setMode('normal'); A.openSpotDialog(null, { lat, lon }); },
    wgUnit(el) { unit = el.dataset.u === 'ft' ? 'ft' : 'm'; try { localStorage.setItem('houle.unit', unit); } catch (e) { /* tant pis */ } renderDetail(); },
    wgDef(el) {
      const b = $('#wgDef'), k = el.dataset.k, d = DEFS[k];
      if (!b || !d) return;
      if (!b.hidden && b.dataset.k === k) { b.hidden = true; return; }
      b.dataset.k = k; b.hidden = false;
      b.innerHTML = '<b>' + esc(d[0]) + '</b><br>' + esc(d[1]);
    },
    wgDay(el) { if (C.det) { C.det.sel = clamp(parseInt(el.dataset.i, 10) || 0, 0, C.det.days.length - 1); renderDetail(); } },
  });
  window.addEventListener('resize', () => { if (C.active) { requestDraw(); scheduleRefresh(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && C.active && C.vec && !C.raf) startParticles(); });
  A.cond.setMode = setMode;
})();
