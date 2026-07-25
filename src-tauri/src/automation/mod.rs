//! Phase 3: launch/exit automation profiles (display, audio, companion tools).

mod audio;
mod display;
mod engine;
mod types;

use types::{AudioDeviceInfo, AutomationConfig, DisplayInfo};
use std::collections::HashMap;
use std::sync::LazyLock;

static PID_TO_GAME: LazyLock<std::sync::Mutex<HashMap<u32, String>>> =
    LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

#[tauri::command]
pub fn automation_is_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn automation_list_displays() -> Result<Vec<DisplayInfo>, String> {
    display::list_displays()
}

#[tauri::command]
pub fn automation_list_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    audio::list_audio_devices()
}

#[tauri::command]
pub fn automation_get_config() -> Result<AutomationConfig, String> {
    engine::load_config()
}

#[tauri::command]
pub fn automation_save_config(config: AutomationConfig) -> Result<(), String> {
    engine::save_config(&config)
}

#[tauri::command]
pub fn automation_apply_launch(game_id: String) -> Result<(), String> {
    engine::apply_launch(&game_id)
}

#[tauri::command]
pub fn automation_register_game_pid(pid: u32, game_id: String) -> Result<(), String> {
    if pid == 0 {
        return Ok(());
    }
    if let Ok(mut map) = PID_TO_GAME.lock() {
        map.insert(pid, game_id);
    }
    Ok(())
}

#[tauri::command]
pub fn automation_apply_exit(game_id: Option<String>) -> Result<(), String> {
    if let Some(id) = game_id {
        engine::apply_exit(&id)
    } else {
        engine::restore_on_app_exit();
        Ok(())
    }
}

pub fn setup(app: &tauri::App) -> Result<(), String> {
    engine::setup(app)
}

pub fn restore_on_app_exit() {
    engine::restore_on_app_exit();
}

/// Called from focus watchdog when a tracked game process exits.
pub fn on_tracked_game_exited(pid: u32) {
    let game_id = PID_TO_GAME
        .lock()
        .ok()
        .and_then(|mut map| map.remove(&pid));
    if let Some(id) = game_id {
        let _ = engine::apply_exit(&id);
    } else {
        engine::restore_on_app_exit();
    }
}
