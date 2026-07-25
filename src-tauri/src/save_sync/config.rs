use super::types::SaveSyncConfig;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

const CONFIG_FILE: &str = "save_sync_config.json";
const BASELINE_FILE: &str = "save_sync_baseline.json";
const STATE_FILE: &str = "save_sync_state.json";

#[derive(Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStateFile {
    #[serde(default)]
    pub last_sync_utc: Option<i64>,
    #[serde(default)]
    pub last_error: Option<String>,
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(CONFIG_FILE))
}

fn baseline_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(BASELINE_FILE))
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(STATE_FILE))
}

pub fn load_config(app: &AppHandle) -> Result<SaveSyncConfig, String> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(SaveSyncConfig::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid save sync config: {e}"))
}

pub fn save_config(app: &AppHandle, config: &SaveSyncConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let raw = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

pub fn effective_client_id(config: &SaveSyncConfig) -> Option<String> {
    let from_cfg = config.google_client_id.trim();
    if !from_cfg.is_empty() {
        return Some(from_cfg.to_string());
    }
    std::env::var("PORTAL_GOOGLE_OAUTH_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn load_baseline(app: &AppHandle) -> Result<super::types::CloudManifest, String> {
    let path = baseline_path(app)?;
    if !path.is_file() {
        return Ok(super::types::CloudManifest {
            version: 1,
            updated_utc: 0,
            entries: vec![],
        });
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid baseline manifest: {e}"))
}

pub fn save_baseline(app: &AppHandle, manifest: &super::types::CloudManifest) -> Result<(), String> {
    let path = baseline_path(app)?;
    let raw = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

pub fn load_sync_state(app: &AppHandle) -> Result<SyncStateFile, String> {
    let path = state_path(app)?;
    if !path.is_file() {
        return Ok(SyncStateFile::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn save_sync_state(
    app: &AppHandle,
    last_sync_utc: Option<i64>,
    last_error: Option<String>,
) -> Result<(), String> {
    let path = state_path(app)?;
    let state = SyncStateFile {
        last_sync_utc,
        last_error,
    };
    let raw = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}
