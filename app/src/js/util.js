/* Houle - utilitaires (texte, dates, coordonnées, images) */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const safeUrl = (u) => {
    try {
      const x = new URL(String(u || '').trim());
      return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '';
    } catch (e) {
      return '';
    }
  };

  const safeImg = (u) => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u || '') ? u : '');

  const uid = () => {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };

  /* nombres au format français */
  const num = (n, d = 1) => (n == null || Number.isNaN(n) ? '–' : Number(n).toFixed(d).replace('.', ','));

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const compass = (deg) => (deg == null || Number.isNaN(deg) ? '' : COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]);

  /* moyenne circulaire pour les directions */
  const circMean = (degs) => {
    const v = degs.filter((d) => d != null && !Number.isNaN(d));
    if (!v.length) return null;
    let x = 0, y = 0;
    v.forEach((d) => { x += Math.cos((d * Math.PI) / 180); y += Math.sin((d * Math.PI) / 180); });
    const a = (Math.atan2(y, x) * 180) / Math.PI;
    return (a + 360) % 360;
  };

  /* dates : on manipule des chaînes AAAA-MM-JJ */
  const ymd = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  const daysBetween = (a, b) => {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  };
  const dayDate = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
  const fmtDay = (s) => dayDate(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const weekdayShort = (s) => dayDate(s).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
  const leadLabel = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : 'dans ' + n + ' jours');

  /* coordonnées collées : "43.48123, -1.55678", "43,48 -1,55", "43.48 N 1.55 W" */
  const parseCoords = (text) => {
    const t = String(text || '').replace(/°/g, '').trim();
    const m = t.match(/^(-?\d+(?:[.,]\d+)?)\s*([NSns])?\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*([EWOewo])?$/);
    if (!m) return null;
    let lat = parseFloat(m[1].replace(',', '.'));
    let lon = parseFloat(m[3].replace(',', '.'));
    if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
    if (m[4] && /[wo]/i.test(m[4])) lon = -Math.abs(lon);
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return null;
    return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
  };
  const fmtCoords = (lat, lon) => lat.toFixed(5) + ', ' + lon.toFixed(5);

  /* réduit une photo pour qu'elle reste légère à stocker */
  const compressImage = (file, maxSide = 720, quality = 0.68) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
      img.src = url;
    });

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Chargement impossible : ' + src));
      document.head.appendChild(s);
    });

  H.util = { esc, safeUrl, safeImg, uid, num, compass, circMean, ymd, daysBetween, dayDate, fmtDay, weekdayShort, leadLabel, parseCoords, fmtCoords, compressImage, loadScript };
})();
