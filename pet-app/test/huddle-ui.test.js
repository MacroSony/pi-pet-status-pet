"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { normalizeHuddleStatus } = require("../src/pet-events.js");

const INACTIVE = { active: false, participantCount: 1 };

describe("normalizeHuddleStatus", () => {
  it("accepts only the camelCase active contract and clamps display count", () => {
    assert.deepEqual(
      normalizeHuddleStatus({ active: true, participantCount: 2 }),
      { active: true, participantCount: 2 },
    );
    assert.deepEqual(
      normalizeHuddleStatus({ active: true, participantCount: 1000 }),
      { active: true, participantCount: 99 },
    );
    assert.deepEqual(normalizeHuddleStatus({ active: true, participant_count: 3 }), INACTIVE);
  });

  it("fails closed for malformed, inactive, or impossible values", () => {
    for (const raw of [
      null,
      [],
      "active",
      { active: false, participantCount: 3 },
      { active: "true", participantCount: 3 },
      { active: true, participantCount: 1 },
      { active: true, participantCount: 2.5 },
      { active: true, participantCount: NaN },
      { active: true, participantCount: Infinity },
      { active: true, participantCount: "3" },
      { active: true, participantCount: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      assert.deepEqual(normalizeHuddleStatus(raw), INACTIVE);
    }
  });
});

describe("huddle UI contract", () => {
  const source = (name) => fs.readFileSync(path.join(__dirname, "../src", name), "utf8");

  it("keeps the proximity cue separate from business-state classes", () => {
    const html = source("index.html");
    const app = source("app.js");
    assert.match(html, /id="huddle-ring"/);
    assert.match(html, /id="huddle-badge"[^>]*hidden/);
    assert.match(app, /dataset\.huddle/);
    assert.match(app, /invoke\('get_huddle_status', \{ wasActive \}\)/);
    assert.match(app, /HUDDLE_POLL_INTERVAL_MS = 3000/);
  });

  it("provides reduced-motion styling for the ambient cue", () => {
    const css = source("style.css");
    const reducedMotion = css.slice(css.indexOf("prefers-reduced-motion"));
    assert.match(css, /data-huddle="active"/);
    assert.match(reducedMotion, /#huddle-ring/);
    assert.match(reducedMotion, /#huddle-badge/);
  });
});
