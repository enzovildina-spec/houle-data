/* Houle - importer des lieux depuis Google Maps (ou tout fichier KML / KMZ / GeoJSON / CSV) comme spots PRIVÉS.
   L'appli LIT le fichier : rien n'est modifié ni supprimé chez Google, et l'import ne touche à aucun spot existant. */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, I = H.importer;
  const esc = U.esc;
  const $ = (q) => document.querySelector(q);
  const LAST_KEY = 'houle.lastImport';
  const ST = { res: null, file: '' };

  const lastBatch = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { return null; } };
  const mineOf = (batch) => S.spots.filter((s) => s.batch === batch);

  function step1() {
    const last = lastBatch(), n = last ? mineOf(last.id).length : 0;
    A.dialog.open(
      '<div class="dlg"><h2>Importer mes spots</h2><p class="muted" style="margin:-6px 0 8px;font-size:12px">Version de l\'appli : ' + (H.version || '?') + '</p>' +
      '<p class="knote"><b>Tes données Google ne sont jamais touchées.</b> Tu fais une copie dans un fichier, l\'appli lit ce fichier et ajoute les lieux à tes spots, <b>privés</b> sur cet appareil. Elle ne supprime ni ne modifie aucun de tes spots existants, et tu peux annuler l\'import.</p>' +
      '<details open><summary><b>Comment récupérer mes lieux</b></summary>' +
      '<p><b>Si tes spots sont dans une carte « Mes cartes »</b> (le plus simple, avec les coordonnées) : ouvre google.com/mymaps, ouvre ta carte, touche les trois points ⋮ à côté du titre, puis « Exporter au format KML/KMZ » et télécharge.</p>' +
      '<p><b>Si ce sont des lieux enregistrés ou des listes</b> : va sur takeout.google.com, clique « Tout désélectionner », coche « Maps (mes adresses) » et/ou « Lieux enregistrés », puis crée l\'export. Dézippe-le et choisis le fichier <i>.json</i> ou <i>.csv</i>. Les listes en .csv n\'ont parfois pas de coordonnées : l\'appli te dira combien de lieux sont ignorés.</p></details>' +
      '<div class="row"><button class="btn btn-small" data-act="export">Sauvegarder d\'abord mes spots actuels</button></div>' +
      '<label class="fld">Fichier à importer<input id="ip_file" type="file" accept=".kml,.kmz,.json,.geojson,.csv,.txt"></label>' +
      '<div id="ipMsg" class="fine" aria-live="polite"></div>' +
      (last && n ? '<hr><p class="fine">Dernier import : ' + n + ' spot(s) ajouté(s) le ' + esc(new Date(last.at).toLocaleDateString('fr-FR')) + '. <button class="btn btn-small" data-act="ipUndo" data-batch="' + esc(last.id) + '">Annuler cet import</button></p>' : '') +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button></div></div>',
      () => { $('#ip_file').addEventListener('change', onFile); }
    );
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0], msg = $('#ipMsg');
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { msg.textContent = 'Fichier trop gros (25 Mo maximum).'; return; }
    msg.textContent = 'Lecture du fichier…';
    try {
      const res = await I.parseFile(await f.arrayBuffer(), f.name);
      I.markDuplicates(res.items, S.spots);
      ST.res = res; ST.file = f.name;
      if (!res.items.length) { msg.textContent = 'Aucun lieu avec coordonnées trouvé dans ce fichier (' + res.total + ' lieu(x) lu(s)' + (res.noCoords ? ', ' + res.noCoords + ' sans coordonnées' : '') + '). Pour des listes Google, essaie le fichier .json de Takeout ou une carte « Mes cartes » en KML.'; return; }
      step2();
    } catch (err) { msg.textContent = err.message || 'Fichier illisible.'; }
  }

  function step2() {
    const r = ST.res, total = r.items.length, dups = r.items.filter((x) => x.dup).length;
    const cap = S.mode === 'local' ? 5000 : 100;
    const rows = r.items.slice(0, 400).map((it, i) => '<label class="ip-row"><input type="checkbox" data-i="' + i + '"' + (it.dup ? '' : ' checked') + '> <span class="ip-n">' + esc(it.name) + '</span> <span class="fine">' + esc(it.lat.toFixed(4) + ', ' + it.lon.toFixed(4)) + (it.dup ? ' · ' + esc(it.dup) : '') + '</span></label>').join('');
    A.dialog.open(
      '<div class="dlg"><h2>Aperçu de l\'import</h2>' +
      '<p><b>' + total + ' lieu(x)</b> avec coordonnées (' + esc(r.format) + ', ' + esc(ST.file) + ')' + (dups ? ', dont ' + dups + ' déjà présent(s), décoché(s)' : '') + '.' +
      (r.noCoords ? ' ' + r.noCoords + ' sans coordonnées ignoré(s).' : '') + (r.notPoint ? ' ' + r.notPoint + ' tracé(s) ou zone(s) ignoré(s).' : '') + '</p>' +
      (total > 400 ? '<p class="fine">Seuls les 400 premiers sont listés ci-dessous ; les autres sont importés avec la sélection « tout ».</p>' : '') +
      '<div class="row"><button class="btn btn-small" data-act="ipAll" data-v="1">Tout cocher</button><button class="btn btn-small" data-act="ipAll" data-v="0">Tout décocher</button></div>' +
      '<div class="ip-list">' + rows + '</div>' +
      '<label class="fld">Discipline pour ces spots<select id="ip_disc"><option value="s">Surf</option><option value="b">Bodyboard</option><option value="l">Longboard</option></select></label>' +
      '<label class="chk"><input id="ip_follow" type="checkbox"> Suivre la houle et envoyer des alertes pour tous ces spots maintenant</label>' +
      '<p class="fine">Laisse décoché si tu en importes beaucoup : la prévision se charge quand tu ouvres un spot, et tu peux activer « Suivre » spot par spot.</p>' +
      (S.mode !== 'local' ? '<p class="fine">Maximum ' + cap + ' spots à la fois avec un compte.</p>' : '') +
      '<div id="ipCount" class="fine"></div>' +
      '<div class="dlg-actions"><button class="btn" data-act="ipBack">Retour</button><span class="sp"></span><button class="btn btn-primary" data-act="ipGo" id="ipGo">Importer</button></div></div>',
      (d) => { d.addEventListener('change', count); count(); }
    );
  }
  const picked = () => Array.from(document.querySelectorAll('.ip-row input:checked')).map((c) => +c.dataset.i);
  function count() {
    const r = ST.res, shown = Math.min(400, r.items.length), sel = picked().length + (r.items.length > 400 ? r.items.slice(400).filter((x) => !x.dup).length : 0);
    const el = $('#ipCount'), b = $('#ipGo');
    if (el) el.textContent = sel + ' spot(s) seront ajoutés.';
    if (b) b.disabled = sel === 0;
    return shown;
  }

  async function go() {
    const r = ST.res, cap = S.mode === 'local' ? 5000 : 100;
    const idx = new Set(picked());
    let items = r.items.filter((it, i) => (i < 400 ? idx.has(i) : !it.dup));
    if (items.length > cap) items = items.slice(0, cap);
    const disc = $('#ip_disc').value, follow = $('#ip_follow').checked, batch = 'imp-' + Date.now().toString(36);
    const btn = $('#ipGo'); btn.disabled = true;
    let done = 0;
    try {
      for (const it of items) {
        await S.store.saveSpot({ id: U.uid(), name: it.name, lat: it.lat, lon: it.lon, notes: it.notes, linkUrl: '', rules: { disc }, batch, ...(follow ? {} : { quiet: true }) });
        done++;
        if (done % 25 === 0) btn.textContent = 'Import… ' + done + ' / ' + items.length;
      }
    } catch (e) { A.fail(e); }
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ id: batch, at: Date.now(), n: done })); } catch (e) { /* ignore */ }
    S.spots = await S.store.listSpots();
    A.render(); A.syncMap();
    if (S.mapObj && S.mapObj.ready) S.mapObj.fitAll(S.spots);
    if (follow) A.refreshForecasts(false);
    A.dialog.open(
      '<div class="dlg"><h2>Import terminé</h2><p><b>' + done + ' spot(s) ajouté(s)</b>, privés sur cet appareil. Rien n\'a été modifié chez Google ni dans tes spots existants.</p>' +
      (follow ? '' : '<p class="fine">Ouvre un spot pour voir sa prévision, ou touche « Suivre » pour activer ses alertes.</p>') +
      '<div class="dlg-actions"><button class="btn" data-act="ipUndo" data-batch="' + esc(batch) + '">Annuler cet import</button><span class="sp"></span><button class="btn btn-primary" data-act="closeDlg">OK</button></div></div>'
    );
  }

  async function undo(batch) {
    const mine = mineOf(batch);
    const untouched = mine.filter((s) => (s.updatedAt || 0) - (s.createdAt || 0) < 3000 && !(s.notes && s.notes.startsWith('​')));
    for (const s of untouched) await S.store.deleteSpot(s.id);
    S.spots = await S.store.listSpots();
    try { localStorage.removeItem(LAST_KEY); } catch (e) { /* ignore */ }
    A.render(); A.syncMap();
    const kept = mine.length - untouched.length;
    A.dialog.open('<div class="dlg"><h2>Import annulé</h2><p>' + untouched.length + ' spot(s) retiré(s).' + (kept ? ' ' + kept + ' spot(s) modifié(s) depuis l\'import ont été conservés.' : '') + '</p><div class="dlg-actions"><button class="btn btn-primary" data-act="closeDlg">OK</button></div></div>');
  }

  Object.assign(A.actions, {
    importPlaces() { step1(); },
    ipBack() { step1(); },
    ipAll(el) { document.querySelectorAll('.ip-row input').forEach((c) => { c.checked = el.dataset.v === '1'; }); count(); },
    ipGo() { go(); },
    ipUndo(el) { undo(el.dataset.batch); },
    async followSpot(el) {
      const s = S.spots.find((x) => x.id === el.dataset.id);
      if (!s) return;
      await S.store.saveSpot(Object.assign({}, s, { quiet: false }));
      S.spots = await S.store.listSpots();
      A.render();
      const s2 = S.spots.find((x) => x.id === el.dataset.id);
      if (s2) A.refreshForecasts(true, s2);
    },
  });

  // un spot importé « au repos » charge sa prévision quand on l'ouvre
  const sel = A.selectSpot;
  A.selectSpot = (id, fly) => {
    sel(id, fly);
    const s = S.spots.find((x) => x.id === id);
    if (s && s.quiet && !S.fc[id]) A.refreshForecasts(false, s);
  };
})();
