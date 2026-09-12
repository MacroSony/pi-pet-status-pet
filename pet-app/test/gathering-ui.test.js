"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

describe("desktop gathering contract", () => {
  test("removes proximity Huddle from the runtime and presentation surface", () => {
    const html = read("src/index.html");
    const app = read("src/app.js");
    const css = read("src/style.css");
    const lib = read("src-tauri/src/lib.rs");
    const layout = read("src-tauri/src/window_layout.rs");

    assert.doesNotMatch(html, /data-huddle|huddle-ring|huddle-badge/i);
    assert.doesNotMatch(app, /get_huddle_status|huddlePoll|dataset\.huddle/i);
    assert.doesNotMatch(css, /data-huddle|huddle-ring|huddle-badge|huddle-glow/i);
    assert.doesNotMatch(lib, /fn get_huddle_status|get_huddle_status\]/);
    assert.doesNotMatch(layout, /HUDDLE_.*THRESHOLD|evaluate_huddle_status/);
  });

  test("retains automatic staggering and per-pet position persistence", () => {
    const lib = read("src-tauri/src/lib.rs");
    const layout = read("src-tauri/src/window_layout.rs");

    assert.match(lib, /calculate_auto_stagger_position/);
    assert.match(lib, /collect_active_peer_positions/);
    assert.match(lib, /WindowEvent::Moved\(position\)/);
    assert.match(lib, /write_window_position/);
    assert.match(layout, /fn calculate_auto_stagger_position/);
    assert.match(layout, /fn collect_active_peer_positions/);
  });
});
