const test = require('node:test');
const assert = require('node:assert/strict');
const { create, cleanContext } = require('../src/appearance-preferences.js');
function store(initial = {}) { const m = new Map(Object.entries(initial)); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) }; }
const ctx = {schemaVersion:'1', source:'pi-forge', instanceId:'forge_1', revision:1, stackKey:'global:work', profileKey:'project:default', projectKey:'a'.repeat(64)};

test('one-time legacy migration is global and character scoped', () => {
  const s = store({'petMode':'cat','petAppearance.artScale':'1.4'}); const p = create(s);
  assert.equal(p.resolve('', null).character, 'cat');
  assert.equal(p.resolve('', null).appearance.artScale, 1.4);
  p.setSessionCharacter('one','ghost');
  assert.equal(p.resolve('two', null).character, 'cat');
  assert.equal(s.getItem('petMode'), 'cat');
});

test('priority is session, profile, stack, global, fallback', () => {
  const p = create(store()); p.setGlobal('cat'); p.bind('stack','global:work','ghost'); p.bind('profile','project:default','robot','a'.repeat(64));
  assert.equal(p.resolve('s',ctx).character,'robot');
  p.setSessionCharacter('s','duck'); assert.equal(p.resolve('s',ctx).character,'duck');
  p.clearSession('s'); assert.equal(p.resolve('s',ctx).character,'robot');
  assert.equal(p.resolve('other',{...ctx,profileKey:null}).character,'ghost');
});

test('project bindings require matching opaque project key and invalid IDs fail closed', () => {
  const p = create(store()); assert.equal(p.bind('profile','project:x','cat'), false); assert.equal(p.bind('profile','project:x','cat','b'.repeat(64)), true);
  assert.equal(p.resolve('s',{...ctx,profileKey:'project:x',projectKey:'c'.repeat(64)}).character,'ferris');
  assert.equal(cleanContext({...ctx, stackKey:'../../etc'}), null);
});

test('missing mapped pack does not erase mapping', () => {
  const s = store(); const p = create(s); p.setGlobal('custom_pack');
  assert.equal(p.resolve('s',null).character,'custom_pack');
  // Renderer may display Ferris when the pack is unavailable; persisted choice remains.
  assert.equal(JSON.parse(s.getItem(p.storageKey)).global.character,'custom_pack');
});

test('each appearance property independently falls through to character and pack defaults', () => {
  const s=store(); const p=create(s);
  p.setAppearance('', 'ferris','artScale',1.4);
  p.setAppearance('s','ferris','petScale',1.7);
  const result=p.resolve('s',null,{motion:'intrinsic'});
  assert.equal(result.appearance.artScale,1.4);
  assert.equal(result.appearance.petScale,1.7);
  assert.equal(result.appearance.motion,'intrinsic');
});
