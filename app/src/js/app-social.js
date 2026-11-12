/* Houle - compte, amis, partages, cartes communes (mode serveur) */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const A = H.app, U = H.util, F = H.forecast, S = A.S, $ = A.$;
  const esc = U.esc;
  const finite = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : parseFloat(x));

  const ago = (ms) => {
    const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 2) return "à l'instant";
    if (m < 60) return 'il y a ' + m + ' min';
    if (m < 1440) return 'il y a ' + Math.round(m / 60) + ' h';
    return 'il y a ' + Math.round(m / 1440) + ' j';
  };

  /* ---------- connexion ---------- */
  let authMode = 'in';
  const authHtml = () =>
    '<form class="dlg" id="authForm" novalidate>' +
    '<h2>Bienvenue sur Houle</h2>' +
    '<p class="lead">Un compte garde tes spots en sécurité et te permet de les partager avec tes amis.</p>' +
    '<div class="seg" role="group" aria-label="Connexion ou création de compte">' +
    '<button type="button" data-act="authMode" data-mode="in" aria-pressed="' + (authMode === 'in') + '">Connexion</button>' +
    '<button type="button" data-act="authMode" data-mode="up" aria-pressed="' + (authMode === 'up') + '">Créer un compte</button></div>' +
    '<label class="fld">Adresse e-mail<input id="a_email" type="email" autocomplete="email" inputmode="email" required></label>' +
    '<label class="fld">Mot de passe<input id="a_pw" type="password" autocomplete="' + (authMode === 'in' ? 'current-password' : 'new-password') + '" required>' +
    (authMode === 'up' ? '<small>8 caractères minimum. Choisis un mot de passe que tu n\'utilises nulle part ailleurs.</small>' : '') + '</label>' +
    '<p class="form-err" id="authErr" role="alert" hidden></p><p class="form-ok" id="authOk" role="status" hidden></p>' +
    '<div class="dlg-actions"><span class="sp"></span><button type="submit" class="btn btn-primary">' + (authMode === 'in' ? 'Se connecter' : 'Créer mon compte') + '</button></div></form>';

  A.openAuth = () => {
    A.dialog.open(authHtml(), (d) => {
      $('#authForm', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#authErr'), ok = $('#authOk');
        err.hidden = true; ok.hidden = true;
        const email = $('#a_email').value.trim(), pw = $('#a_pw').value;
        if (!email || !pw) { err.textContent = 'Saisis ton e-mail et ton mot de passe.'; err.hidden = false; return; }
        if (authMode === 'up' && pw.length < 8) { err.textContent = 'Le mot de passe doit faire au moins 8 caractères.'; err.hidden = false; return; }
        try {
          const r = authMode === 'in' ? await S.store.signIn(email, pw) : await S.store.signUp(email, pw);
          if (r.needsConfirm) { ok.textContent = 'Compte créé. Ouvre le mail de confirmation que tu viens de recevoir, puis reviens te connecter ici.'; ok.hidden = false; return; }
          if (!r.user.username) A.openUsername(); else { A.dialog.close(); await A.afterLogin(); }
        } catch (ex) { err.textContent = ex.message; err.hidden = false; }
      });
    }, { locked: true });
  };

  A.openUsername = () => {
    A.dialog.open(
      '<form class="dlg" id="nameForm" novalidate><h2>Choisis ton pseudo</h2>' +
      '<p class="lead">Tes amis t\'ajouteront avec ce pseudo. Lettres minuscules, chiffres et _ (3 à 20 caractères).</p>' +
      '<label class="fld">Pseudo<input id="u_name" type="text" autocomplete="username" autocapitalize="none" maxlength="20" required></label>' +
      '<p class="form-err" id="nameErr" role="alert" hidden></p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-act="logout">Se déconnecter</button><span class="sp"></span><button type="submit" class="btn btn-primary">Continuer</button></div></form>',
      (d) => {
        $('#nameForm', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          try { await S.store.createProfile($('#u_name').value); A.dialog.close(); await A.afterLogin(); } catch (ex) { const er = $('#nameErr'); er.textContent = ex.message; er.hidden = false; }
        });
      }, { locked: true });
  };

  A.openAuthError = (msg) => {
    A.dialog.open(
      '<div class="dlg"><h2>Connexion au serveur impossible</h2><p class="lead">' + esc(msg) + '</p>' +
      '<p class="fine">Vérifie ta connexion internet et les deux lignes de réglage du serveur au début du fichier.</p>' +
      '<div class="dlg-actions"><button class="btn" data-act="useLocal">Utiliser sans compte</button><span class="sp"></span><button class="btn btn-primary" data-act="reload">Réessayer</button></div></div>',
      null, { locked: true });
  };

  Object.assign(A.actions, {
    authMode(el) {
      authMode = el.dataset.mode;
      const email = $('#a_email') ? $('#a_email').value : '';
      A.openAuth();
      $('#a_email').value = email;
    },
    reload() { location.reload(); },
    useLocal() { return A.useLocalMode(); },
    async logout() {
      await S.store.signOut();
      S.me = null; S.spots = []; S.fc = {}; S.alerts = []; S.upcoming = []; S.selectedId = null;
      S.friends = { friends: [], incoming: [], outgoing: [] }; S.inbox = []; S.maps = []; S.openMapId = null; S.mapSpots = {}; S.tab = 'spots'; S.socialSig = '';
      A.render();
      A.openAuth();
    },
  });

  /* ---------- amis ---------- */
  A.renderers.friends = () => {
    if (!S.store.social) return A.lockedPanel('Amis');
    const f = S.friends;
    let out = '<div class="head"><h2>Amis<span class="count">' + f.friends.length + '</span></h2></div>';
    if (S.me) out += '<p class="fine">Ton pseudo : <b>@' + esc(S.me.username) + '</b>. Donne-le à tes amis pour qu\'ils t\'ajoutent.</p>';
    out += '<form class="inline" data-form="friend"><label class="sr-only" for="friendName">Pseudo de ton ami</label><input id="friendName" type="text" placeholder="Pseudo de ton ami" autocapitalize="none" autocomplete="off"><button class="btn btn-primary" type="submit">Envoyer la demande</button></form>';
    if (f.incoming.length) {
      out += '<h3>Demandes reçues</h3><ul class="plist">' + f.incoming.map((x) =>
        '<li><span class="pname">@' + esc(x.username) + '</span><span class="pact"><button class="btn btn-small btn-primary" data-act="friendOk" data-id="' + esc(x.friendshipId) + '">Accepter</button><button class="btn btn-small" data-act="friendNo" data-id="' + esc(x.friendshipId) + '">Refuser</button></span></li>').join('') + '</ul>';
    }
    if (f.outgoing.length) {
      out += '<h3>Demandes envoyées</h3><ul class="plist">' + f.outgoing.map((x) =>
        '<li><span class="pname">@' + esc(x.username) + ' <span class="tag">en attente</span></span><span class="pact"><button class="btn btn-small" data-act="friendNo" data-id="' + esc(x.friendshipId) + '">Annuler</button></span></li>').join('') + '</ul>';
    }
    out += '<h3>Mes amis</h3>';
    out += f.friends.length
      ? '<ul class="plist">' + f.friends.map((x) => '<li><span class="pname">@' + esc(x.username) + '</span><span class="pact"><button class="btn btn-small" data-act="friendDel" data-id="' + esc(x.friendshipId) + '" data-name="' + esc(x.username) + '">Retirer</button></span></li>').join('') + '</ul>'
      : '<p class="muted">Pas encore d\'ami. Envoie une demande avec son pseudo : il doit l\'accepter avant que vous puissiez partager quoi que ce soit.</p>';
    return out;
  };

  Object.assign(A.actions, {
    async friendOk(el) { await S.store.respondFriend(el.dataset.id, true); A.toast('Ami ajouté'); await A.refreshSocial(); },
    async friendNo(el) { await S.store.respondFriend(el.dataset.id, false); await A.refreshSocial(); },
    async friendDel(el) {
      if (!confirm('Retirer @' + el.dataset.name + ' de tes amis ?')) return;
      await S.store.removeFriend(el.dataset.id); await A.refreshSocial();
    },
  });

  /* ---------- cartes communes ---------- */
  const spotsOf = (m) => S.mapSpots[m.id] || [];

  A.renderers.maps = () => {
    if (!S.store.social) return A.lockedPanel('Cartes communes');
    let out = '<div class="head"><h2>Cartes communes</h2></div>' +
      '<p class="fine">Une carte commune réunit des spots que plusieurs personnes alimentent. Chacun garde sa propre carte privée à part.</p>' +
      '<form class="inline" data-form="createMap"><label class="sr-only" for="mapName">Nom de la carte</label><input id="mapName" type="text" maxlength="80" placeholder="Nom de la nouvelle carte"><button class="btn btn-primary" type="submit">Créer</button></form>' +
      '<form class="inline" data-form="joinMap"><label class="sr-only" for="mapCode">Code d\'une carte</label><input id="mapCode" type="text" maxlength="20" placeholder="Code reçu d\'un ami" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">Demander à rejoindre</button></form>';
    const invites = S.maps.filter((m) => m.myStatus === 'invited');
    if (invites.length) {
      out += '<h3>Invitations</h3><ul class="plist">' + invites.map((m) =>
        '<li><span class="pname">' + esc(m.name) + ' <span class="tag">invité par un ami</span></span><span class="pact"><button class="btn btn-small btn-primary" data-act="inviteOk" data-id="' + esc(m.id) + '">Rejoindre</button><button class="btn btn-small" data-act="inviteNo" data-id="' + esc(m.id) + '">Refuser</button></span></li>').join('') + '</ul>';
    }
    const mine = S.maps.filter((m) => m.myStatus !== 'invited');
    out += '<h3>Mes cartes</h3>';
    if (!mine.length) out += '<p class="muted">Aucune carte commune pour l\'instant.</p>';
    mine.forEach((m) => {
      if (m.myStatus === 'requested') {
        out += '<article class="map"><div class="map-main"><span class="spot-name">' + esc(m.name) + '</span><span class="tag">demande envoyée</span></div><div class="actions"><button class="btn btn-small" data-act="leaveMap" data-id="' + esc(m.id) + '">Annuler la demande</button></div></article>';
        return;
      }
      const open = S.openMapId === m.id;
      const members = m.members.filter((x) => x.status === 'member');
      out += '<article class="map' + (open ? ' is-open' : '') + '"><button class="spot-main" data-act="openMap" data-id="' + esc(m.id) + '" aria-expanded="' + open + '"><span class="spot-name">' + esc(m.name) + '</span><span class="spot-coords">' + members.length + ' membre' + (members.length > 1 ? 's' : '') + ' · code ' + esc(m.code) + '</span></button>';
      if (open) {
        out += '<div class="detail"><p class="fine">Membres : ' + members.map((x) => '@' + esc(x.username) + (x.id === (S.me && S.me.id) ? ' (toi)' : '') + (x.username === m.ownerName ? ' (créateur)' : '')).join(', ') + '</p>';
        if (m.isOwner) {
          const reqs = m.members.filter((x) => x.status === 'requested');
          if (reqs.length) out += '<h4>Demandes à valider</h4><ul class="plist">' + reqs.map((x) => '<li><span class="pname">@' + esc(x.username) + '</span><span class="pact"><button class="btn btn-small btn-primary" data-act="reqOk" data-id="' + esc(m.id) + '" data-user="' + esc(x.id) + '">Accepter</button><button class="btn btn-small" data-act="reqNo" data-id="' + esc(m.id) + '" data-user="' + esc(x.id) + '">Refuser</button></span></li>').join('') + '</ul>';
        }
        const inMap = new Set(m.members.map((x) => x.id));
        const invitable = S.friends.friends.filter((x) => !inMap.has(x.id));
        if (invitable.length) out += '<form class="inline" data-form="invite" data-id="' + esc(m.id) + '"><label class="sr-only" for="inv_' + esc(m.id) + '">Inviter un ami</label><select name="friend" id="inv_' + esc(m.id) + '">' + invitable.map((x) => '<option value="' + esc(x.id) + '">@' + esc(x.username) + '</option>').join('') + '</select><button class="btn btn-small" type="submit">Inviter</button></form>';
        if (S.spots.length) out += '<form class="inline" data-form="addMapSpot" data-id="' + esc(m.id) + '"><label class="sr-only" for="ams_' + esc(m.id) + '">Spot à ajouter</label><select name="spot" id="ams_' + esc(m.id) + '">' + S.spots.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('') + '</select><label class="chk"><input type="checkbox" name="hide" id="hide_' + esc(m.id) + '"> Sans description</label><button class="btn btn-small" type="submit">Ajouter mon spot</button></form>';
        const list = spotsOf(m);
        out += '<h4>Spots de la carte (' + list.length + ')</h4>';
        out += list.length ? '<ul class="plist">' + list.map((x) =>
          '<li><span class="pname">' + esc(x.snapshot.name || 'Spot') + ' <span class="tag">par @' + esc(x.addedBy) + '</span></span><span class="pact"><button class="btn btn-small" data-act="showShared" data-id="' + esc(x.id) + '">Voir</button>' + (x.mine || m.isOwner ? '<button class="btn btn-small" data-act="rmMapSpot" data-id="' + esc(x.id) + '" aria-label="Retirer de la carte">' + A.icon('x') + '</button>' : '') + '</span></li>').join('') + '</ul>' : '<p class="muted">Aucun spot pour l\'instant.</p>';
        out += '<div class="actions">' + (m.isOwner ? '<button class="btn btn-small btn-danger" data-act="delMap" data-id="' + esc(m.id) + '">Supprimer la carte</button>' : '<button class="btn btn-small" data-act="leaveMap" data-id="' + esc(m.id) + '">Quitter la carte</button>') + '</div></div>';
      }
      out += '</article>';
    });
    return out;
  };

  Object.assign(A.actions, {
    async openMap(el) {
      const id = el.dataset.id;
      if (S.openMapId === id) { S.openMapId = null; A.render(); return; }
      S.openMapId = id;
      S.mapSpots[id] = await S.store.listMapSpots(id);
      A.render();
      const pts = S.mapSpots[id].map((x) => ({ lat: finite(x.snapshot.lat), lon: finite(x.snapshot.lon) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      if (pts.length) S.mapObj.fitAll(pts);
    },
    async inviteOk(el) { await S.store.respondInvite(el.dataset.id, true); A.toast('Carte rejointe'); await A.refreshSocial(); },
    async inviteNo(el) { await S.store.respondInvite(el.dataset.id, false); await A.refreshSocial(); },
    async reqOk(el) { await S.store.respondRequest(el.dataset.id, el.dataset.user, true); A.toast('Membre accepté'); await A.refreshSocial(); },
    async reqNo(el) { await S.store.respondRequest(el.dataset.id, el.dataset.user, false); await A.refreshSocial(); },
    async leaveMap(el) {
      const m = S.maps.find((x) => x.id === el.dataset.id);
      if (m && m.myStatus === 'member' && !confirm('Quitter la carte « ' + m.name + ' » ?')) return;
      await S.store.removeMember(el.dataset.id, S.me.id);
      if (S.openMapId === el.dataset.id) S.openMapId = null;
      await A.refreshSocial();
    },
    async delMap(el) {
      const m = S.maps.find((x) => x.id === el.dataset.id);
      if (!m || !confirm('Supprimer la carte « ' + m.name + ' » pour tous ses membres ? Cette action est définitive.')) return;
      await S.store.deleteMap(m.id);
      S.openMapId = null;
      await A.refreshSocial();
      A.toast('Carte supprimée');
    },
    async rmMapSpot(el) {
      await S.store.removeMapSpot(el.dataset.id);
      S.mapSpots[S.openMapId] = await S.store.listMapSpots(S.openMapId);
      A.render();
    },
  });

  /* ---------- spot reçu / d'une carte commune : fiche et import ---------- */
  const importSpot = async (p) => {
    const lat = finite(p.lat), lon = finite(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Coordonnées invalides');
    const spot = { id: U.uid(), name: String(p.name || p.spotName || 'Spot').slice(0, 80), lat, lon, notes: String(p.notes || '').slice(0, 4000), linkUrl: U.safeUrl(p.linkUrl), rules: p.rules && typeof p.rules === 'object' ? p.rules : {} };
    const saved = await S.store.saveSpot(spot);
    S.spots.push(saved);
    A.refreshForecasts(false, saved);
    A.render();
    return saved;
  };

  const sharedInfoHtml = (p, by) => {
    const link = U.safeUrl(p.linkUrl);
    return '<div class="dlg"><h2>' + esc(p.name || p.spotName || 'Spot') + '</h2>' +
      '<p class="fine">' + esc(U.fmtCoords(finite(p.lat), finite(p.lon))) + (by ? ' · partagé par @' + esc(by) : '') + '</p>' +
      (p.notes ? '<p class="notes">' + esc(p.notes).replace(/\n/g, '<br>') + '</p>' : '<p class="muted">' + (p.hiddenDescription ? 'La description est masquée par la personne qui a partagé ce spot.' : 'Pas de description.') + '</p>') +
      (link ? '<div class="links"><a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + A.icon('link') + 'Lien de prévision</a></div>' : '') +
      '<div class="dlg-actions"><button class="btn" data-act="closeDlg">Fermer</button><span class="sp"></span><button class="btn" data-act="viewPoint" data-lat="' + esc(finite(p.lat)) + '" data-lon="' + esc(finite(p.lon)) + '">Voir sur la carte</button><button class="btn btn-primary" id="importBtn">Ajouter à mes spots</button></div></div>';
  };

  A.actions.showShared = (el) => {
    const x = spotsOf({ id: S.openMapId }).find((i) => i.id === el.dataset.id);
    if (!x) return;
    A.dialog.open(sharedInfoHtml(x.snapshot, x.addedBy), () => {
      $('#importBtn').addEventListener('click', async () => { try { await importSpot(x.snapshot); A.dialog.close(); A.toast('Spot ajouté à ta carte'); } catch (e) { A.fail(e); } });
    });
  };
  A.actions.viewPoint = (el) => {
    const lat = parseFloat(el.dataset.lat), lon = parseFloat(el.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { A.toast('Position invalide', 'error'); return; }
    A.dialog.close();
    S.mapObj.flyTo(lat, lon, 14);
  };

  /* ---------- reçu ---------- */
  const seenAsked = {};
  A.renderers.inbox = () => {
    if (!S.store.social) return A.lockedPanel('Spots et sessions reçus');
    let out = '<div class="head"><h2>Reçu</h2></div>';
    if (!S.inbox.length) return out + '<div class="empty"><p>Les spots et les sessions que tes amis te partagent arrivent ici.</p></div>';
    out += S.inbox.map((x) => {
      const p = x.payload;
      let body;
      if (x.kind === 'session') {
        const hour = /^\d{2}:\d{2}$/.test(p.hour || '') ? p.hour.replace(':', 'h') : '';
        body = '<h3 class="in-title">Session à ' + esc(p.spotName || 'un spot') + '</h3><p class="al-data"><b>' + esc(U.fmtDay(String(p.date || '2000-01-01'))) + (hour ? ' vers ' + esc(hour) : '') + '</b> · créneau ' + esc(String(finite(p.from))) + 'h–' + esc(String(finite(p.to))) + 'h · ' + U.num(finite(p.wave)) + ' m à ' + U.num(finite(p.period), 0) + ' s · vent ' + U.num(finite(p.wind), 0) + ' km/h</p>' + (p.message ? '<p class="notes">' + esc(p.message) + '</p>' : '');
      } else {
        body = '<h3 class="in-title">Spot : ' + esc(p.name || 'Spot') + '</h3>' + (p.notes ? '<p class="notes">' + esc(p.notes).replace(/\n/g, '<br>') + '</p>' : '<p class="muted">' + (p.hiddenDescription ? 'Description masquée.' : 'Pas de description.') + '</p>');
      }
      return '<article class="msg' + (x.seen ? '' : ' is-new') + '"><p class="fine">@' + esc(x.from) + ' · ' + ago(x.createdAt) + (x.seen ? '' : ' <span class="tag tag--new">nouveau</span>') + '</p>' + body +
        '<div class="actions"><button class="btn btn-small" data-act="viewPoint" data-lat="' + esc(finite(p.lat)) + '" data-lon="' + esc(finite(p.lon)) + '">Voir sur la carte</button><button class="btn btn-small" data-act="importShare" data-id="' + esc(x.id) + '">Ajouter à mes spots</button><button class="btn btn-small" data-act="delShare" data-id="' + esc(x.id) + '" aria-label="Supprimer ce message">' + A.icon('x') + '</button></div></article>';
    }).join('');
    const unseen = S.inbox.filter((x) => !x.seen && !seenAsked[x.id]).map((x) => x.id);
    if (unseen.length) {
      unseen.forEach((id) => { seenAsked[id] = true; });
      setTimeout(() => { S.store.markSeen(unseen).then(() => { S.inbox.forEach((x) => { if (unseen.indexOf(x.id) !== -1) x.seen = true; }); A.scheduleRender(); }).catch(() => {}); }, 2500);
    }
    return out;
  };

  Object.assign(A.actions, {
    async importShare(el) {
      const x = S.inbox.find((i) => i.id === el.dataset.id);
      if (!x) return;
      await importSpot(x.payload);
      A.toast('Spot ajouté à ta carte');
    },
    async delShare(el) { await S.store.deleteShare(el.dataset.id); S.inbox = S.inbox.filter((i) => i.id !== el.dataset.id); A.render(); },
  });

  /* ---------- formulaires en ligne ---------- */
  document.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const kind = form.dataset.form, val = (n) => (form.elements[n] ? form.elements[n].value : '');
    try {
      if (kind === 'friend') {
        const who = await S.store.requestFriend($('#friendName').value);
        A.toast('Demande envoyée à @' + who);
      } else if (kind === 'createMap') {
        const name = $('#mapName').value.trim();
        if (!name) return A.toast('Donne un nom à la carte', 'error');
        S.openMapId = await S.store.createMap(name);
        S.mapSpots[S.openMapId] = [];
        A.toast('Carte créée');
      } else if (kind === 'joinMap') {
        await S.store.requestJoin($('#mapCode').value);
        A.toast('Demande envoyée. Le créateur de la carte doit l\'accepter.');
      } else if (kind === 'invite') {
        await S.store.inviteToMap(form.dataset.id, val('friend'));
        A.toast('Invitation envoyée');
      } else if (kind === 'addMapSpot') {
        const s = S.spots.find((x) => x.id === val('spot'));
        if (!s) return;
        await S.store.addSpotToMap(form.dataset.id, s, form.elements.hide.checked);
        S.mapSpots[form.dataset.id] = await S.store.listMapSpots(form.dataset.id);
        A.toast('Spot ajouté à la carte commune');
      }
      await A.refreshSocial();
      A.render();
    } catch (e) { A.fail(e); }
  });

  /* ---------- partage : choix des amis ---------- */
  const friendChecks = () =>
    S.friends.friends.length
      ? '<fieldset class="grp"><legend>Avec qui ?</legend><div class="chks">' + S.friends.friends.map((x) => '<label class="chk"><input type="checkbox" name="to" value="' + esc(x.id) + '"> @' + esc(x.username) + '</label>').join('') + '</div></fieldset>'
      : '<p class="muted">Tu n\'as pas encore d\'ami. Ajoute-en depuis l\'onglet Amis.</p>';
  const picked = () => Array.from(document.querySelectorAll('#shareForm input[name="to"]:checked')).map((i) => i.value);

  A.actions.shareSpot = (el) => {
    const s = S.spots.find((x) => x.id === el.dataset.id);
    if (!s) return;
    A.dialog.open(
      '<form class="dlg" id="shareForm"><h2>Partager « ' + esc(s.name) + ' »</h2>' + friendChecks() +
      '<label class="chk"><input id="s_hide" type="checkbox"> Masquer la description (le nom, la position et le lien sont partagés)</label>' +
      '<p class="fine">Les photos ne sont pas envoyées. Ton ami reçoit une copie qu\'il peut ajouter à sa propre carte.</p>' +
      '<p class="form-err" id="shareErr" role="alert" hidden></p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-act="closeDlg">Annuler</button><span class="sp"></span><button type="submit" class="btn btn-primary">Envoyer</button></div></form>',
      (d) => {
        $('#shareForm', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const to = picked();
          if (!to.length) { const er = $('#shareErr'); er.textContent = 'Choisis au moins un ami.'; er.hidden = false; return; }
          const hide = $('#s_hide').checked;
          try {
            await S.store.sendShares(to, 'spot', { name: s.name, lat: s.lat, lon: s.lon, notes: hide ? '' : s.notes, linkUrl: s.linkUrl || '', rules: s.rules || {}, hiddenDescription: hide });
            A.dialog.close(); A.toast('Spot partagé');
          } catch (ex) { const er = $('#shareErr'); er.textContent = ex.message; er.hidden = false; }
        });
      });
  };

  A.actions.shareSession = (el) => {
    const s = S.spots.find((x) => x.id === el.dataset.id);
    const f = s && S.fc[s.id];
    const day = f && f.days && f.days.find((d) => d.date === el.dataset.date);
    if (!day || !day.window) return;
    const hh = String(day.window.from).padStart(2, '0') + ':00';
    A.dialog.open(
      '<form class="dlg" id="shareForm"><h2>Partager la session</h2>' +
      '<p class="al-data"><b>' + esc(s.name) + '</b> · ' + esc(U.fmtDay(day.date)) + ' · ' + esc(F.windowText(day.window)) + '</p>' + friendChecks() +
      '<label class="fld">Heure à laquelle tu y vas<input id="s_time" type="time" value="' + hh + '"></label>' +
      '<label class="fld">Message (facultatif)<textarea id="s_msg" rows="2" maxlength="300" placeholder="On se retrouve au parking ?"></textarea></label>' +
      '<p class="form-err" id="shareErr" role="alert" hidden></p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-act="closeDlg">Annuler</button><span class="sp"></span><button type="submit" class="btn btn-primary">Envoyer</button></div></form>',
      (d) => {
        $('#shareForm', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const to = picked();
          if (!to.length) { const er = $('#shareErr'); er.textContent = 'Choisis au moins un ami.'; er.hidden = false; return; }
          try {
            await S.store.sendShares(to, 'session', {
              spotName: s.name, lat: s.lat, lon: s.lon, linkUrl: s.linkUrl || '', date: day.date, from: day.window.from, to: day.window.to,
              wave: day.stats.wave, period: day.stats.period, wind: day.stats.wind, hour: $('#s_time').value, message: $('#s_msg').value.trim(),
            });
            A.dialog.close(); A.toast('Session partagée');
          } catch (ex) { const er = $('#shareErr'); er.textContent = ex.message; er.hidden = false; }
        });
      });
  };

  A.actions.toMap = (el) => {
    const s = S.spots.find((x) => x.id === el.dataset.id);
    const maps = S.maps.filter((m) => m.myStatus === 'member');
    if (!s) return;
    if (!maps.length) { A.toast("Crée ou rejoins d'abord une carte commune (onglet Cartes).", 'error'); return; }
    A.dialog.open(
      '<form class="dlg" id="shareForm"><h2>Ajouter « ' + esc(s.name) + ' » à une carte commune</h2>' +
      '<label class="fld">Carte<select id="m_sel">' + maps.map((m) => '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>').join('') + '</select></label>' +
      '<label class="chk"><input id="s_hide" type="checkbox"> Masquer la description</label>' +
      '<p class="fine">Tous les membres de la carte verront ce spot. Ton spot personnel reste privé.</p>' +
      '<p class="form-err" id="shareErr" role="alert" hidden></p>' +
      '<div class="dlg-actions"><button type="button" class="btn" data-act="closeDlg">Annuler</button><span class="sp"></span><button type="submit" class="btn btn-primary">Ajouter</button></div></form>',
      (d) => {
        $('#shareForm', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            const id = $('#m_sel').value;
            await S.store.addSpotToMap(id, s, $('#s_hide').checked);
            if (S.openMapId === id) S.mapSpots[id] = await S.store.listMapSpots(id);
            A.dialog.close(); A.toast('Spot ajouté à la carte commune'); A.render();
          } catch (ex) { const er = $('#shareErr'); er.textContent = ex.message; er.hidden = false; }
        });
      });
  };
})();
