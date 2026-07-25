//! Phase 1 shell integration: hide Windows taskbar while Portal is active, optional login startup.
//! Explorer remains the OS shell; this module only adjusts desktop chrome.

use serde::{Deserialize, Serialize};
use tauri::Manager;
#[cfg(windows)]
use tauri::Emitter;
use std::path::PathBuf;
#[cfg(windows)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

const RUN_VALUE_NAME: &str = "PortalMedia";
const STATE_FILE: &str = "console_mode_state.json";

/// Win32 `RegisterHotKey` ids (Portal Media shell integration).
#[cfg(windows)]
const ESCAPE_HOTKEY_ID: i32 = 0x504D;
#[cfg(windows)]
const SWITCHER_HOTKEY_ID: i32 = 0x504E;
#[cfg(windows)]
const GUIDE_HOTKEY_ID: i32 = 0x504F;

#[cfg(windows)]
static GLOBAL_SHELL_HOTKEYS: Mutex<bool> = Mutex::new(true);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleModeStatus {
    pub supported: bool,
    pub launch_at_login: bool,
    pub taskbar_hidden: bool,
    /// True when a previous session may have left desktop chrome active (crash recovery).
    pub stale_desktop_chrome: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedState {
    desktop_chrome_active: bool,
}

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();
static DESKTOP_CHROME_ACTIVE: Mutex<bool> = Mutex::new(false);

#[tauri::command]
pub fn console_mode_is_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn console_mode_get_status() -> Result<ConsoleModeStatus, String> {
    Ok(ConsoleModeStatus {
        supported: cfg!(windows),
        launch_at_login: read_launch_at_login()?,
        taskbar_hidden: is_taskbar_hidden(),
        stale_desktop_chrome: read_persisted_state()
            .map(|s| s.desktop_chrome_active)
            .unwrap_or(false),
    })
}

#[tauri::command]
pub fn console_mode_set_launch_at_login(enabled: bool) -> Result<(), String> {
    set_launch_at_login(enabled)
}

/// Apply desktop chrome (taskbar autohide/hide + escape hotkey). Idempotent.
#[tauri::command]
pub fn enable_console_mode() -> Result<(), String> {
    apply_desktop_chrome()
}

/// Restore desktop chrome and unregister escape hotkey. Idempotent.
#[tauri::command]
pub fn disable_console_mode() -> Result<(), String> {
    restore_desktop_chrome()
}

#[tauri::command]
pub fn console_mode_apply_desktop() -> Result<(), String> {
    apply_desktop_chrome()
}

#[tauri::command]
pub fn console_mode_restore_desktop() -> Result<(), String> {
    restore_desktop_chrome()
}

/// Phase 2: system-wide hotkeys for app switcher and quick access (work while a game has focus).
#[tauri::command]
pub fn shell_hotkeys_set_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut slot = GLOBAL_SHELL_HOTKEYS
            .lock()
            .map_err(|e| format!("Shell hotkey lock poisoned: {e}"))?;
        *slot = enabled;
        request_hotkey_sync();
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(())
    }
}

/// Tauri setup: recover stale chrome from a crashed session and start the escape hotkey listener.
pub fn setup(app: &tauri::App) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir unavailable: {e}"))?;
    let _ = APP_DATA_DIR.set(dir);

    if read_persisted_state()
        .map(|s| s.desktop_chrome_active)
        .unwrap_or(false)
    {
        let _ = restore_desktop_chrome_inner();
    }

    #[cfg(windows)]
    {
        init_escape_hotkey_listener(app.handle().clone());
        request_hotkey_sync();
    }

    Ok(())
}

fn apply_desktop_chrome() -> Result<(), String> {
    let mut active = DESKTOP_CHROME_ACTIVE
        .lock()
        .map_err(|e| format!("Console mode lock poisoned: {e}"))?;
    if *active {
        return Ok(());
    }
    set_taskbar_chrome_active(true)?;
    #[cfg(windows)]
    register_escape_hotkey()?;
    write_persisted_state(true)?;
    *active = true;
    Ok(())
}

fn restore_desktop_chrome() -> Result<(), String> {
    restore_desktop_chrome_inner()
}

fn restore_desktop_chrome_inner() -> Result<(), String> {
    let mut active = DESKTOP_CHROME_ACTIVE
        .lock()
        .map_err(|e| format!("Console mode lock poisoned: {e}"))?;
    *active = false;
    #[cfg(windows)]
    unregister_escape_hotkey();
    set_taskbar_chrome_active(false)?;
    write_persisted_state(false)?;
    Ok(())
}

/// Called from Tauri `RunEvent::Exit` so taskbar is restored even when JS teardown is skipped.
pub fn restore_desktop_chrome_on_exit() {
    let _ = restore_desktop_chrome_inner();
}

fn state_file_path() -> Option<PathBuf> {
    APP_DATA_DIR.get().map(|d| d.join(STATE_FILE))
}

fn read_persisted_state() -> Result<PersistedState, String> {
    let path = state_file_path().ok_or_else(|| "Console mode not initialized".to_string())?;
    if !path.exists() {
        return Ok(PersistedState {
            desktop_chrome_active: false,
        });
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read console mode state: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid console mode state: {e}"))
}

fn write_persisted_state(active: bool) -> Result<(), String> {
    let path = state_file_path().ok_or_else(|| "Console mode not initialized".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    let state = PersistedState {
        desktop_chrome_active: active,
    };
    let raw = serde_json::to_string(&state)
        .map_err(|e| format!("Failed to serialize console mode state: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("Failed to write console mode state: {e}"))
}

#[cfg(windows)]
fn set_taskbar_chrome_active(active: bool) -> Result<(), String> {
    if active {
        save_app_bar_state()?;
        set_app_bar_autohide(true)?;
        set_taskbar_windows_visible(false)?;
    } else {
        set_app_bar_autohide(false)?;
        set_taskbar_windows_visible(true)?;
        restore_app_bar_state()?;
    }
    Ok(())
}

#[cfg(not(windows))]
fn set_taskbar_chrome_active(active: bool) -> Result<(), String> {
    let _ = active;
    Err("Desktop chrome control is only supported on Windows.".into())
}

#[cfg(windows)]
struct SavedAppBarState {
    state: u32,
}

#[cfg(windows)]
static SAVED_APP_BAR: Mutex<Option<SavedAppBarState>> = Mutex::new(None);

#[cfg(windows)]
fn save_app_bar_state() -> Result<(), String> {
    let state = query_app_bar_state()?;
    let mut slot = SAVED_APP_BAR
        .lock()
        .map_err(|e| format!("App bar lock poisoned: {e}"))?;
    if slot.is_none() {
        *slot = Some(SavedAppBarState { state });
    }
    Ok(())
}

#[cfg(windows)]
fn restore_app_bar_state() -> Result<(), String> {
    let saved = {
        let mut slot = SAVED_APP_BAR
            .lock()
            .map_err(|e| format!("App bar lock poisoned: {e}"))?;
        slot.take()
    };
    if let Some(saved) = saved {
        set_app_bar_state(saved.state)?;
    }
    Ok(())
}

#[cfg(windows)]
fn query_app_bar_state() -> Result<u32, String> {
    use windows::Win32::UI::Shell::{ABM_GETSTATE, APPBARDATA, SHAppBarMessage};

    let mut abd = APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        ..Default::default()
    };
    // ABM_GETSTATE returns flag bits (0 = neither autohide nor always-on-top), not a BOOL.
    let state = unsafe { SHAppBarMessage(ABM_GETSTATE, &mut abd) };
    Ok(state as u32)
}

#[cfg(windows)]
fn set_app_bar_autohide(enabled: bool) -> Result<(), String> {
    use windows::Win32::UI::Shell::{ABS_ALWAYSONTOP, ABS_AUTOHIDE};

    if enabled {
        set_app_bar_state(ABS_AUTOHIDE | ABS_ALWAYSONTOP)
    } else {
        set_app_bar_state(0)
    }
}

#[cfg(windows)]
fn set_app_bar_state(flags: u32) -> Result<(), String> {
    use windows::Win32::Foundation::LPARAM;
    use windows::Win32::UI::Shell::{ABM_SETSTATE, APPBARDATA, SHAppBarMessage};

    let mut abd = APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        lParam: LPARAM(flags as isize),
        ..Default::default()
    };
    let ok = unsafe { SHAppBarMessage(ABM_SETSTATE, &mut abd) };
    if ok == 0 {
        return Err("SHAppBarMessage(ABM_SETSTATE) failed".into());
    }
    Ok(())
}

#[cfg(windows)]
fn set_taskbar_windows_visible(visible: bool) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, ShowWindow, SW_HIDE, SW_SHOW};

    let show_cmd = if visible { SW_SHOW } else { SW_HIDE };

    unsafe {
        for class in [
            w!("Shell_TrayWnd"),
            w!("Shell_SecondaryTrayWnd"),
            w!("NotifyIconOverflowWindow"),
        ] {
            let hwnd = FindWindowW(class, None).unwrap_or(HWND::default());
            if !hwnd.0.is_null() {
                let _ = ShowWindow(hwnd, show_cmd);
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
static HOTKEY_APP: OnceLock<tauri::AppHandle> = OnceLock::new();
#[cfg(windows)]
static HOTKEY_HWND: OnceLock<isize> = OnceLock::new();
#[cfg(windows)]
static HOTKEY_REGISTERED: Mutex<bool> = Mutex::new(false);
#[cfg(windows)]
static SHELL_HOTKEYS_REGISTERED: Mutex<bool> = Mutex::new(false);
#[cfg(windows)]
static PENDING_HOTKEY_SYNC: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
const WM_PORTAL_SYNC_HOTKEYS: u32 = windows::Win32::UI::WindowsAndMessaging::WM_USER + 1;

#[cfg(windows)]
fn init_escape_hotkey_listener(app: tauri::AppHandle) {
    let _ = HOTKEY_APP.set(app);
    std::thread::spawn(|| {
        if let Err(e) = escape_hotkey_message_loop() {
            eprintln!("Console mode escape hotkey listener failed: {e}");
        }
    });
}

#[cfg(windows)]
fn escape_hotkey_message_loop() -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, UnregisterClassW, CS_HREDRAW, CS_VREDRAW, HWND_MESSAGE, MSG,
        WM_HOTKEY, WNDCLASSW, WS_EX_NOACTIVATE, WS_POPUP,
    };

    const CLASS_NAME: &str = "PortalMediaConsoleModeHotkey";

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_PORTAL_SYNC_HOTKEYS {
            let _ = sync_hotkeys_on_listener_thread(hwnd);
            return LRESULT(0);
        }
        if msg == WM_HOTKEY {
            if let Some(app) = HOTKEY_APP.get() {
                match wparam.0 as i32 {
                    id if id == ESCAPE_HOTKEY_ID => {
                        let _ = restore_desktop_chrome_inner();
                        let _ = app.emit("console-mode-escape", ());
                        return LRESULT(0);
                    }
                    id if id == SWITCHER_HOTKEY_ID => {
                        let _ = app.emit("shell-hotkey-switcher", ());
                        return LRESULT(0);
                    }
                    id if id == GUIDE_HOTKEY_ID => {
                        let _ = app.emit("shell-hotkey-guide", ());
                        return LRESULT(0);
                    }
                    _ => {}
                }
            }
        }
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    unsafe {
        let class_name: Vec<u16> = OsStr::new(CLASS_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let hinstance = GetModuleHandleW(None)
            .map_err(|e| format!("GetModuleHandleW failed: {e}"))?;

        let wc = WNDCLASSW {
            lpfnWndProc: Some(wnd_proc),
            hInstance: hinstance.into(),
            lpszClassName: windows::core::PCWSTR(class_name.as_ptr()),
            style: CS_HREDRAW | CS_VREDRAW,
            ..Default::default()
        };
        if RegisterClassW(&wc) == 0 {
            return Err("RegisterClassW failed for escape hotkey window".into());
        }

        let hwnd = CreateWindowExW(
            WS_EX_NOACTIVATE,
            windows::core::PCWSTR(class_name.as_ptr()),
            w!("PortalMediaConsoleMode"),
            WS_POPUP,
            0,
            0,
            0,
            0,
            HWND_MESSAGE,
            None,
            hinstance,
            None,
        )
        .map_err(|e| format!("CreateWindowExW failed: {e}"))?;

        let _ = HOTKEY_HWND.set(hwnd.0 as isize);
        let _ = PENDING_HOTKEY_SYNC.swap(false, Ordering::SeqCst);
        sync_hotkeys_on_listener_thread(hwnd)?;

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).into() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        let _ = UnregisterClassW(windows::core::PCWSTR(class_name.as_ptr()), hinstance);
    }
    Ok(())
}

#[cfg(windows)]
fn request_hotkey_sync() {
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::PostMessageW;

    if let Some(hwnd_raw) = HOTKEY_HWND.get().copied() {
        if hwnd_raw != 0 {
            let hwnd = HWND(hwnd_raw as *mut _);
            unsafe {
                let _ = PostMessageW(hwnd, WM_PORTAL_SYNC_HOTKEYS, WPARAM(0), LPARAM(0));
            }
            return;
        }
    }
    PENDING_HOTKEY_SYNC.store(true, Ordering::SeqCst);
}

/// Must run on the thread that owns the message-only hotkey window (`RegisterHotKey` requirement).
#[cfg(windows)]
fn sync_hotkeys_on_listener_thread(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_CONTROL, MOD_SHIFT, VK_H, VK_Q, VK_TAB,
    };

    let chrome_active = DESKTOP_CHROME_ACTIVE
        .lock()
        .map(|g| *g)
        .unwrap_or(false);
    let shell_enabled = GLOBAL_SHELL_HOTKEYS
        .lock()
        .map(|g| *g)
        .unwrap_or(false);

    unsafe {
        let _ = UnregisterHotKey(hwnd, ESCAPE_HOTKEY_ID);
        let _ = UnregisterHotKey(hwnd, SWITCHER_HOTKEY_ID);
        let _ = UnregisterHotKey(hwnd, GUIDE_HOTKEY_ID);
    }
    if let Ok(mut escape) = HOTKEY_REGISTERED.lock() {
        *escape = false;
    }
    if let Ok(mut shell) = SHELL_HOTKEYS_REGISTERED.lock() {
        *shell = false;
    }

    if chrome_active {
        unsafe {
            RegisterHotKey(
                hwnd,
                ESCAPE_HOTKEY_ID,
                MOD_CONTROL | MOD_SHIFT,
                VK_Q.0 as u32,
            )
            .map_err(|e| format!("RegisterHotKey failed: {e}"))?;
        }
        if let Ok(mut escape) = HOTKEY_REGISTERED.lock() {
            *escape = true;
        }
    }

    if shell_enabled {
        unsafe {
            RegisterHotKey(
                hwnd,
                SWITCHER_HOTKEY_ID,
                MOD_CONTROL | MOD_SHIFT,
                VK_TAB.0 as u32,
            )
            .map_err(|e| format!("RegisterHotKey(switcher) failed: {e}"))?;
            RegisterHotKey(
                hwnd,
                GUIDE_HOTKEY_ID,
                MOD_CONTROL | MOD_SHIFT,
                VK_H.0 as u32,
            )
            .map_err(|e| format!("RegisterHotKey(guide) failed: {e}"))?;
        }
        if let Ok(mut shell) = SHELL_HOTKEYS_REGISTERED.lock() {
            *shell = true;
        }
    }

    Ok(())
}

#[cfg(windows)]
fn register_escape_hotkey() -> Result<(), String> {
    request_hotkey_sync();
    Ok(())
}

#[cfg(windows)]
fn unregister_escape_hotkey() {
    request_hotkey_sync();
}

#[cfg(windows)]
fn read_launch_at_login() -> Result<bool, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run = hkcu
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_READ,
        )
        .map_err(|e| format!("Failed to open Run key: {e}"))?;
    Ok(run.get_value::<String, _>(RUN_VALUE_NAME).is_ok())
}

#[cfg(not(windows))]
fn read_launch_at_login() -> Result<bool, String> {
    Ok(false)
}

#[cfg(windows)]
fn set_launch_at_login(enabled: bool) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run = hkcu
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_SET_VALUE | KEY_READ,
        )
        .map_err(|e| format!("Failed to open Run key: {e}"))?;

    if enabled {
        let exe = std::env::current_exe().map_err(|e| format!("Could not resolve app path: {e}"))?;
        let path = exe.to_string_lossy().into_owned();
        run.set_value(RUN_VALUE_NAME, &path)
            .map_err(|e| format!("Failed to set startup entry: {e}"))?;
    } else {
        let _ = run.delete_value(RUN_VALUE_NAME);
    }
    Ok(())
}

#[cfg(not(windows))]
fn set_launch_at_login(_enabled: bool) -> Result<(), String> {
    Err("Launch at login is only supported on Windows.".into())
}

#[cfg(windows)]
fn is_taskbar_hidden() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, IsWindowVisible};

    unsafe {
        let hwnd = FindWindowW(w!("Shell_TrayWnd"), None).unwrap_or(HWND::default());
        if hwnd.0.is_null() {
            return false;
        }
        !IsWindowVisible(hwnd).as_bool()
    }
}

#[cfg(not(windows))]
fn is_taskbar_hidden() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::PersistedState;

    #[test]
    fn persisted_state_roundtrip() {
        let state = PersistedState {
            desktop_chrome_active: true,
        };
        let raw = serde_json::to_string(&state).unwrap();
        let back: PersistedState = serde_json::from_str(&raw).unwrap();
        assert!(back.desktop_chrome_active);
    }
}
