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

  /* distance en km (grand cercle) */
  function distKm(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const inRadius = (center, radius, p) => !center || !radius || distKm(center, p) <= radius;

  H.spotclass = { DISCS, VALID, label, discsOf, needsClass, classify, toClassify, distKm, inRadius };
})();
