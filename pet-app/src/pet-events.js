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

  return {
    VALID_EMOTIONS,
    DEFAULT_DURATION_MS,
    DEFAULT_PRIORITY,
    isSafeId,
    parsePetEvent,
    parseLegacyReaction,
    createEventDedupTracker,
  };
});
