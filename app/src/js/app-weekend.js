/* Houle - onglet « Week-end » : classement des spots autour de moi selon mes critères */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, F = H.forecast;
  const esc = U.esc;
  const W = { status: 'idle', radius: 100, disc: 's', center: null, centerLabel: '', results: [], done: 0, total: 0, error: '', token: 0 };
  const DISC = { s: ['Surf', 0], b: ['Bodyboard', 1], l: ['Longboard', 2] };
  const MAX_SPOTS = 24;

  const km = (a, b) => {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  };
  const isWeekend = (date) => { const d = U.dayDate(date).getDay(); return d === 0 || d === 6; };

  // spots candidats : mes spots (leurs propres critères) + spots connus de la discipline choisie
  function candidates() {
    const idx = DISC[W.disc][1], out = [];
    (S.spots || []).forEach((s) => out.push({ kind: 'mine', id: s.id, name: s.name, region: 'Mon spot', lat: s.lat, lon: s.lon, rules: s.rules }));
    (A.known || []).forEach((k) => {
      if (k.d[idx] >= 1 || (k.d.every((v) => v < 0) && k.p === W.disc)) out.push({ kind: 'known', i: k.i, name: k.name, region: k.region, lat: k.lat, lon: k.lon, rules: Object.assign(A.knownRules(k), { disc: W.disc }) });
    });
    out.forEach((c) => { c.km = km(W.center, c); });
    return out.filter((c) => c.km <= W.radius).sort((a, b) => a.km - b.km).slice(0, MAX_SPOTS);
  }

  // note d'un spot sur les jours de week-end (bon créneau = 2 points, créneau limite = 1)
  function score(days) {
    const we = days.filter((d) => isWeekend(d.date));
    const use = we.length ? we : days.slice(0, 2);
    let pts = 0, best = null;
    use.forEach((d) => {
      const p = d.status === 'good' ? 2 : d.status === 'maybe' ? 1 : 0;
      pts += p;
      if (!best || p > best.p || (p === best.p && d.window && best.d.window && d.window.len > best.d.window.len)) best = { p, d };
    });
    return { pts, best };
  }

  async function run() {
    if (!W.center) return;
    const token = ++W.token, list = candidates();
    W.status = 'loading'; W.results = []; W.done = 0; W.total = list.length; W.error = '';
    A.render();
    if (!list.length) { W.status = 'ok'; A.render(); return; }
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const c = list[next++];
        try {
          const data = await F.getForecast(c.lat, c.lon);
          if (token !== W.token) return;
          const days = F.evaluateSpot(data, c.rules), sc = score(days);
          W.results.push(Object.assign({ days }, c, sc));
        } catch (e) {
          if (/429|Trop de requêtes/.test(e.message || '')) W.error = 'Open-Meteo est saturé : réessaie dans quelques minutes.';
        }
        W.done++;
        if (token === W.token) A.render();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (token !== W.token) return;
    W.results.sort((a, b) => b.pts - a.pts || a.km - b.km);
    W.status = 'ok';
    A.render();
  }

  const stat = (d) => U.num(d.stats.wave) + ' m à ' + U.num(d.stats.period, 0) + ' s · vent ' + U.num(d.stats.wind, 0) + ' km/h ' + U.compass(d.stats.windDir);
  function card(r, n) {
    const d = r.best.d, good = r.best.p === 2;
    const when = U.fmtDay(d.date) + (d.window ? ' · ' + F.windowText(d.window) : '');
    return '<article class="wk wk--' + (good ? 'good' : r.best.p ? 'maybe' : 'no') + '"><div class="wk-rank">' + n + '</div><div class="wk-main">' +
      '<div class="wk-name">' + esc(r.name) + ' <span class="fine">' + esc(r.region) + ' · ' + Math.round(r.km) + ' km</span></div>' +
      (r.best.p ? '<div class="wk-when"><b>' + (good ? 'Bon créneau' : 'Créneau limite') + '</b> ' + esc(when) + '</div><div class="fine">' + esc(stat(d)) + '</div>' : '<div class="fine">Pas de créneau correct ce week-end' + (d.fail ? ' : ' + esc(F.failText(d)) : '') + '</div>') +
      '</div><button class="btn btn-small" data-act="wkOpen" data-kind="' + r.kind + '" data-id="' + esc(String(r.kind === 'mine' ? r.id : r.i)) + '">Voir</button></article>';
  }

  A.renderers.weekend = () => {
    const chip = (k) => '<button type="button" class="kf" data-act="wkDisc" data-k="' + k + '" aria-pressed="' + (W.disc === k) + '">' + DISC[k][0] + '</button>';
    const rad = [50, 100, 200].map((r) => '<button type="button" class="kf" data-act="wkRadius" data-k="' + r + '" aria-pressed="' + (W.radius === r) + '">' + r + ' km</button>').join('');
    let out = '<div class="wk-head"><h2>Où surfer ce week-end ?</h2><p class="fine">Je classe les spots autour de toi selon tes critères (houle, période, vent) pour samedi et dimanche. Pour tes propres spots, ce sont les critères que tu as réglés ; pour les spots connus, ceux conseillés.</p>' +
      '<div class="row">' + chip('s') + chip('b') + chip('l') + '</div><div class="row"><span class="fine">Rayon</span>' + rad + '</div>' +
      '<div class="row"><button class="btn btn-primary" data-act="wkLocate">' + A.icon('locate') + 'Autour de ma position</button><button class="btn" data-act="wkMap">Autour du centre de la carte</button></div>' +
      (W.center ? '<p class="fine">Centre : ' + esc(W.centerLabel) + '</p>' : '') + '</div>';
    if (W.status === 'loading') out += '<p class="fine" aria-live="polite">Analyse des prévisions… ' + W.done + ' / ' + W.total + ' spots</p>';
    if (W.error) out += '<p class="cp-warn" role="note">' + esc(W.error) + '</p>';
    if (W.status === 'ok') {
      const top = W.results.slice(0, 10);
      out += top.length ? '<div class="wk-list">' + top.map((r, i) => card(r, i + 1)).join('') + '</div>' + (W.results.some((r) => r.pts > 0) ? '' : '<p class="fine">Aucun bon créneau ce week-end dans ce rayon : essaie un rayon plus large.</p>')
        : '<p class="fine">Aucun spot dans ce rayon. Agrandis le rayon.</p>';
      out += '<p class="fine">Prévisions Open-Meteo, houle au large : à confirmer avant de partir. Seuls les ' + MAX_SPOTS + ' spots les plus proches sont analysés.</p>';
    }
    return out;
  };

  Object.assign(A.actions, {
    wkDisc(el) { W.disc = el.dataset.k; if (W.center) run(); else A.render(); },
    wkRadius(el) { W.radius = parseInt(el.dataset.k, 10); if (W.center) run(); else A.render(); },
    async wkLocate() {
      try { const p = await S.mapObj.locate(); W.center = { lat: p.lat, lon: p.lon }; W.centerLabel = 'ta position'; run(); } catch (e) { A.fail(e); }
    },
    wkMap() {
      const raw = S.mapObj.raw;
      const c = raw && raw.getCenter ? raw.getCenter() : null;
      if (!c) { A.toast('Carte indisponible : utilise ta position.', 'error'); return; }
      W.center = { lat: c.lat, lon: c.lng }; W.centerLabel = U.fmtCoords(c.lat, c.lng); run();
    },
    wkOpen(el) {
      if (el.dataset.kind === 'mine') { S.tab = 'spots'; A.selectSpot(el.dataset.id, true); } else A.showKnown(parseInt(el.dataset.id, 10), true);
    },
  });
  A.weekend = W;
})();
