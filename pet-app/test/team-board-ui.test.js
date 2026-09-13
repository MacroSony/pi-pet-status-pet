'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderTeamBoard } = require('../src/board.js');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.className = '';
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.children = [];
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  set innerHTML(_value) { throw new Error('innerHTML must never be used'); }
}

function makeDocument() {
  const ids = [
    'team-name', 'caller-role', 'member-count', 'member-list',
    'board-revision', 'board-attribution', 'board-markdown',
    'board-unavailable', 'team-unavailable',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const shell = new FakeElement('shell');
  return {
    elements,
    shell,
    getElementById(id) { return elements[id] || null; },
    querySelector(selector) { return selector === '.board-shell' ? shell : null; },
    createElement() { return new FakeElement(); },
  };
}

test('renders Team members and Markdown strictly as text', () => {
  const doc = makeDocument();
  const payload = {
    name: '<b>Release Crew</b>',
    role: 'leader',
    members: [
      { displayName: '<img src=x onerror=alert(1)>', role: 'leader', state: 'editing', host: 'local' },
      { displayName: 'Reviewer · Pi', role: 'member', state: 'idle', host: 'homelab' },
    ],
    board: {
      status: 'ready',
      revision: 4,
      markdown: '# Plan\n<script>window.pwned=true</script>',
      updatedBy: 'Reviewer · Pi',
    },
  };

  assert.equal(renderTeamBoard(payload, doc), true);
  assert.equal(doc.elements['team-name'].textContent, '<b>Release Crew</b>');
  assert.equal(doc.elements['member-list'].children.length, 2);
  assert.equal(doc.elements['member-list'].children[0].children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(doc.elements['board-markdown'].textContent, '# Plan\n<script>window.pwned=true</script>');
  assert.equal(doc.elements['board-revision'].textContent, 'rev 4');
  assert.equal(doc.elements['board-attribution'].textContent, 'Last updated by Reviewer · Pi');
  assert.equal(doc.elements['board-unavailable'].hidden, true);
});

test('fails closed to unavailable UI for missing or malformed Team data', () => {
  const doc = makeDocument();
  assert.equal(renderTeamBoard(null, doc), false);
  assert.equal(doc.shell.dataset.teamActive, 'false');
  assert.equal(doc.elements['team-unavailable'].hidden, false);
  assert.equal(doc.elements['member-list'].children.length, 0);

  assert.equal(renderTeamBoard({ name: 'Bad', role: 'root', members: [] }, doc), false);
});

test('pet badge is wired as a non-poke, presentation-only Board entry point', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const board = fs.readFileSync(path.join(__dirname, '../src/board.js'), 'utf8');
  assert.match(html, /id="team-badge"/);
  assert.match(app, /core\.invoke\('open_team_board'\)/);
  assert.match(app, /#team-badge/);
  assert.match(board, /pre\.textContent = boardReady/);
  assert.match(board, /team-presentation-update/);
  assert.doesNotMatch(board, /status-update/);
  assert.doesNotMatch(board, /\.innerHTML\s*=/);
  for (const forbidden of ['teamId', 'petId', 'rawSessionId', 'capabilityToken', 'psh_']) {
    assert.doesNotMatch(board, new RegExp(forbidden));
  }
});
