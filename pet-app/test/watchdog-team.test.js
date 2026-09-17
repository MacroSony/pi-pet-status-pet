'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const relevantApp = app.slice(
  app.indexOf('// ── Session Watchdog ──'),
  app.indexOf('function buildMessagePage()'),
);

function boot({ browserDemo = false } = {}) {
  const prefix = `
    let mode = 'ferris';
    let activeCharacterConfig = null;
    const CHARACTER_CONFIGS = {};
    const ALERT_STATES = new Set(['error', 'waiting']);
    const QUIESCENT_STATES = new Set(['idle', 'offline']);
    let watchdogConfig = { enabled: true, sleep_after_seconds: 1, exit_after_seconds: 0, force_exit_after_seconds: 0 };
    function getWatchdogConfig() { return watchdogConfig; }
    let now = 1000;
    const Date = { now: () => now };
    let currentBusinessState = 'idle';
    let currentBusinessDetail = '';
    let currentState = 'idle';
    let visualState = 'idle';
    let latestStatus = null;
    let lastStatusEventAt = now;
    let watchdogTimer = null;
    const WATCHDOG_INTERVAL_MS = 30000;
    let statusUpdateVersion = 0;
    let reactionRequestVersion = 0;
    let activeOneShot = null;
    let dragSession = null;
    let activeExpressionBubble = null;
    let bubbleTimeout = null;
    let idleVariationTimer = null;
    let boundSessionId = '';
    let initialized = true;
    let menuPage = 'main';
    let availableDlcs = [];
    let customPacks = [];
    let appVersion = 'test';
    const ASCII_SPECIES = {};
    function element() {
      return {
        hidden: false, textContent: '', title: '', dataset: {}, style: {}, children: [],
        classList: { add() {}, remove() {}, contains() { return false; } },
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
        setAttribute(name, value) { this[name] = value; },
        removeAttribute(name) { delete this[name]; },
        set innerHTML(_) { this.children = []; },
      };
    }
    const teamBadge = element(); teamBadge.hidden = true;
    const teamBadgeCount = element();
    const teamBadgeTip = element();
    const statusText = element();
    const stateLabel = element();
    const stateGem = element();
    const sessionNameEl = element();
    const container = element();
    const bubble = element();
    const charMenu = element();
    const document = { createElement: () => element() };
    function compactSessionName(value) { return value; }
    function cancelPetDrag() {}
    function cancelActiveOneShot() {}
    function updateStateGemTipText() {}
    function shouldShowStateLabel() { return true; }
    function shouldShowStateGem() { return true; }
    function shouldShowBubble() { return true; }
    function scheduleAutoReturn() {}
    function getTransitionConfig() { return null; }
    function playTransition() {}
    function startStateLoop(state) { visualState = state; }
    const timerCallbacks = [];
    function setTimeout(callback) { timerCallbacks.push(callback); return timerCallbacks.length; }
    function clearTimeout() {}
    function setInterval() { return 1; }
    function addMenuItem(parent, text) { const item = document.createElement('div'); item.textContent = text; parent.appendChild(item); }
    function addDivider(parent) { parent.appendChild(document.createElement('div')); }
    function closeMenu() {}
    function selectChar() {}
    function syncGatheringInteraction() { return Promise.resolve(); }
  `;
  const suffix = `
    globalThis.__watchdogTeam = {
      updateStatus, checkWatchdog, buildMenu, showTransientBubble,
      finishLastTimer: () => timerCallbacks.at(-1)(),
      setWatchdog: (config) => { watchdogConfig = config; },
      advance: (ms) => { now += ms; },
      latest: () => latestStatus,
      latestIs: (status) => latestStatus === status,
      state: () => currentBusinessState,
      badgeVisible: () => !teamBadge.hidden,
      badgeCount: () => teamBadgeCount.textContent,
      menuLabels: () => charMenu.children.map((child) => child.textContent).filter(Boolean),
      bubbleText: () => statusText.textContent,
    };
  `;
  const window = browserDemo ? {} : { __TAURI__: { window: { getCurrentWindow: () => ({ close() {} }) } } };
  const context = vm.createContext({ window, console, Promise });
  vm.runInContext(prefix + relevantApp + suffix, context, { filename: 'app.js' });
  return context.__watchdogTeam;
}

const teamStatus = () => ({
  state: 'idle',
  detail: 'Waiting for work',
  team: { name: 'Alpha', role: 'leader', members: [
    { displayName: 'Ada', role: 'leader', state: 'idle', host: 'local' },
    { displayName: 'Bea', role: 'member', state: 'idle', host: 'local' },
  ], board: { status: 'ready', revision: 0, markdown: '', updatedBy: '' } },
});
const watchdog = { enabled: true, sleep_after_seconds: 1, exit_after_seconds: 0, force_exit_after_seconds: 0 };

test('watchdog sleep is presentation-only: Team badge, authoritative status, and Gather menu remain', () => {
  const h = boot();
  const authoritative = teamStatus();
  h.setWatchdog(watchdog);
  // Initial get_status-style updates are authoritative even when not events.
  h.updateStatus(authoritative, false);
  assert.equal(h.latestIs(authoritative), true);
  assert.equal(h.badgeVisible(), true);
  assert.equal(h.badgeCount(), '2');

  h.advance(1000);
  h.checkWatchdog();

  assert.equal(h.state(), 'offline', 'watchdog still renders its local sleep state');
  assert.equal(h.bubbleText(), 'Zzz... (session silent)');
  assert.equal(h.latestIs(authoritative), true, 'local sleep did not replace authoritative status');
  assert.equal(h.badgeVisible(), true, 'local sleep did not hide the Team badge');
  h.buildMenu();
  assert.deepEqual(Array.from(h.menuLabels()).filter((label) => label.toLowerCase().includes('gather')), [
    'Gather Team in activity area',
    'End gathering (stay here)',
  ]);
});

test('authoritative missing/invalid Team clears after local sleep; real Team updates restore it', () => {
  const h = boot();
  const authoritative = teamStatus();
  h.updateStatus(authoritative, true);

  for (const status of [
    { state: 'offline', team: null },
    { state: 'idle' },
    { state: 'idle', team: { name: 'Alpha', role: 'not-a-role', members: [] } },
    { state: 'closed', team: null },
  ]) {
    h.advance(1000);
    h.checkWatchdog();
    assert.equal(h.badgeVisible(), true, 'local sleep keeps membership');
    h.updateStatus(status, false);
    assert.equal(h.latestIs(status), true, 'normal non-event updates remain authoritative');
    assert.equal(h.badgeVisible(), false, `${status.state} update cleared Team badge`);
    h.buildMenu();
    assert.equal(h.menuLabels().some((label) => label.toLowerCase().includes('gather')), false);
    h.updateStatus(authoritative, true);
    assert.equal(h.badgeVisible(), true, 'a real Team update restores the badge');
  }
});

test('browser-demo watchdog exit fallback preserves Team presentation too', () => {
  const h = boot({ browserDemo: true });
  const authoritative = teamStatus();
  h.setWatchdog({ ...watchdog, exit_after_seconds: 1 });
  h.updateStatus(authoritative, true);

  h.advance(1000);
  h.checkWatchdog();

  assert.equal(h.state(), 'offline');
  assert.equal(h.latestIs(authoritative), true);
  assert.equal(h.badgeVisible(), true);
});

test('working and alert states remain watchdog-sleep exempt', () => {
  const h = boot();
  h.setWatchdog(watchdog);

  for (const state of ['working', 'error', 'waiting']) {
    const status = { state, team: teamStatus().team };
    h.updateStatus(status, true);
    h.advance(10_000);
    h.checkWatchdog();
    assert.equal(h.state(), state, `${state} was not replaced with local sleep`);
    assert.equal(h.latestIs(status), true);
  }
});


test('authoritative offline with a valid Team still displays membership, not movement eligibility', () => {
  const h = boot();
  const status = { ...teamStatus(), state: 'offline' };
  h.updateStatus(status, true);
  assert.equal(h.latestIs(status), true);
  assert.equal(h.state(), 'offline');
  assert.equal(h.badgeVisible(), true);
});


test('a transient bubble expires back to local sleep text, not stale authoritative idle detail', () => {
  const h = boot();
  const authoritative = teamStatus();
  h.updateStatus(authoritative, true);
  h.advance(1000);
  h.checkWatchdog();
  h.showTransientBubble('Gathering 2 pets.');
  assert.equal(h.bubbleText(), 'Gathering 2 pets.');
  h.finishLastTimer();
  assert.equal(h.bubbleText(), 'Zzz... (session silent)');
  assert.equal(h.latestIs(authoritative), true);
  assert.equal(h.badgeVisible(), true);
});
