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

  /* part de la houle qui arrive jusqu'au spot quand elle vient de la direction dir (° d'où elle vient) */
  const factor = (ex, dir) => {
    if (!ex || !ex.f || dir == null || isNaN(dir)) return 1;
    const d = ((dir % 360) + 360) % 360;
    const b = Math.floor(d / 10);
    // on prend la direction la plus ouverte des tranches voisines : la houle se courbe un peu
    const km = Math.max(ex.f[b], 0.5 * (ex.f[(b + 35) % 36] + ex.f[(b + 1) % 36]) * 0.9);
    if (km >= OPEN_KM) return 1;
    if (km <= CLOSED_KM) return MIN_FACTOR;
    return MIN_FACTOR + ((1 - MIN_FACTOR) * (km - CLOSED_KM)) / (OPEN_KM - CLOSED_KM);
  };

  /* copie des heures avec la hauteur de vague atténuée selon la direction de la houle */
  const attenuate = (hours, ex) => {
    if (!ex) return hours;
    return hours.map((h) => {
      if (h.wave == null) return h;
      const f = factor(ex, h.waveDir);
      return f >= 1 ? h : Object.assign({}, h, { wave: Math.round(h.wave * f * 100) / 100, shelter: f });
    });
  };

  H.exposure = { lookup, factor, attenuate, key };
})();
