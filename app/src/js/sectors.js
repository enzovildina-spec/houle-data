/* Houle - secteurs de direction vert / orange / rouge d'un spot (houle ou vent) : logique pure.
   Modèle : { from, to, orL, orR } en degrés. Vert = de « from » à « to » (sens des aiguilles d'une montre, direction d'où vient la houle/le vent).
   Orange = orL degrés avant « from » et orR degrés après « to » (0 = fermé de ce côté). Le reste est rouge. from = to : tout est vert. */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const mod = (a) => ((a % 360) + 360) % 360;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r5 = (v) => Math.round(v / 5) * 5;

  const widthOf = (m) => { const w = mod(m.to - m.from); return w === 0 ? 360 : w; };
  const fix = (m) => {
    const w = widthOf(m), room = Math.max(0, 360 - w);
    let orL = clamp(Math.round(m.orL || 0), 0, 180), orR = clamp(Math.round(m.orR || 0), 0, 180);
    if (orL + orR > room) { const k = room / (orL + orR || 1); orL = Math.floor(orL * k); orR = Math.floor(orR * k); }
    return { from: mod(Math.round(m.from)), to: mod(Math.round(m.to)), orL, orR };
  };

  /* morceaux à dessiner : [{cls, a, b}] avec a→b dans le sens horaire (b peut dépasser 360) */
  function segments(model) {
    const m = fix(model), w = widthOf(m), out = [];
    out.push({ cls: 'green', a: m.from, b: m.from + w });
    if (w >= 360) return out;
    if (m.orL > 0) out.push({ cls: 'orange', a: m.from - m.orL, b: m.from });
    if (m.orR > 0) out.push({ cls: 'orange', a: m.from + w, b: m.from + w + m.orR });
    const redW = 360 - w - m.orL - m.orR;
    if (redW > 0) out.push({ cls: 'red', a: m.from + w + m.orR, b: m.from + w + m.orR + redW });
    return out;
  }

  /* déplacer une poignée vers l'angle theta (degrés, 0 = nord, sens horaire) */
  function drag(model, handle, theta) {
    const m = fix(model), t = mod(theta), w = widthOf(m);
    if (handle === 'from') {
      const to = m.to, nf = t, nw = mod(to - nf) || 360;
      if (nw < 5) return m;
      return fix({ from: nf, to, orL: m.orL, orR: m.orR });
    }
    if (handle === 'to') {
      const nw = mod(t - m.from) || 360;
      if (nw < 5) return m;
      return fix({ from: m.from, to: t, orL: m.orL, orR: m.orR });
    }
    if (handle === 'orL') {
      const inside = mod(t - m.from) < w, d = inside ? 0 : mod(m.from - t);
      return fix({ from: m.from, to: m.to, orL: d > 180 ? 0 : d, orR: m.orR });
    }
    if (handle === 'orR') {
      const inside = mod(t - m.from) < w, d = inside ? 0 : mod(t - m.to);
      return fix({ from: m.from, to: m.to, orL: m.orL, orR: d > 180 ? 0 : d });
    }
    return m;
  }

  /* point de départ d'après la fenêtre de houle libre (o) et le vent offshore (w) calculés sur la côte */
  function starter(o, w) {
    const out = { swell: null, wind: null };
    if (o && o.length === 2) {
      const width = mod(o[1] - o[0]) || 360;
      if (width >= 300) out.swell = { from: 0, to: 0, orL: 0, orR: 0 };
      else { const side = r5(width * 0.2); out.swell = fix({ from: mod(o[0] + side), to: mod(o[1] - side), orL: side, orR: side }); }
    }
    if (w && w.length === 2) out.wind = fix({ from: w[0], to: w[1], orL: 30, orR: 30 });
    return out;
  }

  /* texte lisible : « vert 200° à 260°, orange 20° avant, fermé après » */
  function describe(model) {
    const m = fix(model);
    if (widthOf(m) >= 360) return 'toutes les directions';
    return 'vert de ' + m.from + '° à ' + m.to + '° · orange ' + (m.orL ? m.orL + '° avant' : 'fermé avant') + ', ' + (m.orR ? m.orR + '° après' : 'fermé après');
  }

  H.sectors = { fix, segments, drag, starter, describe, mod, widthOf };
})();
