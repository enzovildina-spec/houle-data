/* Houle - accessibilité d'un spot (personnes à mobilité réduite) : logique pure, sans écran.
   Règle d'or : « inconnu » reste « inconnu ». On n'invente jamais une réponse ; l'absence de donnée
   OpenStreetMap ne veut jamais dire « non ». */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  // valeurs : 'yes' oui, 'part' difficile / partiel, 'no' non, '' non précisé
  const FIELDS = [
    { k: 'pk', label: 'Parking à moins de 100 m (place PMR)', short: 'parking' },
    { k: 'sand', label: 'Accès au sable sans marche', short: 'accès au sable' },
    { k: 'path', label: 'Chemin praticable en fauteuil', short: 'chemin' },
    { k: 'wc', label: 'Sanitaires accessibles', short: 'sanitaires' },
  ];
  const VAL = { yes: 'oui', part: 'difficile', no: 'non', '': 'non précisé' };
  const okVal = (v) => (v === 'yes' || v === 'part' || v === 'no' ? v : '');

  /* nettoie un objet d'accessibilité venant de l'appareil, d'une sauvegarde ou d'OSM */
  function normalize(a) {
    const o = {};
    if (!a || typeof a !== 'object') return o;
    FIELDS.forEach((f) => { const v = okVal(a[f.k]); if (v) o[f.k] = v; });
    const w = Number(a.walk);
    if (a.walk !== '' && a.walk != null && isFinite(w) && w >= 0 && w <= 20000) o.walk = Math.round(w);
    if (a.osm === true) o.osm = true;
    return o;
  }
  const isEmpty = (a) => Object.keys(normalize(a)).filter((k) => k !== 'osm').length === 0;

  /* niveau global, pour le filtre :
     'ok' = parking, sable et chemin tous « oui » ; 'no' = au moins un « non » sur ces trois ;
     'part' = le reste (difficile ou incomplet) ; 'unknown' = rien de renseigné */
  function level(a) {
    const n = normalize(a);
    if (isEmpty(n)) return 'unknown';
    const core = ['pk', 'sand', 'path'].map((k) => n[k] || '');
    if (core.indexOf('no') !== -1) return 'no';
    if (core.every((v) => v === 'yes')) return 'ok';
    return 'part';
  }
  const LEVEL_TXT = { ok: 'Accessible', part: 'Partiellement accessible', no: 'Peu accessible', unknown: 'Accessibilité non précisée' };

  const fmtWalk = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m');
  function lines(a) {
    const n = normalize(a), out = [];
    FIELDS.forEach((f) => out.push({ k: f.k, label: f.label, value: VAL[n[f.k] || ''] }));
    out.push({ k: 'walk', label: "Distance à pied jusqu'à l'eau", value: n.walk != null ? fmtWalk(n.walk) : 'non précisée' });
    return out;
  }

  /* ---------- piste OpenStreetMap (Overpass) ---------- */
  const R_PARK = 100, R_PATH = 100, R_WC = 300, R_BEACH = 300;
  const buildQuery = (lat, lon) => {
    const p = (r) => '(around:' + r + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')';
    return '[out:json][timeout:20];(' +
      'nwr[amenity=parking]' + p(R_PARK) + ';' +
      'nwr[amenity=toilets]' + p(R_WC) + ';' +
      'nwr[highway~"^(footway|path|pedestrian|steps|track|cycleway)$"]' + p(R_PATH) + ';' +
      'nwr[natural=beach]' + p(R_BEACH) + ';' +
      ');out center tags 80;';
  };
  const dist = (la1, lo1, la2, lo2) => {
    const p = Math.PI / 180, x = (lo2 - lo1) * p * Math.cos(((la1 + la2) / 2) * p), y = (la2 - la1) * p;
    return 6371000 * Math.hypot(x, y);
  };
  const pos = (e) => (e.center ? [e.center.lat, e.center.lon] : e.lat != null ? [e.lat, e.lon] : null);
  const wc = (t) => t.wheelchair === 'yes' ? 'yes' : t.wheelchair === 'limited' ? 'part' : t.wheelchair === 'no' ? 'no' : '';

  /* élèments OSM -> suggestions. Jamais de « non » déduit d'une absence. */
  function fromOsm(elements, lat, lon) {
    const found = {};
    const set = (k, v) => { // on garde la valeur la plus prudente : un « non » ou « difficile » l'emporte
      const rank = { yes: 1, part: 2, no: 3 };
      if (!v) return;
      if (!found[k] || rank[v] > rank[found[k]]) found[k] = v;
    };
    (Array.isArray(elements) ? elements : []).forEach((e) => {
      const t = (e && e.tags) || {}, c = e && pos(e);
      if (!c) return;
      const d = dist(lat, lon, c[0], c[1]);
      if (t.amenity === 'parking' && d <= R_PARK) {
        const cap = parseInt(t['capacity:disabled'], 10);
        if ((cap > 0 || t['capacity:disabled'] === 'yes' || t.parking_space === 'disabled' || t.wheelchair === 'yes') && !(t.wheelchair === 'no')) set('pk', 'yes');
      } else if (t.amenity === 'toilets' && d <= R_WC) {
        if (t.wheelchair === 'yes' || t.wheelchair === 'no' || t.wheelchair === 'limited') set('wc', wc(t));
      } else if (t.highway && d <= R_PATH) {
        if (t.highway === 'steps' && t.ramp !== 'yes' && t.wheelchair !== 'yes') set('path', 'no');
        else if (t.wheelchair) set('path', wc(t));
      } else if (t.natural === 'beach' && d <= R_BEACH) {
        if (t.wheelchair) set('sand', wc(t));
      }
    });
    const out = normalize(found);
    if (!isEmpty(out)) out.osm = true;
    return out;
  }

  /* fusion : ce que l'utilisateur a déjà dit passe avant la suggestion OSM */
  function merge(mine, osm) {
    const a = normalize(mine), b = normalize(osm), o = {};
    FIELDS.forEach((f) => { const v = a[f.k] || b[f.k]; if (v) o[f.k] = v; });
    if (a.walk != null) o.walk = a.walk; else if (b.walk != null) o.walk = b.walk;
    return o;
  }

  async function lookupOsm(lat, lon, fetchFn) {
    const f = fetchFn || globalThis.fetch;
    const res = await f('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(buildQuery(lat, lon)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (res.status === 429 || res.status === 504) throw new Error('OpenStreetMap est très sollicité en ce moment. Réessaie dans quelques minutes.');
    if (!res.ok) throw new Error('OpenStreetMap indisponible (' + res.status + ')');
    const body = await res.json();
    return fromOsm(body && body.elements, lat, lon);
  }

  H.access = { FIELDS, VAL, normalize, isEmpty, level, LEVEL_TXT, lines, buildQuery, fromOsm, merge, lookupOsm, fmtWalk };
})();
