//! Restores Windows desktop chrome and Explorer when Portal exits, crashes, or cannot load its UI.

use tauri::{AppHandle, Emitter, Manager};

const DEV_FRONTEND_URL: &str = "http://127.0.0.1:1420";

#[tauri::command]
pub fn recover_desktop_session(app: AppHandle) -> Result<(), String> {
    recover_desktop_session_inner()?;
    crate::console_mode::restore_desktop_chrome_on_exit();
    crate::automation::restore_on_app_exit();
    let _ = app.emit("session-recovery-applied", ());
    Ok(())
}

/// Graceful quit: restore desktop chrome / Explorer, then terminate the process.
#[tauri::command]
pub fn request_app_exit(app: AppHandle) -> Result<(), String> {
    recover_on_app_exit();
    // Defer so the IPC response can return before the runtime tears down.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(80));
        app.exit(0);
    });
    Ok(())
}

/// Console-style power menu actions. Restores desktop chrome first so a
/// restart/shutdown never strands the session without Explorer.
#[tauri::command]
pub fn power_action(action: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let (program, args): (&str, Vec<&str>) = match action.as_str() {
            // Note: SetSuspendState hibernates instead of sleeping when
            // hibernation is enabled — acceptable console behavior either way.
            "sleep" => ("rundll32.exe", vec!["powrprof.dll,SetSuspendState", "0,1,0"]),
            "restart" => ("shutdown", vec!["/r", "/t", "0"]),
            "shutdown" => ("shutdown", vec!["/s", "/t", "0"]),
            other => return Err(format!("Unknown power action: {other}")),
        };

        if action != "sleep" {
            recover_on_app_exit();
        }

        Command::new(program)
            .args(&args)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to run {program}: {e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = action;
        Err("Power actions are only supported on Windows".into())
    }
}

pub fn setup(app: &tauri::App) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let handle = app.handle().clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(4));
            if dev_frontend_reachable() {
                return;
            }
            eprintln!(
                "Portal Media: dev frontend not reachable at {DEV_FRONTEND_URL}; restoring desktop session."
            );
            let _ = recover_desktop_session_inner();
            let _ = handle.emit("session-recovery-dev-unreachable", ());
        });
    }
    let _ = app;
    Ok(())
}

/// Called from `RunEvent::Exit` and window close so recovery runs even when the webview never loaded.
pub fn recover_on_app_exit() {
    crate::console_mode::restore_desktop_chrome_on_exit();
    let _ = recover_desktop_session_inner();
    crate::automation::restore_on_app_exit();
}

pub fn recover_desktop_session_inner() -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = crate::winlogon_shell::ensure_explorer_companion();
        let _ = crate::winlogon_shell::restore_explorer_desktop();
        if crate::winlogon_shell::session_started_as_winlogon_shell() {
            let _ = crate::winlogon_shell::schedule_revert_on_next_launch();
        }
    }
    Ok(())
}

#[cfg(debug_assertions)]
fn dev_frontend_reachable() -> bool {
    use std::time::Duration;

    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    client.get(DEV_FRONTEND_URL).send().map(|r| r.status().is_success() || r.status().as_u16() == 404).unwrap_or(false)
}

pub fn attach_close_recovery(app: &AppHandle) {
    if let Some(window) = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
    {
        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                recover_on_app_exit();
                let _ = app_handle;
            }
        });
    }
}
