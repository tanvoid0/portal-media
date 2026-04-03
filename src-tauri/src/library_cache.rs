//! On-disk library snapshot + cached Windows shortcut/executable icons.
//! Icons are written under `app_data/library_cache/icons/` and referenced by absolute path in `Game.icon`.
//! `library_snapshot.json` stores the last successful sync result (merged scan + manual rows).

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::commands::Game;

const SNAPSHOT_FILE: &str = "library_snapshot.json";

/// Bump when icon extraction or cache layout changes so new PNGs are generated.
#[cfg(target_os = "windows")]
const ICON_CACHE_FINGERPRINT: u32 = 2;

pub fn library_cache_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let p = root.join("library_cache");
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}

fn snapshot_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_cache_root(app)?.join(SNAPSHOT_FILE))
}

pub fn persist_snapshot(app: &AppHandle, games: &[Game]) -> Result<(), String> {
    let path = snapshot_path(app)?;
    let data = serde_json::to_vec_pretty(games).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn load_snapshot(app: &AppHandle) -> Result<Option<Vec<Game>>, String> {
    let path = snapshot_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let games: Vec<Game> = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    Ok(Some(games))
}

#[cfg(target_os = "windows")]
fn icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let p = library_cache_root(app)?.join("icons");
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}

#[cfg(target_os = "windows")]
fn cache_key_for_shell_path(abs_executable: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    abs_executable.to_lowercase().hash(&mut h);
    ICON_CACHE_FINGERPRINT.hash(&mut h);
    h.finish()
}

/// Returns absolute `.png` path for webview `convertFileSrc`, or `None` if extraction fails.
#[cfg(target_os = "windows")]
pub fn ensure_cached_icon_png(app: &AppHandle, shell_source: &Path) -> Option<String> {
    let abs = std::fs::canonicalize(shell_source).unwrap_or_else(|_| shell_source.to_path_buf());
    if !abs.is_file() {
        return None;
    }
    let key_src = abs.to_string_lossy().to_string();
    let dest = icons_dir(app)
        .ok()?
        .join(format!("{:016x}.png", cache_key_for_shell_path(&key_src)));

    if dest.is_file() {
        let ok = std::fs::metadata(&dest)
            .ok()
            .map(|m| m.len() > 32)
            .unwrap_or(false);
        if ok {
            return Some(dest.to_string_lossy().to_string());
        }
    }

    let bytes = crate::icon_extractor::extract_shell_path_icon_png_bytes(&abs)?;
    std::fs::write(&dest, &bytes).ok()?;
    Some(dest.to_string_lossy().to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn ensure_cached_icon_png(_app: &AppHandle, _shell_source: &Path) -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
pub fn resolve_icons_for_games(app: &AppHandle, games: &mut [Game]) {
    use crate::commands::LaunchType;
    use std::path::Path;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    }

    for g in games.iter_mut() {
        if g.launch_type != LaunchType::Executable {
            continue;
        }
        if !g.platform.trim().eq_ignore_ascii_case("windows") {
            continue;
        }
        // Treat empty cover as none so we still resolve local icons.
        if g.cover_art.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false) {
            continue;
        }
        if let Some(ref cur) = g.icon {
            let c = cur.trim();
            if c.starts_with("http://")
                || c.starts_with("https://")
                || c.starts_with("data:")
            {
                continue;
            }
            if Path::new(c).is_file() {
                continue;
            }
        }
        let p = Path::new(g.executable.trim());
        if let Some(path_str) = ensure_cached_icon_png(app, p) {
            g.icon = Some(path_str);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_icons_for_games(_app: &AppHandle, _games: &mut [Game]) {}
