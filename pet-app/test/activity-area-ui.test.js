'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function boot(saveResult = () => Promise.resolve()) {
  const ids = ['message', 'apply', 'disable', 'cancel', 'move-handle'];
  const element = () => ({ events: {}, textContent: '', disabled: false,
    addEventListener(name, cb) { this.events[name] = cb; },
    set innerHTML(_) { throw new Error('HTML is forbidden'); },
  });
  const els = Object.fromEntries(ids.map((id) => [id, element()]));
  const corner = { ...element(), dataset: { resize: 'SouthEast' } };
  const doc = { ...element(), getElementById: (id) => els[id], querySelectorAll: (s) => s === 'button' ? [els.apply, els.disable, els.cancel] : [corner] };
  const calls = [];
  const win = {
    close() { calls.push(['close']); return Promise.resolve(); },
    startDragging() { calls.push(['drag']); return Promise.resolve(); },
    startResizeDragging(dir) { calls.push(['resize', dir]); return Promise.resolve(); },
  };
  vm.runInNewContext(read('src/activity-area.js'), { window: { __TAURI__: {
    core: { invoke(name, args) {
      calls.push([name, args]);
      return name === 'activity_area_editor_info' ? Promise.resolve('Shared desktop area') : saveResult();
    } }, window: { getCurrentWindow: () => win },
  } }, document: doc });
  return { els, calls, doc, corner };
}
const tick = () => new Promise((r) => setImmediate(r));
test('editor applies/disables through native boolean-only command, cancel never saves', async () => {
  const h = boot(); await tick();
  assert.equal(h.els.message.textContent, 'Shared desktop area');
  h.els.cancel.events.click();
  assert.equal(h.calls.filter(([name]) => name === 'save_activity_area').length, 0);
  h.els.apply.events.click(); await tick();
  h.els.disable.events.click(); await tick();
  const args = h.calls.filter(([name]) => name === 'save_activity_area').map(([, data]) => JSON.parse(JSON.stringify(data)));
  assert.deepEqual(args, [{ disabled: false }, { disabled: true }]);
});
test('save is single flight, blocks gestures/cancel, shows errors as text and re-enables controls', async () => {
  let reject;
  const h = boot(() => new Promise((_, r) => { reject = r; })); await tick();
  h.els.apply.events.click(); h.els.disable.events.click(); h.els.cancel.events.click();
  h.els['move-handle'].events.pointerdown({ button: 0, preventDefault() {} });
  assert.equal(h.calls.filter(([name]) => name === 'save_activity_area').length, 1);
  assert.equal(h.calls.some(([name]) => name === 'close' || name === 'drag'), false);
  assert.equal(h.els.apply.disabled, true);
  reject('<img src=x> conflict'); await tick();
  assert.equal(h.els.message.textContent, '<img src=x> conflict');
  assert.equal(h.els.apply.disabled, false);
  h.corner.events.pointerdown({ button: 0, preventDefault() {} });
  assert.deepEqual(h.calls.at(-1), ['resize', 'SouthEast']);
});
test('native editor is asynchronous and secondary-window isolated with minimal capabilities', () => {
  const native = read('src-tauri/src/activity_area.rs');
  const lib = read('src-tauri/src/lib.rs');
  const capability = JSON.parse(read('src-tauri/capabilities/activity-area.json'));
  assert.match(native, /async fn open_activity_area/);
  assert.match(native, /require_window\(&window, "main"\)/);
  assert.match(native, /require_window\(&window, EDITOR\)/);
  assert.match(native, /window\.outer_position\(\)/);
  assert.match(native, /window\.outer_size\(\)/);
  assert.match(native, /\.work_area\(\)/);
  assert.match(lib, /window_label == "main"/);
  assert.match(lib, /manage\(activity_area::EditorState::default\(\)\)/);
  assert.match(read('src/app.js'), /invoke\('open_activity_area'\)/);
  assert.deepEqual(capability.windows, ['activity-area']);
  assert.ok(!capability.permissions.includes('core:window:allow-set-position'));
  assert.doesNotMatch(read('src/activity-area.js'), /innerHTML|localStorage|fetch\(/);
});
