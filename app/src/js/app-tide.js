/* Houle - onglet « Marées » : heures et hauteurs de pleine et basse mer d'un port ou d'un spot, sur 7 jours.
   Source : modèle de marée d'Open-Meteo (gratuit), ordre de grandeur. Pour l'horaire officiel : annuaire du SHOM (lien). */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, K = H.cond;
  const esc = U.esc;
  const T = { place: null, status: 'idle', data: null, error: '', token: 0 };
  /* ports : nom, latitude, longitude (point proche de l'eau) */
  const PORTS = [
    ['Dunkerque', 51.05, 2.37], ['Calais', 50.97, 1.85], ['Dieppe', 49.93, 1.08], ['Le Havre', 49.48, 0.1], ['Cherbourg', 49.65, -1.62],
    ['Saint-Malo', 48.65, -2.03], ['Roscoff', 48.73, -3.98], ['Brest', 48.38, -4.49], ['Camaret-sur-Mer', 48.28, -4.59], ['Audierne', 48.02, -4.55],
    ['Saint-Guénolé (Penmarc\'h)', 47.80, -4.38], ['Concarneau', 47.87, -3.92], ['Lorient', 47.73, -3.36], ['Quiberon', 47.48, -3.12], ['La Trinité-sur-Mer', 47.58, -3.0],
    ['Le Croisic', 47.29, -2.52], ['Saint-Nazaire', 47.27, -2.2], ['Les Sables-d\'Olonne', 46.49, -1.8], ['La Rochelle', 46.15, -1.17], ['Royan', 45.62, -1.03],
    ['Cap Ferret (Arcachon)', 44.64, -1.25], ['Mimizan', 44.21, -1.29], ['Capbreton', 43.65, -1.45], ['Biarritz', 43.48, -1.56], ['Saint-Jean-de-Luz', 43.4, -1.67],
  ];
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (ms, off) => { const d = new Date((ms + off) * 1000); return d.getUTCHours() + ' h ' + pad(d.getUTCMinutes()); };
  const dayKey = (ms, off) => { const d = new Date((ms + off) * 1000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const sgn = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1).replace('.', ',') + ' m';

  async function load(place, fetchFn) {
    const tok = ++T.token;
    T.place = place; T.status = 'loading'; T.error = ''; T.data = null;
    A.render();
    try {
      const f = fetchFn || globalThis.fetch.bind(globalThis);
      const url = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + place.lat.toFixed(4) + '&longitude=' + place.lon.toFixed(4) + '&hourly=sea_level_height_msl&cell_selection=sea&timeformat=unixtime&timezone=auto&forecast_days=8';
      const r = await f(url);
      if (!r.ok) throw new Error('Marée indisponible pour le moment (' + r.status + ')');
      const j = await r.json();
      const t = (j.hourly && j.hourly.time) || [], tide = ((j.hourly && j.hourly.sea_level_height_msl) || []).map((v) => (v == null ? null : +v));
      if (!t.length || !tide.some((v) => v != null)) throw new Error('Pas de données de marée à cet endroit (trop loin de la mer ou hors du modèle).');
      if (tok !== T.token) return;
      T.data = { t, tide, off: j.utc_offset_seconds || 0, ext: K.tideExtremes(t, tide) };
      T.status = 'ok';
    } catch (e) {
      if (tok !== T.token) return;
      T.status = 'error'; T.error = e.message || 'Marée indisponible';
    }
    A.render();
  }

  function curve(d) {
    const W = 720, Ht = 120, pl = 4, pr = 4, pt = 8, pb = 20, iw = W - pl - pr, ih = Ht - pt - pb;
    const n = Math.min(d.t.length, 24 * 4), vs = d.tide.slice(0, n).filter((v) => v != null), lo = Math.min(...vs), hi = Math.max(...vs), rg = Math.max(0.3, hi - lo);
    const X = (i) => pl + (i / (n - 1)) * iw, Y = (v) => pt + ih - ((v - lo) / rg) * ih;
    const pts = []; for (let i = 0; i < n; i++) if (d.tide[i] != null) pts.push(X(i).toFixed(1) + ',' + Y(d.tide[i]).toFixed(1));
    let g = '';
    for (let i = 0; i < n; i++) {
      const h = new Date((d.t[i] + d.off) * 1000).getUTCHours();
      if (h === 0) { g += '<line x1="' + X(i).toFixed(1) + '" x2="' + X(i).toFixed(1) + '" y1="' + pt + '" y2="' + (pt + ih) + '" class="sep"/><text x="' + (X(i) + 3).toFixed(1) + '" y="' + (Ht - 5) + '" class="dl">' + esc(U.weekdayShort(dayKey(d.t[i], d.off)) + ' ' + new Date((d.t[i] + d.off) * 1000).getUTCDate()) + '</text>'; }
    }
    const nowI = d.t.findIndex((s) => s >= Date.now() / 1000), nowX = nowI > 0 && nowI < n ? '<line x1="' + X(nowI).toFixed(1) + '" x2="' + X(nowI).toFixed(1) + '" y1="' + pt + '" y2="' + (pt + ih) + '" class="now"/>' : '';
    const ex = d.ext.filter((e) => e.t >= d.t[0] && e.t <= d.t[n - 1]).map((e) => {
      const x = pl + ((e.t - d.t[0]) / (d.t[n - 1] - d.t[0])) * iw;
      return '<circle cx="' + x.toFixed(1) + '" cy="' + Y(e.h).toFixed(1) + '" r="3" class="tide-pt"/>';
    }).join('');
    return '<svg class="wg-sum tide-svg" viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="Courbe de marée sur 4 jours">' + g + '<polyline class="tide-l" points="' + pts.join(' ') + '"/>' + ex + nowX +
      '<text x="' + (W - pr - 2) + '" y="' + (pt + 9) + '" text-anchor="end" class="ax">de ' + sgn(lo) + ' à ' + sgn(hi) + '</text></svg>';
  }

  function days(d) {
    const by = new Map();
    d.ext.forEach((e) => { const k = dayKey(e.t, d.off); if (!by.has(k)) by.set(k, []); by.get(k).push(e); });
    const list = [...by.entries()].filter(([k]) => k >= dayKey(Date.now() / 1000, d.off)).slice(0, 7);
    // marnage du jour (écart entre pleine et basse mer voisines) comparé aux autres jours : repère « grande » ou « petite » marée
    const rng = list.map(([, es]) => { const hs = es.map((e) => e.h); return Math.max(...hs) - Math.min(...hs); });
    const mx = Math.max(...rng, 0.01);
    return list.map(([k, es], i) => {
      const r = rng[i] / mx;
      const tag = r >= 0.92 ? 'marée forte' : r <= 0.65 ? 'marée faible' : 'marée moyenne';
      return '<li class="tide-day"><div class="tide-d"><b>' + esc(U.fmtDay(k)) + '</b> <span class="fine">' + tag + ' · marnage ≈ ' + rng[i].toFixed(1).replace('.', ',') + ' m</span></div><div class="tide-ex">' +
        es.map((e) => '<span class="tide-e ' + e.type + '"><b>' + (e.type === 'high' ? 'Pleine mer' : 'Basse mer') + '</b> ' + hm(e.t, d.off) + ' <small>' + sgn(e.h) + '</small></span>').join('') + '</div></li>';
    }).join('');
  }

  A.renderers = A.renderers || {};
  A.renderers.tides = () => {
    const mine = (S.spots || []).map((s, i) => '<option value="s' + i + '"' + (T.place && T.place.key === 's' + i ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const ports = PORTS.map((p, i) => '<option value="p' + i + '"' + (T.place && T.place.key === 'p' + i ? ' selected' : '') + '>' + esc(p[0]) + '</option>').join('');
    let out = '<div class="wk-head"><h3>Marées</h3>' +
      '<label class="fine" for="tidePlace">Lieu</label> <select id="tidePlace"><option value="">Choisir un port ou un spot…</option><optgroup label="Ports">' + ports + '</optgroup>' + (mine ? '<optgroup label="Mes spots">' + mine + '</optgroup>' : '') + '</select> ' +
      '<button class="btn btn-small" data-act="tideMap">Centre de la carte</button></div>';
    if (T.status === 'idle') out += '<p class="fine">Choisis un port ou un de tes spots pour voir les pleines et basses mers des 7 prochains jours.</p>';
    if (T.status === 'loading') out += '<p class="fine" aria-live="polite">Chargement de la marée…</p>';
    if (T.status === 'error') out += '<p class="cp-warn" role="note">' + esc(T.error) + '</p>';
    if (T.status === 'ok' && T.data) {
      out += '<p class="fine"><b>' + esc(T.place.name) + '</b> · heures locales du lieu</p>' + curve(T.data) + '<ul class="tide-list">' + days(T.data) + '</ul>' +
        '<p class="fine">Hauteurs par rapport au niveau moyen de la mer (pas au zéro des cartes marines). Modèle mondial d\'Open-Meteo : c\'est un ordre de grandeur, les heures peuvent varier de 15 à 30 minutes et les hauteurs davantage près des côtes (estuaires, baies). Pour l\'horaire officiel : <a href="https://maree.shom.fr/" target="_blank" rel="noopener">annuaire des marées du SHOM</a>.</p>';
    }
    return out;
  };

  Object.assign(A.actions, {
    tidePick(el) {
      const v = el.value || '';
      if (!v) return;
      const i = parseInt(v.slice(1), 10);
      if (v[0] === 'p' && PORTS[i]) load({ key: v, name: PORTS[i][0], lat: PORTS[i][1], lon: PORTS[i][2] });
      if (v[0] === 's' && S.spots[i]) load({ key: v, name: S.spots[i].name, lat: S.spots[i].lat, lon: S.spots[i].lon });
    },
    tideMap() {
      const c = S.mapObj && S.mapObj.raw && S.mapObj.raw.getCenter ? S.mapObj.raw.getCenter() : null;
      if (!c) { A.toast('Carte indisponible', 'error'); return; }
      load({ key: 'c', name: 'Centre de la carte (' + U.fmtCoords(c.lat, c.lng) + ')', lat: c.lat, lon: c.lng });
    },
  });
  document.addEventListener('change', (ev) => { const el = ev.target; if (el && el.id === 'tidePlace') A.actions.tidePick(el); });
  A.tide = { load, PORTS, state: T };
})();
