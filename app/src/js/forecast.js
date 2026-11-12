/* Houle - prévisions Open-Meteo, évaluation des conditions, alertes */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const U = H.util;

  const DEFAULT_RULES = {
    waveMin: 0.8, waveMax: 2.5, periodMin: 8, windMax: 25,
    dirOn: false, dirFrom: 0, dirTo: 360,
    swellOn: false, swellFrom: 0, swellTo: 360, // direction d'où vient la houle
    hourFrom: 7, hourTo: 20, minHours: 2,
    leads: [3, 1], // jours avant : 7, 3, 1 (la veille), 0 (le matin même)
  };
  const withDefaults = (r) => {
    const o = Object.assign({}, DEFAULT_RULES, r || {});
    o.leads = Array.isArray(o.leads) ? o.leads.map(Number) : DEFAULT_RULES.leads.slice();
    return o;
  };

  /* ---------- récupération ---------- */
  const qs = (o) => Object.keys(o).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');

  async function fetchJson(f, url) {
    const res = await f(url);
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error((body && body.reason) || 'Service de prévision indisponible (' + res.status + ')');
    return body;
  }

  async function fetchForecast(lat, lon, opts) {
    const f = (opts && opts.fetch) || globalThis.fetch.bind(globalThis);
    const pos = { latitude: lat.toFixed(4), longitude: lon.toFixed(4), forecast_days: 8, timezone: 'auto' };
    const [marine, wind] = await Promise.all([
      fetchJson(f, 'https://marine-api.open-meteo.com/v1/marine?' + qs(Object.assign({ hourly: 'wave_height,wave_period,wave_direction', cell_selection: 'sea' }, pos))),
      fetchJson(f, 'https://api.open-meteo.com/v1/forecast?' + qs(Object.assign({ hourly: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'kmh' }, pos))),
    ]);
    const mh = marine.hourly || {}, wh = wind.hourly || {};
    if (!mh.time || !mh.wave_height || mh.wave_height.every((v) => v == null)) throw new Error('Pas de données de houle ici (trop loin de la mer ?)');
    const wIndex = {};
    (wh.time || []).forEach((t, i) => { wIndex[t] = i; });
    const hours = mh.time.map((t, i) => {
      const j = wIndex[t];
      return {
        t, date: t.slice(0, 10), h: parseInt(t.slice(11, 13), 10),
        wave: mh.wave_height[i], period: mh.wave_period ? mh.wave_period[i] : null, waveDir: mh.wave_direction ? mh.wave_direction[i] : null,
        wind: j == null ? null : wh.wind_speed_10m[j], windDir: j == null ? null : wh.wind_direction_10m[j],
      };
    });
    return { hours, fetchedAt: Date.now() };
  }

  const CACHE_MS = 45 * 60 * 1000;
  async function getForecast(lat, lon, opts) {
    const key = 'houle.fc.1.' + lat.toFixed(2) + ',' + lon.toFixed(2);
    const force = opts && opts.force;
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(key) || 'null');
        if (c && Date.now() - c.fetchedAt < CACHE_MS) return c;
      } catch (e) { /* cache indisponible */ }
    }
    const data = await fetchForecast(lat, lon, opts);
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* plein ou bloqué */ }
    return data;
  }

  /* ---------- évaluation ---------- */
  function inArc(d, from, to) {
    if (d == null) return false;
    const f = ((from % 360) + 360) % 360, t = ((to % 360) + 360) % 360;
    if (f === t) return true;
    return f < t ? d >= f && d <= t : d >= f || d <= t;
  }
  const dirOk = (d, R) => !R.dirOn || inArc(d, R.dirFrom, R.dirTo);

  function verdict(x, R) {
    if (x.wave == null || x.wind == null) return 'nodata';
    if (x.wave < R.waveMin) return 'small';
    if (x.wave > R.waveMax) return 'big';
    if (R.swellOn && x.waveDir != null && !inArc(x.waveDir, R.swellFrom, R.swellTo)) return 'swelldir';
    if (x.period != null && x.period < R.periodMin) return 'short';
    if (x.wind > R.windMax) return 'wind';
    if (!dirOk(x.windDir, R)) return 'dir';
    return null;
  }

  const avg = (a) => { const v = a.filter((n) => n != null); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null; };

  function evaluateDay(date, hours, rules) {
    const R = withDefaults(rules);
    const slots = hours.filter((x) => x.h >= R.hourFrom && x.h < R.hourTo).sort((a, b) => a.h - b.h);
    let best = [], cur = [];
    const fails = {};
    slots.forEach((x) => {
      const v = verdict(x, R);
      if (v === null) {
        if (cur.length && x.h === cur[cur.length - 1].h + 1) cur.push(x); else cur = [x];
        if (cur.length > best.length) best = cur.slice();
      } else {
        cur = [];
        fails[v] = (fails[v] || 0) + 1;
      }
    });
    const status = best.length >= R.minHours ? 'good' : best.length >= 1 ? 'maybe' : 'no';
    const basis = best.length ? best : slots;
    let fail = null;
    if (status === 'no') {
      const order = Object.keys(fails).filter((k) => k !== 'nodata').sort((a, b) => fails[b] - fails[a]);
      fail = order[0] || (fails.nodata ? 'nodata' : null);
    }
    return {
      date, status, fail,
      window: best.length ? { from: best[0].h, to: best[best.length - 1].h + 1, len: best.length } : null,
      stats: {
        wave: avg(basis.map((x) => x.wave)), period: avg(basis.map((x) => x.period)),
        wind: avg(basis.map((x) => x.wind)), windDir: U.circMean(basis.map((x) => x.windDir)), waveDir: U.circMean(basis.map((x) => x.waveDir)),
      },
      waveMax: slots.length ? Math.max.apply(null, slots.map((x) => (x.wave == null ? 0 : x.wave))) : null,
    };
  }

  function evaluateSpot(forecast, rules) {
    const byDate = {};
    forecast.hours.forEach((x) => { (byDate[x.date] = byDate[x.date] || []).push(x); });
    return Object.keys(byDate).sort().slice(0, 8).map((d) => evaluateDay(d, byDate[d], rules));
  }

  const FAIL_TEXT = {
    small: (d) => 'houle trop petite (' + U.num(d.stats.wave) + ' m)',
    big: (d) => 'houle trop forte (' + U.num(d.stats.wave) + ' m)',
    short: (d) => 'période trop courte (' + U.num(d.stats.period, 0) + ' s)',
    wind: (d) => 'vent trop fort (' + U.num(d.stats.wind, 0) + ' km/h)',
    swelldir: (d) => 'houle mal orientée (' + U.compass(d.stats.waveDir) + ')',
    dir: (d) => 'vent mal orienté (' + U.compass(d.stats.windDir) + ')',
    nodata: () => 'pas de données',
  };
  const failText = (d) => (d.fail && FAIL_TEXT[d.fail] ? FAIL_TEXT[d.fail](d) : '');

  /* ---------- alertes ---------- */
  function alertsFor(spot, days) {
    if (!days.length) return [];
    const R = withDefaults(spot.rules);
    const today = days[0].date; // la prévision commence à minuit, heure locale du spot
    const out = [];
    days.forEach((d) => {
      if (d.status !== 'good') return;
      const n = U.daysBetween(today, d.date);
      if (R.leads.indexOf(n) !== -1) {
        out.push({ key: spot.id + '|' + d.date + '|' + n, spotId: spot.id, spotName: spot.name, date: d.date, lead: n, window: d.window, stats: d.stats });
      }
    });
    return out;
  }

  const windowText = (w) => (w ? w.from + 'h–' + w.to + 'h' : '');
  const alertText = (a) =>
    a.spotName + ' : session ' + U.leadLabel(a.lead) + ' ' + windowText(a.window) + ', houle ' + U.num(a.stats.wave) + ' m à ' + U.num(a.stats.period, 0) + ' s, vent ' + U.num(a.stats.wind, 0) + ' km/h';

  /* petit emoji : la plus grosse houle attendue dans les 3 prochains jours */
  const SWELL_EMOJI = [
    { max: 0.5, e: '💤', t: 'Plat' }, { max: 1, e: '〰️', t: 'Petite houle' }, { max: 1.8, e: '🌊', t: 'Bonne houle' },
    { max: 2.8, e: '🔥', t: 'Grosse houle' }, { max: Infinity, e: '⚠️', t: 'Houle énorme' },
  ];
  function swellEmoji(days) {
    const w = (days || []).slice(0, 3).reduce((m, d) => Math.max(m, d.waveMax || 0), 0);
    const r = SWELL_EMOJI.find((x) => w < x.max);
    return { emoji: r.e, label: r.t, wave: w };
  }

  H.forecast = { swellEmoji, SWELL_EMOJI, inArc, DEFAULT_RULES, withDefaults, fetchForecast, getForecast, evaluateDay, evaluateSpot, alertsFor, failText, windowText, alertText };
})();
