/* Houle - menu à trois traits (☰) : au départ sur téléphone, seule la carte est visible ;
   le menu ouvre une petite page avec tous les éléments (Conditions, Mes spots, Alertes, Marées, J'ai surfé, Aide…). */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S;
  const entry = (act, extra, ico, label, hint) => '<li><button type="button" class="menu-item" data-act="' + act + '" ' + extra + '><span class="menu-ico" aria-hidden="true">' + ico + '</span><span><b>' + label + '</b><small>' + hint + '</small></span></button></li>';

  function html() {
    const social = !!(S.store && S.store.social);
    let items = entry('menuGo', 'data-go="cond"', '🌊', 'Conditions', 'Voir la houle et le vent sur la carte') +
      entry('menuGo', 'data-go="spots"', '📍', 'Mes spots', 'Ma liste de spots et leurs prévisions') +
      entry('menuGo', 'data-go="alerts"', '🔔', 'Alertes', 'Les bons créneaux à venir') +
      entry('menuGo', 'data-go="tides"', '🌙', 'Marées', 'Heures de pleine et basse mer') +
      entry('menuSurf', '', '🏄', 'J\'ai surfé', 'Noter une session et voir les conditions de ce moment');
    if (social) items += entry('menuGo', 'data-go="friends"', '👥', 'Amis', 'Mes amis') + entry('menuGo', 'data-go="maps"', '🗺️', 'Cartes', 'Cartes partagées') + entry('menuGo', 'data-go="inbox"', '✉️', 'Reçu', 'Invitations et messages');
    items += entry('a11y', '', '♿', 'Accessibilité', 'Texte plus gros, contraste, voix') + entry('tour', '', '❓', 'Aide', 'Comment ça marche');
    return '<div class="dlg menu"><div class="menu-head"><h2>Menu</h2><button class="btn btn-small" data-act="closeDlg" aria-label="Fermer le menu">Fermer</button></div><ul class="menu-list">' + items + '</ul></div>';
  }

  Object.assign(A.actions, {
    menuOpen: () => A.dialog.open(html()),
    menuSurf: () => { A.dialog.close(); A.actions.seOpen(); },
    menuGo(el) {
      const go = el.dataset.go;
      A.dialog.close();
      if (go === 'cond') { A.actions.mode({ dataset: { m: 'cond' } }); A.panelFull && A.panelFull(false); return; }
      if (A.cond && A.cond.active) A.actions.mode({ dataset: { m: 'normal' } });
      A.actions.tab({ dataset: { tab: go } });
      A.panelFull && A.panelFull(false);
    },
  });

  /* téléphone en vertical : on démarre sur la carte seule */
  try { if (globalThis.matchMedia && matchMedia('(max-width: 820px)').matches) A.panelFull && A.panelFull(true); } catch (e) { /* ignoré */ }
})();
