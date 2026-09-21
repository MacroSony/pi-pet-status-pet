use notify::{EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder};

pub mod adapter;
pub mod status_map;
mod window_layout;
mod activity_area;
mod gathering;
use gathering::{request_gathering, set_gathering_interaction};
use activity_area::{open_activity_area, activity_area_editor_info, save_activity_area};
use window_layout::{calculate_companion_window_position, WindowRect};
#[cfg(test)]
mod tests;

static DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);
static WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

const ASSETS_REPO: &str = "moeyui1/claude-status-pet";

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    #[link_name = "GetAsyncKeyState"]
    fn get_async_key_state(virtual_key: i32) -> i16;
    #[link_name = "GetSystemMetrics"]
    fn get_system_metrics(index: i32) -> i32;
}

#[tauri::command]
fn is_primary_mouse_button_down() -> Option<bool> {
    #[cfg(target_os = "windows")]
    {
        const VK_LBUTTON: i32 = 0x01;
        const VK_RBUTTON: i32 = 0x02;
        const SM_SWAPBUTTON: i32 = 23;
        let virtual_key = if unsafe { get_system_metrics(SM_SWAPBUTTON) } != 0 {
            VK_RBUTTON
        } else {
            VK_LBUTTON
        };
        let state = unsafe { get_async_key_state(virtual_key) } as u16;
        Some((state & 0x8000) != 0)
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

fn init_debug(args: &[String]) {
    let _ = args; // reserved for future use
    if std::env::var("PET_DEBUG").map_or(false, |v| v == "1" || v == "true") {
        DEBUG_ENABLED.store(true, Ordering::Relaxed);
    }
}

fn debug_log(path: &PathBuf, msg: &str) {
    if !DEBUG_ENABLED.load(Ordering::Relaxed) {
        return;
    }
    // path can be a status file or the log file itself — resolve to pet-debug.log in same dir
    let log_path = if path.is_dir() {
        path.join("pet-debug.log")
    } else if path.file_name().map_or(false, |f| f == "pet-debug.log") {
        path.clone()
    } else {
        path.parent().unwrap_or(path).join("pet-debug.log")
    };
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            let millis = d.subsec_millis();
            let h = (secs % 86400) / 3600;
            let m = (secs % 3600) / 60;
            let s = secs % 60;
            format!("{:02}:{:02}:{:02}.{:03}", h, m, s, millis)
        })
        .unwrap_or_default();
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(f, "[{}] {}", timestamp, msg);
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct TeamPresentationMember {
    display_name: String,
    role: String,
    state: String,
    host: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct TeamBoardPresentation {
    status: String,
    revision: Option<u64>,
    markdown: String,
    updated_by: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct TeamPresentation {
    name: String,
    role: String,
    members: Vec<TeamPresentationMember>,
    board: TeamBoardPresentation,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppearanceContext {
    schema_version: String,
    source: String,
    instance_id: String,
    revision: u64,
    stack_key: Option<String>,
    profile_key: Option<String>,
    project_key: Option<String>,
}

#[derive(Clone, Serialize)]
struct StatusPayload {
    state: String,
    detail: String,
    tool: String,
    event: String,
    session_id: String,
    session_name: String,
    team: Option<TeamPresentation>,
    #[serde(rename = "appearance_context", skip_serializing_if = "Option::is_none")]
    appearance_context: Option<Option<AppearanceContext>>,
}

fn emit_status_update(handle: &tauri::AppHandle, status: StatusPayload) {
    let team = status.team.clone();
    let _ = handle.emit_to("main", "status-update", status);
    let _ = handle.emit_to("team-board", "team-presentation-update", team);
}

#[derive(Clone, Serialize, Deserialize)]
struct ReactionPayload {
    id: String,
    emotion: String,
    message: String,
    speak: bool,
    ts: u64,
    ttl_ms: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct PetEventPayload {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub emotion: Option<String>,
    #[serde(default)]
    pub speak: Option<bool>,
    #[serde(default)]
    pub priority: Option<u32>,
    #[serde(rename = "durationMs", default)]
    pub duration_ms: Option<u64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct PetEvent {
    #[serde(rename = "schemaVersion", default = "default_schema_version")]
    pub schema_version: String,
    #[serde(rename = "eventId")]
    pub event_id: String,
    #[serde(rename = "petId", default)]
    pub pet_id: String,
    #[serde(default = "default_expression_kind")]
    pub kind: String,
    #[serde(default)]
    pub payload: PetEventPayload,
    #[serde(rename = "createdAtMs", default)]
    pub created_at_ms: u64,
    #[serde(rename = "expiresAtMs", default)]
    pub expires_at_ms: u64,
}

fn default_schema_version() -> String { "1".to_string() }
fn default_expression_kind() -> String { "expression".to_string() }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
struct SavedWindowPosition {
    x: i32,
    y: i32,
}

fn read_window_position(path: &PathBuf) -> Option<SavedWindowPosition> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn write_window_position(path: &PathBuf, position: PhysicalPosition<i32>) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let saved = SavedWindowPosition { x: position.x, y: position.y };
    let Ok(content) = serde_json::to_vec(&saved) else { return };
    let _ = write_json_atomic(path, &content);
}

/// Write a file through a sibling temporary file, then rename it into place.
/// The direct-write fallback preserves the existing Windows behavior when the
/// platform refuses to rename over an open destination.
fn write_json_atomic(path: &PathBuf, content: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let counter = WRITE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temporary = path.with_extension(format!("{}.{}.tmp", std::process::id(), counter));
    fs::write(&temporary, content)?;
    match fs::rename(&temporary, path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            let _ = fs::remove_file(&temporary);
            // Windows cannot always atomically replace an existing destination.
            fs::write(path, content).map_err(|write_error| {
                std::io::Error::new(
                    write_error.kind(),
                    format!("rename failed ({}); direct write failed: {}", rename_error, write_error),
                )
            })
        }
    }
}

fn default_status_path() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("pet-data").join("status.json")
}

fn read_status(path: &PathBuf) -> Option<StatusPayload> {
    let content = fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&content).ok()?;
    let appearance_context = match v.get("appearance_context").or_else(|| v.get("appearanceContext")) {
        None => None,
        Some(value) if value.is_null() => Some(None),
        Some(value) => serde_json::from_value::<AppearanceContext>(value.clone()).ok()
            .filter(valid_appearance_context).map(Some),
    };
    let team = v.get("team")
        .filter(|value| !value.is_null())
        .and_then(|value| serde_json::from_value::<TeamPresentation>(value.clone()).ok())
        .filter(is_valid_team_presentation);
    Some(StatusPayload {
        state: v["state"].as_str().unwrap_or("idle").to_string(),
        detail: v["detail"].as_str().unwrap_or("").to_string(),
        tool: v["tool"].as_str().unwrap_or("").to_string(),
        event: v["event"].as_str().unwrap_or("").to_string(),
        session_id: v["session_id"].as_str().unwrap_or("").to_string(),
        session_name: v["session_name"].as_str().unwrap_or("").to_string(),
        team,
        appearance_context,
    })
}

fn valid_appearance_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && !value.contains("..") && value.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

fn valid_appearance_scope(value: &str) -> bool {
    let Some((kind, name)) = value.split_once(':') else { return false; };
    matches!(kind, "global" | "project") && valid_appearance_id(name)
}

fn valid_project_key(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit()) && value.chars().all(|c| !c.is_ascii_uppercase())
}

fn valid_appearance_context(value: &AppearanceContext) -> bool {
    value.schema_version == "1"
        && value.source == "pi-forge"
        && valid_appearance_id(&value.instance_id)
        && value.revision <= 9_007_199_254_740_991
        && value.stack_key.as_ref().map_or(true, |v| valid_appearance_scope(v))
        && value.profile_key.as_ref().map_or(true, |v| valid_appearance_scope(v))
        && value.project_key.as_ref().map_or(true, |v| valid_project_key(v))
}

fn has_forbidden_presentation_control(value: &str) -> bool {
    value.chars().any(|ch| matches!(ch as u32, 0..=8 | 11 | 12 | 14..=31 | 127..=159))
}

fn valid_bounded_single_line(value: &str, max_chars: usize) -> bool {
    !value.chars().any(|ch| ch.is_control()) && value.chars().count() <= max_chars
}

fn is_valid_team_presentation(team: &TeamPresentation) -> bool {
    const ROLES: [&str; 3] = ["leader", "member", "observer"];
    const STATES: [&str; 11] = [
        "idle", "thinking", "reading", "editing", "searching", "running",
        "delegating", "waiting", "error", "closed", "offline",
    ];
    if team.name.trim().is_empty() || !valid_bounded_single_line(&team.name, 80) || !ROLES.contains(&team.role.as_str()) {
        return false;
    }
    if team.members.is_empty() || team.members.len() > 8 {
        return false;
    }
    for member in &team.members {
        if member.display_name.trim().is_empty()
            || !valid_bounded_single_line(&member.display_name, 120)
            || !valid_bounded_single_line(&member.host, 80)
            || !ROLES.contains(&member.role.as_str())
            || !STATES.contains(&member.state.as_str())
        {
            return false;
        }
    }
    if !matches!(team.board.status.as_str(), "ready" | "unavailable")
        || !valid_bounded_single_line(&team.board.updated_by, 120)
        || team.board.markdown.len() > 8192
        || has_forbidden_presentation_control(&team.board.markdown)
    {
        return false;
    }
    match team.board.status.as_str() {
        "ready" => team.board.revision.is_some(),
        "unavailable" => team.board.revision.is_none() && team.board.markdown.is_empty(),
        _ => false,
    }
}

fn default_pi_pet_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("PI_PET_DATA_DIR").map(PathBuf::from) {
        return dir;
    }
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".pi-pet")
}

fn resolve_event_path_with_env<F>(status_path: &PathBuf, pet_id: &str, env_var: F) -> PathBuf
where
    F: Fn(&str) -> Option<std::ffi::OsString>,
{
    if let Some(dir) = env_var("PI_PET_DATA_DIR").map(PathBuf::from) {
        return dir.join("events").join(format!("event-{}.json", pet_id));
    }
    if let Some(status_dir) = env_var("CLAWD_PET_BRIDGE_STATUS_DIR").map(PathBuf::from) {
        if let Some(parent) = status_dir.parent() {
            return parent.join("events").join(format!("event-{}.json", pet_id));
        }
    }
    if let Some(parent) = status_path.parent() {
        if parent.file_name().map_or(false, |n| n == "status") {
            if let Some(grandparent) = parent.parent() {
                return grandparent.join("events").join(format!("event-{}.json", pet_id));
            }
        }
        let sibling_events = parent.join("events").join(format!("event-{}.json", pet_id));
        if sibling_events.parent().map_or(false, |p| p.exists()) {
            return sibling_events;
        }
    }
    let home = env_var("USERPROFILE")
        .or_else(|| env_var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".pi-pet").join("events").join(format!("event-{}.json", pet_id))
}

pub fn resolve_event_path(status_path: &PathBuf, pet_id: &str) -> PathBuf {
    resolve_event_path_with_env(status_path, pet_id, |name| std::env::var_os(name))
}

pub fn read_pet_event(path: &PathBuf, log_path: &PathBuf) -> Option<PetEvent> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) => {
            debug_log(log_path, &format!("PetEvent read failed: {}", e));
            return None;
        }
    };
    match serde_json::from_str::<PetEvent>(&content) {
        Ok(event) => {
            let now = timestamp_millis();
            if event.expires_at_ms > 0 && now > event.expires_at_ms {
                debug_log(log_path, &format!("PetEvent expired: now={}, expiresAtMs={}", now, event.expires_at_ms));
                return None;
            }
            Some(event)
        }
        Err(e) => {
            debug_log(log_path, &format!("PetEvent parse failed: {}", e));
            None
        }
    }
}

fn read_reaction(path: &PathBuf, log_path: &PathBuf) -> Option<ReactionPayload> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) => {
            debug_log(log_path, &format!("Reaction read failed: {}", e));
            return None;
        }
    };
    match serde_json::from_str::<ReactionPayload>(&content) {
        Ok(payload) => Some(payload),
        Err(e) => {
            // Reaction files are an optional channel; malformed files are ignored.
            debug_log(log_path, &format!("Reaction JSON ignored: {}", e));
            None
        }
    }
}

#[tauri::command]
fn get_status(status_path: tauri::State<'_, Arc<Mutex<PathBuf>>>) -> Option<StatusPayload> {
    let path = status_path.lock().unwrap();
    read_status(&path)
}

#[tauri::command]
fn get_team_presentation(status_path: tauri::State<'_, Arc<Mutex<PathBuf>>>) -> Option<TeamPresentation> {
    let path = status_path.lock().unwrap();
    read_status(&path).and_then(|status| status.team)
}

#[derive(Clone, Default)]
struct BoardLockState(Arc<Mutex<Option<PathBuf>>>);

fn hash_team_board_key_part(hash: &mut u64, value: &str) {
    for byte in value.len().to_le_bytes().iter().chain(value.as_bytes()) {
        *hash ^= *byte as u64;
        *hash = hash.wrapping_mul(0x100000001b3);
    }
}

fn derive_team_board_lock_key(team: &TeamPresentation) -> String {
    let mut members: Vec<(&str, &str)> = team
        .members
        .iter()
        .map(|member| (member.display_name.trim(), member.host.trim()))
        .collect();
    members.sort_unstable();
    members.dedup();

    let mut hash = 0xcbf29ce484222325_u64;
    hash_team_board_key_part(&mut hash, team.name.trim());
    for (name, host) in members {
        hash_team_board_key_part(&mut hash, name);
        hash_team_board_key_part(&mut hash, host);
    }
    format!("{:016x}", hash)
}

fn derive_team_board_lock_path(status_path: &Path, team: &TeamPresentation) -> PathBuf {
    let status_dir = status_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(default_pet_dir);
    status_dir.join(format!("team-board-{}.lock", derive_team_board_lock_key(team)))
}

#[derive(Debug, PartialEq, Eq)]
enum BoardLockClaim {
    Acquired,
    HeldByLiveProcess,
}

fn claim_board_lock(lock_path: &Path) -> std::io::Result<BoardLockClaim> {
    if let Some(parent) = lock_path.parent() {
        fs::create_dir_all(parent)?;
    }
    for _ in 0..2 {
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(lock_path)
        {
            Ok(mut file) => {
                if let Err(error) = file.write_all(std::process::id().to_string().as_bytes()) {
                    let _ = fs::remove_file(lock_path);
                    return Err(error);
                }
                return Ok(BoardLockClaim::Acquired);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if is_lock_alive(&lock_path.to_path_buf()) {
                    return Ok(BoardLockClaim::HeldByLiveProcess);
                }
                match fs::remove_file(lock_path) {
                    Ok(()) => {}
                    Err(remove_error) if remove_error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(remove_error) => return Err(remove_error),
                }
            }
            Err(error) => return Err(error),
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::WouldBlock,
        "could not claim Team Board lock",
    ))
}

#[derive(Debug, PartialEq, Eq)]
enum WindowDestroyOutcome {
    PetLockCleaned(PathBuf),
    BoardLockCleaned(PathBuf),
    NoOp,
}

fn handle_window_moved_logic(
    window_label: &str,
    session_id: &str,
    positions_dir: &Path,
    position: PhysicalPosition<i32>,
) -> Option<PathBuf> {
    if window_label == "main" && !session_id.is_empty() && is_safe_session_id(session_id) {
        let path = positions_dir.join(format!("{}.json", session_id));
        write_window_position(&path, position);
        Some(path)
    } else {
        None
    }
}

fn handle_window_destroyed_logic(
    window_label: &str,
    pet_lock: &Mutex<Option<PathBuf>>,
    board_lock: &Mutex<Option<PathBuf>>,
) -> WindowDestroyOutcome {
    let state = match window_label {
        "main" => pet_lock,
        "team-board" => board_lock,
        _ => return WindowDestroyOutcome::NoOp,
    };
    let lock = state.lock().unwrap().take();
    let Some(lock) = lock else {
        return WindowDestroyOutcome::NoOp;
    };
    let _ = fs::remove_file(&lock);
    if window_label == "main" {
        WindowDestroyOutcome::PetLockCleaned(lock)
    } else {
        WindowDestroyOutcome::BoardLockCleaned(lock)
    }
}

#[tauri::command]
async fn open_team_board(
    app: tauri::AppHandle,
    status_path: tauri::State<'_, Arc<Mutex<PathBuf>>>,
    board_lock_state: tauri::State<'_, BoardLockState>,
) -> Result<bool, String> {
    let (status_path_buf, team) = {
        let path = status_path
            .lock()
            .map_err(|_| "status path unavailable".to_string())?
            .clone();
        let team = read_status(&path).and_then(|status| status.team);
        (path, team)
    };
    let Some(team) = team else {
        return Ok(false);
    };

    if let Some(window) = app.get_webview_window("team-board") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(true);
    }

    let board_lock_path = derive_team_board_lock_path(&status_path_buf, &team);
    match claim_board_lock(&board_lock_path).map_err(|error| error.to_string())? {
        BoardLockClaim::HeldByLiveProcess => return Ok(true),
        BoardLockClaim::Acquired => {}
    }
    *board_lock_state.0.lock().unwrap() = Some(board_lock_path.clone());

    let build_result = WebviewWindowBuilder::new(
        &app,
        "team-board",
        WebviewUrl::App("board.html".into()),
    )
        .title("Pi Pet Team Board")
        .inner_size(520.0, 620.0)
        .min_inner_size(380.0, 420.0)
        .resizable(true)
        .decorations(true)
        .transparent(false)
        .always_on_top(false)
        .skip_taskbar(false)
        .focused(true)
        .build();

    match build_result {
        Ok(_) => Ok(true),
        Err(error) => {
            if let Some(lock) = board_lock_state.0.lock().unwrap().take() {
                let _ = fs::remove_file(lock);
            }
            Err(error.to_string())
        }
    }
}

#[tauri::command]
async fn open_pet_chat(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("pet-chat") {
        let _ = window.unminimize();
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(true);
    }

    const CHAT_WIDTH: f64 = 360.0;
    const CHAT_HEIGHT: f64 = 520.0;
    const CHAT_GAP: u32 = 12;

    let chat_position = app.get_webview_window("main").and_then(|pet_window| {
        let pet_position = pet_window.outer_position().ok()?;
        let pet_size = pet_window.outer_size().ok()?;
        let monitor = pet_window.current_monitor().ok().flatten()?;
        let work_area = monitor.work_area();
        let scale_factor = if monitor.scale_factor().is_finite() && monitor.scale_factor() > 0.0 {
            monitor.scale_factor()
        } else {
            1.0
        };
        let chat_width = (CHAT_WIDTH * scale_factor).round().max(1.0) as u32;
        let chat_height = (CHAT_HEIGHT * scale_factor).round().max(1.0) as u32;

        Some(calculate_companion_window_position(
            WindowRect {
                x: work_area.position.x,
                y: work_area.position.y,
                width: work_area.size.width,
                height: work_area.size.height,
            },
            WindowRect {
                x: pet_position.x,
                y: pet_position.y,
                width: pet_size.width,
                height: pet_size.height,
            },
            chat_width,
            chat_height,
            (CHAT_GAP as f64 * scale_factor).round().max(1.0) as u32,
        ))
    });

    let build_result = WebviewWindowBuilder::new(
        &app,
        "pet-chat",
        WebviewUrl::App("chat.html".into()),
    )
        .title("Pi Pet Chat")
        .inner_size(CHAT_WIDTH, CHAT_HEIGHT)
        .min_inner_size(320.0, 400.0)
        .resizable(true)
        .decorations(false)
        .transparent(false)
        .always_on_top(false)
        .skip_taskbar(false)
        .focused(false)
        .visible(false)
        .build();

    match build_result {
        Ok(window) => {
            if let Some(position) = chat_position {
                window
                    .set_position(Position::Physical(PhysicalPosition::new(position.x, position.y)))
                    .map_err(|error| error.to_string())?;
            }
            window.show().map_err(|error| error.to_string())?;
            window.set_focus().map_err(|error| error.to_string())?;
            Ok(true)
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn get_event(status_path: tauri::State<'_, Arc<Mutex<PathBuf>>>, session_id: tauri::State<'_, Arc<Mutex<String>>>) -> Option<PetEvent> {
    let path = status_path.lock().unwrap();
    let sid = session_id.lock().unwrap();
    if sid.is_empty() { return None; }
    let event_path = resolve_event_path(&path, &sid);
    read_pet_event(&event_path, &path)
}

#[tauri::command]
fn get_session_id(session_id: tauri::State<'_, Arc<Mutex<String>>>) -> String {
    session_id.lock().unwrap().clone()
}

#[tauri::command]
fn get_assets_dir(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Option<String> {
    assets_dir.inner().as_ref().map(|p| p.to_string_lossy().to_string())
}

#[derive(Clone, Serialize, Deserialize)]
struct SessionInfo {
    session_id: String,
    session_name: String,
    state: String,
    detail: String,
    status_file: String,
    last_modified: u64,
}

#[tauri::command]
fn list_unlocked_sessions() -> Vec<SessionInfo> {
    let mut sessions = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    let pi_pet_status_dir = default_pi_pet_dir().join("status");
    let dirs = [pi_pet_status_dir, default_pet_dir()];

    for pet_dir in &dirs {
        let Ok(entries) = fs::read_dir(pet_dir) else { continue };
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name();
            let name_str = name.to_string_lossy().to_string();
            if name_str.starts_with("status-") && name_str.ends_with(".json") {
                let sid = name_str.strip_prefix("status-").unwrap().strip_suffix(".json").unwrap().to_string();
                if !seen_ids.insert(sid.clone()) {
                    continue;
                }
                let lock_file = pet_dir.join(format!("pet-{}.lock", sid));
                if is_lock_alive(&lock_file) {
                    continue; // already has a running pet
                }
                // Clean up dead lock file
                if lock_file.exists() {
                    let _ = fs::remove_file(&lock_file);
                }
                let status_path = entry.path();
                let last_modified = status_path.metadata()
                    .and_then(|m| m.modified())
                    .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
                    .unwrap_or(0);
                let (sname, state, detail) = if let Some(s) = read_status(&status_path) {
                    (s.session_name, s.state, s.detail)
                } else {
                    (String::new(), "idle".to_string(), String::new())
                };
                sessions.push(SessionInfo {
                    session_id: sid,
                    session_name: sname,
                    state,
                    detail,
                    status_file: status_path.to_string_lossy().to_string(),
                    last_modified,
                });
            }
        }
    }
    sessions
}

#[tauri::command]
fn bind_session(
    session_id: String,
    status_path_state: tauri::State<'_, Arc<Mutex<PathBuf>>>,
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
    lock_path_state: tauri::State<'_, Arc<Mutex<Option<PathBuf>>>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if !is_safe_session_id(&session_id) {
        return Err("Invalid session ID".to_string());
    }
    let pi_pet_status = default_pi_pet_dir().join("status").join(format!("status-{}.json", session_id));
    let legacy_status = default_pet_dir().join(format!("status-{}.json", session_id));

    let status_file = if pi_pet_status.exists() {
        pi_pet_status
    } else if legacy_status.exists() {
        legacy_status
    } else {
        pi_pet_status
    };

    let lock_dir = status_file.parent().unwrap_or(&default_pet_dir()).to_path_buf();
    let lock_file = lock_dir.join(format!("pet-{}.lock", session_id));

    if is_lock_alive(&lock_file) {
        return Err("Session already has a running pet".to_string());
    }
    write_lock_file(&lock_file);

    // Update shared state
    *status_path_state.lock().unwrap() = status_file.clone();
    *session_id_state.lock().unwrap() = session_id.clone();
    *lock_path_state.lock().unwrap() = Some(lock_file);

    // Picker-bound sessions did not have a startup position path. Persist the
    // current geometry immediately; later move events resolve the bound ID
    // dynamically and keep this file current.
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(position) = window.outer_position() {
            let position_path = default_pet_dir()
                .join("positions")
                .join(format!("{}.json", session_id));
            write_window_position(&position_path, position);
        }
    }

    // Emit initial status only to the pet; the Board receives the ID-free Team projection.
    if let Some(status) = read_status(&status_file) {
        emit_status_update(&app, status);
    }

    // Start file watcher in a background thread. Both files live in the same
    // directory, so one watcher can service the bound status and reaction.
    let watch_path = status_file.clone();
    let reaction_path = default_pet_dir().join(format!("reaction-{}.json", session_id));
    let event_path = resolve_event_path(&watch_path, &session_id);
    let log_path = status_file.clone();
    let bound_session_state = session_id_state.inner().clone();
    let bound_session = session_id.clone();
    let handle = app.clone();
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                debug_log(&log_path, &format!("FATAL: watcher init failed: {}", e));
                return;
            }
        };
        let mut watched_dirs = std::collections::HashSet::new();
        if let Some(p) = watch_path.parent() {
            let _ = fs::create_dir_all(p);
            if watched_dirs.insert(p.to_path_buf()) {
                let _ = watcher.watch(p, RecursiveMode::NonRecursive);
            }
        }
        if let Some(p) = event_path.parent() {
            let _ = fs::create_dir_all(p);
            if watched_dirs.insert(p.to_path_buf()) {
                let _ = watcher.watch(p, RecursiveMode::NonRecursive);
            }
        }
        if let Some(p) = reaction_path.parent() {
            let _ = fs::create_dir_all(p);
            if watched_dirs.insert(p.to_path_buf()) {
                let _ = watcher.watch(p, RecursiveMode::NonRecursive);
            }
        }
        debug_log(&log_path, &format!("Watcher started on {:?} (bind_session)", watched_dirs));

        if let Some(event) = read_pet_event(&event_path, &log_path) {
            let _ = handle.emit("pet-event", event);
        }

        for event in rx {
            if let Ok(event) = event {
                // A previous bind watcher may still be draining its channel.
                // Do not let it emit after the frontend has switched sessions.
                if *bound_session_state.lock().unwrap() != bound_session {
                    continue;
                }
                let is_status_file = event.paths.iter().any(|p| *p == watch_path);
                let is_event_file = event.paths.iter().any(|p| *p == event_path);
                let is_reaction_file = event.paths.iter().any(|p| *p == reaction_path);
                if !is_status_file && !is_event_file && !is_reaction_file { continue; }
                debug_log(&log_path, &format!("bind_session event: {:?}, paths: {:?}", event.kind, event.paths));
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        if *bound_session_state.lock().unwrap() != bound_session {
                            continue;
                        }
                        if is_event_file {
                            if let Some(pet_event) = read_pet_event(&event_path, &log_path) {
                                let _ = handle.emit("pet-event", pet_event);
                            }
                        } else if is_reaction_file {
                            if let Some(reaction) = read_reaction(&reaction_path, &log_path) {
                                let _ = handle.emit("reaction-event", reaction);
                            }
                        } else if is_status_file {
                            if let Some(status) = read_status(&watch_path) {
                                debug_log(&log_path, &format!("bind_session emit: state={}, detail={}", status.state, status.detail));
                                emit_status_update(&handle, status);
                            }
                        }
                    }
                    EventKind::Remove(_) if is_status_file => {
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        if *bound_session_state.lock().unwrap() != bound_session {
                            continue;
                        }
                        if watch_path.exists() {
                            if let Some(status) = read_status(&watch_path) {
                                emit_status_update(&handle, status);
                            }
                        } else {
                            emit_status_update(&handle, StatusPayload {
                                state: "closed".to_string(),
                                detail: "Session ended".to_string(),
                                tool: String::new(),
                                event: "SessionEnd".to_string(),
                                session_id: String::new(),
                                session_name: String::new(),
                                team: None,
                                appearance_context: None,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn is_dlc_installed(assets_dir: tauri::State<'_, Option<PathBuf>>, dlc_name: String) -> bool {
    if let Some(dir) = assets_dir.inner().as_ref() {
        let dlc_dir = dir.join(&dlc_name);
        let char_json = dlc_dir.join("character.json");
        if !char_json.exists() { return false; }
        // Check if any asset files exist
        if let Ok(entries) = fs::read_dir(&dlc_dir) {
            return entries.filter_map(|e| e.ok()).any(|e| {
                matches!(
                    e.path().extension().and_then(|ext| ext.to_str()),
                    Some("gif" | "svg" | "png" | "webp")
                )
            });
        }
    }
    false
}

#[tauri::command]
async fn download_dlc(assets_dir: tauri::State<'_, Option<PathBuf>>, dlc_name: String) -> Result<bool, String> {
    let dir = assets_dir.inner().as_ref().ok_or("No assets directory configured")?.clone();
    let dlc = dlc_name.clone();

    tauri::async_runtime::spawn_blocking(move || {
        download_dlc_blocking(&dir, &dlc)
    }).await.map_err(|e| e.to_string())?
}

fn download_dlc_blocking(dir: &PathBuf, dlc_name: &str) -> Result<bool, String> {
    if !is_safe_session_id(dlc_name) {
        return Err("Invalid DLC name".to_string());
    }

    // Read DLC config from dlc/<name>.json
    let config_path = dir.join("dlc").join(format!("{}.json", dlc_name));
    let config_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("DLC config not found: {}: {}", config_path.display(), e))?;
    let config: serde_json::Value = serde_json::from_str(&config_str)
        .map_err(|e| format!("Invalid DLC config: {}", e))?;

    let downloads = config["downloads"].as_array()
        .ok_or_else(|| "DLC config missing 'downloads' array".to_string())?;

    let dlc_dir = dir.join(dlc_name);
    fs::create_dir_all(&dlc_dir)
        .map_err(|e| format!("Failed to create DLC directory: {}", e))?;

    // Download each file (validate paths stay within assets dir)
    let dir_canonical = dir.canonicalize().map_err(|e| format!("Invalid assets dir: {}", e))?;
    let mut failed = Vec::new();
    for item in downloads {
        let path = item["path"].as_str().unwrap_or("");
        let url = item["url"].as_str().unwrap_or("");
        if path.is_empty() || url.is_empty() { continue; }
        // Path traversal prevention: ensure dest stays within assets dir
        let dest = dir.join(path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory for {}: {}", path, e))?;
        }
        let dest_parent = dest.parent()
            .and_then(|p| p.canonicalize().ok())
            .ok_or_else(|| format!("Invalid path: {}", path))?;
        if !dest_parent.starts_with(&dir_canonical) {
            return Err(format!("Path traversal blocked: {}", path));
        }
        match download_file(url, &dest) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Failed to download {}: {}", path, e);
                failed.push(path.to_string());
            }
        }
    }

    if !failed.is_empty() {
        return Err(format!("Failed to download: {}", failed.join(", ")));
    }

    // Write character.json from the states in the DLC config
    let mut character = serde_json::json!({
        "name": config["name"],
        "type": config["type"],
        "states": config["states"]
    });
    if let Some(ver) = config.get("version") {
        character["version"] = ver.clone();
    }
    // `appearance` is optional presentation metadata. Keep it when installing
    // DLCs, while retaining the deliberately small, trusted character schema.
    if let Some(appearance) = config.get("appearance") {
        character["appearance"] = appearance.clone();
    }
    fs::write(dlc_dir.join("character.json"), serde_json::to_string_pretty(&character).unwrap())
        .map_err(|e| format!("Failed to write character.json: {}", e))?;

    Ok(true)
}

#[tauri::command]
fn load_asset(assets_dir: tauri::State<'_, Option<PathBuf>>, path: String) -> Option<String> {
    use base64::Engine;
    let dir = assets_dir.inner().as_ref()?;
    let file_path = dir.join(&path);
    let bytes = fs::read(&file_path).ok()?;
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = match ext {
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn load_text_asset(assets_dir: tauri::State<'_, Option<PathBuf>>, path: String) -> Option<String> {
    let dir = assets_dir.inner().as_ref()?;
    // Try assets dir first, then custom characters dir
    let asset_path = dir.join(&path);
    if let Ok(content) = fs::read_to_string(&asset_path) {
        return Some(content);
    }
    let custom_path = dir.parent()?.join("characters").join(&path);
    fs::read_to_string(&custom_path).ok()
}

#[tauri::command]
fn load_custom_asset(assets_dir: tauri::State<'_, Option<PathBuf>>, path: String) -> Option<String> {
    use base64::Engine;
    let dir = assets_dir.inner().as_ref()?;
    // Try assets dir, then custom characters dir
    let file_path = dir.join(&path);
    let file_path = if file_path.exists() { file_path } else { dir.parent()?.join("characters").join(&path) };
    let bytes = fs::read(&file_path).ok()?;
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = match ext {
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, b64))
}

#[derive(Clone, Serialize)]
struct DlcInfo {
    id: String,
    name: String,
    installed: bool,
}

#[tauri::command]
fn list_available_dlcs(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Vec<DlcInfo> {
    let mut dlcs = Vec::new();

    // Scan dlc/*.json in assets dir, with fallback to default pet-data/assets/dlc/
    let dirs_to_check: Vec<PathBuf> = if let Some(dir) = assets_dir.inner().as_ref() {
        vec![dir.clone()]
    } else {
        vec![default_pet_dir().join("assets")]
    };

    for dir in &dirs_to_check {
        let dlc_dir = dir.join("dlc");
        let Ok(entries) = fs::read_dir(&dlc_dir) else { continue };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
            let id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            if dlcs.iter().any(|d: &DlcInfo| d.id == id) { continue; }
            let Ok(content) = fs::read_to_string(&path) else { continue };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) else { continue };
            let name = v["name"].as_str().unwrap_or(&id).to_string();
            let installed = dir.join(&id).join("character.json").exists();
            dlcs.push(DlcInfo { id, name, installed });
        }
    }
    dlcs
}

#[derive(Clone, Serialize)]
struct CharacterPack {
    id: String,
    name: String,
    #[serde(rename = "type")]
    char_type: String,
    group: String,
    installed: bool,
    config_path: String,
}

#[tauri::command]
fn list_character_packs(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Vec<CharacterPack> {
    let mut packs = Vec::new();

    if let Some(dir) = assets_dir.inner().as_ref() {
        // Scan assets dir (DLC: mona, kuromi, etc.)
        scan_packs_in_dir(dir, "dlc", &mut packs);

        // Scan custom characters dir (sibling to assets)
        let custom_dir = dir.parent().map(|p| p.join("characters")).unwrap_or_default();
        if custom_dir.is_dir() {
            scan_packs_in_dir(&custom_dir, "custom", &mut packs);
        }
    }

    packs
}

fn scan_packs_in_dir(dir: &PathBuf, group: &str, packs: &mut Vec<CharacterPack>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let config_path = path.join("character.json");
            let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    packs.push(CharacterPack {
                        id: id.clone(),
                        name: v["name"].as_str().unwrap_or(&id).to_string(),
                        char_type: v["type"].as_str().unwrap_or("gif").to_string(),
                        group: group.to_string(),
                        installed: true,
                        config_path: config_path.to_string_lossy().to_string(),
                    });
                }
            } else {
                // Directory exists but no character.json — check if has image files
                let has_images = fs::read_dir(&path).ok().map_or(false, |entries| {
                    entries.filter_map(|e| e.ok()).any(|e| {
                        let ext = e.path().extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
                        ext == "gif" || ext == "svg" || ext == "png" || ext == "webp"
                    })
                });
                if has_images {
                    packs.push(CharacterPack {
                        id,
                        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        char_type: "gif".to_string(),
                        group: group.to_string(),
                        installed: true,
                        config_path: String::new(),
                    });
                }
            }
        }
    }
}

/// CLI: write-status subcommand
/// Reads event info from CLI args or stdin (via adapter), writes status JSON, exits.
fn cmd_write_status(args: &[String]) {
    init_debug(args);
    let pet_dir = default_pet_dir();
    let _ = fs::create_dir_all(&pet_dir);
    let log_path = pet_dir.join("pet-debug.log");  // dummy file path for debug_log
    let t0 = std::time::Instant::now();

    debug_log(&log_path, &format!("write-status START args={:?}", &args[1..]));

    // Parse CLI args
    let adapter_name = get_arg(args, "--adapter");
    let event_arg = get_arg(args, "--event");
    let tool_arg = get_arg(args, "--tool").unwrap_or_default();
    let detail_arg = get_arg(args, "--detail").unwrap_or_default();
    let session_id_arg = get_arg(args, "--session-id");
    let session_name_arg = get_arg(args, "--session-name");

    let (event, tool, detail, session_id, session_name, launch_only) =
        if let Some(adapter_name) = &adapter_name {
            // Adapter mode: read stdin JSON
            debug_log(&log_path, "reading stdin...");
            let stdin_data = read_stdin();
            debug_log(&log_path, &format!("stdin read in {:?}, len={}, data={}", t0.elapsed(), stdin_data.len(), &stdin_data));
            let stdin: adapter::StdinInput = serde_json::from_str(&stdin_data).unwrap_or_default();

            if let Some(adapter) = adapter::get_adapter(adapter_name) {
                if let Some(ev) = adapter.parse(&stdin) {
                    (ev.event, ev.tool, ev.detail, ev.session_id, ev.session_name, ev.launch_only)
                } else {
                    return;
                }
            } else {
                eprintln!("Unknown adapter: {}", adapter_name);
                std::process::exit(1);
            }
        } else if let Some(event) = event_arg {
            // CLI args mode
            let sid = session_id_arg.unwrap_or_else(|| "cli".to_string());
            let sname = session_name_arg.unwrap_or_else(|| sid.clone());
            let detail = if detail_arg.is_empty() {
                status_map::tool_detail(&tool_arg, "", "")
            } else {
                detail_arg
            };
            (event, tool_arg, detail, sid, sname, false)
        } else {
            eprintln!("Usage: claude-status-pet write-status --event <prompt|tool|done|error|offline> [--tool <name>] [--detail <text>] [--session-id <id>]");
            eprintln!("   or: claude-status-pet write-status --adapter <claude|copilot|vscode> < stdin.json");
            std::process::exit(1);
        };

    // Determine state from event + tool
    let state = if event == "tool" && !tool.is_empty() {
        status_map::tool_to_state(&tool)
    } else {
        status_map::event_to_state(&event)
    };

    if !is_safe_session_id(&session_id) {
        eprintln!("Invalid session ID");
        std::process::exit(1);
    }

    let status_file = pet_dir.join(format!("status-{}.json", session_id));

    debug_log(&log_path, &format!("writing state={} tool={} to {:?}", state, tool, status_file));

    // launch_only: don't write status (e.g. Copilot sessionStart — GUI launch handled by hook script)
    if launch_only {
        debug_log(&log_path, "launch_only — skipping status write");
    } else {
        let status = serde_json::json!({
            "state": state, "detail": detail, "tool": tool,
            "event": event, "session_id": session_id,
            "session_name": session_name, "timestamp": timestamp()
        });
        let content = status.to_string();
        let _ = write_json_atomic(&status_file, content.as_bytes());
    }

    // Output session info to stdout (hook script captures this to launch GUI)
    println!("{}\t{}", status_file.to_string_lossy(), session_id);

    debug_log(&log_path, &format!("file written in {:?}", t0.elapsed()));
    debug_log(&log_path, &format!("write-status DONE in {:?}", t0.elapsed()));
}

/// CLI: write one temporary reaction event for a session.
fn cmd_react(args: &[String]) {
    init_debug(args);
    let pet_dir = default_pet_dir();
    if let Err(e) = fs::create_dir_all(&pet_dir) {
        eprintln!("Failed to create pet data directory: {}", e);
        std::process::exit(1);
    }
    let log_path = pet_dir.join("pet-debug.log");

    let emotion = get_arg(args, "--emotion").unwrap_or_default();
    if !matches!(emotion.as_str(), "happy" | "sad" | "shocked" | "celebrate" | "shy" | "drag") {
        eprintln!("Unknown emotion: {} (expected happy, sad, shocked, celebrate, shy, or drag)", emotion);
        std::process::exit(1);
    }
    let Some(message) = get_arg(args, "--message") else {
        eprintln!("Usage: claude-status-pet react --emotion <happy|sad|shocked|celebrate|shy|drag> --message <text> --session <id> [--speak]");
        std::process::exit(1);
    };
    let Some(session_id) = get_arg(args, "--session") else {
        eprintln!("Usage: claude-status-pet react --emotion <happy|sad|shocked|celebrate|shy|drag> --message <text> --session <id> [--speak]");
        std::process::exit(1);
    };
    if !is_safe_session_id(&session_id) {
        eprintln!("Invalid session ID");
        std::process::exit(1);
    }

    let ts = timestamp_millis();
    let suffix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let id = format!("{}-{:x}-{:x}", ts, std::process::id(), suffix);
    let reaction = serde_json::json!({
        "id": id,
        "emotion": emotion,
        "message": message,
        "speak": args.iter().any(|arg| arg == "--speak"),
        "ts": ts,
        "ttl_ms": 10000u64,
    });
    let reaction_file = pet_dir.join(format!("reaction-{}.json", session_id));
    let content = reaction.to_string();
    if let Err(e) = write_json_atomic(&reaction_file, content.as_bytes()) {
        debug_log(&log_path, &format!("reaction write failed: {}", e));
        eprintln!("Failed to write reaction: {}", e);
        std::process::exit(1);
    }

    println!("{}", reaction_file.to_string_lossy());
}

fn timestamp_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn cleanup_stale_status(pet_dir: &PathBuf) {
    let Ok(entries) = fs::read_dir(pet_dir) else { return };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(24 * 3600);
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with("status-") && name_str.ends_with(".json") {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if modified < cutoff {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
        // Also clean up orphaned lock files whose process is no longer alive
        if name_str.starts_with("pet-") && name_str.ends_with(".lock") {
            if !is_lock_alive(&entry.path().to_path_buf()) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

fn is_safe_session_id(id: &str) -> bool {
    !id.is_empty() && !id.contains('/') && !id.contains('\\') && !id.contains("..")
}

fn is_safe_request_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn is_safe_pet_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && is_safe_session_id(id)
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn is_valid_message_text(text: &str) -> bool {
    let len = text.chars().count();
    !text.trim().is_empty() && len <= 2000
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetInboxPayload {
    schema_version: String,
    kind: String,
    pet_id: String,
    text: String,
    deliver_as: String,
    command_id: String,
    dedup_key: String,
    ttl_ms: u64,
}

fn create_pet_inbox_payload(
    pet_id: &str,
    text: &str,
    request_id: &str,
) -> Result<PetInboxPayload, String> {
    if !is_safe_pet_id(pet_id) {
        return Err("Unbound or invalid pet identity".to_string());
    }
    if !is_safe_request_id(request_id) {
        return Err("Invalid request ID".to_string());
    }
    if !is_valid_message_text(text) {
        return Err("Message text must be between 1 and 2000 characters".to_string());
    }

    Ok(PetInboxPayload {
        schema_version: "1".to_string(),
        kind: "user_message".to_string(),
        pet_id: pet_id.to_string(),
        text: text.to_string(),
        deliver_as: "followUp".to_string(),
        command_id: request_id.to_string(),
        dedup_key: request_id.to_string(),
        ttl_ms: 60000,
    })
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetReceiptQueryPayload {
    schema_version: String,
    kind: String,
    pet_id: String,
    command_id: String,
}

fn create_pet_receipt_query_payload(
    pet_id: &str,
    request_id: &str,
) -> Result<PetReceiptQueryPayload, String> {
    if !is_safe_pet_id(pet_id) {
        return Err("Unbound or invalid pet identity".to_string());
    }
    if !is_safe_request_id(request_id) {
        return Err("Invalid request ID".to_string());
    }

    Ok(PetReceiptQueryPayload {
        schema_version: "1".to_string(),
        kind: "user_message_receipt_query".to_string(),
        pet_id: pet_id.to_string(),
        command_id: request_id.to_string(),
    })
}

fn parse_runtime_port_from_str(content: &str) -> Result<u16, String> {
    let v: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid runtime.json: {}", e))?;

    let app = v.get("app").and_then(|a| a.as_str()).unwrap_or("");
    if app != "clawd-on-desk" {
        return Err(format!("Unsupported runtime app: expected 'clawd-on-desk', got '{}'", app));
    }

    let port = v.get("port")
        .and_then(|p| p.as_u64())
        .ok_or_else(|| "Missing or invalid port in runtime.json".to_string())?;

    if port == 0 || port > 65535 {
        return Err(format!("Invalid port range: {}", port));
    }

    Ok(port as u16)
}

fn default_runtime_config_path() -> PathBuf {
    if let Some(path) = std::env::var_os("CLAWD_RUNTIME_CONFIG").map(PathBuf::from) {
        return path;
    }
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".clawd").join("runtime.json")
}

fn read_runtime_port(path: &PathBuf) -> Result<u16, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read runtime config from {}: {}", path.display(), e))?;
    parse_runtime_port_from_str(&content)
}

fn verify_clawd_server_header(header: Option<&str>) -> Result<(), String> {
    match header {
        Some(val) if val.trim() == "clawd-on-desk" => Ok(()),
        Some(val) => Err(format!(
            "Untrusted server response: expected x-clawd-server header 'clawd-on-desk', got '{}'",
            val
        )),
        None => Err("Untrusted server response: missing x-clawd-server header".to_string()),
    }
}

fn post_clawd_endpoint_blocking(
    port: u16,
    endpoint: &str,
    json_bytes: &[u8],
) -> Result<serde_json::Value, String> {
    use std::io::Read;
    let url = format!("http://127.0.0.1:{}{}", port, endpoint);

    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(5)))
        .http_status_as_error(false)
        .build()
        .new_agent();

    let resp = agent
        .post(&url)
        .header("Content-Type", "application/json")
        .send(json_bytes)
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let server_header = resp
        .headers()
        .get("x-clawd-server")
        .and_then(|v| v.to_str().ok());
    verify_clawd_server_header(server_header)?;

    let mut body_bytes = Vec::new();
    resp.into_body()
        .into_reader()
        .take(65537)
        .read_to_end(&mut body_bytes)
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if body_bytes.len() > 65536 {
        return Err("Response body exceeded 65536 bytes limit".to_string());
    }

    serde_json::from_slice::<serde_json::Value>(&body_bytes)
        .map_err(|e| format!("Failed to parse response JSON: {}", e))
}

fn post_pet_inbox_blocking(
    port: u16,
    payload: &PetInboxPayload,
) -> Result<serde_json::Value, String> {
    let json_bytes = serde_json::to_vec(payload)
        .map_err(|e| format!("Failed to serialize payload: {}", e))?;
    post_clawd_endpoint_blocking(port, "/pet-inbox", &json_bytes)
}

fn post_pet_receipt_query_blocking(
    port: u16,
    payload: &PetReceiptQueryPayload,
) -> Result<serde_json::Value, String> {
    let json_bytes = serde_json::to_vec(payload)
        .map_err(|e| format!("Failed to serialize payload: {}", e))?;
    post_clawd_endpoint_blocking(port, "/pet-inbox/receipt", &json_bytes)
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PetChatMessage {
    pub role: String,
    pub text: String,
    #[serde(default)]
    pub created_at_ms: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PetChatPresentation {
    #[serde(default)]
    pub revision: u64,
    pub messages: Vec<PetChatMessage>,
    #[serde(default)]
    pub pending: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetChatReadPayload {
    schema_version: String,
    kind: String,
    pet_id: String,
}

fn create_pet_chat_read_payload(
    pet_id: &str,
) -> Result<PetChatReadPayload, String> {
    if !is_safe_pet_id(pet_id) {
        return Err("Unbound or invalid pet identity".to_string());
    }

    Ok(PetChatReadPayload {
        schema_version: "1".to_string(),
        kind: "pet_chat_read".to_string(),
        pet_id: pet_id.to_string(),
    })
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetChatClearPayload {
    schema_version: String,
    kind: String,
    pet_id: String,
}

fn create_pet_chat_clear_payload(
    pet_id: &str,
) -> Result<PetChatClearPayload, String> {
    if !is_safe_pet_id(pet_id) {
        return Err("Unbound or invalid pet identity".to_string());
    }

    Ok(PetChatClearPayload {
        schema_version: "1".to_string(),
        kind: "pet_chat_clear".to_string(),
        pet_id: pet_id.to_string(),
    })
}

fn post_pet_chat_read_blocking(
    port: u16,
    payload: &PetChatReadPayload,
) -> Result<serde_json::Value, String> {
    let json_bytes = serde_json::to_vec(payload)
        .map_err(|e| format!("Failed to serialize payload: {}", e))?;
    post_clawd_endpoint_blocking(port, "/pet-chat/read", &json_bytes)
}

fn post_pet_chat_clear_blocking(
    port: u16,
    payload: &PetChatClearPayload,
) -> Result<serde_json::Value, String> {
    let json_bytes = serde_json::to_vec(payload)
        .map_err(|e| format!("Failed to serialize payload: {}", e))?;
    post_clawd_endpoint_blocking(port, "/pet-chat/clear", &json_bytes)
}

fn project_pet_chat_response(raw: &serde_json::Value) -> Result<PetChatPresentation, String> {
    let obj = if let Some(chat) = raw.get("chat") {
        if chat.is_null() {
            return Ok(PetChatPresentation {
                revision: 0,
                messages: Vec::new(),
                pending: false,
            });
        }
        chat.as_object().ok_or_else(|| "Invalid chat envelope: expected object".to_string())?
    } else if let Some(obj) = raw.as_object() {
        obj
    } else {
        return Err("Invalid coordinator response: expected JSON object".to_string());
    };

    let revision = obj.get("revision")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let pending = obj.get("pending")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let mut projected_messages = Vec::new();
    if let Some(raw_msgs) = obj.get("messages") {
        let msg_array = raw_msgs.as_array().ok_or_else(|| "Invalid messages: expected array".to_string())?;
        for item in msg_array {
            let item_obj = item.as_object().ok_or_else(|| "Invalid message item: expected object".to_string())?;
            let role = item_obj.get("role")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing or invalid role in message".to_string())?;

            if role != "user" && role != "assistant" {
                return Err(format!("Invalid message role: '{}'. Only 'user' and 'assistant' are permitted", role));
            }

            let text = item_obj.get("text")
                .and_then(|v| v.as_str())
                .or_else(|| item_obj.get("content").and_then(|v| v.as_str()))
                .ok_or_else(|| "Missing or invalid text in message".to_string())?;

            if role == "user" {
                let code_point_count = text.chars().count();
                if code_point_count > 2000 {
                    return Err(format!("User message text exceeds 2000 Unicode code points (found {})", code_point_count));
                }
            } else {
                let byte_count = text.len();
                if byte_count > 8192 {
                    return Err(format!("Assistant message text exceeds 8192 UTF-8 bytes (found {})", byte_count));
                }
            }

            if has_forbidden_presentation_control(text) {
                return Err("Message text contains forbidden control characters".to_string());
            }

            let created_at_ms = item_obj.get("createdAtMs")
                .or_else(|| item_obj.get("created_at_ms"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            projected_messages.push(PetChatMessage {
                role: role.to_string(),
                text: text.to_string(),
                created_at_ms,
            });
        }
    }

    Ok(PetChatPresentation {
        revision,
        messages: projected_messages,
        pending,
    })
}

#[tauri::command]
async fn get_session_message_receipt(
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
    request_id: String,
) -> Result<serde_json::Value, String> {
    let pet_id = {
        let guard = session_id_state.lock().unwrap();
        guard.clone()
    };

    if pet_id.is_empty() {
        return Err("Pet session is not bound".to_string());
    }

    let payload = create_pet_receipt_query_payload(&pet_id, &request_id)?;
    let runtime_path = default_runtime_config_path();
    let port = read_runtime_port(&runtime_path)?;

    tauri::async_runtime::spawn_blocking(move || post_pet_receipt_query_blocking(port, &payload))
        .await
        .map_err(|e| format!("Async task failed: {}", e))?
}

#[tauri::command]
async fn send_session_message(
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
    text: String,
    request_id: String,
) -> Result<serde_json::Value, String> {
    let pet_id = {
        let guard = session_id_state.lock().unwrap();
        guard.clone()
    };

    if pet_id.is_empty() {
        return Err("Pet session is not bound".to_string());
    }

    let payload = create_pet_inbox_payload(&pet_id, &text, &request_id)?;
    let runtime_path = default_runtime_config_path();
    let port = read_runtime_port(&runtime_path)?;

    tauri::async_runtime::spawn_blocking(move || post_pet_inbox_blocking(port, &payload))
        .await
        .map_err(|e| format!("Async task failed: {}", e))?
}

#[tauri::command]
async fn get_pet_chat(
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
) -> Result<PetChatPresentation, String> {
    let pet_id = {
        let guard = session_id_state.lock().unwrap();
        guard.clone()
    };

    if pet_id.is_empty() {
        return Err("Pet session is not bound".to_string());
    }

    let payload = create_pet_chat_read_payload(&pet_id)?;
    let runtime_path = default_runtime_config_path();
    let port = read_runtime_port(&runtime_path)?;

    let raw = tauri::async_runtime::spawn_blocking(move || post_pet_chat_read_blocking(port, &payload))
        .await
        .map_err(|e| format!("Async task failed: {}", e))??;

    project_pet_chat_response(&raw)
}

#[tauri::command]
async fn clear_pet_chat(
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
) -> Result<serde_json::Value, String> {
    let pet_id = {
        let guard = session_id_state.lock().unwrap();
        guard.clone()
    };

    if pet_id.is_empty() {
        return Err("Pet session is not bound".to_string());
    }

    let payload = create_pet_chat_clear_payload(&pet_id)?;
    let runtime_path = default_runtime_config_path();
    let port = read_runtime_port(&runtime_path)?;

    tauri::async_runtime::spawn_blocking(move || post_pet_chat_clear_blocking(port, &payload))
        .await
        .map_err(|e| format!("Async task failed: {}", e))?
}

fn write_lock_file(lock_path: &PathBuf) {
    let _ = fs::write(lock_path, std::process::id().to_string());
}

fn is_lock_alive(lock_path: &PathBuf) -> bool {
    let Ok(content) = fs::read_to_string(lock_path) else { return false };
    let Ok(pid) = content.trim().parse::<u32>() else { return false };
    is_process_running(pid)
}

#[cfg(windows)]
fn is_process_running(pid: u32) -> bool {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const STILL_ACTIVE: u32 = 259;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut exit_code: u32 = 0;
        let result = GetExitCodeProcess(handle, &mut exit_code);
        CloseHandle(handle);
        result != 0 && exit_code == STILL_ACTIVE
    }
}

#[cfg(windows)]
unsafe extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
    fn GetExitCodeProcess(handle: *mut std::ffi::c_void, exit_code: *mut u32) -> i32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}

#[cfg(not(windows))]
fn is_process_running(pid: u32) -> bool {
    // signal 0 checks if process exists without sending a signal
    unsafe { libc_kill(pid as i32, 0) == 0 }
}

#[cfg(not(windows))]
unsafe extern "C" {
    #[link_name = "kill"]
    fn libc_kill(pid: i32, sig: i32) -> i32;
}

fn download_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    use std::io::Read;
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(30)))
        .build()
        .new_agent();
    let resp = agent.get(url).call().map_err(|e| e.to_string())?;
    let status = resp.status();
    if status != 200 {
        return Err(format!("HTTP {}", status));
    }
    let mut bytes: Vec<u8> = Vec::new();
    resp.into_body().into_reader().read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Empty response".into());
    }
    fs::write(dest, &bytes).map_err(|e| e.to_string())
}

fn download_assets_blocking(assets_dir: &PathBuf) -> Result<(), String> {
    use std::io::Read;
    let url = format!("https://github.com/{}/releases/latest/download/pet-assets.zip", ASSETS_REPO);
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(60)))
        .build()
        .new_agent();
    let resp = agent.get(&url).call().map_err(|e| format!("Download failed: {}", e))?;
    let status = resp.status();
    if status != 200 {
        return Err(format!("Download failed: HTTP {}", status));
    }
    let mut zip_bytes: Vec<u8> = Vec::new();
    resp.into_body().into_reader().read_to_end(&mut zip_bytes)
        .map_err(|e| format!("Download failed: {}", e))?;
    if zip_bytes.is_empty() {
        return Err("Download failed: empty response".into());
    }

    // Extract zip to assets_dir
    fs::create_dir_all(assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    let cursor = std::io::Cursor::new(&zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Invalid zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Zip read error: {}", e))?;
        let Some(enclosed_name) = file.enclosed_name() else { continue };
        let dest = assets_dir.join(enclosed_name);
        // Path traversal prevention
        if !dest.starts_with(assets_dir) { continue; }
        if file.is_dir() {
            let _ = fs::create_dir_all(&dest);
        } else {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let mut buf = Vec::new();
            file.read_to_end(&mut buf).map_err(|e| format!("Zip extract error: {}", e))?;
            fs::write(&dest, &buf).map_err(|e| format!("Write error: {}", e))?;
        }
    }

    // Clean outdated DLC so they re-download on next use
    let dlc_config_dir = assets_dir.join("dlc");
    if let Ok(entries) = fs::read_dir(&dlc_config_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
            let dlc_id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let char_json = assets_dir.join(&dlc_id).join("character.json");
            if !char_json.exists() { continue; }
            let Ok(cfg_str) = fs::read_to_string(&path) else { continue };
            let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&cfg_str) else { continue };
            let Ok(inst_str) = fs::read_to_string(&char_json) else { continue };
            let Ok(inst) = serde_json::from_str::<serde_json::Value>(&inst_str) else { continue };
            if let Some(cv) = cfg.get("version").and_then(|v| v.as_u64()) {
                let iv = inst.get("version").and_then(|v| v.as_u64()).unwrap_or(0);
                if iv < cv {
                    let _ = fs::remove_dir_all(assets_dir.join(&dlc_id));
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn update_assets(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Result<(), String> {
    let dir = assets_dir.inner().as_ref()
        .cloned()
        .unwrap_or_else(|| default_pet_dir().join("assets"));

    tauri::async_runtime::spawn_blocking(move || {
        download_assets_blocking(&dir)
    }).await.map_err(|e| e.to_string())?
}

fn read_stdin() -> String {
    use std::io::Read;
    // Read stdin until complete JSON object (depth-balanced {}) or timeout.
    // Does NOT wait for EOF — returns as soon as JSON is complete.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let mut depth = 0i32;
        let mut in_string = false;
        let mut escape = false;
        let mut started = false;

        for byte in std::io::stdin().bytes() {
            let Ok(b) = byte else { break };
            buf.push(b);

            // JSON structure tracking (only for ASCII control chars, safe for UTF-8
            // since multi-byte sequences never contain bytes < 0x80)
            if escape { escape = false; continue; }
            if b == b'\\' && in_string { escape = true; continue; }
            if b == b'"' { in_string = !in_string; continue; }
            if in_string { continue; }
            if b == b'{' { depth += 1; started = true; }
            if b == b'}' {
                depth -= 1;
                if started && depth == 0 {
                    let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
                    return;
                }
            }
        }
        let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
    });
    rx.recv_timeout(std::time::Duration::from_millis(100)).unwrap_or_default()
}

fn get_arg(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == flag).map(|w| w[1].clone())
}

fn default_pet_dir() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("pet-data")
}

fn timestamp() -> String {
    // ISO 8601 UTC timestamp
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = d.as_secs();
    // Simple UTC format without chrono dependency
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let h = time_secs / 3600;
    let m = (time_secs % 3600) / 60;
    let s = time_secs % 60;
    // Approximate date (good enough for timestamps)
    let y = 1970 + days / 365;
    let remaining = days % 365;
    let month = remaining / 30 + 1;
    let day = remaining % 30 + 1;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, month, day, h, m, s)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();

    // Subcommand dispatch: CLI commands run without GUI.
    if args.iter().any(|a| a == "react") {
        cmd_react(&args);
        std::process::exit(0);
    }
    if args.iter().any(|a| a == "write-status") {
        cmd_write_status(&args);
        std::process::exit(0); // Force exit — don't wait for stdin reader thread
    }

    if std::env::var("PET_DEBUG").map_or(false, |v| v == "1" || v == "true") {
        DEBUG_ENABLED.store(true, Ordering::Relaxed);
    }

    let demo_mode = args.iter().any(|a| a == "--demo");

    let explicit_status = args.windows(2).find(|w| w[0] == "--status-file").map(|w| PathBuf::from(&w[1]));
    let explicit_session = args.windows(2).find(|w| w[0] == "--session-id").map(|w| w[1].clone());

    // Determine if we have an explicit session or need session selection
    let (initial_status_path, initial_session_id, initial_lock) = if let Some(sf) = &explicit_status {
        let sid = explicit_session.clone().unwrap_or_else(|| {
            sf.file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.strip_prefix("status-"))
                .unwrap_or("unknown")
                .to_string()
        });
        let pet_dir = sf.parent().map(PathBuf::from).unwrap_or_else(default_pet_dir);
        let _ = fs::create_dir_all(&pet_dir);
        let lock_file = pet_dir.join(format!("pet-{}.lock", sid));
        if is_lock_alive(&lock_file) {
            eprintln!("Pet already running for session {}", sid);
            std::process::exit(0);
        }
        write_lock_file(&lock_file);
        (sf.clone(), sid, Some(lock_file))
    } else {
        // No explicit session — will show session picker in frontend
        (default_status_path(), String::new(), None)
    };

    let needs_session_select = explicit_status.is_none() && !demo_mode;

    let assets_dir: Option<PathBuf> = args
        .windows(2)
        .find(|w| w[0] == "--assets-dir")
        .map(|w| PathBuf::from(&w[1]))
        .or_else(|| Some(default_pet_dir().join("assets")));

    if let Some(parent) = initial_status_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Clean up stale status files on GUI startup
    cleanup_stale_status(&default_pet_dir());

    let status_path_shared = Arc::new(Mutex::new(initial_status_path.clone()));
    let session_id_shared = Arc::new(Mutex::new(initial_session_id.clone()));
    let lock_path_shared: Arc<Mutex<Option<PathBuf>>> = Arc::new(Mutex::new(initial_lock.clone()));
    let board_lock_state_shared = BoardLockState(Arc::new(Mutex::new(None)));

    let lock_for_cleanup = lock_path_shared.clone();
    let board_lock_for_cleanup = board_lock_state_shared.clone();
    let position_path = if initial_session_id.is_empty() {
        None
    } else {
        Some(default_pet_dir().join("positions").join(format!("{}.json", initial_session_id)))
    };
    let restore_position_path = position_path.clone();
    let position_session_id = session_id_shared.clone();

    let mut lock_dirs = vec![default_pet_dir(), default_pi_pet_dir().join("status")];
    if let Some(parent) = initial_status_path.parent() {
        let parent_buf = parent.to_path_buf();
        if !lock_dirs.contains(&parent_buf) {
            lock_dirs.push(parent_buf);
        }
    }
    if let Some(lock) = initial_lock.as_ref() {
        if let Some(parent) = lock.parent() {
            let parent_buf = parent.to_path_buf();
            if !lock_dirs.contains(&parent_buf) {
                lock_dirs.push(parent_buf);
            }
        }
    }
    let positions_dir = default_pet_dir().join("positions");

    tauri::Builder::default()
        .manage(status_path_shared)
        .manage(session_id_shared)
        .manage(lock_path_shared)
        .manage(board_lock_state_shared)
        .manage(assets_dir)
        .manage(activity_area::EditorState::default())
        .manage(gathering::GatheringState::default())
        .invoke_handler(tauri::generate_handler![request_gathering, set_gathering_interaction, open_activity_area, activity_area_editor_info, save_activity_area, get_status, get_team_presentation, open_team_board, open_pet_chat, get_pet_chat, clear_pet_chat, is_primary_mouse_button_down, get_session_id, get_assets_dir, get_event, load_asset, load_text_asset, load_custom_asset, is_dlc_installed, download_dlc, list_available_dlcs, list_character_packs, list_unlocked_sessions, bind_session, update_assets, send_session_message, get_session_message_receipt])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            if let Some(path) = restore_position_path.as_ref() {
                // GTK's pre-map outer_size can still be its provisional frame
                // (not the configured pet size). Validate the frameless startup
                // size here; live gathering always checks real outer geometry.
                let scale = window.scale_factor().unwrap_or(1.0);
                let initial_size = app.config().app.windows.iter().find(|w| w.label == "main").map(|w| {
                    tauri::PhysicalSize::new((w.width * scale).ceil() as u32, (w.height * scale).ceil() as u32)
                }).or_else(|| window.outer_size().ok());
                let saved = read_window_position(path).filter(|saved| {
                    let Some(size) = initial_size else { return false; };
                    let rect = activity_area::Rect { x: saved.x, y: saved.y, width: size.width, height: size.height };
                    window.available_monitors().unwrap_or_default().iter().any(|monitor| {
                        activity_area::MonitorSnapshot::from_monitor(monitor).work_area.contains(&rect)
                    })
                });
                if let Some(saved) = saved {
                    let _ = window.set_position(Position::Physical(PhysicalPosition::new(saved.x, saved.y)));
                } else if !initial_session_id.is_empty() {
                    let available = window.available_monitors().unwrap_or_default();
                    let primary = window.primary_monitor().ok().flatten();
                    let current = window.current_monitor().ok().flatten();
                    let monitors = window_layout::build_monitors(&available, primary.as_ref(), current.as_ref());
                    let peer_positions = window_layout::collect_active_peer_positions(&initial_session_id, &lock_dirs, &positions_dir);
                    if let (Some(monitor), Some(win_size)) = (
                        window_layout::choose_target_monitor(&monitors, &peer_positions),
                        initial_size,
                    ) {
                        if win_size.width > 0 && win_size.height > 0 {
                            let chosen = window_layout::calculate_auto_stagger_position(monitor, win_size.width, win_size.height, &peer_positions);
                            write_window_position(path, PhysicalPosition::new(chosen.x, chosen.y));
                            let _ = window.set_position(Position::Physical(PhysicalPosition::new(chosen.x, chosen.y)));
                        }
                    }
                }
            }

            // Set WebView2 background to transparent
            let _ = window.with_webview(|_webview| {
                #[cfg(windows)]
                {
                    let controller = _webview.controller();
                    unsafe {
                        use webview2_com::Microsoft::Web::WebView2::Win32::*;
                        let controller2: ICoreWebView2Controller2 =
                            windows::core::Interface::cast(&controller).unwrap();
                        let _ = controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR {
                            R: 0,
                            G: 0,
                            B: 0,
                            A: 0,
                        });
                    }
                }
            });

            let handle = app.handle().clone();

            if needs_session_select {
                // Frontend will query for session selection on init
                // (emit is unreliable here — JS may not have loaded listeners yet)
            } else if demo_mode {
                // Demo mode: cycle through all states for recording
                std::thread::spawn(move || {
                    let demos = vec![
                        ("idle", "Waiting for input..."),
                        ("thinking", "Processing prompt..."),
                        ("reading", "Reading lib.rs"),
                        ("editing", "Editing app.js"),
                        ("searching", "Searching: TODO"),
                        ("running", "Running npm test"),
                        ("delegating", "Spawning agent..."),
                        ("waiting", "Waiting for response..."),
                        ("error", "Build failed"),
                        ("offline", "Zzz..."),
                    ];
                    let mut i = 0;
                    loop {
                        let (state, detail) = demos[i % demos.len()];
                        emit_status_update(&handle, StatusPayload {
                            state: state.to_string(),
                            detail: detail.to_string(),
                            tool: String::new(),
                            event: "Demo".to_string(),
                            session_id: "demo".to_string(),
                            session_name: "Demo Mode".to_string(),
                            team: None,
                            appearance_context: None,
                        });
                        i += 1;
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                    }
                });
            } else {
                // Explicit session mode: watch the status and reaction files directly
                let watch_path = initial_status_path.clone();
                let reaction_path = default_pet_dir().join(format!("reaction-{}.json", initial_session_id));
                let event_path = resolve_event_path(&watch_path, &initial_session_id);
                let log_path = initial_status_path.clone();
                std::thread::spawn(move || {
                let (tx, rx) = std::sync::mpsc::channel();
                let mut watcher = match notify::recommended_watcher(tx) {
                    Ok(w) => w,
                    Err(e) => {
                        debug_log(&log_path, &format!("FATAL: watcher init failed: {}", e));
                        return;
                    }
                };

                let mut watched_dirs = std::collections::HashSet::new();
                if let Some(p) = watch_path.parent() {
                    let _ = fs::create_dir_all(p);
                    if watched_dirs.insert(p.to_path_buf()) {
                        let _ = watcher.watch(p, RecursiveMode::NonRecursive);
                    }
                }
                if let Some(p) = event_path.parent() {
                    let _ = fs::create_dir_all(p);
                    if watched_dirs.insert(p.to_path_buf()) {
                        let _ = watcher.watch(p, RecursiveMode::NonRecursive);
                    }
                }
                if let Some(p) = reaction_path.parent() {
                    let _ = fs::create_dir_all(p);
                    if watched_dirs.insert(p.to_path_buf()) {
                        let _ = watcher.watch(p, RecursiveMode::NonRecursive);
                    }
                }

                debug_log(&log_path, &format!("Watcher started on {:?}", watched_dirs));

                if let Some(status) = read_status(&watch_path) {
                    debug_log(&log_path, &format!("Initial status: state={}", status.state));
                    emit_status_update(&handle, status);
                }
                if let Some(event) = read_pet_event(&event_path, &log_path) {
                    debug_log(&log_path, &format!("Initial pet event: id={}", event.event_id));
                    let _ = handle.emit("pet-event", event);
                }

                for event in rx {
                    if let Ok(event) = event {
                        let is_status_file = event.paths.iter().any(|p| *p == watch_path);
                        let is_event_file = event.paths.iter().any(|p| *p == event_path);
                        let is_reaction_file = event.paths.iter().any(|p| *p == reaction_path);
                        if !is_status_file && !is_event_file && !is_reaction_file {
                            continue;
                        }
                        debug_log(&log_path, &format!("Event: {:?}, paths: {:?}", event.kind, event.paths));
                        match event.kind {
                            EventKind::Modify(_) | EventKind::Create(_) => {
                                std::thread::sleep(std::time::Duration::from_millis(50));
                                if is_event_file {
                                    if let Some(pet_event) = read_pet_event(&event_path, &log_path) {
                                        let _ = handle.emit("pet-event", pet_event);
                                    }
                                } else if is_reaction_file {
                                    if let Some(reaction) = read_reaction(&reaction_path, &log_path) {
                                        let _ = handle.emit("reaction-event", reaction);
                                    }
                                } else if let Some(status) = read_status(&watch_path) {
                                    debug_log(&log_path, &format!("Emit: state={}, detail={}", status.state, status.detail));
                                    emit_status_update(&handle, status);
                                } else {
                                    debug_log(&log_path, "Read failed after Modify/Create (file may be mid-write)");
                                }
                            }
                            EventKind::Remove(_) if is_status_file => {
                                debug_log(&log_path, "Remove detected, waiting 300ms to confirm deletion...");
                                std::thread::sleep(std::time::Duration::from_millis(300));
                                if watch_path.exists() {
                                    debug_log(&log_path, "File still exists after Remove — spurious event (Windows writeFileSync), reading status");
                                    if let Some(status) = read_status(&watch_path) {
                                        debug_log(&log_path, &format!("Emit after spurious Remove: state={}, detail={}", status.state, status.detail));
                                        emit_status_update(&handle, status);
                                    }
                                } else {
                                    debug_log(&log_path, "File truly deleted — emitting closed state");
                                    emit_status_update(
                                        &handle,
                                        StatusPayload {
                                            state: "closed".to_string(),
                                            detail: "Session ended".to_string(),
                                            tool: String::new(),
                                            event: "SessionEnd".to_string(),
                                            session_id: String::new(),
                                            session_name: String::new(),
                                            team: None,
                                            appearance_context: None,
                                        },
                                    );
                                }
                            }
                            _ => {
                                debug_log(&log_path, &format!("Ignored event: {:?}", event.kind));
                            }
                        }
                    } else if let Err(e) = event {
                        debug_log(&log_path, &format!("Watcher error: {:?}", e));
                    }
                }
                debug_log(&log_path, "Watcher loop ended (channel closed)");
                });
            }

            gathering::start(app.handle().clone(),
                app.state::<Arc<Mutex<String>>>().inner().clone(),
                app.state::<Arc<Mutex<PathBuf>>>().inner().clone());
            Ok(())
        })
        .on_window_event(move |window, event| {
            match event {
                tauri::WindowEvent::Moved(position) => {
                    if window.label() == "main" {
                        let sid = position_session_id.lock().unwrap().clone();
                        gathering::note_moved(window.app_handle(), sid, *position);
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "main" { gathering::flush_position(window.app_handle()); }
                    handle_window_destroyed_logic(
                        window.label(),
                        &lock_for_cleanup,
                        &board_lock_for_cleanup.0,
                    );
                    // Don't delete status file — it belongs to the session, not the pet
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
