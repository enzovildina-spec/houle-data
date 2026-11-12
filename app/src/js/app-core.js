/* Houle - noyau de l'interface : état, démarrage, carte, prévisions, alertes */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const U = H.util, F = H.forecast;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const A = (H.app = {
    $, $$,
    S: {
      store: null, mode: 'local', me: null,
      spots: [], fc: {}, selectedId: null, tab: 'spots', adding: false, alerts: [], upcoming: [],
      friends: { friends: [], incoming: [], outgoing: [] }, inbox: [], maps: [], openMapId: null, mapSpots: {},
      mapObj: null, bootError: null,
    },
    actions: {}, renderers: {},
  });
  const S = A.S;

  /* ---------- icônes ---------- */
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    locate: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    bell: '<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15L6 17z"/><path d="M10 21h4"/>',
    arrow: '<path d="M12 4v16M6 14l6 6 6-6"/>',
  };
  A.icon = (n, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  A.windArrow = (deg) => (deg == null ? '' : '<svg class="warrow" viewBox="0 0 24 24" style="transform:rotate(' + Math.round(deg + 180) + 'deg)" aria-hidden="true"><path d="M12 3v15M6.5 12.5L12 18l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');

  /* ---------- toast + dialogue ---------- */
  let toastTimer = null;
  A.toast = (msg, kind) => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (kind === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, kind === 'error' ? 6000 : 3200);
  };
  A.fail = (e) => A.toast((e && e.message) || 'Une erreur est survenue.', 'error');

  A.dialog = {
    open(html, mount, opts) {
      const d = $('#dlg');
      d.innerHTML = html;
      d.dataset.locked = opts && opts.locked ? '1' : '';
      const h = (opts && opts.onclose) || null;
      d.__h = h;
      d.onclose = () => { if (d.__pending > 0) { d.__pending--; return; } d.__h = null; if (h) h(); };
      if (!d.open) d.showModal();
      if (mount) mount(d);
      return d;
    },
    // le gestionnaire de fermeture s'exécute tout de suite : l'événement natif « close » arrive plus tard
    // et viendrait sinon éteindre la fenêtre suivante ouverte dans la foulée.
    close() { const d = $('#dlg'); if (!d.open) return; const h = d.__h; d.__h = null; d.__pending = (d.__pending || 0) + 1; d.close(); if (h) h(); },
  };

  /* ---------- prévisions et alertes ---------- */
  A.daysAhead = (days, d) => U.daysBetween(days[0].date, d.date);

  A.spotState = (id) => {
    const f = S.fc[id];
    if (!f || f.status !== 'ok') return 'idle';
    const next = f.days.find((d) => d.status === 'good');
    if (!next) return 'idle';
    const n = A.daysAhead(f.days, next);
    return n <= 3 ? 'good' : 'later';
  };

  function computeAlerts() {
    const alerts = [], upcoming = [];
    S.spots.forEach((s) => {
      const f = S.fc[s.id];
      if (!f || f.status !== 'ok') return;
      alerts.push.apply(alerts, F.alertsFor(s, f.days));
      f.days.forEach((d) => { if (d.status === 'good') upcoming.push({ spot: s, day: d, lead: A.daysAhead(f.days, d) }); });
    });
    alerts.sort((a, b) => a.lead - b.lead || a.spotName.localeCompare(b.spotName));
    upcoming.sort((a, b) => a.day.date.localeCompare(b.day.date) || a.spot.name.localeCompare(b.spot.name));
    S.alerts = alerts;
    S.upcoming = upcoming;
  }

  function notifyNew() {
    if (!('Notification' in globalThis) || Notification.permission !== 'granted') return;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('houle.notified') || '[]'); } catch (e) { /* ignore */ }
    S.alerts.forEach((a) => {
      if (seen.indexOf(a.key) !== -1) return;
      try { new Notification('Houle', { body: F.alertText(a) }); } catch (e) { /* ignore */ }
      seen.push(a.key);
    });
    try { localStorage.setItem('houle.notified', JSON.stringify(seen.slice(-300))); } catch (e) { /* ignore */ }
  }

  async function loadForecast(spot, force) {
    S.fc[spot.id] = Object.assign({}, S.fc[spot.id], { status: 'loading' });
    A.scheduleRender();
    try {
      const data = await F.getForecast(spot.lat, spot.lon, { force: !!force });
      S.fc[spot.id] = { status: 'ok', days: F.evaluateSpot(data, spot.rules), fetchedAt: data.fetchedAt };
    } catch (e) {
      S.fc[spot.id] = { status: 'error', error: e.message };
    }
  }

  A.recompute = () => { computeAlerts(); A.render(); };

  A.refreshForecasts = async (force, only) => {
    const list = (only ? [only] : S.spots).slice();
    let i = 0;
    const worker = async () => { while (i < list.length) { const s = list[i++]; await loadForecast(s, force); } };
    await Promise.all([worker(), worker(), worker()]);
    computeAlerts();
    notifyNew();
    A.scheduleRender();
  };

  /* ---------- carte ---------- */
  A.syncMap = () => {
    const m = S.mapObj;
    if (!m || !m.ready) return;
    m.setSpots(S.spots, A.spotState, S.selectedId, A.emojiForSpot);
    const open = S.openMapId && S.mapSpots[S.openMapId];
    m.setShared(open ? open.map((x) => ({ key: x.id, name: x.snapshot.name || 'Spot', lat: x.snapshot.lat, lon: x.snapshot.lon })) : []);
  };

  A.selectSpot = (id, fly) => {
    S.selectedId = id;
    S.tab = 'spots';
    const s = S.spots.find((x) => x.id === id);
    if (s && fly && S.mapObj) S.mapObj.flyTo(s.lat, s.lon, 13);
    A.render();
    const card = $('[data-spot="' + id + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  A.startAdd = () => {
    S.adding = true;
    $('#addBanner').hidden = false;
    $('#btnAdd') && $('#btnAdd').setAttribute('aria-pressed', 'true');
  };
  A.stopAdd = () => {
    S.adding = false;
    $('#addBanner').hidden = true;
    $('#btnAdd') && $('#btnAdd').setAttribute('aria-pressed', 'false');
  };

  /* ---------- rendu ---------- */
  const TABS = [
    { id: 'spots', label: 'Spots' },
    { id: 'alerts', label: 'Alertes' },
    { id: 'friends', label: 'Amis', social: true },
    { id: 'maps', label: 'Cartes', social: true },
    { id: 'inbox', label: 'Reçu', social: true },
  ];

  A.badges = () => ({
    alerts: S.alerts.filter((a) => a.lead <= 1).length,
    friends: S.friends.incoming.length,
    maps: S.maps.filter((m) => m.myStatus === 'invited').length + S.maps.reduce((n, m) => n + (m.isOwner ? m.members.filter((x) => x.status === 'requested').length : 0), 0),
    inbox: S.inbox.filter((x) => !x.seen).length,
  });

  function renderTop() {
    const el = $('#topRight');
    const help = '<button class="btn btn-bar btn-help" data-act="tour" aria-label="Aide et tutoriel" title="Aide et tutoriel">?</button>';
    if (S.mode === 'supabase' && S.me) {
      el.innerHTML = '<span class="who">@' + U.esc(S.me.username || '…') + '</span>' + help + '<button class="btn btn-bar" data-act="logout">Se déconnecter</button>';
    } else if (S.mode === 'supabase') {
      el.innerHTML = '';
    } else {
      el.innerHTML = '<span class="who who--local" title="Tes spots sont enregistrés dans ce navigateur">Sur cet appareil</span>' + help;
    }
  }

  function renderTabs() {
    const b = A.badges();
    $('#tabs').innerHTML = TABS.filter((t) => !t.social || (S.store && S.store.social)).map((t) => {
      const n = b[t.id] || 0;
      return '<button role="tab" class="tab" data-act="tab" data-tab="' + t.id + '" aria-selected="' + (S.tab === t.id) + '">' + t.label + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  /* un rendu ne doit jamais effacer ce que la personne est en train de saisir */
  const snapInputs = (root) => {
    const snap = {}, active = document.activeElement;
    root.querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => {
      snap[el.id] = { value: el.value, checked: el.checked, focus: el === active, start: el.selectionStart, end: el.selectionEnd };
    });
    return snap;
  };
  const restoreInputs = (root, snap) => {
    Object.keys(snap).forEach((id) => {
      const el = root.querySelector('#' + (globalThis.CSS && CSS.escape ? CSS.escape(id) : id));
      if (!el) return;
      const v = snap[id];
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = v.checked; else if (v.value !== '' || el.tagName !== 'SELECT') el.value = v.value;
      if (v.focus) { el.focus(); try { el.setSelectionRange(v.start, v.end); } catch (e) { /* champ sans sélection */ } }
    });
  };

  A.render = () => {
    renderTop();
    renderTabs();
    const body = $('#panelBody');
    const keepScroll = body.scrollTop;
    const snap = snapInputs(body);
    const r = A.renderers[S.tab];
    body.innerHTML = r ? r() : '';
    restoreInputs(body, snap);
    body.scrollTop = keepScroll;
    A.syncMap();
  };
  let raf = 0;
  A.scheduleRender = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; A.render(); });
  };

  A.lockedPanel = (what) =>
    '<div class="empty"><h2>' + U.esc(what) + '</h2><p>Cette partie a besoin d\'un compte. Elle s\'active quand l\'appli est reliée à son serveur (voir le guide <b>LISEZ-MOI</b>, étape 2). Tes spots et tes alertes fonctionnent déjà sans.</p></div>';

  /* ---------- clics du panneau ---------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const fn = A.actions[el.dataset.act];
    if (fn) { ev.preventDefault(); Promise.resolve(fn(el, ev)).catch(A.fail); }
  });

  A.actions.tab = (el) => {
    S.tab = el.dataset.tab;
    A.render();
    if (S.mapObj && S.mapObj.ready) setTimeout(S.mapObj.invalidate, 50);
    if (S.mode === 'supabase' && ['friends', 'maps', 'inbox'].indexOf(S.tab) !== -1) A.refreshSocial();
  };

  /* ---------- données sociales ---------- */
  A.refreshSocial = async () => {
    if (!S.store || !S.store.social || !S.me || !S.me.username) return;
    try {
      const [f, inbox, maps] = await Promise.all([S.store.listFriends(), S.store.listInbox(), S.store.listMaps()]);
      if (S.openMapId && !maps.find((m) => m.id === S.openMapId)) S.openMapId = null;
      const mapSpots = S.openMapId ? await S.store.listMapSpots(S.openMapId) : null;
      const sig = JSON.stringify([f, inbox.map((x) => [x.id, x.seen]), maps, mapSpots]);
      if (sig === S.socialSig) return; // rien de nouveau : on ne redessine pas
      S.socialSig = sig;
      S.friends = f; S.inbox = inbox; S.maps = maps;
      if (mapSpots) S.mapSpots[S.openMapId] = mapSpots;
      A.scheduleRender();
    } catch (e) { /* hors-ligne : on garde l'état précédent */ }
  };

  /* ---------- démarrage ---------- */
  async function afterLogin() {
    S.me = S.store.me || null;
    S.spots = await S.store.listSpots();
    A.render();
    if (S.mapObj && S.mapObj.ready) S.mapObj.fitAll(S.spots);
    A.refreshForecasts(false);
    if (S.store.social) A.refreshSocial();
    if (A.maybeTour) setTimeout(A.maybeTour, 400);
  }
  A.afterLogin = afterLogin;

  A.useLocalMode = async () => {
    S.mode = 'local';
    S.store = H.localStore;
    S.bootError = null;
    A.dialog.close();
    await afterLogin();
  };

  A.boot = async function () {
    const cfg = globalThis.HOULE_CONFIG || {};
    S.mapObj = H.createMap($('#map'), {
      onSpotClick: (id) => A.selectSpot(id, false),
      onKnownClick: (i) => A.showKnown(i, false),
      onSharedClick: (key) => A.actions.showShared({ dataset: { id: key } }),
      onMapClick: (lat, lon) => { if (S.adding) A.openSpotDialog(null, { lat, lon }); else if (A.cond && A.cond.active) A.cond.click(lat, lon); },
      onTempMove: (lat, lon) => A.onTempMove && A.onTempMove(lat, lon),
    });
    if (!S.mapObj.ready) $('#mapFallback').hidden = false;
    else if (A.initKnown) A.initKnown();

    S.mode = cfg.supabaseUrl && cfg.supabaseAnonKey ? 'supabase' : 'local';
    renderTop(); renderTabs();
    $('#panelBody').innerHTML = '<div class="empty"><p>Chargement…</p></div>';

    if (S.mode === 'local') {
      S.store = H.localStore;
      await afterLogin();
    } else {
      S.store = H.createSupabaseStore(cfg);
      try {
        const r = await S.store.init();
        if (!r.user) A.openAuth();
        else if (!r.user.username) A.openUsername();
        else await afterLogin();
      } catch (e) {
        S.bootError = e.message;
        A.openAuthError(e.message);
      }
    }

    setInterval(() => { if (!document.hidden && S.spots.length) A.refreshForecasts(false); }, 30 * 60 * 1000);
    setInterval(() => { if (!document.hidden && S.store && S.store.social && S.me) A.refreshSocial(); }, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.store && S.store.social && S.me) A.refreshSocial(); });
    window.addEventListener('resize', () => S.mapObj && S.mapObj.invalidate());
  };
})();
