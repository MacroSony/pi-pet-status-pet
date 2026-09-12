// Neutral PetEvent parser and deduplication tracker for Pi Pet Phase B.

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PetEvents = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const VALID_EMOTIONS = Object.freeze(['happy', 'shy', 'shocked', 'sad', 'celebrate']);
  const VALID_EMOTIONS_SET = new Set(VALID_EMOTIONS);
  const DEFAULT_DURATION_MS = 2500;
  const DEFAULT_PRIORITY = 3; // REACTION priority
  const REACTION_INTERRUPT_STATES = Object.freeze(['error', 'waiting', 'offline', 'closed']);
  const REACTION_INTERRUPT_STATE_SET = new Set(REACTION_INTERRUPT_STATES);
  const REACTION_ASSET_EXTENSIONS = Object.freeze(['webp', 'gif', 'svg', 'png']);

  function isReactionInterruptState(state) {
    return typeof state === 'string' && REACTION_INTERRUPT_STATE_SET.has(state);
  }

  function shouldPreserveReactionPresentation(active, nextState) {
    return active === true && !isReactionInterruptState(nextState);
  }

  function isSafeId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('/') && !id.includes('\\') && !id.includes('..');
  }

  function parsePetEvent(raw, nowMs = Date.now()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: 'Event must be a non-null object' };
    }

    const schemaVersion = String(raw.schemaVersion || raw.schema_version || '1');
    if (schemaVersion !== '1') {
      return { ok: false, reason: `Unsupported schemaVersion: ${schemaVersion}` };
    }

    const eventId = raw.eventId || raw.event_id || raw.id;
    if (typeof eventId !== 'string' || !eventId.trim()) {
      return { ok: false, reason: 'eventId is required' };
    }

    const petId = typeof (raw.petId || raw.pet_id) === 'string' ? (raw.petId || raw.pet_id).trim() : '';

    const kind = typeof raw.kind === 'string' ? raw.kind : 'expression';
    if (kind !== 'expression') {
      return { ok: false, reason: `Unsupported kind: ${kind}` };
    }

    const createdAtRaw = raw.createdAtMs !== undefined ? raw.createdAtMs : raw.created_at_ms;
    const createdAtMs = typeof createdAtRaw === 'number' && Number.isFinite(createdAtRaw)
      ? createdAtRaw
      : nowMs;

    const expiresAtRaw = raw.expiresAtMs !== undefined ? raw.expiresAtMs : raw.expires_at_ms;
    const expiresAtMs = typeof expiresAtRaw === 'number' && Number.isFinite(expiresAtRaw)
      ? expiresAtRaw
      : 0;

    if (expiresAtMs > 0 && nowMs > expiresAtMs) {
      return { ok: false, reason: 'Event has expired', expired: true };
    }

    const rawPayload = raw.payload;
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return { ok: false, reason: 'payload must be a non-null object' };
    }

    let text = null;
    if (rawPayload.text !== undefined && rawPayload.text !== null) {
      if (typeof rawPayload.text !== 'string') {
        return { ok: false, reason: 'payload.text must be a string' };
      }
      text = rawPayload.text;
    }

    let emotion = null;
    if (rawPayload.emotion !== undefined && rawPayload.emotion !== null) {
      if (typeof rawPayload.emotion !== 'string' || !VALID_EMOTIONS_SET.has(rawPayload.emotion)) {
        return { ok: false, reason: `Invalid emotion: ${rawPayload.emotion}` };
      }
      emotion = rawPayload.emotion;
    }

    if (text === null && emotion === null) {
      return { ok: false, reason: 'At least one of text or emotion is required' };
    }

    const speak = rawPayload.speak === true;

    const priority = typeof rawPayload.priority === 'number' && Number.isFinite(rawPayload.priority)
      ? rawPayload.priority
      : DEFAULT_PRIORITY;

    const durationRaw = rawPayload.durationMs !== undefined ? rawPayload.durationMs : rawPayload.duration_ms;
    const durationMs = typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0
      ? durationRaw
      : DEFAULT_DURATION_MS;

    return {
      ok: true,
      event: {
        schemaVersion,
        eventId: eventId.trim(),
        petId,
        kind,
        payload: {
          text,
          emotion,
          speak,
          priority,
          durationMs,
        },
        createdAtMs,
        expiresAtMs,
      },
    };
  }

  function parseLegacyReaction(raw, nowMs = Date.now()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: 'Reaction must be a non-null object' };
    }

    const id = raw.id;
    if (typeof id !== 'string' || !id.trim()) {
      return { ok: false, reason: 'id is required' };
    }

    const ts = Number(raw.ts);
    const ttlMs = Number(raw.ttl_ms);
    if (Number.isFinite(ts) && Number.isFinite(ttlMs) && ttlMs > 0) {
      if (nowMs > ts + ttlMs) {
        return { ok: false, reason: 'Reaction has expired', expired: true };
      }
    }

    const emotion = typeof raw.emotion === 'string' && raw.emotion ? raw.emotion : null;
    const message = typeof raw.message === 'string' && raw.message ? raw.message : null;

    if (!emotion && !message) {
      return { ok: false, reason: 'Reaction must have emotion or message' };
    }

    return {
      ok: true,
      event: {
        schemaVersion: '1',
        eventId: id.trim(),
        petId: '',
        kind: 'expression',
        payload: {
          text: message,
          emotion,
          speak: raw.speak === true,
          priority: DEFAULT_PRIORITY,
          durationMs: DEFAULT_DURATION_MS,
        },
        createdAtMs: Number.isFinite(ts) ? ts : nowMs,
        expiresAtMs: Number.isFinite(ts) && Number.isFinite(ttlMs) ? ts + ttlMs : 0,
      },
    };
  }

  function createEventDedupTracker(maxSize = 1000) {
    const seen = new Set();
    const order = [];

    return {
      remember(eventId) {
        if (typeof eventId !== 'string' || !eventId.trim()) return false;
        const normalized = eventId.trim();
        if (seen.has(normalized)) return false;

        seen.add(normalized);
        order.push(normalized);

        if (order.length > maxSize) {
          const oldest = order.shift();
          seen.delete(oldest);
        }
        return true;
      },
      has(eventId) {
        if (typeof eventId !== 'string') return false;
        return seen.has(eventId.trim());
      },
      clear() {
        seen.clear();
        order.length = 0;
      },
      size() {
        return seen.size;
      },
    };
  }

  function isSafeRequestId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id);
  }

  function getReactionAssetCandidates(config, mode, emotion) {
    if (typeof mode !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(mode)) return [];
    if (typeof emotion !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(emotion)) return [];

    const configured = config && config.reactions && typeof config.reactions === 'object'
      ? config.reactions[emotion]
      : null;
    const configuredList = Array.isArray(configured) ? configured : [configured];
    const candidates = configuredList
      .filter(path => typeof path === 'string' && path.length > 0 && path.length <= 512)
      .slice(0, 16);

    for (const extension of REACTION_ASSET_EXTENSIONS) {
      candidates.push(`${mode}/reaction_${emotion}.${extension}`);
    }
    return [...new Set(candidates)];
  }

  function generateRequestId(customCrypto) {
    try {
      const cryptoObj = customCrypto
        || (typeof globalThis !== 'undefined' ? globalThis.crypto : (typeof crypto !== 'undefined' ? crypto : null));
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        const raw = String(cryptoObj.randomUUID());
        const sanitized = raw.replace(/[^A-Za-z0-9_-]/g, '');
        if (sanitized) {
          const candidate = `req_${sanitized}`;
          return candidate.length <= 64 ? candidate : candidate.slice(0, 64);
        }
      }
    } catch (_) {
      // Fall through to fallback generator
    }
    const rand = Math.random().toString(36).slice(2, 10);
    return `req_${Date.now().toString(36)}_${rand}`;
  }

  function validateUserMessageText(text) {
    if (typeof text !== 'string') return { ok: false, reason: 'text must be a string' };
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, reason: 'text cannot be empty' };
    if (text.length > 2000) return { ok: false, reason: 'text must not exceed 2000 characters' };
    return { ok: true, text };
  }

  function createRequestIdTracker(customCrypto) {
    let currentId = null;
    let currentText = null;

    function getRequestId(rawText) {
      if (typeof rawText === 'string' && currentId && currentText === rawText) {
        return currentId;
      }
      currentText = typeof rawText === 'string' ? rawText : null;
      currentId = generateRequestId(customCrypto);
      return currentId;
    }

    function reset() {
      currentId = null;
      currentText = null;
    }

    return { getRequestId, reset };
  }

  function formatReceiptBubble(receipt) {
    if (receipt instanceof Error) {
      return { terminal: false, status: 'error', text: 'Message queued' };
    }
    if (!receipt || typeof receipt !== 'object') {
      return { terminal: true, status: 'failed', text: 'Message failed: invalid receipt' };
    }

    const rawStatus = receipt.status;
    const status = typeof rawStatus === 'string'
      ? rawStatus.trim().toLowerCase()
      : (typeof rawStatus === 'number' ? String(rawStatus) : '');

    const reason = typeof receipt.reason === 'string' ? receipt.reason.trim()
      : (typeof receipt.error === 'string' ? receipt.error.trim() : '');

    if (status === 'dispatched') {
      return { terminal: true, status: 'dispatched', text: 'Message dispatched' };
    }
    if (status === 'queued') {
      return { terminal: false, status: 'queued', text: 'Message queued' };
    }
    if (
      status === 'not_found' ||
      status === 'notfound' ||
      status === 'not-found' ||
      status === '404' ||
      reason.toLowerCase() === 'not_found' ||
      reason.toLowerCase() === 'not found' ||
      reason.toLowerCase() === 'notfound'
    ) {
      return { terminal: false, status: 'not_found', text: 'Message queued' };
    }
    if (status === 'error' || status === 'transient_error' || status === 'transient') {
      return { terminal: false, status: 'error', text: 'Message queued' };
    }
    if (status === 'timeout') {
      return { terminal: true, status: 'timeout', text: 'Message dispatch status unknown' };
    }
    if (status === 'failed') {
      return {
        terminal: true,
        status: 'failed',
        text: reason ? `Message failed: ${reason}` : 'Message failed',
      };
    }
    if (status === 'expired') {
      return {
        terminal: true,
        status: 'expired',
        text: reason ? `Message expired: ${reason}` : 'Message expired',
      };
    }
    if (status === 'rejected') {
      return {
        terminal: true,
        status: 'rejected',
        text: reason ? `Message rejected: ${reason}` : 'Message rejected',
      };
    }

    return {
      terminal: true,
      status: status || 'unknown',
      text: reason ? `Message failed: ${reason}` : (status ? `Message status: ${status}` : 'Message status unknown'),
    };
  }

  function createReceiptPoller(options = {}) {
    const fetchReceipt = options.fetchReceipt;
    const onStatus = options.onStatus;
    const intervalMs = typeof options.intervalMs === 'number' && options.intervalMs > 0 ? options.intervalMs : 500;
    const maxDurationMs = typeof options.maxDurationMs === 'number' && options.maxDurationMs > 0 ? options.maxDurationMs : 125000;
    const timer = options.timer || {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
      now: () => Date.now(),
    };

    let pollerRunId = 0;
    let timerId = null;
    let isStopped = false;

    function stop() {
      isStopped = true;
      pollerRunId++;
      if (timerId !== null) {
        timer.clearTimeout(timerId);
        timerId = null;
      }
    }

    function start(startOptions = {}) {
      stop();
      isStopped = false;

      const currentRunId = pollerRunId;
      const requestId = typeof startOptions === 'string' ? startOptions : startOptions.requestId;
      const generation = typeof startOptions === 'object' && typeof startOptions.generation === 'number'
        ? startOptions.generation
        : currentRunId;

      if (!requestId || typeof requestId !== 'string') {
        return { stop };
      }

      const startTime = timer.now();

      async function tick() {
        if (isStopped || pollerRunId !== currentRunId) {
          return;
        }

        const elapsed = timer.now() - startTime;
        if (elapsed >= maxDurationMs) {
          if (onStatus) {
            onStatus(
              formatReceiptBubble({ status: 'timeout' }),
              { requestId, generation, elapsed }
            );
          }
          stop();
          return;
        }

        try {
          if (typeof fetchReceipt !== 'function') {
            return;
          }
          const receipt = await fetchReceipt(requestId);
          if (isStopped || pollerRunId !== currentRunId) {
            return;
          }

          const formatted = formatReceiptBubble(receipt);
          if (onStatus) {
            onStatus(formatted, { requestId, generation, elapsed, raw: receipt });
          }

          if (formatted.terminal) {
            stop();
            return;
          }
        } catch (err) {
          if (isStopped || pollerRunId !== currentRunId) {
            return;
          }
          const formatted = formatReceiptBubble(err);
          if (onStatus) {
            onStatus(
              formatted,
              { requestId, generation, elapsed, error: err }
            );
          }
        }

        if (!isStopped && pollerRunId === currentRunId) {
          const remaining = maxDurationMs - (timer.now() - startTime);
          if (remaining > 0) {
            const nextDelay = Math.min(intervalMs, remaining);
            timerId = timer.setTimeout(tick, nextDelay);
          } else {
            if (onStatus) {
              onStatus(
                formatReceiptBubble({ status: 'timeout' }),
                { requestId, generation, elapsed: timer.now() - startTime }
              );
            }
            stop();
          }
        }
      }

      timerId = timer.setTimeout(tick, intervalMs);
      return { stop };
    }

    return {
      start,
      stop,
    };
  }

  return {
    VALID_EMOTIONS,
    DEFAULT_DURATION_MS,
    DEFAULT_PRIORITY,
    REACTION_INTERRUPT_STATES,
    isReactionInterruptState,
    shouldPreserveReactionPresentation,
    isSafeId,
    isSafeRequestId,
    generateRequestId,
    validateUserMessageText,
    createRequestIdTracker,
    formatReceiptBubble,
    createReceiptPoller,
    parsePetEvent,
    parseLegacyReaction,
    createEventDedupTracker,
    getReactionAssetCandidates,
  };
});
