use std::path::PathBuf;
use crate::commands::{Game, Category};
use crate::icon_extractor;
use serde_json::Value;

pub fn scan_steam_games() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
    let mut games = Vec::new();
    
    // Find Steam installation via registry first (like Playnite does)
    let mut steam_paths = Vec::new();
    
    // Check registry for Steam installation path
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(steam_key) = hklm.open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
            let path = PathBuf::from(install_path);
            if path.exists() {
                println!("Found Steam via registry: {:?}", path);
                steam_paths.push(path);
            }
        }
    }
    
    // Also check HKEY_CURRENT_USER
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(steam_key) = hkcu.open_subkey(r"Software\Valve\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("SteamPath") {
            let path = PathBuf::from(install_path);
            // Normalize path to avoid duplicates (canonicalize)
            if let Ok(canonical) = path.canonicalize() {
                let normalized = canonical;
                // Check if we already have this path (case-insensitive comparison)
                let already_exists = steam_paths.iter().any(|p| {
                    if let Ok(existing_canonical) = p.canonicalize() {
                        existing_canonical == normalized
                    } else {
                        false
                    }
                });
                if !already_exists {
                    println!("Found Steam via registry (HKCU): {:?}", path);
                    steam_paths.push(path);
                }
            } else if path.exists() {
                // Fallback if canonicalize fails
                let already_exists = steam_paths.iter().any(|p| {
                    p.to_string_lossy().to_lowercase() == path.to_string_lossy().to_lowercase()
                });
                if !already_exists {
                    println!("Found Steam via registry (HKCU): {:?}", path);
                    steam_paths.push(path);
                }
            }
        }
    }
    
    // Fallback to common installation paths
    let common_paths = vec![
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
        PathBuf::from(format!(r"{}\Steam", std::env::var("LOCALAPPDATA").unwrap_or_default())),
    ];
    
    for path in common_paths {
        if path.exists() {
            // Check if we already have this path (case-insensitive)
            let already_exists = steam_paths.iter().any(|p| {
                if let (Ok(p_canonical), Ok(path_canonical)) = (p.canonicalize(), path.canonicalize()) {
                    p_canonical == path_canonical
                } else {
                    p.to_string_lossy().to_lowercase() == path.to_string_lossy().to_lowercase()
                }
            });
            if !already_exists {
                steam_paths.push(path);
            }
        }
    }
    
    println!("Scanning for Steam games in {} locations...", steam_paths.len());
    
    for steam_path in &steam_paths {
        println!("Checking Steam path: {:?}", steam_path);
        let library_folders = steam_path.join("steamapps").join("libraryfolders.vdf");
        if library_folders.exists() {
            println!("Found libraryfolders.vdf at: {:?}", library_folders);
            // Parse libraryfolders.vdf to find all library paths
            match parse_libraryfolders(&library_folders) {
                Ok(libraries) => {
                    println!("Found {} Steam library folders", libraries.len());
                    for library_path in &libraries {
                        let apps_path = library_path.join("steamapps");
                        if apps_path.exists() {
                            println!("Scanning library: {:?}", library_path);
                            // Scan for .acf files (Steam app manifests)
                            if let Ok(entries) = std::fs::read_dir(&apps_path) {
                                let mut acf_count = 0;
                                let mut parsed_count = 0;
                                for entry in entries.flatten() {
                                    if let Some(ext) = entry.path().extension() {
                                        if ext == "acf" {
                                            acf_count += 1;
                                            match parse_steam_acf(&entry.path()) {
                                                Ok(game) => {
                                                    parsed_count += 1;
                                                    println!("  ✓ Found game: {} (ID: {})", game.name, game.id);
                                                    games.push(game);
                                                },
                                                Err(e) => {
                                                    // Silently skip tools/DLC/software
                                                    if !e.contains("tool") && !e.contains("DLC") && !e.contains("software") {
                                                        println!("  ✗ Failed to parse {}: {}", entry.path().display(), e);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                println!("  Found {} .acf files, {} valid games in this library", acf_count, parsed_count);
                            }
                        }
                    }
                },
                Err(e) => {
                    println!("Failed to parse libraryfolders.vdf: {}", e);
                }
            }
        } else {
            println!("  libraryfolders.vdf not found at: {:?}", library_folders);
        }
    }
    
    // Deduplicate games by ID (in case same library was scanned multiple times)
    games.sort_by(|a, b| a.id.cmp(&b.id));
    games.dedup_by(|a, b| a.id == b.id);
    
    println!("Steam scan completed: found {} unique games (after deduplication)", games.len());
    games
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

fn parse_libraryfolders(path: &PathBuf) -> Result<Vec<PathBuf>, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read libraryfolders: {}", e))?;
    
    let mut libraries = Vec::new();
    
    // VDF format: "path"		"D:\\SteamLibrary"
    // Look for lines with "path" and extract the value
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains("\"path\"") {
            // Find the path value (usually after tabs and quotes)
            let parts: Vec<&str> = trimmed.split('\t').collect();
            for part in parts {
                let cleaned = part.trim().trim_matches('"');
                if !cleaned.is_empty() && cleaned != "path" {
                    // Handle escaped backslashes
                    let clean_path = cleaned.replace("\\\\", "\\");
                    let path_buf = PathBuf::from(&clean_path);
                    if path_buf.exists() {
                        libraries.push(path_buf);
                    }
                    break;
                }
            }
        }
    }
    
    // Also add the default Steam library path (where libraryfolders.vdf is located)
    if let Some(steam_dir) = path.parent().and_then(|p| p.parent()) {
        if steam_dir.exists() {
            libraries.push(steam_dir.to_path_buf());
        }
    }
    
    // Remove duplicates and verify paths exist
    // Normalize paths to avoid duplicates (case-insensitive on Windows)
    let mut normalized_libraries = Vec::new();
    for lib in libraries {
        if !lib.exists() {
            continue;
        }
        
        // Try to canonicalize first (handles symlinks, case differences, etc.)
        let canonical = lib.canonicalize().unwrap_or_else(|_| lib.clone());
        let already_exists = normalized_libraries.iter().any(|p: &PathBuf| {
            if let Ok(existing_canonical) = p.canonicalize() {
                existing_canonical == canonical
            } else {
                // Fallback: case-insensitive string comparison
                p.to_string_lossy().to_lowercase() == lib.to_string_lossy().to_lowercase()
            }
        });
        
        if !already_exists {
            normalized_libraries.push(lib);
        }
    }
    
    Ok(normalized_libraries)
}

fn parse_steam_acf(path: &PathBuf) -> Result<crate::commands::Game, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read ACF file: {}", e))?;
    
    let mut appid = None;
    let mut name = None;
    let mut installdir = None;
    let mut state_flags = None;
    
    // VDF format parser - Steam ACF files use tabs between key and value
    // Format: "appid"		"123456"  (tabs, not colons)
    for line in content.lines() {
        let trimmed = line.trim();
        
        // Helper function to extract quoted value from VDF line
        // VDF format: "key"		"value" (separated by tabs)
        let extract_quoted_value = |line: &str| -> Option<String> {
            // Find the second quoted string (the value)
            let mut quote_count = 0;
            let mut start = None;
            for (i, ch) in line.char_indices() {
                if ch == '"' {
                    quote_count += 1;
                    if quote_count == 3 {
                        start = Some(i + 1);
                    } else if quote_count == 4 && start.is_some() {
                        return Some(line[start.unwrap()..i].to_string());
                    }
                }
            }
            None
        };
        
        // Parse appid - format: "appid"		"123456"
        if trimmed.starts_with("\"appid\"") {
            if let Some(value) = extract_quoted_value(trimmed) {
                appid = Some(value);
            }
        }
        // Parse name - format: "name"		"Game Name"
        else if trimmed.starts_with("\"name\"") {
            if let Some(value) = extract_quoted_value(trimmed) {
                name = Some(value);
            }
        }
        // Parse installdir - format: "installdir"		"GameFolder"
        else if trimmed.starts_with("\"installdir\"") {
            if let Some(value) = extract_quoted_value(trimmed) {
                installdir = Some(value);
            }
        }
        // Parse StateFlags - format: "StateFlags"		"4" or "StateFlags"		4
        else if trimmed.starts_with("\"StateFlags\"") {
            // Try to extract numeric value (can be quoted or unquoted)
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            for part in parts {
                let cleaned = part.trim().trim_matches('"');
                if let Ok(num) = cleaned.parse::<u32>() {
                    state_flags = Some(num);
                    break;
                }
            }
        }
    }
    
    let appid = appid.ok_or("Missing appid")?;
    let name = name.ok_or("Missing name")?;
    let installdir = installdir.ok_or("Missing installdir")?;
    
    // Check if game is actually installed (StateFlags & 0x00000004 == installed)
    // StateFlags: 0x00000002 = needs update, 0x00000004 = fully installed
    if let Some(flags) = state_flags {
        if (flags & 0x00000004) == 0 {
            return Err("Game not fully installed".to_string());
        }
    }
    
    // Filter out Steam tools, DLC, and non-game content
    // Steam tools typically have appids < 1000 or are in specific ranges
    if let Ok(appid_num) = appid.parse::<u32>() {
        // Filter out tools (typically < 100), DLC (check by name patterns), and software
        if appid_num < 100 {
            return Err("Steam tool, not a game".to_string());
        }
        
        // Check if it's likely DLC or software by name patterns
        let name_lower = name.to_lowercase();
        if name_lower.contains("soundtrack") || 
           name_lower.contains("dlc") || 
           name_lower.contains("demo") ||
           name_lower.contains("test") ||
           name_lower.contains("beta") ||
           name_lower.contains("editor") ||
           name_lower.contains("tool") {
            return Err("Not a game (DLC/tool/software)".to_string());
        }
    }
    
    // Find the library path
    let library_path = path.parent()
        .and_then(|p| p.parent())
        .ok_or("Invalid path structure")?;
    
    let game_path = library_path.join("steamapps").join("common").join(&installdir);
    
    // Check if game directory exists
    if !game_path.exists() {
        return Err("Game directory does not exist".to_string());
    }
    
    // Try to find executable, but don't fail if not found (Steam can launch by appid)
    let executable = find_executable(&game_path).unwrap_or_else(|_| {
        // Fallback to a dummy path - Steam will launch by appid anyway
        game_path.join("game.exe")
    });
    
    Ok(Game {
        id: appid.clone(),
        name,
        path: game_path.to_string_lossy().to_string(),
        executable: executable.to_string_lossy().to_string(),
        cover_art: Some(format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900.jpg", appid)),
        icon: None,
        platform: "Steam".to_string(),
        category: Category::Game,
        launch_type: crate::commands::LaunchType::Steam,
    })
}

fn find_executable(path: &PathBuf) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err("Game path does not exist".to_string());
    }
    
    // Look for common executable names
    let exe_name = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid path")?;
    
    let possible_exes = vec![
        format!("{}.exe", exe_name),
        format!("{}_x64.exe", exe_name),
        format!("{}_x86.exe", exe_name),
        "Game.exe".to_string(),
        "game.exe".to_string(),
    ];
    
    for exe in possible_exes {
        let exe_path = path.join(&exe);
        if exe_path.exists() {
            return Ok(exe_path);
        }
    }
    
    // If no common name found, search for any .exe in the directory
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "exe" {
                    return Ok(entry.path());
                }
            }
        }
    }
    
    Err("No executable found".to_string())
}

pub fn scan_windows_apps() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
    let mut apps = Vec::new();
    
    // Scan Start Menu for applications
    let start_menu_paths = vec![
        PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs"),
        PathBuf::from(format!(r"{}\AppData\Roaming\Microsoft\Windows\Start Menu\Programs", 
            std::env::var("USERPROFILE").unwrap_or_default())),
    ];
    
    for start_menu in start_menu_paths {
        if start_menu.exists() {
            scan_directory_for_apps(&start_menu, &mut apps);
        }
    }
    
    apps
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

fn scan_directory_for_apps(dir: &PathBuf, apps: &mut Vec<crate::commands::Game>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_directory_for_apps(&path, apps);
            } else if let Some(ext) = path.extension() {
                if ext == "lnk" {
                    // Resolve .lnk file to get actual target
                    if let Ok(target_path) = resolve_lnk_target(&path) {
                        if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                            // Skip system shortcuts and uninstallers
                            let name_lower = name.to_lowercase();
                            if name_lower.contains("uninstall") || 
                               name_lower.contains("setup") ||
                               name_lower.contains("installer") {
                                continue;
                            }
                            
                            // Use path hash for unique ID
                            use std::collections::hash_map::DefaultHasher;
                            use std::hash::{Hash, Hasher};
                            let mut hasher = DefaultHasher::new();
                            target_path.to_string_lossy().hash(&mut hasher);
                            let hash = hasher.finish();
                            
                            // Determine category
                            let category = if is_likely_game(&name, &target_path) {
                                Category::Game
                            } else {
                                Category::App
                            };
                            
                            // Extract icon from target
                            let icon = if target_path.extension().and_then(|s| s.to_str()) == Some("exe") {
                                icon_extractor::extract_icon_from_exe(&target_path)
                            } else {
                                icon_extractor::extract_icon_from_lnk(&path)
                            };
                            
                            // For .lnk files, use the .lnk path as executable (Windows can execute shortcuts)
                            // But use target path for category detection
                            let executable = if target_path.extension().and_then(|s| s.to_str()) == Some("lnk") {
                                path.to_string_lossy().to_string() // Use original .lnk path
                            } else {
                                target_path.to_string_lossy().to_string() // Use resolved target
                            };
                            
                            apps.push(crate::commands::Game {
                                id: format!("windows_{}", hash),
                                name: name.to_string(),
                                path: path.parent().unwrap().to_string_lossy().to_string(),
                                executable,
                                cover_art: None,
                                icon,
                                platform: "Windows".to_string(),
                                category,
                                launch_type: crate::commands::LaunchType::Executable,
                            });
                        }
                    }
                } else if ext == "exe" {
                    // Only scan executables in Start Menu, skip system executables
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                        let name_lower = name.to_lowercase();
                        
                        // Skip system executables and installers
                        if name_lower.starts_with("unins") ||
                           name_lower.contains("setup") ||
                           name_lower.contains("installer") ||
                           name_lower == "setup" {
                            continue;
                        }
                        
                        // Use path hash for unique ID
                        use std::collections::hash_map::DefaultHasher;
                        use std::hash::{Hash, Hasher};
                        let mut hasher = DefaultHasher::new();
                        path.to_string_lossy().hash(&mut hasher);
                        let hash = hasher.finish();
                        
                        // Determine category
                        let category = if is_likely_game(&name, &path) {
                            Category::Game
                        } else {
                            Category::App
                        };
                        
                        // Extract icon
                        let icon = icon_extractor::extract_icon_from_exe(&path);
                        
                        apps.push(crate::commands::Game {
                            id: format!("windows_{}", hash),
                            name: name.to_string(),
                            path: path.parent().unwrap().to_string_lossy().to_string(),
                            executable: path.to_string_lossy().to_string(),
                            cover_art: None,
                            icon,
                            platform: "Windows".to_string(),
                            category,
                            launch_type: crate::commands::LaunchType::Executable,
                        });
                    }
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn resolve_lnk_target(lnk_path: &PathBuf) -> Result<PathBuf, String> {
    // For .lnk files, we need to resolve the target
    // This is a simplified version - in production, use proper Windows Shell API
    // For now, try to read the target from the .lnk file or use the path as-is
    // Windows .lnk files are binary, so we'll use a workaround
    
    // Try to get the target using Windows API would be ideal, but for now
    // we'll check if there's a common pattern or use the shortcut name
    // In a real implementation, you'd use IShellLink COM interface
    
    // For now, return the lnk path itself - the launcher will handle it
    // Windows can execute .lnk files directly
    Ok(lnk_path.clone())
}

#[cfg(not(target_os = "windows"))]
fn resolve_lnk_target(lnk_path: &PathBuf) -> Result<PathBuf, String> {
    Ok(lnk_path.clone())
}

fn is_likely_game(name: &str, path: &PathBuf) -> bool {
    let name_lower = name.to_lowercase();
    let path_lower = path.to_string_lossy().to_lowercase();
    
    // Exclude common application patterns first
    let app_keywords = vec![
        "microsoft", "office", "word", "excel", "powerpoint", "outlook",
        "adobe", "photoshop", "illustrator", "premiere", "after effects",
        "chrome", "firefox", "edge", "browser", "explorer",
        "calculator", "notepad", "paint", "media player",
        "control panel", "settings", "system", "windows",
        "nvidia", "amd", "intel", "driver", "update",
        "discord", "slack", "teams", "zoom", "skype",
        "visual studio", "code", "editor", "ide",
        "git", "github", "docker", "vmware", "virtualbox",
    ];
    
    // If it matches app keywords, it's likely not a game
    for keyword in &app_keywords {
        if name_lower.contains(keyword) || path_lower.contains(keyword) {
            return false;
        }
    }
    
    // Common game-related keywords
    let game_keywords = vec![
        "game", "gaming", "steam", "epic", "gog", "origin", "uplay",
        "battle.net", "battlenet", "riot", "valorant", "league", "minecraft",
        "fortnite", "apex", "overwatch", "call of duty", "cod", "fifa",
        "nba", "nhl", "madden", "assassin", "assassins creed", "far cry", 
        "watch dogs", "cyberpunk", "witcher", "elder scrolls", "skyrim",
        "fallout", "gta", "grand theft auto", "red dead", "rockstar",
        "counter-strike", "csgo", "cs:go", "dota", "dota 2",
        "world of warcraft", "wow", "diablo", "starcraft",
        "elden ring", "dark souls", "sekiro", "bloodborne",
        "resident evil", "final fantasy", "persona", "zelda",
        "mario", "pokemon", "halo", "gears of war",
    ];
    
    // Check if name or path contains game keywords
    for keyword in &game_keywords {
        if name_lower.contains(keyword) || path_lower.contains(keyword) {
            return true;
        }
    }
    
    // Check common game directories
    let game_dirs = vec![
        "steam", "steamapps", "epic games", "epicgames", "games", "gaming", 
        "riot games", "riotgames", "ubisoft", "electronic arts", "ea games",
        "activision", "blizzard", "bethesda", "rockstar", "2k games",
        "square enix", "capcom", "bandai namco", "warner bros",
    ];
    
    for dir in &game_dirs {
        if path_lower.contains(dir) {
            return true;
        }
    }
    
    // Check file size - games are typically larger executables
    if let Ok(metadata) = std::fs::metadata(path) {
        let size_mb = metadata.len() / (1024 * 1024);
        // If executable is > 50MB, more likely to be a game
        if size_mb > 50 {
            return true;
        }
    }
    
    false
}

pub fn scan_epic_games() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
        let mut games = Vec::new();
        
        // Epic Games manifest locations (check multiple possible paths)
        let program_data = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
            format!(r"{}\AppData\Local", std::env::var("USERPROFILE").unwrap_or_default())
        });
        
        // Check registry for Epic Games installation
        let mut possible_manifest_paths = Vec::new();
        
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::*;
            use winreg::RegKey;
            
            // Check registry for Epic Games Launcher installation
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            
            // Try multiple registry paths
            let registry_paths = vec![
                r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher",
                r"SOFTWARE\Epic Games\EpicGamesLauncher",
            ];
            
            println!("Checking Epic Games registry keys...");
            for reg_path in &registry_paths {
                println!("  Checking registry: {}", reg_path);
                match hklm.open_subkey(reg_path) {
                    Ok(epic_key) => {
                        println!("    ✓ Registry key found");
                        // Try AppDataPath first
                        if let Ok(app_data_path) = epic_key.get_value::<String, _>("AppDataPath") {
                            println!("    Found AppDataPath: {}", app_data_path);
                            let app_data_path_buf = PathBuf::from(&app_data_path);
                            
                            // AppDataPath might already include "Data\" or might not
                            // Try both: AppDataPath\Manifests and AppDataPath\Data\Manifests
                            // AppDataPath might be "C:\ProgramData\Epic\EpicGamesLauncher\Data\" (with trailing backslash)
                            // or "C:\ProgramData\Epic\EpicGamesLauncher\Data" (without)
                            // Try both: AppDataPath\Manifests and AppDataPath\Data\Manifests
                            let manifest_path1 = app_data_path_buf.join("Manifests");
                            let manifest_path2 = app_data_path_buf.join("Data").join("Manifests");
                            
                            // Also try parent directory if AppDataPath ends with "Data"
                            let manifest_path3 = if app_data_path_buf.ends_with("Data") || app_data_path_buf.ends_with("Data\\") {
                                app_data_path_buf.parent().map(|p| p.join("Manifests"))
                            } else {
                                None
                            };
                            
                            if manifest_path1.exists() {
                                println!("Found Epic Games manifests via registry (AppDataPath/Manifests): {:?}", manifest_path1);
                                possible_manifest_paths.push(manifest_path1);
                            } else if let Some(ref path3) = manifest_path3 {
                                if path3.exists() {
                                    println!("Found Epic Games manifests via registry (parent of AppDataPath/Manifests): {:?}", path3);
                                    possible_manifest_paths.push(path3.clone());
                                } else if manifest_path2.exists() {
                                    println!("Found Epic Games manifests via registry (AppDataPath/Data/Manifests): {:?}", manifest_path2);
                                    possible_manifest_paths.push(manifest_path2);
                                } else {
                                    println!("    ✗ Manifests not found. Checked: {:?}, {:?}, {:?}", manifest_path1, manifest_path2, path3);
                                    // Check if the Data directory exists at all
                                    if app_data_path_buf.exists() {
                                        println!("    ℹ AppDataPath exists but Manifests folder not found. Epic Games may not have any games installed.");
                                    }
                                }
                            } else if manifest_path2.exists() {
                                println!("Found Epic Games manifests via registry (AppDataPath/Data/Manifests): {:?}", manifest_path2);
                                possible_manifest_paths.push(manifest_path2);
                            } else {
                                println!("    ✗ Manifests not found. Checked: {:?} and {:?}", manifest_path1, manifest_path2);
                                // Check if the Data directory exists at all
                                if app_data_path_buf.exists() {
                                    println!("    ℹ AppDataPath exists but Manifests folder not found. Epic Games may not have any games installed.");
                                }
                            }
                        } else {
                            println!("    ✗ AppDataPath not found in registry");
                        }
                        
                        // Also try InstallLocation
                        if let Ok(install_location) = epic_key.get_value::<String, _>("InstallLocation") {
                            println!("    Found InstallLocation: {}", install_location);
                            let manifest_path = PathBuf::from(&install_location).join("Data").join("Manifests");
                            if manifest_path.exists() {
                                println!("Found Epic Games manifests via registry (InstallLocation): {:?}", manifest_path);
                                possible_manifest_paths.push(manifest_path);
                            } else {
                                println!("    ✗ Manifests not found at InstallLocation");
                            }
                        } else {
                            println!("    ✗ InstallLocation not found in registry");
                        }
                    },
                    Err(e) => {
                        println!("    ✗ Registry key not found: {}", e);
                    }
                }
            }
            
            // Also check Uninstall registry for Epic Games Launcher
            let uninstall_path = r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall";
            if let Ok(uninstall_key) = hklm.open_subkey(uninstall_path) {
                for app_id_result in uninstall_key.enum_keys() {
                    if let Ok(app_id) = app_id_result {
                        if app_id.contains("EpicGamesLauncher") || app_id.contains("Epic Games") {
                            if let Ok(app_key) = uninstall_key.open_subkey(&app_id) {
                                if let Ok(install_location) = app_key.get_value::<String, _>("InstallLocation") {
                                    let manifest_path = PathBuf::from(&install_location).join("Data").join("Manifests");
                                    if manifest_path.exists() {
                                        println!("Found Epic Games manifests via Uninstall registry: {:?}", manifest_path);
                                        possible_manifest_paths.push(manifest_path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Add common paths
        possible_manifest_paths.extend(vec![
            PathBuf::from(&program_data).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests"),
            PathBuf::from(&local_app_data).join("EpicGamesLauncher").join("Data").join("Manifests"),
            PathBuf::from(&program_data).join("Epic").join("EpicGamesLauncher").join("Manifests"),
        ]);
        
        let mut manifests_path = None;
        for path in &possible_manifest_paths {
            println!("Checking Epic Games manifests at: {:?}", path);
            if path.exists() {
                // Check if the directory is empty (no games installed)
                if let Ok(entries) = std::fs::read_dir(path) {
                    let count = entries.count();
                    if count == 0 {
                        println!("  ℹ Manifests folder exists but is empty (no games installed)");
                        return games; // Return empty list, but this is a valid state
                    }
                }
                println!("Found Epic Games manifests at: {:?}", path);
                manifests_path = Some(path.clone());
                break;
            }
        }
        
        let manifests_path = match manifests_path {
            Some(p) => p,
            None => {
                println!("Epic Games manifests path does not exist in any known location");
                println!("  ℹ This could mean Epic Games Launcher is not installed, or no games are installed");
                return games;
            }
        };
        
        // Scan for .item files (Epic manifest files)
        match std::fs::read_dir(&manifests_path) {
            Ok(entries) => {
                let mut item_count = 0;
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension() {
                        if ext == "item" {
                            item_count += 1;
                            match parse_epic_manifest(&path) {
                                Ok(game) => {
                                    println!("  ✓ Found Epic game: {}", game.name);
                                    games.push(game);
                                },
                                Err(e) => {
                                    println!("  ✗ Failed to parse {}: {}", path.display(), e);
                                }
                            }
                        }
                    }
                }
                println!("Epic Games scan: found {} .item files, {} valid games", item_count, games.len());
            },
            Err(e) => {
                println!("Failed to read Epic Games manifests directory: {}", e);
            }
        }
        
        games
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

fn parse_epic_manifest(path: &PathBuf) -> Result<crate::commands::Game, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read Epic manifest: {}", e))?;
    
    let json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Epic manifest JSON: {}", e))?;
    
    // Extract required fields
    let catalog_item_id = json["CatalogItemId"]
        .as_str()
        .ok_or("Missing CatalogItemId")?
        .to_string();
    
    let display_name = json["DisplayName"]
        .as_str()
        .ok_or("Missing DisplayName")?
        .to_string();
    
    let install_location = json["InstallLocation"]
        .as_str()
        .ok_or("Missing InstallLocation")?
        .to_string();
    
    // Check if installation is incomplete
    if json["bIsIncompleteInstall"].as_bool().unwrap_or(false) {
        return Err("Game installation is incomplete".to_string());
    }
    
    // Get launch executable
    let launch_executable = json["LaunchExecutable"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    let install_path = PathBuf::from(&install_location);
    if !install_path.exists() {
        return Err("Install location does not exist".to_string());
    }
    
    // Build executable path
    let executable = if !launch_executable.is_empty() {
        install_path.join(&launch_executable)
    } else {
        // Try to find executable in install directory
        find_executable(&install_path).unwrap_or_else(|_| {
            install_path.join("game.exe")
        })
    };
    
    // Filter out non-game applications
    let empty_array: Vec<Value> = Vec::new();
    let app_categories = json["AppCategories"].as_array().unwrap_or(&empty_array);
    let is_game = app_categories.iter().any(|cat| {
        if let Some(cat_str) = cat.as_str() {
            cat_str.contains("games") || cat_str.contains("Games")
        } else {
            false
        }
    });
    
    // If no category info, assume it's a game if it has a launch executable
    let category = if is_game || !launch_executable.is_empty() {
        Category::Game
    } else {
        Category::App
    };
    
    Ok(Game {
        id: catalog_item_id.clone(),
        name: display_name,
        path: install_location,
        executable: executable.to_string_lossy().to_string(),
        cover_art: None, // Epic doesn't provide easy cover art URLs
        icon: None,
        platform: "Epic Games".to_string(),
        category,
        launch_type: crate::commands::LaunchType::Epic,
    })
}

pub fn scan_gog_games() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
        let mut games = Vec::new();
        
        // GOG Galaxy database location - check multiple possible paths
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
            format!(r"{}\AppData\Local", std::env::var("USERPROFILE").unwrap_or_default())
        });
        let app_data = std::env::var("APPDATA").unwrap_or_else(|_| {
            format!(r"{}\AppData\Roaming", std::env::var("USERPROFILE").unwrap_or_default())
        });
        
        // Check registry for GOG Galaxy installation
        let mut possible_db_paths = Vec::new();
        
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::*;
            use winreg::RegKey;
            
            // Check registry for GOG Galaxy installation
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            
            // Try multiple registry paths for GOG
            let gog_registry_paths = vec![
                r"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths",
                r"SOFTWARE\GOG.com\GalaxyClient\paths",
            ];
            
            println!("Checking GOG Galaxy registry keys...");
            for reg_path in &gog_registry_paths {
                println!("  Checking registry: {}", reg_path);
                match hklm.open_subkey(reg_path) {
                    Ok(gog_key) => {
                        println!("    ✓ Registry key found");
                        // Try "client" key
                        if let Ok(client_path) = gog_key.get_value::<String, _>("client") {
                            println!("    Found client path: {}", client_path);
                            // The database is ALWAYS in AppData, not in the client installation directory
                            // The client path is just where GOG Galaxy is installed, but data is in AppData
                            // So we check AppData locations (this is where the database actually is)
                            
                            println!("    Checking AppData locations for database (database is in AppData, not installation dir)...");
                            let appdata_db_paths = vec![
                                PathBuf::from(&local_app_data).join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db"),
                                PathBuf::from(&app_data).join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db"),
                            ];
                            
                            for db_path in &appdata_db_paths {
                                if db_path.exists() {
                                    println!("Found GOG database in AppData: {:?}", db_path);
                                    possible_db_paths.push(db_path.clone());
                                } else {
                                    println!("    ✗ Database not found at: {:?}", db_path);
                                    // Check if the parent directory exists (might give us a clue)
                                    if let Some(parent) = db_path.parent() {
                                        if parent.exists() {
                                            println!("    ℹ Parent directory exists: {:?}", parent);
                                            // List files in storage directory to help debug
                                            if let Ok(entries) = std::fs::read_dir(parent) {
                                                let files: Vec<_> = entries.filter_map(|e| e.ok()).collect();
                                                if !files.is_empty() {
                                                    println!("    ℹ Found {} items in storage directory", files.len());
                                                    for entry in files.iter().take(5) {
                                                        if let Some(name) = entry.file_name().to_str() {
                                                            println!("      - {}", name);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Also check if there's a database in the client installation directory (uncommon but possible)
                            let client_db_path = PathBuf::from(&client_path).parent()
                                .map(|p| p.join("storage").join("galaxy-2.0.db"));
                            if let Some(ref db_path) = client_db_path {
                                if db_path.exists() {
                                    println!("Found GOG database in client installation directory: {:?}", db_path);
                                    possible_db_paths.push(db_path.clone());
                                }
                            }
                        } else {
                            println!("    ✗ 'client' key not found in registry");
                        }
                        
                        // Try "galaxyClient" key (alternative name)
                        if let Ok(galaxy_path) = gog_key.get_value::<String, _>("galaxyClient") {
                            println!("    Found galaxyClient path: {}", galaxy_path);
                            if let Some(galaxy_dir) = PathBuf::from(&galaxy_path).parent() {
                                let db_path = galaxy_dir.join("storage").join("galaxy-2.0.db");
                                if db_path.exists() {
                                    println!("Found GOG database via registry (galaxyClient path): {:?}", db_path);
                                    possible_db_paths.push(db_path);
                                } else {
                                    println!("    ✗ Database not found at galaxyClient path");
                                }
                            }
                        } else {
                            println!("    ✗ 'galaxyClient' key not found in registry");
                        }
                    },
                    Err(e) => {
                        println!("    ✗ Registry key not found: {}", e);
                    }
                }
            }
            
            // Also check Uninstall registry for GOG Galaxy
            let uninstall_path = r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall";
            if let Ok(uninstall_key) = hklm.open_subkey(uninstall_path) {
                for app_id_result in uninstall_key.enum_keys() {
                    if let Ok(app_id) = app_id_result {
                        if app_id.contains("GOG") || app_id.contains("Galaxy") {
                            if let Ok(app_key) = uninstall_key.open_subkey(&app_id) {
                                if let Ok(install_location) = app_key.get_value::<String, _>("InstallLocation") {
                                    // Try storage in install location
                                    let db_path = PathBuf::from(&install_location).join("storage").join("galaxy-2.0.db");
                                    if db_path.exists() {
                                        println!("Found GOG database via Uninstall registry: {:?}", db_path);
                                        possible_db_paths.push(db_path);
                                    }
                                    // Also try in AppData (standard location)
                                    let db_path = PathBuf::from(&local_app_data).join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db");
                                    if db_path.exists() {
                                        println!("Found GOG database via Uninstall registry (AppData): {:?}", db_path);
                                        possible_db_paths.push(db_path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Add common paths
        possible_db_paths.extend(vec![
            PathBuf::from(&local_app_data).join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db"),
            PathBuf::from(&app_data).join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db"),
            PathBuf::from(&local_app_data).join("GOG Galaxy").join("storage").join("galaxy-2.0.db"),
        ]);
        
        // Find the first existing database
        let db_path = possible_db_paths.iter().find(|p| p.exists());
        
        let db_path = match db_path {
            Some(p) => {
                println!("Scanning GOG games from database: {:?}", p);
                p.clone()
            },
            None => {
                println!("GOG Galaxy database not found in any known location. Checked:");
                for path in &possible_db_paths {
                    println!("  - {:?}", path);
                }
                println!("  ℹ This could mean GOG Galaxy is not installed, not logged in, or database is in a non-standard location");
                return games;
            }
        };
        
        // Open database connection
        match rusqlite::Connection::open(&db_path) {
            Ok(conn) => {
                println!("Opened GOG database, querying for installed games...");
                // Query for installed games
                // GOG database structure: GamePieces contains game info, LocalGamePieces has installation paths
                let query = r#"
                    SELECT DISTINCT
                        gp.value as game_id,
                        gp2.value as game_title,
                        lgp.value as install_path
                    FROM GamePieces gp
                    JOIN GamePieces gp2 ON gp.gameReleaseKey = gp2.gameReleaseKey AND gp2.key = 'title'
                    JOIN LocalGamePieces lgp ON gp.gameReleaseKey = lgp.gameReleaseKey
                    WHERE gp.key = 'gameId'
                    AND lgp.key = 'path'
                    AND lgp.value IS NOT NULL
                    AND lgp.value != ''
                "#;
                
                match conn.prepare(query) {
                    Ok(mut stmt) => {
                        let rows_result = stmt.query_map([], |row| {
                            Ok((
                                row.get::<_, String>(0)?, // game_id
                                row.get::<_, String>(1)?, // game_title
                                row.get::<_, String>(2)?, // install_path
                            ))
                        });
                        
                        match rows_result {
                            Ok(rows) => {
                                let mut row_count = 0;
                                for row_result in rows {
                                    row_count += 1;
                                    match row_result {
                                        Ok((game_id, game_title, install_path)) => {
                                            let install_path_buf = PathBuf::from(&install_path);
                                            if install_path_buf.exists() {
                                                // Try to find executable
                                                let executable = find_executable(&install_path_buf)
                                                    .unwrap_or_else(|_| {
                                                        install_path_buf.join("game.exe")
                                                    });
                                                
                                                println!("  ✓ Found GOG game: {} at {:?}", game_title, install_path);
                                                games.push(Game {
                                                    id: game_id.clone(),
                                                    name: game_title,
                                                    path: install_path,
                                                    executable: executable.to_string_lossy().to_string(),
                                                    cover_art: None,
                                                    icon: None,
                                                    platform: "GOG".to_string(),
                                                    category: Category::Game,
                                                    launch_type: crate::commands::LaunchType::Gog,
                                                });
                                            } else {
                                                println!("  ✗ Install path does not exist: {:?}", install_path);
                                            }
                                        },
                                        Err(e) => {
                                            println!("  ✗ Failed to read row: {}", e);
                                        }
                                    }
                                }
                                println!("GOG scan: processed {} rows, found {} valid games", row_count, games.len());
                            },
                            Err(e) => {
                                println!("Failed to execute GOG query: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        println!("Failed to prepare GOG query: {}", e);
                        // Database might be locked or schema different, try alternative query
                        // This is a fallback for different GOG Galaxy versions
                    }
                }
            }
            Err(e) => {
                println!("Failed to open GOG database: {}", e);
                // Database might be locked (GOG Galaxy is running) or doesn't exist
            }
        }
        
        println!("GOG scan completed: found {} games", games.len());
        
        games
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

pub fn scan_ubisoft_games() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
        let mut games = Vec::new();
        
        use winreg::enums::*;
        use winreg::RegKey;
        
        // Try to read from registry
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let ubisoft_path = r"SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs";
        
        if let Ok(installs_key) = hklm.open_subkey(ubisoft_path) {
            // Enumerate all game IDs
            for game_id_result in installs_key.enum_keys() {
                if let Ok(game_id) = game_id_result {
                    if let Ok(game_key) = installs_key.open_subkey(&game_id) {
                        // Try to get installation path
                        if let Ok(install_dir) = game_key.get_value::<String, _>("InstallDir") {
                            let install_path = PathBuf::from(&install_dir);
                            if install_path.exists() {
                                // Try to get game name from registry or manifest
                                let game_name = game_key.get_value::<String, _>("Name")
                                    .unwrap_or_else(|_| game_id.clone());
                                
                                // Try to find executable
                                let executable = find_executable(&install_path)
                                    .unwrap_or_else(|_| {
                                        install_path.join("game.exe")
                                    });
                                
                                // Check manifest file for more info
                                let program_data = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
                                let manifest_path = PathBuf::from(&program_data)
                                    .join("Ubisoft")
                                    .join("GameLauncher")
                                    .join("games")
                                    .join(&game_id)
                                    .join("manifest.json");
                                
                                let final_name = if manifest_path.exists() {
                                    if let Ok(manifest_content) = std::fs::read_to_string(&manifest_path) {
                                        if let Ok(manifest_json) = serde_json::from_str::<Value>(&manifest_content) {
                                            manifest_json["name"]
                                                .as_str()
                                                .map(|s| s.to_string())
                                                .unwrap_or(game_name)
                                        } else {
                                            game_name
                                        }
                                    } else {
                                        game_name
                                    }
                                } else {
                                    game_name
                                };
                                
                                games.push(Game {
                                    id: game_id.clone(),
                                    name: final_name,
                                    path: install_dir,
                                    executable: executable.to_string_lossy().to_string(),
                                    cover_art: None,
                                    icon: None,
                                    platform: "Ubisoft Connect".to_string(),
                                    category: Category::Game,
                                    launch_type: crate::commands::LaunchType::Ubisoft,
                                });
                            }
                        }
                    }
                }
            }
        }
        
        games
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

pub fn scan_xbox_games() -> Vec<crate::commands::Game> {
    #[cfg(target_os = "windows")]
    {
        let mut games = Vec::new();
        
        use winreg::enums::*;
        use winreg::RegKey;
        
        // Scan registry for Microsoft Store / Xbox Game Pass games
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let uninstall_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
        
        if let Ok(uninstall_key) = hkcu.open_subkey(uninstall_path) {
            for app_id_result in uninstall_key.enum_keys() {
                if let Ok(app_id) = app_id_result {
                    if let Ok(app_key) = uninstall_key.open_subkey(&app_id) {
                        // Check if it's a Microsoft Store / Xbox game
                        // Look for Publisher = "Microsoft Corporation" and specific patterns
                        if let Ok(publisher) = app_key.get_value::<String, _>("Publisher") {
                            if publisher.contains("Microsoft Corporation") || 
                               publisher.contains("Xbox") ||
                               app_id.starts_with("Microsoft.") ||
                               app_id.starts_with("Xbox.") {
                                
                                // Get display name
                                if let Ok(display_name) = app_key.get_value::<String, _>("DisplayName") {
                                    // Skip system apps and non-games
                                    let name_lower = display_name.to_lowercase();
                                    if name_lower.contains("microsoft store") ||
                                       name_lower.contains("xbox app") ||
                                       name_lower.contains("xbox game bar") ||
                                       name_lower.contains("settings") ||
                                       name_lower.contains("calculator") {
                                        continue;
                                    }
                                    
                                    // Try to get installation path
                                    let install_location = app_key.get_value::<String, _>("InstallLocation")
                                        .or_else(|_| app_key.get_value::<String, _>("InstallPath"))
                                        .ok();
                                    
                                    // For AppX packages, try WindowsApps directory
                                    let executable_path = if let Some(location) = &install_location {
                                        PathBuf::from(location)
                                    } else {
                                        // Try WindowsApps directory
                                        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
                                            format!(r"{}\AppData\Local", std::env::var("USERPROFILE").unwrap_or_default())
                                        });
                                        PathBuf::from(&local_app_data)
                                            .join("Microsoft")
                                            .join("WindowsApps")
                                            .join(format!("{}.exe", app_id))
                                    };
                                    
                                    // Check if executable exists or if it's an AppX package
                                    if executable_path.exists() || install_location.is_some() {
                                        // Use ProductId if available, otherwise use app_id
                                        let product_id = app_key.get_value::<String, _>("ProductId")
                                            .unwrap_or_else(|_| app_id.clone());
                                        
                                        games.push(Game {
                                            id: product_id.clone(),
                                            name: display_name,
                                            path: install_location.unwrap_or_else(|| {
                                                executable_path.parent()
                                                    .map(|p| p.to_string_lossy().to_string())
                                                    .unwrap_or_default()
                                            }),
                                            executable: if executable_path.exists() {
                                                executable_path.to_string_lossy().to_string()
                                            } else {
                                                format!("ms-windows-store://pdp/?ProductId={}", product_id)
                                            },
                                            cover_art: None,
                                            icon: None,
                                            platform: "Xbox".to_string(),
                                            category: Category::Game,
                                            launch_type: crate::commands::LaunchType::Xbox,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        games
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        vec![]
    }
}

