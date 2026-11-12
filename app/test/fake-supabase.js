/* Faux client Supabase en mémoire (pour tester le code client).
   Il imite les règles de visibilité du schéma SQL (RLS) mais ne remplace pas un vrai test sur Supabase. */
(function () {
  const KEY = '__fake_db';
  const fresh = () => ({ users: [], tables: { profiles: [], spots: [], friendships: [], shares: [], maps: [], map_members: [], map_spots: [] }, session: null });
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { db = fresh(); }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  window.__fake = { get db() { return db; }, confirmRequired: false, reset() { db = fresh(); save(); } };

  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const me = () => (db.session ? db.session.user.id : null);
  const T = (n) => db.tables[n];
  const isMember = (m) => T('map_members').some((x) => x.map_id === m && x.user_id === me() && x.status === 'member');
  const isOwner = (m) => T('maps').some((x) => x.id === m && x.owner === me());

  const visible = {
    profiles: () => true,
    spots: (r) => r.owner === me(),
    friendships: (r) => r.requester === me() || r.addressee === me(),
    shares: (r) => r.from_user === me() || r.to_user === me(),
    maps: (r) => r.owner === me() || T('map_members').some((x) => x.map_id === r.id && x.user_id === me()),
    map_members: (r) => r.user_id === me() || isMember(r.map_id) || isOwner(r.map_id),
    map_spots: (r) => isMember(r.map_id),
  };

  const fill = (t, r) => {
    const base = { profiles: { created_at: now() },
      spots: { id: uuid(), owner: me(), notes: '', photos: [], link_url: '', rules: {}, created_at: now(), updated_at: now() },
      friendships: { id: uuid(), requester: me(), status: 'pending', created_at: now() },
      shares: { id: uuid(), from_user: me(), seen: false, created_at: now() },
      maps: { id: uuid(), owner: me(), join_code: Math.random().toString(16).slice(2, 10).toUpperCase(), created_at: now() },
      map_members: { created_at: now() },
      map_spots: { id: uuid(), added_by: me(), created_at: now() } }[t];
    return Object.assign({}, base, r);
  };

  const conflict = (t, r, ignoreId) => {
    if (t === 'profiles' && T(t).some((x) => x.username === r.username)) return true;
    if (t === 'friendships' && T(t).some((x) => (x.requester === r.requester && x.addressee === r.addressee) || (x.requester === r.addressee && x.addressee === r.requester))) return true;
    if (t === 'map_members' && T(t).some((x) => x.map_id === r.map_id && x.user_id === r.user_id)) return true;
    return false;
  };

  const project = (t, r, cols) => {
    const full = Object.assign({}, r);
    if (t === 'spots') full.photo_count = (r.photos || []).length;
    if (!cols || cols === '*') return JSON.parse(JSON.stringify(full));
    const o = {};
    cols.split(',').map((c) => c.trim()).forEach((c) => { o[c] = JSON.parse(JSON.stringify(full[c] === undefined ? null : full[c])); });
    return o;
  };

  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.f = []; this.ord = null; this.lim = null; this.cols = '*'; this.one = null; this.payload = null; this.opts = {}; this.ret = false; }
    select(c) { this.cols = c || '*'; if (this.op !== 'select') this.ret = true; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    upsert(p, o) { this.op = 'upsert'; this.payload = p; this.opts = o || {}; return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    in(c, vs) { this.f.push((r) => vs.indexOf(r[c]) !== -1); return this; }
    order(c, o) { this.ord = [c, o && o.ascending === false ? -1 : 1]; return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.one = 'one'; return this; }
    maybeSingle() { this.one = 'maybe'; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
    out(rows) {
      const data = rows.map((r) => project(this.t, r, this.cols));
      if (this.one === 'one') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
      if (this.one === 'maybe') return { data: data[0] || null, error: null };
      return { data, error: null };
    }
    exec() {
      const t = this.t, vis = visible[t];
      const match = () => T(t).filter((r) => vis(r) && this.f.every((fn) => fn(r)));
      if (!me() && t !== 'profiles') return { data: null, error: { message: 'JWT expired' } };
      if (this.op === 'select') {
        let rows = match();
        if (this.ord) rows = rows.slice().sort((a, b) => (a[this.ord[0]] > b[this.ord[0]] ? 1 : a[this.ord[0]] < b[this.ord[0]] ? -1 : 0) * this.ord[1]);
        if (this.lim) rows = rows.slice(0, this.lim);
        return this.out(rows);
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const made = [];
        for (const raw of list) {
          const row = fill(t, raw);
          const existing = this.op === 'upsert' && row.id ? T(t).find((x) => x.id === row.id) : null;
          if (existing) {
            if (!vis(existing)) return { data: null, error: { message: 'new row violates row-level security policy' } };
            if (this.opts.ignoreDuplicates) continue;
            Object.assign(existing, raw); made.push(existing); continue;
          }
          if (conflict(t, row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          if (t === 'profiles' && !/^[a-z0-9_]{3,20}$/.test(row.username)) return { data: null, error: { code: '23514', message: 'check constraint' } };
          T(t).push(row); made.push(row);
          if (t === 'maps') T('map_members').push({ map_id: row.id, user_id: row.owner, status: 'member', created_at: now() });
        }
        save();
        return this.ret ? this.out(made) : { data: null, error: null };
      }
      if (this.op === 'update') {
        const rows = match();
        rows.forEach((r) => Object.assign(r, this.payload));
        save();
        return this.ret ? this.out(rows) : { data: null, error: null };
      }
      if (this.op === 'delete') {
        const rows = match();
        db.tables[t] = T(t).filter((r) => rows.indexOf(r) === -1);
        if (t === 'maps') rows.forEach((m) => { db.tables.map_members = T('map_members').filter((x) => x.map_id !== m.id); db.tables.map_spots = T('map_spots').filter((x) => x.map_id !== m.id); });
        save();
        return { data: null, error: null };
      }
    }
  }

  const client = {
    from: (t) => new Q(t),
    rpc: async (name, args) => {
      if (name !== 'request_join') return { data: null, error: { message: 'unknown function' } };
      const m = T('maps').find((x) => x.join_code === String(args.code).trim().toUpperCase());
      if (!m) return { data: null, error: { message: 'Code inconnu' } };
      if (!T('map_members').some((x) => x.map_id === m.id && x.user_id === me())) T('map_members').push({ map_id: m.id, user_id: me(), status: 'requested', created_at: now() });
      save();
      return { data: m.id, error: null };
    },
    auth: {
      async getSession() { return { data: { session: db.session } }; },
      async getUser() { return db.session ? { data: { user: db.session.user }, error: null } : { data: { user: null }, error: { message: 'no session' } }; },
      async signUp({ email, password }) {
        if (db.users.find((u) => u.email === email)) return { data: { user: null, session: null }, error: { message: 'User already registered' } };
        const u = { id: uuid(), email, password };
        db.users.push(u);
        if (window.__fake.confirmRequired) { save(); return { data: { user: { id: u.id, email }, session: null }, error: null }; }
        db.session = { user: { id: u.id, email } };
        save();
        return { data: { user: db.session.user, session: db.session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = db.users.find((x) => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
        db.session = { user: { id: u.id, email } };
        save();
        return { data: { session: db.session, user: db.session.user }, error: null };
      },
      async signOut() { db.session = null; save(); return { error: null }; },
    },
  };
  window.supabase = { createClient: () => client };
})();
