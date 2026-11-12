/* Houle - tutoriel d'accueil et aide */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S;
  const KEY = 'houle.tour.v1';

  const swatch = (c, t) => '<span class="sw sw--' + c + '"></span> ' + t;
  const STEPS = [
    { t: 'Bienvenue sur Houle', b: () =>
      '<p>Houle est ton <b>carnet de spots de surf</b> : tu places tes spots sur la carte, et l\'appli te prévient quand la houle et le vent sont bons pour <b>toi</b>.</p>' +
      '<ol class="howto"><li>Tu ajoutes un spot sur la carte.</li><li>Tu dis ce que tu aimes (taille de houle, vent…).</li><li>Houle surveille les prévisions et te prévient.</li></ol>' +
      '<p class="muted">Pas besoin de compte pour commencer : tout reste sur cet appareil.</p>' },
    { t: '1. Ajouter un spot', b: () =>
      '<p>Dans l\'onglet <b>Spots</b>, appuie sur le bouton orange <b>« Ajouter un spot »</b>, puis <b>touche la carte</b> à l\'endroit exact. Tu pourras ensuite déplacer le repère pour être précis.</p>' +
      '<p>Autres façons de placer un spot :</p><ul class="howto"><li>Écris un lieu dans la barre de recherche de la carte.</li><li>Colle des coordonnées GPS, par exemple <code>43.48, -1.55</code>.</li><li>Appuie sur la cible <b>⌖</b> pour utiliser ta position.</li></ul>' +
      '<p>Les <b>pastilles</b> sont des <b>spots connus</b> déjà placés pour toi (France pour l\'instant) : <span class="sw sw--s"></span> rond bleu = surf, <span class="sw sw--b"></span> losange rose = bodyboard, <span class="sw sw--l"></span> triangle jaune = longboard. Touche-en une pour voir ses conditions conseillées et la houle prévue, puis « Ajouter à mes spots ». Les boutons en bas de la carte filtrent par discipline, et le bouton à 4 points masque tout. Leur position est à confirmer sur satellite.</p>' +
      '<p>Le bouton en forme de couches change la carte en <b>vue satellite</b> : pratique pour repérer les bancs de sable.</p>' },
    { t: '2. Remplir la fiche du spot', b: () =>
      '<p>Tu peux ajouter des <b>notes</b> (parking, marée, danger…), jusqu\'à 6 <b>photos</b> et ton lien préféré (Windguru, Windy, Ifremer…).</p>' +
      '<p>Surtout, règle tes <b>conditions idéales</b> : houle minimum et maximum, période, vent maximum, direction du vent, heures où tu peux surfer. Les valeurs proposées sont un bon point de départ.</p>' },
    { t: '3. Lire les prévisions', b: () =>
      '<p>Chaque spot affiche <b>8 jours</b> de prévisions sous forme de cases :</p>' +
      '<ul class="howto legend"><li>' + swatch('good', '<b>Vert</b> : une session est possible.') + '</li><li>' + swatch('maybe', '<b>Ambre</b> : un créneau court seulement.') + '</li><li>' + swatch('no', '<b>Gris</b> : pas pour toi (trop petit, trop grand, trop de vent…).') + '</li></ul>' +
      '<p>Touche un spot pour voir le détail heure par heure. Sur la carte, les repères <b>verts</b> sont les spots bons dans les 3 prochains jours.</p>' +
      '<p>Le petit <b>emoji</b> sur un spot donne la plus grosse houle attendue dans les 3 prochains jours : 💤 plat (moins de 0,5 m), 〰️ petite houle, 🌊 bonne houle (1 à 1,8 m), 🔥 grosse houle (1,8 à 2,8 m), ⚠️ houle énorme (plus de 2,8 m).</p>' },
    { t: 'La carte Conditions', b: () =>
      '<p>Sur la carte, le bouton <b>« Conditions »</b> remplace les spots par la météo de toute la zone visible, façon Windy :</p>' +
      '<ul class="howto"><li><b>Vent</b> : champ coloré avec des traits qui bougent dans le sens du vent (km/h).</li><li><b>Houle</b> : couleur seulement sur l\'eau, avec hauteur, période et direction.</li><li>Les deux sont des vues séparées : touche « Vent » ou « Houle ». « Pression » ajoute les isobares, avec H (anticyclone) et L (dépression).</li></ul>' +
      '<p>Déplace ou zoome : les données se mettent à jour. Le <b>curseur</b> montre les prochaines heures (environ 4 jours). Touche un point pour le détail heure par heure.</p>' +
      '<p class="muted">Touche la carte : un tableau heure par heure sur 7 jours s\'ouvre (vent, rafales, houle, période, puissance), avec un bouton par jour. Au-delà de 4 jours, la prévision est moins fiable.</p>' },
    { t: '4. Recevoir des alertes', b: () =>
      '<p>Dans la fiche d\'un spot, choisis <b>quand être prévenu</b> : 7 jours avant, 3 jours avant, la veille ou le matin même.</p>' +
      '<p>Va dans l\'onglet <b>Alertes</b> et autorise les notifications. Elles s\'affichent <b>quand Houle est ouverte</b> dans ton navigateur : garde l\'onglet ouvert, ou rouvre l\'appli régulièrement.</p>' },
    { t: '5. Garder tes données', b: () => {
      const social = S.store && S.store.social;
      return '<p>Tes spots sont enregistrés <b>sur cet appareil</b>. Dans l\'onglet <b>Spots</b>, utilise <b>« Exporter une sauvegarde »</b> de temps en temps.</p>' +
        (social
          ? '<p>Avec ton compte, tu peux aussi : ajouter des <b>amis</b> (onglet Amis), leur <b>partager un spot</b> en masquant ou non ta description, leur envoyer une <b>session</b> (« j\'y vais à 13 h »), et créer des <b>cartes communes</b> (onglet Cartes). Tes spots restent privés tant que tu ne les partages pas.</p>'
          : '<p class="muted">Les amis, les partages et les cartes communes ne sont pas activés dans cette version : ils demandent un petit serveur gratuit (voir le guide <b>LISEZ-MOI</b>). Tout le reste fonctionne déjà.</p>') +
        '<p>Tu peux relire ce tutoriel à tout moment avec le bouton <b>?</b> en haut.</p>';
    } },
  ];

  let step = 0;
  function show() {
    const s = STEPS[step], last = step === STEPS.length - 1;
    const dots = STEPS.map((_, i) => '<span class="dot' + (i === step ? ' on' : '') + '"></span>').join('');
    A.dialog.open(
      '<div class="dlg tour"><div class="tour-head"><span class="tour-count">' + (step + 1) + ' / ' + STEPS.length + '</span><button class="btn btn-small" data-act="tourSkip">Passer</button></div>' +
      '<h2>' + s.t + '</h2><div class="tour-body">' + s.b() + '</div>' +
      '<div class="dots" aria-hidden="true">' + dots + '</div>' +
      '<div class="dlg-actions">' + (step ? '<button class="btn" data-act="tourPrev">Précédent</button>' : '') +
      '<button class="btn btn-primary" data-act="' + (last ? 'tourSkip' : 'tourNext') + '" style="margin-left:auto">' + (last ? 'C\'est parti' : 'Suivant') + '</button></div></div>',
      null, { onclose: done }
    );
  }
  function done() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } }

  A.openTour = () => { step = 0; show(); };
  A.maybeTour = () => {
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (!seen && !$dlgOpen()) A.openTour();
  };
  const $dlgOpen = () => { const d = document.getElementById('dlg'); return d && d.open; };

  Object.assign(A.actions, {
    tour() { A.openTour(); },
    tourNext() { step = Math.min(step + 1, STEPS.length - 1); show(); },
    tourPrev() { step = Math.max(step - 1, 0); show(); },
    tourSkip() { done(); A.dialog.close(); },
  });
})();
