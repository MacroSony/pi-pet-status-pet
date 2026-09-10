// Claude Status Pet — supports SVG, GIF, and ASCII art characters

const bubble = document.getElementById('speech-bubble');
const statusText = document.getElementById('status-text');
const stateGem = document.getElementById('state-gem');
const stateGemTip = document.getElementById('state-gem-tip');
const stateLabel = document.getElementById('state-label');
const sessionNameEl = document.getElementById('session-name');
const container = document.getElementById('pet-container');
const artStage = document.getElementById('art-stage');
const imgWrapper = document.getElementById('ferris-wrapper');
const imgEl = document.getElementById('ferris-img');
const asciiPre = document.getElementById('ascii-art');
const charMenu = document.getElementById('char-menu');
const menuBackdrop = document.getElementById('menu-backdrop');

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
  bubble: 'all', stateLabel: 'always', identity: 'always', poke: 'on',
});
const APPEARANCE_VALUES = Object.freeze({
  motion: ['intrinsic', 'subtle', 'full'],
  uiPreset: ['minimal', 'classic', 'debug'],
  artScale: null,
  bubble: ['off', 'alerts', 'all'],
  stateLabel: ['off', 'minimal', 'alerts', 'always'],
  identity: ['hidden', 'hover', 'always'],
  poke: ['on', 'off'],
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
let mode = localStorage.getItem('petMode') || 'ferris';
let eye = localStorage.getItem('petEye') || '·';
let petColor = localStorage.getItem('petColor') || '';
let petBgColor = localStorage.getItem('petBgColor') || '';
let petFillColor = localStorage.getItem('petFillColor') || '';
let petTextColor = localStorage.getItem('petTextColor') || '';
let petSessionBg = localStorage.getItem('petSessionBg') || '';
let petFontSize = parseInt(localStorage.getItem('petFontSize') || '16');
let petScale = parseFloat(localStorage.getItem('petScale') || '1');
let currentBusinessState = 'idle';
// Empty string (not 'idle') so the first updateStatus always renders —
// otherwise the initial idle update is seen as "no change" and the
// default <img> from index.html (ferris/1.svg) is never replaced.
let visualState = '';
let currentState = 'idle';
let activeCharacterConfig = null;
let latestStatus = null;
let initialized = false;
let identityPinned = localStorage.getItem('petIdentityPinned') === 'true';
let currentImgSrc = '';
let bubbleTimeout = null;
let asciiFrame = 0;
let asciiInterval = null;
let menuPage = 'main';
let appVersion = '0.0.0';
let customPacks = [];
let availableDlcs = [];  // [{id, name, installed}] from dlc/*.json
let boundSessionId = '';
let sessionPoll = null;
const dlcInstalledCache = {};

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

const POKE_COOLDOWN_MS = 4000;
const POKE_HOVER_MS = 3000;
const POKE_CLICK_HOLD_MS = 300;
const POKE_CLICK_DISTANCE = 5;
let pokeCooldownUntil = 0;
let pokeHoverTimer = null;
let pokeHoverTriggered = false;
let pokePointer = null;
let dragSession = null;
let pokeClickAllowed = false;
let pokeGestureInvalid = false;
let pokeClickTimer = null;
let lastPokeDoubleClickAt = -Infinity;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startDrag() {
  if (window.__TAURI__) window.__TAURI__.window.getCurrentWindow().startDragging();
}

function registerCharacterConfig(id, config) {
  if (!config || !config.states || typeof config.states !== 'object') return;
  CHARACTER_CONFIGS[id] = config;
  GIF_MODES[id] = config.states;
}

function activeAppearance() {
  const suggested = (activeCharacterConfig && activeCharacterConfig.appearance) || {};
  const result = {};
  for (const [key, fallback] of Object.entries(DEFAULT_APPEARANCE)) {
    const saved = localStorage.getItem(`petAppearance.${key}`);
    let value = saved === null ? suggested[key] : saved;
    if (key === 'artScale') {
      value = Number(value);
      result[key] = Number.isFinite(value) && value >= 0.7 && value <= 1.5 ? value : fallback;
    } else {
      result[key] = APPEARANCE_VALUES[key].includes(value) ? value : fallback;
    }
  }
  return result;
}

function setAppearance(key, value) {
  localStorage.setItem(`petAppearance.${key}`, String(value));
  applyConfig();
}

function clearAppearanceOverrides() {
  for (const key of Object.keys(DEFAULT_APPEARANCE)) localStorage.removeItem(`petAppearance.${key}`);
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
  stateGemTip.textContent = tipDetail ? `${state}: ${tipDetail}` : state;
}

// ── Apply visual config ──
function applyConfig() {
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
  const appearance = activeAppearance();
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
  const currentDetail = (latestStatus && latestStatus.detail) || (statusText ? statusText.textContent : '');
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
  localStorage.setItem(key, value);
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

function setImage(src) {
  const resolved = assetUrl(src);
  if (resolved === currentImgSrc) return;
  // If asset not yet cached, try loading it on-demand (fixes race with preload)
  if (resolved === src && hasExternalAssets && window.__TAURI__) {
    imgEl.style.opacity = '0';
    loadAsset(src).then(url => {
      if (url !== src) setImage(src); // retry with cached version
      else {
        // External load failed (e.g. bundled ferris SVGs) — show the
        // original path directly rather than leaving the img invisible.
        currentImgSrc = src;
        imgEl.src = src;
        imgEl.style.opacity = '1';
      }
    });
    return;
  }
  imgEl.style.opacity = '0';
  setTimeout(() => {
    imgEl.src = resolved;
    imgEl.style.opacity = '1';
  }, 150);
  currentImgSrc = resolved;
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
    statusText.textContent = 'Image not found: ' + name;
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

async function verifyImageAsset(path) {
  if (!path) return null;
  try {
    const resolved = await loadAsset(path);
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
    const url = await verifyImageAsset(f);
    if (!url) {
      // Missing asset: silent fallback to normal loop with ~150ms fade
      startStateLoop(toState);
      return;
    }
    verifiedUrls.push(url);
  }

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
    setImage(frames[0]);
    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot) {
        activeOneShot = null;
        startStateLoop(toState);
      }
    }, duration);
    timerIds.push(endTimer);
  } else {
    const frameTime = Math.max(50, Math.floor(duration / verifiedUrls.length));
    setImage(frames[0]);
    for (let idx = 1; idx < verifiedUrls.length; idx++) {
      const ft = setTimeout(() => {
        if (activeOneShot === oneShot) {
          imgEl.src = verifiedUrls[idx];
          currentImgSrc = verifiedUrls[idx];
          imgEl.style.opacity = '1';
        }
      }, idx * frameTime);
      timerIds.push(ft);
    }

    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot) {
        activeOneShot = null;
        startStateLoop(toState);
      }
    }, duration);
    timerIds.push(endTimer);
  }
}

async function playIdleVariation(variationConfig) {
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
    const url = await verifyImageAsset(f);
    if (!url) {
      // Missing asset: silently skip this variation
      scheduleNextIdleVariation();
      return;
    }
    verifiedUrls.push(url);
  }

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
    setImage(frames[0]);
    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot) {
        activeOneShot = null;
        startStateLoop('idle');
      }
    }, duration);
    timerIds.push(endTimer);
  } else {
    const frameTime = Math.max(50, Math.floor(duration / verifiedUrls.length));
    setImage(frames[0]);
    for (let idx = 1; idx < verifiedUrls.length; idx++) {
      const ft = setTimeout(() => {
        if (activeOneShot === oneShot) {
          imgEl.src = verifiedUrls[idx];
          currentImgSrc = verifiedUrls[idx];
          imgEl.style.opacity = '1';
        }
      }, idx * frameTime);
      timerIds.push(ft);
    }

    const endTimer = setTimeout(() => {
      if (activeOneShot === oneShot) {
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

async function playExpression(event) {
  if (ALERT_STATES.has(currentBusinessState) || dragSession) return;
  const requestVersion = ++reactionRequestVersion;
  const statusVersion = statusUpdateVersion;

  const payload = (event && event.payload) || {};
  const text = typeof payload.text === 'string' && payload.text.trim().length > 0 ? payload.text : null;
  const emotion = typeof payload.emotion === 'string' && payload.emotion ? payload.emotion : null;
  const durationMs = (typeof payload.durationMs === 'number' && payload.durationMs > 0) ? payload.durationMs : 2500;

  // 1. Text display in speech bubble (Hard Rule: text shows even if emotion asset is missing)
  if (text) {
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;

    statusText.textContent = text;
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
      bubbleTimeout = null;
      if (statusUpdateVersion !== statusVersion) return;
      // Restore business bubble display according to current status & policy
      const state = currentBusinessState;
      const detail = latestStatus ? latestStatus.detail : '';
      if (shouldShowBubble(state) && (detail || state === 'offline')) {
        statusText.textContent = detail || (state === 'offline' ? 'Zzz...' : '');
        bubble.classList.remove('hidden');
        container.dataset.bubbleVisible = 'true';
      } else {
        bubble.classList.add('hidden');
        container.dataset.bubbleVisible = shouldShowBubble(state) ? 'true' : 'false';
      }
    }, durationMs);
  }

  // 2. Emotion reaction animation
  if (emotion) {
    const extensions = ['webp', 'gif', 'svg'];
    let reactionPath = null;

    // Try convention-based reaction sprite files in order; missing assets are optional.
    for (const extension of extensions) {
      const candidate = `${mode}/reaction_${emotion}.${extension}`;
      const url = await verifyImageAsset(candidate);
      if (requestVersion !== reactionRequestVersion || statusVersion !== statusUpdateVersion) return;
      if (url) {
        reactionPath = candidate;
        break;
      }
    }

    if (!reactionPath || ALERT_STATES.has(currentBusinessState) || dragSession) {
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
      if (activeOneShot === oneShot) {
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

// Poke reactions use the same reaction asset lookup and REACTION one-shot slot
// as file-backed reaction events. The cooldown is for local user interaction
// only; external reaction events retain their existing behavior.
function triggerPoke(emotion) {
  const now = Date.now();
  if (activeAppearance().poke !== 'on' || ALERT_STATES.has(currentBusinessState)) return false;
  if (now < pokeCooldownUntil) return false;

  pokeCooldownUntil = now + POKE_COOLDOWN_MS;
  playExpression({
    schemaVersion: '1',
    eventId: `poke_${now}`,
    petId: boundSessionId,
    kind: 'expression',
    payload: {
      emotion,
      durationMs: 2500,
    },
    createdAtMs: now,
    expiresAtMs: now + 2500,
  });
  return true;
}

function isPokeTarget(target) {
  if (!target || !artStage.contains(target)) return false;
  return !target.closest('#state-gem, #speech-bubble, #char-menu, #menu-backdrop, #session-name');
}

function markPokePointerMoved(event) {
  if (!pokePointer) return;
  const dx = event.clientX - pokePointer.x;
  const dy = event.clientY - pokePointer.y;
  if (Math.hypot(dx, dy) > POKE_CLICK_DISTANCE) {
    pokePointer.moved = true;
    maybeStartPokeDrag();
  }
}

async function beginPokeDrag(pointer, session) {
  const extensions = ['webp', 'gif', 'svg'];
  let reactionPath = null;

  for (const extension of extensions) {
    const candidate = `${mode}/reaction_drag.${extension}`;
    const url = await verifyImageAsset(candidate);
    if (dragSession !== session || statusUpdateVersion !== session.statusVersion
      || ALERT_STATES.has(currentBusinessState)) return;
    if (url) {
      reactionPath = candidate;
      break;
    }
  }

  // Drag reactions are optional. Keep the animation that was already playing
  // when no drag asset exists.
  if (!reactionPath || dragSession !== session) {
    if (dragSession === session) dragSession = null;
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

function maybeStartPokeDrag() {
  const pointer = pokePointer;
  if (!pointer || pointer.dragStarted || !pointer.moved || !pointer.held) return;
  if (ALERT_STATES.has(currentBusinessState)) return;

  pointer.dragStarted = true;
  const session = {
    targetState: currentBusinessState,
    statusVersion: statusUpdateVersion,
    active: false,
    oneShot: null,
  };
  pointer.dragSession = session;
  dragSession = session;
  // Invalidate any reaction lookup already in flight. The existing reaction
  // remains visible until the optional drag asset has been verified.
  reactionRequestVersion++;
  beginPokeDrag(pointer, session);
}

function cancelPokeDrag() {
  const session = dragSession;
  dragSession = null;
  if (session) session.active = false;
  if (activeOneShot && activeOneShot.type === 'drag') cancelActiveOneShot();
}

function finishPokeDrag(session) {
  if (!session || dragSession !== session) return;
  dragSession = null;
  const wasActive = session.active && activeOneShot === session.oneShot;
  session.active = false;
  if (wasActive) {
    cancelActiveOneShot();
    if (!ALERT_STATES.has(currentBusinessState)) startStateLoop(currentBusinessState);
  }
}

function beginPokePointer(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (!isPokeTarget(event.target) || pokePointer) return;

  const startedAt = Date.now();
  pokePointer = {
    x: event.clientX,
    y: event.clientY,
    startedAt,
    moved: false,
    holdTimer: setTimeout(() => {
      if (pokePointer && pokePointer.startedAt === startedAt) {
        pokePointer.held = true;
        maybeStartPokeDrag();
      }
    }, POKE_CLICK_HOLD_MS),
  };
  pokeClickAllowed = false;
  pokeGestureInvalid = false;
}

function endPokePointer(event) {
  if (!pokePointer) return;
  markPokePointerMoved(event);
  const pointer = pokePointer;
  clearTimeout(pointer.holdTimer);
  finishPokeDrag(pointer.dragSession);
  pokePointer = null;
  // Releasing outside the art stage is not a click, even if the pointer did
  // not move far enough to be classified as a drag.
  pokeClickAllowed = isPokeTarget(event.target)
    && !pointer.moved
    && !pointer.held
    && Date.now() - pointer.startedAt <= POKE_CLICK_HOLD_MS;
  pokeGestureInvalid = !pokeClickAllowed;
}

function cancelPokePointer() {
  if (pokePointer) {
    clearTimeout(pokePointer.holdTimer);
    finishPokeDrag(pokePointer.dragSession);
  }
  cancelPokeDrag();
  pokePointer = null;
  pokeClickAllowed = false;
  pokeGestureInvalid = true;
}

function handlePokeClick(event) {
  if (!isPokeTarget(event.target) || !pokeClickAllowed) return;
  pokeClickAllowed = false;

  if (event.detail >= 2) {
    clearTimeout(pokeClickTimer);
    pokeClickTimer = null;
    lastPokeDoubleClickAt = Date.now();
    triggerPoke('shy');
    return;
  }

  // Delay the single-click action long enough for a second click to identify
  // a double click. The second click (detail >= 2) cancels this timer.
  clearTimeout(pokeClickTimer);
  pokeClickTimer = setTimeout(() => {
    pokeClickTimer = null;
    triggerPoke('happy');
  }, 400);
}

function handlePokeDoubleClick(event) {
  if (!isPokeTarget(event.target)) return;
  // A drag must not be promoted to a double click by a browser/event source.
  if (pokeGestureInvalid) {
    pokeGestureInvalid = false;
    return;
  }
  // Chromium normally reports detail=2 on the second click before dblclick;
  // avoid playing shy twice while retaining support for a direct dblclick.
  if (Date.now() - lastPokeDoubleClickAt < 1000) return;
  clearTimeout(pokeClickTimer);
  pokeClickTimer = null;
  lastPokeDoubleClickAt = Date.now();
  triggerPoke('shy');
}

function startPokeHover() {
  clearTimeout(pokeHoverTimer);
  pokeHoverTriggered = false;
  pokeHoverTimer = setTimeout(() => {
    pokeHoverTimer = null;
    if (!pokeHoverTriggered) {
      pokeHoverTriggered = true;
      triggerPoke('shocked');
    }
  }, POKE_HOVER_MS);
}

function stopPokeHover() {
  clearTimeout(pokeHoverTimer);
  pokeHoverTimer = null;
  pokeHoverTriggered = false;
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
          updateStatus({ state: 'offline', detail: 'Zzz... (session silent)' }, false);
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
        updateStatus({ state: 'offline', detail: 'Zzz... (session silent)' }, false);
      }
      return;
    }
  }
}

watchdogTimer = setInterval(checkWatchdog, WATCHDOG_INTERVAL_MS);

// ── Main update ──

function updateStatus(status, isRealEvent = false) {
  if (isRealEvent) {
    lastStatusEventAt = Date.now();
  }
  statusUpdateVersion++;
  // Any business-status event wins over a temporary reaction or drag,
  // including an update that repeats the same state.
  const reactionWasActive = activeOneShot && activeOneShot.type === 'reaction';
  const dragWasActive = !!dragSession || (activeOneShot && activeOneShot.type === 'drag');
  if (dragWasActive) {
    reactionRequestVersion++;
    cancelPokeDrag();
  }
  if (reactionWasActive) {
    reactionRequestVersion++;
    cancelActiveOneShot();
  }
  latestStatus = status;
  const state = status.state || 'idle';
  const detail = status.detail || '';
  const sessionName = status.session_name || '';

  if (state === 'closed' && window.__TAURI__) {
    window.__TAURI__.window.getCurrentWindow().close();
    return;
  }

  if (sessionName) {
    sessionNameEl.textContent = compactSessionName(sessionName);
    sessionNameEl.title = sessionName;
  }

  const previousBusinessState = currentBusinessState;
  const stateChanged = (state !== previousBusinessState);
  currentBusinessState = state;
  currentState = state;

  if (!initialized) return;

  // Status text and state label always display the true business state immediately
  stateLabel.textContent = state;
  stateLabel.hidden = !shouldShowStateLabel(state);
  if (stateGem) {
    stateGem.hidden = !shouldShowStateGem();
  }
  updateStateGemTipText(state, detail);

  // Bubble policy can be off, alerts-only, or legacy all-states.
  container.dataset.bubbleVisible = (shouldShowBubble(state) && (!!detail || state === 'offline')) ? 'true' : 'false';
  if (!shouldShowBubble(state)) {
    clearTimeout(bubbleTimeout);
    bubble.classList.add('hidden');
  } else if (detail && state !== 'offline') {
    if (statusText.textContent !== detail) {
      bubble.style.transition = 'none';
      bubble.style.transform = 'scale(0.95)';
      setTimeout(() => {
        bubble.style.transition = 'opacity 0.3s ease, transform 0.15s ease';
        bubble.style.transform = 'scale(1)';
      }, 50);
    }
    statusText.textContent = detail;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    if (state === 'idle') {
      bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
    }
  } else if (state === 'offline' && shouldShowBubble(state)) {
    statusText.textContent = detail || 'Zzz...';
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
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

  // Restore the same business loop when a same-state update interrupts a
  // reaction; otherwise the normal state-change handling below applies.
  if ((reactionWasActive || dragWasActive) && !stateChanged && visualState === state) {
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

function buildMenu() {
  charMenu.innerHTML = '';
  if (menuPage === 'config') { buildConfigPage(); return; }
  if (menuPage === 'ascii') { buildAsciiPage(); return; }
  if (menuPage === 'dlc') { buildDlcPage(); return; }

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
      addMenuItem(charMenu, pack.name, () => selectChar(pack.id), mode === pack.id ? 'active' : '');
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

function buildAsciiPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  for (const [key, species] of Object.entries(ASCII_SPECIES)) {
    addMenuItem(charMenu, species.name, () => { selectChar(key); menuPage = 'main'; }, mode === key ? 'active' : '');
  }
}

function buildConfigPage() {
  const appearance = activeAppearance();
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  addChoiceRow(charMenu, 'Motion', appearance.motion, [['intrinsic', 'Intrinsic'], ['subtle', 'Subtle'], ['full', 'Full']], (v) => setAppearance('motion', v));
  addChoiceRow(charMenu, 'UI', appearance.uiPreset, [['minimal', 'Minimal'], ['classic', 'Classic'], ['debug', 'Debug']], (v) => setAppearance('uiPreset', v));
  addSliderRow(charMenu, 'Art size', appearance.artScale, 0.7, 1.5, 0.05, (v) => setAppearance('artScale', v), '%');
  addChoiceRow(charMenu, 'Bubble', appearance.bubble, [['off', 'Off'], ['alerts', 'Alerts'], ['all', 'All']], (v) => setAppearance('bubble', v));
  addChoiceRow(charMenu, 'State', appearance.stateLabel, [['off', 'Off'], ['minimal', 'Minimal'], ['alerts', 'Alerts'], ['always', 'Always']], (v) => setAppearance('stateLabel', v));
  addChoiceRow(charMenu, 'Identity', appearance.identity, [['hidden', 'Hidden'], ['hover', 'Hover'], ['always', 'Always']], (v) => { identityPinned = false; localStorage.removeItem('petIdentityPinned'); setAppearance('identity', v); });
  addChoiceRow(charMenu, 'Poke', appearance.poke, [['on', 'On'], ['off', 'Off']], (v) => setAppearance('poke', v));
  if (sessionNameEl.textContent) addMenuItem(charMenu, identityPinned ? 'Unpin identity' : 'Pin identity', () => { identityPinned = !identityPinned; localStorage.setItem('petIdentityPinned', String(identityPinned)); applyConfig(); buildConfigPage(); });
  addDivider(charMenu);
  addSliderRow(charMenu, 'Scale', petScale, 1, 2, 0.1, (v) => { petScale = v; saveConfig('petScale', String(v)); }, '%');
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
    statusText.textContent = 'Updating assets...';
    bubble.classList.remove('hidden');
    try {
      await window.__TAURI__.core.invoke('update_assets');
      // Refresh DLC list after update
      try {
        availableDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
        for (const dlc of availableDlcs) {
          dlcInstalledCache[dlc.id] = dlc.installed;
        }
      } catch(e) {}
      statusText.textContent = 'Assets updated!';
      setVisualAnimation('idle');
      stateLabel.textContent = 'idle';
      updateStateGemTipText('idle', 'Assets updated!');
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    } catch(e) {
      statusText.textContent = 'Update failed: ' + (e || 'unknown error');
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
    identityPinned = false; clearAppearanceOverrides(); localStorage.removeItem('petIdentityPinned');
    localStorage.removeItem('petScale'); localStorage.removeItem('petTextColor');
    localStorage.removeItem('petSessionBg'); localStorage.removeItem('petFillColor');
    localStorage.removeItem('petBgColor');
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
  statusText.textContent = 'Downloading ' + dlcName + '...';
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
    statusText.textContent = 'Download failed: ' + (e || 'unknown error');
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    setVisualAnimation('error');
    stateLabel.textContent = 'error';
  }
}

async function selectChar(newMode) {
  mode = newMode;
  activeCharacterConfig = CHARACTER_CONFIGS[mode] || null;
  localStorage.setItem('petMode', mode);
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
    preloadAssets();
  }
}

function openMenu() {
  menuPage = 'main';
  buildMenu();
  charMenu.classList.remove('hidden');
  menuBackdrop.classList.remove('hidden');
}

function closeMenu() {
  charMenu.classList.add('hidden');
  menuBackdrop.classList.add('hidden');
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

// Drag — single handler for all draggable elements
for (const el of [imgWrapper, asciiPre, bubble, stateLabel]) {
  el.addEventListener('mousedown', startDrag);
}

// Poke tracking deliberately lives beside (rather than inside) the drag
// handler. Native Tauri dragging still starts on mousedown, while the
// movement/hold record decides whether the resulting mouseup is a click.
artStage.addEventListener('pointerdown', beginPokePointer);
artStage.addEventListener('mousedown', beginPokePointer);
window.addEventListener('pointermove', markPokePointerMoved);
window.addEventListener('mousemove', markPokePointerMoved);
window.addEventListener('pointerup', endPokePointer);
window.addEventListener('mouseup', endPokePointer);
window.addEventListener('pointercancel', cancelPokePointer);
window.addEventListener('blur', cancelPokePointer);
artStage.addEventListener('click', handlePokeClick);
artStage.addEventListener('dblclick', handlePokeDoubleClick);
artStage.addEventListener('mouseenter', startPokeHover);
artStage.addEventListener('mouseleave', stopPokeHover);

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
    statusText.textContent = 'No session found. Please restart your AI assistant.';
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
  try {
    await window.__TAURI__.core.invoke('bind_session', { sessionId });
    boundSessionId = sessionId;
    charMenu.classList.add('hidden');
    menuBackdrop.classList.add('hidden');
  } catch (e) {
    statusText.textContent = 'Bind failed: ' + e;
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
      boundSessionId = sid;
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
      const dlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
      if (dlcs.length === 0) {
        // Assets dir exists but has no DLC configs — need to download
        stateLabel.textContent = 'downloading';
        updateStateGemTipText('downloading', 'Downloading assets...');
        setVisualAnimation('thinking');
        statusText.textContent = 'Downloading assets...';
        bubble.classList.remove('hidden');
        try {
          await window.__TAURI__.core.invoke('update_assets');
          statusText.textContent = 'Assets ready!';
          updateStateGemTipText('idle', 'Assets ready!');
          clearTimeout(bubbleTimeout);
          bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 3000);
        } catch(e) {
          statusText.textContent = 'Assets download failed: ' + (e || 'unknown error');
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
  let paths = [];
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
  }
  await Promise.all([...new Set(paths.filter(Boolean))].map(p => loadAsset(p)));
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
      availableDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
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
        customPacks = packs.filter(p => p.group === 'custom' && p.installed);
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
    statusText.textContent = 'Downloading ' + mode + '...';
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
      statusText.textContent = 'Download failed, using Ferris';
      mode = 'ferris';
      localStorage.setItem('petMode', mode);
    }
  }

  // Fallback: if mode is not a recognized character, reset to ferris
  const knownMode = mode === 'ferris' || GIF_MODES[mode] || ASCII_SPECIES[mode] || customPacks.some(p => p.id === mode);
  if (!knownMode) {
    mode = 'ferris';
    localStorage.setItem('petMode', mode);
  }

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
