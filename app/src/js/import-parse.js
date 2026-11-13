/* Houle - lecture de fichiers de lieux (Google Maps / My Maps / Takeout) : KML, KMZ, GeoJSON, CSV.
   Ces fonctions ne font que LIRE un texte : rien n'est envoyé nulle part et rien n'est modifié chez Google. */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  const decodeEntities = (s) => String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
  const stripCdata = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const toText = (s) => decodeEntities(stripCdata(s || '')).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const validLL = (lat, lon) => lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);

  /* coordonnées cachées dans une adresse Google Maps */
  function coordsFromUrl(url) {
    if (!url) return null;
    const u = String(url);
    const pats = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /[?&](?:q|ll|query|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i];
    for (const re of pats) { const m = re.exec(u); if (m) { const lat = num(m[1]), lon = num(m[2]); if (validLL(lat, lon)) return { lat, lon }; } }
    return null;
  }

  const newResult = () => ({ items: [], total: 0, noCoords: 0, notPoint: 0 });
  function push(res, name, lat, lon, notes) {
    res.total++;
    if (!validLL(lat, lon)) { res.noCoords++; return; }
    res.items.push({ name: (String(name || '').trim() || 'Spot importé').slice(0, 80), lat: +lat.toFixed(6), lon: +lon.toFixed(6), notes: String(notes || '').trim().slice(0, 2000) });
  }

  /* ---------- KML ---------- */
  function parseKml(text) {
    const res = newResult();
    const blocks = String(text).match(/<Placemark[\s>][\s\S]*?<\/Placemark>/gi) || [];
    blocks.forEach((b) => {
      const name = toText((/<name>([\s\S]*?)<\/name>/i.exec(b) || [])[1]);
      const desc = toText((/<description>([\s\S]*?)<\/description>/i.exec(b) || [])[1]);
      const pt = /<Point[\s>][\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i.exec(b);
      if (!pt) { res.total++; res.notPoint++; return; } // ligne ou zone tracée : ignorée
      const [lon, lat] = pt[1].trim().split(/[\s,]+/).map(num);
      push(res, name, lat, lon, desc);
    });
    return res;
  }

  /* ---------- GeoJSON (dont « Lieux enregistrés » de Google Takeout) ---------- */
  function parseGeoJson(obj) {
    const res = newResult();
    const feats = obj && obj.type === 'FeatureCollection' ? obj.features : obj && obj.type === 'Feature' ? [obj] : Array.isArray(obj) ? obj : [];
    (feats || []).forEach((f) => {
      if (!f) return;
      const p = f.properties || {}, loc = p.Location || p.location || {}, g = f.geometry;
      const name = p.Title || p.title || p.name || p.Name || loc['Business Name'] || '';
      const notes = [p.Comment || p.comment || p.description || p.Description || p.Note || '', loc.Address || loc.address || ''].filter(Boolean).join('\n');
      if (g && g.type && g.type !== 'Point') { res.total++; res.notPoint++; return; }
      let lat = null, lon = null;
      if (g && Array.isArray(g.coordinates)) { lon = num(g.coordinates[0]); lat = num(g.coordinates[1]); }
      if (!validLL(lat, lon)) {
        const gc = loc['Geo Coordinates'] || {};
        const a = num(gc.Latitude), o = num(gc.Longitude);
        if (validLL(a, o)) { lat = a; lon = o; } else { const c = coordsFromUrl(p['Google Maps URL'] || p.google_maps_url || p.url || p.URL); if (c) { lat = c.lat; lon = c.lon; } }
      }
      push(res, name, lat, lon, notes);
    });
    return res;
  }

  /* ---------- CSV ---------- */
  function splitCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    const delim = (String(text).split('\n')[0].match(/;/g) || []).length > (String(text).split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
    return rows;
  }
  function parseCsv(text) {
    const res = newResult(), rows = splitCsv(text);
    if (rows.length < 2) return res;
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const iName = col('title', 'name', 'nom', 'titre', 'lieu'), iNote = col('note', 'notes', 'comment', 'commentaire', 'description'), iUrl = col('url', 'google maps url', 'lien');
    const iLat = col('lat', 'latitude'), iLon = col('lon', 'lng', 'long', 'longitude');
    rows.slice(1).forEach((r) => {
      let lat = iLat >= 0 ? num(r[iLat]) : null, lon = iLon >= 0 ? num(r[iLon]) : null;
      if (!validLL(lat, lon)) { const c = coordsFromUrl(iUrl >= 0 ? r[iUrl] : r.find((x) => /^https?:\/\//.test(x || ''))); lat = c ? c.lat : null; lon = c ? c.lon : null; }
      push(res, iName >= 0 ? r[iName] : r[0], lat, lon, [iNote >= 0 ? r[iNote] : '', ''].filter(Boolean).join('\n'));
    });
    return res;
  }

  /* ---------- KMZ (zip contenant un KML) ---------- */
  async function unzipKml(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Fichier KMZ illisible');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (!/\.kml$/i.test(name)) continue;
      const lnlen = dv.getUint16(off + 26, true), lelen = dv.getUint16(off + 28, true), start = off + 30 + lnlen + lelen;
      const data = u8.subarray(start, start + csize);
      if (method === 0) return new TextDecoder().decode(data);
      if (method === 8) {
        const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new TextDecoder().decode(await new Response(ds).arrayBuffer());
      }
    }
    throw new Error('Aucun fichier KML dans ce KMZ');
  }

  /* point d'entrée : buf = ArrayBuffer du fichier, filename = son nom */
  async function parseFile(buf, filename) {
    const u8 = new Uint8Array(buf);
    let text;
    if (u8[0] === 0x50 && u8[1] === 0x4b) text = await unzipKml(buf); // « PK » : zip (KMZ)
    else text = new TextDecoder('utf-8').decode(buf);
    const t = text.replace(/^﻿/, '').trimStart();
    if (/^</.test(t) && /<kml[\s>]|<Placemark/i.test(t)) return Object.assign(parseKml(t), { format: 'KML' });
    if (/^[{[]/.test(t)) { let obj; try { obj = JSON.parse(t); } catch (e) { throw new Error('Fichier JSON illisible'); } return Object.assign(parseGeoJson(obj), { format: 'GeoJSON' }); }
    if (/\.(csv|tsv|txt)$/i.test(filename || '') || t.includes(',') || t.includes(';')) return Object.assign(parseCsv(t), { format: 'CSV' });
    throw new Error('Format non reconnu (attendu : KML, KMZ, GeoJSON ou CSV)');
  }

  /* doublons : un spot déjà présent à moins de 100 m, ou deux lieux du fichier à moins de 30 m portant le même nom */
  const dist = (a, b) => {
    const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
    return 6371000 * Math.hypot(x, y);
  };
  function markDuplicates(items, existing) {
    const seen = [];
    items.forEach((it) => {
      const hit = existing.find((s) => dist(s, it) < 100);
      if (hit) { it.dup = 'Déjà dans tes spots : ' + hit.name; return; }
      const same = seen.find((s) => dist(s, it) < 30 && s.name.toLowerCase() === it.name.toLowerCase());
      if (same) { it.dup = 'Doublon dans le fichier'; return; }
      seen.push(it);
    });
    return items;
  }

  H.importer = { coordsFromUrl, parseKml, parseGeoJson, parseCsv, parseFile, unzipKml, markDuplicates, dist };
})();
