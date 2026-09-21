// Claude Status Pet — supports SVG, GIF, and ASCII art characters

const bubble = document.getElementById('speech-bubble');
const statusText = document.getElementById('status-text');
const stateGem = document.getElementById('state-gem');
const stateGemTip = document.getElementById('state-gem-tip');
const stateLabel = document.getElementById('state-label');
const sessionNameEl = document.getElementById('session-name');
const teamBadge = document.getElementById('team-badge');
const teamBadgeCount = document.getElementById('team-badge-count');
const teamBadgeTip = document.getElementById('team-badge-tip');
const container = document.getElementById('pet-container');
const artStage = document.getElementById('art-stage');
const imgWrapper = document.getElementById('ferris-wrapper');
const imgEl = document.getElementById('ferris-img');
const asciiPre = document.getElementById('ascii-art');
const charMenu = document.getElementById('char-menu');
const menuBackdrop = document.getElementById('menu-backdrop');

// localStorage can throw in restricted WebViews. All renderer preferences are
// best-effort and must never prevent the pet from starting.
const rendererStorage = (() => {
  try {
    const s = window.localStorage;
    return {
      getItem: (k) => { try { return s.getItem(k); } catch (_) { return null; } },
      setItem: (k, v) => { try { s.setItem(k, v); } catch (_) {} },
      removeItem: (k) => { try { s.removeItem(k); } catch (_) {} },
    };
  } catch (_) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
})();

// ── Character data ──

const ASCII_SPECIES = {
  chonk: {
    name: 'Voidchisel (Chonk)',
    idle: [
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['            ', '  /\\    /|  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´~ '],
    ],
    thinking: [
      ['     ?      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['    ??      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
    ],
    working: [
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['     *      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ><   ) ', '  `------´  '],
      ['    **      ', '  /\\    /|  ', ' ( {E}    {E} ) ', ' (   ><   ) ', '  `------´  '],
    ],
    offline: [
      ['    z z     ', '  /\\    /\\  ', ' ( -    - ) ', ' (   ..   ) ', '  `------´  '],
      ['   z z z    ', '  /\\    /\\  ', ' ( -    - ) ', ' (   ..   ) ', '  `------´  '],
    ],
  },
  cat: {
    name: 'Cat',
    idle: [
      ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  ω  )   ', '  (")_(")   '],
      ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  ω  )   ', '  (")_(")~  '],
    ],
    thinking: [
      ['     ?      ', '   /\\_/\\    ', '  ({E}    {E})  ', '  (  ω  )   ', '  (")_(")   '],
    ],
    working: [
      ['     *      ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  >< )   ', '  (")_(")~  '],
    ],
    offline: [
      ['   z z z    ', '   /\\_/\\    ', '  ( -   -)  ', '  (  ω  )   ', '  (")_(")   '],
    ],
  },
  ghost: {
    name: 'Ghost',
    idle: [
      ['            ', '   .----.   ', '  / {E}  {E} \\  ', '  |      |  ', '  ~`~``~`~  '],
      ['            ', '   .----.   ', '  / {E}  {E} \\  ', '  |      |  ', '  `~`~~`~`  '],
    ],
    thinking: [
      ['    ~  ~    ', '   .----.   ', '  / {E}  {E} \\  ', '  |  ??  |  ', '  ~`~``~`~  '],
    ],
    working: [
      ['   ~ ~  ~   ', '   .----.   ', '  / {E}  {E} \\  ', '  |  **  |  ', '  ~~`~~`~~  '],
    ],
    offline: [
      ['            ', '   .----.   ', '  / -  - \\  ', '  |      |  ', '  ~`~``~`~  '],
    ],
  },
  robot: {
    name: 'Robot',
    idle: [
      ['            ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ ==== ]  ', '  `------´  '],
      ['            ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ -==- ]  ', '  `------´  '],
    ],
    thinking: [
      ['    * *     ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ ???? ]  ', '  `------´  '],
    ],
    working: [
      ['    ***     ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ <<>> ]  ', '  `------´  '],
    ],
    offline: [
      ['            ', '   .[||].   ', '  [ -  - ]  ', '  [ .... ]  ', '  `------´  '],
    ],
  },
  duck: {
    name: 'Duck',
    idle: [
      ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´    '],
      ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´~   '],
    ],
    thinking: [
      ['     ?      ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´    '],
    ],
    working: [
      ['     !      ', '    __      ', '  <({E} )___  ', '   (  .__>  ', '    `--´~   '],
    ],
    offline: [
      ['   z z      ', '    __      ', '  <(- )___  ', '   (  ._>   ', '    `--´    '],
    ],
  },
  snail: {
    name: 'Snail',
    idle: [
      ['            ', ' {E}    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
      ['            ', '  {E}   .--.  ', '  |  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    thinking: [
      ['     ?      ', ' {E}    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    working: [
      ['     !      ', ' {E}    .--.  ', '  \\  ( @  ) ', '   \\_`--´   ', '   ~~~~~~   '],
      ['    !!      ', '  {E}   .--.  ', '  |  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    offline: [
      ['   z z z    ', ' -    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
  },
  axolotl: {
    name: 'Axolotl',
    idle: [
      ['            ', '}~(______)~{', '}~({E} .. {E})~{', '  ( .--. )  ', '  (_/  \\_)  '],
      ['            ', '~}(______){~', '~}({E} .. {E}){~', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
    thinking: [
      ['     ?      ', '}~(______)~{', '}~({E} .. {E})~{', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
    working: [
      ['    !!      ', '~}(______){~', '~}({E} .. {E}){~', '  (  --  )  ', '  ~_/  \\_~  '],
    ],
    offline: [
      ['   z z z    ', '}~(______)~{', '}~(- .. -)~{', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
  },
};

// GIF/WebP character maps loaded from character.json files (populated at init).
// Keep the complete config as well: `appearance` is optional pack metadata.
const GIF_MODES = {};
const CHARACTER_CONFIGS = {};
const DEFAULT_APPEARANCE = Object.freeze({
  motion: 'full', uiPreset: 'classic', artScale: 1,
  bubble: 'all', stateLabel: 'always', identity: 'always', petScale: 1,
});
const APPEARANCE_VALUES = Object.freeze({
  motion: ['intrinsic', 'subtle', 'full'],
  uiPreset: ['minimal', 'classic', 'debug'],
  artScale: null,
  bubble: ['off', 'alerts', 'all'],
  stateLabel: ['off', 'minimal', 'alerts', 'always'],
  identity: ['hidden', 'hover', 'always'],
  petScale: null,
});

// Ferris SVG map loaded from character.json (populated at init, fallback to hardcoded)
let FERRIS_SVG_MAP = {
  idle: ['ferris/1.svg'], thinking: ['ferris/3.svg', 'ferris/14.svg'],
  reading: ['ferris/10.svg'], editing: ['ferris/19.svg'],
  searching: ['ferris/20.svg'], running: ['ferris/2.svg'],
  delegating: ['ferris/15.svg'], waiting: ['ferris/5.svg'],
  error: ['ferris/9.svg'], offline: ['ferris/7.svg'], unknown: ['ferris/1.svg'],
};

const ASCII_ANIM_SPEED = {
  working: 300, editing: 300, running: 300,
  thinking: 600, searching: 600,
};
const DEFAULT_ANIM_SPEED = 800;

// ── Animation Queue & Priority System ──
// Priority levels for animation playback and interruption:
// 4: PRIORITY_ALERT      - Emergency interruption (error, waiting) — pre-empts all one-shots & loops immediately
// 3: PRIORITY_REACTION   - Temporary emotional reaction; pre-empts normal
//                          loops/transitions and returns to the business state
// 2: PRIORITY_TRANSITION - State change one-shot transition (e.g. idle->editing)
// 1: PRIORITY_VARIATION  - Idle random one-shot variation (~2s)
// 0: PRIORITY_LOOP       - Base continuous state loop (idle, editing, etc.)
const PRIORITY = {
  LOOP: 0,
  VARIATION: 1,
  TRANSITION: 2,
  REACTION: 3,
  ALERT: 4,
};

const ALERT_STATES = new Set(['error', 'waiting']);

// 静止状态：只有处于这些业务状态时看门狗才允许 sleep/exit。
// 工作态（working/editing/running/thinking/delegating/reading/searching）下
// 长时间静默通常是一次长工具调用（如几分钟的 bash、编译），不是会话闲置。
const QUIESCENT_STATES = new Set(['idle', 'offline']);

// Helper functions for character.json v2 schema
function getTransitionConfig(config, fromState, toState) {
  if (!config || !config.transitions || typeof config.transitions !== 'object') return null;
  const key = `${fromState}->${toState}`;
  const entry = config.transitions[key];
  if (!entry) return null;

  if (typeof entry === 'string') {
    return { frames: [entry], duration_ms: 1000 };
  }
  if (Array.isArray(entry)) {
    const frames = entry.filter(f => typeof f === 'string');
    return frames.length > 0 ? { frames, duration_ms: 1000 } : null;
  }
  if (typeof entry === 'object' && entry !== null) {
    let frames = [];
    if (typeof entry.frames === 'string') frames = [entry.frames];
    else if (Array.isArray(entry.frames)) frames = entry.frames.filter(f => typeof f === 'string');
    const duration_ms = (typeof entry.duration_ms === 'number' && entry.duration_ms > 0) ? entry.duration_ms : 1000;
    if (frames.length === 0) return null;
    return { frames, duration_ms };
  }
  return null;
}

function getIdleVariations(config) {
  if (!config || !config.idle_variations) return [];
  const raw = config.idle_variations;
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object' && raw !== null && raw.idle) {
    list = Array.isArray(raw.idle) ? raw.idle : [raw.idle];
  } else if (typeof raw === 'string') {
    list = [raw];
  }

  const normalized = [];
  for (const item of list) {
    if (typeof item === 'string') {
      normalized.push({ frames: [item], duration_ms: 2000 });
    } else if (Array.isArray(item)) {
      const frames = item.filter(f => typeof f === 'string');
      if (frames.length > 0) normalized.push({ frames, duration_ms: 2000 });
    } else if (typeof item === 'object' && item !== null) {
      let frames = [];
      if (typeof item.frames === 'string') frames = [item.frames];
      else if (Array.isArray(item.frames)) frames = item.frames.filter(f => typeof f === 'string');
      const duration_ms = (typeof item.duration_ms === 'number' && item.duration_ms > 0) ? item.duration_ms : 2000;
      if (frames.length > 0) normalized.push({ frames, duration_ms });
    }
  }
  return normalized;
}

function getAutoReturnSeconds(config) {
  if (config && typeof config.auto_return_seconds === 'number' && config.auto_return_seconds > 0) {
    return config.auto_return_seconds;
  }
  return 90;
}

const DEFAULT_WATCHDOG = Object.freeze({
  enabled: true,
  sleep_after_seconds: 900,
  exit_after_seconds: 3600,
  force_exit_after_seconds: 14400,
});

function getWatchdogConfig(config) {
  if (!config || config.watchdog === undefined || config.watchdog === null) {
    return { ...DEFAULT_WATCHDOG };
  }
  if (config.watchdog === false) {
    return { ...DEFAULT_WATCHDOG, enabled: false };
  }
  if (typeof config.watchdog === 'object') {
    const enabled = config.watchdog.enabled !== false;
    const sleepSec = (typeof config.watchdog.sleep_after_seconds === 'number'
      && Number.isFinite(config.watchdog.sleep_after_seconds)
      && config.watchdog.sleep_after_seconds > 0)
      ? config.watchdog.sleep_after_seconds
      : DEFAULT_WATCHDOG.sleep_after_seconds;
    const exitSec = (typeof config.watchdog.exit_after_seconds === 'number'
      && Number.isFinite(config.watchdog.exit_after_seconds)
      && config.watchdog.exit_after_seconds >= 0)
      ? config.watchdog.exit_after_seconds
      : DEFAULT_WATCHDOG.exit_after_seconds;
    const forceExitSec = (typeof config.watchdog.force_exit_after_seconds === 'number'
      && Number.isFinite(config.watchdog.force_exit_after_seconds)
      && config.watchdog.force_exit_after_seconds >= 0)
      ? config.watchdog.force_exit_after_seconds
      : DEFAULT_WATCHDOG.force_exit_after_seconds;
    return {
      enabled,
      sleep_after_seconds: sleepSec,
      exit_after_seconds: exitSec,
      force_exit_after_seconds: forceExitSec,
    };
  }
  return { ...DEFAULT_WATCHDOG };
}

// ── State ──
// Legacy keys are read only by the one-time migration in this resolver. New
// selections never write petMode or global sizing keys.
let appearancePrefs = null;
try { appearancePrefs = (typeof PetAppearance !== 'undefined') ? PetAppearance.create(rendererStorage) : null; } catch (_) { appearancePrefs = null; }
let mode = appearancePrefs ? appearancePrefs.resolve('', null).character : 'ferris';
const storageGet = (key) => { try { return rendererStorage.getItem(key); } catch (_) { return null; } };
let eye = storageGet('petEye') || '·';
let petColor = storageGet('petColor') || '';
let petBgColor = storageGet('petBgColor') || '';
let petFillColor = storageGet('petFillColor') || '';
let petTextColor = storageGet('petTextColor') || '';
let petSessionBg = storageGet('petSessionBg') || '';
let petFontSize = parseInt(storageGet('petFontSize') || '16');
let petScale = appearancePrefs ? appearancePrefs.resolve('', null).appearance.petScale : 1;
let currentBusinessState = 'idle';
let currentBusinessDetail = '';
// Empty string (not 'idle') so the first updateStatus always renders —
// otherwise the initial idle update is seen as "no change" and the
// default <img> from index.html (ferris/1.svg) is never replaced.
let visualState = '';
let currentState = 'idle';
let activeCharacterConfig = null;
let latestStatus = null;
let initialized = false;
let identityPinned = storageGet('petIdentityPinned') === 'true';
let currentImgSrc = '';
let bubbleTimeout = null;
// Tracks an expression text bubble independently from the optional reaction
// animation. Normal status churn must not erase it before its display window.
let activeExpressionBubble = null;
let asciiFrame = 0;
let asciiInterval = null;
let menuPage = 'main';
let appVersion = '0.0.0';
let customPacks = [];
let availableDlcs = [];  // [{id, name, installed}] from dlc/*.json
let boundSessionId = '';
let appearanceContext = null;
let appearanceResolution = appearancePrefs ? appearancePrefs.resolve('', null) : { character:'ferris', appearance:{...DEFAULT_APPEARANCE, petScale:1}, source:'fallback' };
let ephemeralAppearanceOverrides = {};
let sessionPoll = null;
let bindGeneration = 0;
// Presentation epochs invalidate every pending asset/transition completion.
// They are separate from binding generations: status context events must not
// cancel an in-flight rebind operation.
let renderGeneration = 0;
const dlcInstalledCache = {};
function newRenderToken() { return { generation: renderGeneration, mode }; }
function renderTokenCurrent(token) { return !!token && token.generation === renderGeneration && token.mode === mode; }
function invalidatePresentation() {
  renderGeneration++;
  reactionRequestVersion++;
  activeExpressionBubble = null;
  clearTimeout(bubbleTimeout);
  bubbleTimeout = null;
  cancelActiveOneShot();
  clearTimeout(idleVariationTimer); idleVariationTimer = null;
  clearTimeout(autoReturnTimer); autoReturnTimer = null;
}

let activeOneShot = null;      // Currently active one-shot { type, priority, targetState, timerIds }
let autoReturnTimer = null;    // Timer for auto-return decay
let idleVariationTimer = null; // Timer for idle variation triggers
let statusUpdateVersion = 0;
let reactionRequestVersion = 0;
const consumedReactionIds = new Set();
const eventDedup = (typeof PetEvents !== 'undefined' && PetEvents.createEventDedupTracker)
  ? PetEvents.createEventDedupTracker()
  : {
      remember: (id) => {
        if (!id || typeof id !== 'string' || consumedReactionIds.has(id.trim())) return false;
        consumedReactionIds.add(id.trim());
        return true;
      },
      has: (id) => typeof id === 'string' && consumedReactionIds.has(id.trim()),
    };
let lastStatusEventAt = Date.now();
const WATCHDOG_INTERVAL_MS = 30000;
let watchdogTimer = null;
let currentSendGeneration = 0;
const receiptPoller = (typeof PetEvents !== 'undefined' && PetEvents.createReceiptPoller)
  ? PetEvents.createReceiptPoller({
      fetchReceipt: async (requestId) => {
        if (!window.__TAURI__) {
          throw new Error('Tauri environment unavailable');
        }
        return await window.__TAURI__.core.invoke('get_session_message_receipt', {
          requestId,
        });
      },
      onStatus: (result) => {
        if (result && result.terminal) {
          if (
            result.status === 'dispatched' ||
            result.status === 'failed' ||
            result.status === 'expired' ||
            result.status === 'rejected' ||
            result.status === 'timeout'
          ) {
            showTransientBubble(result.text);
          }
        }
      },
      intervalMs: 500,
      maxDurationMs: 125000,
    })
  : null;

const DRAG_HOLD_MS = 300;
const DRAG_DISTANCE_PX = 5;
const NATIVE_DRAG_IDLE_MS = 500;
const NATIVE_DRAG_SAFETY_MS = 10000;
let gesturePointer = null;
let dragSession = null;
let nativeDragEndTimer = null;
let nativeDragReleasePoll = null;
let nativeDragButtonStateSupported = false;
let nativeDragPollInFlight = false;
let cachedDragReactionMode = null;
let cachedDragReactionPath = null;
let petGestureInvalid = false;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function syncGatheringInteraction(blocked = Boolean(dragSession || !charMenu.classList.contains('hidden'))) {
  if (!window.__TAURI__?.core?.invoke) return Promise.resolve();
  return window.__TAURI__.core.invoke('set_gathering_interaction', { blocked });
}

function startDrag(event) {
  if (event && event.button !== undefined && event.button !== 0) return;
  if (gesturePointer || dragSession) return;
  // Bubble/label drags use the same local cancellation and release tracking as art.
  gesturePointer = { x: event.clientX, y: event.clientY, startedAt: Date.now(), moved: true, holdTimer: null };
  maybeStartPetDrag();
}

function registerCharacterConfig(id, config) {
  const validFrames = (frames) => Array.isArray(frames) && frames.length > 0 && frames.every(path =>
    typeof path === 'string' && path.length <= 512 && !/[\\\\\0\r\n:]/.test(path)
    && !path.startsWith('/') && !path.split('/').includes('..'));
  if (!appearancePrefs?.safeId(id) || !config || !config.states || Array.isArray(config.states)
      || typeof config.states !== 'object' || !validFrames(config.states.idle)
      || !Object.values(config.states).every(validFrames)) return false;
  CHARACTER_CONFIGS[id] = config;
  GIF_MODES[id] = config.states;
  return true;
}

function activeAppearance() {
  const suggested = (activeCharacterConfig && activeCharacterConfig.appearance) || {};
  let resolved = appearanceResolution;
  if (appearancePrefs) {
    const requested = appearancePrefs.resolve(boundSessionId, appearanceContext);
    resolved = requested.character !== mode
      ? appearancePrefs.resolveCharacter(boundSessionId, appearanceContext, mode, suggested)
      : appearancePrefs.resolve(boundSessionId, appearanceContext, suggested);
  }
  const result = { ...((resolved && resolved.appearance) || DEFAULT_APPEARANCE), ...(!boundSessionId ? ephemeralAppearanceOverrides : {}) };
  for (const [key, fallback] of Object.entries(DEFAULT_APPEARANCE)) {
    // Pack suggestions apply only when no stored value exists for this character.
    if (appearancePrefs && result[key] !== undefined) continue;
    const value = suggested[key];
    result[key] = key === 'artScale' ? (Number.isFinite(Number(value)) ? Number(value) : fallback) : (APPEARANCE_VALUES[key]?.includes(value) ? value : fallback);
  }
  return result;
}

function appearanceSourceLabel() {
  const r = appearanceResolution;
  if (r && r.fallbackCharacter) return `Missing ${r.requestedCharacter}; using Ferris fallback`;
  return r.source === 'session' ? 'Session override' : r.source === 'profile' ? 'Profile binding' : r.source === 'stack' ? 'Stack binding' : r.source === 'global' ? 'New-session default' : 'Built-in Ferris fallback';
}

function setAppearance(key, value) {
  if (appearancePrefs && boundSessionId) appearancePrefs.setAppearance(boundSessionId, mode, key, value);
  else ephemeralAppearanceOverrides[key] = value;
  applyConfig();
}

function clearAppearanceOverrides() {
  ephemeralAppearanceOverrides = {};
  if (appearancePrefs && boundSessionId) {
    for (const key of Object.keys(appearancePrefs.defaults)) appearancePrefs.setAppearance(boundSessionId, mode, key, undefined);
  }
  petScale = 1;
  // Legacy keys remain untouched for rollback; migration is one-time.
}

function compactSessionName(value) {
  const parts = String(value || '').split('/').map(s => s.trim()).filter(Boolean);
  const short = parts.length >= 2 ? parts.slice(-2).join(' · ') : parts[0] || '';
  return short.length > 42 ? short.slice(0, 41) + '…' : short;
}

function setVisualAnimation(name) {
  const appearance = activeAppearance();
  container.className = `motion-${appearance.motion} preset-${appearance.uiPreset} anim-${name}`;
}

function shouldShowBubble(state) {
  const policy = activeAppearance().bubble;
  return policy === 'all' || (policy === 'alerts' && (state === 'waiting' || state === 'error'));
}

function shouldShowStateLabel(state) {
  const policy = activeAppearance().stateLabel;
  return policy === 'always' || (policy === 'alerts' && (state === 'waiting' || state === 'error'));
}

function shouldShowStateGem() {
  const policy = activeAppearance().stateLabel;
  return policy === 'minimal';
}

function updateStateGemTipText(state, detail) {
  if (!stateGemTip) return;
  const tipDetail = (state === 'offline' && !detail) ? 'Zzz...' : detail;
  const text = tipDetail ? `${state}: ${tipDetail}` : state;
  stateGemTip.textContent = text;
}

// ── Apply visual config ──
function applyConfig() {
  // Resolve first. Container/gem sizing must use the new preference, not the
  // previous frame's petScale.
  const appearance = activeAppearance();
  petScale = Number.isFinite(Number(appearance.petScale)) ? Number(appearance.petScale) : 1;
  const colorProps = [
    [asciiPre, 'color', petColor],
    [stateLabel, 'color', petColor],
    [sessionNameEl, 'background', petSessionBg],
    [sessionNameEl, 'color', petTextColor],
    [container, 'background', petBgColor],
    [container, 'borderRadius', petBgColor ? '12px' : ''],
    [asciiPre, 'background', petFillColor],
  ];
  for (const [el, prop, val] of colorProps) {
    el.style[prop] = val || '';
  }
  // Sync bubble border + tail with label background color
  const bubbleColor = petSessionBg && petSessionBg !== 'transparent' ? petSessionBg : '';
  bubble.style.setProperty('--bubble-color', bubbleColor);
  if (stateGem) {
    if (petColor) {
      stateGem.style.setProperty('--gem-color', petColor);
    } else {
      stateGem.style.removeProperty('--gem-color');
    }
    const gemSize = Math.round(10 * petScale);
    stateGem.style.width = gemSize + 'px';
    stateGem.style.height = gemSize + 'px';
  }
  if (stateGemTip) {
    stateGemTip.style.fontSize = Math.round(11 * petScale) + 'px';
  }
  asciiPre.style.fontSize = petFontSize + 'px';
  container.style.width = Math.round(200 * petScale) + 'px';
  container.style.height = Math.round(240 * petScale) + 'px';

  // Global scale controls the window/chrome. Art scale is deliberately independent.
  const artSize = Math.round(140 * appearance.artScale * petScale);
  artStage.style.width = artSize + 'px';
  artStage.style.height = artSize + 'px';
  imgWrapper.style.width = artSize + 'px';
  imgWrapper.style.height = artSize + 'px';
  asciiPre.style.width = artSize + 'px';
  statusText.style.fontSize = Math.round(13 * petScale) + 'px';
  sessionNameEl.style.fontSize = Math.round(12 * petScale) + 'px';
  stateLabel.style.fontSize = Math.round(12 * petScale) + 'px';
  bubble.style.maxWidth = Math.round(180 * petScale) + 'px';
  container.dataset.identity = identityPinned ? 'pinned' : appearance.identity;
  container.dataset.bubble = appearance.bubble;
  container.dataset.bubbleVisible = shouldShowBubble(currentBusinessState) ? 'true' : 'false';
  container.dataset.stateLabel = appearance.stateLabel;
  setVisualAnimation(visualState);
  stateLabel.hidden = !shouldShowStateLabel(currentBusinessState);
  if (stateGem) {
    stateGem.hidden = !shouldShowStateGem();
  }
  const currentDetail = currentBusinessDetail || (statusText ? statusText.textContent : '');
  updateStateGemTipText(currentBusinessState, currentDetail);

  // Resize window to match
  if (window.__TAURI__) {
    const w = Math.round(200 * petScale);
    const h = Math.round(240 * petScale);
    const LS = window.__TAURI__.dpi?.LogicalSize || window.__TAURI__.window?.LogicalSize;
    if (LS) {
      window.__TAURI__.window.getCurrentWindow().setSize(new LS(w, h));
    }
  }
}

function saveConfig(key, value) {
  try { rendererStorage.setItem(key, value); } catch (_) {}
  applyConfig();
}

// ── Renderers ──

function showImage() {
  imgWrapper.style.display = 'flex';
  asciiPre.style.display = 'none';
}

function showAscii() {
  imgWrapper.style.display = 'none';
  asciiPre.style.display = 'block';
}

function setImage(src, token = newRenderToken()) {
  if (!renderTokenCurrent(token)) return;
  const resolved = assetUrl(src);
  if (resolved === currentImgSrc) return;
  // Keep the current frame visible while an uncached external asset loads,
  // then switch directly. Fading to transparent made short reactions look
  // like the idle loop blinked instead of actually changing animation.
  if (resolved === src && hasExternalAssets && window.__TAURI__) {
    loadAsset(src).then(url => {
      if (!renderTokenCurrent(token)) return;
      if (url !== src) setImage(src, token); // retry with cached version
      else {
        currentImgSrc = src;
        imgEl.src = src;
        imgEl.style.opacity = '1';
      }
    }).catch(() => {});
    return;
  }
  currentImgSrc = resolved;
  imgEl.src = resolved;
  imgEl.style.opacity = '1';
}

// Show ASCII 404 art when image fails to load, unless playing a one-shot (silent degradation)
imgEl.addEventListener('error', () => {
  if (activeOneShot) {
    const fallbackState = activeOneShot.targetState || visualState || 'idle';
    cancelActiveOneShot();
    startStateLoop(fallbackState);
    return;
  }

  if (imgEl.src && imgEl.src !== window.location.href) {
    const name = decodeURIComponent(imgEl.src.split('/').pop().split('?')[0]);
    // Switch to ASCII 404 display
    showAscii();
    asciiPre.textContent = [
      '            ',
      '   4  0  4  ',
      '   ╭──────╮ ',
      '   │ ×  × │ ',
      '   │  __  │ ',
      '   ╰──────╯ ',
    ].join('\n');
    setBubbleText('Image not found: ' + name);
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 8000);
  }
});

function renderAsciiFrame(frames, frameIdx) {
  const frame = frames[frameIdx % frames.length];
  asciiPre.textContent = frame.map(line => line.replaceAll('{E}', eye)).join('\n');
}

function startAsciiAnimation(frames) {
  if (asciiInterval) clearInterval(asciiInterval);
  asciiFrame = 0;
  renderAsciiFrame(frames, 0);
  if (frames.length > 1) {
    const speed = ASCII_ANIM_SPEED[visualState] || DEFAULT_ANIM_SPEED;
    asciiInterval = setInterval(() => {
      asciiFrame++;
      renderAsciiFrame(frames, asciiFrame);
    }, speed);
  }
}

// ── Animation Queue & Playback Functions ──

function cancelActiveOneShot() {
  if (!activeOneShot) return;
  if (Array.isArray(activeOneShot.timerIds)) {
    activeOneShot.timerIds.forEach(id => clearTimeout(id));
  }
  if (typeof activeOneShot.cancel === 'function') {
    activeOneShot.cancel();
  }
  activeOneShot = null;
}

async function verifyImageAsset(path, token = newRenderToken()) {
  if (!path || !renderTokenCurrent(token)) return null;
  try {
    const resolved = await loadAsset(path);
    if (!renderTokenCurrent(token)) return null;
    const url = assetUrl(path);
    return new Promise((resolve) => {
      let settled = false;
      const img = new Image();
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 2000);
      img.onload = () => {
        if (!renderTokenCurrent(token)) { settled = true; clearTimeout(timer); resolve(null); return; }
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(url);
        }
      };
      img.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = url;
    });
  } catch (e) {
    return null;
  }
}

function startStateLoop(state) {
  // A normal loop is a new request as well; invalidate any verification that
  // is still awaiting an older transition/reaction.
  renderGeneration++;
  cancelActiveOneShot();
  visualState = state;
  currentState = currentBusinessState;

  if (mode === 'ferris') {
    showImage();
    const sprites = FERRIS_SVG_MAP[state] || FERRIS_SVG_MAP.idle || ['ferris/1.svg'];
    setImage(pickRandom(sprites));
  } else if (GIF_MODES[mode]) {
    showImage();
    const map = GIF_MODES[mode];
    setImage(pickRandom(map[state] || map.idle || []));
  } else {
    showAscii();
    const species = ASCII_SPECIES[mode];
    if (species) {
      const stateKey = (state === 'delegating') ? 'working' : state;
      startAsciiAnimation(species[stateKey] || species.idle);
    }
  }

  setVisualAnimation(state);

  if (state === 'idle') {
    scheduleNextIdleVariation();
  } else {
    clearTimeout(idleVariationTimer);
    idleVariationTimer = null;
  }
}

async function playTransition(fromState, toState, transitionConfig) {
  const token = { generation: ++renderGeneration, mode };
  cancelActiveOneShot();
  clearTimeout(idleVariationTimer);
  idleVariationTimer = null;

  const frames = transitionConfig.frames || [];
  const duration = transitionConfig.duration_ms || 1000;

  if (!frames.length || (mode !== 'ferris' && !GIF_MODES[mode])) {
    startStateLoop(toState);
    return;
  }

  // Pre-verify all frames for silent degradation
  const verifiedUrls = [];
  for (const f of frames) {
    const url = await verifyImageAsset(f, token);
    if (!url) {
      if (!renderTokenCurrent(token)) return;
      // Missing asset: silent fallback to normal loop with ~150ms fade
      startStateLoop(toState);
      return;
    }
    verifiedUrls.push(url);
  }

  if (!renderTokenCurrent(token)) return;
  const timerIds = [];
  const oneShot = {
    type: 'transition',
    priority: PRIORITY.TRANSITION,
    targetState: toState,
    timerIds,
  };
  activeOneShot = oneShot;

  showImage();
  setVisualAnimation('appear');

  if (verifiedUrls.length === 1) {
    setImage(frames[0], token);
    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot && renderTokenCurrent(token)) {
        activeOneShot = null;
        startStateLoop(toState);
      }
    }, duration);
    timerIds.push(endTimer);
  } else {
    const frameTime = Math.max(50, Math.floor(duration / verifiedUrls.length));
    setImage(frames[0], token);
    for (let idx = 1; idx < verifiedUrls.length; idx++) {
      const ft = setTimeout(() => {
        if (activeOneShot === oneShot && renderTokenCurrent(token)) {
          imgEl.src = verifiedUrls[idx];
          currentImgSrc = verifiedUrls[idx];
          imgEl.style.opacity = '1';
        }
      }, idx * frameTime);
      timerIds.push(ft);
    }

    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot && renderTokenCurrent(token)) {
        activeOneShot = null;
        startStateLoop(toState);
      }
    }, duration);
    timerIds.push(endTimer);
  }
}

async function playIdleVariation(variationConfig) {
  const token = { generation: ++renderGeneration, mode };
  if (visualState !== 'idle' || activeOneShot) return;

  const frames = variationConfig.frames || [];
  const duration = variationConfig.duration_ms || 2000;

  if (!frames.length || (mode !== 'ferris' && !GIF_MODES[mode])) {
    scheduleNextIdleVariation();
    return;
  }

  // Pre-verify assets
  const verifiedUrls = [];
  for (const f of frames) {
    const url = await verifyImageAsset(f, token);
    if (!url) {
      if (!renderTokenCurrent(token)) return;
      // Missing asset: silently skip this variation
      scheduleNextIdleVariation();
      return;
    }
    verifiedUrls.push(url);
  }

  if (!renderTokenCurrent(token)) return;
  const timerIds = [];
  const oneShot = {
    type: 'variation',
    priority: PRIORITY.VARIATION,
    targetState: 'idle',
    timerIds,
  };
  activeOneShot = oneShot;

  showImage();

  if (verifiedUrls.length === 1) {
    setImage(frames[0], token);
    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot && renderTokenCurrent(token)) {
        activeOneShot = null;
        startStateLoop('idle');
      }
    }, duration);
    timerIds.push(endTimer);
  } else {
    const frameTime = Math.max(50, Math.floor(duration / verifiedUrls.length));
    setImage(frames[0], token);
    for (let idx = 1; idx < verifiedUrls.length; idx++) {
      const ft = setTimeout(() => {
        if (activeOneShot === oneShot && renderTokenCurrent(token)) {
          imgEl.src = verifiedUrls[idx];
          currentImgSrc = verifiedUrls[idx];
          imgEl.style.opacity = '1';
        }
      }, idx * frameTime);
      timerIds.push(ft);
    }

    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot && renderTokenCurrent(token)) {
        activeOneShot = null;
        startStateLoop('idle');
      }
    }, duration);
    timerIds.push(endTimer);
  }
}

function triggerIdleVariation() {
  if (visualState !== 'idle' || activeOneShot) return;
  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  const variations = getIdleVariations(cfg);
  if (!variations.length) {
    scheduleNextIdleVariation();
    return;
  }
  const picked = pickRandom(variations);
  playIdleVariation(picked);
}

function scheduleNextIdleVariation() {
  clearTimeout(idleVariationTimer);
  idleVariationTimer = setTimeout(() => {
    triggerIdleVariation();
  }, 30000);
}

function scheduleAutoReturn(state) {
  clearTimeout(autoReturnTimer);
  autoReturnTimer = null;

  // Alerts (error, waiting) and offline do not decay
  if (ALERT_STATES.has(state) || state === 'idle' || state === 'offline') {
    return;
  }

  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  const returnSec = getAutoReturnSeconds(cfg);

  autoReturnTimer = setTimeout(() => {
    onAutoReturnDecay();
  }, returnSec * 1000);
}

function onAutoReturnDecay() {
  if (activeOneShot && activeOneShot.type === 'reaction') return;
  if (ALERT_STATES.has(currentBusinessState) || visualState === 'idle' || currentBusinessState === 'offline') {
    return;
  }

  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  const trans = getTransitionConfig(cfg, visualState, 'idle');
  if (trans) {
    playTransition(visualState, 'idle', trans);
  } else {
    cancelActiveOneShot();
    startStateLoop('idle');
  }
}

function reactionIsExpired(reaction) {
  const ts = Number(reaction && reaction.ts);
  const ttl = Number(reaction && reaction.ttl_ms);
  return !Number.isFinite(ts) || !Number.isFinite(ttl) || ttl < 0 || Date.now() > ts + ttl;
}

function rememberReaction(id) {
  return eventDedup.remember(id);
}

async function findReactionAsset(emotion, isCurrent) {
  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  const candidates = (typeof PetEvents !== 'undefined' && PetEvents.getReactionAssetCandidates)
    ? PetEvents.getReactionAssetCandidates(cfg, mode, emotion)
    : ['webp', 'gif', 'svg', 'png'].map(extension => `${mode}/reaction_${emotion}.${extension}`);

  for (const candidate of candidates) {
    const url = await verifyImageAsset(candidate);
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
    if (url) return candidate;
  }
  return null;
}

async function playExpression(event) {
  if (ALERT_STATES.has(currentBusinessState) || dragSession) return;
  const token = newRenderToken();
  const requestVersion = ++reactionRequestVersion;
  if (!renderTokenCurrent(token)) return;

  const payload = (event && event.payload) || {};
  const text = typeof payload.text === 'string' && payload.text.trim().length > 0 ? payload.text : null;
  const emotion = typeof payload.emotion === 'string' && payload.emotion ? payload.emotion : null;
  const durationMs = (typeof payload.durationMs === 'number' && payload.durationMs > 0) ? payload.durationMs : 2500;

  // 1. Text display in speech bubble (Hard Rule: text shows even if emotion asset is missing)
  if (text) {
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
    const expressionBubble = { requestVersion };
    activeExpressionBubble = expressionBubble;

    setBubbleText(text);
    container.dataset.bubbleVisible = 'true';
    bubble.classList.remove('hidden');

    // Pop scale transition
    bubble.style.transition = 'none';
    bubble.style.transform = 'scale(0.95)';
    setTimeout(() => {
      bubble.style.transition = 'opacity 0.3s ease, transform 0.15s ease';
      bubble.style.transform = 'scale(1)';
    }, 50);

    bubbleTimeout = setTimeout(() => {
      if (!renderTokenCurrent(token) || activeExpressionBubble !== expressionBubble) return;
      bubbleTimeout = null;
      activeExpressionBubble = null;
      // Restore business bubble display according to the latest status & policy.
      const state = currentBusinessState;
      const detail = currentBusinessDetail;
      if (shouldShowBubble(state) && (detail || state === 'offline')) {
        setBubbleText(detail || (state === 'offline' ? 'Zzz...' : ''));
        bubble.classList.remove('hidden');
        container.dataset.bubbleVisible = 'true';
      } else {
        bubble.classList.add('hidden');
        container.dataset.bubbleVisible = 'false';
      }
    }, durationMs);
  }

  // 2. Emotion reaction animation
  if (emotion) {
    const reactionPath = await findReactionAsset(
      emotion,
      () => requestVersion === reactionRequestVersion,
    );

    if (!reactionPath || !renderTokenCurrent(token) || ALERT_STATES.has(currentBusinessState) || dragSession) {
      // Missing animation asset: reaction skipped silently, text remains visible.
      return;
    }

    // Only pre-empt the current lower-priority animation after an asset was
    // found; a missing reaction must leave the normal animation untouched.
    cancelActiveOneShot();
    clearTimeout(idleVariationTimer);
    idleVariationTimer = null;
    const timerIds = [];
    const oneShot = {
      type: 'reaction',
      priority: PRIORITY.REACTION,
      targetState: currentBusinessState,
      timerIds,
    };
    activeOneShot = oneShot;
    showImage();
    setVisualAnimation('reaction');
    setImage(reactionPath);

    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot && renderTokenCurrent(token)) {
        activeOneShot = null;
        startStateLoop(oneShot.targetState);
      }
    }, durationMs);
    timerIds.push(endTimer);
  }
}

async function playReaction(reaction, requestVersion) {
  const event = {
    schemaVersion: '1',
    eventId: reaction.id || `reaction_${Date.now()}`,
    petId: boundSessionId,
    kind: 'expression',
    payload: {
      text: reaction.message || null,
      emotion: reaction.emotion || null,
      speak: !!reaction.speak,
      priority: PRIORITY.REACTION,
      durationMs: reaction.ttl_ms || 2500,
    },
    createdAtMs: reaction.ts || Date.now(),
    expiresAtMs: reaction.ts && reaction.ttl_ms ? reaction.ts + reaction.ttl_ms : 0,
  };
  playExpression(event);
}

function handlePetEvent(rawEvent) {
  const parser = (typeof PetEvents !== 'undefined' && PetEvents.parsePetEvent)
    ? PetEvents.parsePetEvent
    : (window.PetEvents && window.PetEvents.parsePetEvent);
  const parsed = parser ? parser(rawEvent, Date.now()) : { ok: true, event: rawEvent };
  if (!parsed.ok || !parsed.event) return;

  const event = parsed.event;
  if (!eventDedup.remember(event.eventId)) return;
  if (ALERT_STATES.has(currentBusinessState)) return;

  playExpression(event);
}

function handleReactionEvent(rawReaction) {
  const parser = (typeof PetEvents !== 'undefined' && PetEvents.parseLegacyReaction)
    ? PetEvents.parseLegacyReaction
    : (window.PetEvents && window.PetEvents.parseLegacyReaction);
  const parsed = parser ? parser(rawReaction, Date.now()) : null;
  if (!parsed || !parsed.ok || !parsed.event) return;

  const event = parsed.event;
  if (!eventDedup.remember(event.eventId)) return;
  if (ALERT_STATES.has(currentBusinessState)) return;

  playExpression(event);
}

function isPetGestureTarget(target) {
  if (!target || !artStage.contains(target)) return false;
  return !target.closest('#state-gem, #speech-bubble, #char-menu, #menu-backdrop, #session-name, #team-badge');
}

function markPetPointerMoved(event) {
  if (!gesturePointer) return;
  const dx = event.clientX - gesturePointer.x;
  const dy = event.clientY - gesturePointer.y;
  if (Math.hypot(dx, dy) > DRAG_DISTANCE_PX) {
    gesturePointer.moved = true;
    maybeStartPetDrag();
  }
}

async function beginPetDrag(pointer, session) {
  const cachedPath = cachedDragReactionMode === mode ? cachedDragReactionPath : null;
  const reactionPath = cachedPath || await findReactionAsset(
    'drag',
    () => dragSession === session
      && !ALERT_STATES.has(currentBusinessState),
  );

  // Drag reactions are optional. Keep the animation that was already playing
  // when no drag asset exists.
  if (!reactionPath || dragSession !== session) {
    session.active = false;
    return;
  }

  cancelActiveOneShot();
  clearTimeout(idleVariationTimer);
  idleVariationTimer = null;
  const oneShot = {
    type: 'drag',
    priority: PRIORITY.REACTION,
    targetState: session.targetState,
    timerIds: [],
  };
  session.active = true;
  session.oneShot = oneShot;
  activeOneShot = oneShot;
  showImage();
  setVisualAnimation('reaction');
  setImage(reactionPath);
}

function clearNativeDragReleasePoll() {
  clearInterval(nativeDragReleasePoll);
  nativeDragReleasePoll = null;
  nativeDragPollInFlight = false;
}

function releaseNativeDragSession(session) {
  finishPetDrag(session);
  if (gesturePointer && gesturePointer.dragSession === session) {
    clearTimeout(gesturePointer.holdTimer);
    gesturePointer = null;
    petGestureInvalid = true;
  }
}

function scheduleNativeDragFinish(session, delayMs = NATIVE_DRAG_IDLE_MS) {
  clearTimeout(nativeDragEndTimer);
  nativeDragEndTimer = setTimeout(() => {
    nativeDragEndTimer = null;
    releaseNativeDragSession(session);
  }, delayMs);
}

function startNativeDragReleasePoll(session) {
  clearNativeDragReleasePoll();
  nativeDragButtonStateSupported = false;
  if (!window.__TAURI__?.core?.invoke) return;

  const poll = async () => {
    if (nativeDragPollInFlight || dragSession !== session) return;
    nativeDragPollInFlight = true;
    try {
      const isDown = await window.__TAURI__.core.invoke('is_primary_mouse_button_down');
      if (dragSession !== session) return;
      if (isDown === true) {
        nativeDragButtonStateSupported = true;
        scheduleNativeDragFinish(session, NATIVE_DRAG_SAFETY_MS);
      } else if (isDown === false) {
        nativeDragButtonStateSupported = true;
        releaseNativeDragSession(session);
      } else {
        clearNativeDragReleasePoll();
      }
    } catch (_) {
      clearNativeDragReleasePoll();
    } finally {
      nativeDragPollInFlight = false;
    }
  };

  nativeDragReleasePoll = setInterval(poll, 50);
  poll();
}

function maybeStartPetDrag() {
  const pointer = gesturePointer;
  if (!pointer || pointer.dragStarted || !pointer.moved) return;

  pointer.dragStarted = true;
  petGestureInvalid = true;

  const session = {
    targetState: currentBusinessState,
    active: false,
    oneShot: null,
  };
  pointer.dragSession = session;
  dragSession = session;

  if (!ALERT_STATES.has(currentBusinessState)) {
    // Begin resolving the optional reaction before handing mouse capture to
    // the native window drag. Convention assets are preloaded below.
    reactionRequestVersion++;
    beginPetDrag(pointer, session);
  }

  const startNativeDrag = async () => {
    if (gesturePointer !== pointer || dragSession !== session) return;
    try { await syncGatheringInteraction(true); } catch (_) { finishPetDrag(session); return; }
    if (gesturePointer !== pointer || dragSession !== session) { syncGatheringInteraction().catch(() => {}); return; }
    scheduleNativeDragFinish(session, NATIVE_DRAG_SAFETY_MS);
    if (window.__TAURI__) {
      Promise.resolve(window.__TAURI__.window.getCurrentWindow().startDragging()).catch(() => {
        finishPetDrag(session);
      });
      startNativeDragReleasePoll(session);
    } else {
      finishPetDrag(session);
    }
  };

  // Setting img.src and starting the Win32 move loop in the same JS task can
  // freeze WebView2 on the old frame. Give the compositor two frames to commit
  // the decoded drag image while the primary button is still held.
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(startNativeDrag);
    });
  } else {
    setTimeout(startNativeDrag, 0);
  }
}

function noteNativeWindowMoved() {
  const pointer = gesturePointer;
  if (!pointer || !pointer.dragStarted || !pointer.dragSession) return;
  if (!nativeDragReleasePoll && !nativeDragButtonStateSupported) {
    scheduleNativeDragFinish(pointer.dragSession);
  }
}

function cancelPetDrag() {
  clearTimeout(nativeDragEndTimer);
  nativeDragEndTimer = null;
  clearNativeDragReleasePoll();
  nativeDragButtonStateSupported = false;
  const session = dragSession;
  dragSession = null;
  syncGatheringInteraction().catch(() => {});
  if (session) session.active = false;
  if (activeOneShot && activeOneShot.type === 'drag') cancelActiveOneShot();
}

function finishPetDrag(session) {
  if (!session || dragSession !== session) return;
  clearTimeout(nativeDragEndTimer);
  nativeDragEndTimer = null;
  clearNativeDragReleasePoll();
  nativeDragButtonStateSupported = false;
  dragSession = null;
  syncGatheringInteraction().catch(() => {});
  const wasActive = session.active && activeOneShot === session.oneShot;
  session.active = false;
  if (wasActive) {
    cancelActiveOneShot();
    if (!ALERT_STATES.has(currentBusinessState)) startStateLoop(currentBusinessState);
  }
}

function beginPetPointer(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (!isPetGestureTarget(event.target) || gesturePointer) return;

  const startedAt = Date.now();
  gesturePointer = {
    x: event.clientX,
    y: event.clientY,
    startedAt,
    moved: false,
    holdTimer: setTimeout(() => {
      if (gesturePointer && gesturePointer.startedAt === startedAt) {
        gesturePointer.held = true;
        maybeStartPetDrag();
      }
    }, DRAG_HOLD_MS),
  };
  petGestureInvalid = false;
}

function endPetPointer(event) {
  if (!gesturePointer) return;
  markPetPointerMoved(event);
  const pointer = gesturePointer;
  clearTimeout(pointer.holdTimer);
  finishPetDrag(pointer.dragSession);
  gesturePointer = null;
  // Releasing outside the art stage or after a held/moved gesture must not
  // be promoted to a double-click by Chromium.
  petGestureInvalid = !isPetGestureTarget(event.target)
    || pointer.moved
    || pointer.held
    || Date.now() - pointer.startedAt > DRAG_HOLD_MS;
}

function cancelPetPointer() {
  if (gesturePointer) {
    clearTimeout(gesturePointer.holdTimer);
    finishPetDrag(gesturePointer.dragSession);
  }
  cancelPetDrag();
  gesturePointer = null;
  petGestureInvalid = true;
}

function handlePetCaptureLoss() {
  // Win32 native dragging transfers pointer capture away from WebView2 and
  // immediately emits pointercancel (sometimes blur). That is not the end of
  // the drag; window-move debounce or the safety timer owns native teardown.
  if (gesturePointer && gesturePointer.dragStarted && gesturePointer.dragSession === dragSession) {
    clearTimeout(gesturePointer.holdTimer);
    petGestureInvalid = true;
    return;
  }
  cancelPetPointer();
}

async function openPetChat() {
  if (!window.__TAURI__?.core) return false;
  try {
    return !!(await window.__TAURI__.core.invoke('open_pet_chat'));
  } catch (err) {
    console.error('Failed to open pet chat:', err);
    return false;
  }
}

function handlePetDoubleClick(event) {
  if (!isPetGestureTarget(event.target)) return;
  // A drag must not be promoted to a double click by a browser/event source.
  if (petGestureInvalid) {
    petGestureInvalid = false;
    return;
  }
  openPetChat();
}

// ── Session Watchdog ──

function checkWatchdog() {
  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  const wd = getWatchdogConfig(cfg);
  if (!wd.enabled) return;

  // alert 豁免：当前业务状态为 error/waiting 时，sleep 与 exit 均不触发
  if (ALERT_STATES.has(currentBusinessState)) {
    return;
  }

  const now = Date.now();
  const elapsedMs = now - lastStatusEventAt;

  // 1. 工作状态豁免：working/editing/running/thinking 等非静默状态下的长静默通常是
  // 一次长工具调用，不是闲置。此时不参与 sleep 与正常 exit 梯级，仅受 force_exit
  // 兜底（防止上游 Clawd 崩溃后状态永远停在工作态，桌宠变僵尸；设为 0 则禁用）。
  // force_exit 不适用于静默状态：用户显式设 exit_after_seconds: 0 选择“只睡不退”时，
  // 睡着的桌宠不应被兜底杀掉。
  if (!QUIESCENT_STATES.has(currentBusinessState)) {
    if (wd.force_exit_after_seconds > 0) {
      const forceExitAfterMs = wd.force_exit_after_seconds * 1000;
      if (elapsedMs >= forceExitAfterMs && window.__TAURI__) {
        window.__TAURI__.window.getCurrentWindow().close();
      }
    }
    return;
  }

  // 2. 静默状态梯级判定（exit 优先于 sleep）
  // exit 级：若设置为 0 则禁用正常退出（桌宠仅休眠，不自动退出）
  if (wd.exit_after_seconds > 0) {
    const exitAfterMs = wd.exit_after_seconds * 1000;
    if (elapsedMs >= exitAfterMs) {
      if (window.__TAURI__) {
        window.__TAURI__.window.getCurrentWindow().close();
      } else {
        // 浏览器 demo 模式停留在 offline 即可，不得报错
        if (currentBusinessState !== 'offline') {
          updateStatus({ state: 'offline', detail: 'Zzz... (session silent)' }, false, true);
        }
      }
      return;
    }
  }

  // sleep 级：>= sleepAfterMs
  if (wd.sleep_after_seconds > 0) {
    const sleepAfterMs = wd.sleep_after_seconds * 1000;
    if (elapsedMs >= sleepAfterMs) {
      if (currentBusinessState !== 'offline') {
        updateStatus({ state: 'offline', detail: 'Zzz... (session silent)' }, false, true);
      }
      return;
    }
  }
}

watchdogTimer = setInterval(checkWatchdog, WATCHDOG_INTERVAL_MS);

// ── Main update ──

// Bubbles are bounded previews. Keep the full plain text available on hover,
// including transient/native errors and expressions, without growing the window.
function setBubbleText(text) {
  statusText.textContent = text;
  statusText.title = statusText.textContent;
}

function updateTeamBadge(team) {
  if (!teamBadge) return false;
  const valid = team && typeof team === 'object'
    && typeof team.name === 'string'
    && ['leader', 'member', 'observer'].includes(team.role)
    && Array.isArray(team.members)
    && team.members.length > 0;
  teamBadge.hidden = !valid;
  if (!valid) {
    if (teamBadgeCount) teamBadgeCount.textContent = '';
    if (teamBadgeTip) teamBadgeTip.textContent = '';
    teamBadge.removeAttribute('data-role');
    return false;
  }
  teamBadge.dataset.role = team.role;
  if (teamBadgeCount) teamBadgeCount.textContent = String(Math.min(team.members.length, 8));
  if (teamBadgeTip) teamBadgeTip.textContent = `${team.name} · ${team.role}`;
  teamBadge.setAttribute('aria-label', `Open ${team.name} Team Board`);
  return true;
}

async function openTeamBoard() {
  if (!teamBadge || teamBadge.hidden || !window.__TAURI__?.core) return false;
  try {
    return !!(await window.__TAURI__.core.invoke('open_team_board'));
  } catch {
    return false;
  }
}

let forgeInstanceId = null;
let forgeRevision = -1;
// Epoch retirement is scoped to a bound session. A session can be revisited
// without inheriting another session's instance tombstones.
const retiredForgeInstances = new Map();
function retireForgeInstance(sessionId, instanceId) {
  if (!sessionId || !instanceId) return;
  const list = retiredForgeInstances.get(sessionId) || [];
  if (!list.includes(instanceId)) list.push(instanceId);
  while (list.length > 8) list.shift();
  retiredForgeInstances.set(sessionId, list);
  while (retiredForgeInstances.size > 64) retiredForgeInstances.delete(retiredForgeInstances.keys().next().value);
}
function processAppearanceContext(status) {
  const hasContext = Object.prototype.hasOwnProperty.call(status || {}, 'appearance_context') || Object.prototype.hasOwnProperty.call(status || {}, 'appearanceContext');
  if (!hasContext || !appearancePrefs) return false;
  const raw = status.appearance_context !== undefined ? status.appearance_context : status.appearanceContext;
  const next = raw === null ? null : appearancePrefs.cleanContext(raw);
  if (raw !== null && !next) return false; // fail closed without changing a valid prior context
  const retired = retiredForgeInstances.get(boundSessionId) || [];
  if (next && retired.includes(next.instanceId) && next.instanceId !== forgeInstanceId) return false;
  if (next && forgeInstanceId === next.instanceId && next.revision !== null && next.revision <= forgeRevision) return false;
  if (next) {
    if (forgeInstanceId && forgeInstanceId !== next.instanceId) retireForgeInstance(boundSessionId, forgeInstanceId);
    forgeInstanceId = next.instanceId; forgeRevision = next.revision;
  }
  else {
    // Clearing context retires the current epoch before resetting it, so a
    // delayed event from the old forge cannot restore stale bindings.
    retireForgeInstance(boundSessionId, forgeInstanceId);
    forgeInstanceId = null; forgeRevision = -1;
  }
  appearanceContext = next;
  return applyAppearanceResolution(true);
}

function updateStatus(status, isRealEvent = false, presentationOnly = false) {
  status = (status && typeof status === 'object') ? status : {};
  if (isRealEvent) {
    lastStatusEventAt = Date.now();
  }
  statusUpdateVersion++;
  const advertisedSession = status.session_id || status.sessionId || '';
  if (boundSessionId && advertisedSession && advertisedSession !== boundSessionId) return;
  if (advertisedSession && !boundSessionId) {
    boundSessionId = advertisedSession;
    // Startup status may beat get_session_id and contain no context; restore
    // the session preference immediately rather than waiting for a later event.
    applyAppearanceResolution(false);
  }
  processAppearanceContext(status);
  const state = status.state || 'idle';
  const detail = status.detail || '';
  const sessionName = status.session_name || '';
  const previousBusinessState = currentBusinessState;
  const stateChanged = (state !== previousBusinessState);
  const reactionWasActive = activeOneShot && activeOneShot.type === 'reaction';
  const dragWasActive = !!dragSession || (activeOneShot && activeOneShot.type === 'drag');
  const interruptReaction = (typeof PetEvents !== 'undefined' && PetEvents.isReactionInterruptState)
    ? PetEvents.isReactionInterruptState(state)
    : (ALERT_STATES.has(state) || state === 'offline' || state === 'closed');
  const interruptDrag = (typeof PetEvents !== 'undefined' && PetEvents.shouldInterruptDragPresentation)
    ? PetEvents.shouldInterruptDragPresentation(dragWasActive, previousBusinessState, state)
    : (dragWasActive && (stateChanged || interruptReaction));

  // Duplicate heartbeats for the same business state must not erase a direct
  // user drag. Real state changes and alert/lifecycle states still win.
  if (interruptDrag) {
    reactionRequestVersion++;
    cancelPetDrag();
  }
  // Reactions outrank ordinary thinking/running/idle churn. Only alert and
  // lifecycle states interrupt their bounded presentation window.
  if (interruptReaction && (reactionWasActive || activeExpressionBubble)) {
    reactionRequestVersion++;
    if (reactionWasActive) cancelActiveOneShot();
    activeExpressionBubble = null;
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
  }
  // Watchdog sleep is a local visual overlay, not an authoritative status.
  // Preserve the last server-provided membership so Team actions remain available.
  if (!presentationOnly) {
    latestStatus = status;
    updateTeamBadge(status.team || null);
  }

  if (state === 'closed' && window.__TAURI__) {
    window.__TAURI__.window.getCurrentWindow().close();
    return;
  }

  if (sessionName) {
    sessionNameEl.textContent = compactSessionName(sessionName);
    sessionNameEl.title = sessionName;
  }

  if (status.session_id && !boundSessionId) {
    boundSessionId = status.session_id;
  }

  currentBusinessState = state;
  currentBusinessDetail = detail;
  currentState = state;

  if (!initialized) return;

  // Status text and state label always display the true business state immediately
  stateLabel.textContent = state;
  stateLabel.hidden = !shouldShowStateLabel(state);
  if (stateGem) {
    stateGem.hidden = !shouldShowStateGem();
  }
  updateStateGemTipText(state, detail);

  // Bubble policy can be off, alerts-only, or legacy all-states. A bounded
  // expression bubble survives ordinary status updates and is restored to the
  // latest business detail only when its own timer completes.
  const preserveExpressionBubble = (typeof PetEvents !== 'undefined' && PetEvents.shouldPreserveReactionPresentation)
    ? PetEvents.shouldPreserveReactionPresentation(!!activeExpressionBubble, state)
    : (!!activeExpressionBubble && !interruptReaction);
  if (preserveExpressionBubble) {
    container.dataset.bubbleVisible = 'true';
    bubble.classList.remove('hidden');
  } else if (!shouldShowBubble(state)) {
    container.dataset.bubbleVisible = 'false';
    clearTimeout(bubbleTimeout);
    bubble.classList.add('hidden');
  } else if (detail && state !== 'offline') {
    container.dataset.bubbleVisible = 'true';
    if (statusText.textContent !== detail) {
      bubble.style.transition = 'none';
      bubble.style.transform = 'scale(0.95)';
      setTimeout(() => {
        bubble.style.transition = 'opacity 0.3s ease, transform 0.15s ease';
        bubble.style.transform = 'scale(1)';
      }, 50);
    }
    setBubbleText(detail);
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    if (state === 'idle') {
      bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
    }
  } else if (state === 'offline' && shouldShowBubble(state)) {
    container.dataset.bubbleVisible = 'true';
    setBubbleText(detail || 'Zzz...');
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
  } else {
    container.dataset.bubbleVisible = 'false';
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
    bubble.classList.add('hidden');
  }

  // Reset / reschedule auto-return timer on status update
  scheduleAutoReturn(state);

  // Priority handling:
  // 1. Alert states (error, waiting) IMMEDIATELY interrupt everything and jump directly to alert loop
  if (ALERT_STATES.has(state)) {
    cancelActiveOneShot();
    clearTimeout(idleVariationTimer);
    idleVariationTimer = null;
    startStateLoop(state);
    return;
  }

  // Ordinary state changes update the true business state but do not pre-empt
  // a bounded reaction animation. Return to whichever state is newest when it
  // completes.
  if (activeOneShot && activeOneShot.type === 'reaction') {
    activeOneShot.targetState = state;
    return;
  }

  // Restore the same business loop when an interrupt cancelled a reaction or
  // drag; otherwise the normal state-change handling below applies.
  if ((reactionWasActive || interruptDrag) && !stateChanged && visualState === state) {
    startStateLoop(state);
    return;
  }

  // 2. State transition / loop
  if (stateChanged || visualState !== state) {
    const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
    const trans = getTransitionConfig(cfg, visualState, state);
    if (trans) {
      playTransition(visualState, state, trans);
    } else {
      cancelActiveOneShot();
      startStateLoop(state);
    }
  }
}

// ── Menu ──

function refreshAppearancePresentation() {
  applyAppearanceResolution(true);
  if (initialized) updateStatus(latestStatus || { state: currentBusinessState, detail: currentBusinessDetail }, false, true);
  buildMenu();
}

function addMenuItem(parent, text, onclick, cls) {
  const el = document.createElement('div');
  el.className = 'menu-item' + (cls ? ' ' + cls : '');
  el.textContent = text;
  el.onclick = (e) => { e.stopPropagation(); onclick(); };
  parent.appendChild(el);
}

function addDivider(parent) {
  const d = document.createElement('div');
  d.className = 'menu-divider';
  parent.appendChild(d);
}

function addColorRow(parent, label, currentVal, defaultVal, onchange, allowTransparent) {
  const row = document.createElement('div');
  row.className = 'menu-config-row';
  const lbl = document.createElement('span');
  lbl.className = 'menu-config-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'menu-color-input';
  input.value = (currentVal && currentVal !== 'transparent') ? currentVal : defaultVal;
  input.oninput = (e) => onchange(e.target.value);
  const reset = document.createElement('span');
  reset.className = 'menu-reset';
  reset.textContent = 'x';
  reset.title = 'Reset to default';
  reset.onclick = () => { input.value = defaultVal; onchange(''); };
  row.appendChild(lbl);
  row.appendChild(input);
  if (allowTransparent) {
    const tp = document.createElement('span');
    tp.className = 'menu-reset';
    tp.textContent = '◻';
    tp.title = 'Transparent';
    tp.onclick = () => onchange('transparent');
    row.appendChild(tp);
  }
  row.appendChild(reset);
  parent.appendChild(row);
}

function addSliderRow(parent, label, currentVal, min, max, step, onchange, unit) {
  const row = document.createElement('div');
  row.className = 'menu-config-row';
  const lbl = document.createElement('span');
  lbl.className = 'menu-config-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'menu-slider-input';
  input.min = min; input.max = max; input.step = step;
  input.value = currentVal;
  const fmt = (v) => unit === 'px' ? Math.round(v) + 'px' : Math.round(v * 100) + '%';
  const valLabel = document.createElement('span');
  valLabel.className = 'menu-config-value';
  valLabel.textContent = fmt(currentVal);
  input.oninput = (e) => {
    const v = parseFloat(e.target.value);
    valLabel.textContent = fmt(v);
    onchange(v);
  };
  row.appendChild(lbl);
  row.appendChild(input);
  row.appendChild(valLabel);
  parent.appendChild(row);
}

function addChoiceRow(parent, label, value, choices, onchange) {
  const row = document.createElement('label');
  row.className = 'menu-config-row';
  const lbl = document.createElement('span');
  lbl.className = 'menu-config-label';
  lbl.textContent = label;
  const select = document.createElement('select');
  select.className = 'menu-select-input';
  for (const [optionValue, optionLabel] of choices) {
    const option = document.createElement('option');
    option.value = optionValue; option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.appendChild(option);
  }
  select.onchange = () => onchange(select.value);
  row.append(lbl, select);
  parent.appendChild(row);
}

function showTransientBubble(msg, durationMs = 4000) {
  clearTimeout(bubbleTimeout);
  activeExpressionBubble = null;
  setBubbleText(msg);
  container.dataset.bubbleVisible = 'true';
  bubble.classList.remove('hidden');
  bubbleTimeout = setTimeout(() => {
    bubbleTimeout = null;
    const state = currentBusinessState;
    const detail = currentBusinessDetail;
    if (shouldShowBubble(state) && (detail || state === 'offline')) {
      setBubbleText(detail || 'Zzz...');
      bubble.classList.remove('hidden');
      container.dataset.bubbleVisible = 'true';
    } else {
      bubble.classList.add('hidden');
      container.dataset.bubbleVisible = 'false';
    }
  }, durationMs);
}

function buildMenu() {
  charMenu.innerHTML = '';
  if (menuPage === 'message') { buildMessagePage(); return; }
  if (menuPage === 'config') { buildConfigPage(); return; }
  if (menuPage === 'ascii') { buildAsciiPage(); return; }
  if (menuPage === 'dlc') { buildDlcPage(); return; }

  // Message session (only when boundSessionId exists)
  if (boundSessionId) {
    addMenuItem(charMenu, 'Message session…', () => { menuPage = 'message'; buildMenu(); });
    addDivider(charMenu);
  }

  if (teamBadge && !teamBadge.hidden) {
    for (const [label, end] of [['Gather Team in activity area', false], ['End gathering (stay here)', true]]) {
      addMenuItem(charMenu, label, async () => {
        closeMenu();
        try {
          await syncGatheringInteraction(false);
          const message = await window.__TAURI__.core.invoke('request_gathering', { end });
          showTransientBubble(message);
        } catch (error) { showTransientBubble(String(error)); }
      });
    }
    addDivider(charMenu);
  }

  // Bundled: Ferris
  addMenuItem(charMenu, 'Ferris (SVG)', () => selectChar('ferris'), mode === 'ferris' ? 'active' : '');
  addDivider(charMenu);

  // ASCII Buddies → submenu
  const asciiActive = Object.keys(ASCII_SPECIES).includes(mode);
  addMenuItem(charMenu, 'ASCII Buddies ' + (asciiActive ? '(' + ASCII_SPECIES[mode].name + ')' : '') + ' ▸', () => { menuPage = 'ascii'; buildMenu(); }, asciiActive ? 'active' : '');
  addDivider(charMenu);

  // DLC characters → submenu
  if (availableDlcs.length > 0) {
    const dlcActive = availableDlcs.some(d => mode === d.id);
    const activeName = dlcActive ? availableDlcs.find(d => mode === d.id).name : '';
    addMenuItem(charMenu, 'DLC ' + (dlcActive ? '(' + activeName + ')' : '') + ' ▸', () => { menuPage = 'dlc'; buildMenu(); }, dlcActive ? 'active' : '');
  }

  // Custom character packs
  if (customPacks.length > 0) {
    addDivider(charMenu);
    const customLabel = document.createElement('div');
    customLabel.className = 'menu-section-label';
    customLabel.textContent = 'Custom';
    charMenu.appendChild(customLabel);
    for (const pack of customPacks) {
      const available = knownCharacter(pack.id);
      const label = (pack.name || pack.id) + (available ? '' : ' (unavailable — Ferris fallback)');
      addMenuItem(charMenu, label, () => selectChar(pack.id), mode === pack.id ? 'active' : '');
    }
  }

  addDivider(charMenu);
  addMenuItem(charMenu, 'Settings...', () => { menuPage = 'config'; buildMenu(); });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Close', () => closeMenu());
  addMenuItem(charMenu, 'Exit', () => {
    closeMenu();
    if (window.__TAURI__) window.__TAURI__.window.getCurrentWindow().close();
  }, 'menu-item-danger');

  const verLabel = document.createElement('div');
  verLabel.className = 'menu-version';
  verLabel.textContent = 'v' + appVersion;
  charMenu.appendChild(verLabel);

  if (boundSessionId) {
    const sidLabel = document.createElement('div');
    sidLabel.className = 'menu-version';
    sidLabel.textContent = boundSessionId.length > 12
      ? boundSessionId.slice(0, 12) + '…'
      : boundSessionId;
    sidLabel.title = boundSessionId;
    charMenu.appendChild(sidLabel);
  }
}

function buildMessagePage() {
  addMenuItem(charMenu, '← Back', () => {
    menuPage = 'main';
    buildMenu();
  });
  addDivider(charMenu);

  const msgContainer = document.createElement('div');
  msgContainer.className = 'menu-message-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'menu-message-textarea';
  textarea.maxLength = 2000;
  textarea.placeholder = 'Message session…';
  textarea.spellcheck = false;

  const errorEl = document.createElement('div');
  errorEl.className = 'menu-message-error';
  errorEl.style.display = 'none';

  const buttonsRow = document.createElement('div');
  buttonsRow.className = 'menu-message-buttons';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'menu-message-btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = (e) => {
    e.stopPropagation();
    menuPage = 'main';
    buildMenu();
  };

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'menu-message-btn menu-message-btn-primary';
  sendBtn.textContent = 'Send';

  const requestIdTracker = (typeof PetEvents !== 'undefined' && PetEvents.createRequestIdTracker)
    ? PetEvents.createRequestIdTracker()
    : null;

  async function handleSend() {
    const rawText = textarea.value;
    if (typeof PetEvents !== 'undefined' && PetEvents.validateUserMessageText) {
      const validation = PetEvents.validateUserMessageText(rawText);
      if (!validation.ok) {
        if (!rawText.trim()) {
          textarea.focus();
          return;
        }
        errorEl.textContent = validation.reason;
        errorEl.style.display = 'block';
        return;
      }
    } else {
      const text = rawText.trim();
      if (!text) {
        textarea.focus();
        return;
      }
      if (rawText.length > 2000) {
        errorEl.textContent = 'Message text must not exceed 2000 characters';
        errorEl.style.display = 'block';
        return;
      }
    }

    sendBtn.disabled = true;
    backBtn.disabled = true;
    textarea.disabled = true;
    sendBtn.textContent = 'Sending…';
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    const sendGeneration = ++currentSendGeneration;
    if (receiptPoller) {
      receiptPoller.stop();
    }

    const requestId = requestIdTracker
      ? requestIdTracker.getRequestId(rawText)
      : ((typeof PetEvents !== 'undefined' && PetEvents.generateRequestId)
          ? PetEvents.generateRequestId()
          : `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);

    try {
      if (!window.__TAURI__) {
        throw new Error('Tauri environment unavailable');
      }

      const res = await window.__TAURI__.core.invoke('send_session_message', {
        text: rawText,
        requestId,
      });

      if (res && (res.status === 'queued' || res.status === 'dispatched')) {
        if (requestIdTracker) {
          requestIdTracker.reset();
        }
        closeMenu();
        if (res.status === 'dispatched') {
          showTransientBubble('Message dispatched');
        } else {
          showTransientBubble('Message queued');
          if (receiptPoller) {
            receiptPoller.start({ requestId, generation: sendGeneration });
          }
        }
      } else {
        const errMsg = (res && (res.reason || res.error || res.status)) || 'Failed to send message';
        errorEl.textContent = String(errMsg);
        errorEl.style.display = 'block';
        sendBtn.disabled = false;
        backBtn.disabled = false;
        textarea.disabled = false;
        sendBtn.textContent = 'Send';
        textarea.focus();
      }
    } catch (err) {
      const errMsg = typeof err === 'string' ? err : (err && err.message ? err.message : String(err));
      errorEl.textContent = String(errMsg);
      errorEl.style.display = 'block';
      sendBtn.disabled = false;
      backBtn.disabled = false;
      textarea.disabled = false;
      sendBtn.textContent = 'Send';
      textarea.focus();
    }
  }

  sendBtn.onclick = (e) => {
    e.stopPropagation();
    handleSend();
  };

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      handleSend();
    }
  });

  textarea.addEventListener('click', (e) => e.stopPropagation());
  textarea.addEventListener('mousedown', (e) => e.stopPropagation());

  buttonsRow.appendChild(backBtn);
  buttonsRow.appendChild(sendBtn);

  msgContainer.appendChild(textarea);
  msgContainer.appendChild(errorEl);
  msgContainer.appendChild(buttonsRow);

  charMenu.appendChild(msgContainer);

  setTimeout(() => textarea.focus(), 20);
}

function buildAsciiPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  for (const [key, species] of Object.entries(ASCII_SPECIES)) {
    addMenuItem(charMenu, species.name, () => { selectChar(key); menuPage = 'main'; }, mode === key ? 'active' : '');
  }
}

function buildConfigPage() {
  const appearance = activeAppearance();
  const ctx = appearanceContext;
  const canBindStack = !!(ctx && ctx.stackKey && appearancePrefs?.safeScope(ctx.stackKey) && (ctx.stackKey.startsWith('global:') || ctx.projectKey));
  const canBindProfile = !!(ctx && ctx.profileKey && appearancePrefs?.safeScope(ctx.profileKey) && (ctx.profileKey.startsWith('global:') || ctx.projectKey));
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addMenuItem(charMenu, `Appearance source: ${appearanceSourceLabel()}`, () => {}, 'menu-section-label');
  addMenuItem(charMenu, 'Follow binding / clear session override', () => { if (appearancePrefs) appearancePrefs.clearSession(boundSessionId); refreshAppearancePresentation(); }, !boundSessionId ? 'disabled' : '');
  addMenuItem(charMenu, 'Set current as new-session default', () => { if (appearancePrefs) appearancePrefs.setGlobal(mode); buildMenu(); });
  if (canBindProfile) {
    addMenuItem(charMenu, `Bind Profile to ${mode}`, () => { appearancePrefs.bind('profile', ctx.profileKey, mode, ctx.projectKey); refreshAppearancePresentation(); });
    addMenuItem(charMenu, 'Unbind current Profile', () => { appearancePrefs.unbind('profile', ctx.profileKey, ctx.projectKey); refreshAppearancePresentation(); });
  }
  if (canBindStack) {
    addMenuItem(charMenu, `Bind Stack to ${mode}`, () => { appearancePrefs.bind('stack', ctx.stackKey, mode, ctx.projectKey); refreshAppearancePresentation(); });
    addMenuItem(charMenu, 'Unbind current Stack', () => { appearancePrefs.unbind('stack', ctx.stackKey, ctx.projectKey); refreshAppearancePresentation(); });
  }
  addDivider(charMenu);
  addDivider(charMenu);
  addMenuItem(charMenu, 'Desktop activity area…', async () => {
    closeMenu();
    try {
      await window.__TAURI__.core.invoke('open_activity_area');
    } catch (error) {
      showTransientBubble(String(error));
    }
  });
  addDivider(charMenu);
  addChoiceRow(charMenu, 'Motion', appearance.motion, [['intrinsic', 'Intrinsic'], ['subtle', 'Subtle'], ['full', 'Full']], (v) => setAppearance('motion', v));
  addChoiceRow(charMenu, 'UI', appearance.uiPreset, [['minimal', 'Minimal'], ['classic', 'Classic'], ['debug', 'Debug']], (v) => setAppearance('uiPreset', v));
  addSliderRow(charMenu, 'Art size', appearance.artScale, 0.7, 1.5, 0.05, (v) => setAppearance('artScale', v), '%');
  addChoiceRow(charMenu, 'Bubble', appearance.bubble, [['off', 'Off'], ['alerts', 'Alerts'], ['all', 'All']], (v) => setAppearance('bubble', v));
  addChoiceRow(charMenu, 'State', appearance.stateLabel, [['off', 'Off'], ['minimal', 'Minimal'], ['alerts', 'Alerts'], ['always', 'Always']], (v) => setAppearance('stateLabel', v));
  addChoiceRow(charMenu, 'Identity', appearance.identity, [['hidden', 'Hidden'], ['hover', 'Hover'], ['always', 'Always']], (v) => { identityPinned = false; rendererStorage.removeItem('petIdentityPinned'); setAppearance('identity', v); });
  if (sessionNameEl.textContent) addMenuItem(charMenu, identityPinned ? 'Unpin identity' : 'Pin identity', () => { identityPinned = !identityPinned; rendererStorage.setItem('petIdentityPinned', String(identityPinned)); applyConfig(); buildConfigPage(); });
  addDivider(charMenu);
  addSliderRow(charMenu, 'Scale', appearance.petScale, 1, 2, 0.1, (v) => setAppearance('petScale', v), '%');
  addColorRow(charMenu, 'Text', petTextColor, '#ffffff', (v) => { petTextColor = v; saveConfig('petTextColor', v); });
  addColorRow(charMenu, 'Label', petSessionBg, '#e06c3c', (v) => { petSessionBg = v; saveConfig('petSessionBg', v); }, true);
  addColorRow(charMenu, 'ASCII Fill', petFillColor, '#ffffff', (v) => { petFillColor = v; saveConfig('petFillColor', v); });
  addColorRow(charMenu, 'Background', petBgColor, '#ffffff', (v) => { petBgColor = v; saveConfig('petBgColor', v); });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Update Assets', async () => {
    closeMenu();
    stateLabel.textContent = 'downloading';
    updateStateGemTipText('downloading', 'Updating assets...');
    setVisualAnimation('thinking');
    setBubbleText('Updating assets...');
    bubble.classList.remove('hidden');
    try {
      await window.__TAURI__.core.invoke('update_assets');
      // Refresh DLC list after update
      try {
        const listedDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
        availableDlcs = Array.isArray(listedDlcs) ? listedDlcs.filter(d => d && typeof d === 'object' && typeof d.id === 'string') : [];
        for (const dlc of availableDlcs) {
          dlcInstalledCache[dlc.id] = dlc.installed;
        }
      } catch(e) {}
      setBubbleText('Assets updated!');
      setVisualAnimation('idle');
      stateLabel.textContent = 'idle';
      updateStateGemTipText('idle', 'Assets updated!');
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    } catch(e) {
      setBubbleText('Update failed: ' + (e || 'unknown error'));
      setVisualAnimation('error');
      stateLabel.textContent = 'error';
      updateStateGemTipText('error', String(e || 'unknown error'));
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => {
        bubble.classList.add('hidden');
        setVisualAnimation('idle');
        stateLabel.textContent = 'idle';
        updateStateGemTipText('idle', '');
      }, 8000);
    }
  });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Reset Default', () => {
    petScale = 1; petTextColor = ''; petSessionBg = ''; petFillColor = ''; petBgColor = '';
    identityPinned = false; clearAppearanceOverrides(); rendererStorage.removeItem('petIdentityPinned');
    rendererStorage.removeItem('petTextColor');
    rendererStorage.removeItem('petSessionBg'); rendererStorage.removeItem('petFillColor');
    rendererStorage.removeItem('petBgColor');
    applyConfig();
    buildConfigPage();
  }, 'menu-item-danger');
}

function buildDlcPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  for (const dlc of availableDlcs) {
    const installed = isDlcInstalled(dlc.id);
    const cls = mode === dlc.id ? 'active' : '';
    if (installed) {
      addMenuItem(charMenu, dlc.name, () => { selectChar(dlc.id); menuPage = 'main'; }, cls);
    } else {
      addMenuItem(charMenu, dlc.name + ' ↓', () => { downloadAndSelectDlc(dlc.id); menuPage = 'main'; }, cls);
    }
  }
}

function isDlcInstalled(dlcName) {
  // Check synchronously from cache first
  if (dlcInstalledCache[dlcName] !== undefined) return dlcInstalledCache[dlcName];
  return false;
}

async function downloadAndSelectDlc(dlcName) {
  if (!window.__TAURI__) return;
  closeMenu();

  // Show downloading state with animation
  stateLabel.textContent = 'downloading';
  updateStateGemTipText('downloading', dlcName);
  setVisualAnimation('thinking');
  setBubbleText('Downloading ' + dlcName + '...');
  bubble.classList.remove('hidden');

  try {
    await window.__TAURI__.core.invoke('download_dlc', { dlcName });
    dlcInstalledCache[dlcName] = true;
    // Re-check assets dir (download_dlc may have created it)
    try { hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir')); } catch(e) {}
    // Load character.json for the newly downloaded DLC
    try {
      const jsonStr = await window.__TAURI__.core.invoke('load_text_asset', { path: dlcName + '/character.json' });
      if (jsonStr) {
        const config = JSON.parse(jsonStr);
        registerCharacterConfig(dlcName, config);
      }
    } catch(e) {}
    await selectChar(dlcName);
  } catch (e) {
    setBubbleText('Download failed: ' + (e || 'unknown error'));
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    setVisualAnimation('error');
    stateLabel.textContent = 'error';
  }
}

function knownCharacter(id) {
  // A retained descriptor is not availability. Only a validated config (or a
  // built-in ASCII species) can be rendered.
  return id === 'ferris' || Object.prototype.hasOwnProperty.call(GIF_MODES, id)
    || Object.prototype.hasOwnProperty.call(ASCII_SPECIES, id);
}

function applyAppearanceResolution(resetAnimation = true) {
  const requested = appearancePrefs ? appearancePrefs.resolve(boundSessionId, appearanceContext) : appearanceResolution;
  const wanted = requested.character;
  const nextMode = knownCharacter(wanted) ? wanted : 'ferris';
  const actual = appearancePrefs && nextMode !== wanted
    ? appearancePrefs.resolveCharacter(boundSessionId, appearanceContext, nextMode, (CHARACTER_CONFIGS[nextMode] || {}).appearance)
    : (appearancePrefs ? appearancePrefs.resolve(boundSessionId, appearanceContext, (CHARACTER_CONFIGS[nextMode] || {}).appearance) : requested);
  appearanceResolution = { ...actual, requestedCharacter: wanted, fallbackCharacter: nextMode !== wanted };
  const changed = nextMode !== mode;
  if (changed) {
    mode = nextMode;
    cachedDragReactionMode = null;
    cachedDragReactionPath = null;
    activeCharacterConfig = CHARACTER_CONFIGS[mode] || null;
  }
  // Cosmetic context revisions must not cancel reactions, pending loads, or
  // restart the current animation when the resolved character is unchanged.
  if (changed) {
    invalidatePresentation();
    visualState = '';
  }
  applyConfig();
  return changed;
}

async function selectChar(newMode) {
  if (!appearancePrefs || appearancePrefs.safeId(newMode)) {
    if (appearancePrefs && boundSessionId) appearancePrefs.setSessionCharacter(boundSessionId, newMode);
  }
  // Keep the requested ID persisted even when its descriptor is broken, but
  // render the validated actual mode immediately.
  if (appearancePrefs && boundSessionId) applyAppearanceResolution(true);
  else mode = knownCharacter(newMode) ? newMode : 'ferris';
  cachedDragReactionMode = null;
  cachedDragReactionPath = null;
  activeCharacterConfig = CHARACTER_CONFIGS[mode] || null;
  closeMenu();
  currentImgSrc = '';

  cancelActiveOneShot();
  clearTimeout(autoReturnTimer);
  autoReturnTimer = null;
  clearTimeout(idleVariationTimer);
  idleVariationTimer = null;
  // Force a re-render: the business state likely did not change, and
  // updateStatus only starts the loop when visualState differs.
  visualState = '';

  // Show the character immediately with whatever is available
  updateStatus({ state: currentBusinessState, detail: statusText.textContent });

  // Preload remaining assets in the background
  if (GIF_MODES[mode] && hasExternalAssets) {
    const generation = bindGeneration;
    preloadAssets().catch(() => {}).then(() => { if (generation !== bindGeneration) return; });
  }
}

function openMenu() {
  menuPage = 'main';
  buildMenu();
  charMenu.classList.remove('hidden');
  menuBackdrop.classList.remove('hidden');
  syncGatheringInteraction().catch(() => {});
}

function closeMenu() {
  charMenu.classList.add('hidden');
  menuBackdrop.classList.add('hidden');
  syncGatheringInteraction().catch(() => {});
}

// Right-click to toggle menu
container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  charMenu.classList.contains('hidden') ? openMenu() : closeMenu();
});

// Close menu on backdrop click, right-click, or window blur
menuBackdrop.addEventListener('click', closeMenu);
menuBackdrop.addEventListener('contextmenu', (e) => { e.preventDefault(); closeMenu(); });
window.addEventListener('blur', closeMenu);

// Bubble and state label remain simple drag handles. The character art waits
// for real pointer movement before native dragging so clicks and double-clicks
// remain observable in WebView2.
for (const el of [bubble, stateLabel]) {
  el.addEventListener('mousedown', startDrag);
}

// Character-art gestures distinguish a click from a drag before native Tauri
// takes mouse capture. This is required on Windows, where startDragging() on
// mousedown suppresses the later click/dblclick and pointer movement events.
if (teamBadge) {
  teamBadge.addEventListener('pointerdown', (event) => event.stopPropagation());
  teamBadge.addEventListener('mousedown', (event) => event.stopPropagation());
  teamBadge.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTeamBoard();
  });
}

artStage.addEventListener('pointerdown', beginPetPointer);
artStage.addEventListener('mousedown', beginPetPointer);
window.addEventListener('pointermove', markPetPointerMoved);
window.addEventListener('mousemove', markPetPointerMoved);
window.addEventListener('pointerup', endPetPointer);
window.addEventListener('mouseup', endPetPointer);
window.addEventListener('pointercancel', handlePetCaptureLoss);
window.addEventListener('blur', handlePetCaptureLoss);
artStage.addEventListener('dblclick', handlePetDoubleClick);
if (window.__TAURI__?.window) {
  window.__TAURI__.window.getCurrentWindow().onMoved(noteNativeWindowMoved).catch((error) => {
    console.error('Failed to observe native pet dragging:', error);
  });
}

// State gem hover interaction
if (stateGem && stateGemTip) {
  stateGem.addEventListener('mouseenter', () => {
    stateGemTip.classList.remove('hidden');
  });
  stateGem.addEventListener('mouseleave', () => {
    stateGemTip.classList.add('hidden');
  });
}

// ── Session picker ──
async function showSessionPicker() {
  if (sessionPoll) { clearInterval(sessionPoll); sessionPoll = null; }
  const sessions = await window.__TAURI__.core.invoke('list_unlocked_sessions');
  if (sessions.length === 0) {
    setBubbleText('No session found. Please restart your AI assistant.');
    bubble.classList.remove('hidden');
    stateLabel.textContent = 'waiting';
    updateStateGemTipText('waiting', 'No session found');
    sessionPoll = setInterval(async () => {
      const s = await window.__TAURI__.core.invoke('list_unlocked_sessions');
      if (s.length > 0) { clearInterval(sessionPoll); sessionPoll = null; showSessionPicker(); }
    }, 2000);
    return;
  }
  // Auto-bind to the most recently updated session; random if tied
  const maxMod = Math.max(...sessions.map(s => s.last_modified));
  const newest = sessions.filter(s => s.last_modified === maxMod);
  const pick = newest[Math.floor(Math.random() * newest.length)];
  await bindToSession(pick.session_id);
}

async function bindToSession(sessionId) {
  const generation = ++bindGeneration;
  if (!appearancePrefs?.safeId(sessionId)) return;
  try {
    await window.__TAURI__.core.invoke('bind_session', { sessionId });
    if (generation !== bindGeneration) return;
    boundSessionId = sessionId;
    ephemeralAppearanceOverrides = {};
    // Leaving a session does not retire its still-live Forge publisher.
    appearanceContext = null; forgeInstanceId = null; forgeRevision = -1;
    invalidatePresentation();
    visualState = '';
    applyAppearanceResolution(true);
    // The new watcher's initial event can arrive before bind_session resolves.
    // Query after binding rather than replaying the previous session's status.
    const statusVersion = statusUpdateVersion;
    const boundStatus = await window.__TAURI__.core.invoke('get_status');
    if (generation !== bindGeneration) return;
    if (boundStatus && statusVersion === statusUpdateVersion) updateStatus(boundStatus, false, true);
    charMenu.classList.add('hidden');
    menuBackdrop.classList.add('hidden');
  } catch (e) {
    setBubbleText('Bind failed: ' + e);
    bubble.classList.remove('hidden');
  }
}

// ── Listen for status updates ──
if (window.__TAURI__) {
  window.__TAURI__.event.listen('status-update', (e) => updateStatus(e.payload, true));
  window.__TAURI__.event.listen('reaction-event', (e) => handleReactionEvent(e.payload));
  window.__TAURI__.event.listen('pet-event', (e) => handlePetEvent(e.payload));
  window.__TAURI__.core.invoke('get_session_id').then((sid) => {
    if (sid) {
      if (!boundSessionId || boundSessionId !== sid) {
        boundSessionId = sid;
        applyAppearanceResolution(false);
      } else {
        applyAppearanceResolution(false);
      }
    } else {
      // No explicit session — show session picker
      showSessionPicker();
    }
  });
  window.__TAURI__.core.invoke('get_status').then((s) => { if (s) updateStatus(s, true); });
  window.__TAURI__.core.invoke('get_event').then((e) => { if (e) handlePetEvent(e); });
} else {
  // Browser demo mode: demo cycle showcasing transitions and state loops
  const demos = [
    { state: 'idle', detail: 'Waiting for prompt...' },
    { state: 'editing', detail: 'Editing src/app.js' },
    { state: 'searching', detail: 'Searching codebase...' },
    { state: 'running', detail: 'Running tests...' },
    { state: 'idle', detail: 'Task completed!' },
    { state: 'thinking', detail: 'Thinking deeply...' },
    { state: 'waiting', detail: 'Awaiting user confirmation' },
    { state: 'error', detail: 'Error encountered!' },
    { state: 'offline', detail: 'Session ended' },
  ];
  let i = 0;
  setInterval(() => updateStatus(demos[i++ % demos.length], true), 4000);
}

// ── Asset loading ──
let hasExternalAssets = false;
const assetCache = {};

async function initAssets() {
  if (window.__TAURI__) {
    try {
      hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir'));
    } catch(e) {}

    // Auto-download assets if the directory doesn't exist yet
    if (hasExternalAssets) {
      const assetsDir = await window.__TAURI__.core.invoke('get_assets_dir');
      // Check if the dlc/ subdirectory exists by trying to list DLCs
      const listedDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
      const dlcs = Array.isArray(listedDlcs) ? listedDlcs : [];
      if (dlcs.length === 0) {
        // Assets dir exists but has no DLC configs — need to download
        stateLabel.textContent = 'downloading';
        updateStateGemTipText('downloading', 'Downloading assets...');
        setVisualAnimation('thinking');
        setBubbleText('Downloading assets...');
        bubble.classList.remove('hidden');
        try {
          await window.__TAURI__.core.invoke('update_assets');
          setBubbleText('Assets ready!');
          updateStateGemTipText('idle', 'Assets ready!');
          clearTimeout(bubbleTimeout);
          bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 3000);
        } catch(e) {
          setBubbleText('Assets download failed: ' + (e || 'unknown error'));
          setVisualAnimation('error');
          stateLabel.textContent = 'error';
          updateStateGemTipText('error', String(e || 'unknown error'));
          clearTimeout(bubbleTimeout);
          bubbleTimeout = setTimeout(() => {
            bubble.classList.add('hidden');
            setVisualAnimation('idle');
            stateLabel.textContent = 'idle';
            updateStateGemTipText('idle', '');
          }, 8000);
        }
      }
    }
  }
}

async function loadAsset(path) {
  if (!hasExternalAssets || !window.__TAURI__) return path;
  if (assetCache[path]) return assetCache[path];
  try {
    // load_asset checks assets/ then characters/ dirs
    const dataUrl = await window.__TAURI__.core.invoke('load_asset', { path });
    if (dataUrl) { assetCache[path] = dataUrl; return dataUrl; }
  } catch(e) {}
  try {
    const dataUrl = await window.__TAURI__.core.invoke('load_custom_asset', { path });
    if (dataUrl) { assetCache[path] = dataUrl; return dataUrl; }
  } catch(e) {}
  return path;
}

function assetUrl(path) {
  return assetCache[path] || path;
}

// Preload only the active mode's assets (including transitions and variations)
async function preloadAssets() {
  const preloadMode = mode;
  let paths = [];
  let dragCandidates = [];
  if (GIF_MODES[mode]) {
    for (const gifs of Object.values(GIF_MODES[mode])) for (const g of gifs) paths.push(g);
  } else if (mode === 'ferris') {
    for (const svgs of Object.values(FERRIS_SVG_MAP)) for (const s of svgs) paths.push(s);
  }
  const cfg = activeCharacterConfig || CHARACTER_CONFIGS[mode];
  if (cfg) {
    if (cfg.transitions && typeof cfg.transitions === 'object') {
      for (const t of Object.values(cfg.transitions)) {
        if (typeof t === 'string') paths.push(t);
        else if (Array.isArray(t)) for (const f of t) if (typeof f === 'string') paths.push(f);
        else if (typeof t === 'object' && t !== null) {
          if (typeof t.frames === 'string') paths.push(t.frames);
          else if (Array.isArray(t.frames)) for (const f of t.frames) if (typeof f === 'string') paths.push(f);
        }
      }
    }
    const variations = getIdleVariations(cfg);
    for (const v of variations) {
      for (const f of v.frames) paths.push(f);
    }
    if (cfg.reactions && typeof cfg.reactions === 'object') {
      for (const reaction of Object.values(cfg.reactions)) {
        const frames = Array.isArray(reaction) ? reaction : [reaction];
        for (const frame of frames) if (typeof frame === 'string') paths.push(frame);
      }
    }
    // A custom pack may rely entirely on the documented naming convention
    // instead of declaring reactions. Preload drag candidates so the image can
    // switch before native Windows dragging takes mouse capture.
    if (typeof PetEvents !== 'undefined' && PetEvents.getReactionAssetCandidates) {
      dragCandidates = PetEvents.getReactionAssetCandidates(cfg, mode, 'drag');
      paths.push(...dragCandidates);
    }
  }
  await Promise.all([...new Set(paths.filter(Boolean))].map(p => loadAsset(p)));
  let verifiedDragPath = null;
  for (const candidate of dragCandidates) {
    if (!assetCache[candidate]) continue;
    if (await verifyImageAsset(candidate)) {
      verifiedDragPath = candidate;
      break;
    }
  }
  if (mode === preloadMode) {
    cachedDragReactionMode = preloadMode;
    cachedDragReactionPath = verifiedDragPath;
  }
}

// ── Init ──
(async () => {
  await initAssets();

  // Get app version
  if (window.__TAURI__) {
    try { appVersion = await window.__TAURI__.app.getVersion(); } catch(e) {}
  }

  // Load Ferris character.json (bundled with frontend)
  try {
    const resp = await fetch('ferris/character.json');
    if (resp.ok) {
      const config = await resp.json();
      FERRIS_SVG_MAP = config.states;
      if (!window.__TAURI__ && (!config.transitions || Object.keys(config.transitions).length === 0)) {
        config.transitions = {
          'idle->editing': { frames: ['ferris/14.svg'], duration_ms: 1000 },
          'editing->searching': { frames: ['ferris/10.svg'], duration_ms: 1000 },
          'searching->running': { frames: ['ferris/3.svg'], duration_ms: 1000 },
          'running->idle': { frames: ['ferris/15.svg'], duration_ms: 1000 },
        };
        config.idle_variations = {
          idle: ['ferris/2.svg', 'ferris/15.svg'],
        };
      }
      registerCharacterConfig('ferris', config);
      CHARACTER_CONFIGS.ferris = config;
    }
  } catch(e) {}

  // Discover DLC and custom characters
  if (window.__TAURI__) {
    // Load available DLCs from dlc/*.json configs
    try {
      const listedDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
      availableDlcs = Array.isArray(listedDlcs) ? listedDlcs.filter(d => d && typeof d === 'object' && typeof d.id === 'string') : [];
      for (const dlc of availableDlcs) {
        dlcInstalledCache[dlc.id] = dlc.installed;
        if (dlc.installed) {
          try {
            const jsonStr = await window.__TAURI__.core.invoke('load_text_asset', { path: dlc.id + '/character.json' });
            if (jsonStr) {
              registerCharacterConfig(dlc.id, JSON.parse(jsonStr));
            }
          } catch(e) {}
        }
      }
    } catch(e) {}

    // Custom character packs
    if (hasExternalAssets) {
      try {
        const packs = await window.__TAURI__.core.invoke('list_character_packs');
        customPacks = Array.isArray(packs) ? packs.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && appearancePrefs?.safeId(p.id) && p.group === 'custom' && p.installed) : [];
        for (const pack of customPacks) {
          try {
            const jsonStr = await window.__TAURI__.core.invoke('load_text_asset', { path: pack.id + '/character.json' });
            if (jsonStr) {
              registerCharacterConfig(pack.id, JSON.parse(jsonStr));
            }
          } catch(e) {}
        }
      } catch(e) {}
    }
  }

  // If current mode is a DLC that's not installed, auto-download it
  const isDlcMode = availableDlcs.some(d => d.id === mode);
  if (isDlcMode && !dlcInstalledCache[mode] && window.__TAURI__) {
    setBubbleText('Downloading ' + mode + '...');
    bubble.classList.remove('hidden');
    try {
      await window.__TAURI__.core.invoke('download_dlc', { dlcName: mode });
      dlcInstalledCache[mode] = true;
      // Re-check assets dir (download_dlc may have created it)
      try { hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir')); } catch(e) {}
      const jsonStr = await window.__TAURI__.core.invoke('load_text_asset', { path: mode + '/character.json' });
      if (jsonStr) {
        registerCharacterConfig(mode, JSON.parse(jsonStr));
      } else {
        throw new Error('character.json not found after download');
      }
    } catch(e) {
      setBubbleText('Download failed, using Ferris');
      mode = 'ferris';
    }
  }

  // Fallback: if mode is not a recognized character, reset to ferris
  const knownMode = mode === 'ferris' || GIF_MODES[mode] || ASCII_SPECIES[mode] || customPacks.some(p => p.id === mode);
  if (!knownMode) {
    mode = 'ferris';
  }
  // Re-resolve after packs/DLCs are known. An unavailable mapped pack falls
  // back visually but the stored mapping is deliberately retained.
  applyAppearanceResolution(false);

  // If current mode has external assets, preload it
  if (GIF_MODES[mode] && hasExternalAssets) {
    await preloadAssets();
  }

  initialized = true;
  activeCharacterConfig = CHARACTER_CONFIGS[mode] || null;
  applyConfig();
  visualState = '';
  // A status watcher can resolve while pack discovery is still async. Preserve
  // that real state rather than flashing/locking the renderer to idle.
  updateStatus(latestStatus || { state: 'idle', detail: '' });
})();
