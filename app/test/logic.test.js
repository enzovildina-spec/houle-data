const assert = require('assert');
globalThis.Houle = {};
require('../src/js/util.js');
require('../src/js/forecast.js');
const { util: U, forecast: F } = globalThis.Houle;

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('parseCoords formats', () => {
  assert.deepStrictEqual(U.parseCoords('43.48123, -1.55678'), { lat: 43.48123, lon: -1.55678 });
  assert.deepStrictEqual(U.parseCoords('43,48123 -1,55678'), { lat: 43.48123, lon: -1.55678 });
  assert.deepStrictEqual(U.parseCoords('43.48 N 1.55 W'), { lat: 43.48, lon: -1.55 });
  assert.deepStrictEqual(U.parseCoords('-33.9;18.4'), { lat: -33.9, lon: 18.4 });
  assert.deepStrictEqual(U.parseCoords('43,-1'), { lat: 43, lon: -1 });
  assert.strictEqual(U.parseCoords('95, 10'), null);
  assert.strictEqual(U.parseCoords('hello'), null);
  assert.strictEqual(U.parseCoords(''), null);
});

t('compass, dates, esc, safeUrl', () => {
  assert.strictEqual(U.compass(0), 'N');
  assert.strictEqual(U.compass(270), 'O');
  assert.strictEqual(U.compass(95), 'E');
  assert.strictEqual(U.daysBetween('2026-10-06', '2026-10-13'), 7);
  assert.strictEqual(U.daysBetween('2026-10-30', '2026-11-02'), 3);
  assert.strictEqual(U.num(1.46), '1,5');
  assert.strictEqual(U.esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.strictEqual(U.safeUrl('javascript:alert(1)'), '');
  assert.strictEqual(U.safeUrl('https://www.windguru.cz/48552'), 'https://www.windguru.cz/48552');
  assert.ok(Math.abs(U.circMean([350, 10]) - 0) < 1e-6 || Math.abs(U.circMean([350, 10]) - 360) < 1e-6);
  assert.strictEqual(U.safeImg('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
  assert.strictEqual(U.safeImg('data:text/html;base64,AAAA'), '');
});

const mkHours = (date, f) => Array.from({ length: 24 }, (_, h) => Object.assign({ t: date + 'T' + String(h).padStart(2, '0') + ':00', date, h }, f(h)));

t('evaluateDay good window and bounds', () => {
  // houle ok de 8h a 11h (4 creneaux), vent ok partout
  const hrs = mkHours('2026-10-07', (h) => ({ wave: h >= 8 && h <= 11 ? 1.4 : 0.4, period: 11, waveDir: 290, wind: 10, windDir: 90 }));
  const d = F.evaluateDay('2026-10-07', hrs, {});
  assert.strictEqual(d.status, 'good');
  assert.deepStrictEqual(d.window, { from: 8, to: 12, len: 4 });
  assert.ok(Math.abs(d.stats.wave - 1.4) < 1e-9);
});

t('evaluateDay maybe / no with reasons', () => {
  const one = mkHours('2026-10-07', (h) => ({ wave: h === 9 ? 1.2 : 0.3, period: 10, wind: 8, windDir: 90 }));
  assert.strictEqual(F.evaluateDay('2026-10-07', one, {}).status, 'maybe');
  const small = mkHours('2026-10-07', () => ({ wave: 0.3, period: 10, wind: 8, windDir: 90 }));
  const ds = F.evaluateDay('2026-10-07', small, {});
  assert.strictEqual(ds.status, 'no');
  assert.strictEqual(ds.fail, 'small');
  assert.ok(F.failText(ds).includes('trop petite'));
  const windy = mkHours('2026-10-07', () => ({ wave: 1.5, period: 10, wind: 40, windDir: 90 }));
  assert.strictEqual(F.evaluateDay('2026-10-07', windy, {}).fail, 'wind');
  const short = mkHours('2026-10-07', () => ({ wave: 1.5, period: 5, wind: 10, windDir: 90 }));
  assert.strictEqual(F.evaluateDay('2026-10-07', short, {}).fail, 'short');
});

t('evaluateDay wind direction window (circular)', () => {
  const hrs = mkHours('2026-10-07', () => ({ wave: 1.5, period: 10, wind: 10, windDir: 350 }));
  assert.strictEqual(F.evaluateDay('2026-10-07', hrs, { dirOn: true, dirFrom: 300, dirTo: 40 }).status, 'good');
  assert.strictEqual(F.evaluateDay('2026-10-07', hrs, { dirOn: true, dirFrom: 45, dirTo: 135 }).fail, 'dir');
});

t('evaluateDay respects hour range and minHours', () => {
  const hrs = mkHours('2026-10-07', (h) => ({ wave: h === 7 || h === 8 ? 1.5 : 0.2, period: 10, wind: 5, windDir: 0 }));
  assert.strictEqual(F.evaluateDay('2026-10-07', hrs, { hourFrom: 9 }).status, 'no');
  assert.strictEqual(F.evaluateDay('2026-10-07', hrs, { minHours: 3 }).status, 'maybe');
  assert.strictEqual(F.evaluateDay('2026-10-07', hrs, {}).status, 'good');
});

t('null data is not a match', () => {
  const hrs = mkHours('2026-10-07', () => ({ wave: null, period: null, wind: 5, windDir: 0 }));
  const d = F.evaluateDay('2026-10-07', hrs, {});
  assert.strictEqual(d.status, 'no');
  assert.strictEqual(d.fail, 'nodata');
});

t('alerts follow lead times', () => {
  const days = [];
  for (let i = 0; i < 8; i++) {
    const date = '2026-10-' + String(6 + i).padStart(2, '0');
    days.push({ date, status: i === 1 || i === 3 || i === 7 ? 'good' : 'no', window: { from: 8, to: 11, len: 3 }, stats: { wave: 1.4, period: 11, wind: 12, windDir: 90 } });
  }
  const spot = { id: 's1', name: 'La Gravière', rules: { leads: [7, 3, 1, 0] } };
  const a = F.alertsFor(spot, days);
  assert.deepStrictEqual(a.map((x) => x.lead).sort(), [1, 3, 7]);
  assert.strictEqual(F.alertsFor({ id: 's2', name: 'x', rules: { leads: [0] } }, days).length, 0);
  assert.strictEqual(F.alertsFor({ id: 's3', name: 'x', rules: { leads: [1] } }, days).length, 1);
  assert.ok(F.alertText(a[0]).includes('La Gravière'));
});

t('withDefaults keeps leads array', () => {
  assert.deepStrictEqual(F.withDefaults({}).leads, [3, 1]);
  assert.deepStrictEqual(F.withDefaults({ leads: ['7', 0] }).leads, [7, 0]);
  assert.deepStrictEqual(F.withDefaults({ leads: [] }).leads, []);
});

(async () => {
  const calls = [];
  const mkTimes = () => { const a = []; for (let d = 0; d < 8; d++) for (let h = 0; h < 24; h++) a.push('2026-10-' + String(6 + d).padStart(2, '0') + 'T' + String(h).padStart(2, '0') + ':00'); return a; };
  const times = mkTimes();
  const fake = async (url) => {
    calls.push(url);
    if (url.includes('marine-api')) return { ok: true, json: async () => ({ hourly: { time: times, wave_height: times.map(() => 1.3), wave_period: times.map(() => 10), wave_direction: times.map(() => 280) } }) };
    return { ok: true, json: async () => ({ hourly: { time: times, wind_speed_10m: times.map(() => 12), wind_direction_10m: times.map(() => 90) } }) };
  };
  const fc = await F.fetchForecast(43.4812, -1.5568, { fetch: fake });
  assert.strictEqual(fc.hours.length, 192);
  assert.strictEqual(fc.hours[30].date, '2026-10-07');
  assert.strictEqual(fc.hours[30].h, 6);
  assert.ok(calls[0].includes('marine-api.open-meteo.com') && calls[0].includes('wave_height%2Cwave_period%2Cwave_direction') && calls[0].includes('forecast_days=8') && calls[0].includes('cell_selection=sea'));
  assert.ok(calls[1].includes('wind_speed_unit=kmh') && calls[1].includes('wind_speed_10m%2Cwind_direction_10m'));
  const days = F.evaluateSpot(fc, {});
  assert.strictEqual(days.length, 8);
  assert.ok(days.every((d) => d.status === 'good'));
  n++; console.log('ok  fetchForecast + evaluateSpot with fake API');

  const nodata = async (url) => ({ ok: true, json: async () => ({ hourly: { time: times, wave_height: times.map(() => null), wind_speed_10m: times.map(() => 5) } }) });
  await assert.rejects(() => F.fetchForecast(48, 2, { fetch: nodata }), /Pas de données de houle/);
  const bad = async () => ({ ok: false, status: 400, json: async () => ({ reason: 'Latitude must be in range' }) });
  await assert.rejects(() => F.fetchForecast(48, 2, { fetch: bad }), /Latitude must be/);
  n++; console.log('ok  error handling');
  // direction de la houle + emoji
  const mk = (dir) => { const hs = []; for (let h = 8; h < 18; h++) hs.push({ h, wave: 1.5, period: 11, wind: 10, windDir: 90, waveDir: dir }); return hs; };
  assert.strictEqual(F.evaluateDay('2026-10-14', mk(280), { swellOn: true, swellFrom: 240, swellTo: 320 }).status, 'good');
  const wrong = F.evaluateDay('2026-10-14', mk(100), { swellOn: true, swellFrom: 240, swellTo: 320 });
  assert.strictEqual(wrong.status, 'no'); assert.strictEqual(wrong.fail, 'swelldir');
  assert.ok(F.failText(wrong).includes('houle mal orientée'));
  assert.strictEqual(F.evaluateDay('2026-10-14', mk(10), { swellOn: true, swellFrom: 330, swellTo: 40 }).status, 'good'); // plage qui passe par le nord
  assert.strictEqual(F.evaluateDay('2026-10-14', mk(100), {}).status, 'good'); // sans limite : toutes directions
  assert.strictEqual(F.swellEmoji([{ waveMax: 0.3 }]).emoji, '💤');
  assert.strictEqual(F.swellEmoji([{ waveMax: 0.7 }]).emoji, '〰️');
  assert.strictEqual(F.swellEmoji([{ waveMax: 1.2 }]).emoji, '🌊');
  assert.strictEqual(F.swellEmoji([{ waveMax: 2.2 }]).emoji, '🔥');
  assert.strictEqual(F.swellEmoji([{ waveMax: 3.4 }]).emoji, '⚠️');
  assert.strictEqual(F.swellEmoji([{ waveMax: 0.2 }, { waveMax: 0.2 }, { waveMax: 1.9 }, { waveMax: 5 }]).emoji, '🔥'); // seulement 3 jours
  n++; console.log('ok  swell direction + emoji');
  // mode Conditions : grille, requête groupée, masque terre/mer, marée
  require('../src/js/conditions.js');
  const Cd = Houle.cond;
  const g1 = Cd.gridFor({ south: 43, west: -2.5, north: 44.5, east: -0.5 }, 8, 48);
  assert.ok(g1.lats.length * g1.lons.length <= 48 && g1.lats.length >= 2 && g1.lons.length >= 2);
  const g1b = Cd.gridFor({ south: 43.1, west: -2.4, north: 44.4, east: -0.6 }, 8, 48);
  assert.strictEqual(g1b.step, g1.step); // des zones voisines partagent le même réseau (cache réutilisable)
  const gw = Cd.gridFor({ south: -60, west: -170, north: 70, east: 170 }, 8, 48);
  assert.ok(gw.lats.length * gw.lons.length <= 48 || gw.step === 10);
  assert.ok(gw.lats.every((y) => y >= -85 && y <= 85));
  assert.strictEqual(Cd.normLon(190), -170); assert.strictEqual(Cd.normLon(-181), 179);
  const T0 = 1760400000, ts = Array.from({ length: 72 }, (_, i) => T0 + i * 3600);
  const urls = [];
  const multi = async (url) => {
    urls.push(url);
    const lats = decodeURIComponent(url.match(/latitude=([^&]+)/)[1]).split(',').map(Number);
    const marine = url.includes('marine-api');
    const out = lats.map((la, k) => marine
      ? { latitude: la, longitude: k === 1 ? 5 : -1.6, hourly: { time: ts, wave_height: ts.map(() => 1.4), wave_period: ts.map(() => 9), wave_direction: ts.map(() => 280), swell_wave_height: ts.map(() => null), swell_wave_period: ts.map(() => null), swell_wave_direction: ts.map(() => null), sea_level_height_msl: ts.map((_, i) => Math.sin(i / 12.42 * 2 * Math.PI)) } }
      : { latitude: la, longitude: -1.6, hourly: { time: ts, wind_speed_10m: ts.map(() => 20), wind_direction_10m: ts.map(() => 90) } });
    return { ok: true, status: 200, json: async () => (out.length === 1 ? out[0] : out) };
  };
  const recs = await Cd.fetchPoints([{ lat: 43.5, lon: -1.6, step: 0.5 }, { lat: 43.5, lon: -1.0, step: 0.5 }, { lat: 44, lon: -1.6, step: 0.5 }], { fetch: multi });
  assert.strictEqual(urls.length, 2); // une requête houle + une requête vent pour tous les points
  assert.ok(urls[0].includes('43.500%2C43.500%2C44.000') || urls[0].includes('43.500,43.500,44.000'));
  assert.ok(urls[0].includes('timeformat=unixtime') && urls[0].includes('cell_selection=sea'));
  assert.strictEqual(recs[0].sea, true); assert.strictEqual(recs[1].sea, false); // case de houle trop loin : c'est la terre
  const a0 = Cd.at(recs[0], (T0 + 5 * 3600) * 1000);
  assert.strictEqual(a0.height, 1.4); assert.strictEqual(a0.wind, 20); assert.strictEqual(a0.swell, false);
  assert.strictEqual(Cd.at(recs[0], (T0 - 7200) * 1000), null);
  const ti = Cd.tideInfo(recs[0], 2);
  assert.strictEqual(ti.rising, true); assert.strictEqual(ti.ext.type, 'high');
  assert.ok(Math.abs(ti.ext.i - 3) <= 1); // pleine mer vers 3,1 h
  const ti2 = Cd.tideInfo(recs[0], 5); assert.strictEqual(ti2.rising, false); assert.strictEqual(ti2.ext.type, 'low');
  // la houle principale (swell) est préférée à la houle totale quand elle existe
  const rs = Cd.buildRecord({ lat: 1, lon: 1 }, { latitude: 1, longitude: 1, hourly: { time: ts, wave_height: ts.map(() => 2), swell_wave_height: ts.map(() => 1.1), swell_wave_period: ts.map(() => 13), swell_wave_direction: ts.map(() => 300) } }, null);
  assert.strictEqual(Cd.at(rs, T0 * 1000).height, 1.1); assert.strictEqual(Cd.at(rs, T0 * 1000).period, 13);
  assert.deepStrictEqual(Cd.windColor(0), Cd.WIND_STOPS[0][1]); assert.deepStrictEqual(Cd.windColor(500), Cd.WIND_STOPS[Cd.WIND_STOPS.length - 1][1]);
  // un échec de la houle n'empêche pas d'afficher le vent
  const half = async (url) => (url.includes('marine-api') ? { ok: false, status: 429, json: async () => ({}) } : multi(url));
  const rh = await Cd.fetchPoints([{ lat: 43.5, lon: -1.6, step: 0.5 }], { fetch: half });
  assert.strictEqual(rh[0].sea, false); assert.strictEqual(Cd.at(rh[0], T0 * 1000).wind, 20);
  const bothFail = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(() => Cd.fetchPoints([{ lat: 1, lon: 1 }], { fetch: bothFail }), /Trop de requêtes/);
  n++; console.log('ok  conditions grid / batch fetch / tide');
  // import de lieux Google Maps : KML, GeoJSON (Takeout), CSV, KMZ, doublons
  require('../src/js/import-parse.js');
  const Im = Houle.importer;
  const kml = '<?xml version="1.0"?><kml><Document><Placemark><name>La Gravière</name><description><![CDATA[Beach <b>break</b><br>Parking &amp; accès]]></description><Point><coordinates>-1.4488,43.5512,0</coordinates></Point></Placemark><Placemark><name>Un tracé</name><LineString><coordinates>1,2,0 3,4,0</coordinates></LineString></Placemark><Placemark><name>Sans nom</name><Point><coordinates> 2.5 , 48.1 </coordinates></Point></Placemark><Placemark><name>Hors limites</name><Point><coordinates>400,95,0</coordinates></Point></Placemark></Document></kml>';
  const rk = Im.parseKml(kml);
  assert.strictEqual(rk.total, 4); assert.strictEqual(rk.items.length, 2); assert.strictEqual(rk.notPoint, 1); assert.strictEqual(rk.noCoords, 1);
  assert.strictEqual(rk.items[0].name, 'La Gravière'); assert.strictEqual(rk.items[0].lat, 43.5512); assert.strictEqual(rk.items[0].lon, -1.4488);
  assert.strictEqual(rk.items[0].notes, 'Beach break\nParking & accès');
  const takeout = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-1.5, 43.6] }, properties: { Title: 'Spot A', Location: { Address: '64200 Biarritz' } } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Spot B', 'Google Maps URL': 'https://www.google.com/maps/place/B/@47.5,-3.1,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d47.51234!4d-3.12345' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Perdu', 'Google Maps URL': 'https://maps.google.com/?cid=123456' } } ] };
  const rg = Im.parseGeoJson(takeout);
  assert.strictEqual(rg.items.length, 2); assert.strictEqual(rg.noCoords, 1); assert.strictEqual(rg.items[1].lat, 47.51234); assert.strictEqual(rg.items[1].lon, -3.12345);
  assert.ok(rg.items[0].notes.includes('Biarritz'));
  const csv = 'Title,Note,URL,Comment\n"Spot, avec virgule","ma note","https://www.google.com/maps/place/x/@44.1,-1.2,15z",\nSans lien,,,\n';
  const rc = Im.parseCsv(csv); assert.strictEqual(rc.items.length, 1); assert.strictEqual(rc.items[0].name, 'Spot, avec virgule'); assert.strictEqual(rc.items[0].lat, 44.1); assert.strictEqual(rc.noCoords, 1);
  const rc2 = Im.parseCsv('nom;latitude;longitude\nAnse;47,25;-2,5\n'); assert.strictEqual(rc2.items[0].lat, 47.25); assert.strictEqual(rc2.items[0].lon, -2.5);
  // KMZ : zip fabriqué à la main (méthode deflate)
  const zlib = require('zlib');
  const raw = Buffer.from(kml), def = zlib.deflateRawSync(raw), nm = Buffer.from('doc.kml');
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(def.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(0, 42);
  const cdOff = lh.length + nm.length + def.length;
  const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(cd.length + nm.length, 12); eo.writeUInt32LE(cdOff, 16);
  const kmz = Buffer.concat([lh, nm, def, cd, nm, eo]);
  const rz = await Im.parseFile(kmz.buffer.slice(kmz.byteOffset, kmz.byteOffset + kmz.length), 'carte.kmz');
  assert.strictEqual(rz.format, 'KML'); assert.strictEqual(rz.items.length, 2);
  const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const rj = await Im.parseFile(ab(Buffer.from(JSON.stringify(takeout))), 'Lieux.json'); assert.strictEqual(rj.format, 'GeoJSON');
  await assert.rejects(() => Im.parseFile(ab(Buffer.from('{ pas du json')), 'x.json'), /JSON/);
  // doublons
  const dd = Im.markDuplicates([{ name: 'La Gravière', lat: 43.55121, lon: -1.44881 }, { name: 'Autre', lat: 10, lon: 10 }, { name: 'Autre', lat: 10.0001, lon: 10 }], [{ name: 'Gravière', lat: 43.5512, lon: -1.4488 }]);
  assert.ok(dd[0].dup && /Déjà/.test(dd[0].dup)); assert.ok(!dd[1].dup); assert.ok(/Doublon/.test(dd[2].dup));
  n++; console.log('ok  import KML / GeoJSON / CSV / KMZ / duplicates');
  // ---- exposition d'un spot d'après un trait de côte (côte fictive)
  {
    const X = require('../tools/exposure-core.js');
    require('../src/js/exposure.js');
    const E = globalThis.Houle.exposure;
    const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
    // terre à l'est du méridien 0 : plage face à l'ouest ; 
    const gj = { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [rect(0, 40, 5, 50)] } },
    ] };
    const seg = X.segmentsOf(X.ringsFromGeoJSON(gj));
    const r = X.computeExposure(seg, 45, -0.0005); // plage à l'ouest de la côte (terre en x > 0)
    assert.ok(r.o, 'fenêtre trouvée');
    const arc = (d) => F.inArc(d, r.o[0], r.o[1]);
    assert.ok(arc(270) && arc(240) && arc(300), 'ouest ouvert');
    assert.ok(!arc(90) && !arc(60), 'est (terre) fermé');
    assert.ok(r.width >= 150 && r.width <= 200, 'ouverture d\'environ 180° : ' + r.width);
    assert.ok(r.w && F.inArc(90, r.w[0], r.w[1]), 'vent offshore = venant de la terre (est)');
    assert.strictEqual(r.f.length, 36);
    assert.ok(r.f[27] >= 80 && r.f[9] < 15);
    // une île juste au large masque une partie de l'ouest
    const gj2 = { type: 'Polygon', coordinates: [rect(0, 40, 5, 50), rect(-0.35, 44.9, -0.2, 45.1)] };
    const seg2 = X.segmentsOf(X.ringsFromGeoJSON(gj2));
    // (anneau 2 = trou en parité : on teste plutôt une vraie île séparée)
    const gj3 = { type: 'MultiPolygon', coordinates: [[rect(0, 40, 5, 50)], [rect(-0.35, 44.9, -0.2, 45.1)]] };
    const r3 = X.computeExposure(X.segmentsOf(X.ringsFromGeoJSON(gj3)), 45, -0.0005);
    assert.ok(r3.f[27] < 20, 'île à 20 km plein ouest : houle masquée (' + r3.f[27] + ' km)');
    assert.ok(r3.f[22] >= 80, 'houle d\'ouest-sud-ouest passe');
    // spot sur une île entière : ouvert de tous côtés
    const isl = X.computeExposure(X.segmentsOf(X.ringsFromGeoJSON({ type: 'Polygon', coordinates: [rect(10, 10, 10.02, 10.02)] })), 10.01, 10.01);
    assert.deepStrictEqual(isl.o, [0, 360]);
    // spot dans un lac / baie fermée : rien d'ouvert
    const ring = { type: 'Polygon', coordinates: [rect(-3, 42, 3, 48), rect(-0.3, 44.8, 0.3, 45.2)] };
    assert.strictEqual(X.computeExposure(X.segmentsOf(X.ringsFromGeoJSON(ring)), 45, 0.28).o, null);
    // côté appli : atténuation
    const ex = { o: r.o, w: r.w, f: r.f };
    assert.strictEqual(E.factor(ex, 270), 1);
    assert.ok(E.factor(ex, 90) <= 0.2 && E.factor(ex, 90) >= 0.15);
    assert.strictEqual(E.factor(null, 90), 1);
    const hrs = [{ wave: 2, waveDir: 270 }, { wave: 2, waveDir: 90 }, { wave: null, waveDir: 90 }];
    const at = E.attenuate(hrs, ex);
    assert.strictEqual(at[0].wave, 2); assert.ok(at[1].wave < 0.5 && at[1].shelter < 1); assert.strictEqual(at[2].wave, null);
    assert.strictEqual(hrs[1].wave, 2, 'copie, pas de modification');
    assert.strictEqual(E.attenuate(hrs, null), hrs);
    assert.strictEqual(E.lookup(45, 0.001, { '45.0000,0.0010': ex }), ex);
    assert.strictEqual(E.lookup(1, 1, {}), null);
    n++; console.log('ok  exposition : fenêtre, île, lac, atténuation');
  }
  console.log('\n' + n + ' groups passed');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
