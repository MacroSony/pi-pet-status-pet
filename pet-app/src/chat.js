'use strict';

const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_POLL_INTERVAL_MS = 750;

function isSafeRequestId(id) {
  return typeof id === 'string'
    && id.length > 0
    && id.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(id);
}

function generateSafeRequestId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${ts}_${rand}`;
}

function countCodePoints(text) {
  if (typeof text !== 'string') return 0;
  return Array.from(text).length;
}

function validateMessageText(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  // Bounded to 2000 Unicode code points
  return countCodePoints(text) <= MAX_MESSAGE_LENGTH;
}

function showError(message, doc = document) {
  const errorEl = doc.getElementById('chat-error');
  if (!errorEl) return;
  if (!message) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  } else {
    errorEl.textContent = typeof message === 'string' ? message : String(message);
    errorEl.hidden = false;
  }
}

function setPending(isPending, doc = document) {
  const pendingEl = doc.getElementById('chat-pending');
  const sendBtn = doc.getElementById('send-button');
  const textarea = doc.getElementById('chat-textarea');
  const container = doc.getElementById('messages-container');

  if (pendingEl) pendingEl.hidden = !isPending;
  if (sendBtn) sendBtn.disabled = !!isPending;
  if (textarea) textarea.disabled = !!isPending;

  if (isPending && container) {
    container.scrollTop = container.scrollHeight;
  }
}

function renderChatMessages(payload, doc = document) {
  const messagesEl = doc.getElementById('chat-messages');
  const emptyEl = doc.getElementById('chat-empty');
  const container = doc.getElementById('messages-container');

  if (payload && typeof payload.pending === 'boolean') {
    setPending(payload.pending, doc);
  }

  const rawMessages = Array.isArray(payload)
    ? payload
    : (payload && Array.isArray(payload.messages) ? payload.messages : []);

  const validMessages = [];
  for (const item of rawMessages) {
    if (!item || typeof item !== 'object') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    const text = typeof item.text === 'string' ? item.text : (typeof item.content === 'string' ? item.content : '');
    const createdAtMs = typeof item.createdAtMs === 'number' ? item.createdAtMs : (typeof item.created_at_ms === 'number' ? item.created_at_ms : 0);
    validMessages.push({ role: item.role, text, id: item.id, createdAtMs });
  }

  if (emptyEl) {
    emptyEl.hidden = validMessages.length > 0;
  }

  if (!messagesEl) return false;

  const rows = [];
  for (const msg of validMessages) {
    const row = doc.createElement('div');
    row.className = `message-row ${msg.role}`;

    const bubble = doc.createElement('div');
    bubble.className = `message-bubble ${msg.role}`;
    // Strict requirement: untrusted user/assistant strings via textContent only, never innerHTML.
    bubble.textContent = msg.text;

    row.append(bubble);
    rows.push(row);
  }

  messagesEl.replaceChildren(...rows);

  if (container) {
    container.scrollTop = container.scrollHeight;
  }
  return true;
}

async function fetchAndRenderHistory(win = window, doc = document) {
  const tauri = win.__TAURI__;
  if (!tauri || !tauri.core || typeof tauri.core.invoke !== 'function') return null;
  try {
    const history = await tauri.core.invoke('get_pet_chat');
    if (history) {
      renderChatMessages(history, doc);
    }
    return history;
  } catch (_e) {
    return null;
  }
}

async function handleSendMessage(win = window, doc = document) {
  const textarea = doc.getElementById('chat-textarea');
  if (!textarea) return false;

  const rawText = textarea.value;
  if (!validateMessageText(rawText)) {
    if (countCodePoints(rawText) > MAX_MESSAGE_LENGTH) {
      showError(`Message exceeds maximum of ${MAX_MESSAGE_LENGTH} characters`, doc);
    }
    return false;
  }

  showError('', doc);
  setPending(true, doc);

  const requestId = generateSafeRequestId();
  const tauri = win.__TAURI__;

  if (!tauri || !tauri.core || typeof tauri.core.invoke !== 'function') {
    showError('Tauri bridge unavailable', doc);
    setPending(false, doc);
    return false;
  }

  try {
    const res = await tauri.core.invoke('send_session_message', {
      text: rawText,
      requestId,
    });

    if (res && (res.status === 'queued' || res.status === 'dispatched')) {
      textarea.value = '';
      const hist = await fetchAndRenderHistory(win, doc);
      if (!hist || typeof hist.pending !== 'boolean') {
        setPending(false, doc);
      }
      textarea.focus();
      return true;
    } else {
      const errMsg = (res && (res.reason || res.error || res.status)) || 'Failed to send message';
      showError(String(errMsg), doc);
      setPending(false, doc);
      textarea.focus();
      return false;
    }
  } catch (err) {
    const errMsg = typeof err === 'string' ? err : (err && err.message ? err.message : String(err));
    showError(errMsg, doc);
    setPending(false, doc);
    textarea.focus();
    return false;
  }
}

async function handleClearChat(win = window, doc = document) {
  showError('', doc);
  const tauri = win.__TAURI__;
  if (!tauri || !tauri.core || typeof tauri.core.invoke !== 'function') {
    setPending(false, doc);
    renderChatMessages([], doc);
    return true;
  }

  try {
    await tauri.core.invoke('clear_pet_chat');
    setPending(false, doc);
    renderChatMessages([], doc);
    return true;
  } catch (err) {
    const errMsg = typeof err === 'string' ? err : (err && err.message ? err.message : String(err));
    showError(errMsg, doc);
    return false;
  }
}

function setupChatEvents(win = window, doc = document) {
  const sendBtn = doc.getElementById('send-button');
  const clearBtn = doc.getElementById('clear-button');
  const closeBtn = doc.getElementById('close-button');
  const textarea = doc.getElementById('chat-textarea');

  if (sendBtn) {
    sendBtn.onclick = () => {
      handleSendMessage(win, doc);
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      handleClearChat(win, doc);
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      const currentWindow = win.__TAURI__?.window?.getCurrentWindow?.();
      if (currentWindow && typeof currentWindow.close === 'function') {
        currentWindow.close();
      }
    };
  }

  if (textarea) {
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        handleSendMessage(win, doc);
      }
    });
  }
}

function startChatPolling(win = window, doc = document, intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  fetchAndRenderHistory(win, doc);
  if (typeof win.setInterval === 'function') {
    return win.setInterval(() => {
      fetchAndRenderHistory(win, doc);
    }, intervalMs);
  }
  return null;
}

async function initializePetChat(win = window, doc = document) {
  setupChatEvents(win, doc);
  await fetchAndRenderHistory(win, doc);
  startChatPolling(win, doc);
  return true;
}

function initOnDomReady(win = window, doc = document) {
  if (!doc) return;
  if (doc.readyState === 'loading') {
    win.addEventListener('DOMContentLoaded', () => {
      initializePetChat(win, doc);
    }, { once: true });
  } else {
    initializePetChat(win, doc);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initOnDomReady(window, document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
