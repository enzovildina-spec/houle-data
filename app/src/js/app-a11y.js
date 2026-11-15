/* Houle - accessibilité : écran d'accueil « Es-tu en situation de handicap ? », confort de lecture, voix */
(function () {
  const H = globalThis.Houle, A = H.app, S = A.S, U = H.util, AX = H.a11y;
  const KEY = 'houle.a11y.v1', ASKED = 'houle.a11y.asked';
  const $dlgOpen = () => { const d = document.getElementById('dlg'); return d && d.open; };

  const load = () => { try { return AX.normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return AX.normalize(null); } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(AX.settings)); } catch (e) { /* ignoré */ } };
  AX.settings = load();

  /* applique les réglages à toute l'appli */
  function apply() {
    const s = AX.settings, c = document.documentElement.classList;
    c.toggle('a11y-t1', s.text === 1); c.toggle('a11y-t2', s.text === 2);
    c.toggle('a11y-hc', s.contrast); c.toggle('a11y-rm', s.motion); c.toggle('a11y-big', s.big);
    if (s.accessOnly) S.accessOnly = true;
  }
  A.applyA11y = apply;
  apply();

  /* ---------- voix ---------- */
  const canSpeak = () => !!(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance);
  AX.speak = (text) => {
    if (!canSpeak()) { A.toast('Ce téléphone ne propose pas la lecture à voix haute.', 'error'); return false; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { return false; }
    return true;
  };
  AX.stop = () => { try { if (canSpeak()) speechSynthesis.cancel(); } catch (e) { /* ignoré */ } };
  A.voiceButtons = (kind, id) => (AX.settings.voice && canSpeak()
    ? '<button class="btn btn-small" data-act="' + (kind === 'alerts' ? 'speakAlerts' : 'speakSpot') + '"' + (id ? ' data-id="' + U.esc(id) + '"' : '') + '>🔊 Écouter</button><button class="btn btn-small" data-act="speakStop">Arrêter la voix</button>' : '');

  /* ---------- l'écran de réglages ---------- */
  const opt = (id, label, hint, checked) => '<label class="chk a11y-opt"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</span></label>';
  function dialog(first) {
    const s = AX.settings;
    A.dialog.open(
      '<div class="dlg a11y"><h2>' + (first ? 'Es-tu en situation de handicap ?' : 'Accessibilité et confort') + '</h2>' +
      '<p>Coche ce qui t\'aide. Tu peux tout changer plus tard avec le bouton ♿ en haut. Rien n\'est obligatoire : tu peux aussi continuer sans rien cocher.</p>' +
      '<fieldset class="grp"><legend>Vue</legend>' +
      opt('a_t1', 'Texte plus gros', 'Les listes, fiches et menus sont agrandis.', s.text === 1) +
      opt('a_t2', 'Texte très gros', 'Encore plus grand (remplace « plus gros »).', s.text === 2) +
      opt('a_hc', 'Contraste fort', 'Noir sur blanc, bordures marquées : plus lisible en plein soleil ou avec une vue fragile.', s.contrast) +
      opt('a_voice', 'Lecture à voix haute (aveugle ou malvoyant)', 'Un bouton « Écouter » lit un spot ou les alertes : discipline, prochaine session, houle, vent, accessibilité. Quand tu ouvres un spot, la lecture démarre toute seule. Pour tout l\'écran, active aussi VoiceOver (iPhone) ou TalkBack (Android) : l\'appli est faite pour les accompagner.', s.voice) +
      '</fieldset>' +
      '<fieldset class="grp"><legend>Mobilité</legend>' +
      opt('a_acc', 'Montrer d\'abord les spots accessibles', 'Fauteuil, béquilles, marche difficile : Mes spots ne garde que les spots où parking, accès au sable et chemin sont notés « oui » (tu peux enlever le filtre à tout moment).', s.accessOnly) +
      opt('a_big', 'Grands boutons', 'Zones à toucher plus larges, utile si les petits boutons sont difficiles à viser (tremblements, doigts engourdis, gants).', s.big) +
      '</fieldset>' +
      '<fieldset class="grp"><legend>Audition</legend><p class="fine">Sourd ou malentendant : Houle n\'utilise <b>aucun son</b>. Tout est écrit (alertes, prévisions) et les notifications s\'affichent à l\'écran.</p></fieldset>' +
      '<fieldset class="grp"><legend>Mouvement</legend>' +
      opt('a_rm', 'Moins d\'animations', 'Arrête les filets de vent et de houle qui bougent (vertiges, migraines, épilepsie). Des flèches fixes les remplacent.', s.motion) +
      '</fieldset>' +
      '<fieldset class="grp"><legend>Comprendre plus simplement</legend><p class="fine">Pas encore disponible : un affichage simplifié (moins de chiffres, une phrase par spot). C\'est prévu.</p></fieldset>' +
      '<div class="dlg-actions"><span class="sp"></span><button class="btn btn-primary" data-act="a11ySave">' + (first ? 'Continuer' : 'Enregistrer') + '</button></div></div>',
      (d) => {
        // « texte plus gros » et « très gros » s'excluent
        const t1 = d.querySelector('#a_t1'), t2 = d.querySelector('#a_t2');
        t1.addEventListener('change', () => { if (t1.checked) t2.checked = false; });
        t2.addEventListener('change', () => { if (t2.checked) t1.checked = false; });
      }
    );
  }
  A.openA11y = (first) => dialog(!!first);

  const afterFirst = A.maybeTour;
  A.maybeTour = () => {
    let asked = false;
    try { asked = !!localStorage.getItem(ASKED); } catch (e) { /* ignoré */ }
    if (!asked && !$dlgOpen()) dialog(true); else afterFirst();
  };

  const speakSpot = (id) => {
    const sp = S.spots.find((x) => x.id === id);
    if (!sp) return;
    const f = S.fc[id];
    AX.speak(AX.spotSpeech(sp, f && f.days));
  };

  Object.assign(A.actions, {
    a11y() { dialog(false); },
    a11ySave() {
      const g = (id) => document.getElementById(id).checked;
      const wasVoice = AX.settings.voice;
      AX.settings = AX.normalize({ text: g('a_t2') ? 2 : g('a_t1') ? 1 : 0, contrast: g('a_hc'), motion: g('a_rm'), big: g('a_big'), voice: g('a_voice'), accessOnly: g('a_acc') });
      if (!AX.settings.accessOnly) S.accessOnly = false;
      save(); apply();
      try { localStorage.setItem(ASKED, '1'); } catch (e) { /* ignoré */ }
      A.dialog.close();
      A.render();
      if (AX.settings.voice && !wasVoice) AX.speak('Lecture à voix haute activée. Ouvre un spot pour l\'entendre.');
      if (!document.getElementById('dlg').open) setTimeout(() => { let seen = false; try { seen = !!localStorage.getItem('houle.tour.v1'); } catch (e) { /* ignoré */ } if (!seen) afterFirst(); }, 80);
    },
    speakSpot(el) { speakSpot(el.dataset.id); },
    speakAlerts() { AX.speak(AX.alertsSpeech(S.alerts.filter((a) => { const sp = S.spots.find((s) => s.id === a.spotId); return !sp || A.inNear(sp); }))); },
    speakStop() { AX.stop(); },
  });

  // en mode voix, ouvrir un spot le lit
  const sel = A.selectSpot;
  A.selectSpot = (id, fly) => {
    sel(id, fly);
    if (AX.settings.voice && canSpeak()) setTimeout(() => speakSpot(id), 400);
  };
})();
