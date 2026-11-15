/* Houle - « Autour de moi » (rayon en km) pour Mes spots et Alertes, et classement des spots « à classer » */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, SC = H.spotclass;
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
  const C = { ids: [], i: 0, sel: [], done: 0 };
  A.classBanner = () => {
    const n = SC.toClassify(S.spots).length;
    if (!n) return '';
    return '<div class="notice notice--class"><span><b>' + n + ' spot' + (n > 1 ? 's' : '') + ' à classer</b> : surf, bodyboard, longboard ou autre (plusieurs possibles).</span><button class="btn btn-small btn-primary" data-act="classStart">Classer</button></div>';
  };

  function step() {
    // saute les spots déjà classés ou supprimés entre-temps
    while (C.i < C.ids.length && !S.spots.find((s) => s.id === C.ids[C.i] && SC.needsClass(s))) C.i++;
    if (C.i >= C.ids.length) {
      const left = SC.toClassify(S.spots).length;
      A.dialog.open('<div class="dlg"><h2>' + (left ? 'Pause' : 'Tout est classé') + '</h2><p>' + C.done + ' spot(s) classé(s)' + (left ? ', ' + left + ' restent à classer (tu peux reprendre quand tu veux).' : '. Merci !') + '</p><div class="dlg-actions"><span class="sp"></span><button class="btn btn-primary" data-act="classEnd">OK</button></div></div>');
      return;
    }
    const s = S.spots.find((x) => x.id === C.ids[C.i]);
    C.sel = [];
    const chips = SC.DISCS.map((d) => '<button type="button" class="kf kf--big" data-act="clsToggle" data-k="' + d.k + '" aria-pressed="false"><i class="dchip dchip--' + d.cls + '"></i>' + d.label + '</button>').join('');
    A.dialog.open('<div class="dlg"><h2>Classer ce spot</h2><p class="fine">Spot ' + (C.i + 1) + ' sur ' + C.ids.length + '</p>' +
      '<p class="cls-name">' + esc(s.name) + '</p><p class="fine">' + esc(U.fmtCoords(s.lat, s.lon)) + '</p>' +
      '<p>Pour quelle(s) discipline(s) ce spot marche-t-il ?</p><div class="cls-chips" role="group" aria-label="Disciplines">' + chips + '</div>' +
      '<div class="dlg-actions"><button class="btn" data-act="classEnd">Arrêter</button><button class="btn" data-act="clsSkip">Passer</button><span class="sp"></span><button class="btn btn-primary" id="clsOk" data-act="clsSave" disabled>Valider</button></div></div>');
  }
  const next = () => { C.i++; step(); };

  Object.assign(A.actions, {
    classStart() { C.ids = SC.toClassify(S.spots).map((s) => s.id); C.i = 0; C.done = 0; step(); },
    clsToggle(el) {
      const k = el.dataset.k, i = C.sel.indexOf(k);
      if (i === -1) C.sel.push(k); else C.sel.splice(i, 1);
      el.setAttribute('aria-pressed', String(i === -1));
      document.getElementById('clsOk').disabled = !C.sel.length;
    },
    clsSkip() { next(); },
    async clsSave() {
      const s = S.spots.find((x) => x.id === C.ids[C.i]);
      if (!s || !C.sel.length) return;
      const saved = await S.store.saveSpot(Object.assign({}, s, { rules: SC.classify(s.rules, C.sel) }));
      const j = S.spots.findIndex((x) => x.id === saved.id);
      if (j >= 0) S.spots[j] = Object.assign({}, S.spots[j], saved);
      C.done++;
      next();
    },
    classEnd() { A.dialog.close(); A.render(); A.syncMap(); },
  });
})();
