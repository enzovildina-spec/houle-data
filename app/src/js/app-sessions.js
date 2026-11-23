/* Houle - écrans du carnet de sessions : « J'ai surfé » (spot, jour, heures) -> conditions de ce moment -> frise vert / orange / rouge */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, SE = H.sessions;
  const esc = U.esc;
  const $ = (q) => document.querySelector(q);
  const ST = { spotId: '', date: '', from: 13, to: 16, hours: null, marks: {}, brush: 'green', note: '', error: '', loading: false, editId: '' };
  const LBL = { green: 'Parfait', orange: 'Moyen', red: 'Mauvais' };
  const COL = { green: 'var(--ok, #1b9a4b)', orange: '#e08a00', red: '#c4402f' };
  const todayStr = () => U.ymd(new Date());
  const hourOpts = (sel, min, max) => { let o = ''; for (let h = min; h <= max; h++) o += '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + h + ' h</option>'; return o; };
  const dirTxt = (d) => (d == null ? '–' : U.compass(d) + ' ' + Math.round(d) + '°');
  const spotOf = (id) => S.spots.find((s) => s.id === id);

  function formHtml() {
    if (!S.spots.length) return '<div class="dlg"><h2>J\'ai surfé</h2><p>Ajoute d\'abord un spot (bouton « Ajouter un spot »), puis reviens ici.</p><div class="dlg-actions"><button class="btn btn-primary" data-act="closeDlg">OK</button></div></div>';
    const spots = S.spots.map((s) => '<option value="' + esc(s.id) + '"' + (s.id === ST.spotId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    let out = '<div class="dlg ses"><h2>J\'ai surfé</h2><p class="fine">Choisis le spot, le jour et les heures. Houle va chercher la houle, le vent et la marée de ce moment-là. C\'est un modèle mondial : un bon ordre de grandeur, pas une mesure sur le spot.</p>' +
      '<label class="fld">Spot<select id="se_spot">' + spots + '</select></label>' +
      '<div class="grid2"><label class="fld">Jour<input id="se_date" type="date" max="' + todayStr() + '" value="' + esc(ST.date) + '"></label><span></span></div>' +
      '<div class="grid2"><label class="fld">De<select id="se_from">' + hourOpts(ST.from, 0, 23) + '</select></label><label class="fld">À<select id="se_to">' + hourOpts(ST.to, 1, 24) + '</select></label></div>' +
      '<div class="actions"><button class="btn btn-small" data-act="seToday">Aujourd\'hui</button><button class="btn btn-small" data-act="seYesterday">Hier</button><button class="btn btn-primary" data-act="seFetch"' + (ST.loading ? ' disabled' : '') + '>' + (ST.loading ? 'Recherche…' : 'Chercher les conditions') + '</button></div>';
    const sp = spotOf(ST.spotId);
    if (sp && H.ports) out += '<p class="fine" id="seTideSrc">Marée : ' + esc(H.ports.label(H.ports.nearest(sp.lat, sp.lon))) + '. Valeurs : modèle Open-Meteo au point du spot (pas les horaires du port).</p>';
    if (ST.error) out += '<p class="knote" role="alert">' + esc(ST.error) + '</p>';
    if (ST.hours) out += friseHtml();
    out += '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span><button class="btn" data-act="seBook">Carnet</button>' + (ST.hours ? '<button class="btn btn-primary" data-act="seSave">Enregistrer la session</button>' : '') + '</div></div>';
    return out;
  }

  function friseHtml() {
    const br = (k) => '<button type="button" class="se-brush" data-act="seBrush" data-b="' + k + '" aria-pressed="' + (ST.brush === k) + '" style="--c:' + COL[k] + '">' + LBL[k] + '</button>';
    let out = '<h3>Comment c\'était, heure par heure ?</h3><p class="fine">Choisis une couleur, puis touche (ou glisse sur) les heures. <b>Vert</b> = parfait, <b>orange</b> = moyen, <b>rouge</b> = mauvais.</p>' +
      '<div class="se-brushes">' + br('green') + br('orange') + br('red') + '</div>' +
      '<div class="se-tools"><button class="btn btn-small" data-act="seAuto">Pré-remplir d\'après les réglages du spot</button><button class="btn btn-small" data-act="seAll" data-b="green">Tout en vert</button></div>' +
      '<div class="se-frise" id="seFrise" role="group" aria-label="Heures de la session">';
    ST.hours.forEach((x) => {
      const m = ST.marks[x.h] || '';
      out += '<div class="se-row" data-h="' + x.h + '" style="--c:' + (m ? COL[m] : 'transparent') + '"><span class="se-h">' + x.h + ' h</span><span class="se-bar" aria-label="' + (m ? LBL[m] : 'non coloré') + '">' + (m ? LBL[m] : '—') + '</span>' +
        '<span class="se-v">' + U.num(x.wave) + ' m · ' + U.num(x.period, 0) + ' s <small>' + dirTxt(x.waveDir) + '</small></span>' +
        '<span class="se-v">vent ' + U.num(x.wind, 0) + ' km/h <small>' + dirTxt(x.windDir) + '</small></span>' +
        '<span class="se-v">marée ' + (x.tide == null ? '–' : U.num(x.tide, 1) + ' m') + '</span></div>';
    });
    return out + '</div><label class="fld">Note (facultatif)<input id="se_note" type="text" maxlength="200" value="' + esc(ST.note) + '" placeholder="ex. un peu de courant, monde à l\'eau"></label>';
  }

  const reflect = () => { const d = $('#dlg'); if (d) { const y = d.scrollTop; d.innerHTML = formHtml(); mountFrise(); d.scrollTop = y; } };
  function readForm() {
    const g = (q) => { const e = $(q); return e ? e.value : ''; };
    if ($('#se_spot')) { ST.spotId = g('#se_spot'); ST.date = g('#se_date'); ST.from = +g('#se_from'); ST.to = +g('#se_to'); }
    if ($('#se_note')) ST.note = g('#se_note');
  }
  function mountFrise() {
    const fr = $('#seFrise');
    if (!fr) return;
    let down = false;
    const paint = (x, y) => {
      const row = document.elementFromPoint(x, y);
      const r = row && row.closest && row.closest('.se-row');
      if (!r || !fr.contains(r)) return;
      const h = +r.dataset.h;
      if (ST.marks[h] === ST.brush) return;
      ST.marks[h] = ST.brush;
      r.style.setProperty('--c', COL[ST.brush]);
      const bar = r.querySelector('.se-bar'); bar.textContent = LBL[ST.brush]; bar.setAttribute('aria-label', LBL[ST.brush]);
    };
    fr.addEventListener('pointerdown', (e) => { down = true; paint(e.clientX, e.clientY); });
    fr.addEventListener('pointermove', (e) => { if (down) { e.preventDefault(); paint(e.clientX, e.clientY); } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => fr.addEventListener(n, () => { down = false; }));
  }
  function openForm(spotId) {
    if (spotId || !ST.spotId || !spotOf(ST.spotId)) ST.spotId = spotId || (S.spots[0] && S.spots[0].id) || '';
    if (!ST.date) ST.date = U.ymd(new Date(Date.now() - 86400000));
    ST.hours = null; ST.marks = {}; ST.error = ''; ST.editId = ''; ST.note = '';
    A.dialog.open(formHtml(), mountFrise);
  }

  /* ---------- carnet + réglages proposés ---------- */
  async function bookHtml() {
    const list = await SE.book.list();
    let out = '<div class="dlg ses"><h2>Carnet de sessions</h2>';
    if (!list.length) out += '<p class="muted">Aucune session notée pour l\'instant. Touche « J\'ai surfé » pour en ajouter une.</p>';
    const bySpot = {};
    list.forEach((s) => { (bySpot[s.spotId] = bySpot[s.spotId] || []).push(s); });
    Object.keys(bySpot).forEach((id) => {
      const arr = bySpot[id], sp = spotOf(id), name = sp ? sp.name : arr[0].spotName;
      const green = arr.reduce((n, s) => n + Object.keys(s.marks || {}).filter((h) => s.marks[h] === 'green').length, 0);
      out += '<section class="se-spot"><h3>' + esc(name) + ' <small>' + arr.length + ' session' + (arr.length > 1 ? 's' : '') + ' · ' + green + ' h parfaites</small></h3><ul class="se-list">';
      arr.forEach((s) => {
        const bar = Object.keys(s.marks || {}).sort((a, b) => a - b).map((h) => '<i style="background:' + COL[s.marks[h]] + '" title="' + h + ' h : ' + LBL[s.marks[h]] + '"></i>').join('');
        out += '<li><b>' + esc(U.fmtDay(s.date)) + '</b> ' + s.from + 'h–' + s.to + 'h <span class="se-mini">' + bar + '</span>' + (s.note ? ' <small>' + esc(s.note) + '</small>' : '') +
          ' <button class="btn btn-small" data-act="seDel" data-id="' + esc(s.id) + '">Supprimer</button></li>';
      });
      out += '</ul>' + (sp && green ? '<button class="btn btn-small btn-primary" data-act="seSuggest" data-id="' + esc(id) + '">Proposer des réglages pour ce spot</button>' : '') + '</section>';
    });
    return out + '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span><button class="btn btn-primary" data-act="seOpen">J\'ai surfé</button></div></div>';
  }
  const arcTxt = (f, t, l, r) => U.compass(f) + ' ' + f + '° → ' + U.compass(t) + ' ' + t + '°' + (l || r ? ' (orange : ' + l + '° avant, ' + r + '° après)' : '');
  async function suggestHtml(id) {
    const sp = spotOf(id), list = (await SE.book.list()).filter((s) => s.spotId === id), sg = SE.suggest(list);
    if (!sp || !sg) return '<div class="dlg"><h2>Réglages proposés</h2><p>Il faut au moins une heure notée « parfait » pour ce spot.</p><div class="dlg-actions"><button class="btn" data-act="seBook">Retour</button></div></div>';
    const R = sg.rules, rows = [];
    if (R.waveMin != null) rows.push(['Taille de la houle', U.num(R.waveMin) + ' à ' + U.num(R.waveMax) + ' m']);
    if (R.periodMin != null) rows.push(['Période minimum', R.periodMin + ' s']);
    if (R.swellOn) rows.push(['Direction de la houle', arcTxt(R.swellFrom, R.swellTo, R.swellOrL, R.swellOrR)]);
    if (R.windMax != null) rows.push(['Vent maximum', R.windMax + ' km/h']);
    if (R.dirOn) rows.push(['Direction du vent', arcTxt(R.dirFrom, R.dirTo, R.dirOrL, R.dirOrR)]);
    if (R.tideMin != null) rows.push(['Marée (modèle)', U.num(R.tideMin) + ' à ' + U.num(R.tideMax) + ' m']);
    ST.sug = { id, rules: R };
    return '<div class="dlg ses"><h2>Réglages proposés : ' + esc(sp.name) + '</h2><p class="fine">D\'après ' + sg.hoursGreen + ' heure(s) parfaite(s) sur ' + sg.sessions + ' session(s) et ' + sg.hoursOrange + ' heure(s) moyenne(s). C\'est une proposition : rien ne change tant que tu n\'appliques pas.</p>' +
      '<table class="se-sug">' + rows.map((r) => '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>' +
      sg.notes.map((n) => '<p class="fine">' + esc(n) + '</p>').join('') +
      '<div class="dlg-actions"><button class="btn" data-act="seBook">Retour</button><span class="sp"></span><button class="btn btn-primary" data-act="seApply">Appliquer à ce spot</button></div></div>';
  }

  Object.assign(A.actions, {
    sessionOpen: (el) => openForm(el && el.dataset && el.dataset.id),
    seOpen: () => openForm(),
    seToday: () => { readForm(); ST.date = todayStr(); reflect(); },
    seYesterday: () => { readForm(); ST.date = U.ymd(new Date(Date.now() - 86400000)); reflect(); },
    async seFetch() {
      readForm();
      const sp = spotOf(ST.spotId);
      if (!sp) { ST.error = 'Choisis un spot.'; return reflect(); }
      if (!ST.date) { ST.error = 'Choisis le jour.'; return reflect(); }
      if (ST.to <= ST.from) { ST.error = 'L\'heure de fin doit être après le début.'; return reflect(); }
      ST.error = ''; ST.loading = true; reflect();
      try {
        const all = await SE.fetchPast(sp.lat, sp.lon, ST.date);
        const hrs = SE.sessionHours(all, ST.from, ST.to);
        if (!hrs.length) throw new Error('Pas de données pour ces heures.');
        ST.hours = hrs; ST.marks = SE.autoMarks(hrs, sp.rules);
      } catch (e) { ST.error = e.message || 'Conditions indisponibles'; ST.hours = null; }
      ST.loading = false; reflect();
    },
    seBrush: (el) => { readForm(); ST.brush = el.dataset.b; reflect(); },
    seAuto: () => { readForm(); const sp = spotOf(ST.spotId); ST.marks = SE.autoMarks(ST.hours, sp && sp.rules); reflect(); },
    seAll: (el) => { readForm(); ST.hours.forEach((x) => { ST.marks[x.h] = el.dataset.b; }); reflect(); },
    async seSave() {
      readForm();
      const sp = spotOf(ST.spotId);
      if (!sp || !ST.hours) return;
      if (!ST.hours.some((x) => ST.marks[x.h])) { ST.error = 'Colorie au moins une heure.'; return reflect(); }
      const marks = {};
      ST.hours.forEach((x) => { if (ST.marks[x.h]) marks[x.h] = ST.marks[x.h]; });
      await SE.book.save({
        id: U.uid(), spotId: sp.id, spotName: sp.name, lat: sp.lat, lon: sp.lon, date: ST.date, from: ST.from, to: ST.to, marks, note: ST.note.trim(),
        hours: ST.hours.map((x) => ({ h: x.h, wave: x.wave, period: x.period, waveDir: x.waveDir, wind: x.wind, windDir: x.windDir, tide: x.tide })),
      });
      A.toast('Session enregistrée dans le carnet.');
      ST.hours = null;
      A.dialog.open(await bookHtml());
    },
    async seBook() { A.dialog.open(await bookHtml()); },
    async seDel(el) { await SE.book.remove(el.dataset.id); A.dialog.open(await bookHtml()); },
    async seSuggest(el) { A.dialog.open(await suggestHtml(el.dataset.id)); },
    async seApply() {
      const g = ST.sug, sp = g && spotOf(g.id);
      if (!sp) return;
      const rules = Object.assign({}, sp.rules, g.rules);
      const saved = await S.store.saveSpot(Object.assign({}, sp, { rules }));
      S.spots = await S.store.listSpots();
      A.dialog.close(); A.render();
      A.toast('Réglages appliqués à « ' + (saved && saved.name || sp.name) + ' ».');
    },
  });
  /* changer de spot met à jour la ligne « Marée : port de … » sans effacer le reste */
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el || el.id !== 'se_spot') return;
    const sp = spotOf(el.value), p = $('#seTideSrc');
    if (sp && p && H.ports) p.textContent = 'Marée : ' + H.ports.label(H.ports.nearest(sp.lat, sp.lon)) + '. Valeurs : modèle Open-Meteo au point du spot (pas les horaires du port).';
  });
  A.sessionState = ST;
})();
