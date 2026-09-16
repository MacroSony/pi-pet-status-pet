//! Native-only ephemeral scene execution. HTTP never exposes coordinates/IDs to WebView.
use super::activity_area::{Area, MonitorSnapshot, Rect};
use super::{
    default_pet_dir, default_runtime_config_path, handle_window_moved_logic,
    post_clawd_endpoint_blocking, read_runtime_port, read_status,
};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Manager, PhysicalPosition, WebviewWindow};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Scene {
    scene_id: String,
    target: Rect,
    area: Area,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportReply {
    status: String,
    scene: Option<Scene>,
}
#[derive(Clone)]
struct Motion {
    scene: Scene,
    from: Rect,
    started: Instant,
    placement: Option<(Instant, Rect)>,
    epoch: u64,
}
struct Local {
    pet_id: String,
    seq: u64,
    epoch: u64,
    control_epoch: u64,
    interaction: bool,
    seen: Option<String>,
    cancelled: Option<String>,
    outcome: Option<&'static str>,
    motion: Option<Motion>,
    replied: Instant,
    pending_position: Option<(String, PhysicalPosition<i32>, Instant)>,
}
impl Default for Local {
    fn default() -> Self {
        Self {
            pet_id: String::new(),
            seq: 0,
            epoch: 0,
            control_epoch: 0,
            interaction: false,
            seen: None,
            cancelled: None,
            outcome: None,
            motion: None,
            replied: Instant::now(),
            pending_position: None,
        }
    }
}
impl Local {
    // Unlike response-local epoch, this also invalidates an assignment that
    // the coordinator created but this pet has not fetched yet. A complete
    // drag between two reports must not be invisible to the coordinator.
    fn interrupt(&mut self) {
        self.control_epoch = self.control_epoch.wrapping_add(1);
        self.cancel();
    }
    fn cancel(&mut self) {
        self.epoch = self.epoch.wrapping_add(1);
        if let Some(id) = self.seen.clone() {
            self.cancelled = Some(id);
            self.outcome = Some("cancelled");
        }
        self.motion = None;
    }
    fn accept(&mut self, scene: Option<Scene>, request_epoch: u64, from: Rect) {
        self.replied = Instant::now();
        let Some(scene) = scene else {
            self.cancel();
            return;
        };
        if self.epoch != request_epoch || self.interaction {
            self.cancelled = Some(scene.scene_id);
            self.outcome = Some("cancelled");
            self.motion = None;
            return;
        }
        if self.seen.as_ref() == Some(&scene.scene_id)
            || self.cancelled.as_ref() == Some(&scene.scene_id)
        {
            return;
        }
        self.seen = Some(scene.scene_id.clone());
        self.outcome = Some("moving");
        self.motion = Some(Motion {
            scene,
            from,
            started: Instant::now(),
            placement: None,
            epoch: self.epoch,
        });
    }
}
pub(crate) struct GatheringState {
    instance: String,
    local: Mutex<Local>,
    transport: Mutex<()>,
}
impl Default for GatheringState {
    fn default() -> Self {
        Self {
            instance: format!(
                "{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos()
            ),
            local: Mutex::new(Local::default()),
            transport: Mutex::new(()),
        }
    }
}
fn rect(window: &WebviewWindow) -> Result<Rect, String> {
    let p = window.outer_position().map_err(|_| "Window unavailable")?;
    let s = window.outer_size().map_err(|_| "Window unavailable")?;
    Ok(Rect {
        x: p.x,
        y: p.y,
        width: s.width,
        height: s.height,
    })
}
fn monitors(window: &WebviewWindow) -> Result<Vec<MonitorSnapshot>, String> {
    Ok(window
        .available_monitors()
        .map_err(|_| "Monitors unavailable")?
        .iter()
        .map(MonitorSnapshot::from_monitor)
        .collect())
}
fn blocked(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
    status_path: &Arc<Mutex<PathBuf>>,
) -> bool {
    if !window.is_visible().unwrap_or(false) || window.is_minimized().unwrap_or(true) {
        return true;
    }
    if app.get_webview_window("activity-area").is_some() {
        return true;
    }
    if app
        .get_webview_window("pet-chat")
        .is_some_and(|w| w.is_focused().unwrap_or(true))
    {
        return true;
    }
    let path = match status_path.lock() {
        Ok(p) => p.clone(),
        Err(_) => return true,
    };
    read_status(&path).map_or(true, |s| {
        matches!(s.state.as_str(), "waiting" | "error" | "offline" | "closed")
    })
}
fn post(port: u16, action: &str, data: serde_json::Value) -> Result<serde_json::Value, String> {
    let bytes = serde_json::to_vec(&data).map_err(|_| "Invalid gathering request")?;
    post_clawd_endpoint_blocking(port, &format!("/pet-gathering/{action}"), &bytes)
        .map_err(|_| "Cannot reach gathering coordinator".to_string())
}
fn report_locked(
    app: &tauri::AppHandle,
    sid: &Arc<Mutex<String>>,
    status: &Arc<Mutex<PathBuf>>,
    port: u16,
) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Pet window closed")?;
    let state = app.state::<GatheringState>();
    let pet_id = sid.lock().map_err(|_| "Session unavailable")?.clone();
    if pet_id.is_empty() {
        return Err("Pet is not bound".into());
    }
    let geometry = rect(&window)?;
    let topology = monitors(&window)?;
    let is_blocked = blocked(app, &window, status);
    // Never query native UI while holding local: the main-thread tick also
    // needs this mutex. Tauri geometry queries can dispatch synchronously.
    let scale_factor = window.scale_factor().unwrap_or(0.0);
    let (data, epoch) = {
        let mut local = state.local.lock().map_err(|_| "Gathering unavailable")?;
        if local.pet_id != pet_id {
            local.interrupt();
            local.pet_id = pet_id.clone();
            local.seen = None;
            local.cancelled = None;
        }
        if is_blocked {
            local.interrupt();
        }
        local.seq += 1;
        (
            serde_json::json!({"schemaVersion":"1", "petId":pet_id, "instanceId":state.instance,
            "seq":local.seq, "controlEpoch":local.control_epoch, "rect":geometry, "scaleFactor":scale_factor, "monitors":topology,
            "blocked":is_blocked || local.interaction, "cancelSceneId":local.cancelled, "outcome":local.outcome}),
            local.epoch,
        )
    };
    let raw = post(port, "report", data)?;
    let reply: ReportReply =
        serde_json::from_value(raw).map_err(|_| "Gathering report rejected")?;
    if reply.status != "ok" {
        return Err("Gathering report rejected".into());
    }
    if reply.scene.as_ref().is_some_and(|s| {
        s.scene_id.is_empty()
            || s.scene_id.len() > 64
            || !s.area.available(&topology)
            || !s.area.rect.contains(&s.target)
    }) {
        return Err("Invalid or stale gathering target".into());
    }
    let mut local = state.local.lock().map_err(|_| "Gathering unavailable")?;
    if local.pet_id != pet_id {
        return Err("Session changed".into());
    }
    local.accept(reply.scene, epoch, geometry);
    Ok(())
}

// All geometry changes execute on the native UI thread. Queued work re-reads
// epoch/interaction here, rather than applying a captured target after a drag.
fn tick(app: &tauri::AppHandle, status: &Arc<Mutex<PathBuf>>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = app.state::<GatheringState>();
    let (moving, pending) = state
        .local
        .lock()
        .map(|l| (l.motion.is_some(), l.pending_position.is_some()))
        .unwrap_or((false, false));
    if !moving && !pending {
        return;
    }
    let is_blocked = moving && blocked(app, &window, status);
    let motion = {
        let Ok(mut local) = state.local.lock() else {
            return;
        };
        if local.motion.is_some()
            && (is_blocked
                || local.interaction
                || local.replied.elapsed() > Duration::from_millis(900))
        {
            local.interrupt();
        }
        local.motion.clone()
    };
    if let Some(m) = motion {
        let actual = match rect(&window) {
            Ok(r) => r,
            Err(_) => return,
        };
        let topology = monitors(&window).unwrap_or_default();
        // Size changes unrelated to expected per-monitor DPI scaling cancel.
        let expected_size = (actual.width == m.from.width && actual.height == m.from.height)
            || (actual.width == m.scene.target.width && actual.height == m.scene.target.height);
        if !m.scene.area.available(&topology) || !expected_size {
            if let Ok(mut local) = state.local.lock() {
                local.interrupt();
            }
        } else {
            let t = if m.scene.area.rect.contains(&m.from) {
                (m.started.elapsed().as_secs_f64() / 0.45).min(1.0)
            } else {
                1.0
            };
            let eased = t * t * (3.0 - 2.0 * t);
            let x = (m.from.x as f64 + (m.scene.target.x as f64 - m.from.x as f64) * eased).round()
                as i32;
            let y = (m.from.y as f64 + (m.scene.target.y as f64 - m.from.y as f64) * eased).round()
                as i32;
            let proposed = Rect {
                x,
                y,
                width: m.scene.target.width,
                height: m.scene.target.height,
            };
            let permitted = state
                .local
                .lock()
                .map(|l| l.epoch == m.epoch && !l.interaction && l.motion.is_some())
                .unwrap_or(false);
            if !permitted {
                return;
            }
            if let Some((requested, previous)) = m.placement.as_ref() {
                // set_position can enqueue an OS configure event. Validate on
                // later ticks, not against the stale pre-configure rectangle.
                if actual.x == m.scene.target.x
                    && actual.y == m.scene.target.y
                    && m.scene.area.rect.contains(&actual)
                {
                    if let Ok(mut local) = state.local.lock() {
                        if local.epoch == m.epoch {
                            local.motion = None;
                            local.outcome = Some("arrived");
                        }
                    }
                } else if requested.elapsed() >= Duration::from_millis(250) {
                    if !m.scene.area.rect.contains(&actual) {
                        let _ = window.set_position(PhysicalPosition::new(previous.x, previous.y));
                    }
                    if let Ok(mut local) = state.local.lock() {
                        local.interrupt();
                    }
                }
            } else if !m.scene.area.rect.contains(&proposed)
                || window.set_position(PhysicalPosition::new(x, y)).is_err()
            {
                if let Ok(mut local) = state.local.lock() {
                    local.interrupt();
                }
            } else if t >= 1.0 {
                if let Ok(mut local) = state.local.lock() {
                    if local.epoch == m.epoch {
                        if let Some(motion) = local.motion.as_mut() {
                            motion.placement = Some((Instant::now(), actual));
                        }
                    }
                }
            }
        }
    }
    let pending = {
        let Ok(mut local) = state.local.lock() else {
            return;
        };
        if local.motion.is_none()
            && !local.interaction
            && local
                .pending_position
                .as_ref()
                .is_some_and(|(_, _, at)| at.elapsed() >= Duration::from_millis(200))
        {
            local.pending_position.take()
        } else {
            None
        }
    };
    if let Some((sid, position, _)) = pending {
        handle_window_moved_logic("main", &sid, &default_pet_dir().join("positions"), position);
    }
}

pub(crate) fn note_moved(app: &tauri::AppHandle, sid: String, position: PhysicalPosition<i32>) {
    let state = app.state::<GatheringState>();
    if let Ok(mut local) = state.local.lock() {
        local.pending_position = Some((sid, position, Instant::now()));
    };
}
pub(crate) fn flush_position(app: &tauri::AppHandle) {
    let state = app.state::<GatheringState>();
    if let Ok(mut local) = state.local.lock() {
        if let Some((sid, position, _)) = local.pending_position.take() {
            handle_window_moved_logic("main", &sid, &default_pet_dir().join("positions"), position);
        }
    };
}
pub(crate) fn start(app: tauri::AppHandle, sid: Arc<Mutex<String>>, status: Arc<Mutex<PathBuf>>) {
    let poll_app = app.clone();
    let poll_status = status.clone();
    std::thread::spawn(move || loop {
        if poll_app.get_webview_window("main").is_none() {
            break;
        }
        let state = poll_app.state::<GatheringState>();
        let result = (|| {
            let _serial = state
                .transport
                .lock()
                .map_err(|_| "Gathering unavailable")?;
            let port = read_runtime_port(&default_runtime_config_path())?;
            report_locked(&poll_app, &sid, &poll_status, port)
        })();
        if result.is_err() {
            if let Ok(mut local) = state.local.lock() {
                local.interrupt();
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    });
    std::thread::spawn(move || loop {
        if app.get_webview_window("main").is_none() {
            break;
        }
        let handle = app.clone();
        let status = status.clone();
        // One outstanding tick only: don't build an animation backlog during a
        // native modal drag loop or stalled WebView/UI thread.
        let (tx, rx) = std::sync::mpsc::channel();
        if app
            .run_on_main_thread(move || {
                tick(&handle, &status);
                let _ = tx.send(());
            })
            .is_err()
        {
            break;
        }
        if rx.recv().is_err() {
            break;
        }
        std::thread::sleep(Duration::from_millis(25));
    });
}

#[tauri::command]
pub(crate) fn set_gathering_interaction(
    window: WebviewWindow,
    state: tauri::State<'_, GatheringState>,
    blocked: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Unavailable in this window".into());
    }
    let mut local = state.local.lock().map_err(|_| "Gathering unavailable")?;
    local.interaction = blocked;
    if blocked {
        local.interrupt();
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn request_gathering(
    app: tauri::AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, Arc<Mutex<String>>>,
    status: tauri::State<'_, Arc<Mutex<PathBuf>>>,
    end: bool,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Unavailable in this window".into());
    }
    let sid = session.inner().clone();
    let path = status.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<GatheringState>();
        let _serial = state.transport.lock().map_err(|_| "Gathering unavailable")?;
        let port = read_runtime_port(&default_runtime_config_path()).map_err(|_| "Clawd unavailable")?;
        report_locked(&app, &sid, &path, port)?;
        let id = sid.lock().map_err(|_| "Session unavailable")?.clone();
        let raw = post(port, if end { "end" } else { "start" }, serde_json::json!({"schemaVersion":"1", "petId":id, "instanceId":state.instance}))?;
        if raw.get("status").and_then(|x| x.as_str()) == Some(if end { "ended" } else { "started" }) {
            if end { if let Ok(mut local) = state.local.lock() { local.interrupt(); } }
            Ok(if end { "Gathering ended; pets stay where they are.".into() }
                else { format!("Gathering {} pet(s).", raw.get("participants").and_then(|x| x.as_u64()).unwrap_or(0)) })
        } else {
            let reason = match raw.get("reason").and_then(|x| x.as_str()) {
                Some("insufficient_space") => "Activity area is too small for this group. Enlarge it in Settings.",
                Some("area_unavailable") => "Configure a valid desktop activity area in Settings first.",
                Some("other_team_active") => "Another Team is gathering. End that scene first.",
                Some("not_active") => "No active gathering for this pet.",
                _ => "Gathering unavailable. Check Team membership, activity area and visible pets, then retry.",
            }; Err(reason.into())
        }
    }).await.map_err(|_| "Gathering request failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn scene(id: &str) -> Scene {
        Scene {
            scene_id: id.into(),
            target: Rect {
                x: 50,
                y: 50,
                width: 100,
                height: 100,
            },
            area: Area {
                monitor: MonitorSnapshot {
                    name: "screen".into(),
                    work_area: Rect {
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 600,
                    },
                    scale_factor: 1.0,
                },
                rect: Rect {
                    x: 0,
                    y: 0,
                    width: 600,
                    height: 400,
                },
            },
        }
    }
    fn from() -> Rect {
        Rect {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        }
    }
    #[test]
    fn idle_replies_do_not_advance_control_epoch_but_interruptions_do() {
        let mut local = Local::default();
        let frame = scene("one").target;
        local.accept(None, 0, frame.clone());
        assert_eq!(local.control_epoch, 0);
        local.interrupt();
        assert_eq!(local.control_epoch, 1);
        local.accept(None, local.epoch, frame);
        assert_eq!(local.control_epoch, 1);
    }
    #[test]
    fn cancellation_before_late_reply_cannot_move_and_new_scene_can() {
        let mut l = Local::default();
        let old = l.epoch;
        l.cancel();
        l.accept(Some(scene("old")), old, from());
        assert!(l.motion.is_none());
        assert_eq!(l.cancelled.as_deref(), Some("old"));
        l.accept(Some(scene("old")), l.epoch, from());
        assert!(l.motion.is_none());
        l.accept(Some(scene("new")), l.epoch, from());
        assert!(l.motion.is_some());
    }
    #[test]
    fn repeated_scene_does_not_restart_completed_movement_and_end_does_not_restore() {
        let mut l = Local::default();
        l.accept(Some(scene("one")), 0, from());
        l.motion = None;
        l.outcome = Some("arrived");
        l.accept(Some(scene("one")), 0, from());
        assert!(l.motion.is_none());
        l.accept(None, 0, from());
        assert!(l.motion.is_none());
    }
    #[test]
    fn interaction_blocks_new_scene_until_new_explicit_request() {
        let mut l = Local::default();
        l.interaction = true;
        l.accept(Some(scene("one")), 0, from());
        assert!(l.motion.is_none());
        l.interaction = false;
        l.accept(Some(scene("one")), l.epoch, from());
        assert!(l.motion.is_none());
        l.accept(Some(scene("two")), l.epoch, from());
        assert!(l.motion.is_some());
    }
}
