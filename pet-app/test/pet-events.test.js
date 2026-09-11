"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  VALID_EMOTIONS,
  DEFAULT_DURATION_MS,
  DEFAULT_PRIORITY,
  isSafeRequestId,
  generateRequestId,
  validateUserMessageText,
  createRequestIdTracker,
  parsePetEvent,
  parseLegacyReaction,
  createEventDedupTracker,
} = require("../src/pet-events.js");

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
