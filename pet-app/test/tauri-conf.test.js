"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("tauri.conf.json window configuration contract", () => {
  const configPath = path.join(__dirname, "../src-tauri/tauri.conf.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw);

  it("defines windows list with exactly one main window", () => {
    assert.ok(Array.isArray(config?.app?.windows), "app.windows must be an array");
    const mainWindows = config.app.windows.filter((w) => w && w.label === "main");
    assert.strictEqual(mainWindows.length, 1, "must contain exactly one window with label 'main'");
  });

  it("configures main window for show-without-activate while keeping click interactivity and invariants", () => {
    const mainWindow = config.app.windows.find((w) => w && w.label === "main");
    assert.ok(mainWindow, "main window config must exist");

    // Show-without-activate contract
    assert.strictEqual(mainWindow.focus, false, "focus must be false to avoid stealing focus on launch");
    assert.notStrictEqual(mainWindow.visible, false, "visible must not be false");
    assert.notStrictEqual(mainWindow.focusable, false, "focusable must not be false to preserve click interactivity");
    assert.strictEqual(mainWindow.acceptFirstMouse, true, "acceptFirstMouse must be true");

    // Presentation & desktop pet invariants
    assert.strictEqual(mainWindow.transparent, true, "transparent must be true");
    assert.strictEqual(mainWindow.decorations, false, "decorations must be false");
    assert.strictEqual(mainWindow.alwaysOnTop, true, "alwaysOnTop must be true");
    assert.strictEqual(mainWindow.skipTaskbar, true, "skipTaskbar must be true");
  });
});
