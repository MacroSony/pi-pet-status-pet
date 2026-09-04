# Custom Character Packs

> This document is designed to be read by an AI coding assistant (Claude Code, GitHub Copilot CLI) to create, install, export, and manage custom character packs for Claude Status Pet.

## What You're Building

A character pack is a folder with images (GIF/PNG/SVG) and a `character.json` config that maps pet states to images. Once created, the pet will show your character in the right-click menu under **Custom**.

## Output Directory

Install the pack to:
- **Windows**: `$env:USERPROFILE\.claude\pet-data\characters\<pack-name>\`
- **macOS/Linux**: `~/.claude/pet-data/characters/<pack-name>/`

## Step 1: Create the directory

```bash
PACK_NAME="my-character"  # kebab-case, no spaces
PACK_DIR="$HOME/.claude/pet-data/characters/$PACK_NAME"
mkdir -p "$PACK_DIR"
```

## Step 2: Add images

Each pet state needs at least one image. Multiple images per state adds variety (one is picked randomly).

**Image requirements:**
- Format: animated WebP (preferred), GIF, PNG/APNG, or SVG
- Transparent background strongly recommended
- Square aspect ratio (~140×140px display area)
- Keep file sizes reasonable (<2MB per image)
- For AI-video output, convert the keyed MP4 to animated WebP; MP4 itself is not a character-pack format

**Required states and suggested themes:**

| State | When it shows | Suggested pose/mood |
|-------|--------------|---------------------|
| `idle` | Waiting for input | Relaxed, happy, waving |
| `thinking` | Processing a prompt | Curious, looking up, pondering |
| `reading` | Reading files | Focused, calm, studying |
| `editing` | Writing/editing files | Typing, busy, concentrated |
| `searching` | Searching code | Looking around, scanning |
| `running` | Running commands | Energetic, active, running |
| `delegating` | Spawning sub-agents | Pointing, directing, multitasking |
| `waiting` | Awaiting approval | Anxious, alert, patient |
| `error` | Something failed | Sad, frustrated, alarmed |
| `offline` | Session ended | Sleeping, faded, resting |

> **Minimum:** You need at least `idle`, `thinking`, `working` (covers editing/running/searching), and `offline`. Missing states fall back to `idle`.

## Step 3: Create character.json

Create `<pack-dir>/character.json`:

```json
{
  "name": "My Character",
  "version": 2,
  "type": "gif",
  "auto_return_seconds": 90,
  "watchdog": {
    "enabled": true,
    "sleep_after_seconds": 900,
    "exit_after_seconds": 3600,
    "force_exit_after_seconds": 14400
  },
  "appearance": {
    "motion": "full",
    "uiPreset": "classic",
    "artScale": 1.0,
    "bubble": "all",
    "stateLabel": "always",
    "identity": "always"
  },
  "transitions": {
    "idle->editing": {
      "frames": ["<pack-name>/idle_to_edit.gif"],
      "duration_ms": 1000
    },
    "editing->idle": {
      "frames": ["<pack-name>/edit_to_idle.gif"],
      "duration_ms": 800
    }
  },
  "idle_variations": {
    "idle": [
      "<pack-name>/idle_blink.gif",
      "<pack-name>/idle_stretch.gif"
    ]
  },
  "states": {
    "idle":       ["<pack-name>/idle.gif"],
    "thinking":   ["<pack-name>/think.gif"],
    "reading":    ["<pack-name>/read.gif"],
    "editing":    ["<pack-name>/edit.gif"],
    "searching":  ["<pack-name>/search.gif"],
    "running":    ["<pack-name>/run.gif"],
    "delegating": ["<pack-name>/delegate.gif"],
    "waiting":    ["<pack-name>/wait.gif"],
    "error":      ["<pack-name>/error.gif"],
    "offline":    ["<pack-name>/sleep.gif"],
    "unknown":    ["<pack-name>/idle.gif"]
  }
}
```

**Important:**
- `version`: Optional schema version number (`2` for transition / variation / auto-return / watchdog support). Legacy v1 configs without `version` continue to work seamlessly.
- `type` must be `"webp"`, `"gif"`, `"png"`, or `"svg"`
- Image paths are relative to the `assets/` or `characters/` parent directory, prefixed with the pack name
- Each state value is an **array** of paths (for random variety)
- `name` is what appears in the right-click menu

### Schema Version 2 Features

Version 2 introduces transitions, idle variations, auto-return decay, and session watchdog:

#### 1. Transitions (`transitions`)
Defines one-shot animation clips played when transitioning between specific states (e.g. `idle->editing`):
```json
"transitions": {
  "idle->editing": {
    "frames": ["<pack-name>/idle_to_edit.gif"],
    "duration_ms": 1000
  },
  "searching->idle": {
    "frames": ["<pack-name>/found.png"],
    "duration_ms": 800
  }
}
```
- **Key format**: `"fromState->toState"`.
- **`frames`**: Array of image paths (or a single string path). If multiple frames are provided, they are stepped through sequentially across the total duration.
- **`duration_ms`**: Optional playback duration in milliseconds (default: `1000`).
- **Silent degradation**: If a transition image fails to load or is missing, the player silently falls back to the destination state loop with the standard ~150ms fade without showing an error in the UI.
- **Unconfigured transitions**: State pairs without a configured transition seamlessly transition using the standard ~150ms fade.

#### 2. Auto-Return Decay (`auto_return_seconds`)
Controls how long the pet remains in an active non-alert state without receiving new status updates before decaying back to the `idle` animation loop:
```json
"auto_return_seconds": 90
```
- **Type**: Number (seconds). Default: `90`.
- **Behavior**: If no new `status-update` event is received within this duration while in a non-alert active state (e.g. `thinking`, `reading`, `editing`, `searching`, `running`, `delegating`), the visual animation automatically plays the transition to `idle` (or returns directly to `idle` loop).
- **Alert preservation**: Alert states (`error`, `waiting`) **never** decay and will stay active until resolved.
- **Offline preservation**: Sleeping/offline states (`offline`) do not decay to `idle`.
- **State label**: The state label and status text always display the true business state from the assistant.

#### 3. Idle Variations (`idle_variations`)
Provides random one-shot animations while resting in `idle`:
```json
"idle_variations": {
  "idle": [
    "<pack-name>/blink.gif",
    "<pack-name>/look_around.gif"
  ]
}
```
- **Trigger**: When the pet has remained in `idle` continuously for 30 seconds without new events, a variation is randomly selected and played as a one-shot (~2s).
- **Completion**: Once finished, the pet returns to the base `idle` loop and resets the 30-second variation timer.
- **Silent degradation**: If a variation asset fails to load, it is silently skipped without interrupting the idle state.

#### 4. Session Watchdog (`watchdog`)
Controls watchdog timeouts to handle idle sessions and orphaned pet processes with a two-tier ladder (`sleep` → `exit`):
```json
"watchdog": {
  "enabled": true,
  "sleep_after_seconds": 900,
  "exit_after_seconds": 3600,
  "force_exit_after_seconds": 14400
}
```
- **`enabled`**: Boolean (default: `true`). If set to `false`, the session watchdog timer is completely disabled.
- **`sleep_after_seconds`**: Number (seconds, default: `900` / 15 minutes). When no real status update events have been received for this duration while in a quiescent state, the pet goes to sleep (`offline` state with `"Zzz... (session silent)"`).
- **`exit_after_seconds`**: Number (seconds, default: `3600` / 60 minutes). When no real status update events have been received for this duration while in a quiescent state, the pet window automatically exits/closes to avoid orphan processes.
- **`force_exit_after_seconds`**: Number (seconds, default: `14400` / 4 hours). Backstop for non-quiescent states: if the business state is stuck in a working state (e.g. the upstream session aggregator crashed mid-turn) and no real events arrive for this duration, the pet exits anyway.
- **Alert exemption**: Alert states (`error`, `waiting`) **never** trigger sleep or exit (the pet remains visible and attentive while waiting for user interaction or approval). Timing continues accumulating and is evaluated once leaving the alert state.
- **Quiescent gating**: Sleep and normal exit only trigger while the business state is quiescent (`idle` or `offline`). Long silence during working states (`working`, `editing`, `running`, `thinking`, `delegating`, `reading`, `searching`) usually means a long-running tool call, not an idle session — the pet stays awake and only the `force_exit_after_seconds` backstop applies.
- **Wake-up**: Any incoming real status update immediately resets the watchdog timer and wakes the pet up without special wake-up logic.
- **Backward Compatibility**: Packs omitting `watchdog` automatically use the default enabled settings (900s sleep / 3600s exit / 14400s force-exit).

#### 5. Priority & Interruption Rules
- **Alerts preempt everything**: Incoming alert states (`error`, `waiting`) immediately abort any running transition or idle variation and instantly switch to the alert state loop.
- **Status Text & State Label**: Reflect the true business state immediately, regardless of ongoing transition animations.
- **Backward Compatibility**: Packs created for v1 (omitting `transitions`, `idle_variations`, `auto_return_seconds`, or `watchdog`) continue to function identically to legacy behavior. All new fields are completely optional.

### Optional appearance recommendations

`appearance` is optional metadata, so existing packs are fully compatible. It
provides **recommendations**, not locked behaviour: a user's settings always
win over the pack, and omitted fields use the legacy `Full + Classic` defaults.

| Field | Values | Meaning |
|---|---|---|
| `motion` | `intrinsic`, `subtle`, `full` | `intrinsic` disables renderer transforms so an animated WebP/GIF owns its movement. |
| `uiPreset` | `minimal`, `classic`, `debug` | Chrome treatment around the art. |
| `artScale` | `0.7`–`1.5` | Art-only scale; it does not change window, bubble, or text scale. |
| `bubble` | `off`, `alerts`, `all` | Status-detail bubble visibility. |
| `stateLabel` | `off`, `minimal`, `alerts`, `always` | State visibility: `off` (hidden), `minimal` (compact diamond gem with hover tooltip), `alerts` (text label on error/waiting), `always` (text label always visible). |
| `identity` | `hidden`, `hover`, `always` | Session name visibility. |

For authored animated video packs, use `motion: "intrinsic"`, `bubble: "off"`,
`stateLabel: "off"`, and normally `identity: "hover"`.

## Step 4: Verify

After creating the pack, tell the user:

> "Character pack installed! Right-click the pet → Exit, then run `/pet on` to restart. Your character will appear under **Custom** in the right-click menu."

## Example: Creating from GIPHY

If the user wants a character from GIPHY or another source:

1. Search GIPHY for appropriate GIFs for each state
2. Download each GIF to the pack directory
3. Create `character.json` mapping states to filenames

```bash
# Example: download a GIF
curl -sLo "$PACK_DIR/idle.gif" "https://media.giphy.com/media/XXXXX/giphy.gif"
```

## Example: Creating from AI-generated images

If the user wants original art:

1. Generate images for each state using an image generation tool
2. Save them as PNG/GIF with transparent backgrounds
3. Resize to ~140×140px
4. Create `character.json` mapping states to filenames

## Example: Minimal pack (4 states)

For a quick pack with only essential states:

```json
{
  "name": "Simple Buddy",
  "type": "png",
  "states": {
    "idle":     ["simple-buddy/happy.png"],
    "thinking": ["simple-buddy/hmm.png"],
    "editing":  ["simple-buddy/typing.png"],
    "offline":  ["simple-buddy/sleep.png"]
  }
}
```

Missing states (reading, searching, running, etc.) will fall back to `idle`.

## Installing a Pack from URL or Local Path

### From URL (zip):

**PowerShell:**
```powershell
$charsDir = "$env:USERPROFILE\.claude\pet-data\characters"
New-Item -ItemType Directory -Path $charsDir -Force | Out-Null
$tmp = "$env:TEMP\pet-pack.zip"
Invoke-WebRequest -Uri "<URL>" -OutFile $tmp
Expand-Archive -Path $tmp -DestinationPath $charsDir -Force
Remove-Item $tmp
Write-Host "Pack installed. Restart pet to see it."
```

**bash:**
```bash
CHARS_DIR="$HOME/.claude/pet-data/characters"
mkdir -p "$CHARS_DIR"
curl -sLo /tmp/pet-pack.zip "<URL>"
unzip -o /tmp/pet-pack.zip -d "$CHARS_DIR"
rm -f /tmp/pet-pack.zip
echo "Pack installed. Restart pet to see it."
```

### From local path:

**PowerShell:**
```powershell
Copy-Item -Recurse "<LOCAL_PATH>" "$env:USERPROFILE\.claude\pet-data\characters\"
Write-Host "Pack installed. Restart pet to see it."
```

**bash:**
```bash
cp -r "<LOCAL_PATH>" "$HOME/.claude/pet-data/characters/"
echo "Pack installed. Restart pet to see it."
```

## Removing a Pack

**PowerShell:**
```powershell
$dir = "$env:USERPROFILE\.claude\pet-data\characters\<PACK_NAME>"
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force; Write-Host "Removed: <PACK_NAME>" }
else { Write-Host "Pack not found: <PACK_NAME>" }
```

**bash:**
```bash
rm -rf "$HOME/.claude/pet-data/characters/<PACK_NAME>" && echo "Removed" || echo "Pack not found"
```

## Listing Installed Packs

**PowerShell:**
```powershell
$dir = "$env:USERPROFILE\.claude\pet-data"
foreach ($sub in @("assets","characters")) {
    $d = "$dir\$sub"
    if (-not (Test-Path $d)) { continue }
    Get-ChildItem $d -Directory | Where-Object { Test-Path "$($_.FullName)\character.json" } | ForEach-Object {
        $cfg = Get-Content "$($_.FullName)\character.json" | ConvertFrom-Json
        $label = if ($sub -eq "assets") { "DLC" } else { "Custom" }
        Write-Host "${label}: $($cfg.name) ($($_.Name))"
    }
}
```

Tell the user to restart the pet after installing or removing packs: "Right-click → Exit, then `/pet on`."

## Pack Structure

```
~/.claude/pet-data/characters/my-character/
├── character.json
├── idle.gif
├── think.gif
├── edit.gif
├── search.gif
├── run.gif
├── error.gif
└── sleep.gif
```

## Exporting a Pack

To share a character pack with others, zip the pack directory:

**PowerShell:**
```powershell
$packName = "<PACK_NAME>"
$packDir = "$env:USERPROFILE\.claude\pet-data\characters\$packName"
$outFile = "$env:USERPROFILE\Desktop\$packName.zip"
if (Test-Path $packDir) {
    Compress-Archive -Path "$packDir\*" -DestinationPath $outFile -Force
    Write-Host "Exported to: $outFile"
} else { Write-Host "Pack not found: $packName" }
```

**bash:**
```bash
PACK_NAME="<PACK_NAME>"
PACK_DIR="$HOME/.claude/pet-data/characters/$PACK_NAME"
OUT_FILE="$HOME/Desktop/$PACK_NAME.zip"
if [ -d "$PACK_DIR" ]; then
    cd "$PACK_DIR" && zip -r "$OUT_FILE" . && echo "Exported to: $OUT_FILE"
else echo "Pack not found: $PACK_NAME"; fi
```

Tell the user: "Pack exported! Share the zip file. Recipients can install it with the import instructions below."

## Importing a Pack

To install a pack from a zip file shared by someone else:

**PowerShell:**
```powershell
$zipFile = "<PATH_TO_ZIP>"
$packName = [System.IO.Path]::GetFileNameWithoutExtension($zipFile)
$destDir = "$env:USERPROFILE\.claude\pet-data\characters\$packName"
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Expand-Archive -Path $zipFile -DestinationPath $destDir -Force
Write-Host "Imported: $packName — restart pet to see it."
```

**bash:**
```bash
ZIP_FILE="<PATH_TO_ZIP>"
PACK_NAME=$(basename "$ZIP_FILE" .zip)
DEST_DIR="$HOME/.claude/pet-data/characters/$PACK_NAME"
mkdir -p "$DEST_DIR"
unzip -o "$ZIP_FILE" -d "$DEST_DIR"
echo "Imported: $PACK_NAME — restart pet to see it."
```

Tell the user: "Pack imported! Right-click the pet → Exit, then `/pet on` to see it under Custom."
