// Session-scoped character/appearance resolver. No filesystem, network, or provider access.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PetAppearance = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const KEY = 'piPetAppearance.v1';
  const LEGACY = 'piPetAppearance.migrated.v1';
  const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const SAFE_SCOPE = /^(global|project):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const DEFAULT = Object.freeze({ motion:'full', uiPreset:'classic', artScale:1, bubble:'all', stateLabel:'always', identity:'always', petScale:1 });
  const ENUMS = { motion:['intrinsic','subtle','full'], uiPreset:['minimal','classic','debug'], bubble:['off','alerts','all'], stateLabel:['off','minimal','alerts','always'], identity:['hidden','hover','always'] };
  const clamp = (n, lo, hi, d) => Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Number(n))) : d;
  function safeId(id) { return typeof id === 'string' && SAFE_ID.test(id) && !id.includes('..'); }
  function safeScope(id) { return typeof id === 'string' && SAFE_SCOPE.test(id); }
  function projectScope(key, projectKey) {
    if (!safeScope(key)) return null;
    if (key.startsWith('project:')) return typeof projectKey === 'string' && /^[0-9a-f]{64}$/.test(projectKey) ? `${key}@${projectKey}` : null;
    return key;
  }
  function cleanContext(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (String(raw.schemaVersion || raw.schema_version) !== '1' || raw.source !== 'pi-forge') return null;
    const clean = { schemaVersion:'1', source:'pi-forge', instanceId:null, revision:null, stackKey:null, profileKey:null, projectKey:null };
    if (typeof raw.instanceId !== 'string' || !safeId(raw.instanceId)) return null;
    clean.instanceId = raw.instanceId;
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 0) return null;
    clean.revision = raw.revision;
    for (const k of ['stackKey','profileKey']) {
      if (raw[k] !== null && !safeScope(raw[k])) return null;
      clean[k] = raw[k];
    }
    if (raw.projectKey !== null && !(typeof raw.projectKey === 'string' && /^[0-9a-f]{64}$/.test(raw.projectKey))) return null;
    clean.projectKey = raw.projectKey;
    return clean;
  }
  function blank() { return { version:1, global:{ character:'ferris' }, characterPrefs:Object.create(null), sessions:Object.create(null), bindings:{stack:Object.create(null),profile:Object.create(null)} }; }
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const dict = (o) => o && typeof o === 'object' && !Array.isArray(o) ? o : Object.create(null);
  function safeGet(store, key) { try { return store && typeof store.getItem === 'function' ? store.getItem(key) : null; } catch (_) { return null; } }
  function safeSet(store, key, value) { try { if (store && typeof store.setItem === 'function') store.setItem(key, value); } catch (_) {} }
  function read(store) {
    let data = null;
    try { data = JSON.parse(safeGet(store, KEY) || 'null'); } catch (_) {}
    if (!data || data.version !== 1 || typeof data !== 'object' || Array.isArray(data)) data = blank();
    data.global = dict(data.global);
    if (!own(data.global, 'character') || !safeId(data.global.character)) data.global.character = 'ferris';
    data.characterPrefs = dict(data.characterPrefs);
    data.sessions = dict(data.sessions);
    data.bindings = dict(data.bindings);
    data.bindings.stack = dict(data.bindings.stack); data.bindings.profile = dict(data.bindings.profile);
    return data;
  }
  function normalizeAppearance(raw, fallback = DEFAULT) {
    const out = {};
    for (const [k, d] of Object.entries(DEFAULT)) {
      const v = raw && raw[k];
      if (k === 'artScale') out[k] = clamp(v, .7, 1.5, fallback[k] ?? d);
      else if (k === 'petScale') out[k] = clamp(v, 1, 2, fallback[k] ?? d);
      else out[k] = ENUMS[k] && ENUMS[k].includes(v) ? v : (fallback[k] ?? d);
    }
    return out;
  }
  function migrate(store) {
    if (safeGet(store, LEGACY) === '1') return;
    const data = read(store);
    const oldChar = safeGet(store, 'petMode');
    if (safeId(oldChar)) data.global.character = oldChar;
    const legacy = {};
    for (const k of Object.keys(DEFAULT)) {
      const v = safeGet(store, `petAppearance.${k}`);
      if (v !== null) legacy[k] = (k === 'artScale' || k === 'petScale') ? Number(v) : v;
    }
    // Older releases stored the window scale separately; migrate it only to
    // the legacy character, never as an override for every future session.
    if (legacy.petScale === undefined && safeGet(store, 'petScale') !== null) legacy.petScale = Number(safeGet(store, 'petScale'));
    if (Object.keys(legacy).length) data.characterPrefs[data.global.character || 'ferris'] = normalizeAppearance(legacy, DEFAULT);
    // Keep legacy keys readable for rollback, but mark migration and never write them again.
    safeSet(store, KEY, JSON.stringify(data)); safeSet(store, LEGACY, '1');
    return data;
  }
  function save(store, data) { safeSet(store, KEY, JSON.stringify(data)); }
  function create(store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    // Storage is optional and may be broken (private mode, policy, or a test
    // double).  Keep a memory store so renderer startup cannot abort.
    if (!store) { let memory = null; store = { getItem: () => memory, setItem: (_, v) => { memory = String(v); } }; }
    try { migrate(store); } catch (_) {}
    function data() { try { return read(store); } catch (_) { return blank(); } }
    function sessionRecord(d, sid) { if (!own(d.sessions, sid) || !d.sessions[sid] || typeof d.sessions[sid] !== 'object' || Array.isArray(d.sessions[sid])) d.sessions[sid] = { character:null, overrides:Object.create(null), manual:false }; const r=d.sessions[sid]; r.overrides=dict(r.overrides); return r; }
    function appearanceFor(d, rec, character, suggestions) {
      const sessionPref = rec && dict(rec.overrides)[character];
      const charPref = own(d.characterPrefs, character) ? d.characterPrefs[character] : null;
      const out = {};
      for (const key of Object.keys(DEFAULT)) {
        // Fall through independently: a session artScale must not hide a
        // character motion setting (or vice versa).
        const values = [sessionPref, charPref, suggestions];
        let value;
        for (const candidate of values) {
          if (!candidate || !own(candidate, key) || candidate[key] === undefined) continue;
          const v = candidate[key];
          const valid = key === 'artScale' ? Number.isFinite(Number(v)) : key === 'petScale' ? Number.isFinite(Number(v)) : (ENUMS[key] ? ENUMS[key].includes(v) : true);
          if (valid) { value = v; break; }
        }
        out[key] = normalizeAppearance({[key]: value}, DEFAULT)[key];
      }
      return out;
    }
    function resolveCharacter(sid, context, character, suggestions) {
      const d = data(); const c = cleanContext(context); const rec = safeId(sid) && own(d.sessions, sid) ? d.sessions[sid] : null;
      return { character, appearance: appearanceFor(d, rec, character, suggestions || {}), source:'fallback', fallback:true, context:c, scope:{stack:c && projectScope(c.stackKey,c.projectKey), profile:c && projectScope(c.profileKey,c.projectKey)} };
    }
    function resolve(sid, context, suggestions) {
      const d = data(); const c = cleanContext(context); const rec = safeId(sid) && own(d.sessions, sid) ? d.sessions[sid] : null;
      const stack = c && projectScope(c.stackKey, c.projectKey); const profile = c && projectScope(c.profileKey, c.projectKey);
      let character = rec && typeof rec === 'object' && !Array.isArray(rec) && own(rec, 'manual') && rec.manual && own(rec, 'character') && safeId(rec.character) ? rec.character : null, source = character ? 'session' : null;
      if (!character && profile && own(d.bindings.profile, profile) && safeId(d.bindings.profile[profile])) { character=d.bindings.profile[profile]; source='profile'; }
      if (!character && stack && own(d.bindings.stack, stack) && safeId(d.bindings.stack[stack])) { character=d.bindings.stack[stack]; source='stack'; }
      if (!character && safeId(d.global.character)) { character=d.global.character; source='global'; }
      character = character || 'ferris'; source = source || 'fallback';
      return { character, appearance:appearanceFor(d, rec, character, suggestions), source, fallback:source === 'fallback', context:c, scope:{stack,profile} };
    }
    function setSessionCharacter(sid, character) { if (!safeId(sid) || !safeId(character)) return false; const d=data(), r=sessionRecord(d,sid); r.character=character; r.manual=true; save(store,d); return true; }
    function clearSession(sid) { if (!safeId(sid)) return false; const d=data(); if (own(d.sessions,sid)) { d.sessions[sid].character=null; d.sessions[sid].manual=false; save(store,d); } return true; }
    function setAppearance(sid, character, key, value) { if (!safeId(character) || !Object.prototype.hasOwnProperty.call(DEFAULT,key)) return false; const d=data(); const target = safeId(sid) ? sessionRecord(d,sid).overrides : d.characterPrefs; if (!target[character] || typeof target[character] !== 'object') target[character] = {}; if (value === undefined) delete target[character][key]; else target[character][key]=value; save(store,d); return true; }
    function setGlobal(character) { if (!safeId(character)) return false; const d=data(); d.global.character=character; save(store,d); return true; }
    function bind(kind, scope, character, projectKey) { const key=projectScope(scope,projectKey); if (!['stack','profile'].includes(kind)||!key||!safeId(character)) return false; const d=data(); d.bindings[kind][key]=character; save(store,d); return true; }
    function unbind(kind, scope, projectKey) { const key=projectScope(scope,projectKey); if (!['stack','profile'].includes(kind)||!key) return false; const d=data(); delete d.bindings[kind][key]; save(store,d); return true; }
    return { resolve, resolveCharacter, setSessionCharacter, clearSession, setAppearance, setGlobal, bind, unbind, cleanContext, safeId, safeScope, defaults:DEFAULT, storageKey:KEY };
  }
  return { create, cleanContext, safeId, safeScope, defaults:DEFAULT };
});
