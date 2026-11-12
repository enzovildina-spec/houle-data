/* Houle - lien de partage d'un spot ou d'une session, lisible sans compte (tout est dans l'adresse) */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, F = H.forecast;
  const esc = U.esc;
  const $ = (s) => document.querySelector(s);
  const PUBLIC_URL = 'https://enzovildina-spec.github.io/houle-data/houle.html';
  const DISC = { s: 'Surf', b: 'Bodyboard', l: 'Longboard' };
  const TIDE = { low: 'marée basse', mid: 'mi-marée', high: 'marée haute', all: 'toutes marées' };
  const NUM_KEYS = ['waveMin', 'waveMax', 'periodMin', 'windMax', 'dirFrom', 'dirTo', 'swellFrom', 'swellTo', 'hourFrom', 'hourTo'];
  const BOOL_KEYS = ['dirOn', 'swellOn'];

  const b64enc = (obj) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64dec = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  };
  const baseUrl = () => (location.protocol === 'file:' || !location.host ? PUBLIC_URL : location.origin + location.pathname);

  /* ---- fabrication du lien ---- */
  function payload(spot, opts) {
    const R = spot.rules || {}, r = {};
    NUM_KEYS.forEach((k) => { if (typeof R[k] === 'number' && Number.isFinite(R[k])) r[k] = R[k]; });
    BOOL_KEYS.forEach((k) => { if (R[k]) r[k] = true; });
    if (DISC[R.disc]) r.disc = R.disc;
    if (TIDE[R.tide]) r.tide = R.tide;
    const p = { v: 1, n: String(spot.name).slice(0, 80), la: +spot.lat.toFixed(5), lo: +spot.lon.toFixed(5), r };
    if (opts.notes && spot.notes) p.no = String(spot.notes).slice(0, 600);
    if (opts.session && opts.session.date) p.s = { d: opts.session.date, f: opts.session.from, t: opts.session.to };
    return p;
  }
  const nextGood = (spot) => {
    const f = S.fc[spot.id];
    const d = f && f.days && f.days.find((x) => x.status === 'good' && x.window);
    return d ? { date: d.date, from: d.window.from, to: d.window.to } : null;
  };
  const makeLink = (spot, opts) => baseUrl() + '#spot=' + b64enc(payload(spot, opts));

  A.actions.linkSpot = (el) => {
    const spot = S.spots.find((s) => s.id === el.dataset.id);
    if (!spot) return;
    const ses = nextGood(spot);
    A.dialog.open(
      '<div class="dlg"><h2>Lien de partage</h2>' +
      '<p class="fine">Envoie ce lien à n\'importe qui : il s\'ouvre sans compte et propose d\'ajouter le spot. Rien n\'est stocké sur un serveur, tout est dans l\'adresse.</p>' +
      '<label class="fld">Lien<input id="lk_url" type="text" readonly></label>' +
      '<label class="chk"><input id="lk_notes" type="checkbox"> Inclure mes notes (elles restent privées sinon)</label>' +
      (ses ? '<label class="chk"><input id="lk_ses" type="checkbox"> Proposer la prochaine bonne session : ' + esc(U.fmtDay(ses.date)) + ' ' + esc(F.windowText(ses)) + '</label>' : '') +
      '<p class="fine">Les photos ne sont pas envoyées.</p>' +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span>' +
      (navigator.share ? '<button class="btn" data-act="lkShare">Partager…</button>' : '') + '<button class="btn btn-primary" data-act="lkCopy">Copier le lien</button></div></div>',
      () => {
        const upd = () => { $('#lk_url').value = makeLink(spot, { notes: $('#lk_notes').checked, session: $('#lk_ses') && $('#lk_ses').checked ? ses : null }); };
        ['#lk_notes', '#lk_ses'].forEach((q) => { const e = $(q); if (e) e.addEventListener('change', upd); });
        $('#lk_url').addEventListener('focus', (e) => e.target.select());
        upd();
      }
    );
  };
  A.actions.lkCopy = async () => {
    const inp = $('#lk_url');
    try { await navigator.clipboard.writeText(inp.value); A.toast('Lien copié'); } catch (e) { inp.focus(); inp.select(); A.toast('Sélectionne le lien et copie-le (Ctrl+C)'); }
  };
  A.actions.lkShare = async () => { try { await navigator.share({ title: 'Spot de surf', url: $('#lk_url').value }); } catch (e) { /* annulé */ } };

  /* ---- lecture d'un lien reçu ---- */
  const clampNum = (v, a, b) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : null);
  function parse(hash) {
    const m = /^#spot=([A-Za-z0-9_-]+)$/.exec(hash || '');
    if (!m) return null;
    let p;
    try { p = b64dec(m[1]); } catch (e) { return null; }
    if (!p || p.v !== 1 || typeof p.n !== 'string') return null;
    const la = clampNum(p.la, -90, 90), lo = clampNum(p.lo, -180, 180);
    if (la == null || lo == null) return null;
    const rules = {};
    NUM_KEYS.forEach((k) => { const v = clampNum(p.r && p.r[k], -1000, 1000); if (v != null) rules[k] = v; });
    BOOL_KEYS.forEach((k) => { if (p.r && p.r[k] === true) rules[k] = true; });
    if (p.r && DISC[p.r.disc]) rules.disc = p.r.disc;
    if (p.r && TIDE[p.r.tide]) rules.tide = p.r.tide;
    const out = { name: p.n.slice(0, 80), lat: la, lon: lo, rules, notes: typeof p.no === 'string' ? p.no.slice(0, 600) : '', session: null };
    if (p.s && /^\d{4}-\d{2}-\d{2}$/.test(p.s.d) && Number.isInteger(p.s.f) && Number.isInteger(p.s.t)) out.session = { date: p.s.d, from: clampNum(p.s.f, 0, 24), to: clampNum(p.s.t, 0, 24) };
    return out;
  }
  A.parseShareLink = parse;
  A.hasLink = () => !!parse(location.hash);

  A.handleLink = () => {
    const p = parse(location.hash);
    if (!p) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    const R = p.rules, cond = [];
    if (R.waveMin != null && R.waveMax != null) cond.push('Houle ' + U.num(R.waveMin) + '–' + U.num(R.waveMax) + ' m');
    if (R.periodMin) cond.push('période ≥ ' + U.num(R.periodMin, 0) + ' s');
    if (R.windMax != null && R.windMax < 99) cond.push('vent ≤ ' + U.num(R.windMax, 0) + ' km/h');
    if (R.swellOn) cond.push('houle de ' + U.compass(R.swellFrom) + ' à ' + U.compass(R.swellTo));
    if (R.dirOn) cond.push('vent de ' + U.compass(R.dirFrom) + ' à ' + U.compass(R.dirTo));
    if (R.tide) cond.push(TIDE[R.tide]);
    S.sharedLink = p;
    A.dialog.open(
      '<div class="dlg"><h2>Spot partagé : ' + esc(p.name) + '</h2>' +
      '<p class="fine">' + esc(U.fmtCoords(p.lat, p.lon)) + (R.disc ? ' · ' + esc(DISC[R.disc]) : '') + '</p>' +
      (p.session ? '<p><b>Session proposée :</b> ' + esc(U.fmtDay(p.session.date)) + ' ' + esc(F.windowText(p.session)) + '</p>' : '') +
      (cond.length ? '<p>Conditions conseillées : ' + esc(cond.join(' · ')) + '</p>' : '') +
      (p.notes ? '<p class="knote">' + esc(p.notes) + '</p>' : '') +
      '<p class="fine">Position envoyée par quelqu\'un : vérifie-la sur satellite avant de t\'y rendre.</p>' +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span><button class="btn" data-act="lkMap">Voir sur la carte</button><button class="btn btn-primary" data-act="lkAdd">Ajouter à mes spots</button></div></div>'
    );
    if (S.mapObj && S.mapObj.ready) S.mapObj.flyTo(p.lat, p.lon, 13);
    return true;
  };
  Object.assign(A.actions, {
    lkMap() { const p = S.sharedLink; A.dialog.close(); if (p && S.mapObj) S.mapObj.flyTo(p.lat, p.lon, 14); },
    lkAdd() { const p = S.sharedLink; A.dialog.close(); if (p) A.openSpotDialog(null, { lat: p.lat, lon: p.lon, name: p.name, rules: p.rules, notes: p.notes }); },
  });
})();
