use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use super::{is_lock_alive, is_safe_session_id, read_window_position, SavedWindowPosition};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct MonitorBounds {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) scale_factor: f64,
    pub(crate) is_primary: bool,
    pub(crate) is_current: bool,
}

fn normalized_scale_factor(scale: f64) -> f64 {
    if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    }
}

pub(crate) fn build_monitors(
    available: &[tauri::Monitor],
    primary: Option<&tauri::Monitor>,
    current: Option<&tauri::Monitor>,
) -> Vec<MonitorBounds> {
    let monitor_geo = |m: &tauri::Monitor| -> (i32, i32, u32, u32) {
        let pos = m.position();
        let size = m.size();
        (pos.x, pos.y, size.width, size.height)
    };

    let primary_geo = primary.map(monitor_geo);
    let current_geo = current.map(monitor_geo);

    let mut result: Vec<MonitorBounds> = Vec::new();

    for m in available {
        let geo = monitor_geo(m);
        let is_pri = primary_geo == Some(geo);
        let is_cur = current_geo == Some(geo);
        if let Some(existing) = result
            .iter_mut()
            .find(|b| (b.x, b.y, b.width, b.height) == geo)
        {
            existing.is_primary |= is_pri;
            existing.is_current |= is_cur;
        } else {
            let scale = m.scale_factor();
            result.push(MonitorBounds {
                x: geo.0,
                y: geo.1,
                width: geo.2,
                height: geo.3,
                scale_factor: normalized_scale_factor(scale),
                is_primary: is_pri,
                is_current: is_cur,
            });
        }
    }

    if let Some(pri) = primary {
        let geo = monitor_geo(pri);
        if !result.iter().any(|b| (b.x, b.y, b.width, b.height) == geo) {
            let scale = pri.scale_factor();
            result.push(MonitorBounds {
                x: geo.0,
                y: geo.1,
                width: geo.2,
                height: geo.3,
                scale_factor: normalized_scale_factor(scale),
                is_primary: true,
                is_current: current_geo == Some(geo),
            });
        }
    }

    if let Some(cur) = current {
        let geo = monitor_geo(cur);
        if !result.iter().any(|b| (b.x, b.y, b.width, b.height) == geo) {
            let scale = cur.scale_factor();
            result.push(MonitorBounds {
                x: geo.0,
                y: geo.1,
                width: geo.2,
                height: geo.3,
                scale_factor: normalized_scale_factor(scale),
                is_primary: primary_geo == Some(geo),
                is_current: true,
            });
        }
    }

    result
}

pub(crate) fn choose_target_monitor<'a>(
    monitors: &'a [MonitorBounds],
    peer_positions: &[SavedWindowPosition],
) -> Option<&'a MonitorBounds> {
    if monitors.is_empty() {
        return None;
    }

    let contains_peer = |m: &MonitorBounds, p: &SavedWindowPosition| -> bool {
        let px = p.x as i64;
        let py = p.y as i64;
        let mx = m.x as i64;
        let my = m.y as i64;
        let mw = m.width as i64;
        let mh = m.height as i64;
        px >= mx && px < mx.saturating_add(mw) && py >= my && py < my.saturating_add(mh)
    };

    let counts: Vec<usize> = monitors
        .iter()
        .map(|m| {
            peer_positions
                .iter()
                .filter(|p| contains_peer(m, p))
                .count()
        })
        .collect();

    let max_count = counts.iter().copied().max().unwrap_or(0);

    let candidates: Vec<&'a MonitorBounds> = monitors
        .iter()
        .zip(counts.iter())
        .filter(|(_, &c)| c == max_count)
        .map(|(m, _)| m)
        .collect();

    if let Some(&pri) = candidates.iter().find(|m| m.is_primary) {
        return Some(pri);
    }
    if let Some(&cur) = candidates.iter().find(|m| m.is_current) {
        return Some(cur);
    }
    candidates.first().copied()
}

pub(crate) fn calculate_auto_stagger_position(
    monitor: &MonitorBounds,
    window_width: u32,
    window_height: u32,
    peer_positions: &[SavedWindowPosition],
) -> SavedWindowPosition {
    let scale = normalized_scale_factor(monitor.scale_factor);

    let margin_x = (24.0 * scale).round() as i64;
    let margin_y = (48.0 * scale).round() as i64;
    let gap_x = (16.0 * scale).round() as i64;
    let gap_y = (16.0 * scale).round() as i64;

    let mon_x = monitor.x as i64;
    let mon_y = monitor.y as i64;
    let mon_w = monitor.width as i64;
    let mon_h = monitor.height as i64;
    let win_w = window_width as i64;
    let win_h = window_height as i64;

    let unconstrained_slot0_x = mon_x
        .saturating_add(mon_w)
        .saturating_sub(margin_x)
        .saturating_sub(win_w);
    let unconstrained_slot0_y = mon_y
        .saturating_add(mon_h)
        .saturating_sub(margin_y)
        .saturating_sub(win_h);

    let slot0_x = if unconstrained_slot0_x < mon_x {
        mon_x
    } else {
        unconstrained_slot0_x
    };
    let slot0_y = if unconstrained_slot0_y < mon_y {
        mon_y
    } else {
        unconstrained_slot0_y
    };

    let available_w = mon_w.saturating_sub(margin_x.saturating_mul(2));
    let cols: i64 = if available_w < win_w || win_w <= 0 {
        1
    } else {
        let remaining_w = available_w.saturating_sub(win_w);
        let stride_x = win_w.saturating_add(gap_x);
        if stride_x > 0 {
            1 + (remaining_w / stride_x)
        } else {
            1
        }
    };

    let available_h = mon_h.saturating_sub(margin_y.saturating_mul(2));
    let rows: i64 = if available_h < win_h || win_h <= 0 {
        1
    } else {
        let remaining_h = available_h.saturating_sub(win_h);
        let stride_y = win_h.saturating_add(gap_y);
        if stride_y > 0 {
            1 + (remaining_h / stride_y)
        } else {
            1
        }
    };

    let stride_x = win_w.saturating_add(gap_x);
    let stride_y = win_h.saturating_add(gap_y);

    let total_slots = cols.saturating_mul(rows).max(1);
    let max_search = (total_slots.min(4096)) as usize;

    let to_saved = |x: i64, y: i64| -> SavedWindowPosition {
        SavedWindowPosition {
            x: x.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
            y: y.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
        }
    };

    for slot_idx in 0..max_search {
        let col = (slot_idx as i64) % cols;
        let row = (slot_idx as i64) / cols;

        let x = slot0_x.saturating_sub(col.saturating_mul(stride_x));
        let y = slot0_y.saturating_sub(row.saturating_mul(stride_y));

        let candidate = to_saved(x, y);
        let candidate_left = candidate.x as i64;
        let candidate_top = candidate.y as i64;
        let candidate_right = candidate_left.saturating_add(win_w.max(1));
        let candidate_bottom = candidate_top.saturating_add(win_h.max(1));
        let is_occupied = peer_positions.iter().any(|peer| {
            let peer_left = peer.x as i64;
            let peer_top = peer.y as i64;
            let peer_right = peer_left.saturating_add(win_w.max(1));
            let peer_bottom = peer_top.saturating_add(win_h.max(1));
            candidate_left < peer_right
                && candidate_right > peer_left
                && candidate_top < peer_bottom
                && candidate_bottom > peer_top
        });

        if !is_occupied {
            return candidate;
        }
    }

    to_saved(slot0_x, slot0_y)
}

pub(crate) fn collect_active_peer_positions(
    current_sid: &str,
    lock_dirs: &[PathBuf],
    positions_dir: &PathBuf,
) -> Vec<SavedWindowPosition> {
    collect_active_peer_positions_with_liveness(
        current_sid,
        lock_dirs,
        positions_dir,
        is_lock_alive,
    )
}

pub(crate) fn collect_active_peer_positions_with_liveness<F>(
    current_sid: &str,
    lock_dirs: &[PathBuf],
    positions_dir: &PathBuf,
    is_alive: F,
) -> Vec<SavedWindowPosition>
where
    F: Fn(&PathBuf) -> bool,
{
    let mut seen_sids = HashSet::new();
    let mut peer_positions = Vec::new();

    for dir in lock_dirs {
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name_str = match file_name.to_str() {
                Some(s) => s,
                None => continue,
            };

            if !name_str.starts_with("pet-") || !name_str.ends_with(".lock") {
                continue;
            }

            let sid = &name_str[4..name_str.len() - 5];
            if sid.is_empty() || sid == current_sid || !is_safe_session_id(sid) {
                continue;
            }

            let lock_path = entry.path();
            if !is_alive(&lock_path) {
                continue;
            }

            if !seen_sids.insert(sid.to_string()) {
                continue;
            }

            let pos_path = positions_dir.join(format!("{}.json", sid));
            if let Some(pos) = read_window_position(&pos_path) {
                peer_positions.push(pos);
            }
        }
    }

    peer_positions
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn make_monitor(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        scale_factor: f64,
        is_primary: bool,
        is_current: bool,
    ) -> MonitorBounds {
        MonitorBounds {
            x,
            y,
            width,
            height,
            scale_factor,
            is_primary,
            is_current,
        }
    }

    #[test]
    fn test_first_bottom_right() {
        let monitor = make_monitor(0, 0, 1920, 1080, 1.0, true, true);
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &[]);
        assert_eq!(pos, SavedWindowPosition { x: 1596, y: 732 });
    }

    #[test]
    fn test_second_left() {
        let monitor = make_monitor(0, 0, 1920, 1080, 1.0, true, true);
        let peers = vec![SavedWindowPosition { x: 1596, y: 732 }];
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos, SavedWindowPosition { x: 1280, y: 732 });
    }

    #[test]
    fn test_dragged_peer_near_slot_still_counts_as_occupied() {
        let monitor = make_monitor(0, 0, 1920, 1080, 1.0, true, true);
        let peers = vec![SavedWindowPosition { x: 1606, y: 742 }];
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos, SavedWindowPosition { x: 1280, y: 732 });
    }

    #[test]
    fn test_non_finite_scale_falls_back_to_one() {
        let monitor = make_monitor(0, 0, 1920, 1080, f64::INFINITY, true, true);
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &[]);
        assert_eq!(pos, SavedWindowPosition { x: 1596, y: 732 });
    }

    #[test]
    fn test_row_wrap() {
        let monitor = make_monitor(0, 0, 1920, 1080, 1.0, true, true);
        let peers = vec![
            SavedWindowPosition { x: 1596, y: 732 },
            SavedWindowPosition { x: 1280, y: 732 },
            SavedWindowPosition { x: 964, y: 732 },
            SavedWindowPosition { x: 648, y: 732 },
            SavedWindowPosition { x: 332, y: 732 },
        ];
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos, SavedWindowPosition { x: 1596, y: 416 });
    }

    #[test]
    fn test_gap_fill() {
        let monitor = make_monitor(0, 0, 1920, 1080, 1.0, true, true);
        let peers = vec![
            SavedWindowPosition { x: 1596, y: 732 },
            SavedWindowPosition { x: 964, y: 732 },
        ];
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos, SavedWindowPosition { x: 1280, y: 732 });
    }

    #[test]
    fn test_negative_origin() {
        let monitor = make_monitor(-1920, -1080, 1920, 1080, 1.0, false, false);
        let pos0 = calculate_auto_stagger_position(&monitor, 300, 300, &[]);
        assert_eq!(pos0, SavedWindowPosition { x: -324, y: -348 });

        let peers = vec![pos0];
        let pos1 = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos1, SavedWindowPosition { x: -640, y: -348 });
    }

    #[test]
    fn test_dpi_scaling_1_5x_and_2x() {
        // 1.5x DPI
        let mon_1_5x = make_monitor(0, 0, 1920, 1080, 1.5, true, true);
        let pos0 = calculate_auto_stagger_position(&mon_1_5x, 300, 300, &[]);
        assert_eq!(pos0, SavedWindowPosition { x: 1584, y: 708 });

        let peers = vec![pos0];
        let pos1 = calculate_auto_stagger_position(&mon_1_5x, 300, 300, &peers);
        assert_eq!(pos1, SavedWindowPosition { x: 1260, y: 708 });

        // 2.0x DPI
        let mon_2x = make_monitor(0, 0, 3840, 2160, 2.0, true, true);
        let pos0_2x = calculate_auto_stagger_position(&mon_2x, 600, 600, &[]);
        assert_eq!(pos0_2x, SavedWindowPosition { x: 3192, y: 1464 });

        let peers_2x = vec![pos0_2x];
        let pos1_2x = calculate_auto_stagger_position(&mon_2x, 600, 600, &peers_2x);
        assert_eq!(pos1_2x, SavedWindowPosition { x: 2560, y: 1464 });
    }

    #[test]
    fn test_tiny_monitor() {
        let monitor = make_monitor(50, 60, 100, 100, 1.0, true, true);
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &[]);
        assert_eq!(pos, SavedWindowPosition { x: 50, y: 60 });

        let zero_mon = make_monitor(10, 20, 0, 0, 1.0, true, true);
        let pos_zero = calculate_auto_stagger_position(&zero_mon, 300, 300, &[]);
        assert_eq!(pos_zero, SavedWindowPosition { x: 10, y: 20 });
    }

    #[test]
    fn test_saturated() {
        let monitor = make_monitor(0, 0, 400, 400, 1.0, true, true);
        let slot0 = SavedWindowPosition { x: 76, y: 52 };
        let peers = vec![slot0];
        let pos = calculate_auto_stagger_position(&monitor, 300, 300, &peers);
        assert_eq!(pos, slot0);
    }

    #[test]
    fn test_extreme_origin_and_size_no_wrap() {
        let extreme_mon = make_monitor(i32::MIN, i32::MAX, u32::MAX, u32::MAX, 1.0, true, true);
        let pos = calculate_auto_stagger_position(&extreme_mon, 300, 300, &[]);
        assert!(pos.x <= i32::MAX && pos.x >= i32::MIN);
        assert!(pos.y <= i32::MAX && pos.y >= i32::MIN);
    }

    #[test]
    fn test_choose_target_monitor_cluster_tie_fallback() {
        let mon_a = make_monitor(0, 0, 1920, 1080, 1.0, false, false);
        let mon_b = make_monitor(1920, 0, 1920, 1080, 1.0, false, false);
        let monitors = vec![mon_a.clone(), mon_b.clone()];

        // 1. Cluster test (mon_a has 2 peers, mon_b has 1 peer)
        let peers = vec![
            SavedWindowPosition { x: 100, y: 100 },
            SavedWindowPosition { x: 200, y: 200 },
            SavedWindowPosition { x: 2000, y: 100 },
        ];
        let chosen = choose_target_monitor(&monitors, &peers).unwrap();
        assert_eq!(chosen.x, 0);

        // 2. Tie test (primary wins)
        let mut mon_a_pri = mon_a.clone();
        mon_a_pri.is_primary = true;
        let tied_monitors = vec![mon_b.clone(), mon_a_pri.clone()];
        let tied_peers = vec![
            SavedWindowPosition { x: 100, y: 100 },
            SavedWindowPosition { x: 2000, y: 100 },
        ];
        let chosen_pri = choose_target_monitor(&tied_monitors, &tied_peers).unwrap();
        assert_eq!(chosen_pri.x, 0);

        // 3. Tie test (current wins if no primary)
        let mut mon_b_cur = mon_b.clone();
        mon_b_cur.is_current = true;
        let cur_monitors = vec![mon_a.clone(), mon_b_cur.clone()];
        let chosen_cur = choose_target_monitor(&cur_monitors, &tied_peers).unwrap();
        assert_eq!(chosen_cur.x, 1920);

        // 4. Tie test (stable first if neither primary nor current)
        let chosen_first = choose_target_monitor(&monitors, &tied_peers).unwrap();
        assert_eq!(chosen_first.x, 0);

        // 5. No peers fallback: primary wins
        let no_peer_monitors = vec![mon_b_cur.clone(), mon_a_pri.clone()];
        let chosen_no_peer_pri = choose_target_monitor(&no_peer_monitors, &[]).unwrap();
        assert_eq!(chosen_no_peer_pri.x, 0);

        // 6. No peers fallback: current wins if no primary
        let no_peer_cur_monitors = vec![mon_a.clone(), mon_b_cur.clone()];
        let chosen_no_peer_cur = choose_target_monitor(&no_peer_cur_monitors, &[]).unwrap();
        assert_eq!(chosen_no_peer_cur.x, 1920);

        // 7. No peers fallback: stable first if neither
        let chosen_no_peer_first = choose_target_monitor(&monitors, &[]).unwrap();
        assert_eq!(chosen_no_peer_first.x, 0);

        // 8. Empty monitors
        assert!(choose_target_monitor(&[], &[]).is_none());
    }

    #[test]
    fn test_lock_collection_scenarios() {
        let temp_dir = std::env::temp_dir().join(format!("pet_test_layout_{}", std::process::id()));
        let lock_dir1 = temp_dir.join("locks1");
        let lock_dir2 = temp_dir.join("locks2");
        let pos_dir = temp_dir.join("positions");

        let _ = fs::create_dir_all(&lock_dir1);
        let _ = fs::create_dir_all(&lock_dir2);
        let _ = fs::create_dir_all(&pos_dir);

        // 1. Current session lock -> must be excluded
        fs::write(lock_dir1.join("pet-curr.lock"), "1234").unwrap();
        fs::write(pos_dir.join("curr.json"), r#"{"x":100,"y":100}"#).unwrap();

        // 2. Dead lock -> mock liveness says false -> excluded
        fs::write(lock_dir1.join("pet-dead.lock"), "9999").unwrap();
        fs::write(pos_dir.join("dead.json"), r#"{"x":200,"y":200}"#).unwrap();

        // 3. Malformed filenames -> excluded
        fs::write(lock_dir1.join("not-a-pet.lock"), "1234").unwrap();
        fs::write(lock_dir1.join("pet-.lock"), "1234").unwrap();
        fs::write(lock_dir1.join("pet-bad..sid.lock"), "1234").unwrap();

        // 4. Live lock without position file -> excluded
        fs::write(lock_dir1.join("pet-nopos.lock"), "1234").unwrap();

        // 5. Live lock with malformed position JSON -> excluded
        fs::write(lock_dir1.join("pet-badjson.lock"), "1234").unwrap();
        fs::write(pos_dir.join("badjson.json"), "invalid json").unwrap();

        // 6. Valid live peer lock -> included
        fs::write(lock_dir1.join("pet-peer1.lock"), "1234").unwrap();
        fs::write(pos_dir.join("peer1.json"), r#"{"x":500,"y":600}"#).unwrap();

        // 7. Duplicate peer lock across dirs -> deduplicated
        fs::write(lock_dir2.join("pet-peer1.lock"), "1234").unwrap();

        // 8. Another valid live peer in lock_dir2 -> included
        fs::write(lock_dir2.join("pet-peer2.lock"), "1234").unwrap();
        fs::write(pos_dir.join("peer2.json"), r#"{"x":700,"y":800}"#).unwrap();

        // 9. Same sid appears first as a dead stale lock, then as a live lock.
        // Deduplication must not let the stale entry hide the active process.
        fs::write(lock_dir1.join("pet-revived.lock"), "9999").unwrap();
        fs::write(lock_dir2.join("pet-revived.lock"), "1234").unwrap();
        fs::write(pos_dir.join("revived.json"), r#"{"x":900,"y":1000}"#).unwrap();

        let first_lock_dir = lock_dir1.clone();
        let liveness = move |path: &PathBuf| -> bool {
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            if file_name == "pet-dead.lock" {
                return false;
            }
            !(file_name == "pet-revived.lock" && path.parent() == Some(first_lock_dir.as_path()))
        };

        let positions = collect_active_peer_positions_with_liveness(
            "curr",
            &[lock_dir1, lock_dir2],
            &pos_dir,
            liveness,
        );

        assert_eq!(positions.len(), 3);
        assert!(positions.contains(&SavedWindowPosition { x: 500, y: 600 }));
        assert!(positions.contains(&SavedWindowPosition { x: 700, y: 800 }));
        assert!(positions.contains(&SavedWindowPosition { x: 900, y: 1000 }));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
