/* Houle - ports de marée de référence et recherche du plus proche (B1). Liste France seulement pour l'instant. */
(function () {
  const H = globalThis.Houle = globalThis.Houle || {};
  /* nom, latitude, longitude (point proche de l'eau) */
  const LIST = [
    ['Dunkerque', 51.05, 2.37], ['Calais', 50.97, 1.85], ['Dieppe', 49.93, 1.08], ['Le Havre', 49.48, 0.1], ['Cherbourg', 49.65, -1.62],
    ['Saint-Malo', 48.65, -2.03], ['Roscoff', 48.73, -3.98], ['Brest', 48.38, -4.49], ['Camaret-sur-Mer', 48.28, -4.59], ['Audierne', 48.02, -4.55],
    ['Saint-Guénolé (Penmarc\'h)', 47.80, -4.38], ['Concarneau', 47.87, -3.92], ['Lorient', 47.73, -3.36], ['Quiberon', 47.48, -3.12], ['La Trinité-sur-Mer', 47.58, -3.0],
    ['Le Croisic', 47.29, -2.52], ['Saint-Nazaire', 47.27, -2.2], ['Les Sables-d\'Olonne', 46.49, -1.8], ['La Rochelle', 46.15, -1.17], ['Royan', 45.62, -1.03],
    ['Cap Ferret (Arcachon)', 44.64, -1.25], ['Mimizan', 44.21, -1.29], ['Capbreton', 43.65, -1.45], ['Biarritz', 43.48, -1.56], ['Saint-Jean-de-Luz', 43.4, -1.67],
  ];
  const MAX_KM = 250; // au-delà, la liste ne couvre pas la zone : on le dit au lieu d'inventer
  const rad = (d) => (d * Math.PI) / 180;
  function km(la1, lo1, la2, lo2) {
    const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* port le plus proche d'un point : { index, name, lat, lon, km } ou null (point invalide ou plus loin que MAX_KM) */
  function nearest(lat, lon, maxKm) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    let best = null;
    LIST.forEach((p, i) => { const d = km(lat, lon, p[1], p[2]); if (!best || d < best.km) best = { index: i, name: p[0], lat: p[1], lon: p[2], km: d }; });
    return best && best.km <= (maxKm || MAX_KM) ? best : null;
  }
  /* « Port de Brest, à 12 km » (arrondi : <10 km au km près avec 1 décimale évitée) */
  function label(near) {
    if (!near) return 'Aucun port de la liste à moins de ' + MAX_KM + ' km (la liste ne couvre que la France pour l\'instant)';
    const d = near.km < 1 ? 'moins de 1 km' : Math.round(near.km) + ' km';
    return 'Port de ' + near.name + ', à ' + d + (near.manual ? ' (choisi par toi)' : '');
  }
  /* port choisi à la main (index dans LIST) : même forme que nearest(), avec manual:true ; null si l'index est invalide */
  function pick(lat, lon, index) {
    const i = Number(index);
    if (index === '' || index == null || !Number.isInteger(i) || i < 0 || i >= LIST.length) return null;
    const p = LIST[i];
    return { index: i, name: p[0], lat: p[1], lon: p[2], km: Number.isFinite(lat) && Number.isFinite(lon) ? km(lat, lon, p[1], p[2]) : 0, manual: true };
  }
  /* port retenu : le choix manuel s'il existe, sinon le plus proche */
  function choose(lat, lon, index) { return pick(lat, lon, index) || nearest(lat, lon); }
  H.ports = { LIST, MAX_KM, km, nearest, pick, choose, label };
})();
