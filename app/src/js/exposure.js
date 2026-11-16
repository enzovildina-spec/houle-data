/* Houle - exposition des spots (estimation d'après le trait de côte) : fenêtre de houle, vent offshore, atténuation */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const data = (H.exposureData && H.exposureData.spots) || {};
  const OPEN_KM = 80, CLOSED_KM = 10, MIN_FACTOR = 0.15;
  const key = (lat, lon) => lat.toFixed(4) + ',' + lon.toFixed(4);

  /* exposition d'un spot connu (ou null si on ne l'a pas) */
  const lookup = (lat, lon, table) => {
    const e = (table || data)[key(lat, lon)];
    return e && e.o ? e : null;
  };

  /* ouverture d'une tranche de 10° : 0 = fermée (terre proche), 1 = ouverte au large */
  const openness = (km) => (km >= OPEN_KM ? 1 : km <= CLOSED_KM ? 0 : (km - CLOSED_KM) / (OPEN_KM - CLOSED_KM));
  /* distance (°) entre une direction et la tranche b (0 si la direction est dedans) */
  const gap = (d, b) => {
    const c = b * 10 + 5;
    const x = Math.abs(((d - c + 540) % 360) - 180);
    return Math.max(0, x - 5);
  };
  /* étalement angulaire (°) de la diffraction : une houle longue contourne mieux îles et caps */
  const spread = (period) => Math.min(45, Math.max(15, 8 + 2.2 * (period > 0 ? period : 10)));

  /* part de la houle qui arrive jusqu'au spot quand elle vient de la direction dir (° d'où elle vient).
     Estimation simple de diffraction : la zone d'ombre derrière une île ou un cap reçoit encore une partie
     de la houle des directions ouvertes voisines, d'autant plus que la période est longue (pas de vraie physique). */
  const factor = (ex, dir, period) => {
    if (!ex || !ex.f || dir == null || isNaN(dir)) return 1;
    const d = ((dir % 360) + 360) % 360;
    const s = spread(period);
    let best = 0;
    for (let b = 0; b < 36; b++) {
      const g = gap(d, b);
      if (g > 2 * s) continue;
      const o = openness(ex.f[b]) * Math.exp(-Math.pow(g / s, 2));
      if (o > best) best = o;
    }
    return MIN_FACTOR + (1 - MIN_FACTOR) * best;
  };

  /* copie des heures avec la hauteur de vague atténuée selon la direction et la période de la houle */
  const attenuate = (hours, ex) => {
    if (!ex) return hours;
    return hours.map((h) => {
      if (h.wave == null) return h;
      const f = factor(ex, h.waveDir, h.period);
      return f >= 1 ? h : Object.assign({}, h, { wave: Math.round(h.wave * f * 100) / 100, shelter: f });
    });
  };

  H.exposure = { lookup, factor, attenuate, key, spread };
})();
