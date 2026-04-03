use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Deserializer, Serialize};
use std::process::Command;
use tauri::command;
use tauri::AppHandle;
use crate::game_scanner;
use crate::icon_extractor;
use crate::library_cache;
use crate::library_store;

fn deserialize_trimmed_opt_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let o = Option::<String>::deserialize(deserializer)?;
    Ok(o.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    }))
}

/// Library row from scan / snapshot / manual SQLite. Aliases keep JS IPC and older JSON happy.
#[derive(Debug, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub path: String,
    pub executable: String,
    #[serde(
        default,
        deserialize_with = "deserialize_trimmed_opt_string",
        alias = "coverArt"
    )]
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_trimmed_opt_string")]
    pub icon: Option<String>, // Remote URL, data URL, or absolute path to cached PNG (Windows)
    pub platform: String,
    pub category: Category,
    #[serde(alias = "launchType")]
    pub launch_type: LaunchType,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Category {
    Game,
    App,
    Media,
    Bookmark,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum LaunchType {
    Executable,
    Steam,
    Epic,
    Gog,
    Ubisoft,
    Xbox,
    Url,
}

#[derive(Debug, Serialize)]
pub struct LaunchGameResult {
    /// OS process id when this app spawned a direct executable; launcher/URI opens usually return None.
    pub pid: Option<u32>,
}

fn spawn_detached_with_pid(
    program: &str,
    args: &[&str],
    cwd: Option<&std::path::Path>,
) -> Result<LaunchGameResult, String> {
    let mut c = Command::new(program);
    c.args(args);
    if let Some(p) = cwd {
        c.current_dir(p);
    }
    let mut child = c.spawn().map_err(|e| e.to_string())?;
    let pid = child.id();
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(LaunchGameResult { pid: Some(pid) })
}

#[cfg(target_os = "windows")]
#[command]
pub fn focus_window_by_pid(pid: u32) -> Result<(), String> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow, ShowWindow,
        SW_RESTORE,
    };

    struct Search {
        pid: u32,
        best: Option<HWND>,
    }

    let mut search = Search { pid, best: None };
    let lparam = LPARAM(&mut search as *mut Search as isize);

    unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut Search);
        let mut wpid = 0u32;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut wpid));
        if wpid == search.pid && IsWindowVisible(hwnd).as_bool() {
            search.best = Some(hwnd);
            BOOL(0)
        } else {
            TRUE
        }
    }

    unsafe {
        let _ = EnumWindows(Some(callback), lparam);
    }

    let hwnd = search
        .best
        .ok_or_else(|| "No visible window found for that process".to_string())?;
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        let _ = SetForegroundWindow(hwnd);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[command]
pub fn focus_window_by_pid(_pid: u32) -> Result<(), String> {
    Err("focus_window_by_pid is only supported on Windows".to_string())
}

#[command]
pub async fn scan_games(app: AppHandle) -> Result<Vec<Game>, String> {
    let mut games = Vec::new();

    // Scan all platforms
    #[cfg(target_os = "windows")]
    {
        games.extend(game_scanner::scan_steam_games());
        games.extend(game_scanner::scan_windows_apps());
        games.extend(game_scanner::scan_epic_games());
        games.extend(game_scanner::scan_gog_games());
        games.extend(game_scanner::scan_ubisoft_games());
        games.extend(game_scanner::scan_xbox_games());
    }

    // Deduplicate games by ID and name
    games.sort_by(|a, b| a.id.cmp(&b.id));
    games.dedup_by(|a, b| a.id == b.id);

    // Also remove duplicates by name and executable path
    games.sort_by(|a, b| {
        a.name
            .cmp(&b.name)
            .then_with(|| a.executable.cmp(&b.executable))
    });
    let mut seen = std::collections::HashSet::new();
    games.retain(|game| {
        let key = format!("{}|{}", game.name, game.executable);
        seen.insert(key)
    });

    games.extend(crate::library_store::load_manual_entries(&app)?);

    library_cache::resolve_icons_for_games(&app, &mut games);
    library_cache::persist_snapshot(&app, &games)?;

    Ok(games)
}

/// Last merged library from [`scan_games`] (platform scan + manual SQLite rows).
/// Re-attaches cached icon paths from disk (and extracts missing ones) without re-scanning installers.
#[command]
pub async fn load_cached_library(app: AppHandle) -> Result<Option<Vec<Game>>, String> {
    let Some(mut games) = library_cache::load_snapshot(&app)? else {
        return Ok(None);
    };
    let icons_before = games.iter().filter(|g| icon_nonempty(g)).count();
    library_cache::resolve_icons_for_games(&app, &mut games);
    let icons_after = games.iter().filter(|g| icon_nonempty(g)).count();
    if icons_after > icons_before {
        let _ = library_cache::persist_snapshot(&app, &games);
    }
    Ok(Some(games))
}

fn icon_nonempty(g: &Game) -> bool {
    g.icon
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
}

#[command]
pub async fn launch_game(game: Game) -> Result<LaunchGameResult, String> {
    match game.launch_type {
        LaunchType::Executable => {
            #[cfg(target_os = "windows")]
            {
                let ext = std::path::Path::new(&game.executable)
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase());
                if matches!(ext.as_deref(), Some("lnk") | Some("url")) {
                    Command::new("cmd")
                        .args(["/C", "start", "", &game.executable])
                        .spawn()
                        .map_err(|e| format!("Failed to launch shortcut: {}", e))?;
                    return Ok(LaunchGameResult { pid: None });
                }
            }
            let parent = std::path::Path::new(&game.path).parent();
            return spawn_detached_with_pid(&game.executable, &[], parent)
                .map_err(|e| format!("Failed to launch game: {}", e));
        }
        LaunchType::Steam => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &format!("steam://rungameid/{}", game.id)])
                    .spawn()
                    .map_err(|e| format!("Failed to launch Steam game: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                Command::new("steam")
                    .arg(format!("steam://rungameid/{}", game.id))
                    .spawn()
                    .map_err(|e| format!("Failed to launch Steam game: {}", e))?;
            }
        }
        LaunchType::Epic => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", game.id)])
                    .spawn()
                    .map_err(|e| format!("Failed to launch Epic game: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("Epic Games Launcher is only supported on Windows".to_string());
            }
        }
        LaunchType::Gog => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &format!("goggalaxy://openGameView/{}", game.id)])
                    .spawn()
                    .map_err(|e| format!("Failed to launch GOG game: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("GOG Galaxy is only supported on Windows".to_string());
            }
        }
        LaunchType::Ubisoft => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &format!("uplay://launch/{}/0", game.id)])
                    .spawn()
                    .map_err(|e| format!("Failed to launch Ubisoft game: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("Ubisoft Connect is only supported on Windows".to_string());
            }
        }
        LaunchType::Xbox => {
            #[cfg(target_os = "windows")]
            {
                // Try to launch via executable first, otherwise use Microsoft Store protocol
                if game.executable.starts_with("ms-windows-store://") {
                    Command::new("cmd")
                        .args(["/C", "start", "", &game.executable])
                        .spawn()
                        .map_err(|e| format!("Failed to launch Xbox game: {}", e))?;
                } else if std::path::Path::new(&game.executable).exists() {
                    let parent = std::path::Path::new(&game.path).parent();
                    return spawn_detached_with_pid(&game.executable, &[], parent)
                        .map_err(|e| format!("Failed to launch Xbox game: {}", e));
                } else {
                    // Fallback to Microsoft Store protocol
                    Command::new("cmd")
                        .args(["/C", "start", "", &format!("ms-windows-store://pdp/?ProductId={}", game.id)])
                        .spawn()
                        .map_err(|e| format!("Failed to launch Xbox game: {}", e))?;
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("Xbox games are only supported on Windows".to_string());
            }
        }
        LaunchType::Url => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &game.executable])
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                Command::new("xdg-open")
                    .arg(&game.executable)
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }
        }
    }

    Ok(LaunchGameResult { pid: None })
}

#[command]
pub async fn add_manual_game(
    app: AppHandle,
    name: String,
    path: String,
    executable: String,
) -> Result<Game, String> {
    let target = executable.trim();
    if target.is_empty() {
        return Err("Executable path is required.".into());
    }
    // Legacy `path` is kept for API compatibility; launch uses the same path layout as scans (derived from the target).
    let _legacy_path = path;
    library_store::library_manual_add_impl(
        &app,
        library_store::LibraryManualAdd::Executable {
            name,
            category: Category::App,
            target_path: target.to_string(),
        },
    )
}

#[command]
pub async fn extract_icon(path: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::Path;
        let path = Path::new(&path);
        if path.extension().and_then(|s| s.to_str()) == Some("exe") {
            Ok(icon_extractor::extract_icon_from_exe(path))
        } else {
            Ok(None)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

fn sniff_image_mime(data: &[u8]) -> &'static str {
    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if data.len() >= PNG.len() && &data[..PNG.len()] == PNG {
        return "image/png";
    }
    if data.len() >= 3 && &data[..3] == &[0xFF, 0xD8, 0xFF] {
        return "image/jpeg";
    }
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return "image/webp";
    }
    if data.len() >= 6 && (&data[..6] == b"GIF87a" || &data[..6] == b"GIF89a") {
        return "image/gif";
    }
    // ICO: reserved 0, type 1 (icon), LE
    if data.len() >= 4 && data[0] == 0 && data[1] == 0 && data[2] == 1 && data[3] == 0 {
        return "image/x-icon";
    }
    "image/png"
}

/// Fetches a remote image and returns a data URL so the webview can read pixels (CORS-safe).
#[command]
pub async fn fetch_image_as_data_url(url: String) -> Result<String, String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("Only http(s) image URLs are allowed".into()),
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("PortalMedia/1.0 (ambient)")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_lowercase();

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 1_500_000 {
        return Err("Image too large".into());
    }

    let mime = if ct.starts_with("image/") {
        ct
    } else {
        sniff_image_mime(&bytes).to_string()
    };

    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

