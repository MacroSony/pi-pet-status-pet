#[cfg(test)]
mod tests {
    use crate::adapter::{self, Adapter, StdinInput};
    use crate::status_map;

    // ── status_map tests ──

    #[test]
    fn test_event_to_state() {
        assert_eq!(status_map::event_to_state("prompt"), "thinking");
        assert_eq!(status_map::event_to_state("tool"), "running");
        assert_eq!(status_map::event_to_state("done"), "idle");
        assert_eq!(status_map::event_to_state("error"), "error");
        assert_eq!(status_map::event_to_state("offline"), "offline");
        assert_eq!(status_map::event_to_state("wait"), "waiting");
        assert_eq!(status_map::event_to_state("subagent"), "delegating");
        assert_eq!(status_map::event_to_state("unknown_event"), "thinking");
    }

    #[test]
    fn test_tool_to_state_claude_tools() {
        assert_eq!(status_map::tool_to_state("Edit"), "editing");
        assert_eq!(status_map::tool_to_state("Write"), "editing");
        assert_eq!(status_map::tool_to_state("NotebookEdit"), "editing");
        assert_eq!(status_map::tool_to_state("Read"), "reading");
        assert_eq!(status_map::tool_to_state("WebFetch"), "reading");
        assert_eq!(status_map::tool_to_state("Grep"), "searching");
        assert_eq!(status_map::tool_to_state("Glob"), "searching");
        assert_eq!(status_map::tool_to_state("WebSearch"), "searching");
        assert_eq!(status_map::tool_to_state("Bash"), "running");
        assert_eq!(status_map::tool_to_state("Agent"), "delegating");
        assert_eq!(status_map::tool_to_state("Skill"), "delegating");
    }

    #[test]
    fn test_tool_to_state_copilot_tools() {
        assert_eq!(status_map::tool_to_state("replace_string_in_file"), "editing");
        assert_eq!(status_map::tool_to_state("create_file"), "editing");
        assert_eq!(status_map::tool_to_state("edit_file"), "editing");
        assert_eq!(status_map::tool_to_state("read_file"), "reading");
        assert_eq!(status_map::tool_to_state("fetch_webpage"), "reading");
        assert_eq!(status_map::tool_to_state("list_dir"), "reading");
        assert_eq!(status_map::tool_to_state("grep_search"), "searching");
        assert_eq!(status_map::tool_to_state("semantic_search"), "searching");
        assert_eq!(status_map::tool_to_state("file_search"), "searching");
        assert_eq!(status_map::tool_to_state("run_in_terminal"), "running");
    }

    #[test]
    fn test_tool_to_state_mcp_tools() {
        assert_eq!(status_map::tool_to_state("mcp__github__search_code"), "searching");
        assert_eq!(status_map::tool_to_state("mcp__browser__fetch"), "reading");
        assert_eq!(status_map::tool_to_state("mcp__unknown__something"), "running");
    }

    #[test]
    fn test_tool_to_state_unknown_fallback() {
        assert_eq!(status_map::tool_to_state("some_random_tool"), "running");
        assert_eq!(status_map::tool_to_state(""), "running");
    }

    #[test]
    fn test_tool_detail_generation() {
        assert_eq!(status_map::tool_detail("Edit", "", "/path/to/main.rs"), "Editing main.rs");
        assert_eq!(status_map::tool_detail("Read", "", "/foo/bar.js"), "Reading bar.js");
        assert_eq!(status_map::tool_detail("Grep", "", "TODO"), "Searching: TODO");
        assert_eq!(status_map::tool_detail("Bash", "", ""), "Using Bash");
        // Explicit detail overrides
        assert_eq!(status_map::tool_detail("Edit", "Custom detail", "/foo"), "Custom detail");
    }

    // ── Claude adapter tests ──

    #[test]
    fn test_claude_prompt() {
        let stdin = make_stdin(Some("UserPromptSubmit"), None, None, Some("sess1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
        assert_eq!(ev.session_id, "sess1");
        assert_eq!(ev.session_name, "proj");
        assert!(!ev.launch_only);
    }

    #[test]
    fn test_claude_tool_edit() {
        let input = serde_json::json!({"file_path": "/foo/bar.rs"});
        let stdin = make_stdin(Some("PreToolUse"), Some("Edit"), Some(input), Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert_eq!(ev.tool, "Edit");
        assert!(ev.detail.contains("bar.rs"));
    }

    #[test]
    fn test_claude_tool_grep() {
        let input = serde_json::json!({"pattern": "TODO"});
        let stdin = make_stdin(Some("PreToolUse"), Some("Grep"), Some(input), Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert!(ev.detail.contains("TODO"));
    }

    #[test]
    fn test_claude_tool_mcp() {
        let stdin = make_stdin(Some("PreToolUse"), Some("mcp__github__search_code"), None, Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert!(ev.detail.contains("github: search_code"));
    }

    #[test]
    fn test_claude_stop() {
        let stdin = make_stdin(Some("Stop"), None, None, Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "done");
    }

    #[test]
    fn test_claude_error() {
        let stdin = make_stdin(Some("StopFailure"), None, None, Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "error");
    }

    #[test]
    fn test_claude_session_end() {
        let stdin = make_stdin(Some("SessionEnd"), None, None, Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "closed");
    }

    #[test]
    fn test_claude_subagent() {
        let stdin = make_stdin(Some("SubagentStart"), None, None, Some("s1"), Some("/proj"));
        let ev = adapter::claude::ClaudeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "subagent");
    }

    // ── Copilot adapter tests ──

    #[test]
    fn test_copilot_session_start_writes_thinking() {
        let stdin = make_stdin(Some("sessionStart"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
        assert!(!ev.launch_only);
        assert!(ev.session_id.starts_with("copilot-"));
    }

    #[test]
    fn test_copilot_prompt_submitted() {
        let stdin = make_stdin(Some("userPromptSubmitted"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
    }

    #[test]
    fn test_copilot_post_tool_is_thinking() {
        let stdin = make_stdin(Some("postToolUse"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt"); // NOT done/idle
    }

    #[test]
    fn test_copilot_post_tool_task_complete_is_done() {
        // In autopilot mode, agentStop does NOT fire between iterations.
        // postToolUse with tool_name=task_complete is the only end-of-turn signal.
        let stdin = make_stdin(Some("postToolUse"), Some("task_complete"), None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "done");
        assert_eq!(ev.detail, "Done");
    }

    #[test]
    fn test_copilot_session_end_is_closed() {
        // sessionEnd → closed (matches Claude's SessionEnd behavior)
        let stdin = make_stdin(Some("sessionEnd"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "closed");
    }

    #[test]
    fn test_copilot_session_name_has_suffix() {
        let stdin = make_stdin(Some("sessionStart"), None, None, None, Some("/projects/my-app"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert!(ev.session_name.contains("Copilot"));
        assert!(ev.session_name.contains("my-app"));
    }

    #[test]
    fn test_copilot_agent_stop_is_done() {
        // agentStop is the camelCase turn-complete event per the docs
        let stdin = make_stdin(Some("agentStop"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "done");
    }

    #[test]
    fn test_copilot_post_tool_use_failure_is_error() {
        let raw = r#"{"hookEventName":"postToolUseFailure","toolName":"bash","error":"command not found","cwd":"/proj"}"#;
        let stdin: StdinInput = serde_json::from_str(raw).unwrap();
        // Need to inject the event name as if from CLI arg; use hook_event_name fallback.
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "error");
        assert!(ev.detail.to_lowercase().contains("command"), "got: {}", ev.detail);
    }

    #[test]
    fn test_copilot_post_tool_use_failure_no_tool_name_fallback() {
        // No toolName and no error message — fallback should be "Tool failed" (not " failed")
        let raw = r#"{"hookEventName":"postToolUseFailure","cwd":"/proj"}"#;
        let stdin: StdinInput = serde_json::from_str(raw).unwrap();
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "error");
        assert!(ev.detail.contains("Tool failed"), "got: {}", ev.detail);
    }

    #[test]
    fn test_copilot_subagent_start_is_delegating() {
        let raw = r#"{"hookEventName":"subagentStart","agentName":"researcher","cwd":"/proj"}"#;
        let stdin: StdinInput = serde_json::from_str(raw).unwrap();
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "subagent");
        assert!(ev.detail.contains("researcher"), "got: {}", ev.detail);
    }

    #[test]
    fn test_copilot_subagent_stop_is_thinking() {
        let stdin = make_stdin(Some("subagentStop"), None, None, None, Some("/proj"));
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
    }

    #[test]
    fn test_copilot_pre_compact_ignored() {
        let stdin = make_stdin(Some("preCompact"), None, None, None, Some("/proj"));
        assert!(adapter::copilot::CopilotAdapter.parse(&stdin).is_none());
    }

    #[test]
    fn test_copilot_permission_request_ignored() {
        // permissionRequest is intentionally not hooked (can block the permission flow).
        // Permission state is surfaced via the notification(permission_prompt) event instead.
        let stdin = make_stdin(Some("permissionRequest"), Some("bash"), None, None, Some("/proj"));
        assert!(adapter::copilot::CopilotAdapter.parse(&stdin).is_none());
    }

    #[test]
    fn test_copilot_notification_permission_prompt_waits() {
        let raw = r#"{"hookEventName":"notification","notification_type":"permission_prompt","message":"Permission needed","cwd":"/proj"}"#;
        let stdin: StdinInput = serde_json::from_str(raw).unwrap();
        let ev = adapter::copilot::CopilotAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "wait");
    }

    #[test]
    fn test_copilot_notification_shell_completed_ignored() {
        let raw = r#"{"hookEventName":"notification","notification_type":"shell_completed","cwd":"/proj"}"#;
        let stdin: StdinInput = serde_json::from_str(raw).unwrap();
        assert!(adapter::copilot::CopilotAdapter.parse(&stdin).is_none());
    }

    #[test]
    fn test_copilot_official_tool_names() {
        // Per docs: official Copilot CLI tool names are bash, edit, view, grep, glob, create, web_fetch, task, powershell
        assert_eq!(status_map::tool_to_state("create"), "editing");
        assert_eq!(status_map::tool_to_state("edit"), "editing");
        assert_eq!(status_map::tool_to_state("view"), "reading");
        assert_eq!(status_map::tool_to_state("web_fetch"), "reading");
        assert_eq!(status_map::tool_to_state("grep"), "searching");
        assert_eq!(status_map::tool_to_state("glob"), "searching");
        assert_eq!(status_map::tool_to_state("bash"), "running");
        assert_eq!(status_map::tool_to_state("powershell"), "running");
        assert_eq!(status_map::tool_to_state("task"), "delegating");
    }

    // ── VS Code adapter tests ──

    #[test]
    fn test_vscode_session_start() {
        let stdin = make_stdin(Some("SessionStart"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
        assert!(ev.session_id.starts_with("vscode-"));
        assert!(ev.session_name.contains("VS Code"));
    }

    #[test]
    fn test_vscode_user_prompt() {
        let stdin = make_stdin(Some("UserPromptSubmit"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
    }

    #[test]
    fn test_vscode_pre_tool_edit() {
        let input = serde_json::json!({"filePath": "/foo/bar.ts"});
        let stdin = make_stdin(Some("PreToolUse"), Some("replace_string_in_file"), Some(input), Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert_eq!(ev.tool, "replace_string_in_file");
        assert!(ev.detail.contains("bar.ts"));
    }

    #[test]
    fn test_vscode_pre_tool_read() {
        let input = serde_json::json!({"filePath": "/foo/main.rs"});
        let stdin = make_stdin(Some("PreToolUse"), Some("read_file"), Some(input), Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert!(ev.detail.contains("main.rs"));
    }

    #[test]
    fn test_vscode_pre_tool_search() {
        let input = serde_json::json!({"query": "TODO fixme"});
        let stdin = make_stdin(Some("PreToolUse"), Some("grep_search"), Some(input), Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert!(ev.detail.contains("TODO fixme"));
    }

    #[test]
    fn test_vscode_pre_tool_terminal() {
        let input = serde_json::json!({"command": "npm test"});
        let stdin = make_stdin(Some("PreToolUse"), Some("run_in_terminal"), Some(input), Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "tool");
        assert!(ev.detail.contains("npm test"));
    }

    #[test]
    fn test_vscode_pre_tool_mcp() {
        let stdin = make_stdin(Some("PreToolUse"), Some("mcp__github__search_code"), None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert!(ev.detail.contains("github: search_code"));
    }

    #[test]
    fn test_vscode_pre_tool_mcp_single_underscore() {
        // VS Code MCP tools use single underscore: mcp_server_tool_name
        let stdin = make_stdin(Some("PreToolUse"), Some("mcp_gitkraken_git_add_or_commit"), None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert!(ev.detail.contains("gitkraken"), "detail should contain server name, got: {}", ev.detail);
        assert!(ev.detail.contains("git_add_or_commit"), "detail should contain full tool name, got: {}", ev.detail);
    }

    #[test]
    fn test_vscode_pre_tool_mcp_toolinput_camelcase() {
        // VS Code may send camelCase toolInput instead of snake_case tool_input
        let input = serde_json::json!({ "filePath": "/proj/src/main.rs" });
        let raw = format!(r#"{{"hookEventName":"PreToolUse","toolName":"read_file","toolInput":{},"sessionId":"vsc-001","cwd":"/proj"}}"#, input);
        let stdin: StdinInput = serde_json::from_str(&raw).unwrap();
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert!(ev.detail.contains("main.rs"), "should parse filePath from toolInput, got: {}", ev.detail);
    }

    #[test]
    fn test_vscode_post_tool_is_thinking() {
        let stdin = make_stdin(Some("PostToolUse"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt"); // thinking, not idle
    }

    #[test]
    fn test_vscode_pre_compact_ignored() {
        let stdin = make_stdin(Some("PreCompact"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin);
        assert!(ev.is_none());
    }

    #[test]
    fn test_vscode_subagent_start() {
        let stdin = make_stdin(Some("SubagentStart"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "subagent");
    }

    #[test]
    fn test_vscode_subagent_stop() {
        let stdin = make_stdin(Some("SubagentStop"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "prompt");
    }

    #[test]
    fn test_vscode_stop() {
        let stdin = make_stdin(Some("Stop"), None, None, Some("vsc-001"), Some("/proj"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert_eq!(ev.event, "done");
    }

    #[test]
    fn test_vscode_session_name_has_suffix() {
        let stdin = make_stdin(Some("SessionStart"), None, None, Some("vsc-001"), Some("/projects/my-app"));
        let ev = adapter::vscode::VscodeAdapter.parse(&stdin).unwrap();
        assert!(ev.session_name.contains("VS Code"));
        assert!(ev.session_name.contains("my-app"));
    }

    #[test]
    fn test_window_position_round_trip() {
        let dir = std::env::temp_dir().join(format!(
            "status-pet-position-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path = dir.join("pet_session.json");
        crate::write_window_position(&path, tauri::PhysicalPosition::new(-320, 840));
        let saved = crate::read_window_position(&path).expect("position should round-trip");
        assert_eq!(saved.x, -320);
        assert_eq!(saved.y, 840);
        let _ = std::fs::remove_dir_all(dir);
    }

    // ── PetEvent tests (Phase B) ──

    #[test]
    fn test_read_pet_event_valid() {
        let dir = std::env::temp_dir().join(format!("pet-event-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let event_file = dir.join("event-pet_test123.json");
        let log_file = dir.join("pet-debug.log");

        let event_json = serde_json::json!({
            "schemaVersion": "1",
            "eventId": "cmd_01HZX8E9A2B4C5D6E7F8G9H0JK",
            "petId": "pet_test123",
            "kind": "expression",
            "payload": {
                "text": "Done.",
                "emotion": "happy",
                "speak": false,
                "priority": 3,
                "durationMs": 3000
            },
            "createdAtMs": 1757419200000u64,
            "expiresAtMs": crate::timestamp_millis() + 60000
        });

        std::fs::write(&event_file, event_json.to_string()).unwrap();

        let parsed = crate::read_pet_event(&event_file, &log_file).expect("should parse valid pet event");
        assert_eq!(parsed.schema_version, "1");
        assert_eq!(parsed.event_id, "cmd_01HZX8E9A2B4C5D6E7F8G9H0JK");
        assert_eq!(parsed.pet_id, "pet_test123");
        assert_eq!(parsed.kind, "expression");
        assert_eq!(parsed.payload.text.as_deref(), Some("Done."));
        assert_eq!(parsed.payload.emotion.as_deref(), Some("happy"));
        assert_eq!(parsed.payload.duration_ms, Some(3000));
        assert_eq!(parsed.payload.priority, Some(3));
        assert_eq!(parsed.payload.speak, Some(false));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn test_read_pet_event_expired_is_ignored() {
        let dir = std::env::temp_dir().join(format!("pet-event-exp-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let event_file = dir.join("event-pet_expired.json");
        let log_file = dir.join("pet-debug.log");

        let event_json = serde_json::json!({
            "schemaVersion": "1",
            "eventId": "cmd_expired",
            "petId": "pet_expired",
            "kind": "expression",
            "payload": {
                "text": "Too late"
            },
            "createdAtMs": 1000u64,
            "expiresAtMs": 2000u64 // in the past
        });

        std::fs::write(&event_file, event_json.to_string()).unwrap();

        let parsed = crate::read_pet_event(&event_file, &log_file);
        assert!(parsed.is_none(), "expired event must be ignored");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn test_read_pet_event_malformed_is_ignored() {
        let dir = std::env::temp_dir().join(format!("pet-event-bad-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let event_file = dir.join("event-pet_bad.json");
        let log_file = dir.join("pet-debug.log");

        std::fs::write(&event_file, "not json!").unwrap();
        let parsed = crate::read_pet_event(&event_file, &log_file);
        assert!(parsed.is_none(), "malformed event must be ignored");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn test_resolve_event_path() {
        let status_path = std::path::PathBuf::from("/home/user/.pi-pet/status/status-pet_abc.json");
        let event_path = crate::resolve_event_path(&status_path, "pet_abc");
        assert_eq!(
            event_path,
            std::path::PathBuf::from("/home/user/.pi-pet/events/event-pet_abc.json")
        );
    }

    // ── Runtime config parsing tests ──

    #[test]
    fn test_parse_runtime_port_valid() {
        let json = r#"{"app":"clawd-on-desk","port":23333,"ownerPid":1234}"#;
        let port = crate::parse_runtime_port_from_str(json).unwrap();
        assert_eq!(port, 23333);
    }

    #[test]
    fn test_parse_runtime_port_app_mismatch() {
        let json = r#"{"app":"other-service","port":23333}"#;
        let err = crate::parse_runtime_port_from_str(json).unwrap_err();
        assert!(err.contains("Unsupported runtime app"));
    }

    #[test]
    fn test_parse_runtime_port_missing_port() {
        let json = r#"{"app":"clawd-on-desk"}"#;
        let err = crate::parse_runtime_port_from_str(json).unwrap_err();
        assert!(err.contains("Missing or invalid port"));
    }

    #[test]
    fn test_parse_runtime_port_invalid_port_range() {
        let json = r#"{"app":"clawd-on-desk","port":0}"#;
        assert!(crate::parse_runtime_port_from_str(json).is_err());

        let json_overflow = r#"{"app":"clawd-on-desk","port":70000}"#;
        assert!(crate::parse_runtime_port_from_str(json_overflow).is_err());
    }

    #[test]
    fn test_parse_runtime_port_malformed_json() {
        let json = r#"{"app":"clawd-on-desk", port: invalid}"#;
        assert!(crate::parse_runtime_port_from_str(json).is_err());
    }

    // ── Server header validation tests ──

    #[test]
    fn test_verify_clawd_server_header_valid() {
        assert!(crate::verify_clawd_server_header(Some("clawd-on-desk")).is_ok());
        assert!(crate::verify_clawd_server_header(Some("  clawd-on-desk  ")).is_ok());
    }

    #[test]
    fn test_verify_clawd_server_header_mismatch() {
        let err = crate::verify_clawd_server_header(Some("rogue-server")).unwrap_err();
        assert!(err.contains("Untrusted server response"));
        assert!(err.contains("rogue-server"));
    }

    #[test]
    fn test_verify_clawd_server_header_missing() {
        let err = crate::verify_clawd_server_header(None).unwrap_err();
        assert!(err.contains("missing x-clawd-server header"));
    }

    // ── Request ID safety tests ──

    #[test]
    fn test_is_safe_request_id_valid() {
        assert!(crate::is_safe_request_id("req_123_abc"));
        assert!(crate::is_safe_request_id("cmd-01-ABC"));
        assert!(crate::is_safe_request_id("a"));
        assert!(crate::is_safe_request_id(&"x".repeat(64)));
    }

    #[test]
    fn test_is_safe_request_id_invalid() {
        assert!(!crate::is_safe_request_id(""));
        assert!(!crate::is_safe_request_id(&"x".repeat(65)));
        assert!(!crate::is_safe_request_id("req/123"));
        assert!(!crate::is_safe_request_id("req\\123"));
        assert!(!crate::is_safe_request_id(".."));
        assert!(!crate::is_safe_request_id("req 123"));
        assert!(!crate::is_safe_request_id("req@123"));
        assert!(!crate::is_safe_request_id("req\n123"));
    }

    // ── Bound identity & payload validation tests ──

    #[test]
    fn test_is_safe_pet_id() {
        assert!(crate::is_safe_pet_id("pet_123"));
        assert!(crate::is_safe_pet_id("my-session-id"));
        assert!(crate::is_safe_pet_id(&"a".repeat(128)));

        assert!(!crate::is_safe_pet_id(""));
        assert!(!crate::is_safe_pet_id(&"a".repeat(129)));
        assert!(!crate::is_safe_pet_id("../etc/passwd"));
        assert!(!crate::is_safe_pet_id("pet/123"));
        assert!(!crate::is_safe_pet_id("pet\\123"));
        assert!(!crate::is_safe_pet_id("pet 123"));
    }

    #[test]
    fn test_create_pet_inbox_payload_valid() {
        let payload = crate::create_pet_inbox_payload(
            "pet_abc123",
            "Hello pet, please check the status",
            "req_uuid_001",
        )
        .unwrap();

        assert_eq!(payload.schema_version, "1");
        assert_eq!(payload.kind, "user_message");
        assert_eq!(payload.pet_id, "pet_abc123");
        assert_eq!(payload.text, "Hello pet, please check the status");
        assert_eq!(payload.deliver_as, "followUp");
        assert_eq!(payload.command_id, "req_uuid_001");
        assert_eq!(payload.dedup_key, "req_uuid_001");
        assert_eq!(payload.ttl_ms, 60000);

        let serialized = serde_json::to_string(&payload).unwrap();
        let value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(value["schemaVersion"], "1");
        assert_eq!(value["kind"], "user_message");
        assert_eq!(value["petId"], "pet_abc123");
        assert_eq!(value["text"], "Hello pet, please check the status");
        assert_eq!(value["deliverAs"], "followUp");
        assert_eq!(value["commandId"], "req_uuid_001");
        assert_eq!(value["dedupKey"], "req_uuid_001");
        assert_eq!(value["ttlMs"], 60000);
    }

    #[test]
    fn test_create_pet_inbox_payload_invalid_pet_id() {
        let err = crate::create_pet_inbox_payload("", "hello", "req_1").unwrap_err();
        assert!(err.contains("Unbound or invalid pet identity"));

        let err2 = crate::create_pet_inbox_payload("bad/id", "hello", "req_1").unwrap_err();
        assert!(err2.contains("Unbound or invalid pet identity"));
    }

    #[test]
    fn test_create_pet_inbox_payload_invalid_text() {
        let err_empty = crate::create_pet_inbox_payload("pet_1", "", "req_1").unwrap_err();
        assert!(err_empty.contains("Message text must be between 1 and 2000 characters"));

        let err_whitespace = crate::create_pet_inbox_payload("pet_1", "   \n\t  ", "req_1").unwrap_err();
        assert!(err_whitespace.contains("Message text must be between 1 and 2000 characters"));

        let long_text = "a".repeat(2001);
        let err_too_long =
            crate::create_pet_inbox_payload("pet_1", &long_text, "req_1").unwrap_err();
        assert!(err_too_long.contains("Message text must be between 1 and 2000 characters"));

        // Test UTF-16 code units: 1000 emojis (each is 2 UTF-16 code units = 2000) is valid
        let emoji_valid = "🐶".repeat(1000);
        assert!(crate::create_pet_inbox_payload("pet_1", &emoji_valid, "req_1").is_ok());

        // 1001 emojis = 2002 UTF-16 code units is invalid
        let emoji_invalid = "🐶".repeat(1001);
        let err_emoji = crate::create_pet_inbox_payload("pet_1", &emoji_invalid, "req_1").unwrap_err();
        assert!(err_emoji.contains("Message text must be between 1 and 2000 characters"));
    }

    #[test]
    fn test_create_pet_inbox_payload_invalid_request_id() {
        let err = crate::create_pet_inbox_payload("pet_1", "hello", "bad request id!").unwrap_err();
        assert!(err.contains("Invalid request ID"));
    }

    // ── post_pet_inbox_blocking HTTP tests ──

    #[test]
    fn test_post_pet_inbox_blocking_http_422_receipt() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = std::io::Read::read(&mut stream, &mut buf);
            let body = r#"{"status":"rejected","reason":"SessionOffline"}"#;
            let response = format!(
                "HTTP/1.1 422 Unprocessable Entity\r\n\
                 Content-Type: application/json\r\n\
                 x-clawd-server: clawd-on-desk\r\n\
                 Content-Length: {}\r\n\
                 Connection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = std::io::Write::write_all(&mut stream, response.as_bytes());
            let _ = std::io::Write::flush(&mut stream);
        });

        let payload = crate::create_pet_inbox_payload("pet_test", "hello", "req_422").unwrap();
        let receipt = crate::post_pet_inbox_blocking(port, &payload)
            .expect("HTTP 422 with trusted header should parse receipt JSON");

        assert_eq!(receipt["status"], "rejected");
        assert_eq!(receipt["reason"], "SessionOffline");

        server.join().unwrap();
    }

    #[test]
    fn test_post_pet_inbox_blocking_missing_server_header_on_error_status() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = std::io::Read::read(&mut stream, &mut buf);
            let body = r#"{"status":"rejected","reason":"SessionOffline"}"#;
            let response = format!(
                "HTTP/1.1 422 Unprocessable Entity\r\n\
                 Content-Type: application/json\r\n\
                 Content-Length: {}\r\n\
                 Connection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = std::io::Write::write_all(&mut stream, response.as_bytes());
            let _ = std::io::Write::flush(&mut stream);
        });

        let payload = crate::create_pet_inbox_payload("pet_test", "hello", "req_missing").unwrap();
        let result = crate::post_pet_inbox_blocking(port, &payload);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("missing x-clawd-server header"), "got: {}", err);

        server.join().unwrap();
    }

    #[test]
    fn test_post_pet_inbox_blocking_untrusted_server_header_on_error_status() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = std::io::Read::read(&mut stream, &mut buf);
            let body = r#"{"status":"rejected","reason":"SessionOffline"}"#;
            let response = format!(
                "HTTP/1.1 500 Internal Server Error\r\n\
                 Content-Type: application/json\r\n\
                 x-clawd-server: rogue-service\r\n\
                 Content-Length: {}\r\n\
                 Connection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = std::io::Write::write_all(&mut stream, response.as_bytes());
            let _ = std::io::Write::flush(&mut stream);
        });

        let payload = crate::create_pet_inbox_payload("pet_test", "hello", "req_untrusted").unwrap();
        let result = crate::post_pet_inbox_blocking(port, &payload);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Untrusted server response"), "got: {}", err);
        assert!(err.contains("rogue-service"), "got: {}", err);

        server.join().unwrap();
    }

    #[test]
    fn test_post_pet_inbox_blocking_transport_failure_remains_err() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener); // Closed port

        let payload = crate::create_pet_inbox_payload("pet_test", "hello", "req_closed").unwrap();
        let result = crate::post_pet_inbox_blocking(port, &payload);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("HTTP request failed"), "got: {}", err);
    }

    #[test]
    fn test_post_pet_inbox_blocking_size_capped_on_error_status() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = std::io::Read::read(&mut stream, &mut buf);
            let oversized_body = "{\"data\":\"".to_string() + &"x".repeat(70000) + "\"}";
            let response = format!(
                "HTTP/1.1 500 Internal Server Error\r\n\
                 Content-Type: application/json\r\n\
                 x-clawd-server: clawd-on-desk\r\n\
                 Content-Length: {}\r\n\
                 Connection: close\r\n\r\n{}",
                oversized_body.len(),
                oversized_body
            );
            let _ = std::io::Write::write_all(&mut stream, response.as_bytes());
            let _ = std::io::Write::flush(&mut stream);
        });

        let payload = crate::create_pet_inbox_payload("pet_test", "hello", "req_oversized").unwrap();
        let result = crate::post_pet_inbox_blocking(port, &payload);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Response body exceeded 65536 bytes limit"), "got: {}", err);

        server.join().unwrap();
    }

    // ── Helper ──

    fn make_stdin(
        hook: Option<&str>,
        tool: Option<&str>,
        tool_input: Option<serde_json::Value>,
        session_id: Option<&str>,
        cwd: Option<&str>,
    ) -> StdinInput {
        StdinInput {
            hook_event_name: hook.map(|s| s.to_string()),
            tool_name: tool.map(|s| s.to_string()),
            tool_input,
            session_id: session_id.map(|s| s.to_string()),
            cwd: cwd.map(|s| s.to_string()),
            tool_args: None,
            error: None,
            reason: None,
            notification_type: None,
            agent_name: None,
        }
    }
}
