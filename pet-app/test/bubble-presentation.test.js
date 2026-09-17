'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('all bubble writes retain full plain text in the hover title, including after replacement', () => {
  const start = app.indexOf('function setBubbleText(');
  const end = app.indexOf('\nfunction updateTeamBadge', start);
  assert.ok(start >= 0 && end > start);
  const statusText = { textContent: '', title: '', set innerHTML(_) { throw new Error('unsafe HTML'); } };
  const ctx = vm.createContext({ statusText });
  vm.runInContext(app.slice(start, end), ctx);
  for (const text of ['中文很长的提示。'.repeat(120), '<b>plain text, not HTML</b>', 'Next message', '']) {
    ctx.input = text;
    vm.runInContext('setBubbleText(input)', ctx);
    assert.equal(statusText.textContent, text);
    assert.equal(statusText.title, text);
  }
  assert.equal((app.match(/statusText\.textContent\s*=/g) || []).length, 1, 'no bypass of the shared text setter');
});

test('bubble preview uses complete bounded lines without flex-shrinking its border', () => {
  const bubble = css.match(/#speech-bubble\s*\{([^}]+)\}/)[1];
  const text = css.match(/#status-text\s*\{([^}]+)\}/)[1];
  assert.match(bubble, /flex:\s*0 0 auto/);
  assert.match(text, /-webkit-line-clamp:\s*2/);
  assert.match(text, /overflow:\s*hidden/);
  assert.match(text, /overflow-wrap:\s*break-word/);
});
