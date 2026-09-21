'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const PetAppearance = require('../src/appearance-preferences.js');

const source = fs.readFileSync(require.resolve('../src/app.js'), 'utf8');
class ClassList { constructor(){this.v=new Set(['hidden']);} add(x){this.v.add(x)} remove(x){this.v.delete(x)} contains(x){return this.v.has(x)} }
class El {
  constructor(){this.style={setProperty(){},removeProperty(){}};this.dataset={};this.classList=new ClassList();this.children=[];this.hidden=false;this.textContent='';this.title='';this.listeners={};this.src='';}
  addEventListener(k,f){(this.listeners[k] ||= []).push(f)}
  append(...x){this.children.push(...x)} appendChild(x){this.children.push(x)}
  setAttribute(k,v){this[k]=v} removeAttribute(k){delete this[k]}
  contains(x){return x===this || this.children.includes(x)} closest(){return null}
  get innerHTML(){return ''} set innerHTML(v){this.children=[]}
  focus(){} click(){if(this.onclick)this.onclick({stopPropagation(){},preventDefault(){}})}
}
function harness(storage, invokes = {}) {
  const ids = ['speech-bubble','status-text','state-gem','state-gem-tip','state-label','session-name','team-badge','team-badge-count','team-badge-tip','pet-container','art-stage','ferris-wrapper','ferris-img','ascii-art','char-menu','menu-backdrop'];
  const elements = Object.fromEntries(ids.map(id => [id, new El()]));
  const listeners = {};
  const win = { localStorage: storage, location:{href:'http://test/'}, addEventListener(){}, requestAnimationFrame: f => f(), __TAURI__: {
    event:{listen: async (name, fn) => { listeners[name]=fn; }},
    core:{invoke: async (name, args) => invokes[name] ? invokes[name](args) : (name === 'get_assets_dir' ? false : name === 'get_session_id' ? 'sess_1' : name === 'get_status' ? null : name === 'get_event' ? null : name === 'list_available_dlcs' ? [] : name === 'list_character_packs' ? [] : null)},
    app:{getVersion: async()=> 'test'},
  }};
  const document = {getElementById:id=>elements[id],createElement:()=>new El(),body:new El()};
  class FakeImage { set src(v){this._src=v; setTimeout(()=>this.onload&&this.onload(),0)} get src(){return this._src} }
  const timer = (f,n,...a) => { const t = setTimeout(f,n,...a); if (t && t.unref) t.unref(); return t; };
  const context = vm.createContext({window:win,document,localStorage:storage,PetAppearance,PetEvents:{},Image:FakeImage,fetch:async()=>({ok:true,json:async()=>({states:{idle:['ferris/1.svg'],editing:['ferris/19.svg'],searching:['ferris/20.svg']},transitions:{'idle->editing':{frames:['ferris/14.svg'],duration_ms:5},'editing->searching':{frames:['ferris/10.svg'],duration_ms:5}}})}),console,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval,Math,Date,Promise});
  vm.runInContext(source, context);
  return {elements, listeners, context};
}
function memory(initial){const m=new Map(Object.entries(initial||{}));return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}

test('real app.js applies the resolved scale before container and gem sizing', async () => {
  const stored = {version:1,global:{character:'ferris'},characterPrefs:{ferris:{petScale:1.7}},sessions:{},bindings:{stack:{},profile:{}}};
  const h = harness(memory({'piPetAppearance.v1':JSON.stringify(stored)}));
  await new Promise(r=>setTimeout(r,10));
  assert.equal(h.elements['pet-container'].style.width, '340px');
  assert.equal(h.elements['state-gem'].style.width, '17px');
});

test('real app.js status listener rejects stale transition completion after a rapid state change', async () => {
  const h = harness(memory());
  await new Promise(r=>setTimeout(r,10));
  h.listeners['status-update']({payload:{state:'editing',session_id:'sess_1'}});
  h.listeners['status-update']({payload:{state:'searching',session_id:'sess_1'}});
  await new Promise(r=>setTimeout(r,15));
  assert.notEqual(h.elements['ferris-img'].src, 'ferris/14.svg');
});

test('real app.js follow/unbind menu actions immediately re-render the effective binding', async () => {
  const stored = {version:1,global:{character:'ferris'},characterPrefs:{},sessions:{sess_1:{character:null,manual:false,overrides:{}}},bindings:{stack:{},profile:{'global:work':'cat'}}};
  const h = harness(memory({'piPetAppearance.v1':JSON.stringify(stored)}));
  await new Promise(r=>setTimeout(r,10));
  h.listeners['status-update']({payload:{state:'idle',session_id:'sess_1',appearance_context:{schemaVersion:'1',source:'pi-forge',instanceId:'forge_1',revision:1,stackKey:null,profileKey:'global:work',projectKey:null}}});
  await new Promise(r=>setTimeout(r,5));
  h.elements['pet-container'].listeners.contextmenu[0]({preventDefault(){},stopPropagation(){}});
  h.elements['char-menu'].children.find(e => e.textContent === 'Settings...').click();
  const unbind = h.elements['char-menu'].children.find(e => e.textContent === 'Unbind current Profile');
  assert.ok(unbind, h.elements['char-menu'].children.map(e => e.textContent).join('|'));
  unbind.click();
  assert.equal(h.elements['ferris-img'].src, 'ferris/1.svg');
});

test('real app.js restores a session preference without appearance_context and falls back from malformed packs', async () => {
  const stored = {version:1,global:{character:'ferris'},characterPrefs:{},sessions:{sess_1:{character:'cat',manual:true,overrides:{}}},bindings:{stack:{},profile:{}}};
  const h = harness(memory({'piPetAppearance.v1':JSON.stringify(stored)}), {
    get_assets_dir: () => true,
    list_available_dlcs: () => [],
    update_assets: () => true,
    list_character_packs: () => [{id:'custom_bad',name:'Broken',group:'custom',installed:true}],
    load_text_asset: () => '{not json',
  });
  await new Promise(r=>setTimeout(r,15));
  assert.equal(h.elements['ascii-art'].style.display, 'block', 'NO context startup kept the session character');
  // Change the persisted request to a broken pack: app.js must retain the
  // request but render validated Ferris rather than empty ASCII art.
  h.context.PetAppearance.create(h.context.window.localStorage).setSessionCharacter('sess_1','custom_bad');
  h.listeners['status-update']({payload:{state:'idle',session_id:'sess_1',appearance_context:{schemaVersion:'1',source:'pi-forge',instanceId:'forge_1',revision:1,stackKey:null,profileKey:null,projectKey:null}}});
  await new Promise(r=>setTimeout(r,5));
  assert.equal(h.elements['ferris-img'].src, 'ferris/1.svg');
});

test('unchanged effective character does not cancel a reaction on a new Forge revision', async () => {
  const h = harness(memory());
  await new Promise(r=>setTimeout(r,10));
  const ctx = {schemaVersion:'1',source:'pi-forge',instanceId:'live_forge',revision:1,stackKey:'global:work',profileKey:null,projectKey:null};
  h.listeners['status-update']({payload:{state:'idle',session_id:'sess_1',appearance_context:ctx}});
  vm.runInContext("activeOneShot = {type:'reaction',timerIds:[],targetState:'happy'}; visualState='happy'", h.context);
  const generation = vm.runInContext('renderGeneration', h.context);
  h.listeners['status-update']({payload:{state:'idle',session_id:'sess_1',appearance_context:{...ctx, revision:2}}});
  assert.equal(vm.runInContext('activeOneShot?.type',h.context),'reaction');
  assert.equal(vm.runInContext('renderGeneration',h.context),generation);
});

test('rebind queries current status and returning to A accepts its still-live publisher', async () => {
  let sid='sess_1';
  const forge = {schemaVersion:'1',source:'pi-forge',instanceId:'live_a',revision:1,stackKey:'global:work',profileKey:null,projectKey:null};
  const status = () => ({state:sid==='sess_1'?'thinking':'reading',session_id:sid,appearance_context:sid==='sess_1'?forge:null});
  const h = harness(memory(), {get_session_id:()=>sid,get_status:status,bind_session:args=>{sid=args.sessionId;return true;}});
  await new Promise(r=>setTimeout(r,10));
  await vm.runInContext("bindToSession('sess_2')", h.context);
  assert.equal(vm.runInContext('currentBusinessState',h.context),'reading');
  await vm.runInContext("bindToSession('sess_1')", h.context);
  assert.equal(vm.runInContext('currentBusinessState',h.context),'thinking');
  assert.equal(vm.runInContext('appearanceContext?.instanceId',h.context),'live_a');
});

test('slow external character image cannot commit after a different character is selected', async () => {
  let release;
  const h = harness(memory(), {load_asset: ({path}) => path === 'slow/idle.webp' ? new Promise(r=>{release=r;}) : 'data:image/webp;base64,FAST'});
  await new Promise(r=>setTimeout(r,10));
  vm.runInContext("hasExternalAssets=true; registerCharacterConfig('slow',{states:{idle:['slow/idle.webp']}});",h.context);
  await vm.runInContext("selectChar('slow')",h.context);
  await vm.runInContext("selectChar('cat')",h.context);
  release('data:image/webp;base64,SLOW');
  await new Promise(r=>setTimeout(r,5));
  assert.notEqual(h.elements['ferris-img'].src,'data:image/webp;base64,SLOW');
  assert.equal(vm.runInContext('mode',h.context),'cat');
});

test('empty-state custom config is unavailable and Reset clears the scoped window scale', async () => {
  const h = harness(memory());
  await new Promise(r=>setTimeout(r,10));
  assert.equal(vm.runInContext("registerCharacterConfig('broken',{states:{}})",h.context),false);
  await vm.runInContext("selectChar('broken')",h.context);
  assert.equal(vm.runInContext('mode',h.context),'ferris');
  vm.runInContext("setAppearance('petScale',2); clearAppearanceOverrides(); applyConfig();",h.context);
  assert.equal(h.elements['pet-container'].style.width,'200px');
});
