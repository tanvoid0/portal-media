use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::command;
use crate::game_scanner;
use crate::icon_extractor;

#[derive(Debug, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub path: String,
    pub executable: String,
    pub cover_art: Option<String>,
    pub icon: Option<String>, // Base64 encoded icon
    pub platform: String,
    pub category: Category,
    pub launch_type: LaunchType,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Category {
    Game,
    App,
    Media,
    Bookmark,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LaunchType {
    Executable,
    Steam,
    Epic,
    Gog,
    Ubisoft,
    Xbox,
    Url,
}

#[command]
pub async fn scan_games() -> Result<Vec<Game>, String> {
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
        a.name.cmp(&b.name).then_with(|| a.executable.cmp(&b.executable))
    });
    let mut seen = std::collections::HashSet::new();
    games.retain(|game| {
        let key = format!("{}|{}", game.name, game.executable);
        seen.insert(key)
    });
    
    Ok(games)
}

#[command]
pub async fn launch_game(game: Game) -> Result<(), String> {
    use std::process::Command;
    
    match game.launch_type {
        LaunchType::Executable => {
            let mut cmd = Command::new(&game.executable);
            if let Some(parent) = std::path::Path::new(&game.path).parent() {
                cmd.current_dir(parent);
            }
            cmd.spawn().map_err(|e| format!("Failed to launch game: {}", e))?;
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
                    // Direct executable launch
                    let mut cmd = Command::new(&game.executable);
                    if let Some(parent) = std::path::Path::new(&game.path).parent() {
                        cmd.current_dir(parent);
                    }
                    cmd.spawn().map_err(|e| format!("Failed to launch Xbox game: {}", e))?;
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
    
    Ok(())
}

#[command]
pub async fn add_manual_game(
    name: String,
    path: String,
    executable: String,
) -> Result<Game, String> {
    Ok(Game {
        id: format!("manual_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
        name,
        path,
        executable,
        cover_art: None,
        icon: None,
        platform: "Windows".to_string(),
        category: Category::App,
        launch_type: LaunchType::Executable,
    })
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

