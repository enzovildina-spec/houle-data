/* Houle - stockage et social sur Supabase (comptes, amis, partages, cartes communes) */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const U = H.util;

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  const MESSAGES = [
    [/Invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
    [/Email not confirmed/i, 'Confirme ton adresse e-mail (lien reçu par mail), puis reconnecte-toi.'],
    [/already registered|already been registered/i, 'Un compte existe déjà avec cet e-mail. Connecte-toi.'],
    [/at least \d+ characters|weak password/i, 'Mot de passe trop court : 6 caractères minimum.'],
    [/valid email|invalid format|Unable to validate email/i, "Cette adresse e-mail n'est pas valide."],
    [/rate limit|too many/i, 'Trop de tentatives. Réessaie dans quelques minutes.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'Connexion au serveur impossible. Vérifie ta connexion internet.'],
    [/row-level security|violates row-level/i, "Action refusée : tu n'as pas les droits pour ça."],
  ];
  const friendly = (err) => {
    const msg = (err && err.message) || String(err);
    for (let i = 0; i < MESSAGES.length; i++) if (MESSAGES[i][0].test(msg)) return new Error(MESSAGES[i][1]);
    return new Error(msg);
  };
  const unwrap = (res) => {
    if (res.error) throw friendly(res.error);
    return res.data;
  };

  function createSupabaseStore(cfg) {
    let sb = null;
    let me = null; // { id, email, username }

    const spotCols = 'id,name,lat,lon,notes,link_url,rules,photo_count,created_at,updated_at';
    const rowToSpot = (r) => ({
      id: r.id, name: r.name, lat: r.lat, lon: r.lon, notes: r.notes || '', linkUrl: r.link_url || '', rules: r.rules || {},
      photoCount: r.photo_count || 0, createdAt: Date.parse(r.created_at) || Date.now(), updatedAt: Date.parse(r.updated_at) || Date.now(),
    });

    async function namesOf(ids) {
      const list = Array.from(new Set(ids.filter(Boolean)));
      if (!list.length) return {};
      const rows = unwrap(await sb.from('profiles').select('id,username').in('id', list));
      const out = {};
      rows.forEach((r) => { out[r.id] = r.username; });
      return out;
    }

    async function loadProfile() {
      const { data, error } = await sb.auth.getUser();
      if (error || !data || !data.user) { me = null; return null; }
      const p = unwrap(await sb.from('profiles').select('id,username').eq('id', data.user.id).maybeSingle());
      me = { id: data.user.id, email: data.user.email, username: p ? p.username : null };
      return me;
    }

    const store = {
      mode: 'supabase',
      social: true,
      get me() { return me; },

      async init() {
        if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Serveur non configuré');
        if (!globalThis.supabase) await U.loadScript(SDK_URL);
        sb = globalThis.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) return { user: null };
        return { user: await loadProfile() };
      },

      /* ----- compte ----- */
      async signUp(email, password) {
        const res = await sb.auth.signUp({ email: email.trim(), password });
        if (res.error) throw friendly(res.error);
        if (res.data && res.data.session) return { user: await loadProfile() };
        return { needsConfirm: true };
      },
      async signIn(email, password) {
        const res = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (res.error) throw friendly(res.error);
        return { user: await loadProfile() };
      },
      async signOut() { await sb.auth.signOut(); me = null; },
      async createProfile(username) {
        const name = String(username || '').trim().toLowerCase().replace(/^@/, '');
        if (!/^[a-z0-9_]{3,20}$/.test(name)) throw new Error('Pseudo : 3 à 20 caractères, lettres minuscules, chiffres ou _.');
        const { data } = await sb.auth.getUser();
        const res = await sb.from('profiles').insert({ id: data.user.id, username: name });
        if (res.error) {
          if (res.error.code === '23505') throw new Error('Ce pseudo est déjà pris.');
          throw friendly(res.error);
        }
        return loadProfile();
      },

      /* ----- spots (privés : seul le propriétaire les voit) ----- */
      async listSpots() {
        return unwrap(await sb.from('spots').select(spotCols).order('created_at')).map(rowToSpot);
      },
      async saveSpot(spot) {
        const row = {
          id: spot.id, name: spot.name, lat: spot.lat, lon: spot.lon, notes: spot.notes || '', link_url: spot.linkUrl || '',
          rules: spot.rules || {}, updated_at: new Date().toISOString(),
        };
        if (Array.isArray(spot.photos)) row.photos = spot.photos;
        return rowToSpot(unwrap(await sb.from('spots').upsert(row).select(spotCols).single()));
      },
      async deleteSpot(id) { unwrap(await sb.from('spots').delete().eq('id', id)); },
      async getPhotos(id) {
        const r = unwrap(await sb.from('spots').select('photos').eq('id', id).maybeSingle());
        return r && Array.isArray(r.photos) ? r.photos : [];
      },
      async exportAll() {
        const rows = unwrap(await sb.from('spots').select('*').order('created_at'));
        return {
          app: 'houle', version: 1, exportedAt: new Date().toISOString(),
          spots: rows.map((r) => Object.assign(rowToSpot(r), { photos: r.photos || [] })),
        };
      },
      async importAll(data) {
        if (!data || data.app !== 'houle' || !Array.isArray(data.spots)) throw new Error('Fichier non reconnu');
        const rows = data.spots
          .filter((s) => s && s.id && typeof s.lat === 'number' && typeof s.lon === 'number')
          .map((s) => ({ id: s.id, name: String(s.name || 'Spot'), lat: s.lat, lon: s.lon, notes: s.notes || '', link_url: s.linkUrl || '', rules: s.rules || {}, photos: s.photos || [] }));
        if (!rows.length) return 0;
        unwrap(await sb.from('spots').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
        return rows.length;
      },

      /* ----- amis ----- */
      async listFriends() {
        const rows = unwrap(await sb.from('friendships').select('id,requester,addressee,status'));
        const otherOf = (r) => (r.requester === me.id ? r.addressee : r.requester);
        const names = await namesOf(rows.map(otherOf));
        const out = { friends: [], incoming: [], outgoing: [] };
        rows.forEach((r) => {
          const item = { friendshipId: r.id, id: otherOf(r), username: names[otherOf(r)] || '?' };
          if (r.status === 'accepted') out.friends.push(item);
          else if (r.addressee === me.id) out.incoming.push(item);
          else out.outgoing.push(item);
        });
        out.friends.sort((a, b) => a.username.localeCompare(b.username));
        return out;
      },
      async requestFriend(username) {
        const u = String(username || '').trim().toLowerCase().replace(/^@/, '');
        if (!u) throw new Error('Saisis un pseudo.');
        const p = unwrap(await sb.from('profiles').select('id,username').eq('username', u).maybeSingle());
        if (!p) throw new Error('Aucun utilisateur avec ce pseudo.');
        if (p.id === me.id) throw new Error("C'est ton propre pseudo.");
        const res = await sb.from('friendships').insert({ addressee: p.id });
        if (res.error) {
          if (res.error.code === '23505') throw new Error('Une demande existe déjà avec ' + p.username + ' (regarde aussi tes demandes reçues).');
          throw friendly(res.error);
        }
        return p.username;
      },
      async respondFriend(friendshipId, accept) {
        if (accept) unwrap(await sb.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId));
        else unwrap(await sb.from('friendships').delete().eq('id', friendshipId));
      },
      async removeFriend(friendshipId) { unwrap(await sb.from('friendships').delete().eq('id', friendshipId)); },

      /* ----- partages envoyés aux amis ----- */
      async sendShares(toIds, kind, payload) {
        if (!toIds.length) return;
        unwrap(await sb.from('shares').insert(toIds.map((to) => ({ to_user: to, kind, payload }))));
      },
      async listInbox() {
        const rows = unwrap(await sb.from('shares').select('id,from_user,kind,payload,seen,created_at').eq('to_user', me.id).order('created_at', { ascending: false }).limit(100));
        const names = await namesOf(rows.map((r) => r.from_user));
        return rows.map((r) => ({ id: r.id, from: names[r.from_user] || '?', kind: r.kind, payload: r.payload || {}, seen: !!r.seen, createdAt: Date.parse(r.created_at) }));
      },
      async markSeen(ids) { if (ids.length) unwrap(await sb.from('shares').update({ seen: true }).in('id', ids)); },
      async deleteShare(id) { unwrap(await sb.from('shares').delete().eq('id', id)); },

      /* ----- cartes communes ----- */
      async listMaps() {
        const maps = unwrap(await sb.from('maps').select('id,name,owner,join_code,created_at').order('created_at'));
        if (!maps.length) return [];
        const mem = unwrap(await sb.from('map_members').select('map_id,user_id,status').in('map_id', maps.map((m) => m.id)));
        const names = await namesOf(mem.map((x) => x.user_id).concat(maps.map((m) => m.owner)));
        return maps.map((m) => {
          const ms = mem.filter((x) => x.map_id === m.id);
          const mine = ms.find((x) => x.user_id === me.id);
          return {
            id: m.id, name: m.name, isOwner: m.owner === me.id, ownerName: names[m.owner] || '?', code: m.join_code,
            myStatus: mine ? mine.status : 'member',
            members: ms.map((x) => ({ id: x.user_id, username: names[x.user_id] || '?', status: x.status })),
          };
        });
      },
      async createMap(name) {
        return unwrap(await sb.from('maps').insert({ name: String(name).trim() }).select('id').single()).id;
      },
      async inviteToMap(mapId, userId) {
        const res = await sb.from('map_members').insert({ map_id: mapId, user_id: userId, status: 'invited' });
        if (res.error) {
          if (res.error.code === '23505') throw new Error('Cette personne est déjà invitée ou membre.');
          throw friendly(res.error);
        }
      },
      async respondInvite(mapId, accept) {
        const q = accept ? sb.from('map_members').update({ status: 'member' }) : sb.from('map_members').delete();
        unwrap(await q.eq('map_id', mapId).eq('user_id', me.id));
      },
      async requestJoin(code) {
        const res = await sb.rpc('request_join', { code: String(code || '').trim() });
        if (res.error) throw friendly(res.error);
        return res.data;
      },
      async respondRequest(mapId, userId, accept) {
        const q = accept ? sb.from('map_members').update({ status: 'member' }) : sb.from('map_members').delete();
        unwrap(await q.eq('map_id', mapId).eq('user_id', userId));
      },
      async removeMember(mapId, userId) { unwrap(await sb.from('map_members').delete().eq('map_id', mapId).eq('user_id', userId)); },
      async deleteMap(mapId) { unwrap(await sb.from('maps').delete().eq('id', mapId)); },
      async listMapSpots(mapId) {
        const rows = unwrap(await sb.from('map_spots').select('id,added_by,snapshot,created_at').eq('map_id', mapId).order('created_at'));
        const names = await namesOf(rows.map((r) => r.added_by));
        return rows.map((r) => ({ id: r.id, addedBy: names[r.added_by] || '?', mine: r.added_by === me.id, snapshot: r.snapshot || {} }));
      },
      async addSpotToMap(mapId, spot, hideDescription) {
        const snapshot = {
          name: spot.name, lat: spot.lat, lon: spot.lon, notes: hideDescription ? '' : spot.notes || '',
          linkUrl: spot.linkUrl || '', rules: spot.rules || {}, hiddenDescription: !!hideDescription,
        };
        unwrap(await sb.from('map_spots').insert({ map_id: mapId, snapshot }));
      },
      async removeMapSpot(id) { unwrap(await sb.from('map_spots').delete().eq('id', id)); },
    };
    return store;
  }

  H.createSupabaseStore = createSupabaseStore;
})();
