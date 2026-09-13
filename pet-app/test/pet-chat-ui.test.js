'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  renderChatMessages,
  handleSendMessage,
  handleClearChat,
  setPending,
  showError,
  validateMessageText,
  generateSafeRequestId,
  isSafeRequestId,
  setupChatEvents,
  fetchAndRenderHistory,
  startChatPolling,
  initializePetChat,
  initOnDomReady,
  DEFAULT_POLL_INTERVAL_MS,
  countCodePoints,
  MAX_MESSAGE_LENGTH,
} = require('../src/chat.js');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.className = '';
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.listeners = {};
    this.scrollTop = 0;
    this.scrollHeight = 100;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  set innerHTML(_value) { throw new Error('innerHTML must never be used'); }
  addEventListener(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }
  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    for (const listener of list) {
      listener(event);
    }
  }
  focus() { this.focused = true; }
}

function makeChatDocument() {
  const ids = [
    'chat-title', 'clear-button', 'messages-container',
    'chat-empty', 'chat-messages', 'chat-pending',
    'chat-error', 'chat-textarea', 'send-button',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const shell = new FakeElement('shell');
  return {
    elements,
    shell,
    readyState: 'complete',
    getElementById(id) { return elements[id] || null; },
    querySelector(selector) { return selector === '.chat-shell' ? shell : null; },
    createElement() { return new FakeElement(); },
  };
}

test('renders user and assistant messages strictly as plain text via textContent', () => {
  const doc = makeChatDocument();
  const payload = {
    sessionName: 'must-not-be-rendered',
    messages: [
      { role: 'user', text: '<script>alert("pwn")</script> How are you?' },
      { role: 'assistant', text: '<b>I am doing great!</b> <img src=x onerror=alert(1)>' },
    ],
  };

  assert.equal(renderChatMessages(payload, doc), true);
  assert.equal(doc.elements['chat-title'].textContent, '', 'runtime payload cannot replace the generic static title');
  assert.equal(doc.elements['chat-empty'].hidden, true);
  assert.equal(doc.elements['chat-messages'].children.length, 2);

  const userRow = doc.elements['chat-messages'].children[0];
  assert.equal(userRow.className, 'message-row user');
  assert.equal(userRow.children[0].className, 'message-bubble user');
  assert.equal(userRow.children[0].textContent, '<script>alert("pwn")</script> How are you?');

  const assistantRow = doc.elements['chat-messages'].children[1];
  assert.equal(assistantRow.className, 'message-row assistant');
  assert.equal(assistantRow.children[0].className, 'message-bubble assistant');
  assert.equal(assistantRow.children[0].textContent, '<b>I am doing great!</b> <img src=x onerror=alert(1)>');
});

test('handles empty message payload and displays empty state', () => {
  const doc = makeChatDocument();
  renderChatMessages([], doc);
  assert.equal(doc.elements['chat-empty'].hidden, false);
  assert.equal(doc.elements['chat-messages'].children.length, 0);

  renderChatMessages({ messages: [] }, doc);
  assert.equal(doc.elements['chat-empty'].hidden, false);
  assert.equal(doc.elements['chat-messages'].children.length, 0);
});

test('toggles pending state on UI elements correctly', () => {
  const doc = makeChatDocument();
  setPending(true, doc);
  assert.equal(doc.elements['chat-pending'].hidden, false);
  assert.equal(doc.elements['send-button'].disabled, true);
  assert.equal(doc.elements['chat-textarea'].disabled, true);

  setPending(false, doc);
  assert.equal(doc.elements['chat-pending'].hidden, true);
  assert.equal(doc.elements['send-button'].disabled, false);
  assert.equal(doc.elements['chat-textarea'].disabled, false);
});

test('validates message text bounded to 2000 chars and non-whitespace', () => {
  assert.equal(validateMessageText(''), false);
  assert.equal(validateMessageText('   \n\t  '), false);
  assert.equal(validateMessageText(null), false);
  assert.equal(validateMessageText(undefined), false);
  assert.equal(validateMessageText('hello'), true);
  assert.equal(validateMessageText('a'.repeat(2000)), true);
  assert.equal(validateMessageText('a'.repeat(2001)), false);
});

test('generates valid and safe request IDs', () => {
  const id = generateSafeRequestId();
  assert.equal(isSafeRequestId(id), true);
  assert.equal(id.startsWith('req_'), true);
});

test('handleSendMessage sends message via send_session_message and refreshes history', async () => {
  const doc = makeChatDocument();
  doc.elements['chat-textarea'].value = 'Hello pet!';

  let sentPayload = null;
  let chatRequested = false;

  const win = {
    __TAURI__: {
      core: {
        invoke: async (cmd, args) => {
          if (cmd === 'send_session_message') {
            sentPayload = args;
            return { status: 'dispatched' };
          }
          if (cmd === 'get_pet_chat') {
            chatRequested = true;
            return {
              messages: [
                { role: 'user', text: 'Hello pet!' },
                { role: 'assistant', text: 'Woof!' },
              ],
            };
          }
          throw new Error(`Unexpected command: ${cmd}`);
        },
      },
    },
  };

  const success = await handleSendMessage(win, doc);
  assert.equal(success, true);
  assert.equal(sentPayload.text, 'Hello pet!');
  assert.equal(isSafeRequestId(sentPayload.requestId), true);
  assert.equal(chatRequested, true);
  assert.equal(doc.elements['chat-textarea'].value, '');
  assert.equal(doc.elements['chat-pending'].hidden, true);
  assert.equal(doc.elements['chat-messages'].children.length, 2);
});

test('handleSendMessage shows error when backend rejects message', async () => {
  const doc = makeChatDocument();
  doc.elements['chat-textarea'].value = 'Fail message';

  const win = {
    __TAURI__: {
      core: {
        invoke: async (cmd) => {
          if (cmd === 'send_session_message') {
            return { status: 'failed', error: 'Pet session is not bound' };
          }
          throw new Error(`Unexpected command: ${cmd}`);
        },
      },
    },
  };

  const success = await handleSendMessage(win, doc);
  assert.equal(success, false);
  assert.equal(doc.elements['chat-error'].hidden, false);
  assert.equal(doc.elements['chat-error'].textContent, 'Pet session is not bound');
  assert.equal(doc.elements['chat-pending'].hidden, true);
  assert.equal(doc.elements['chat-textarea'].value, 'Fail message');
});

test('handleClearChat invokes clear_pet_chat and empties message UI', async () => {
  const doc = makeChatDocument();
  let clearInvoked = false;

  const win = {
    __TAURI__: {
      core: {
        invoke: async (cmd) => {
          if (cmd === 'clear_pet_chat') {
            clearInvoked = true;
            return { ok: true };
          }
          throw new Error(`Unexpected command: ${cmd}`);
        },
      },
    },
  };

  const success = await handleClearChat(win, doc);
  assert.equal(success, true);
  assert.equal(clearInvoked, true);
  assert.equal(doc.elements['chat-messages'].children.length, 0);
  assert.equal(doc.elements['chat-empty'].hidden, false);
});

test('setupChatEvents binds Enter send and clear click correctly', async () => {
  const doc = makeChatDocument();
  let invokeCalls = [];

  const win = {
    __TAURI__: {
      core: {
        invoke: async (cmd, args) => {
          invokeCalls.push({ cmd, args });
          if (cmd === 'send_session_message') return { status: 'queued' };
          if (cmd === 'get_pet_chat') return { messages: [] };
          if (cmd === 'clear_pet_chat') return { ok: true };
        },
      },
    },
  };

  setupChatEvents(win, doc);

  // Trigger Enter on textarea
  doc.elements['chat-textarea'].value = 'Test enter';
  let defaultPrevented = false;
  doc.elements['chat-textarea'].dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    preventDefault: () => { defaultPrevented = true; },
  });

  assert.equal(defaultPrevented, true);

  // Shift+Enter should NOT trigger send
  defaultPrevented = false;
  doc.elements['chat-textarea'].dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    shiftKey: true,
    isComposing: false,
    preventDefault: () => { defaultPrevented = true; },
  });
  assert.equal(defaultPrevented, false);

  // Trigger clear click
  doc.elements['clear-button'].onclick();
  assert.ok(invokeCalls.some((c) => c.cmd === 'clear_pet_chat'));
});

test('initializes chat immediately when DOM readyState is interactive or complete', async () => {
  const doc = makeChatDocument();
  doc.readyState = 'complete';

  let initialFetch = false;
  const win = {
    addEventListener: () => { throw new Error('should not add listener when already complete'); },
    setInterval: () => 123,
    __TAURI__: {
      core: {
        invoke: async (cmd) => {
          if (cmd === 'get_pet_chat') {
            initialFetch = true;
            return { messages: [] };
          }
          return null;
        },
      },
    },
  };

  initOnDomReady(win, doc);
  assert.equal(initialFetch, true);
});

test('waits for DOMContentLoaded when DOM readyState is loading', async () => {
  const doc = makeChatDocument();
  doc.readyState = 'loading';

  let registeredEvent = null;
  let registeredListener = null;
  const win = {
    addEventListener: (event, listener) => {
      registeredEvent = event;
      registeredListener = listener;
    },
    setInterval: () => 123,
    __TAURI__: {
      core: {
        invoke: async () => ({ messages: [] }),
      },
    },
  };

  initOnDomReady(win, doc);
  assert.equal(registeredEvent, 'DOMContentLoaded');
  assert.equal(typeof registeredListener, 'function');
});

test('chat source code contains zero innerHTML usage and safe isolation contracts', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/chat.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../src/chat.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  // Ensure no inline script tags in HTML (only external src="chat.js")
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);
  assert.match(html, /<script src="chat\.js"><\/script>/);

  // App.js opens pet chat on double-click.
  assert.match(app, /open_pet_chat/);
  assert.match(app, /openPetChat\(\)/);

  // Verify no sensitive token leak keywords in chat.js
  for (const forbidden of ['psh_', 'rawSessionId', 'capabilityToken']) {
    assert.doesNotMatch(js, new RegExp(forbidden));
  }
});

test('character art waits for movement before handing capture to native dragging', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  // Immediate native mousedown dragging is retained only for non-poke handles.
  assert.match(app, /for \(const el of \[bubble, stateLabel\]\)/);
  assert.doesNotMatch(app, /for \(const el of \[imgWrapper, asciiPre, bubble, stateLabel\]\)/);

  // The art gesture crosses a movement threshold, starts the optional reaction,
  // and only then hands capture to Tauri. Unmoved clicks can still become dblclick.
  assert.match(app, /if \(!pointer \|\| pointer\.dragStarted \|\| !pointer\.moved\) return;/);
  assert.match(app, /beginPokeDrag\(pointer, session\);[\s\S]{0,500}startDragging\(\)/);
  assert.match(app, /addEventListener\('dblclick', handlePokeDoubleClick\)/);
  assert.match(app, /onMoved\(noteNativeWindowMoved\)/);
  assert.match(app, /scheduleNativeDragFinish\(pointer\.dragSession\)/);
});

test('coordinator envelope projection renders server pending state and messages', () => {
  const doc = makeChatDocument();
  const envelope = {
    revision: 10,
    messages: [
      { role: 'user', text: 'What is the plan?', createdAtMs: 1000 },
      { role: 'assistant', text: 'Working on it!', createdAtMs: 2000 },
    ],
    pending: true,
  };

  renderChatMessages(envelope, doc);
  assert.equal(doc.elements['chat-pending'].hidden, false);
  assert.equal(doc.elements['send-button'].disabled, true);
  assert.equal(doc.elements['chat-textarea'].disabled, true);
  assert.equal(doc.elements['chat-messages'].children.length, 2);

  // When next envelope arrives with pending: false
  const updatedEnvelope = {
    revision: 11,
    messages: [
      { role: 'user', text: 'What is the plan?', createdAtMs: 1000 },
      { role: 'assistant', text: 'Plan complete!', createdAtMs: 3000 },
    ],
    pending: false,
  };
  renderChatMessages(updatedEnvelope, doc);
  assert.equal(doc.elements['chat-pending'].hidden, true);
  assert.equal(doc.elements['send-button'].disabled, false);
  assert.equal(doc.elements['chat-textarea'].disabled, false);
  assert.equal(doc.elements['chat-messages'].children.length, 2);
  assert.equal(doc.elements['chat-messages'].children[1].children[0].textContent, 'Plan complete!');
});

test('renderChatMessages rejects unknown/invalid roles and retains only user and assistant', () => {
  const doc = makeChatDocument();
  const payload = {
    messages: [
      { role: 'user', text: 'Valid user msg' },
      { role: 'system', text: 'System prompt should be rejected' },
      { role: 'admin', text: 'Admin cmd should be rejected' },
      { role: 'tool', text: 'Tool call should be rejected' },
      { role: '', text: 'Empty role rejected' },
      { role: 'assistant', text: 'Valid assistant msg' },
    ],
  };

  renderChatMessages(payload, doc);
  assert.equal(doc.elements['chat-messages'].children.length, 2);
  assert.equal(doc.elements['chat-messages'].children[0].className, 'message-row user');
  assert.equal(doc.elements['chat-messages'].children[0].children[0].textContent, 'Valid user msg');
  assert.equal(doc.elements['chat-messages'].children[1].className, 'message-row assistant');
  assert.equal(doc.elements['chat-messages'].children[1].children[0].textContent, 'Valid assistant msg');
});

test('validateMessageText counts Unicode code points up to 2000 consistently', () => {
  // 2000 multi-byte emojis (e.g. 🐶)
  const emoji2000 = '🐶'.repeat(2000);
  assert.equal(countCodePoints(emoji2000), 2000);
  assert.equal(validateMessageText(emoji2000), true);

  // 2001 emojis exceeds limit
  const emoji2001 = '🐶'.repeat(2001);
  assert.equal(countCodePoints(emoji2001), 2001);
  assert.equal(validateMessageText(emoji2001), false);
});

test('handleSendMessage rejects permissive non-queued/non-dispatched responses', async () => {
  const doc = makeChatDocument();
  doc.elements['chat-textarea'].value = 'Testing strict response';

  const win = {
    __TAURI__: {
      core: {
        invoke: async (cmd) => {
          if (cmd === 'send_session_message') {
            // Permissive response without queued or dispatched status
            return { ok: true, status: 'completed' };
          }
          throw new Error(`Unexpected command: ${cmd}`);
        },
      },
    },
  };

  const success = await handleSendMessage(win, doc);
  assert.equal(success, false);
  assert.equal(doc.elements['chat-error'].hidden, false);
  assert.equal(doc.elements['chat-error'].textContent, 'completed');
  assert.equal(doc.elements['chat-pending'].hidden, true);
  assert.equal(doc.elements['chat-textarea'].value, 'Testing strict response');
});

test('polling interval defaults to around 750ms', () => {
  assert.ok(DEFAULT_POLL_INTERVAL_MS >= 700 && DEFAULT_POLL_INTERVAL_MS <= 800, 'Polling interval must be around 750ms');

  const doc = makeChatDocument();
  let intervalSet = null;
  const win = {
    setInterval: (cb, ms) => {
      intervalSet = ms;
      return 999;
    },
    __TAURI__: {
      core: {
        invoke: async () => ({ messages: [], pending: false }),
      },
    },
  };

  startChatPolling(win, doc);
  assert.equal(intervalSet, 750);
});
