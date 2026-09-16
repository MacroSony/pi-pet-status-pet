//! Local user activity-area editor. No pet movement or Agent-facing API.
use super::{default_runtime_config_path, post_clawd_endpoint_blocking, read_runtime_port};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{
    Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

const EDITOR: &str = "activity-area";
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub(crate) struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
impl Rect {
    pub(crate) fn valid(&self) -> bool {
        (self.x as i64).abs() <= 1_000_000
            && (self.y as i64).abs() <= 1_000_000
            && self.width > 0
            && self.width <= 100_000
            && self.height > 0
            && self.height <= 100_000
    }
    pub(crate) fn contains(&self, other: &Rect) -> bool {
        self.valid()
            && other.valid()
            && other.x >= self.x
            && other.y >= self.y
            && other.x as i64 + other.width as i64 <= self.x as i64 + self.width as i64
            && other.y as i64 + other.height as i64 <= self.y as i64 + self.height as i64
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MonitorSnapshot {
    pub(crate) name: String,
    pub(crate) work_area: Rect,
    pub(crate) scale_factor: f64,
}
impl MonitorSnapshot {
    pub(crate) fn from_monitor(m: &tauri::Monitor) -> Self {
        let w = m.work_area();
        Self {
            name: m.name().cloned().unwrap_or_default(),
            work_area: Rect {
                x: w.position.x,
                y: w.position.y,
                width: w.size.width,
                height: w.size.height,
            },
            scale_factor: m.scale_factor(),
        }
    }
    pub(crate) fn valid(&self) -> bool {
        self.name.encode_utf16().count() <= 256
            && !self.name.chars().any(char::is_control)
            && self.scale_factor.is_finite()
            && (0.25..=8.0).contains(&self.scale_factor)
            && self.work_area.valid()
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub(crate) struct Area {
    pub(crate) monitor: MonitorSnapshot,
    pub(crate) rect: Rect,
}
impl Area {
    pub(crate) fn valid(&self) -> bool {
        self.monitor.valid() && self.monitor.work_area.contains(&self.rect)
    }
    pub(crate) fn available(&self, monitors: &[MonitorSnapshot]) -> bool {
        self.valid() && monitors.iter().filter(|m| **m == self.monitor).count() == 1
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Response {
    status: String,
    schema_version: String,
    revision: u64,
    area: Option<Area>,
}
fn parse_response(raw: serde_json::Value) -> Result<Response, String> {
    if raw.get("status").and_then(|x| x.as_str()) == Some("conflict") {
        return Err("Another pet changed the activity area. Cancel and reopen this editor.".into());
    }
    if !matches!(
        raw.get("status").and_then(|x| x.as_str()),
        Some("ready" | "updated")
    ) {
        return Err("Activity area service unavailable; start/update Clawd and try again.".into());
    }
    let response: Response =
        serde_json::from_value(raw).map_err(|_| "Invalid activity area response")?;
    if response.schema_version != "1"
        || response.revision > 9_007_199_254_740_991
        || response.area.as_ref().is_some_and(|a| !a.valid())
    {
        return Err("Invalid activity area response".into());
    }
    Ok(response)
}

#[derive(Clone)]
struct EditorSession {
    revision: u64,
    port: u16,
    message: String,
}
#[derive(Default)]
pub(crate) struct EditorState {
    opening: AtomicBool,
    saving: AtomicBool,
    session: Mutex<Option<EditorSession>>,
}
struct OpeningGuard<'a>(&'a AtomicBool);
impl Drop for OpeningGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
fn require_window(window: &WebviewWindow, label: &str) -> Result<(), String> {
    if window.label() == label {
        Ok(())
    } else {
        Err("Command unavailable in this window".into())
    }
}
async fn request(port: u16, write: bool, data: serde_json::Value) -> Result<Response, String> {
    let bytes = serde_json::to_vec(&data).map_err(|_| "Invalid activity area request")?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        post_clawd_endpoint_blocking(
            port,
            if write {
                "/pet-activity-area/write"
            } else {
                "/pet-activity-area/read"
            },
            &bytes,
        )
    })
    .await
    .map_err(|_| "Activity area request failed")?
    .map_err(|_| "Cannot reach activity area service; start/update Clawd and try again.")?;
    parse_response(result)
}

#[tauri::command]
pub(crate) async fn open_activity_area(
    app: tauri::AppHandle,
    window: WebviewWindow,
    state: tauri::State<'_, EditorState>,
) -> Result<(), String> {
    require_window(&window, "main")?;
    if state.saving.load(Ordering::Acquire) {
        return Err("Activity area is being saved; please wait.".into());
    }
    if state.opening.swap(true, Ordering::AcqRel) {
        return Ok(());
    }
    let _guard = OpeningGuard(&state.opening);
    if let Some(editor) = app.get_webview_window(EDITOR) {
        editor.show().map_err(|e| e.to_string())?;
        editor.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let port = read_runtime_port(&default_runtime_config_path())
        .map_err(|_| "Clawd runtime configuration unavailable")?;
    let response = request(port, false, serde_json::json!({"schemaVersion":"1"})).await?;
    let monitors: Vec<_> = window
        .available_monitors()
        .map_err(|e| e.to_string())?
        .iter()
        .map(MonitorSnapshot::from_monitor)
        .collect();
    let current = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or(window.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or("No monitor available")?;
    let current = MonitorSnapshot::from_monitor(&current);
    if !current.valid() {
        return Err("Unsupported monitor geometry".into());
    }
    let saved_valid = response
        .area
        .as_ref()
        .is_some_and(|a| a.available(&monitors));
    let rect = if saved_valid {
        response.area.as_ref().unwrap().rect.clone()
    } else {
        let work = &current.work_area;
        let width = work
            .width
            .min((600.0 * current.scale_factor).round() as u32);
        let height = work
            .height
            .min((300.0 * current.scale_factor).round() as u32);
        Rect {
            x: work.x + ((work.width - width) / 2) as i32,
            y: work.y + ((work.height - height) / 2) as i32,
            width,
            height,
        }
    };
    let message = if response.area.is_some() && !saved_valid {
        "Saved monitor layout changed. Choose a new area; nothing changes until Apply."
    } else if saved_valid {
        "Editing the shared desktop activity area."
    } else {
        "No activity area configured. Move/resize this frame, then Apply."
    };
    *state.session.lock().map_err(|_| "Editor unavailable")? = Some(EditorSession {
        revision: response.revision,
        port,
        message: message.into(),
    });
    // Async command is essential for Windows WebView2 dynamic window creation.
    let editor =
        WebviewWindowBuilder::new(&app, EDITOR, WebviewUrl::App("activity-area.html".into()))
            .title("Pi Pet Activity Area")
            .inner_size(600.0, 300.0)
            .min_inner_size(260.0, 160.0)
            .decorations(false)
            .transparent(true)
            .resizable(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .focused(false)
            .build()
            .map_err(|e| e.to_string())?;
    let setup = (|| -> Result<(), String> {
        editor
            .set_position(PhysicalPosition::new(rect.x, rect.y))
            .map_err(|e| e.to_string())?;
        editor
            .set_size(PhysicalSize::new(rect.width, rect.height))
            .map_err(|e| e.to_string())?;
        editor.show().map_err(|e| e.to_string())?;
        editor.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if setup.is_err() {
        let _ = editor.close();
    }
    setup
}

#[tauri::command]
pub(crate) fn activity_area_editor_info(
    window: WebviewWindow,
    state: tauri::State<'_, EditorState>,
) -> Result<String, String> {
    require_window(&window, EDITOR)?;
    Ok(state
        .session
        .lock()
        .map_err(|_| "Editor unavailable")?
        .as_ref()
        .ok_or("Editor unavailable")?
        .message
        .clone())
}

#[tauri::command]
pub(crate) async fn save_activity_area(
    window: WebviewWindow,
    state: tauri::State<'_, EditorState>,
    disabled: bool,
) -> Result<(), String> {
    require_window(&window, EDITOR)?;
    if state.saving.swap(true, Ordering::AcqRel) {
        return Err("Activity area is already being saved.".into());
    }
    let _guard = OpeningGuard(&state.saving);
    let session = state
        .session
        .lock()
        .map_err(|_| "Editor unavailable")?
        .clone()
        .ok_or("Editor unavailable")?;
    let area = if disabled {
        None
    } else {
        let pos = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let rect = Rect {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
        };
        let candidates: Vec<_> = window
            .available_monitors()
            .map_err(|e| e.to_string())?
            .iter()
            .map(MonitorSnapshot::from_monitor)
            .filter(|m| m.valid() && m.work_area.contains(&rect))
            .collect();
        if candidates.len() != 1 {
            return Err(
                "Keep the entire frame inside one monitor's work area (not over the taskbar)."
                    .into(),
            );
        }
        Some(Area {
            monitor: candidates[0].clone(),
            rect,
        })
    };
    let response = request(
        session.port,
        true,
        serde_json::json!({
            "schemaVersion":"1", "baseRevision":session.revision, "area":area,
        }),
    )
    .await?;
    if response.status != "updated" {
        return Err("Area was not saved".into());
    }
    // If closing fails, retain the updated revision so a retry cannot resurrect
    // stale settings. Other editor processes are protected by coordinator OCC.
    if let Some(active) = state
        .session
        .lock()
        .map_err(|_| "Editor unavailable")?
        .as_mut()
    {
        active.revision = response.revision;
    }
    window.close().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn area() -> Area {
        Area {
            monitor: MonitorSnapshot {
                name: "display".into(),
                work_area: Rect {
                    x: -1920,
                    y: -200,
                    width: 1920,
                    height: 1040,
                },
                scale_factor: 1.5,
            },
            rect: Rect {
                x: -1600,
                y: 0,
                width: 600,
                height: 300,
            },
        }
    }
    #[test]
    fn negative_origin_and_monitor_validation() {
        let a = area();
        assert!(a.available(&[a.monitor.clone()]));
        assert!(!a.available(&[]));
        assert!(!a.available(&[a.monitor.clone(), a.monitor.clone()]));
        let mut changed = a.monitor.clone();
        changed.scale_factor = 2.0;
        assert!(!a.available(&[changed]));
    }
    #[test]
    fn full_rect_not_center_must_fit_work_area() {
        let mut a = area();
        a.rect.x = -100;
        assert!(!a.valid());
        a = area();
        a.rect.y = 800;
        assert!(!a.valid());
        a = area();
        a.rect.width = 0;
        assert!(!a.valid());
        a = area();
        a.monitor.scale_factor = f64::NAN;
        assert!(!a.valid());
        a = area();
        a.rect.x = i32::MAX;
        assert!(!a.valid());
        a = area();
        a.monitor.name = "😀".repeat(129);
        assert!(!a.valid());
        a = area();
        a.monitor.name = "bad\u{0085}name".into();
        assert!(!a.valid());
    }
    #[test]
    fn strict_responses_and_conflicts() {
        let ready =
            serde_json::json!({"status":"ready","schemaVersion":"1","revision":0,"area":null});
        assert!(parse_response(ready.clone()).is_ok());
        let mut invalid = ready.clone();
        invalid["token"] = "secret".into();
        assert!(parse_response(invalid).is_err());
        let mut conflict = ready.clone();
        conflict["status"] = "conflict".into();
        assert!(parse_response(conflict)
            .err()
            .unwrap()
            .contains("Another pet"));
        let mut invalid = ready;
        invalid["revision"] = serde_json::json!(9_007_199_254_740_992u64);
        assert!(parse_response(invalid).is_err());
        assert!(
            parse_response(serde_json::json!({"status":"failed", "reason":"secret path"}))
                .err()
                .unwrap()
                .contains("service unavailable")
        );
    }
}
