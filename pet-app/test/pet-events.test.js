"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  VALID_EMOTIONS,
  DEFAULT_DURATION_MS,
  DEFAULT_PRIORITY,
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
