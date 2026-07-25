use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Platform {
    Steam,
    EpicGames,
    Gog,
    Ubisoft,
    Xbox,
}

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Steam => "Steam",
            Platform::EpicGames => "Epic Games",
            Platform::Gog => "GOG",
            Platform::Ubisoft => "Ubisoft",
            Platform::Xbox => "Xbox",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "Steam" => Some(Platform::Steam),
            "Epic Games" => Some(Platform::EpicGames),
            "GOG" => Some(Platform::Gog),
            "Ubisoft" => Some(Platform::Ubisoft),
            "Xbox" => Some(Platform::Xbox),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub user_id: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub game_count: Option<usize>, // Serialized as "gameCount" due to rename_all
    pub error: Option<String>,
    pub user_profile: Option<UserProfile>,
}

impl SyncResult {
    pub fn success(game_count: usize) -> Self {
        Self {
            success: true,
            game_count: Some(game_count),
            error: None,
            user_profile: None,
        }
    }

    pub fn success_with_profile(game_count: usize, profile: UserProfile) -> Self {
        Self {
            success: true,
            game_count: Some(game_count),
            error: None,
            user_profile: Some(profile),
        }
    }

    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            game_count: None,
            error: Some(error),
            user_profile: None,
        }
    }
}

// Store for platform authentication tokens
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref PLATFORM_TOKENS: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
}

fn get_tokens() -> std::sync::MutexGuard<'static, HashMap<String, String>> {
    PLATFORM_TOKENS.lock().unwrap()
}

// Common helper functions for platform operations
mod helpers {
    use super::*;
    
    pub fn store_token(platform_name: &str) {
        let mut tokens = get_tokens();
        tokens.insert(platform_name.to_string(), "connected".to_string());
        println!("✓ {} token stored. Total tokens: {:?}", platform_name, tokens.keys().collect::<Vec<_>>());
    }
    
    pub fn has_token(platform_name: &str) -> bool {
        let tokens = get_tokens();
        tokens.contains_key(platform_name)
    }
    
    pub fn remove_token(platform_name: &str) {
        let mut tokens = get_tokens();
        tokens.remove(platform_name);
    }
    
    pub fn check_paths_exist(paths: &[PathBuf]) -> Option<PathBuf> {
        for path in paths {
            if path.exists() {
                return Some(path.clone());
            }
        }
        None
    }
}

// Platform-specific implementations using enum dispatch
impl Platform {
    /// Get installation paths for path-based detection
    pub fn get_installation_paths(&self) -> Vec<PathBuf> {
        match self {
            Platform::Steam => vec![
                PathBuf::from(r"C:\Program Files (x86)\Steam"),
                PathBuf::from(r"C:\Program Files\Steam"),
                PathBuf::from(format!(r"{}\Steam", std::env::var("LOCALAPPDATA").unwrap_or_default())),
            ],
            Platform::EpicGames => {
                let program_data = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
                vec![
                    PathBuf::from(&program_data).join("Epic").join("EpicGamesLauncher"),
                ]
            },
            Platform::Gog => {
                let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
                    format!(r"{}\AppData\Local", std::env::var("USERPROFILE").unwrap_or_default())
                });
                vec![
                    PathBuf::from(&local_app_data).join("GOG.com").join("Galaxy"),
                ]
            },
            Platform::Ubisoft | Platform::Xbox => vec![], // Registry-based, no paths needed
        }
    }
    
    /// Check if the platform is installed
    pub fn is_installed(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            match self {
                Platform::Steam => {
                    let paths = self.get_installation_paths();
                    helpers::check_paths_exist(&paths).is_some()
                },
                Platform::EpicGames => {
                    // Check both path-based and registry-based detection
                    let paths = self.get_installation_paths();
                    if helpers::check_paths_exist(&paths).is_some() {
                        return true;
                    }
                    
                    // Also check registry
                    use winreg::enums::*;
                    use winreg::RegKey;
                    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                    let registry_paths = vec![
                        r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher",
                        r"SOFTWARE\Epic Games\EpicGamesLauncher",
                    ];
                    for reg_path in registry_paths {
                        if hklm.open_subkey(reg_path).is_ok() {
                            println!("Epic Games Launcher found in registry: {}", reg_path);
                            return true;
                        }
                    }
                    false
                },
                Platform::Gog => {
                    // Check both path-based and registry-based detection
                    let paths = self.get_installation_paths();
                    if helpers::check_paths_exist(&paths).is_some() {
                        return true;
                    }
                    
                    // Also check registry
                    use winreg::enums::*;
                    use winreg::RegKey;
                    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                    let registry_paths = vec![
                        r"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient",
                        r"SOFTWARE\GOG.com\GalaxyClient",
                    ];
                    for reg_path in registry_paths {
                        if hklm.open_subkey(reg_path).is_ok() {
                            println!("GOG Galaxy found in registry: {}", reg_path);
                            return true;
                        }
                    }
                    false
                },
                Platform::Ubisoft => {
                    use winreg::enums::*;
                    use winreg::RegKey;
                    
                    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                    let ubisoft_path = r"SOFTWARE\WOW6432Node\Ubisoft\Launcher";
                    match hklm.open_subkey(ubisoft_path) {
                        Ok(_) => {
                            println!("Ubisoft Connect found in registry");
                            true
                        },
                        Err(e) => {
                            println!("Ubisoft Connect not found in registry: {}", e);
                            false
                        }
                    }
                },
                Platform::Xbox => {
                    use winreg::enums::*;
                    use winreg::RegKey;
                    
                    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
                    let uninstall_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
                    
                    match hkcu.open_subkey(uninstall_path) {
                        Ok(uninstall_key) => {
                            for app_id_result in uninstall_key.enum_keys() {
                                if let Ok(app_id) = app_id_result {
                                    if app_id.starts_with("Microsoft.XboxApp") {
                                        println!("Xbox app found in registry: {}", app_id);
                                        return true;
                                    }
                                }
                            }
                            println!("Xbox app not found in registry");
                            false
                        },
                        Err(e) => {
                            println!("Failed to open Uninstall registry key: {}", e);
                            false
                        }
                    }
                },
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            false
        }
    }
    
    /// Get the scanner function for this platform
    fn get_scanner(&self) -> fn() -> Vec<crate::commands::Game> {
        match self {
            Platform::Steam => crate::game_scanner::scan_steam_games,
            Platform::EpicGames => crate::game_scanner::scan_epic_games,
            Platform::Gog => crate::game_scanner::scan_gog_games,
            Platform::Ubisoft => crate::game_scanner::scan_ubisoft_games,
            Platform::Xbox => crate::game_scanner::scan_xbox_games,
        }
    }
    
    /// Connect to the platform. For Steam/Epic/GOG, restores from stored
    /// credentials if available. Falls back to installation detection otherwise.
    pub async fn connect(&self) -> Result<SyncResult, String> {
        #[cfg(target_os = "windows")]
        {
            // Check for stored WebView credentials first (Steam/Epic/GOG)
            match self {
                Platform::Steam => {
                    if let Some((steam_id, _token)) =
                        crate::metadata::get_steam_credentials()
                    {
                        helpers::store_token("Steam");
                        let games = crate::game_scanner::scan_steam_games();
                        let mut profile = UserProfile {
                            user_id: steam_id.clone(),
                            display_name: "Steam User".to_string(),
                            avatar_url: None,
                        };
                        if let Some(p) = crate::game_scanner::get_steam_user_profile().await {
                            profile = p;
                        }
                        println!("✓ Steam restored from stored credentials ({})", profile.display_name);
                        return Ok(SyncResult::success_with_profile(games.len(), profile));
                    }
                }
                Platform::EpicGames => {
                    if let Some(creds) = crate::metadata::get_epic_credentials() {
                        helpers::store_token("Epic Games");
                        let games = crate::game_scanner::scan_epic_games();
                        let profile = UserProfile {
                            user_id: creds.account_id,
                            display_name: creds.display_name,
                            avatar_url: None,
                        };
                        println!("✓ Epic restored from stored credentials ({})", profile.display_name);
                        return Ok(SyncResult::success_with_profile(games.len(), profile));
                    }
                }
                Platform::Gog => {
                    if let Some((user_id, username)) =
                        crate::metadata::get_gog_credentials()
                    {
                        helpers::store_token("GOG");
                        let games = crate::game_scanner::scan_gog_games();
                        let profile = UserProfile {
                            user_id,
                            display_name: username.clone(),
                            avatar_url: None,
                        };
                        println!("✓ GOG restored from stored credentials ({})", username);
                        return Ok(SyncResult::success_with_profile(games.len(), profile));
                    }
                }
                Platform::Xbox => {
                    if let Some(creds) = crate::metadata::get_xbox_credentials() {
                        helpers::store_token("Xbox");
                        let games = crate::game_scanner::scan_xbox_games();
                        let profile = UserProfile {
                            user_id: creds.xid,
                            display_name: creds.gamertag.clone(),
                            avatar_url: None,
                        };
                        println!("✓ Xbox restored from stored credentials ({})", creds.gamertag);
                        return Ok(SyncResult::success_with_profile(games.len(), profile));
                    }
                }
                Platform::Ubisoft => {
                    if let Some((username, user_id)) = crate::metadata::get_ubisoft_credentials() {
                        helpers::store_token("Ubisoft");
                        let games = crate::game_scanner::scan_ubisoft_games();
                        let profile = UserProfile {
                            user_id,
                            display_name: username.clone(),
                            avatar_url: None,
                        };
                        println!("✓ Ubisoft restored from stored credentials ({})", username);
                        return Ok(SyncResult::success_with_profile(games.len(), profile));
                    }
                }
            }

            // Fall back to installation detection (Ubisoft, Xbox, or any platform
            // without stored credentials)
            if !self.is_installed() {
                return Err(format!(
                    "{} installation not found. Please ensure it is installed.",
                    self.as_str()
                ));
            }

            helpers::store_token(self.as_str());

            let sync_result = match self.sync().await {
                Ok(result) => {
                    println!("{} sync successful: {} games", self.as_str(), result.game_count.unwrap_or(0));
                    result
                }
                Err(e) => {
                    println!("{} sync error during connection (non-fatal): {}", self.as_str(), e);
                    SyncResult::success(0)
                }
            };

            let mut final_result = sync_result;

            if let Platform::Steam = self {
                if let Some(profile) = crate::game_scanner::get_steam_user_profile().await {
                    println!("✓ Steam profile found: {} ({})", profile.display_name, profile.user_id);
                    final_result.user_profile = Some(profile);
                }
            }

            Ok(final_result)
        }
        #[cfg(not(target_os = "windows"))]
        {
            Err(format!("{} detection is only supported on Windows", self.as_str()))
        }
    }
    
    /// Sync games from the platform
    pub async fn sync(&self) -> Result<SyncResult, String> {
        // Check if connected (token exists)
        let has_token = helpers::has_token(self.as_str());
        
        // If no token, check if platform is installed and restore connection
        if !has_token {
            println!("{} token not found, checking if installation exists...", self.as_str());
            if self.is_installed() {
                println!("{} installation found, restoring connection", self.as_str());
                helpers::store_token(self.as_str());
            } else {
                return Err(format!("{} not connected. Please detect {} installation first.", self.as_str(), self.as_str()));
            }
        } else {
            println!("✓ {} token found, proceeding with sync", self.as_str());
        }
        
        println!("{} is connected, scanning for games...", self.as_str());
        
        // Scan for games
        let scanner = self.get_scanner();
        let installed_games = scanner();
        let game_count = installed_games.len();
        
        println!("{} sync completed: found {} games", self.as_str(), game_count);
        
        Ok(SyncResult::success(game_count))
    }
    
    /// Disconnect from the platform (remove token and stored credentials)
    pub fn disconnect(&self) -> Result<(), String> {
        helpers::remove_token(self.as_str());
        match self {
            Platform::Steam => { let _ = crate::metadata::clear_steam_credentials(); }
            Platform::EpicGames => { let _ = crate::metadata::clear_epic_credentials(); }
            Platform::Gog => { let _ = crate::metadata::clear_gog_credentials(); }
            Platform::Xbox => { let _ = crate::metadata::clear_xbox_credentials(); }
            Platform::Ubisoft => { let _ = crate::metadata::clear_ubisoft_credentials(); }
        }
        Ok(())
    }
}

// Public API functions using the enum-based system
pub async fn connect_platform(platform: &str) -> Result<SyncResult, String> {
    let platform_enum = Platform::from_str(platform)
        .ok_or_else(|| format!("Unknown platform: {}", platform))?;
    
    let result = platform_enum.connect().await;
    
    // Log the result for debugging
    match &result {
        Ok(r) => println!("Platform {} connected: {} games found", platform, r.game_count.unwrap_or(0)),
        Err(e) => println!("Platform {} connection failed: {}", platform, e),
    }
    
    result
}

pub async fn sync_platform(platform: &str) -> Result<SyncResult, String> {
    let platform_enum = Platform::from_str(platform)
        .ok_or_else(|| format!("Unknown platform: {}", platform))?;
    
    platform_enum.sync().await
}

pub async fn disconnect_platform(platform: &str) -> Result<(), String> {
    let platform_enum = Platform::from_str(platform)
        .ok_or_else(|| format!("Unknown platform: {}", platform))?;
    
    platform_enum.disconnect()
}

// Tauri commands
#[command]
pub async fn connect_platform_command(platform: String) -> Result<SyncResult, String> {
    connect_platform(&platform).await
}

#[command]
pub async fn sync_platform_command(platform: String) -> Result<SyncResult, String> {
    println!("=== Syncing platform: {} ===", platform);
    match sync_platform(&platform).await {
        Ok(result) => {
            let game_count = result.game_count.unwrap_or(0);
            println!("✓ Sync successful for {}: {} games found", platform, game_count);
            Ok(result)
        },
        Err(e) => {
            println!("✗ Sync failed for {}: {}", platform, e);
            Err(e)
        }
    }
}

#[command]
pub async fn authenticate_platform_command(platform: String, app: tauri::AppHandle) -> Result<SyncResult, String> {
    println!("=== Authenticating platform: {} ===", platform);

    let platform_enum = Platform::from_str(&platform)
        .ok_or_else(|| format!("Unknown platform: {}", platform))?;

    match platform_enum {
        Platform::Steam => {
            let result = crate::platform_auth::steam_login(app).await?;
            crate::metadata::save_steam_credentials(
                &result.steam_id,
                &result.access_token,
            )?;
            helpers::store_token("Steam");
            let games = crate::game_scanner::scan_steam_games();
            Ok(SyncResult::success_with_profile(games.len(), result.profile))
        }
        Platform::EpicGames => {
            let result = crate::platform_auth::epic_login(app).await?;
            crate::metadata::save_epic_credentials(
                &result.account_id,
                &result.display_name,
                &result.access_token,
                &result.refresh_token,
            )?;
            helpers::store_token("Epic Games");
            let games = crate::game_scanner::scan_epic_games();
            let profile = UserProfile {
                user_id: result.account_id,
                display_name: result.display_name,
                avatar_url: None,
            };
            Ok(SyncResult::success_with_profile(games.len(), profile))
        }
        Platform::Gog => {
            let result = crate::platform_auth::gog_login(app).await?;
            crate::metadata::save_gog_credentials(
                &result.user_id,
                &result.username,
            )?;
            helpers::store_token("GOG");
            let games = crate::game_scanner::scan_gog_games();
            let profile = UserProfile {
                user_id: result.user_id,
                display_name: result.username,
                avatar_url: None,
            };
            Ok(SyncResult::success_with_profile(games.len(), profile))
        }
        Platform::Xbox => {
            let result = crate::platform_auth::xbox_login(app).await?;
            crate::metadata::save_xbox_credentials(
                &crate::metadata::XboxStoredCredentials {
                    xid: result.xid.clone(),
                    uhs: result.uhs,
                    xsts_token: result.xsts_token,
                    refresh_token: result.refresh_token,
                    gamertag: result.gamertag.clone(),
                },
            )?;
            helpers::store_token("Xbox");
            let games = crate::game_scanner::scan_xbox_games();
            let profile = UserProfile {
                user_id: result.xid,
                display_name: result.gamertag,
                avatar_url: None,
            };
            Ok(SyncResult::success_with_profile(games.len(), profile))
        }
        Platform::Ubisoft => {
            // Ubisoft has no public OAuth. Check installation and read local profile.
            if !Platform::Ubisoft.is_installed() {
                return Err("Ubisoft Connect installation not found".to_string());
            }
            let profile_info = crate::platform_auth::ubisoft_read_local_profile();
            let (username, user_id) = match &profile_info {
                Some(p) => (p.username.clone(), p.user_id.clone()),
                None => ("Ubisoft User".to_string(), String::new()),
            };
            crate::metadata::save_ubisoft_credentials(&username, &user_id)?;
            helpers::store_token("Ubisoft");
            let games = crate::game_scanner::scan_ubisoft_games();
            let profile = UserProfile {
                user_id,
                display_name: username,
                avatar_url: None,
            };
            Ok(SyncResult::success_with_profile(games.len(), profile))
        }
    }
}

#[command]
pub async fn disconnect_platform_command(platform: String) -> Result<(), String> {
    disconnect_platform(&platform).await
}
