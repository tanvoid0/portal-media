//! Phase 2: foreground observation and tracked external-game lifecycle (process exit).

use serde::Serialize;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

static APP: OnceLock<AppHandle> = OnceLock::new();
static ENABLED: AtomicBool = AtomicBool::new(false);
static TRACKED_PIDS: LazyLock<Mutex<HashSet<u32>>> = LazyLock::new(|| Mutex::new(HashSet::new()));
#[cfg(windows)]
static HOOK: Mutex<Option<isize>> = Mutex::new(None);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundChangedPayload {
    pub pid: u32,
    pub hwnd: isize,
}

#[tauri::command]
pub fn focus_watchdog_is_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn focus_watchdog_set_enabled(enabled: bool) -> Result<(), String> {
    ENABLED.store(enabled, Ordering::SeqCst);
    #[cfg(windows)]
    {
        if enabled {
            install_foreground_hook()?;
        } else {
            uninstall_foreground_hook();
        }
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        if enabled {
            return Err("Focus watchdog is only supported on Windows.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn focus_watchdog_sync_tracked_pids(pids: Vec<u32>) -> Result<(), String> {
    let mut set = TRACKED_PIDS
        .lock()
        .map_err(|e| format!("Focus watchdog lock poisoned: {e}"))?;
    set.clear();
    for pid in pids {
        if pid > 0 {
            set.insert(pid);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn is_process_running(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    process_alive(pid)
}

/// Raise the main Portal window (used after an external game exits).
#[tauri::command]
pub fn focus_portal_main_window(app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        focus_portal_hwnd(&app)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("focus_portal_main_window is only supported on Windows".into())
    }
}

pub fn setup(app: &tauri::App) -> Result<(), String> {
    let _ = APP.set(app.handle().clone());
    #[cfg(windows)]
    start_poll_thread();
    Ok(())
}

#[cfg(windows)]
fn start_poll_thread() {
    std::thread::spawn(|| loop {
        std::thread::sleep(Duration::from_millis(1500));
        if !ENABLED.load(Ordering::SeqCst) {
            continue;
        }
        let Some(app) = APP.get() else { continue };
        let exited: Vec<u32> = {
            let mut guard = match TRACKED_PIDS.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };
            let mut done = Vec::new();
            guard.retain(|pid| {
                if process_alive(*pid) {
                    true
                } else {
                    done.push(*pid);
                    false
                }
            });
            done
        };
        for pid in exited {
            crate::automation::on_tracked_game_exited(pid);
            let _ = app.emit("focus-watchdog-tracked-exited", pid);
        }
    });
}

#[cfg(not(windows))]
fn start_poll_thread() {}

fn process_alive(pid: u32) -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

        unsafe {
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return false;
            };
            if handle.is_invalid() {
                return false;
            }
            let _ = CloseHandle(handle);
            true
        }
    }
    #[cfg(not(windows))]
    {
        let _ = pid;
        false
    }
}

#[cfg(windows)]
fn install_foreground_hook() -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowThreadProcessId, EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT,
        WINEVENT_SKIPOWNPROCESS,
    };

    const INVALID_HOOK: HWINEVENTHOOK = HWINEVENTHOOK(std::ptr::null_mut());

    let mut slot = HOOK
        .lock()
        .map_err(|e| format!("Hook lock poisoned: {e}"))?;
    if slot.is_some() {
        return Ok(());
    }

    unsafe extern "system" fn win_event_proc(
        _hook: HWINEVENTHOOK,
        event: u32,
        hwnd: HWND,
        _id_object: i32,
        _id_child: i32,
        _id_event_thread: u32,
        _dwms_event_time: u32,
    ) {
        if event != EVENT_SYSTEM_FOREGROUND {
            return;
        }
        let mut pid = 0u32;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if let Some(app) = APP.get() {
            let payload = ForegroundChangedPayload {
                pid,
                hwnd: hwnd.0 as isize,
            };
            let _ = app.emit("focus-watchdog-foreground", payload);
        }
    }

    let hook = unsafe {
        SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        )
    };
    if hook == INVALID_HOOK {
        return Err("SetWinEventHook failed".into());
    }
    *slot = Some(hook.0 as isize);
    Ok(())
}

#[cfg(windows)]
fn uninstall_foreground_hook() {
    use windows::Win32::UI::Accessibility::{UnhookWinEvent, HWINEVENTHOOK};

    let hook = {
        let mut slot = match HOOK.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        slot.take()
    };
    if let Some(raw) = hook {
        unsafe {
            let _ = UnhookWinEvent(HWINEVENTHOOK(raw as *mut _));
        }
    }
}

#[cfg(not(windows))]
fn install_foreground_hook() -> Result<(), String> {
    Err("Focus watchdog is only supported on Windows.".into())
}

#[cfg(not(windows))]
fn uninstall_foreground_hook() {}

#[cfg(windows)]
fn focus_portal_hwnd(app: &AppHandle) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        AllowSetForegroundWindow, SetForegroundWindow, ShowWindow, ASFW_ANY, SW_RESTORE,
    };

    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
        .ok_or_else(|| "Main Portal window not found".to_string())?;

    let hwnd_raw = window
        .hwnd()
        .map_err(|e| format!("Could not resolve Portal HWND: {e}"))?;
    let hwnd = HWND(hwnd_raw.0 as *mut _);

    unsafe {
        let _ = AllowSetForegroundWindow(ASFW_ANY);
        let _ = ShowWindow(hwnd, SW_RESTORE);
        if SetForegroundWindow(hwnd).as_bool() {
            return Ok(());
        }
    }

    window
        .set_focus()
        .map_err(|e| format!("SetFocus failed: {e}"))?;
    Ok(())
}
