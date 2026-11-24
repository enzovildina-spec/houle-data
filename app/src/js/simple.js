/* Houle - affichage simple : une phrase par spot (« ça vaut le coup / pas la peine ») — logique pure */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  /* quand : « aujourd'hui », « demain » ou « samedi » (jour de la semaine) */
  function whenWord(days, d) {
    const U = H.util, n = U.daysBetween(days[0].date, d.date);
    if (n === 0) return "aujourd'hui";
    if (n === 1) return 'demain';
    return U.dayDate(d.date).toLocaleDateString('fr-FR', { weekday: 'long' });
  }

  /* raison la plus fréquente d'un « non » sur les jours (ex. « houle trop petite (0,6 m) »), '' si inconnue */
  function mainWhy(days) {
    const F = H.forecast;
    if (!F || !F.failText) return '';
    const count = {}, first = {};
    days.forEach((d) => { if (d.fail && d.fail !== 'nodata' && d.stats) { count[d.fail] = (count[d.fail] || 0) + 1; if (!first[d.fail]) first[d.fail] = d; } });
    const keys = Object.keys(count).sort((a, b) => count[b] - count[a]);
    return keys.length ? F.failText(first[keys[0]]) : '';
  }

  /* verdict d'un spot à partir de ses jours évalués.
     niveau : go (ça vaut le coup) · maybe (limite) · no (pas la peine) · unknown (pas de prévision) */
  function verdict(days) {
    const U = H.util, F = H.forecast;
    if (!days || !days.length) return { level: 'unknown', title: 'Prévision pas encore chargée', detail: '', day: null };
    const good = days.find((d) => d.status === 'good');
    const maybe = days.find((d) => d.status === 'maybe');
    const info = (d) => (d.stats ? 'houle ' + U.num(d.stats.wave) + ' m à ' + U.num(d.stats.period, 0) + ' s, vent ' + U.num(d.stats.wind, 0) + ' km/h' : '');
    if (good) return { level: 'go', title: 'Ça vaut le coup', detail: whenWord(days, good) + ' ' + F.windowText(good.window) + ' · ' + info(good), day: good };
    if (maybe) return { level: 'maybe', title: 'Peut-être, créneau limite', detail: whenWord(days, maybe) + (maybe.window ? ' ' + F.windowText(maybe.window) : '') + ' · ' + info(maybe), day: maybe };
    const why = mainWhy(days);
    return { level: 'no', title: 'Pas la peine pour le moment', detail: 'Aucune bonne session sur les ' + days.length + ' prochains jours' + (why ? ' : surtout ' + why : '') + '.', day: null, why };
  }

  /* réglage (appareil) : simple par défaut */
  const parse = (raw) => raw !== 'detail';

  H.simple = { verdict, mainWhy, whenWord, parse };
})();
