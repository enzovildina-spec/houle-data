/* Houle - « Autour de moi » (rayon en km) pour Mes spots et Alertes, et classement des spots « à classer » */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, SC = H.spotclass, SE = H.sectors;
  const esc = U.esc;
  const RADII = [20, 50, 100, 200];
  const KEY = 'houle.near.radius';
  let saved = 50;
  try { const v = parseInt(localStorage.getItem(KEY), 10); if (RADII.indexOf(v) !== -1) saved = v; } catch (e) { /* stockage indisponible */ }
  const N = { on: false, radius: saved, center: null, busy: false, err: '' };
  A.near = N;

  A.inNear = (spot) => !N.on || SC.inRadius(N.center, N.radius, spot);

  /* bloc de réglage : bouton + rayons + résumé */
  A.nearBlock = (total, shown, what) => {
    let out = '<div class="near"><div class="row"><button type="button" class="btn btn-small" data-act="nearToggle" aria-pressed="' + N.on + '"' + (N.busy ? ' disabled' : '') + '>' + A.icon('locate') + (N.busy ? 'Localisation…' : 'Autour de moi') + '</button>' +
      '<span class="fine">Rayon</span>' + RADII.map((r) => '<button type="button" class="kf" data-act="nearRadius" data-k="' + r + '" aria-pressed="' + (N.radius === r) + '">' + r + ' km</button>').join('') + '</div>';
    if (N.err) out += '<p class="fine" role="alert">' + esc(N.err) + '</p>';
    else if (N.on) out += '<p class="fine">' + shown + ' ' + what + ' dans ' + N.radius + ' km autour de toi, sur ' + total + '. <button type="button" class="btn btn-small" data-act="nearOff">Tout afficher</button></p>';
    else out += '<p class="fine">Active « Autour de moi » pour ne garder que ce qui est près de toi.</p>';
    return out + '</div>';
  };

  Object.assign(A.actions, {
    async nearToggle() {
      if (N.on) { N.on = false; N.err = ''; A.render(); return; }
      N.busy = true; N.err = ''; A.render();
      try { const p = await S.mapObj.locate(); N.center = { lat: p.lat, lon: p.lon }; N.on = true; }
      catch (e) { N.err = 'Position introuvable : autorise la localisation pour ce site dans les réglages du téléphone.'; }
      N.busy = false; A.render();
    },
    nearOff() { N.on = false; N.err = ''; A.render(); },
    nearRadius(el) {
      N.radius = parseInt(el.dataset.k, 10);
      try { localStorage.setItem(KEY, String(N.radius)); } catch (e) { /* ignoré */ }
      A.render();
    },
  });

  /* ---------- spots à classer ---------- */
  const C = { ids: [], i: 0, sel: [], done: 0, alerted: 0 };
  A.classBanner = () => {
    const n = SC.toClassify(S.spots).length;
    if (!n) return '';
    return '<div class="notice notice--class"><span><b>' + n + ' spot' + (n > 1 ? 's' : '') + ' à classer</b> : surf, bodyboard, longboard ou autre (plusieurs possibles).</span><button class="btn btn-small btn-primary" data-act="classStart">Classer</button></div>';
  };

  A.validBanner = () => {
    const n = S.spots.filter((s) => !H.spotclass.needsClass(s) && !H.spotclass.isValidated(s)).length;
    const ok = S.spots.filter((s) => H.spotclass.isValidated(s)).length;
    if (!S.spots.length) return '';
    return '<p class="fine valid-sum">' + ok + ' spot' + (ok > 1 ? 's' : '') + ' validé' + (ok > 1 ? 's' : '') + ' (surveillé' + (ok > 1 ? 's' : '') + ' tout seul)' + (n ? ' · ' + n + ' à compléter (ouvre un spot, puis « Compléter »)' : '') + '.</p>';
  };

  /* ---------- classer + régler les alertes, en regardant le spot sur la carte ----------
     Une fiche en bas d'écran (la carte reste visible) : la carte zoome sur le spot, on choisit la discipline
     et, d'un coup, les conditions pour être prévenu. Les réglages sont repris d'un spot au suivant. */
  const DIRS = [['auto', 'D\'après la côte (proposé)'], ['', 'Toutes'], ['0', 'Nord'], ['45', 'Nord-est'], ['90', 'Est'], ['135', 'Sud-est'], ['180', 'Sud'], ['225', 'Sud-ouest'], ['270', 'Ouest'], ['315', 'Nord-ouest']];
  const TIDES = [['all', 'Toutes les marées'], ['low', 'Basse mer'], ['mid', 'Mi-marée'], ['high', 'Haute mer']];
  const CFG = { alerts: true, waveMin: 1, waveMax: 3, periodMin: 8, periodMax: 0, windMax: 25, swell: 'auto', wind: 'auto', tide: 'all' };
  const arc = (c) => (c === '' ? [0, 360] : [(parseInt(c, 10) + 315) % 360, (parseInt(c, 10) + 45) % 360]);
  const $s = () => document.getElementById('clsSheet');
  const optHtml = (list, cur) => list.map((o) => '<option value="' + o[0] + '"' + (String(cur) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');

  function closeSheet() { if (A.sec) A.sec.detach(); const el = $s(); if (el) el.remove(); if (S.mapObj && S.mapObj.setCurrent) S.mapObj.setCurrent(null); }

  // le spot en cours de validation : sélectionné, repère vert, et la carte se centre exactement sur son point GPS
  // (dans la partie de la carte que la fiche ne cache pas), avec un zoom moyen pour garder le contexte autour
  const FOCUS_ZOOM = 14;
  function showOnMap(s) {
    if (!S.mapObj) return;
    S.selectedId = s.id;
    if (S.mapObj.setCurrent) S.mapObj.setCurrent(s.id);
    let shift = null;
    try {
      const el = $s(), mapEl = S.mapObj.raw && S.mapObj.raw.getContainer && S.mapObj.raw.getContainer();
      if (el && mapEl) shift = U.visibleShift(mapEl.getBoundingClientRect(), el.getBoundingClientRect());
    } catch (e) { shift = null; }
    if (S.mapObj.focusOn) S.mapObj.focusOn(s.lat, s.lon, FOCUS_ZOOM, shift);
    else S.mapObj.flyTo(s.lat, s.lon, FOCUS_ZOOM);
  }

  function step() {
    // saute les spots déjà classés ou supprimés entre-temps
    while (C.i < C.ids.length && !S.spots.find((s) => s.id === C.ids[C.i] && SC.needsClass(s))) C.i++;
    if (C.i >= C.ids.length) {
      closeSheet();
      const left = SC.toClassify(S.spots).length;
      A.dialog.open('<div class="dlg"><h2>' + (left ? 'Pause' : 'Tout est classé') + '</h2><p>' + C.done + ' spot(s) classé(s)' + (C.alerted ? ', dont ' + C.alerted + ' surveillé(s) : Houle te prévient quand leurs conditions arrivent' : '') + (left ? ' ; ' + left + ' restent à classer (tu peux reprendre quand tu veux).' : '. Merci !') + '</p><div class="dlg-actions"><span class="sp"></span><button class="btn btn-primary" data-act="classEnd">OK</button></div></div>');
      return;
    }
    const s = S.spots.find((x) => x.id === C.ids[C.i]);
    C.sel = [];
    const chips = SC.DISCS.map((d) => '<button type="button" class="kf kf--big" data-act="clsToggle" data-k="' + d.k + '" aria-pressed="false"><i class="dchip dchip--' + d.cls + '"></i>' + d.label + '</button>').join('');
    const nm = String(s.name || '').trim() && !/^Spot importé$/.test(s.name) ? esc(s.name) : '<i>Spot sans nom</i>';
    const num = (id, label, v, st, mn) => '<label class="fld">' + label + '<input id="' + id + '" type="number" step="' + st + '" min="' + mn + '" value="' + v + '" inputmode="decimal"></label>';
    let el = $s();
    if (!el) { el = document.createElement('div'); el.id = 'clsSheet'; el.className = 'cls-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Classer ce spot'); document.body.appendChild(el); }
    el.innerHTML = '<div class="cls-top"><div><span class="fine">Spot ' + (C.i + 1) + ' sur ' + C.ids.length + '</span><div class="cls-name">' + nm + '</div></div>' +
      '<button type="button" class="btn btn-small" data-act="clsSat" title="Vue satellite">Satellite</button><button type="button" class="btn btn-small" data-act="classEnd" aria-label="Arrêter">✕</button></div>' +
      (s.notes ? '<p class="cls-notes"><b>Tes notes :</b> ' + esc(String(s.notes).slice(0, 260)) + '</p>' : '') +
      '<div class="cls-chips" role="group" aria-label="Disciplines">' + chips + '</div>' +
      '<div id="clsSecWrap"><p class="fine">Le camembert sur la carte : <b>vert = houle (ou vent) parfait</b>, orange = limite, rouge = rien. Je le propose d\'après la côte, c\'est toi qui le règles.</p><div id="clsSec" class="cls-sec"></div>' +
      '<div id="clsSelFallback" hidden><div class="grid2"><label class="fld">Houle venant de<select id="cl_sw">' + optHtml(DIRS, CFG.swell) + '</select></label><label class="fld">Vent venant de<select id="cl_wd">' + optHtml(DIRS, CFG.wind) + '</select></label></div></div></div>' +
      '<label class="chk cls-al"><input id="cl_alerts" type="checkbox"' + (CFG.alerts ? ' checked' : '') + '> Me prévenir quand les conditions de ce spot arrivent</label>' +
      '<div id="clsCond" class="cls-cond"' + (CFG.alerts ? '' : ' hidden') + '><div class="grid2">' + num('cl_wmin', 'Houle min (m)', CFG.waveMin, 0.1, 0) + num('cl_wmax', 'Houle max (m)', CFG.waveMax, 0.1, 0) + '</div>' +
      '<div class="grid2">' + num('cl_per', 'Période min (s)', CFG.periodMin, 1, 0) + num('cl_perMax', 'Période max (s), 0 = sans limite', CFG.periodMax, 1, 0) + '</div><div class="grid2">' + num('cl_wind', 'Vent max (km/h)', CFG.windMax, 1, 0) + '<span></span></div>' +
      '<label class="fld">Marée<select id="cl_tide">' + optHtml(TIDES, CFG.tide) + '</select></label></div>' +
      '<div class="dlg-actions"><button class="btn" data-act="clsSkip">Passer</button><span class="sp"></span><button class="btn btn-primary" id="clsOk" data-act="clsSave" disabled>Valider et suivant</button></div>';
    showOnMap(s);
    if (A.sec) A.sec.detach();
    const on = A.sec && A.sec.attach(s.lat, s.lon);
    const fb = document.getElementById('clsSelFallback'), hint = document.querySelector('#clsSecWrap > .fine');
    if (!on) { if (fb) fb.hidden = false; if (hint) hint.hidden = true; }
  }
  const next = () => { C.i++; step(); };
  const val = (id, d) => { const v = parseFloat(String((document.getElementById(id) || {}).value || '').replace(',', '.')); return isFinite(v) ? v : d; };

  // case à cocher : un clic « data-act » est bloqué par le gestionnaire commun, on écoute le changement
  document.addEventListener('change', (ev) => { if (ev.target && ev.target.id === 'cl_alerts') { CFG.alerts = !!ev.target.checked; const c = document.getElementById('clsCond'); if (c) c.hidden = !CFG.alerts; } });

  Object.assign(A.actions, {
    classStart() { C.ids = SC.toClassify(S.spots).map((s) => s.id); C.i = 0; C.done = 0; C.alerted = 0; closeSheet(); step(); },
    clsToggle(el) {
      const k = el.dataset.k, i = C.sel.indexOf(k);
      if (i === -1) C.sel.push(k); else C.sel.splice(i, 1);
      el.setAttribute('aria-pressed', String(i === -1));
      document.getElementById('clsOk').disabled = !C.sel.length;
    },
    clsSat() { if (S.mapObj && S.mapObj.toggleSatellite) S.mapObj.toggleSatellite(); },
    clsSkip() { next(); },
    async clsSave() {
      const s = S.spots.find((x) => x.id === C.ids[C.i]);
      if (!s || !C.sel.length) return;
      CFG.alerts = !!document.getElementById('cl_alerts').checked;
      let rules = Object.assign({}, s.rules || {});
      let extra = {};
      if (CFG.alerts) {
        CFG.waveMin = val('cl_wmin', CFG.waveMin); CFG.waveMax = Math.max(CFG.waveMin, val('cl_wmax', CFG.waveMax));
        CFG.periodMin = val('cl_per', CFG.periodMin); CFG.periodMax = Math.max(0, val('cl_perMax', 0)); CFG.windMax = val('cl_wind', CFG.windMax);
        if (CFG.periodMax > 0 && CFG.periodMax < CFG.periodMin) CFG.periodMax = 0;
        CFG.swell = document.getElementById('cl_sw').value; CFG.wind = document.getElementById('cl_wd').value; CFG.tide = document.getElementById('cl_tide').value;
        const drawn = A.sec && A.sec.models();
        // secteurs : « d'après la côte » = vert + orange proposés par la forme de la côte ; sinon quatre points cardinaux (±45°)
        const mdl = (choice, k) => (choice === 'auto' ? (coast && coast[k]) || SE.fix({ from: 0, to: 0, orL: 0, orR: 0 }) : SE.fix({ from: arc(choice)[0], to: arc(choice)[1], orL: 0, orR: 0 }));
        let coast = null;
        if (!drawn && (CFG.swell === 'auto' || CFG.wind === 'auto')) { try { coast = await A.coastStarter(s.lat, s.lon); } catch (e) { coast = null; } }
        const sw = drawn ? SE.fix(drawn.swell) : mdl(CFG.swell, 'swell'), wd = drawn ? SE.fix(drawn.wind) : mdl(CFG.wind, 'wind');
        Object.assign(rules, { waveMin: CFG.waveMin, waveMax: CFG.waveMax, periodMin: CFG.periodMin, periodMax: CFG.periodMax, windMax: CFG.windMax, swellOn: true, swellFrom: sw.from, swellTo: sw.to, swellOrL: sw.orL, swellOrR: sw.orR, dirOn: true, dirFrom: wd.from, dirTo: wd.to, dirOrL: wd.orL, dirOrR: wd.orR, tide: CFG.tide, tideMin: -9, tideMax: 9 });
        extra = { quiet: false };
      }
      const saved = await S.store.saveSpot(Object.assign({}, s, extra, { rules: SC.classify(rules, C.sel) }));
      const j = S.spots.findIndex((x) => x.id === saved.id);
      if (j >= 0) S.spots[j] = Object.assign({}, S.spots[j], saved);
      C.done++;
      if (CFG.alerts) C.alerted++;
      if (A.refreshForecasts && CFG.alerts) A.refreshForecasts(false, S.spots[j]);
      next();
    },
    classEnd() { closeSheet(); A.dialog.close(); A.render(); A.syncMap(); },
  });
})();
