/* Houle - accessibilité : réglages et texte à lire à voix haute (logique pure, sans écran) */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const DEFAULTS = { text: 0, contrast: false, motion: false, big: false, voice: false, accessOnly: false };

  /* nettoie des réglages venant du stockage */
  function normalize(o) {
    const r = Object.assign({}, DEFAULTS), x = o && typeof o === 'object' ? o : {};
    const t = Number(x.text);
    r.text = t === 1 || t === 2 ? t : 0;
    ['contrast', 'motion', 'big', 'voice', 'accessOnly'].forEach((k) => { r[k] = x[k] === true; });
    return r;
  }
  const anyOn = (s) => s.text > 0 || s.contrast || s.motion || s.big || s.voice || s.accessOnly;

  /* « NNE » -> « nord-nord-est » pour que la voix lise des mots, pas des lettres */
  const WORD = { N: 'nord', S: 'sud', E: 'est', O: 'ouest' };
  const compassWords = (c) => String(c || '').split('').map((l) => WORD[l] || l).join('-');
  const metres = (n) => { const t = String(Number(n).toFixed(1)).replace('.', ','); return t + (Number(n) >= 2 ? ' mètres' : ' mètre'); };

  /* résumé parlé d'un spot : discipline, validation, prochaine session, accessibilité.
     days = jours évalués (peut manquer), U / F / SC / AC = modules de l'appli. */
  function spotSpeech(spot, days) {
    const U = H.util, F = H.forecast, SC = H.spotclass, AC = H.access;
    const parts = [String(spot.name || 'Spot sans nom') + '.'];
    const ds = SC.discsOf(spot.rules).map((k) => SC.label(k).toLowerCase());
    parts.push(ds.length ? 'Discipline : ' + ds.join(', ') + '.' : 'Discipline pas encore choisie.');
    const miss = SC.missing(spot);
    parts.push(miss.length ? 'Spot pas encore validé. Il manque : ' + miss.join(', ') + '.' : 'Spot validé : Houle le surveille et t\'alerte.');
    if (!days || !days.length) parts.push('Prévision pas encore chargée.');
    else {
      const d = days.find((x) => x.status === 'good') || days.find((x) => x.status === 'maybe');
      if (!d) parts.push('Pas de bonne session sur les 8 prochains jours.');
      else parts.push((d.status === 'good' ? 'Prochaine bonne session : ' : 'Créneau court : ') + U.fmtDay(d.date) + ', ' + F.windowText(d.window) + '. Houle ' + metres(d.stats.wave) + ' à ' + Math.round(d.stats.period) + ' secondes. Vent ' + Math.round(d.stats.wind) + ' kilomètres par heure, de ' + compassWords(U.compass(d.stats.windDir)) + '.');
    }
    const acc = spot.rules && spot.rules.access;
    parts.push(AC.level(acc) === 'unknown' ? 'Accessibilité non précisée.' : AC.LEVEL_TXT[AC.level(acc)] + ' pour les personnes à mobilité réduite.');
    return parts.join(' ');
  }

  function alertsSpeech(alerts) {
    const U = H.util, F = H.forecast;
    if (!alerts || !alerts.length) return 'Aucune alerte pour le moment.';
    return alerts.length + (alerts.length > 1 ? ' alertes. ' : ' alerte. ') + alerts.slice(0, 8).map((a) => a.spotName + ', ' + U.fmtDay(a.date) + ', ' + F.windowText(a.window) + ', houle ' + metres(a.stats.wave) + '.').join(' ');
  }

  H.a11y = { DEFAULTS, normalize, anyOn, compassWords, metres, spotSpeech, alertsSpeech, settings: Object.assign({}, DEFAULTS) };
})();
