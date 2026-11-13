/* Houle - stockage sur l'appareil (IndexedDB) : mode sans compte */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});

  const mem = {}; // secours si IndexedDB est bloqué (navigation privée, etc.)
  let dbPromise = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        try {
          const r = indexedDB.open('houle', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        } catch (e) { reject(e); }
      });
    }
    return dbPromise;
  };
  const kvGet = async (k) => {
    try {
      const db = await open();
      return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    } catch (e) { return mem[k]; }
  };
  const kvSet = async (k, v) => {
    try {
      const db = await open();
      await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) { mem[k] = v; }
  };

  const clean = (s) => ({
    id: s.id, name: s.name, lat: s.lat, lon: s.lon, notes: s.notes || '', photos: s.photos || [], linkUrl: s.linkUrl || '',
    rules: s.rules || {}, createdAt: s.createdAt || Date.now(), updatedAt: Date.now(),
    ...(s.batch ? { batch: s.batch } : {}), ...(s.quiet ? { quiet: true } : {}),
  });

  const store = {
    mode: 'local',
    social: false,
    async init() { return { user: null }; },
    async listSpots() {
      const list = (await kvGet('spots')) || [];
      return list.map((s) => Object.assign({}, s, { photoCount: (s.photos || []).length }));
    },
    async saveSpot(spot) {
      const list = (await kvGet('spots')) || [];
      const i = list.findIndex((s) => s.id === spot.id);
      const prev = i >= 0 ? list[i] : null;
      const next = clean(Object.assign({}, prev || {}, spot));
      if (i >= 0) list[i] = next; else list.push(next);
      await kvSet('spots', list);
      return Object.assign({}, next, { photoCount: next.photos.length });
    },
    async deleteSpot(id) {
      const list = (await kvGet('spots')) || [];
      await kvSet('spots', list.filter((s) => s.id !== id));
    },
    async getPhotos(id) {
      const list = (await kvGet('spots')) || [];
      const s = list.find((x) => x.id === id);
      return s ? s.photos || [] : [];
    },
    async exportAll() {
      return { app: 'houle', version: 1, exportedAt: new Date().toISOString(), spots: (await kvGet('spots')) || [] };
    },
    async importAll(data) {
      if (!data || data.app !== 'houle' || !Array.isArray(data.spots)) throw new Error('Fichier non reconnu');
      const list = (await kvGet('spots')) || [];
      const ids = new Set(list.map((s) => s.id));
      let added = 0;
      data.spots.forEach((s) => {
        if (s && s.id && !ids.has(s.id) && typeof s.lat === 'number' && typeof s.lon === 'number') { list.push(clean(s)); added++; }
      });
      await kvSet('spots', list);
      return added;
    },
  };

  H.localStore = store;
})();
