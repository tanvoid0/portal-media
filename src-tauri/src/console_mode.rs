//! Phase 1 shell integration: hide Windows taskbar while Portal is active, optional login startup.
//! Explorer remains the OS shell; this module only adjusts desktop chrome.

use serde::{Deserialize, Serialize};

const RUN_VALUE_NAME: &str = "PortalMedia";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleModeStatus {
    pub supported: bool,
    pub launch_at_login: bool,
    pub taskbar_hidden: bool,
}

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
    })
}

#[tauri::command]
pub fn console_mode_set_launch_at_login(enabled: bool) -> Result<(), String> {
    set_launch_at_login(enabled)
}

/// Hide primary (and secondary) taskbars while Console mode is active.
#[tauri::command]
pub fn console_mode_apply_desktop() -> Result<(), String> {
    set_taskbar_visible(false)
}

/// Restore taskbars (call on exit or when Console mode is disabled).
#[tauri::command]
pub fn console_mode_restore_desktop() -> Result<(), String> {
    set_taskbar_visible(true)
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
fn set_taskbar_visible(visible: bool) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, ShowWindow, SW_HIDE, SW_SHOW};

    const TRAY_CLASSES: [&windows::core::PCWSTR; 3] = [
        w!("Shell_TrayWnd"),
        w!("Shell_SecondaryTrayWnd"),
        w!("NotifyIconOverflowWindow"),
    ];

    let show_cmd = if visible { SW_SHOW } else { SW_HIDE };

    unsafe {
        for class in TRAY_CLASSES {
            let hwnd = FindWindowW(class, None).unwrap_or(HWND::default());
            if hwnd.0 != 0 {
                let _ = ShowWindow(hwnd, show_cmd);
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
fn is_taskbar_hidden() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, IsWindowVisible};

    unsafe {
        let hwnd = FindWindowW(w!("Shell_TrayWnd"), None).unwrap_or(HWND::default());
        if hwnd.0 == 0 {
            return false;
        }
        !IsWindowVisible(hwnd).as_bool()
    }
}

#[cfg(not(windows))]
fn set_taskbar_visible(_visible: bool) -> Result<(), String> {
    Err("Desktop chrome control is only supported on Windows.".into())
}

#[cfg(not(windows))]
fn is_taskbar_hidden() -> bool {
    false
}

/// Called from Tauri `RunEvent::Exit` so taskbar is restored even on force-quit paths that skip JS.
pub fn restore_desktop_chrome() {
    let _ = set_taskbar_visible(true);
}
