"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  VALID_EMOTIONS,
  DEFAULT_DURATION_MS,
  DEFAULT_PRIORITY,
  REACTION_INTERRUPT_STATES,
  isReactionInterruptState,
  shouldPreserveReactionPresentation,
  isSafeRequestId,
  generateRequestId,
  validateUserMessageText,
  createRequestIdTracker,
  formatReceiptBubble,
  createReceiptPoller,
  parsePetEvent,
  parseLegacyReaction,
  createEventDedupTracker,
} = require("../src/pet-events.js");

describe("reaction presentation priority", () => {
  it("preserves bounded reactions across ordinary status churn", () => {
    for (const state of ["idle", "thinking", "running", "editing", "searching", "delegating", "reading", "unknown"]) {
      assert.strictEqual(isReactionInterruptState(state), false);
      assert.strictEqual(shouldPreserveReactionPresentation(true, state), true);
    }
  });

  it("lets alerts and lifecycle states interrupt reactions", () => {
    assert.deepStrictEqual(REACTION_INTERRUPT_STATES, ["error", "waiting", "offline", "closed"]);
    for (const state of REACTION_INTERRUPT_STATES) {
      assert.strictEqual(isReactionInterruptState(state), true);
      assert.strictEqual(shouldPreserveReactionPresentation(true, state), false);
    }
    assert.strictEqual(shouldPreserveReactionPresentation(false, "thinking"), false);
    for (const value of [null, undefined, 42, {}]) {
      assert.strictEqual(isReactionInterruptState(value), false);
      assert.strictEqual(shouldPreserveReactionPresentation(true, value), true);
    }
  });
});

describe("parsePetEvent - schema and payload validation", () => {
  it("accepts valid expression with both text and emotion", () => {
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_01HZX8E9A2B4C5D6E7F8G9H0JK",
      petId: "pet_a1b2c3d4e5f60718293a4b5c",
      kind: "expression",
      payload: {
        text: "Task completed!",
        emotion: "happy",
        speak: false,
        priority: 3,
        durationMs: 3000,
      },
      createdAtMs: 1757419200000,
      expiresAtMs: Date.now() + 60000,
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.event.eventId, "cmd_01HZX8E9A2B4C5D6E7F8G9H0JK");
    assert.strictEqual(res.event.petId, "pet_a1b2c3d4e5f60718293a4b5c");
    assert.strictEqual(res.event.kind, "expression");
    assert.strictEqual(res.event.payload.text, "Task completed!");
    assert.strictEqual(res.event.payload.emotion, "happy");
    assert.strictEqual(res.event.payload.durationMs, 3000);
    assert.strictEqual(res.event.payload.priority, 3);
    assert.strictEqual(res.event.payload.speak, false);
  });

  it("accepts valid expression with text only (no emotion)", () => {
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_text_only",
      petId: "pet_123",
      kind: "expression",
      payload: {
        text: "Just saying hello.",
      },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 30000,
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.event.payload.text, "Just saying hello.");
    assert.strictEqual(res.event.payload.emotion, null);
    assert.strictEqual(res.event.payload.durationMs, DEFAULT_DURATION_MS);
    assert.strictEqual(res.event.payload.priority, DEFAULT_PRIORITY);
  });

  it("accepts valid expression with emotion only (no text) for all valid emotions", () => {
    for (const emotion of VALID_EMOTIONS) {
      const raw = {
        schemaVersion: "1",
        eventId: `cmd_emotion_${emotion}`,
        petId: "pet_123",
        kind: "expression",
        payload: { emotion },
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 30000,
      };

      const res = parsePetEvent(raw);
      assert.strictEqual(res.ok, true, `Failed for emotion: ${emotion}`);
      assert.strictEqual(res.event.payload.emotion, emotion);
      assert.strictEqual(res.event.payload.text, null);
    }
  });

  it("rejects invalid emotion enum values", () => {
    const invalidEmotions = ["super_happy", "excited", "angry", "drag", "working", "idle", ""];
    for (const emotion of invalidEmotions) {
      const raw = {
        schemaVersion: "1",
        eventId: "cmd_invalid_emo",
        petId: "pet_123",
        kind: "expression",
        payload: { emotion },
      };

      const res = parsePetEvent(raw);
      assert.strictEqual(res.ok, false);
      assert.match(res.reason, /Invalid emotion/);
    }
  });

  it("rejects expression missing both text and emotion", () => {
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_empty_payload",
      petId: "pet_123",
      kind: "expression",
      payload: {},
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /At least one of text or emotion is required/);
  });

  it("rejects non-string text in payload", () => {
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_bad_text",
      petId: "pet_123",
      kind: "expression",
      payload: { text: 12345 },
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /payload\.text must be a string/);
  });

  it("rejects unsupported schemaVersion", () => {
    const raw = {
      schemaVersion: "2",
      eventId: "cmd_v2",
      petId: "pet_123",
      kind: "expression",
      payload: { text: "Future schema" },
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /Unsupported schemaVersion/);
  });

  it("rejects missing or empty eventId", () => {
    const raw = {
      schemaVersion: "1",
      petId: "pet_123",
      kind: "expression",
      payload: { text: "No ID" },
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /eventId is required/);
  });

  it("rejects unsupported kind", () => {
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_unknown_kind",
      kind: "unsupported_kind",
      payload: { text: "Test" },
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /Unsupported kind/);
  });

  it("identifies and rejects expired events", () => {
    const now = Date.now();
    const raw = {
      schemaVersion: "1",
      eventId: "cmd_expired",
      petId: "pet_123",
      kind: "expression",
      payload: { text: "Old message" },
      createdAtMs: now - 60000,
      expiresAtMs: now - 1000, // expired 1s ago
    };

    const res = parsePetEvent(raw, now);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.expired, true);
    assert.match(res.reason, /expired/i);
  });

  it("handles snake_case alias fields from serialization", () => {
    const raw = {
      schema_version: "1",
      event_id: "cmd_snake_case",
      pet_id: "pet_snake",
      kind: "expression",
      payload: {
        text: "Snake alias test",
        emotion: "celebrate",
        duration_ms: 4000,
      },
      created_at_ms: 1757419200000,
      expires_at_ms: Date.now() + 50000,
    };

    const res = parsePetEvent(raw);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.event.eventId, "cmd_snake_case");
    assert.strictEqual(res.event.petId, "pet_snake");
    assert.strictEqual(res.event.payload.emotion, "celebrate");
    assert.strictEqual(res.event.payload.durationMs, 4000);
  });
});

describe("parseLegacyReaction - backwards compatibility parser", () => {
  it("converts valid legacy reaction to normalized expression event", () => {
    const now = Date.now();
    const legacy = {
      id: "1757419200000-abcd-1234",
      emotion: "happy",
      message: "Legacy bubble text",
      speak: false,
      ts: now,
      ttl_ms: 10000,
    };

    const res = parseLegacyReaction(legacy, now);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.event.eventId, "1757419200000-abcd-1234");
    assert.strictEqual(res.event.kind, "expression");
    assert.strictEqual(res.event.payload.text, "Legacy bubble text");
    assert.strictEqual(res.event.payload.emotion, "happy");
    assert.strictEqual(res.event.payload.durationMs, DEFAULT_DURATION_MS);
    assert.strictEqual(res.event.payload.priority, DEFAULT_PRIORITY);
    assert.strictEqual(res.event.expiresAtMs, now + 10000);
  });

  it("rejects expired legacy reaction", () => {
    const now = Date.now();
    const legacy = {
      id: "legacy_expired",
      emotion: "sad",
      message: "Expired message",
      ts: now - 20000,
      ttl_ms: 10000, // expired 10s ago
    };

    const res = parseLegacyReaction(legacy, now);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.expired, true);
  });

  it("rejects legacy reaction without emotion or message", () => {
    const legacy = {
      id: "legacy_empty",
      ts: Date.now(),
      ttl_ms: 10000,
    };

    const res = parseLegacyReaction(legacy);
    assert.strictEqual(res.ok, false);
  });
});

describe("createEventDedupTracker - watermark deduplication", () => {
  it("returns true for first encounter and false for duplicates", () => {
    const tracker = createEventDedupTracker();
    assert.strictEqual(tracker.remember("cmd_01"), true);
    assert.strictEqual(tracker.remember("cmd_01"), false);
    assert.strictEqual(tracker.remember("cmd_01"), false);
    assert.strictEqual(tracker.remember("cmd_02"), true);
    assert.strictEqual(tracker.remember("cmd_02"), false);
  });

  it("supports has() without modifying state", () => {
    const tracker = createEventDedupTracker();
    assert.strictEqual(tracker.has("cmd_01"), false);
    tracker.remember("cmd_01");
    assert.strictEqual(tracker.has("cmd_01"), true);
    assert.strictEqual(tracker.has("cmd_02"), false);
  });

  it("rejects non-string or empty event IDs", () => {
    const tracker = createEventDedupTracker();
    assert.strictEqual(tracker.remember(""), false);
    assert.strictEqual(tracker.remember(null), false);
    assert.strictEqual(tracker.remember(undefined), false);
    assert.strictEqual(tracker.remember("   "), false);
    assert.strictEqual(tracker.size(), 0);
  });

  it("clears all recorded IDs", () => {
    const tracker = createEventDedupTracker();
    tracker.remember("cmd_01");
    tracker.remember("cmd_02");
    assert.strictEqual(tracker.size(), 2);
    tracker.clear();
    assert.strictEqual(tracker.size(), 0);
    assert.strictEqual(tracker.remember("cmd_01"), true);
  });

  it("dedup parity: prevents double playback between PetEvent and legacy reaction", () => {
    const tracker = createEventDedupTracker();

    // Scenario A: PetEvent arrives first, then legacy reaction arrives with same commandId
    const commandIdA = "cmd_shared_01";
    assert.strictEqual(tracker.remember(commandIdA), true, "First PetEvent must play");
    assert.strictEqual(tracker.remember(commandIdA), false, "Subsequent legacy reaction must be dropped");

    // Scenario B: Legacy reaction arrives first, then PetEvent arrives with same ID
    const commandIdB = "cmd_shared_02";
    assert.strictEqual(tracker.remember(commandIdB), true, "First legacy reaction must play");
    assert.strictEqual(tracker.remember(commandIdB), false, "Subsequent PetEvent must be dropped");
  });
});

describe("isSafeRequestId and generateRequestId - request ID validation", () => {
  it("accepts valid alphanumeric request IDs with dashes and underscores", () => {
    assert.strictEqual(isSafeRequestId("req_12345"), true);
    assert.strictEqual(isSafeRequestId("cmd-01-ABC"), true);
    assert.strictEqual(isSafeRequestId("a"), true);
    assert.strictEqual(isSafeRequestId("x".repeat(64)), true);
  });

  it("rejects invalid request IDs", () => {
    assert.strictEqual(isSafeRequestId(""), false);
    assert.strictEqual(isSafeRequestId("x".repeat(65)), false);
    assert.strictEqual(isSafeRequestId("req/123"), false);
    assert.strictEqual(isSafeRequestId("req\\123"), false);
    assert.strictEqual(isSafeRequestId(".."), false);
    assert.strictEqual(isSafeRequestId("req 123"), false);
    assert.strictEqual(isSafeRequestId("req@123"), false);
    assert.strictEqual(isSafeRequestId(null), false);
    assert.strictEqual(isSafeRequestId(undefined), false);
  });

  it("generates valid safe request IDs", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateRequestId();
      assert.strictEqual(isSafeRequestId(id), true);
      assert.ok(id.startsWith("req_"));
      assert.ok(id.length <= 64);
    }
  });

  it("uses injected crypto.randomUUID when provided", () => {
    const mockCrypto = {
      randomUUID: () => "550e8400-e29b-41d4-a716-446655440000",
    };
    const id = generateRequestId(mockCrypto);
    assert.strictEqual(id, "req_550e8400-e29b-41d4-a716-446655440000");
    assert.strictEqual(isSafeRequestId(id), true);
    assert.ok(id.length <= 64);
  });

  it("sanitizes injected crypto.randomUUID characters to safe set", () => {
    const mockCrypto = {
      randomUUID: () => "uuid/123\\test..@#$%-ABC_456",
    };
    const id = generateRequestId(mockCrypto);
    assert.strictEqual(id, "req_uuid123test-ABC_456");
    assert.strictEqual(isSafeRequestId(id), true);
    assert.ok(id.length <= 64);
  });

  it("truncates excessively long UUIDs to 64 chars total", () => {
    const mockCrypto = {
      randomUUID: () => "a".repeat(100),
    };
    const id = generateRequestId(mockCrypto);
    assert.strictEqual(id, "req_" + "a".repeat(60));
    assert.strictEqual(id.length, 64);
    assert.strictEqual(isSafeRequestId(id), true);
  });

  it("falls back to timestamp+random when crypto throws or returns non-sanitizable text", () => {
    const throwingCrypto = {
      randomUUID: () => {
        throw new Error("Entropy error");
      },
    };
    const idA = generateRequestId(throwingCrypto);
    assert.strictEqual(isSafeRequestId(idA), true);
    assert.ok(idA.startsWith("req_"));
    assert.ok(idA.length <= 64);

    const emptySanitizedCrypto = {
      randomUUID: () => "!!!@@@###$$$",
    };
    const idB = generateRequestId(emptySanitizedCrypto);
    assert.strictEqual(isSafeRequestId(idB), true);
    assert.ok(idB.startsWith("req_"));
  });

  it("falls back to timestamp+random when crypto is absent without mutating production global state", () => {
    // Test injected empty crypto object
    const idFromEmptyCrypto = generateRequestId({});
    assert.strictEqual(isSafeRequestId(idFromEmptyCrypto), true);
    assert.ok(idFromEmptyCrypto.startsWith("req_"));

    // Safely test global crypto absence and restore immediately
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const id = generateRequestId();
      assert.strictEqual(isSafeRequestId(id), true);
      assert.ok(id.startsWith("req_"));
      assert.ok(id.length <= 64);
    } finally {
      if (origDescriptor) {
        Object.defineProperty(globalThis, "crypto", origDescriptor);
      } else {
        delete globalThis.crypto;
      }
    }
  });
});

describe("validateUserMessageText", () => {
  it("accepts valid non-empty message within 2000 chars", () => {
    assert.strictEqual(validateUserMessageText("Hello world").ok, true);
    assert.strictEqual(validateUserMessageText("a".repeat(2000)).ok, true);
  });

  it("rejects empty or whitespace-only messages", () => {
    assert.strictEqual(validateUserMessageText("").ok, false);
    assert.strictEqual(validateUserMessageText("   ").ok, false);
    assert.strictEqual(validateUserMessageText("\n\t").ok, false);
  });

  it("rejects messages exceeding 2000 characters", () => {
    assert.strictEqual(validateUserMessageText("a".repeat(2001)).ok, false);
  });

  it("rejects non-string values", () => {
    assert.strictEqual(validateUserMessageText(null).ok, false);
    assert.strictEqual(validateUserMessageText(1234).ok, false);
    assert.strictEqual(validateUserMessageText({}).ok, false);
  });
});

describe("createRequestIdTracker - request ID retry retention", () => {
  function createTracker() {
    let sequence = 0;
    return createRequestIdTracker({ randomUUID: () => `uuid-${++sequence}` });
  }

  it("reuses the request ID while the raw message is unchanged", () => {
    const tracker = createTracker();
    const first = tracker.getRequestId("same text");

    assert.strictEqual(first, "req_uuid-1");
    assert.strictEqual(tracker.getRequestId("same text"), first);
  });

  it("generates a new request ID after the message changes", () => {
    const tracker = createTracker();
    const first = tracker.getRequestId("first draft");
    const second = tracker.getRequestId("edited draft");

    assert.strictEqual(first, "req_uuid-1");
    assert.strictEqual(second, "req_uuid-2");
    assert.strictEqual(tracker.getRequestId("edited draft"), second);
  });

  it("generates a new request ID after reset", () => {
    const tracker = createTracker();
    const first = tracker.getRequestId("same text");
    tracker.reset();

    assert.strictEqual(tracker.getRequestId("same text"), "req_uuid-2");
    assert.strictEqual(isSafeRequestId(first), true);
  });
});

describe("formatReceiptBubble - status and reason formatting", () => {
  it("formats dispatched receipt correctly", () => {
    const formatted = formatReceiptBubble({ status: "dispatched" });
    assert.strictEqual(formatted.terminal, true);
    assert.strictEqual(formatted.status, "dispatched");
    assert.strictEqual(formatted.text, "Message dispatched");
  });

  it("formats queued receipt as non-terminal conservative bubble", () => {
    const formatted = formatReceiptBubble({ status: "queued" });
    assert.strictEqual(formatted.terminal, false);
    assert.strictEqual(formatted.status, "queued");
    assert.strictEqual(formatted.text, "Message queued");
  });

  it("formats not_found receipt as non-terminal conservative bubble to continue polling", () => {
    const fromStatus = formatReceiptBubble({ status: "not_found" });
    assert.strictEqual(fromStatus.terminal, false);
    assert.strictEqual(fromStatus.status, "not_found");
    assert.strictEqual(fromStatus.text, "Message queued");

    const from404 = formatReceiptBubble({ status: 404 });
    assert.strictEqual(from404.terminal, false);
    assert.strictEqual(from404.status, "not_found");
    assert.strictEqual(from404.text, "Message queued");

    const fromReason = formatReceiptBubble({ status: "error", reason: "not_found" });
    assert.strictEqual(fromReason.terminal, false);
    assert.strictEqual(fromReason.status, "not_found");
  });

  it("formats transient query errors and Error instances as non-terminal", () => {
    const fromStatus = formatReceiptBubble({ status: "error" });
    assert.strictEqual(fromStatus.terminal, false);
    assert.strictEqual(fromStatus.status, "error");
    assert.strictEqual(fromStatus.text, "Message queued");

    const fromErrorObj = formatReceiptBubble(new Error("Network timeout"));
    assert.strictEqual(fromErrorObj.terminal, false);
    assert.strictEqual(fromErrorObj.status, "error");
    assert.strictEqual(fromErrorObj.text, "Message queued");
  });

  it("formats timeout receipt with conservative unknown dispatch text", () => {
    const formatted = formatReceiptBubble({ status: "timeout" });
    assert.strictEqual(formatted.terminal, true);
    assert.strictEqual(formatted.status, "timeout");
    assert.strictEqual(formatted.text, "Message dispatch status unknown");
  });

  it("formats terminal error statuses (failed, expired, rejected) with reasons without claiming completion", () => {
    const failed = formatReceiptBubble({
      status: "failed",
      reason: "Claim expired: stale claimed item older than 60s (delivery-unknown)",
    });
    assert.strictEqual(failed.terminal, true);
    assert.strictEqual(failed.status, "failed");
    assert.strictEqual(failed.text, "Message failed: Claim expired: stale claimed item older than 60s (delivery-unknown)");

    const expired = formatReceiptBubble({ status: "expired", reason: "Message expired before claim" });
    assert.strictEqual(expired.terminal, true);
    assert.strictEqual(expired.status, "expired");
    assert.strictEqual(expired.text, "Message expired: Message expired before claim");

    const rejected = formatReceiptBubble({ status: "rejected", reason: "SessionOffline" });
    assert.strictEqual(rejected.terminal, true);
    assert.strictEqual(rejected.status, "rejected");
    assert.strictEqual(rejected.text, "Message rejected: SessionOffline");

    const defaultFailed = formatReceiptBubble({ status: "failed" });
    assert.strictEqual(defaultFailed.terminal, true);
    assert.strictEqual(defaultFailed.text, "Message failed");
  });

  it("handles null or non-object receipt gracefully", () => {
    const formattedNull = formatReceiptBubble(null);
    assert.strictEqual(formattedNull.terminal, true);
    assert.strictEqual(formattedNull.status, "failed");
    assert.strictEqual(formattedNull.text, "Message failed: invalid receipt");

    const formattedUndefined = formatReceiptBubble(undefined);
    assert.strictEqual(formattedUndefined.terminal, true);
  });
});

describe("createReceiptPoller - polling state machine and generation safety", () => {
  function createMockTimer() {
    let currentTime = 0;
    let nextId = 1;
    const timers = new Map();

    return {
      setTimeout(fn, ms) {
        const id = nextId++;
        timers.set(id, { fn, dueTime: currentTime + ms });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      now() {
        return currentTime;
      },
      async advance(ms) {
        currentTime += ms;
        const ready = [];
        for (const [id, entry] of timers.entries()) {
          if (entry.dueTime <= currentTime) {
            ready.push({ id, fn: entry.fn });
          }
        }
        for (const item of ready) {
          timers.delete(item.id);
          await item.fn();
        }
      },
      pendingCount() {
        return timers.size;
      },
    };
  }

  it("polls repeatedly through queued and not_found (404) and stops on terminal dispatched receipt", async () => {
    const timer = createMockTimer();
    const responses = [
      { status: "queued" },
      { status: "not_found" },
      { status: "dispatched" },
    ];
    let fetchCount = 0;
    const updates = [];

    const poller = createReceiptPoller({
      fetchReceipt: async (reqId) => {
        fetchCount++;
        return responses.shift();
      },
      onStatus: (result, ctx) => {
        updates.push({ result, ctx });
      },
      intervalMs: 500,
      maxDurationMs: 2500,
      timer,
    });

    poller.start({ requestId: "req_001", generation: 1 });

    assert.strictEqual(fetchCount, 0);
    assert.strictEqual(timer.pendingCount(), 1);

    // 1st tick at 500ms -> queued
    await timer.advance(500);
    assert.strictEqual(fetchCount, 1);
    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].result.status, "queued");
    assert.strictEqual(updates[0].result.terminal, false);
    assert.strictEqual(timer.pendingCount(), 1);

    // 2nd tick at 1000ms -> not_found (404/waiting) must continue polling
    await timer.advance(500);
    assert.strictEqual(fetchCount, 2);
    assert.strictEqual(updates.length, 2);
    assert.strictEqual(updates[1].result.status, "not_found");
    assert.strictEqual(updates[1].result.terminal, false);
    assert.strictEqual(timer.pendingCount(), 1);

    // 3rd tick at 1500ms -> dispatched (terminal)
    await timer.advance(500);
    assert.strictEqual(fetchCount, 3);
    assert.strictEqual(updates.length, 3);
    assert.strictEqual(updates[2].result.status, "dispatched");
    assert.strictEqual(updates[2].result.terminal, true);
    assert.strictEqual(updates[2].result.text, "Message dispatched");
    assert.strictEqual(timer.pendingCount(), 0, "Poller must stop after terminal receipt");
  });

  it("stops immediately on terminal rejected / expired / failed receipt", async () => {
    const timer = createMockTimer();
    const updates = [];

    const poller = createReceiptPoller({
      fetchReceipt: async () => ({ status: "rejected", reason: "SessionClosed" }),
      onStatus: (result) => updates.push(result),
      intervalMs: 500,
      maxDurationMs: 2000,
      timer,
    });

    poller.start({ requestId: "req_rej", generation: 1 });
    await timer.advance(500);

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].terminal, true);
    assert.strictEqual(updates[0].status, "rejected");
    assert.strictEqual(updates[0].text, "Message rejected: SessionClosed");
    assert.strictEqual(timer.pendingCount(), 0);
  });

  it("stops on bounded duration timeout and reports conservative timeout status", async () => {
    const timer = createMockTimer();
    const updates = [];

    const poller = createReceiptPoller({
      fetchReceipt: async () => ({ status: "queued" }),
      onStatus: (result) => updates.push(result),
      intervalMs: 500,
      maxDurationMs: 2000,
      timer,
    });

    poller.start({ requestId: "req_timeout", generation: 1 });

    // Advance 500ms -> queued (1)
    await timer.advance(500);
    // Advance 1000ms -> queued (2)
    await timer.advance(500);
    // Advance 1500ms -> queued (3)
    await timer.advance(500);
    // Advance 2000ms -> elapsed >= maxDurationMs -> timeout
    await timer.advance(500);

    const last = updates[updates.length - 1];
    assert.strictEqual(last.status, "timeout");
    assert.strictEqual(last.terminal, true);
    assert.strictEqual(last.text, "Message dispatch status unknown");
    assert.strictEqual(timer.pendingCount(), 0);
  });

  it("generation and run isolation prevents older poll ticks and in-flight responses from overwriting newer sends", async () => {
    const timer = createMockTimer();
    const updates = [];
    let resolveOldFetch;

    const poller = createReceiptPoller({
      fetchReceipt: async (reqId) => {
        if (reqId === "req_old") {
          return new Promise((resolve) => {
            resolveOldFetch = () => resolve({ status: "dispatched" });
          });
        }
        return { status: "rejected", reason: "Blocked" };
      },
      onStatus: (result, ctx) => {
        updates.push({ result, ctx });
      },
      intervalMs: 500,
      maxDurationMs: 2000,
      timer,
    });

    // Start Generation 1 for req_old
    poller.start({ requestId: "req_old", generation: 1 });

    // Trigger tick 1 without awaiting it: req_old intentionally remains in flight.
    const oldTick = timer.advance(500);
    await Promise.resolve();

    // User sends Generation 2 for req_new while req_old fetch is still in flight.
    poller.start({ requestId: "req_new", generation: 2 });

    // Old in-flight fetch resolves late and must be ignored.
    assert.strictEqual(typeof resolveOldFetch, "function");
    resolveOldFetch();
    await oldTick;

    // Advance timer for Generation 2 tick.
    await timer.advance(500);

    // Only Generation 2 should emit status; old in-flight response must be dropped
    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].ctx.requestId, "req_new");
    assert.strictEqual(updates[0].ctx.generation, 2);
    assert.strictEqual(updates[0].result.status, "rejected");
  });

  it("recovers from transient fetch errors and keeps polling", async () => {
    const timer = createMockTimer();
    let callCount = 0;
    const updates = [];

    const poller = createReceiptPoller({
      fetchReceipt: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary network blip");
        }
        return { status: "dispatched" };
      },
      onStatus: (result) => updates.push(result),
      intervalMs: 500,
      maxDurationMs: 2000,
      timer,
    });

    poller.start({ requestId: "req_err", generation: 1 });

    // 1st tick -> error thrown, transient status emitted
    await timer.advance(500);
    assert.strictEqual(callCount, 1);
    assert.strictEqual(updates[0].status, "error");
    assert.strictEqual(updates[0].terminal, false);
    assert.strictEqual(updates[0].text, "Message queued");
    assert.strictEqual(timer.pendingCount(), 1, "Must continue polling after transient error");

    // 2nd tick -> success dispatched
    await timer.advance(500);
    assert.strictEqual(callCount, 2);
    assert.strictEqual(updates[1].status, "dispatched");
    assert.strictEqual(updates[1].terminal, true);
    assert.strictEqual(timer.pendingCount(), 0);
  });
});
