/* Faux Leaflet pour les tests : enregistre les appels, ne dessine rien. */
(function () {
  window.__bounds = [43.0, -2.5, 44.5, -0.5];
  function MapStub(el) { this.el = el; this.h = {}; this.layers = new Set(); this.zoom = 4; }
  MapStub.prototype = {
    setView() { return this; },
    flyTo(c, z) { this.zoom = z; (window.__flies = window.__flies || []).push([c, z]); return this; },
    fitBounds() { window.__fit = (window.__fit || 0) + 1; },
    getZoom() { return this.zoom; },
    hasLayer(l) { return this.layers.has(l); },
    removeLayer(l) { this.layers.delete(l); },
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; },
    fire(ev, e) { (this.h[ev] || []).forEach((f) => f(e)); },
    invalidateSize() {},
    getBounds() { const b = window.__bounds; return { contains() { return true; }, getSouth: () => b[0], getWest: () => b[1], getNorth: () => b[2], getEast: () => b[3] }; },
    getSize() { return { x: this.el.clientWidth, y: this.el.clientHeight }; },
    getContainer() { return this.el; },
    latLngToContainerPoint(ll) { const b = window.__bounds, w = this.el.clientWidth, h = this.el.clientHeight; const lat = Array.isArray(ll) ? ll[0] : ll.lat, lon = Array.isArray(ll) ? ll[1] : ll.lng; return { x: ((lon - b[1]) / (b[3] - b[1])) * w, y: ((b[2] - lat) / (b[2] - b[0])) * h }; },
    containerPointToLatLng(p) { const b = window.__bounds, w = this.el.clientWidth, h = this.el.clientHeight; const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y; return { lat: b[2] - (y / h) * (b[2] - b[0]), lng: b[1] + (x / w) * (b[3] - b[1]) }; },
  };
  window.L = {
    map(el) { const m = new MapStub(el); window.__map = m; return m; },
    control: { zoom() { return { addTo() {} }; } },
    tileLayer(url) { return { url, on() { return this; }, addTo(m) { m.layers.add(this); return this; } }; },
    divIcon(o) { return o; },
    layerGroup() { return { layers: new Set(), get items() { return [...this.layers]; }, isGroup: true, addTo(m) { m.layers.add(this); return this; }, hasLayer(l) { return this.layers.has(l); }, removeLayer(l) { this.layers.delete(l); } }; },
    marker(ll, o) {
      return {
        ll, o, h: {},
        bindTooltip() { return this; },
        unbindTooltip() { return this; },
        setIcon(i) { this.o = Object.assign({}, this.o, { icon: i }); return this; },
        on(ev, fn) { this.h[ev] = fn; return this; },
        addTo(m) { m.layers.add(this); return this; },
        getLatLng() { return { lat: this.ll[0], lng: this.ll[1] }; },
      };
    },
    latLngBounds(a) { return a; },
  };
  window.__markers = () => Array.from(window.__map.layers).filter((l) => l.ll).map((l) => ({ lat: l.ll[0], lon: l.ll[1], cls: l.o.icon.html, title: l.o.title }));
  window.__clickMarker = (title) => { const m = Array.from(window.__map.layers).find((l) => l.ll && l.o.title === title); m.h.click(); };
})();
