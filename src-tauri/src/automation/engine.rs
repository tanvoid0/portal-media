use super::display;
use super::types::{AutomationAction, AutomationConfig, AutomationProfile};
use std::path::PathBuf;
use tauri::Manager;
use std::process::Command;
use std::sync::{Mutex, OnceLock};

const CONFIG_FILE: &str = "automation_config.json";

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();
static LAUNCHED_CHILDREN: OnceLock<Mutex<Vec<u32>>> = OnceLock::new();

pub fn setup(app: &tauri::App) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir unavailable: {e}"))?;
    let _ = APP_DATA_DIR.set(dir);
    restore_pending_snapshots()?;
    Ok(())
}

pub fn restore_on_app_exit() {
    let _ = restore_pending_snapshots();
}

fn config_path() -> Option<PathBuf> {
    APP_DATA_DIR.get().map(|d| d.join(CONFIG_FILE))
}

pub fn load_config() -> Result<AutomationConfig, String> {
    let path = config_path().ok_or_else(|| "Automation not initialized".to_string())?;
    if !path.exists() {
        return Ok(AutomationConfig::default());
    }
    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read automation config: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid automation config: {e}"))
}

pub fn save_config(config: &AutomationConfig) -> Result<(), String> {
    let path = config_path().ok_or_else(|| "Automation not initialized".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize automation config: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("Failed to write automation config: {e}"))?;
    Ok(())
}

pub fn resolve_profile<'a>(config: &'a AutomationConfig, game_id: &str) -> Option<&'a AutomationProfile> {
    if !config.enabled {
        return None;
    }
    let profile_id = config
        .game_assignments
        .get(game_id)
        .cloned()
        .or_else(|| config.default_profile_id.clone())?;
    config.profiles.iter().find(|p| p.id == profile_id)
}

pub fn apply_launch(game_id: &str) -> Result<(), String> {
    let config = load_config()?;
    let Some(profile) = resolve_profile(&config, game_id) else {
        return Ok(());
    };
    apply_actions(&profile.on_launch, true)
}

pub fn apply_exit(game_id: &str) -> Result<(), String> {
    let config = load_config()?;
    let Some(profile) = resolve_profile(&config, game_id) else {
        return restore_pending_snapshots();
    };
    apply_actions(&profile.on_exit, false)?;
    restore_pending_snapshots()
}

fn apply_actions(actions: &[AutomationAction], is_launch: bool) -> Result<(), String> {
    for action in actions {
        match action {
            AutomationAction::DisableDisplays { indexes } => {
                display::disable_displays(indexes)?;
            }
            AutomationAction::RestoreDisplays => {
                if !is_launch {
                    display::restore_displays()?;
                }
            }
            AutomationAction::SetDefaultAudioDevice { device_id } => {
                super::audio::set_default_audio_device(device_id)?;
            }
            AutomationAction::RestoreAudioDevice => {
                if !is_launch {
                    super::audio::restore_audio_device()?;
                }
            }
            AutomationAction::LaunchProcess { path, args } => {
                spawn_companion(path, args)?;
            }
        }
    }
    Ok(())
}

fn spawn_companion(path: &str, args: &[String]) -> Result<(), String> {
    let child = Command::new(path)
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to launch {path}: {e}"))?;
    let pid = child.id();
    let slot = LAUNCHED_CHILDREN.get_or_init(|| Mutex::new(Vec::new()));
    if let Ok(mut guard) = slot.lock() {
        guard.push(pid);
    }
    Ok(())
}

fn restore_pending_snapshots() -> Result<(), String> {
    let _ = display::restore_displays();
    let _ = super::audio::restore_audio_device();
    kill_launched_children();
    Ok(())
}

fn kill_launched_children() {
    let Some(slot) = LAUNCHED_CHILDREN.get() else {
        return;
    };
    let Ok(mut guard) = slot.lock() else {
        return;
    };
    for pid in guard.drain(..) {
        #[cfg(windows)]
        {
            use windows::Win32::Foundation::CloseHandle;
            use windows::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};
            unsafe {
                if let Ok(handle) = OpenProcess(PROCESS_TERMINATE, false, pid) {
                    let _ = TerminateProcess(handle, 1);
                    let _ = CloseHandle(handle);
                }
            }
        }
        #[cfg(not(windows))]
        {
            let _ = pid;
        }
    }
}
