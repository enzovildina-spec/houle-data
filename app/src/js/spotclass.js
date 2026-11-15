/* Houle - classement des spots par discipline (plusieurs possibles) et filtre « autour de moi » : logique pure */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  const DISCS = [
    { k: 's', label: 'Surf', cls: 'surf' },
    { k: 'b', label: 'Bodyboard', cls: 'body' },
    { k: 'l', label: 'Longboard', cls: 'long' },
    { k: 'o', label: 'Autre', cls: 'other' },
  ];
  const VALID = DISCS.map((d) => d.k);
  const label = (k) => (DISCS.find((d) => d.k === k) || {}).label || '';

  /* disciplines d'un spot : la liste « discs » si elle existe, sinon l'ancienne valeur unique « disc » */
  function discsOf(rules) {
    const r = rules || {};
    if (Array.isArray(r.discs)) return VALID.filter((k) => r.discs.indexOf(k) !== -1);
    return VALID.indexOf(r.disc) !== -1 ? [r.disc] : [];
  }

  /* « à classer » : spot importé (ou marqué ainsi) dont personne n'a encore choisi la discipline */
  function needsClass(spot) {
    const r = (spot && spot.rules) || {};
    if (Array.isArray(r.discs) && r.discs.some((k) => VALID.indexOf(k) !== -1)) return false;
    return !!(spot && spot.batch) || r.unclassified === true;
  }

  /* règles après classement : discs, disc (la première, pour le reste de l'appli), et plus « à classer » */
  function classify(rules, discs) {
    const list = VALID.filter((k) => (discs || []).indexOf(k) !== -1);
    if (!list.length) throw new Error('Choisis au moins une discipline');
    const out = Object.assign({}, rules || {}, { discs: list, disc: list[0] });
    delete out.unclassified;
    return out;
  }
  const toClassify = (spots) => (spots || []).filter(needsClass);

  /* ---------- spot « validé » ----------
     Un spot est validé quand il a un nom, au moins une discipline, et ses conditions renseignées pour de bon
     (pas les valeurs par défaut) : houle (hauteur min et max, direction, période min), vent (direction, vitesse max),
     marée (hauteur min et max). Un spot validé est surveillé tout seul : l'appli donne l'alerte. */
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  function missing(spot) {
    const r = (spot && spot.rules) || {}, out = [];
    if (!spot || !String(spot.name || '').trim()) out.push('un nom');
    if (needsClass(spot) || !discsOf(r).length) out.push('la discipline');
    if (!isNum(r.waveMin) || !isNum(r.waveMax) || r.waveMin > r.waveMax) out.push('la taille de houle (min et max)');
    if (!(r.swellOn === true && isNum(r.swellFrom) && isNum(r.swellTo))) out.push('l\'orientation de la houle');
    if (!isNum(r.periodMin)) out.push('la puissance de la houle (période min)');
    if (!(r.dirOn === true && isNum(r.dirFrom) && isNum(r.dirTo))) out.push('l\'orientation du vent');
    if (!isNum(r.windMax)) out.push('la force du vent (max)');
    if (!isNum(r.tideMin) || !isNum(r.tideMax) || r.tideMin > r.tideMax) out.push('la hauteur de marée (min et max)');
    return out;
  }
  const isValidated = (spot) => missing(spot).length === 0;
  /* suivi automatique : un spot validé est toujours surveillé ; sinon seulement s'il a été activé à la main (quiet absent) */
  const isFollowed = (spot) => !!spot && (!spot.quiet || isValidated(spot));

  /* distance en km (grand cercle) */
  function distKm(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const inRadius = (center, radius, p) => !center || !radius || distKm(center, p) <= radius;

  H.spotclass = { missing, isValidated, isFollowed, DISCS, VALID, label, discsOf, needsClass, classify, toClassify, distKm, inRadius };
})();
