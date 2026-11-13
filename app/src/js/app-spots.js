/* Houle - onglets Spots et Alertes, fiche d'un spot, recherche, sauvegarde */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const A = H.app, U = H.util, F = H.forecast, S = A.S, $ = A.$;
  const esc = U.esc;

  const photoCache = {}; // id -> tableau de photos (chargées à la demande)
  const photoLoading = {};

  const windyUrl = (s) => {
    const la = s.lat.toFixed(3), lo = s.lon.toFixed(3);
    return 'https://www.windy.com/' + la + '/' + lo + '?waves,' + la + ',' + lo + ',10';
  };

  /* ---------- bandeau de 8 jours ---------- */
  function dayLabel(d, days) {
    const n = A.daysAhead(days, d);
    return U.fmtDay(d.date) + (n === 0 ? " (aujourd'hui)" : n === 1 ? ' (demain)' : '');
  }
  function dayHead(d, days) {
    const n = A.daysAhead(days, d);
    return esc(U.fmtDay(d.date)) + (n === 0 ? '<small>aujourd\'hui</small>' : n === 1 ? '<small>demain</small>' : '');
  }
  function cell(d, days, i) {
    const h = Math.max(10, Math.min(100, Math.round(((d.waveMax || 0) / 4) * 100)));
    const status = d.status === 'good' ? 'session possible' : d.status === 'maybe' ? 'créneau court' : 'pas de session';
    return '<div class="cell cell--' + d.status + '" role="img" aria-label="' + esc(dayLabel(d, days) + ' : ' + status + ', houle ' + U.num(d.stats.wave) + ' m') + '" title="' + esc(dayLabel(d, days) + ' : ' + status) + '">' +
      '<span class="cd">' + (i === 0 ? 'auj.' : esc(U.weekdayShort(d.date))) + '</span><span class="cb"><i style="height:' + h + '%"></i></span><span class="cv">' + U.num(d.stats.wave) + '</span></div>';
  }
  function strip(s) {
    const f = S.fc[s.id];
    if (!f || f.status === 'loading' && !f.days) return '<div class="strip is-loading" aria-label="Chargement de la prévision">' + '<div class="cell"></div>'.repeat(8) + '</div>';
    if (f.status === 'error') return '<div class="fc-error"><span>' + esc(f.error) + '</span><button class="btn btn-small" data-act="retry" data-id="' + esc(s.id) + '">Réessayer</button></div>';
    return '<div class="strip' + (f.status === 'loading' ? ' is-stale' : '') + '">' + f.days.map((d, i) => cell(d, f.days, i)).join('') + '</div>';
  }

  const DISC = { s: ['Surf', 'surf'], b: ['Bodyboard', 'body'], l: ['Longboard', 'long'] };
  const TIDE = { low: 'marée basse', mid: 'mi-marée', high: 'marée haute', all: 'toutes marées' };
  const tideTxt = (s) => (s.rules && TIDE[s.rules.tide] ? ' · ' + TIDE[s.rules.tide] : '');
  const discChip = (s) => { const k = (s.rules && s.rules.disc) || 's'; return '<i class="dchip dchip--' + DISC[k][1] + '" title="' + DISC[k][0] + '"></i>'; };
  const emojiOf = (s) => { const f = S.fc[s.id]; if (!f || !f.days) return ''; const e = F.swellEmoji(f.days); return ' <span class="swe" title="' + esc(e.label + ' (' + U.num(e.wave) + ' m)') + '">' + e.emoji + '</span>'; };
  A.emojiForSpot = (id) => { const f = S.fc[id]; return f && f.days ? F.swellEmoji(f.days).emoji : ''; };

  function detail(s) {
    const f = S.fc[s.id];
    let out = '<div class="detail">';
    if (f && f.days) {
      out += '<table class="days"><tbody>' + f.days.map((d) => {
        const lab = dayHead(d, f.days);
        if (d.status === 'no') return '<tr class="d--no"><th scope="row">' + lab + '</th><td colspan="3" class="why">' + esc(F.failText(d) || 'Conditions non réunies') + '</td></tr>';
        return '<tr class="d--' + d.status + '"><th scope="row">' + lab + '</th><td class="win">' + esc(F.windowText(d.window)) + '</td><td>' + U.num(d.stats.wave) + ' m · ' + U.num(d.stats.period, 0) + ' s</td><td class="wnd">' + A.windArrow(d.stats.windDir) + U.num(d.stats.wind, 0) + ' km/h ' + esc(U.compass(d.stats.windDir)) + '</td></tr>';
      }).join('') + '</tbody></table>';
      out += '<p class="fine">Houle du modèle Open-Meteo (large, pas sur le pic). Les vagues réelles dépendent aussi de la marée et de l\'exposition du spot.</p>';
    }
    if (s.notes) out += '<p class="notes">' + esc(s.notes).replace(/\n/g, '<br>') + '</p>';
    const ph = photoCache[s.id];
    if (s.photoCount && !ph) out += '<p class="fine">Chargement des photos…</p>';
    if (ph && ph.length) out += '<div class="photos">' + ph.map((p) => (U.safeImg(p) ? '<img src="' + U.safeImg(p) + '" alt="Photo du spot ' + esc(s.name) + '">' : '')).join('') + '</div>';
    const links = [];
    const own = U.safeUrl(s.linkUrl);
    if (own) links.push('<a href="' + esc(own) + '" target="_blank" rel="noopener noreferrer">' + A.icon('link') + 'Ma prévision</a>');
    links.push('<a href="' + esc(windyUrl(s)) + '" target="_blank" rel="noopener noreferrer">' + A.icon('link') + 'Windy sur ce point</a>');
    out += '<div class="links">' + links.join('') + '</div>';
    out += '<div class="actions">' +
      '<button class="btn btn-small" data-act="edit" data-id="' + esc(s.id) + '">' + A.icon('edit') + 'Modifier</button>' +
      (s.quiet ? '<button class="btn btn-small btn-primary" data-act="followSpot" data-id="' + esc(s.id) + '">Suivre (alertes)</button>' : '') +
      '<button class="btn btn-small" data-act="linkSpot" data-id="' + esc(s.id) + '">' + A.icon('link') + 'Lien</button>' +
      (S.store.social ? '<button class="btn btn-small" data-act="shareSpot" data-id="' + esc(s.id) + '">' + A.icon('share') + 'Partager</button>' : '') +
      (S.store.social ? '<button class="btn btn-small" data-act="toMap" data-id="' + esc(s.id) + '">Ajouter à une carte</button>' : '') +
      '<button class="btn btn-small" data-act="retry" data-id="' + esc(s.id) + '">Actualiser</button></div>';
    return out + '</div>';
  }

  A.renderers.spots = () => {
    let out = '<div class="head"><h2>Mes spots<span class="count">' + S.spots.length + '</span></h2>' +
      '<button class="btn btn-primary" id="btnAdd" data-act="add" aria-pressed="' + S.adding + '">' + A.icon('plus') + 'Ajouter un spot</button></div>';
    if (!S.spots.length) {
      out += '<div class="empty"><h2>Place ton premier spot</h2><ol class="howto"><li>Appuie sur <b>« Ajouter un spot »</b> ci-dessus.</li><li><b>Touche la carte</b> à l\'endroit exact (tu pourras déplacer le repère), ou colle des coordonnées GPS dans la barre de recherche.</li><li>Donne-lui un nom et règle tes conditions idéales : Houle te prévient quand elles arrivent.</li></ol><button class="btn btn-small" data-act="tour">Voir le tutoriel</button></div>';
    }
    S.spots.forEach((s) => {
      const sel = s.id === S.selectedId;
      if (sel && s.photoCount && !photoCache[s.id] && !photoLoading[s.id]) {
        photoLoading[s.id] = true;
        S.store.getPhotos(s.id).then((p) => { photoCache[s.id] = p; }).catch(() => { photoCache[s.id] = []; }).then(() => { photoLoading[s.id] = false; A.scheduleRender(); });
      }
      out += '<article class="spot' + (sel ? ' is-selected' : '') + '" data-spot="' + esc(s.id) + '">' +
        '<button class="spot-main" data-act="select" data-id="' + esc(s.id) + '" aria-expanded="' + sel + '"><span class="spot-name">' + discChip(s) + esc(s.name) + emojiOf(s) + '</span><span class="spot-coords">' + esc(U.fmtCoords(s.lat, s.lon) + tideTxt(s)) + '</span></button>' +
        strip(s) + (sel ? detail(s) : '') + '</article>';
    });
    out += '<div class="foot"><p class="fine">' + (S.mode === 'local' ? 'Tes spots sont enregistrés sur cet appareil, dans ce navigateur. Exporte une sauvegarde de temps en temps.' : 'Tes spots sont privés : toi seul peux les voir.') + '</p>' +
      '<div class="actions"><button class="btn btn-small" data-act="export">Exporter une sauvegarde</button><button class="btn btn-small" data-act="import">Restaurer</button></div><div class="actions"><button class="btn btn-small btn-primary" data-act="importPlaces">Importer mes lieux (Google Maps…)</button></div></div>';
    return out;
  };

  /* ---------- onglet Alertes ---------- */
  const notifBlock = () => {
    if (!('Notification' in globalThis)) return '<p class="fine">Ce navigateur ne gère pas les notifications. Les alertes restent visibles ici.</p>';
    const p = Notification.permission;
    if (p === 'granted') return '<p class="fine">Notifications activées. Elles partent quand l\'appli est ouverte (onglet ouvert ou appli installée sur l\'écran d\'accueil).</p>';
    if (p === 'denied') return '<p class="fine">Les notifications sont bloquées dans ce navigateur. Autorise-les dans les réglages du site pour les recevoir.</p>';
    return '<div class="notice"><span>Reçois une notification quand une alerte se déclenche.</span><button class="btn btn-small" data-act="notif">' + A.icon('bell') + 'Activer</button></div>';
  };

  const sessionLine = (spotName, day, lead) =>
    '<span class="al-name">' + esc(spotName) + '</span><span class="al-when">' + esc(U.fmtDay(day.date)) + ' · ' + esc(U.leadLabel(lead)) + '</span>' +
    '<span class="al-data"><b>' + esc(F.windowText(day.window)) + '</b> · ' + U.num(day.stats.wave) + ' m à ' + U.num(day.stats.period, 0) + ' s · vent ' + U.num(day.stats.wind, 0) + ' km/h ' + esc(U.compass(day.stats.windDir)) + '</span>';

  A.renderers.alerts = () => {
    let out = '<div class="head"><h2>Alertes</h2><button class="btn btn-small" data-act="refreshAll">Actualiser</button></div>' + notifBlock();
    if (!S.spots.length) return out + '<div class="empty"><p>Ajoute un spot et ses conditions idéales : les alertes apparaîtront ici.</p></div>';
    const loading = S.spots.some((s) => !S.fc[s.id] || (S.fc[s.id].status === 'loading' && !S.fc[s.id].days));
    out += '<h3>À ne pas rater</h3>';
    if (S.alerts.length) {
      out += '<ul class="alist">' + S.alerts.map((a) => {
        const sp = S.spots.find((s) => s.id === a.spotId);
        const day = S.fc[a.spotId].days.find((d) => d.date === a.date);
        return '<li class="al al--lead' + Math.min(a.lead, 3) + '">' + sessionLine(a.spotName, day, a.lead) +
          (S.store.social && sp ? '<button class="btn btn-small" data-act="shareSession" data-id="' + esc(a.spotId) + '" data-date="' + esc(a.date) + '">' + A.icon('share') + 'Partager la session</button>' : '') + '</li>';
      }).join('') + '</ul>';
    } else {
      out += '<p class="muted">' + (loading ? 'Calcul en cours…' : 'Aucune alerte aujourd\'hui. Elles se déclenchent selon les délais choisis pour chaque spot (7 jours, 3 jours, la veille, le matin même).') + '</p>';
    }
    const shown = new Set(S.alerts.map((a) => a.spotId + '|' + a.date));
    const others = S.upcoming.filter((u) => !shown.has(u.spot.id + '|' + u.day.date));
    out += '<h3>' + (S.alerts.length ? 'Autres sessions à venir' : 'Prochaines bonnes sessions') + '</h3>';
    if (others.length) {
      out += '<ul class="alist">' + others.map((u) =>
        '<li class="al">' + sessionLine(u.spot.name, u.day, u.lead) +
        (S.store.social ? '<button class="btn btn-small" data-act="shareSession" data-id="' + esc(u.spot.id) + '" data-date="' + esc(u.day.date) + '">' + A.icon('share') + 'Partager la session</button>' : '') + '</li>').join('') + '</ul>';
    } else {
      out += '<p class="muted">' + (loading ? 'Calcul en cours…' : S.alerts.length ? 'Pas d\'autre session sur les 8 prochains jours.' : 'Aucune session ne correspond à tes critères sur les 8 prochains jours. Tu peux élargir les seuils dans la fiche de chaque spot.') + '</p>';
    }
    out += '<p class="fine">Les prévisions à 7 jours sont moins fiables que celles du jour même. Les alertes se calculent quand l\'appli est ouverte.</p>';
    return out;
  };

  /* ---------- actions ---------- */
  Object.assign(A.actions, {
    add() { if (S.adding) { A.stopAdd(); } else { A.startAdd(); A.toast('Touche la carte pour placer le spot'); } },
    select(el) { const id = el.dataset.id; if (S.selectedId === id) { S.selectedId = null; A.render(); } else A.selectSpot(id, true); },
    edit(el) { A.openSpotDialog(S.spots.find((s) => s.id === el.dataset.id)); },
    async retry(el) { const s = S.spots.find((x) => x.id === el.dataset.id); if (s) { await A.refreshForecasts(true, s); } },
    async refreshAll() { A.toast('Mise à jour des prévisions…'); await A.refreshForecasts(true); A.toast('Prévisions à jour'); },
    async notif() { const r = await Notification.requestPermission(); A.toast(r === 'granted' ? 'Notifications activées' : 'Notifications non activées'); A.render(); },
    async export() {
      const data = await S.store.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'houle-sauvegarde-' + U.ymd(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      A.toast('Sauvegarde exportée');
    },
    import() { $('#importFile').click(); },
  });

  $('#importFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const n = await S.store.importAll(JSON.parse(await file.text()));
      S.spots = await S.store.listSpots();
      A.render();
      if (S.mapObj.ready) S.mapObj.fitAll(S.spots);
      A.refreshForecasts(false);
      A.toast(n + ' spot(s) importé(s)');
    } catch (e) { A.fail(e.message === 'Fichier non reconnu' ? e : new Error('Fichier non reconnu')); }
  });

  /* ---------- fiche d'un spot (création / modification) ---------- */
  const num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
  let D = null; // état de la fiche ouverte

  A.onTempMove = (lat, lon) => {
    if (!D) return;
    D.lat = lat; D.lon = lon;
    const i = $('#f_coords');
    if (i) i.value = U.fmtCoords(lat, lon);
  };

  const photosHtml = () => {
    if (D.photos === null) return '<span class="fine">Chargement des photos…</span>';
    return D.photos.map((p, i) => (U.safeImg(p) ? '<span class="thumb"><img src="' + U.safeImg(p) + '" alt="Photo ' + (i + 1) + '"><button type="button" data-act="rmPhoto" data-i="' + i + '" aria-label="Retirer la photo ' + (i + 1) + '">' + A.icon('x') + '</button></span>' : '')).join('');
  };

  A.openSpotDialog = (spot, coords) => {
    const isNew = !spot;
    const R = F.withDefaults(spot ? spot.rules : (coords && coords.rules) || null);
    D = { id: spot ? spot.id : null, lat: spot ? spot.lat : coords.lat, lon: spot ? spot.lon : coords.lon, photos: [] };
    if (spot && spot.photoCount) {
      D.photos = photoCache[spot.id] || null;
      if (D.photos === null) S.store.getPhotos(spot.id).then((p) => { photoCache[spot.id] = p; if (D && D.id === spot.id) { D.photos = p.slice(); $('#photoList').innerHTML = photosHtml(); } }).catch(() => { if (D) { D.photos = []; $('#photoList').innerHTML = photosHtml(); } });
      else D.photos = D.photos.slice();
    }
    const lead = (n, label) => '<label class="chk"><input type="checkbox" name="lead" value="' + n + '"' + (R.leads.indexOf(n) !== -1 ? ' checked' : '') + '> ' + label + '</label>';
    const html =
      '<form class="dlg" id="spotForm" novalidate>' +
      '<h2>' + (isNew ? 'Nouveau spot' : 'Modifier le spot') + '</h2>' +
      '<label class="fld">Nom<input id="f_name" type="text" maxlength="80"' + (isNew ? ' autofocus' : '') + ' value="' + esc(spot ? spot.name : (coords && coords.name) || '') + '" placeholder="Ex. La Gravière" autocomplete="off" required></label>' +
      '<label class="fld">Coordonnées GPS<input id="f_coords" type="text" inputmode="text" value="' + esc(U.fmtCoords(D.lat, D.lon)) + '" autocomplete="off"><small>Déplace le repère sur la carte, ou colle ici « latitude, longitude ».</small></label>' +
      '<div class="row"><button type="button" class="btn btn-small" data-act="useMyPos">' + A.icon('locate') + 'Ma position</button></div>' +
      '<label class="fld">Notes<textarea id="f_notes" rows="3" maxlength="4000" placeholder="Accès, type de vague, marée, dangers…">' + esc(spot ? spot.notes : (coords && coords.notes) || '') + '</textarea></label>' +
      '<div class="fld"><span class="lbl">Photos</span><div class="thumbs" id="photoList">' + photosHtml() + '</div><input id="f_photos" type="file" accept="image/*" multiple><small>Réduites automatiquement. 6 photos maximum.</small></div>' +
      '<label class="fld">Lien de prévision (Windguru, Windy, Ifremer…)<input id="f_link" type="url" inputmode="url" value="' + esc(spot ? spot.linkUrl : '') + '" placeholder="https://"></label>' +
      '<label class="fld">Ma discipline sur ce spot<select id="f_disc"><option value="s"' + (R.disc === 's' || !R.disc ? ' selected' : '') + '>Surf</option><option value="b"' + (R.disc === 'b' ? ' selected' : '') + '>Bodyboard</option><option value="l"' + (R.disc === 'l' ? ' selected' : '') + '>Longboard</option></select></label>' +
      '<label class="fld">Marée qui marche bien<select id="f_tide"><option value="">Je ne sais pas / non précisée</option>' + Object.keys(TIDE).map((k) => '<option value="' + k + '"' + (R.tide === k ? ' selected' : '') + '>' + TIDE[k][0].toUpperCase() + TIDE[k].slice(1) + '</option>').join('') + '</select><span class="fine">Pour mémoire : elle s\'affiche sur la fiche du spot. Les alertes ne la prennent pas encore en compte.</span></label>' +
      '<fieldset class="grp"><legend>Quand ça marche pour toi</legend>' +
      '<div class="grid2"><label class="fld">Houle min (m)<input id="f_waveMin" type="number" step="0.1" min="0" value="' + R.waveMin + '"></label><label class="fld">Houle max (m)<input id="f_waveMax" type="number" step="0.1" min="0" value="' + R.waveMax + '"></label>' +
      '<label class="fld">Période min (s)<input id="f_period" type="number" step="1" min="0" value="' + R.periodMin + '"></label><label class="fld">Vent max (km/h)<input id="f_wind" type="number" step="1" min="0" value="' + R.windMax + '"></label>' +
      '<label class="fld">Surf à partir de (h)<input id="f_hFrom" type="number" step="1" min="0" max="23" value="' + R.hourFrom + '"></label><label class="fld">jusqu\'à (h)<input id="f_hTo" type="number" step="1" min="1" max="24" value="' + R.hourTo + '"></label></div>' +
      '<label class="chk"><input id="f_dirOn" type="checkbox"' + (R.dirOn ? ' checked' : '') + '> Limiter la direction du vent</label>' +
      '<div class="grid2" id="dirRow"><label class="fld">Vent venant de (°)<input id="f_dirFrom" type="number" step="5" min="0" max="360" value="' + R.dirFrom + '"></label><label class="fld">à (°)<input id="f_dirTo" type="number" step="5" min="0" max="360" value="' + R.dirTo + '"></label></div>' +
      '<small>0° = nord, 90° = est, 180° = sud, 270° = ouest. Le vent de terre (offshore) vient de l\'intérieur des terres.</small>' +
      '<label class="chk"><input id="f_swOn" type="checkbox"' + (R.swellOn ? ' checked' : '') + '> Limiter la direction de la houle</label>' +
      '<div class="grid2" id="swRow"><label class="fld">Houle venant de (°)<input id="f_swFrom" type="number" step="5" min="0" max="360" value="' + R.swellFrom + '"></label><label class="fld">à (°)<input id="f_swTo" type="number" step="5" min="0" max="360" value="' + R.swellTo + '"></label></div>' +
      '<small>Direction d\'où arrive la houle : ouest = 270°, nord-ouest = 315°. Les jours où elle arrive d\'ailleurs sont écartés.</small></fieldset>' +
      '<fieldset class="grp"><legend>Me prévenir</legend><div class="chks">' + lead(7, '7 jours avant') + lead(3, '3 jours avant') + lead(1, 'la veille') + lead(0, 'le matin même') + '</div></fieldset>' +
      '<p class="form-err" id="spotErr" role="alert" hidden></p>' +
      '<div class="dlg-actions">' + (isNew ? '' : '<button type="button" class="btn btn-danger" data-act="delSpot">Supprimer</button>') + '<span class="sp"></span><button type="button" class="btn" data-act="closeDlg">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div></form>';

    A.dialog.open(html, (d) => {
      const dirRow = $('#dirRow', d), dirOn = $('#f_dirOn', d);
      const syncDir = () => {
        dirRow.style.opacity = dirOn.checked ? '1' : '.45';
        dirRow.querySelectorAll('input').forEach((i) => { i.disabled = !dirOn.checked; });
      };
      dirOn.addEventListener('change', syncDir);
      syncDir();
      const swRow = $('#swRow', d), swOn = $('#f_swOn', d);
      const syncSw = () => {
        swRow.style.opacity = swOn.checked ? '1' : '.45';
        swRow.querySelectorAll('input').forEach((i) => { i.disabled = !swOn.checked; });
      };
      swOn.addEventListener('change', syncSw);
      syncSw();
      $('#f_coords', d).addEventListener('input', (e) => {
        const c = U.parseCoords(e.target.value);
        e.target.classList.toggle('is-bad', !c && e.target.value.trim() !== '');
        if (c) { D.lat = c.lat; D.lon = c.lon; S.mapObj.setTempPin(c.lat, c.lon); }
      });
      $('#f_photos', d).addEventListener('change', async (e) => {
        const files = Array.from(e.target.files); e.target.value = '';
        if (D.photos === null) return;
        for (const f of files) {
          if (D.photos.length >= 6) { A.toast('6 photos maximum'); break; }
          try { D.photos.push(await U.compressImage(f)); } catch (err) { A.toast('Photo illisible', 'error'); }
        }
        $('#photoList').innerHTML = photosHtml();
      });
      $('#spotForm', d).addEventListener('submit', (e) => { e.preventDefault(); saveSpot().catch((err) => showErr(err.message)); });
    }, { onclose: () => { D = null; if (S.mapObj) S.mapObj.setTempPin(null); A.stopAdd(); } });

    S.mapObj.setTempPin(D.lat, D.lon);
    if (S.mapObj.ready) S.mapObj.flyTo(D.lat, D.lon, 14);
  };

  const showErr = (m) => { const e = $('#spotErr'); if (e) { e.textContent = m; e.hidden = false; } };

  async function saveSpot() {
    const name = $('#f_name').value.trim();
    if (!name) return showErr('Donne un nom au spot.');
    const c = U.parseCoords($('#f_coords').value);
    if (!c) return showErr('Coordonnées non reconnues. Exemple : 43.48123, -1.55678');
    const linkRaw = $('#f_link').value.trim();
    const link = linkRaw ? U.safeUrl(linkRaw) : '';
    if (linkRaw && !link) return showErr('Le lien doit commencer par https://');
    const waveMin = num($('#f_waveMin').value, 0), waveMax = num($('#f_waveMax').value, 99);
    if (waveMin > waveMax) return showErr('La houle minimale doit être inférieure à la houle maximale.');
    const hourFrom = Math.round(num($('#f_hFrom').value, 7)), hourTo = Math.round(num($('#f_hTo').value, 20));
    if (hourFrom >= hourTo) return showErr("L'heure de début doit être avant l'heure de fin.");
    const rules = {
      waveMin, waveMax, periodMin: num($('#f_period').value, 0), windMax: num($('#f_wind').value, 99), hourFrom, hourTo, minHours: 2,
      dirOn: $('#f_dirOn').checked, dirFrom: num($('#f_dirFrom').value, 0), dirTo: num($('#f_dirTo').value, 360),
      swellOn: $('#f_swOn').checked, swellFrom: num($('#f_swFrom').value, 0), swellTo: num($('#f_swTo').value, 360), disc: $('#f_disc').value, tide: $('#f_tide').value,
      leads: Array.from(document.querySelectorAll('input[name="lead"]:checked')).map((i) => parseInt(i.value, 10)),
    };
    const spot = { id: D.id || U.uid(), name, lat: c.lat, lon: c.lon, notes: $('#f_notes').value.trim(), linkUrl: link, rules };
    if (D.photos !== null) spot.photos = D.photos;
    const isNew = !D.id;
    const saved = await S.store.saveSpot(spot);
    if (spot.photos) photoCache[saved.id] = spot.photos;
    const i = S.spots.findIndex((s) => s.id === saved.id);
    if (i >= 0) S.spots[i] = saved; else S.spots.push(saved);
    S.selectedId = saved.id;
    S.tab = 'spots';
    A.dialog.close();
    A.render();
    A.toast(isNew ? 'Spot ajouté' : 'Spot enregistré');
    A.refreshForecasts(false, saved);
  }

  Object.assign(A.actions, {
    closeDlg() { A.dialog.close(); },
    rmPhoto(el) { if (D && D.photos) { D.photos.splice(parseInt(el.dataset.i, 10), 1); $('#photoList').innerHTML = photosHtml(); } },
    async useMyPos() {
      const p = await S.mapObj.locate();
      D.lat = p.lat; D.lon = p.lon;
      $('#f_coords').value = U.fmtCoords(p.lat, p.lon);
      S.mapObj.setTempPin(p.lat, p.lon); S.mapObj.flyTo(p.lat, p.lon, 16);
    },
    async delSpot() {
      const s = S.spots.find((x) => x.id === D.id);
      if (!s || !confirm('Supprimer « ' + s.name + ' » ? Cette action est définitive.')) return;
      await S.store.deleteSpot(s.id);
      S.spots = S.spots.filter((x) => x.id !== s.id);
      delete S.fc[s.id]; delete photoCache[s.id];
      if (S.selectedId === s.id) S.selectedId = null;
      A.dialog.close();
      A.recompute();
      A.toast('Spot supprimé');
    },
  });

  /* ---------- barre de recherche de la carte ---------- */
  const results = $('#searchResults');
  $('#searchForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = $('#searchInput').value.trim();
    results.hidden = true;
    if (!q) return;
    const c = U.parseCoords(q);
    if (c) { S.mapObj.flyTo(c.lat, c.lon, 15); A.openSpotDialog(null, c); return; }
    const known = A.searchKnown ? A.searchKnown(q) : [];
    const knownHtml = known.map((k) => '<li><button type="button" data-act="goKnown" data-i="' + k.i + '"><b>' + esc(k.name) + '</b> <span class="fine">spot connu · ' + esc(k.region) + '</span></button></li>').join('');
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=fr&q=' + encodeURIComponent(q));
      if (!res.ok) throw new Error('Recherche indisponible');
      const list = await res.json();
      results.innerHTML = knownHtml + (list.length
        ? list.map((r) => '<li><button type="button" data-act="goPlace" data-lat="' + esc(r.lat) + '" data-lon="' + esc(r.lon) + '">' + esc(r.display_name) + '</button></li>').join('')
        : (knownHtml ? '' : '<li class="none">Aucun résultat</li>'));
      results.hidden = false;
    } catch (e) {
      if (knownHtml) { results.innerHTML = knownHtml; results.hidden = false; } else A.toast('Recherche indisponible pour le moment', 'error');
    }
  });
  A.actions.goPlace = (el) => {
    results.hidden = true;
    S.mapObj.flyTo(parseFloat(el.dataset.lat), parseFloat(el.dataset.lon), 13);
  };
  $('#btnLocate').addEventListener('click', () => {
    S.mapObj.locate().then((p) => S.mapObj.flyTo(p.lat, p.lon, 14)).catch(A.fail);
  });
  $('#btnSat').addEventListener('click', (ev) => {
    const on = S.mapObj.toggleSatellite();
    ev.currentTarget.setAttribute('aria-pressed', String(!!on));
  });
  $('#btnCancelAdd').addEventListener('click', () => A.stopAdd());
  $('#dlg').addEventListener('cancel', (ev) => { if ($('#dlg').dataset.locked) ev.preventDefault(); });
})();
