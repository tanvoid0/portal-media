//! Phase 4: optional `HKLM\...\Winlogon\Shell` replacement so Windows starts Portal at logon.
//! Requires administrator consent to write; ships recovery backup and companion `explorer.exe` for tray.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, Manager};

const WINLOGON_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon";
const SHELL_VALUE: &str = "Shell";
const DEFAULT_SHELL: &str = "explorer.exe";
const BACKUP_FILE: &str = "winlogon_shell_backup.json";
const STATE_FILE: &str = "winlogon_shell_state.json";
const REVERT_CLI_ARG: &str = "--revert-winlogon-shell";

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();
static SESSION_STARTED_AS_SHELL: Mutex<bool> = Mutex::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WinlogonShellStatus {
    pub supported: bool,
    /// Registry `Shell` points at this Portal executable.
    pub configured: bool,
    /// This process was started by Winlogon (parent is winlogon.exe).
    pub session_started_as_shell: bool,
    /// Registry was changed; sign out or restart for the new shell to take effect.
    pub pending_sign_out: bool,
    pub shell_value: Option<String>,
    pub portal_exe_path: Option<String>,
    pub is_elevated: bool,
    pub companion_explorer_running: bool,
    /// User scheduled Explorer restore on the next Portal launch.
    pub revert_on_next_launch: bool,
    /// True when startup recovery reverted the shell this session.
    pub reverted_this_session: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShellBackup {
    previous_shell: String,
    portal_exe_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedShellState {
    #[serde(default)]
    revert_on_next_launch: bool,
}

static REVERTED_THIS_SESSION: Mutex<bool> = Mutex::new(false);

#[tauri::command]
pub fn winlogon_shell_is_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn winlogon_shell_get_status() -> Result<WinlogonShellStatus, String> {
    build_status()
}

#[tauri::command]
pub fn winlogon_shell_set_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        enable_winlogon_shell()
    } else {
        disable_winlogon_shell()
    }
}

#[tauri::command]
pub fn winlogon_shell_set_revert_on_next_launch(enabled: bool) -> Result<(), String> {
    let mut state = read_shell_state().unwrap_or_default();
    state.revert_on_next_launch = enabled;
    write_shell_state(&state)
}

pub fn setup(app: &tauri::App) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir unavailable: {e}"))?;
    let _ = APP_DATA_DIR.set(dir);

    if cli_requests_revert() {
        let mut state = read_shell_state().unwrap_or_default();
        state.revert_on_next_launch = true;
        let _ = write_shell_state(&state);
    }

    let reverted = apply_startup_recovery()?;
    if reverted {
        let _ = app.emit("winlogon-shell-reverted", ());
    }

    #[cfg(windows)]
    {
        let started = started_as_winlogon_shell()?;
        if let Ok(mut slot) = SESSION_STARTED_AS_SHELL.lock() {
            *slot = started;
        }
        if started {
            let _ = ensure_explorer_companion();
        }
    }

    Ok(())
}

/// True when this session was launched as the logon shell (not a manual start).
pub fn session_started_as_winlogon_shell() -> bool {
    SESSION_STARTED_AS_SHELL
        .lock()
        .map(|g| *g)
        .unwrap_or(false)
}

fn build_status() -> Result<WinlogonShellStatus, String> {
    let shell_state = read_shell_state().unwrap_or_default();
    let reverted_this_session = REVERTED_THIS_SESSION
        .lock()
        .map(|g| *g)
        .unwrap_or(false);

    #[cfg(windows)]
    {
        let portal_exe = current_portal_exe()?;
        let shell_value = read_shell_value()?;
        let configured = shell_points_to_portal(shell_value.as_deref(), &portal_exe);
        let session_started = started_as_winlogon_shell()?;
        let pending_sign_out = configured && !session_started;
        Ok(WinlogonShellStatus {
            supported: true,
            configured,
            session_started_as_shell: session_started,
            pending_sign_out,
            shell_value,
            portal_exe_path: Some(portal_exe),
            is_elevated: is_process_elevated(),
            companion_explorer_running: is_explorer_running(),
            revert_on_next_launch: shell_state.revert_on_next_launch,
            reverted_this_session,
        })
    }
    #[cfg(not(windows))]
    {
        Ok(WinlogonShellStatus {
            supported: false,
            configured: false,
            session_started_as_shell: false,
            pending_sign_out: false,
            shell_value: None,
            portal_exe_path: None,
            is_elevated: false,
            companion_explorer_running: false,
            revert_on_next_launch: shell_state.revert_on_next_launch,
            reverted_this_session,
        })
    }
}

fn enable_winlogon_shell() -> Result<(), String> {
    #[cfg(windows)]
    {
        let portal_exe = current_portal_exe()?;
        let current = read_shell_value()?.unwrap_or_else(|| DEFAULT_SHELL.to_string());
        if shell_points_to_portal(Some(&current), &portal_exe) {
            return Ok(());
        }
        write_backup(&ShellBackup {
            previous_shell: current,
            portal_exe_path: portal_exe.clone(),
        })?;
        set_shell_registry_value(&portal_exe)?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Winlogon shell replacement is only supported on Windows.".into())
    }
}

fn disable_winlogon_shell() -> Result<(), String> {
    #[cfg(windows)]
    {
        let restore = read_backup()
            .map(|b| b.previous_shell)
            .unwrap_or_else(|_| DEFAULT_SHELL.to_string());
        set_shell_registry_value(&restore)?;
        let _ = remove_backup();
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Winlogon shell replacement is only supported on Windows.".into())
    }
}

#[cfg(windows)]
fn current_portal_exe() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| format!("Could not resolve app path: {e}"))?;
    normalize_path(&exe)
}

#[cfg(windows)]
fn read_shell_value() -> Result<Option<String>, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let winlogon = hklm
        .open_subkey_with_flags(WINLOGON_KEY, KEY_READ)
        .map_err(|e| format!("Failed to open Winlogon key (read): {e}"))?;
    match winlogon.get_value::<String, _>(SHELL_VALUE) {
        Ok(v) => Ok(Some(v.trim().to_string())),
        Err(e) => Err(format!("Failed to read Shell value: {e}")),
    }
}

#[cfg(windows)]
fn set_shell_registry_value(value: &str) -> Result<(), String> {
    if try_set_shell_registry_value(value).is_ok() {
        return Ok(());
    }
    set_shell_registry_value_elevated(value)
}

#[cfg(windows)]
fn try_set_shell_registry_value(value: &str) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let winlogon = hklm
        .open_subkey_with_flags(WINLOGON_KEY, KEY_SET_VALUE | KEY_READ)
        .map_err(|e| format!("Access denied opening Winlogon key: {e}"))?;
    winlogon
        .set_value(SHELL_VALUE, &value)
        .map_err(|e| format!("Failed to set Shell value: {e}"))?;
    Ok(())
}

#[cfg(windows)]
fn set_shell_registry_value_elevated(value: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let dir = APP_DATA_DIR
        .get()
        .ok_or_else(|| "Winlogon shell not initialized".to_string())?;
    let script_path = dir.join("set_winlogon_shell.ps1");
    let escaped = value.replace('\'', "''");
    let script = format!(
        "Set-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon' -Name 'Shell' -Value '{}'",
        escaped
    );
    std::fs::write(&script_path, script)
        .map_err(|e| format!("Failed to write elevation script: {e}"))?;

    let script_arg = format!(
        "-NoProfile -ExecutionPolicy Bypass -File \"{}\"",
        script_path.display()
    );
    let args_wide: Vec<u16> = OsStr::new(&script_arg)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let result = unsafe {
        ShellExecuteW(
            HWND::default(),
            w!("runas"),
            w!("powershell.exe"),
            windows::core::PCWSTR(args_wide.as_ptr()),
            None,
            SW_HIDE,
        )
    };
    if (result.0 as isize) <= 32 {
        return Err(
            "Administrator approval is required to change the Windows shell. Approve the UAC prompt or run Portal as administrator."
                .into(),
        );
    }
    Ok(())
}

#[cfg(windows)]
fn is_process_elevated() -> bool {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        )
        .is_ok();
        let _ = CloseHandle(token);
        if !ok {
            return false;
        }
        elevation.TokenIsElevated != 0
    }
}

#[cfg(windows)]
fn started_as_winlogon_shell() -> Result<bool, String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::GetCurrentProcessId;

    let my_pid = unsafe { GetCurrentProcessId() };
    let mut parent_pid = 0u32;

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {e}"))?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == my_pid {
                    parent_pid = entry.th32ParentProcessID;
                    break;
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = windows::Win32::Foundation::CloseHandle(snap);
    }

    if parent_pid == 0 {
        return Ok(false);
    }
    Ok(process_exe_name(parent_pid)?
        .map(|n| n.eq_ignore_ascii_case("winlogon.exe"))
        .unwrap_or(false))
}

#[cfg(windows)]
fn process_exe_name(pid: u32) -> Result<Option<String>, String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {e}"))?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == pid {
                    let name = String::from_utf16_lossy(
                        &entry.szExeFile[..entry
                            .szExeFile
                            .iter()
                            .position(|&c| c == 0)
                            .unwrap_or(entry.szExeFile.len())],
                    );
                    let _ = windows::Win32::Foundation::CloseHandle(snap);
                    return Ok(Some(name));
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = windows::Win32::Foundation::CloseHandle(snap);
    }
    Ok(None)
}

#[cfg(windows)]
fn shell_points_to_portal(shell_value: Option<&str>, portal_exe: &str) -> bool {
    let Some(shell) = shell_value else {
        return false;
    };
    paths_equal(shell, portal_exe)
}

#[cfg(windows)]
fn paths_equal(a: &str, b: &str) -> bool {
    let na = normalize_path_str(a);
    let nb = normalize_path_str(b);
    na == nb
}

#[cfg(windows)]
fn normalize_path(path: &Path) -> Result<String, String> {
    Ok(normalize_path_str(&path.to_string_lossy()))
}

#[cfg(windows)]
fn normalize_path_str(raw: &str) -> String {
    let trimmed = raw.trim().trim_matches('"');
    let path = Path::new(trimmed);
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_lowercase()
}

#[cfg(windows)]
fn is_explorer_running() -> bool {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return false;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                let name = String::from_utf16_lossy(
                    &entry.szExeFile[..entry
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.szExeFile.len())],
                );
                if name.eq_ignore_ascii_case("explorer.exe") {
                    let _ = windows::Win32::Foundation::CloseHandle(snap);
                    return true;
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = windows::Win32::Foundation::CloseHandle(snap);
        false
    }
}

/// When Portal is the logon shell, schedule Explorer restore on the next Portal launch (UAC).
pub fn schedule_revert_on_next_launch() -> Result<(), String> {
    let mut state = read_shell_state().unwrap_or_default();
    state.revert_on_next_launch = true;
    write_shell_state(&state)
}

/// Brings back the Explorer desktop (icons, taskbar host) after Portal closes or fails.
/// No-op when Explorer already runs — spawning `explorer.exe shell:desktop` against a live
/// shell just opens a stray File Explorer window instead of restoring anything.
#[cfg(windows)]
pub fn restore_explorer_desktop() -> Result<(), String> {
    ensure_explorer_companion()
}

#[cfg(not(windows))]
pub fn restore_explorer_desktop() -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn ensure_explorer_companion() -> Result<(), String> {
    if is_explorer_running() {
        return Ok(());
    }
    std::process::Command::new("explorer.exe")
        .spawn()
        .map_err(|e| format!("Failed to start explorer.exe companion: {e}"))?;
    Ok(())
}

fn backup_path() -> Option<PathBuf> {
    APP_DATA_DIR.get().map(|d| d.join(BACKUP_FILE))
}

fn write_backup(backup: &ShellBackup) -> Result<(), String> {
    let path = backup_path().ok_or_else(|| "Winlogon shell not initialized".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    let raw = serde_json::to_string(backup)
        .map_err(|e| format!("Failed to serialize shell backup: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("Failed to write shell backup: {e}"))
}

fn read_backup() -> Result<ShellBackup, String> {
    let path = backup_path().ok_or_else(|| "Winlogon shell not initialized".to_string())?;
    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read shell backup: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid shell backup: {e}"))
}

fn remove_backup() -> Result<(), String> {
    if let Some(path) = backup_path() {
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to remove shell backup: {e}"))?;
        }
    }
    Ok(())
}

fn state_file_path() -> Option<PathBuf> {
    APP_DATA_DIR.get().map(|d| d.join(STATE_FILE))
}

fn read_shell_state() -> Result<PersistedShellState, String> {
    let path = state_file_path().ok_or_else(|| "Winlogon shell not initialized".to_string())?;
    if !path.exists() {
        return Ok(PersistedShellState::default());
    }
    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read shell state: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid shell state: {e}"))
}

fn write_shell_state(state: &PersistedShellState) -> Result<(), String> {
    let path = state_file_path().ok_or_else(|| "Winlogon shell not initialized".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    let raw = serde_json::to_string(state)
        .map_err(|e| format!("Failed to serialize shell state: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("Failed to write shell state: {e}"))
}

fn cli_requests_revert() -> bool {
    std::env::args().any(|a| a == REVERT_CLI_ARG)
}

/// If scheduled (or CLI), restore Explorer as Winlogon shell before the UI loads.
fn apply_startup_recovery() -> Result<bool, String> {
    #[cfg(windows)]
    {
        let mut state = read_shell_state().unwrap_or_default();
        if !state.revert_on_next_launch {
            return Ok(false);
        }

        let portal_exe = current_portal_exe()?;
        let shell_value = read_shell_value()?;
        let configured = shell_points_to_portal(shell_value.as_deref(), &portal_exe);
        if configured {
            disable_winlogon_shell()?;
        }

        state.revert_on_next_launch = false;
        write_shell_state(&state)?;
        if let Ok(mut slot) = REVERTED_THIS_SESSION.lock() {
            *slot = true;
        }
        return Ok(configured);
    }
    #[cfg(not(windows))]
    {
        let _ = read_shell_state;
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::{PersistedShellState, ShellBackup};

    #[test]
    fn shell_state_roundtrip() {
        let state = PersistedShellState {
            revert_on_next_launch: true,
        };
        let raw = serde_json::to_string(&state).unwrap();
        let back: PersistedShellState = serde_json::from_str(&raw).unwrap();
        assert!(back.revert_on_next_launch);
    }

    #[test]
    fn shell_backup_roundtrip() {
        let backup = ShellBackup {
            previous_shell: "explorer.exe".into(),
            portal_exe_path: r"C:\Portal\portal-media.exe".into(),
        };
        let raw = serde_json::to_string(&backup).unwrap();
        let back: ShellBackup = serde_json::from_str(&raw).unwrap();
        assert_eq!(back.previous_shell, "explorer.exe");
    }
}
