use super::types::SaveBundle;
use crate::commands::{Game, LaunchType};
use crate::game_scanner;
use sha2::{Digest, Sha256};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

fn now_utc() -> i64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn bundle_id(game_id: &str, path: &Path) -> String {
    let mut h = DefaultHasher::new();
    game_id.hash(&mut h);
    path.to_string_lossy().hash(&mut h);
    format!("{:016x}", h.finish())
}

pub fn file_meta_public(path: &Path) -> Result<(i64, u64, String), String> {
    file_meta(path)
}

fn file_meta(path: &Path) -> Result<(i64, u64, String), String> {
    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(now_utc());
    let size = meta.len();
    let sha = hash_path(path)?;
    Ok((modified, size, sha))
}

fn hash_path(path: &Path) -> Result<String, String> {
    if path.is_file() {
        return hash_file(path);
    }
    if path.is_dir() {
        let mut entries: Vec<PathBuf> = Vec::new();
        collect_files(path, &mut entries)?;
        entries.sort();
        let mut hasher = Sha256::new();
        for p in entries {
            hasher.update(p.to_string_lossy().as_bytes());
            let data = std::fs::read(&p).map_err(|e| e.to_string())?;
            hasher.update(&data);
        }
        return Ok(hex::encode(hasher.finalize()));
    }
    Err(format!("Path not found: {}", path.display()))
}

fn hash_file(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_dir() {
            collect_files(&p, out)?;
        } else if p.is_file() {
            out.push(p);
        }
    }
    Ok(())
}

fn push_bundle(
    out: &mut Vec<SaveBundle>,
    game: &Game,
    label: &str,
    path: PathBuf,
) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let (modified_utc, size_bytes, sha256) = file_meta(&path)?;
    let id = bundle_id(&game.id, &path);
    out.push(SaveBundle {
        bundle_id: id,
        game_id: game.id.clone(),
        game_name: game.name.clone(),
        platform: game.platform.clone(),
        label: label.to_string(),
        local_path: path.to_string_lossy().to_string(),
        modified_utc,
        size_bytes,
        sha256,
    });
    Ok(())
}

fn steam_userdata_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(steam_id) = game_scanner::get_steam_user_id() {
        let candidates = [
            PathBuf::from(format!(
                r"{}\Steam\userdata\{}",
                std::env::var("PROGRAMFILES(X86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into()),
                steam_id
            )),
            PathBuf::from(format!(
                r"{}\Steam\userdata\{}",
                std::env::var("LOCALAPPDATA").unwrap_or_default(),
                steam_id
            )),
        ];
        for c in candidates {
            if c.is_dir() {
                roots.push(c);
            }
        }
    }
    roots
}

fn discover_steam(game: &Game, out: &mut Vec<SaveBundle>) -> Result<(), String> {
    let appid = game.id.trim();
    if appid.is_empty() {
        return Ok(());
    }
    for root in steam_userdata_roots() {
        let remote = root.join(appid).join("remote");
        if remote.is_dir() {
            push_bundle(out, game, "Steam cloud saves (local cache)", remote)?;
        }
    }
    Ok(())
}

fn discover_documents(game: &Game, out: &mut Vec<SaveBundle>) -> Result<(), String> {
    let docs = std::env::var("USERPROFILE")
        .ok()
        .map(|p| PathBuf::from(p).join("Documents"))
        .filter(|p| p.is_dir());
    let Some(docs) = docs else {
        return Ok(());
    };
    let my_games = docs.join("My Games");
    if !my_games.is_dir() {
        return Ok(());
    }
    let slug = sanitize_folder_name(&game.name);
    for entry in std::fs::read_dir(&my_games).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();
        if name.contains(&slug) || slug.len() > 3 && name.contains(slug.as_str()) {
            push_bundle(out, game, "Documents / My Games", p)?;
        }
    }
    Ok(())
}

fn discover_install_dir(game: &Game, out: &mut Vec<SaveBundle>) -> Result<(), String> {
    let base = PathBuf::from(&game.path);
    if !base.exists() {
        return Ok(());
    }
    const SAVE_DIR_NAMES: &[&str] = &[
        "Saved",
        "SaveGames",
        "saves",
        "save",
        "Save Data",
        "SaveData",
    ];
    let search_roots: Vec<PathBuf> = if base.is_dir() {
        vec![base.clone()]
    } else {
        base.parent().map(|p| p.to_path_buf()).into_iter().collect()
    };
    for root in search_roots {
        for name in SAVE_DIR_NAMES {
            let candidate = root.join(name);
            if candidate.is_dir() {
                push_bundle(out, game, &format!("Install / {name}"), candidate)?;
            }
        }
    }
    Ok(())
}

fn sanitize_folder_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn discover_for_games(games: &[Game]) -> Result<Vec<SaveBundle>, String> {
    let mut out = Vec::new();
    for game in games {
        if game.category != crate::commands::Category::Game {
            continue;
        }
        if matches!(game.launch_type, LaunchType::Url) {
            continue;
        }
        if game.launch_type == LaunchType::Steam {
            discover_steam(game, &mut out)?;
        }
        discover_documents(game, &mut out)?;
        discover_install_dir(game, &mut out)?;
    }
    out.sort_by(|a, b| a.game_name.cmp(&b.game_name).then(a.label.cmp(&b.label)));
    out.dedup_by(|a, b| a.bundle_id == b.bundle_id);
    Ok(out)
}

// hex helper without extra dep — use format macro on hasher output
mod hex {
    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        bytes
            .as_ref()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }
}
