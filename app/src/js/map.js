/* Houle - carte (Leaflet + OpenStreetMap / satellite Esri) */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  function createMap(el, handlers) {
    const L = globalThis.L;
    const noop = () => {};
    if (!L) {
      return { ready: false, setKnown: noop, setKnownFilter: noop, setKnownEmoji: noop, setKnownVisible: noop, setSpots: noop, setShared: noop, flyTo: noop, setTempPin: noop, fitAll: noop, toggleSatellite: noop, invalidate: noop, locate: () => Promise.reject(new Error('Carte indisponible')) };
    }

    const map = L.map(el, { zoomControl: false, worldCopyJump: true, preferCanvas: true }).setView([40, -4], 4);
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Fonds de carte sans clé d'accès. OpenStreetMap refuse les fichiers ouverts depuis l'ordinateur
    // (pas d'adresse d'origine) : on l'utilise seulement quand l'appli est en ligne (http/https).
    const online = /^https?:$/.test(location.protocol);
    const OSM = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxZoom: 19, attribution: '&copy; contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' } };
    const ESRI_ST = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', opt: { maxZoom: 19, attribution: 'Fond &copy; Esri, HERE, Garmin, OpenStreetMap' } };
    const TOPO = { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', opt: { subdomains: 'abc', maxZoom: 17, attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap' } };
    const CHAIN = online ? [OSM, ESRI_ST, TOPO] : [ESRI_ST, TOPO];
    let idx = 0;
    const mk = (c) => L.tileLayer(c.url, c.opt);
    let osm = mk(CHAIN[0]);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri' });
    let errs = 0;
    const note = document.createElement('div');
    note.className = 'tilenote'; note.hidden = true;
    note.textContent = 'Le fond de carte ne se charge pas. Essaie la vue satellite (bouton couches), vérifie ta connexion, ou ouvre le fichier dans Chrome / Safari / Edge plutôt que dans un aperçu.';
    el.parentNode.appendChild(note);
    const okTile = () => { note.hidden = true; };
    function watch(layer) {
      layer.on('tileload', okTile);
      layer.on('tileerror', function () {
        if (++errs < 4) return;
        errs = 0;
        if (idx >= CHAIN.length - 1) { note.hidden = false; return; }
        idx++;
        const wasOn = map.hasLayer(osm);
        map.removeLayer(osm);
        osm = mk(CHAIN[idx]);
        watch(osm);
        if (wasOn) osm.addTo(map);
      });
    }
    sat.on("tileerror", function () { if (++errs >= 4) { errs = 0; note.hidden = false; } });
    sat.on('tileload', okTile);
    watch(osm);
    osm.addTo(map);
    el.dataset.layer = 'osm';

    const pinIcon = (cls, selected, emoji) =>
      L.divIcon({ className: 'pin-wrap', html: '<div class="pin ' + cls + (selected ? ' is-selected' : '') + '"></div>' + (emoji ? '<span class="pin-emoji">' + emoji + '</span>' : ''), iconSize: [28, 36], iconAnchor: [14, 34] });

    let markers = {}, sharedMarkers = [], temp = null, knownLayer = null, knownOn = true;

    let knownList = [], knownMarkers = [], knownShow = () => true, knownEmoji = {};
    const knownIcon = (k, i) => L.divIcon({
      className: 'kpin-wrap',
      html: '<div class="kpin kpin--' + k.p + (k.est ? ' kpin--est' : '') + '"></div>' + (knownEmoji[i] ? '<span class="kpin-emoji">' + knownEmoji[i] + '</span>' : ''),
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    function relabel() {
      const z = map.getZoom();
      const bounds = map.getBounds ? map.getBounds() : null;
      let n = 0;
      knownMarkers.forEach((m, i) => {
        if (!m) return;
        const want = z >= 11 && knownShow(knownList[i]) && knownOn && (!bounds || bounds.contains(m.getLatLng())) && n < 90;
        if (want) n++;
        if (want === !!m.__lab) return;
        m.__lab = want;
        m.unbindTooltip();
        m.bindTooltip(knownList[i].name, want ? { permanent: true, direction: 'right', offset: [8, 0], className: 'klabel' } : { direction: 'top', offset: [0, -8] });
      });
    }
    function setKnown(list) {
      if (knownLayer) map.removeLayer(knownLayer);
      knownLayer = L.layerGroup();
      knownList = list;
      knownMarkers = list.map((k, i) => {
        const m = L.marker([k.lat, k.lon], { icon: knownIcon(k, i), title: k.name, keyboard: true, riseOnHover: true });
        m.bindTooltip(k.name, { direction: 'top', offset: [0, -8] });
        m.on('click', () => handlers.onKnownClick(i));
        return m;
      });
      applyKnownFilter();
      if (knownOn) knownLayer.addTo(map);
      map.on('zoomend moveend', relabel);
      relabel();
    }
    function applyKnownFilter() {
      if (!knownLayer) return;
      knownMarkers.forEach((m, i) => {
        const on = knownShow(knownList[i]);
        if (on) { if (!knownLayer.hasLayer || !knownLayer.hasLayer(m)) m.addTo(knownLayer); } else if (knownLayer.removeLayer) knownLayer.removeLayer(m);
      });
    }
    function setKnownFilter(pred) { knownShow = pred || (() => true); applyKnownFilter(); relabel(); }
    function setKnownEmoji(i, emoji) {
      knownEmoji[i] = emoji;
      if (knownMarkers[i] && knownMarkers[i].setIcon) knownMarkers[i].setIcon(knownIcon(knownList[i], i));
    }
    function setKnownVisible(on) {
      knownOn = !!on;
      if (!knownLayer) return;
      if (knownOn) knownLayer.addTo(map); else map.removeLayer(knownLayer);
      relabel();
    }

    function setSpots(spots, stateOf, selectedId, emojiOf) {
      Object.keys(markers).forEach((id) => map.removeLayer(markers[id]));
      markers = {};
      spots.forEach((s) => {
        const m = L.marker([s.lat, s.lon], { icon: pinIcon('pin--' + (stateOf(s.id) || 'idle'), s.id === selectedId, emojiOf ? emojiOf(s.id) : ''), title: s.name, keyboard: true });
        m.bindTooltip(s.name, { direction: 'top', offset: [0, -30] });
        m.on('click', () => handlers.onSpotClick(s.id));
        m.addTo(map);
        markers[s.id] = m;
      });
    }

    function setShared(list) {
      sharedMarkers.forEach((m) => map.removeLayer(m));
      sharedMarkers = list.map((s) => {
        const m = L.marker([s.lat, s.lon], { icon: pinIcon('pin--shared', false), title: s.name });
        m.bindTooltip(s.name + ' (carte commune)', { direction: 'top', offset: [0, -30] });
        m.on('click', () => handlers.onSharedClick(s.key));
        m.addTo(map);
        return m;
      });
    }

    function setTempPin(lat, lon) {
      if (temp) { map.removeLayer(temp); temp = null; }
      if (lat == null) return;
      temp = L.marker([lat, lon], { icon: pinIcon('pin--temp', false), draggable: true, zIndexOffset: 1000, title: 'Nouveau spot' });
      temp.on('dragend', () => { const p = temp.getLatLng(); handlers.onTempMove(p.lat, p.lng); });
      temp.addTo(map);
    }

    function flyTo(lat, lon, zoom) {
      map.flyTo([lat, lon], zoom || Math.max(map.getZoom(), 13), { duration: 0.8 });
    }

    function fitAll(points) {
      if (!points.length) return;
      if (points.length === 1) return map.setView([points[0].lat, points[0].lon], 12);
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [40, 40], maxZoom: 12 });
    }

    function toggleSatellite() {
      const isSat = map.hasLayer(sat);
      if (isSat) { map.removeLayer(sat); osm.addTo(map); } else { map.removeLayer(osm); sat.addTo(map); }
      el.dataset.layer = isSat ? 'osm' : 'sat';
      return !isSat;
    }

    function locate() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Position non disponible sur cet appareil'));
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => reject(new Error("Position refusée ou indisponible. Vérifie l'autorisation du navigateur.")),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
    }

    map.on('click', (e) => handlers.onMapClick(e.latlng.lat, e.latlng.lng));

    return { ready: true, raw: map, setKnown, setKnownFilter, setKnownEmoji, setKnownVisible, setSpots, setShared, flyTo, setTempPin, fitAll, toggleSatellite, locate, invalidate: () => map.invalidateSize() };
  }

  H.createMap = createMap;
})();
