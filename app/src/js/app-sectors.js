/* Houle - réglage des secteurs de houle et de vent sur la carte (vert / orange / rouge), vert de départ d'après la côte,
   et calage des mètres d'eau d'un spot. Rien n'est enregistré ici : on remplit le formulaire du spot. */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, SE = H.sectors;
  const $ = (s, r) => (r || document).querySelector(s);
  const COLORS = { green: '#2fb35a', orange: '#f29a2e', red: '#e24b3b' };
  const EDIT = { open: false, kind: 'swell', models: { swell: null, wind: null }, lat: 0, lon: 0, layers: [], handles: [], onDone: null, onCancel: null };
  A.sectorsEdit = EDIT;
  const ALL = { from: 0, to: 0, orL: 0, orR: 0 };

  /* ---------- lecture / écriture du formulaire du spot ---------- */
  const numv = (id, d) => { const e = document.getElementById(id), v = e ? parseFloat(String(e.value).replace(',', '.')) : NaN; return isFinite(v) ? v : d; };
  function readModels() {
    const on = (id) => { const e = document.getElementById(id); return !!(e && e.checked); };
    return {
      swell: on('f_swOn') ? SE.fix({ from: numv('f_swFrom', 0), to: numv('f_swTo', 360), orL: numv('f_swOrL', 0), orR: numv('f_swOrR', 0) }) : Object.assign({}, ALL),
      wind: on('f_dirOn') ? SE.fix({ from: numv('f_dirFrom', 0), to: numv('f_dirTo', 360), orL: numv('f_dirOrL', 0), orR: numv('f_dirOrR', 0) }) : Object.assign({}, ALL),
    };
  }
  function writeModels(m) {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    const chk = (id, v) => { const e = document.getElementById(id); if (e) { e.checked = v; e.dispatchEvent(new Event('change')); } };
    const all = (x) => SE.widthOf(x) >= 360;
    if (m.swell) { chk('f_swOn', !all(m.swell)); set('f_swFrom', m.swell.from); set('f_swTo', all(m.swell) ? 360 : m.swell.to); set('f_swOrL', m.swell.orL); set('f_swOrR', m.swell.orR); }
    if (m.wind) { chk('f_dirOn', !all(m.wind)); set('f_dirFrom', m.wind.from); set('f_dirTo', all(m.wind) ? 360 : m.wind.to); set('f_dirOrL', m.wind.orL); set('f_dirOrR', m.wind.orR); }
  }

  /* ---------- vert de départ d'après la côte ---------- */
  let segCache = null;
  async function coastStarter(lat, lon) {
    const core = H.exposureCore;
    if (!core || !A.cond || !A.cond.getLand) throw new Error('Côte indisponible');
    const land = await A.cond.getLand();
    if (!land || !land.length) throw new Error('Trait de côte non chargé (connexion ?)');
    if (!segCache) { const rings = []; land.forEach((p) => p.rings.forEach((r) => rings.push(r))); segCache = core.segmentsOf(rings); }
    const e = core.computeExposure(segCache, lat, lon);
    return SE.starter(e.o, e.w);
  }
  A.coastStarter = coastStarter;

  /* ---------- éditeur sur la carte ---------- */
  const pxRadius = () => { const sz = S.mapObj.raw.getSize(); if (EDIT.embedded) return Math.max(55, Math.min(95, Math.min(sz.x, sz.y) * 0.2)); return Math.max(70, Math.min(150, Math.min(sz.x, sz.y) * 0.3)); };
  const toLL = (cx, cy, r, deg, map) => { const t = (deg * Math.PI) / 180; return map.containerPointToLatLng([cx + r * Math.sin(t), cy - r * Math.cos(t)]); };

  function clearLayers() {
    const map = S.mapObj && S.mapObj.raw;
    EDIT.layers.forEach((l) => map && map.removeLayer(l)); EDIT.layers = [];
  }
  function clearHandles() {
    const map = S.mapObj && S.mapObj.raw;
    EDIT.handles.forEach((l) => map && map.removeLayer(l)); EDIT.handles = [];
  }
  function drawSectors() {
    const map = S.mapObj.raw, L = globalThis.L;
    clearLayers();
    const c = map.latLngToContainerPoint([EDIT.lat, EDIT.lon]), r = pxRadius(), m = EDIT.models[EDIT.kind];
    SE.segments(m).forEach((sg) => {
      const pts = [map.containerPointToLatLng([c.x, c.y])];
      for (let a = sg.a; a < sg.b; a += 4) pts.push(toLL(c.x, c.y, r, a, map));
      pts.push(toLL(c.x, c.y, r, sg.b, map));
      EDIT.layers.push(L.polygon(pts, { color: COLORS[sg.cls], weight: 1, fillColor: COLORS[sg.cls], fillOpacity: sg.cls === 'red' ? 0.2 : 0.45, interactive: false }).addTo(map));
    });
  }
  function handleAngles() {
    const m = SE.fix(EDIT.models[EDIT.kind]), w = SE.widthOf(m);
    return { from: m.from, to: m.from + w, orL: m.from - m.orL, orR: m.from + w + m.orR };
  }
  function placeHandles() {
    const map = S.mapObj.raw, L = globalThis.L;
    clearHandles();
    const c = map.latLngToContainerPoint([EDIT.lat, EDIT.lon]), r = pxRadius(), ang = handleAngles();
    const defs = [['from', ang.from, r, 'vert'], ['to', ang.to, r, 'vert'], ['orL', ang.orL, r + 22, 'orange'], ['orR', ang.orR, r + 22, 'orange']];
    defs.forEach(([k, a, rr, cls]) => {
      const mk = L.marker(toLL(c.x, c.y, rr, a, map), { draggable: true, zIndexOffset: 2000, icon: L.divIcon({ className: 'sec-h sec-h--' + cls, iconSize: [26, 26], html: '<i></i>' }), title: k === 'from' || k === 'to' ? 'Bord du vert' : 'Bord de l\'orange' });
      mk.on('drag', () => {
        const p = map.latLngToContainerPoint(mk.getLatLng()), cc = map.latLngToContainerPoint([EDIT.lat, EDIT.lon]);
        const theta = (Math.atan2(p.x - cc.x, -(p.y - cc.y)) * 180) / Math.PI;
        EDIT.models[EDIT.kind] = SE.drag(EDIT.models[EDIT.kind], k, theta);
        drawSectors(); renderSheet(true);
      });
      mk.on('dragend', () => { placeHandles(); });
      mk.addTo(map); EDIT.handles.push(mk);
    });
  }
  const redraw = () => { if (EDIT.open && S.mapObj && S.mapObj.raw) { drawSectors(); placeHandles(); } };

  function renderSheet(textOnly) {
    let el = EDIT.embedded ? $('#clsSec') : $('#secSheet');
    const m = EDIT.models[EDIT.kind];
    const desc = SE.describe(m);
    if (textOnly && el) { const d = $('#secDesc', el); if (d) d.textContent = desc; return; }
    if (!el) { el = document.createElement('div'); el.id = 'secSheet'; el.className = 'cls-sheet sec-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Régler les secteurs'); document.body.appendChild(el); }
    const chip = (k, n) => '<button type="button" class="kf" data-act="secKind" data-k="' + k + '" aria-pressed="' + (EDIT.kind === k) + '">' + n + '</button>';
    el.innerHTML = '<div class="row">' + chip('swell', 'Houle') + chip('wind', 'Vent') + (EDIT.embedded ? '' : '<span class="sp"></span><button type="button" class="btn btn-small" data-act="clsSat">Satellite</button>') + '</div>' +
      '<p class="fine sec-key"><i style="background:' + COLORS.green + '"></i> parfait <i style="background:' + COLORS.orange + '"></i> limite <i style="background:' + COLORS.red + '"></i> pas de vagues</p>' +
      '<p class="fine">' + (EDIT.kind === 'swell' ? 'D\'où vient la houle : tire les ronds sur le cercle autour du spot.' : 'D\'où vient le vent : le vent de terre (offshore) est le plus souvent le vert.') + '</p>' +
      '<p id="secDesc" class="sec-desc">' + U.esc(desc) + '</p>' +
      '<div class="row"><button type="button" class="btn btn-small" data-act="secSide" data-k="L">Orange avant : ' + (m.orL ? 'fermer' : 'ouvrir') + '</button><button type="button" class="btn btn-small" data-act="secSide" data-k="R">Orange après : ' + (m.orR ? 'fermer' : 'ouvrir') + '</button><button type="button" class="btn btn-small" data-act="secAuto">Vert d\'après la côte</button></div>' +
      (EDIT.embedded ? '' : '<div class="dlg-actions"><button class="btn" data-act="secCancel">Annuler</button><span class="sp"></span><button class="btn btn-primary" data-act="secDone">Terminé</button></div>');
  }

  /* mode intégré à la fiche « Classer » : le camembert apparaît tout de suite sur la carte, déjà proposé d'après la côte */
  function attach(lat, lon) {
    if (!S.mapObj || !S.mapObj.ready || !S.mapObj.raw || !globalThis.L || !globalThis.L.polygon) return false;
    const map = S.mapObj.raw;
    map.off('zoomend moveend', redraw);
    Object.assign(EDIT, { open: true, embedded: true, lat, lon, kind: 'swell', onDone: null, onCancel: null,
      models: { swell: SE.fix({ from: 215, to: 325, orL: 35, orR: 35 }), wind: SE.fix({ from: 40, to: 140, orL: 30, orR: 30 }) } });
    map.on('zoomend moveend', redraw);
    renderSheet(false); redraw();
    coastStarter(lat, lon).then((st) => {
      if (!EDIT.open || EDIT.lat !== lat || EDIT.lon !== lon) return;
      if (st.swell) EDIT.models.swell = st.swell; if (st.wind) EDIT.models.wind = st.wind;
      renderSheet(false); redraw();
    }).catch(() => {});
    return true;
  }
  function detach() { if (EDIT.open && EDIT.embedded) { closeEditor(); } EDIT.embedded = false; }
  A.sec = { attach, detach, models: () => (EDIT.open && EDIT.embedded ? { swell: EDIT.models.swell, wind: EDIT.models.wind } : null), redraw };

  function openEditor(lat, lon, models, onDone, onCancel) {
    if (!S.mapObj || !S.mapObj.ready || !S.mapObj.raw || !globalThis.L || !globalThis.L.polygon) { A.toast('Carte indisponible : règle les angles dans les champs.', 'error'); return false; }
    Object.assign(EDIT, { open: true, lat, lon, models: { swell: models.swell, wind: models.wind }, onDone, onCancel });
    S.mapObj.raw.once('moveend', redraw);
    S.mapObj.flyTo(lat, lon, 12);
    S.mapObj.raw.on('zoomend moveend', redraw);
    renderSheet(false); redraw();
    return true;
  }
  function closeEditor() {
    EDIT.open = false;
    clearLayers(); clearHandles();
    const map = S.mapObj && S.mapObj.raw; if (map) map.off('zoomend moveend', redraw);
    const el = $('#secSheet'); if (el) el.remove();
    if (EDIT.embedded) { const e2 = $('#clsSec'); if (e2) e2.innerHTML = ''; }
  }

  Object.assign(A.actions, {
    /* depuis le formulaire du spot : on cache la fenêtre le temps de régler sur la carte, puis on la remet */
    sectors() {
      const c = U.parseCoords((document.getElementById('f_coords') || {}).value || '');
      if (!c) { A.toast('Place d\'abord le spot (coordonnées).', 'error'); return; }
      const d = document.getElementById('dlg');
      const ok = openEditor(c.lat, c.lon, readModels(), (m) => { writeModels(m); if (d && !d.open) d.showModal(); }, () => { if (d && !d.open) d.showModal(); });
      if (ok && d && d.open) { d.__pending = (d.__pending || 0) + 1; d.close(); }
    },
    async sectorsAuto(el) {
      const c = U.parseCoords((document.getElementById('f_coords') || {}).value || '');
      if (!c) { A.toast('Place d\'abord le spot (coordonnées).', 'error'); return; }
      if (el) el.disabled = true;
      try { const st = await coastStarter(c.lat, c.lon); writeModels(st); A.toast('Vert proposé d\'après la côte : à ajuster selon ton expérience'); }
      catch (e) { A.toast(e.message || 'Impossible de calculer', 'error'); }
      if (el) el.disabled = false;
    },
    secKind(el) { EDIT.kind = el.dataset.k === 'wind' ? 'wind' : 'swell'; renderSheet(false); redraw(); },
    secSide(el) {
      const m = SE.fix(EDIT.models[EDIT.kind]), side = el.dataset.k === 'L' ? 'orL' : 'orR';
      EDIT.models[EDIT.kind] = SE.fix(Object.assign({}, m, { [side]: m[side] ? 0 : 25 }));
      renderSheet(false); redraw();
    },
    async secAuto(el) {
      if (el) el.disabled = true;
      try { const st = await coastStarter(EDIT.lat, EDIT.lon); if (st.swell) EDIT.models.swell = st.swell; if (st.wind) EDIT.models.wind = st.wind; A.toast('Vert proposé d\'après la côte : à ajuster'); }
      catch (e) { A.toast(e.message || 'Impossible de calculer', 'error'); }
      renderSheet(false); redraw();
    },
    secDone() { const cb = EDIT.onDone, m = EDIT.models; closeEditor(); if (cb) cb(m); },
    secCancel() { const cb = EDIT.onCancel; closeEditor(); if (cb) cb(); },
    /* caler les mètres d'eau : « tel jour à telle heure, environ X m d'eau » → eau au niveau moyen */
    async calWater(el) {
      const msg = $('#calMsg'), c = U.parseCoords((document.getElementById('f_coords') || {}).value || '');
      const date = (document.getElementById('cal_date') || {}).value, hour = parseInt((document.getElementById('cal_hour') || {}).value, 10), m = numv('cal_m', NaN);
      if (!c || !date || !isFinite(hour) || hour < 0 || hour > 23 || !isFinite(m)) { if (msg) msg.textContent = 'Remplis le jour, l\'heure et les mètres d\'eau.'; return; }
      el.disabled = true; if (msg) msg.textContent = 'Calcul…';
      try {
        const lvl = await H.cond.tideAt(c.lat, c.lon, date, hour);
        const ref = Math.round((m - lvl) * 10) / 10, e = document.getElementById('f_waterRef');
        if (e) e.value = ref;
        if (msg) msg.textContent = 'Fait : ' + ref.toString().replace('.', ',') + ' m d\'eau au niveau moyen (marée du modèle ce jour-là : ' + (lvl < 0 ? '−' : '+') + Math.abs(lvl).toFixed(1).replace('.', ',') + ' m).';
      } catch (err) { if (msg) msg.textContent = err.message || 'Calage impossible'; }
      el.disabled = false;
    },
  });
})();
