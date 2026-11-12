/* Houle - spots connus (base de départ, à confirmer sur satellite) */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, F = H.forecast;
  const esc = U.esc;
  const TYPES = { beach: 'beach break', reef: 'reef', point: 'point break', rivermouth: 'embouchure', other: 'spot' };
  const DISC = { s: { n: 'Surf', c: 'surf' }, b: { n: 'Bodyboard', c: 'body' }, l: { n: 'Longboard', c: 'long' } };
  const TIDE = { low: 'marée basse', mid: 'mi-marée', high: 'marée haute', all: 'toutes marées' };
  const LEVEL = { beginner: 'débutant', intermediate: 'intermédiaire', advanced: 'confirmé', all: 'tous niveaux' };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const KNOWN = (H.knownSpots || []).map((r, i) => {
    const x = r[6] || {};
    return { i, name: r[0], lat: r[1], lon: r[2], type: r[3], region: r[4], sure: r[5] === 1, p: x.p || 's', d: x.d || [-1, -1, -1], sw: x.sw || null, wd: x.wd || null, ti: x.ti || null, sz: x.sz || null, lv: x.lv || null, alt: x.alt || null, est: !!x.est, read: !!x.ok, n: norm(r[0] + ' ' + r[4] + ' ' + (x.alt || '')) };
  });
  A.known = KNOWN;
  const kfc = {}; // prévisions chargées pour les spots connus

  A.searchKnown = (q) => {
    const t = norm(q);
    if (t.length < 2) return [];
    const words = t.split(' ');
    return KNOWN.filter((k) => words.every((w) => k.n.indexOf(w) !== -1)).slice(0, 6);
  };

  const arc = (a) => (a ? U.compass(a[0]) + ' → ' + U.compass(a[1]) + ' (' + a[0] + '° à ' + a[1] + '°)' : null);
  const sayDisc = (k) => {
    const lab = ['Surf', 'Bodyboard', 'Longboard'];
    const best = [], ok = [];
    k.d.forEach((v, j) => { if (v === 2) best.push(lab[j]); else if (v === 1) ok.push(lab[j]); });
    return (best.length ? '<b>' + best.join(', ') + '</b>' : '') + (ok.length ? (best.length ? ' · possible : ' : 'possible : ') + ok.join(', ') : '');
  };

  /* le spot est-il déjà dans mes spots (moins de 150 m) ? */
  function mine(k) {
    const R = 6371000, p = Math.PI / 180;
    return S.spots.find((s) => {
      const x = (s.lon - k.lon) * p * Math.cos(((s.lat + k.lat) / 2) * p), y = (s.lat - k.lat) * p;
      return R * Math.hypot(x, y) < 150;
    });
  }

  function rulesFor(k) {
    const r = { disc: k.p };
    if (k.sw) { r.swellOn = true; r.swellFrom = k.sw[0]; r.swellTo = k.sw[1]; }
    if (k.wd) { r.dirOn = true; r.dirFrom = k.wd[0]; r.dirTo = k.wd[1]; }
    if (k.sz) { r.waveMin = k.sz[0]; r.waveMax = k.sz[1]; }
    return r;
  }

  function fcBlock(i) {
    const f = kfc[i];
    if (!f) return '<button class="btn btn-small" data-act="knownFc" data-i="' + i + '">🌊 Voir la houle prévue</button>';
    if (f.status === 'loading') return '<p class="fine">Chargement de la prévision…</p>';
    if (f.status === 'error') return '<p class="fine">' + esc(f.error) + ' <button class="btn btn-small" data-act="knownFc" data-i="' + i + '">Réessayer</button></p>';
    const e = F.swellEmoji(f.days);
    const cells = f.days.map((d, j) => '<div class="cell cell--' + d.status + '" title="' + esc(U.fmtDay(d.date)) + '"><span class="cd">' + (j === 0 ? 'auj.' : esc(U.weekdayShort(d.date))) + '</span><span class="cb"><i style="height:' + Math.max(10, Math.min(100, Math.round(((d.waveMax || 0) / 4) * 100))) + '%"></i></span><span class="cv">' + U.num(d.stats.wave) + '</span></div>').join('');
    return '<p class="kfc-head"><span class="swe big">' + e.emoji + '</span> <b>' + e.label + '</b> dans les 3 prochains jours (jusqu\'à ' + U.num(e.wave) + ' m)</p><div class="strip">' + cells + '</div>' +
      '<p class="fine">Vert : conditions réunies d\'après les réglages conseillés pour ce spot. Houle du modèle Open-Meteo, au large.</p>';
  }

  A.showKnown = (i, fly) => {
    const k = KNOWN[i];
    if (!k) return;
    if (fly) S.mapObj.flyTo(k.lat, k.lon, 15);
    const have = mine(k);
    const cond = [];
    if (k.sw) cond.push('<li>Houle : <b>' + arc(k.sw) + '</b></li>');
    if (k.wd) cond.push('<li>Vent favorable : <b>' + arc(k.wd) + '</b></li>');
    if (k.ti) cond.push('<li>Marée : <b>' + TIDE[k.ti] + '</b></li>');
    if (k.sz) cond.push('<li>Taille : <b>' + k.sz[0] + ' à ' + k.sz[1] + ' m</b></li>');
    if (k.lv) cond.push('<li>Niveau : <b>' + LEVEL[k.lv] + '</b></li>');
    A.dialog.open(
      '<div class="dlg"><h2><i class="dchip dchip--' + DISC[k.p].c + '"></i>' + esc(k.name) + '</h2>' +
      '<p class="muted">' + esc(k.region) + ' · ' + (TYPES[k.type] || 'spot') + (k.alt ? ' · aussi : ' + esc(k.alt) : '') + '</p>' +
      '<p class="fine">' + U.fmtCoords(k.lat, k.lon) + '</p>' +
      '<p>' + sayDisc(k) + (k.est ? ' <span class="fine">(estimé d\'après le type de spot)</span>' : ' <span class="fine">(indicatif)</span>') + '</p>' +
      (cond.length ? '<h4>Conditions conseillées</h4><ul class="howto">' + cond.join('') + '</ul>' : '<p class="fine">Pas de conditions publiées trouvées pour ce spot : règle les tiennes après l\'ajout.</p>') +
      '<div id="kfc">' + fcBlock(i) + '</div>' +
      '<p class="knote">Position <b>' + (k.sure ? 'recoupée sur plusieurs sources' : 'issue d\'une seule source') + '</b>, précise à environ 300 à 500 m : c\'est souvent le parking ou la plage, pas le pic exact. Après l\'ajout, passe en <b>vue satellite</b> et déplace le repère sur le pic.</p>' +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span>' +
      (have ? '<button class="btn btn-primary" data-act="selectMine" data-id="' + esc(have.id) + '">Déjà dans mes spots</button>'
        : '<button class="btn btn-primary" data-act="addKnown" data-i="' + i + '">Ajouter à mes spots</button>') + '</div></div>'
    );
  };

  async function loadKnownFc(i) {
    const k = KNOWN[i];
    kfc[i] = { status: 'loading' };
    const box = () => document.getElementById('kfc');
    if (box()) box().innerHTML = fcBlock(i);
    try {
      const data = await F.getForecast(k.lat, k.lon);
      kfc[i] = { status: 'ok', days: F.evaluateSpot(data, rulesFor(k)) };
      S.mapObj.setKnownEmoji(i, F.swellEmoji(kfc[i].days).emoji);
    } catch (e) { kfc[i] = { status: 'error', error: e.message }; }
    if (box()) box().innerHTML = fcBlock(i);
  }

  Object.assign(A.actions, {
    goKnown(el) { document.getElementById('searchResults').hidden = true; A.showKnown(parseInt(el.dataset.i, 10), true); },
    knownFc(el) { return loadKnownFc(parseInt(el.dataset.i, 10)); },
    addKnown(el) {
      const k = KNOWN[parseInt(el.dataset.i, 10)];
      A.dialog.close();
      S.mapObj.flyTo(k.lat, k.lon, 16);
      A.openSpotDialog(null, { lat: k.lat, lon: k.lon, name: k.name, rules: rulesFor(k), notes: 'Position de départ issue de la base de spots connus (à confirmer sur satellite).' + (k.read ? ' Conditions conseillées lues sur des sites de spots.' : '') });
    },
    selectMine(el) { A.dialog.close(); A.selectSpot(el.dataset.id, true); },
    kfilter(el) {
      const key = el.dataset.k;
      document.querySelectorAll('#kFilter [data-act="kfilter"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      const idx = { s: 0, b: 1, l: 2 }[key];
      S.mapObj.setKnownFilter(key === 'all' ? null : (k) => k.d[idx] >= 1 || (k.d.every((v) => v < 0) && k.p === key));
      const n = KNOWN.filter((k) => key === 'all' || k.d[idx] >= 1).length;
      A.toast(key === 'all' ? KNOWN.length + ' spots connus' : n + ' spots : ' + DISC[key].n.toLowerCase());
    },
  });

  A.initKnown = () => {
    if (!S.mapObj || !S.mapObj.ready) return;
    S.mapObj.setKnown(KNOWN);
    const b = document.getElementById('btnKnown');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      S.mapObj.setKnownVisible(on);
      document.getElementById('kFilter').hidden = !on;
      A.toast(on ? KNOWN.length + ' spots connus affichés' : 'Spots connus masqués');
    });
  };
})();
