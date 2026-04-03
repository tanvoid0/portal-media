//! On-disk library snapshot + cached Windows shortcut/executable icons.
//! Icons are written under `app_data/library_cache/icons/` and referenced by absolute path in `Game.icon`.
//! `library_snapshot.json` stores the last successful sync result (merged scan + manual rows).

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::commands::Game;

const SNAPSHOT_FILE: &str = "library_snapshot.json";

/// Bump when icon extraction or cache layout changes so new PNGs are generated.
#[cfg(target_os = "windows")]
const ICON_CACHE_FINGERPRINT: u32 = 3;

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

/// Valid on-disk cache hit — safe on any thread (no COM).
#[cfg(target_os = "windows")]
fn try_valid_cached_icon_path(app: &AppHandle, shell_source: &Path) -> Option<String> {
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
    None
}

/// Extract / write cache. **Must run on a thread with `CoInitializeEx(COINIT_APARTMENTTHREADED)`** — shell APIs fail on MTA (e.g. Tauri async pool).
#[cfg(target_os = "windows")]
fn ensure_cached_icon_png_on_sta_thread(app: &AppHandle, shell_source: &Path) -> Option<String> {
    let abs = std::fs::canonicalize(shell_source).unwrap_or_else(|_| shell_source.to_path_buf());
    if !abs.is_file() {
        return None;
    }
    if let Some(p) = try_valid_cached_icon_path(app, shell_source) {
        return Some(p);
    }
    let key_src = abs.to_string_lossy().to_string();
    let dest = icons_dir(app)
        .ok()?
        .join(format!("{:016x}.png", cache_key_for_shell_path(&key_src)));
    let bytes = crate::icon_extractor::extract_shell_path_icon_png_bytes(&abs)?;
    std::fs::write(&dest, &bytes).ok()?;
    Some(dest.to_string_lossy().to_string())
}

/// Returns absolute `.png` path for webview `convertFileSrc`, or `None` if extraction fails.
#[cfg(target_os = "windows")]
pub fn ensure_cached_icon_png(app: &AppHandle, shell_source: &Path) -> Option<String> {
    if let Some(hit) = try_valid_cached_icon_path(app, shell_source) {
        return Some(hit);
    }
    let app = app.clone();
    let shell = shell_source.to_path_buf();
    std::thread::spawn(move || {
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }
        let out = ensure_cached_icon_png_on_sta_thread(&app, &shell);
        unsafe {
            CoUninitialize();
        }
        out
    })
    .join()
    .ok()
    .flatten()
}

#[cfg(not(target_os = "windows"))]
pub fn ensure_cached_icon_png(_app: &AppHandle, _shell_source: &Path) -> Option<String> {
    None
}

/// True when `executable` is something the Windows shell can treat as a filesystem path (`.exe`, `.lnk`, etc.).
/// Store scanners set `platform` to `"Epic Games"`, `"GOG"`, … — not `"Windows"`, so we must not gate on `platform`.
#[cfg(target_os = "windows")]
fn executable_looks_like_local_shell_path(ex: &str) -> bool {
    let t = ex.trim();
    if t.is_empty() {
        return false;
    }
    let lower = t.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return false;
    }
    // `steam://…`, `ms-windows-store://…`, etc.
    if lower.contains("://") {
        return false;
    }
    let bytes = t.as_bytes();
    if bytes.len() >= 2 {
        let b0 = bytes[0];
        let b1 = bytes[1];
        if b1 == b':' && b0.is_ascii_alphabetic() {
            return true;
        }
    }
    t.starts_with("\\\\") || t.starts_with("//")
}

#[cfg(target_os = "windows")]
fn game_needs_shell_icon_extract(g: &Game) -> bool {
    use crate::commands::{Category, LaunchType};
    use std::path::Path;

    if g.launch_type == LaunchType::Url {
        return false;
    }
    if g.category != Category::App
        && g.cover_art.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
    {
        return false;
    }
    if let Some(ref cur) = g.icon {
        let c = cur.trim();
        if c.starts_with("http://") || c.starts_with("https://") || c.starts_with("data:") {
            return false;
        }
        if Path::new(c).is_file() {
            return false;
        }
    }
    let ex = g.executable.trim();
    executable_looks_like_local_shell_path(ex)
}

#[cfg(target_os = "windows")]
pub fn resolve_icons_for_games(app: &AppHandle, games: &mut [Game]) {
    use std::path::Path;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

    // Cache hits without spawning (no COM).
    for g in games.iter_mut() {
        if !game_needs_shell_icon_extract(g) {
            continue;
        }
        let p = Path::new(g.executable.trim());
        if let Some(hit) = try_valid_cached_icon_path(app, p) {
            g.icon = Some(hit);
        }
    }

    let mut jobs: Vec<(usize, PathBuf)> = Vec::new();
    for (idx, g) in games.iter().enumerate() {
        if !game_needs_shell_icon_extract(g) {
            continue;
        }
        if g.icon.as_ref().is_some_and(|s| {
            let c = s.trim();
            !c.is_empty() && Path::new(c).is_file()
        }) {
            continue;
        }
        let ex = g.executable.trim();
        jobs.push((idx, PathBuf::from(ex)));
    }

    if jobs.is_empty() {
        return;
    }

    let app = app.clone();
    let results = std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }
        let mut out = Vec::with_capacity(jobs.len());
        for (idx, p) in jobs {
            let icon = ensure_cached_icon_png_on_sta_thread(&app, &p);
            out.push((idx, icon));
        }
        unsafe {
            CoUninitialize();
        }
        out
    })
    .join()
    .unwrap_or_default();

    for (idx, path_opt) in results {
        if let Some(s) = path_opt {
            if let Some(g) = games.get_mut(idx) {
                g.icon = Some(s);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_icons_for_games(_app: &AppHandle, _games: &mut [Game]) {}
