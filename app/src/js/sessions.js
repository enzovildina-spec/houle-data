/* Houle - carnet de sessions : « j'ai surfé là, ce jour-là, de telle heure à telle heure ».
   On va chercher les conditions passées (Open-Meteo, modèle mondial : ordre de grandeur), l'utilisateur colore chaque heure
   (vert = parfait, orange = moyen, rouge = mauvais), puis on PROPOSE des réglages pour le spot. Rien ne change tout seul. */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const F = H.forecast;
  const mod360 = (a) => ((a % 360) + 360) % 360;
  const qs = (o) => Object.keys(o).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');
  const MARKS = ['green', 'orange', 'red'];

  async function getJson(f, url) {
    const res = await f(url);
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error((body && body.reason) || 'Service indisponible (' + res.status + ')');
    return body;
  }

  /* conditions heure par heure d'un jour passé (heure locale du spot). Même forme que les prévisions. */
  async function fetchPast(lat, lon, date, opts) {
    const f = (opts && opts.fetch) || globalThis.fetch.bind(globalThis);
    const today = (opts && opts.today) || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date non valable');
    if (date > today) throw new Error('Cette date est dans le futur : utilise les prévisions.');
    const ageDays = (Date.parse(today) - Date.parse(date)) / 86400000;
    const pos = { latitude: lat.toFixed(4), longitude: lon.toFixed(4), start_date: date, end_date: date, timezone: 'auto' };
    // l'archive a quelques jours de retard : pour les jours très récents on passe par le service de prévision
    const windUrl = ageDays > 7
      ? 'https://archive-api.open-meteo.com/v1/archive?' + qs(Object.assign({ hourly: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'kmh' }, pos))
      : 'https://api.open-meteo.com/v1/forecast?' + qs(Object.assign({ hourly: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'kmh' }, pos));
    const [marine, wind] = await Promise.all([
      getJson(f, 'https://marine-api.open-meteo.com/v1/marine?' + qs(Object.assign({ hourly: 'wave_height,wave_period,wave_direction,sea_level_height_msl', cell_selection: 'sea' }, pos))),
      getJson(f, windUrl),
    ]);
    const mh = marine.hourly || {}, wh = wind.hourly || {};
    if (!mh.time || !mh.wave_height || mh.wave_height.every((v) => v == null)) throw new Error('Pas de données de houle pour ce lieu et ce jour.');
    const wIndex = {};
    (wh.time || []).forEach((t, i) => { wIndex[t] = i; });
    return mh.time.map((t, i) => {
      const j = wIndex[t];
      return {
        t, date: t.slice(0, 10), h: parseInt(t.slice(11, 13), 10),
        wave: mh.wave_height[i], period: mh.wave_period ? mh.wave_period[i] : null, waveDir: mh.wave_direction ? mh.wave_direction[i] : null,
        tide: mh.sea_level_height_msl ? mh.sea_level_height_msl[i] : null,
        wind: j == null ? null : wh.wind_speed_10m[j], windDir: j == null ? null : wh.wind_direction_10m[j],
      };
    });
  }

  /* heures de la session : de `from` (incluse) à `to` (exclue), 0–24 */
  const sessionHours = (hours, from, to) => hours.filter((x) => x.h >= from && x.h < to).sort((a, b) => a.h - b.h);

  /* proposition de départ d'après les réglages actuels du spot (l'utilisateur corrige ensuite) */
  function autoMarks(hours, rules) {
    const R = F.withDefaults(rules), marks = {};
    hours.forEach((x) => {
      const v = F.verdict(x, R);
      marks[x.h] = v === 'nodata' ? 'red' : v ? 'red' : F.isOrange(x, R) ? 'orange' : 'green';
    });
    return marks;
  }

  /* plus petit arc qui contient tous les angles (on exclut le plus grand trou). {from, to, width} ou null */
  function minArc(degs) {
    const a = degs.filter((d) => typeof d === 'number' && !Number.isNaN(d)).map(mod360).sort((x, y) => x - y);
    if (!a.length) return null;
    if (a.length === 1) return { from: a[0], to: a[0], width: 0 };
    let gap = -1, at = 0;
    for (let i = 0; i < a.length; i++) {
      const next = i === a.length - 1 ? a[0] + 360 : a[i + 1];
      if (next - a[i] > gap) { gap = next - a[i]; at = i; }
    }
    const from = a[(at + 1) % a.length], to = a[at];
    return { from, to, width: 360 - gap };
  }
  
  /* pour un secteur vert déjà trouvé, de combien l'orange déborde-t-il de chaque côté (max 90°) */
  function orangeSides(arc, orangeDegs) {
    let l = 0, r = 0;
    orangeDegs.filter((d) => typeof d === 'number').forEach((d) => {
      if (F.inArc(d, arc.from, arc.to)) return;
      const dl = mod360(arc.from - d), dr = mod360(d - arc.to);
      if (dl <= dr) { if (dl <= 90) l = Math.max(l, dl); } else if (dr <= 90) r = Math.max(r, dr);
    });
    return { orL: Math.ceil(l / 5) * 5, orR: Math.ceil(r / 5) * 5 };
  }

  /* sessions : [{marks:{h:'green'|…}, hours:[{h,…}]}] -> réglages proposés pour le spot (jamais appliqués ici) */
  function suggest(sessions) {
    const G = [], O = [];
    (sessions || []).forEach((s) => (s.hours || []).forEach((x) => {
      const m = s.marks && s.marks[x.h];
      if (m === 'green') G.push(x); else if (m === 'orange') O.push(x);
    }));
    if (!G.length) return null;
    const nums = (arr, k) => arr.map((x) => x[k]).filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const min = (a) => Math.min.apply(null, a), max = (a) => Math.max.apply(null, a);
    const out = { hoursGreen: G.length, hoursOrange: O.length, sessions: (sessions || []).length, rules: {}, notes: [] };
    const R = out.rules;
    const w = nums(G, 'wave'), p = nums(G, 'period'), wi = nums(G, 'wind'), t = nums(G, 'tide');
    if (w.length) { R.waveMin = Math.floor(min(w) * 10) / 10; R.waveMax = Math.ceil(max(w) * 10) / 10; }
    if (p.length) R.periodMin = Math.max(0, Math.floor(min(p)));
    if (wi.length) R.windMax = Math.ceil(max(wi));
    const sw = minArc(nums(G, 'waveDir'));
    if (sw) {
      const arc = { from: mod360(Math.floor(sw.from / 5) * 5), to: mod360(Math.ceil(sw.to / 5) * 5) };
      Object.assign(R, { swellOn: true, swellFrom: arc.from, swellTo: arc.to }, (() => { const o = orangeSides(arc, nums(O, 'waveDir')); return { swellOrL: o.orL, swellOrR: o.orR }; })());
    }
    const wd = minArc(nums(G, 'windDir'));
    if (wd) {
      const arc = { from: mod360(Math.floor(wd.from / 5) * 5), to: mod360(Math.ceil(wd.to / 5) * 5) };
      Object.assign(R, { dirOn: true, dirFrom: arc.from, dirTo: arc.to }, (() => { const o = orangeSides(arc, nums(O, 'windDir')); return { dirOrL: o.orL, dirOrR: o.orR }; })());
    }
    if (t.length) { R.tideMin = Math.floor(min(t) * 10) / 10; R.tideMax = Math.ceil(max(t) * 10) / 10; }
    if (out.hoursGreen < 6) out.notes.push('Peu d\'heures vertes : propose, ne décide pas. Ajoute d\'autres sessions pour affiner.');
    if (sw && sw.width > 120) out.notes.push('Houle venue de directions très différentes : vérifie les heures vertes.');
    out.notes.push('Marée et vagues viennent d\'un modèle mondial (ordre de grandeur), pas d\'une mesure sur le spot.');
    return out;
  }

  /* carnet (stockage sur l'appareil) */
  const KEY = 'sessions';
  const book = {
    async list() { return ((await H.kv.get(KEY)) || []).slice().sort((a, b) => (b.date + b.from).localeCompare(a.date + a.from)); },
    async save(s) {
      const list = (await H.kv.get(KEY)) || [], i = list.findIndex((x) => x.id === s.id);
      const rec = Object.assign({ createdAt: Date.now() }, i >= 0 ? list[i] : {}, s, { updatedAt: Date.now() });
      if (i >= 0) list[i] = rec; else list.push(rec);
      await H.kv.set(KEY, list);
      return rec;
    },
    async remove(id) { await H.kv.set(KEY, ((await H.kv.get(KEY)) || []).filter((x) => x.id !== id)); },
  };

  /* dernier choix (lieu + heures) gardé sur l'appareil pour rouvrir « J'ai surfé » en 2 touches */
  const LAST_KEY = 'houle.session.last.v1';
  const okHour = (h, min, max) => Number.isInteger(h) && h >= min && h <= max;
  function normLast(x) {
    if (!x || typeof x !== 'object') return null;
    const from = +x.from, to = +x.to;
    if (!okHour(from, 0, 23) || !okHour(to, 1, 24) || to <= from) return null;
    const out = { from, to, spotId: '', place: null };
    if (typeof x.spotId === 'string' && x.spotId) out.spotId = x.spotId.slice(0, 80);
    const p = x.place;
    if (p && Number.isFinite(+p.lat) && Number.isFinite(+p.lon) && Math.abs(+p.lat) <= 90 && Math.abs(+p.lon) <= 180) out.place = { name: String(p.name || 'Point choisi').slice(0, 80), lat: +p.lat, lon: +p.lon };
    if (!out.spotId && !out.place) return null;
    return out;
  }
  const lastChoice = {
    load() { try { return normLast(JSON.parse(localStorage.getItem(LAST_KEY) || 'null')); } catch (e) { return null; } },
    save(x) { const n = normLast(x); if (!n) return false; try { localStorage.setItem(LAST_KEY, JSON.stringify(n)); return true; } catch (e) { return false; } },
    normalize: normLast,
  };
  H.sessions = { lastChoice, MARKS, fetchPast, sessionHours, autoMarks, minArc, orangeSides, suggest, book };
})();
