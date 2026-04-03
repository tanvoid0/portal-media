//! Locally persisted library rows (manual adds: exes, shortcuts, URLs). Merged with `scan_games` into one list.
use crate::commands::{Category, Game, LaunchType};
use crate::library_cache;
use rusqlite::{params, Connection};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;
use url::Url;

const TABLE: &str = "library_entries_manual";

const MAX_NAME_LEN: usize = 200;

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let dir = app_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db_path = dir.join("portal_library.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(&format!(
        r#"CREATE TABLE IF NOT EXISTS {TABLE} (
            id TEXT PRIMARY KEY,
            json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_library_manual_created ON {TABLE}(created_at);"#,
    ))
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn new_manual_entry_id() -> String {
    format!(
        "saved_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    )
}

fn trim_nonempty_name(name: &str) -> Result<String, String> {
    let t = name.trim();
    if t.is_empty() {
        return Err("Name is required.".into());
    }
    if t.len() > MAX_NAME_LEN {
        return Err(format!("Name is too long (max {MAX_NAME_LEN} characters)."));
    }
    Ok(t.into())
}

fn validate_url(raw: &str) -> Result<Url, String> {
    let u = Url::parse(raw.trim()).map_err(|_| "Enter a valid URL.".to_string())?;
    match u.scheme() {
        "http" | "https" => Ok(u),
        "riotgames" | "steam" => Ok(u),
        _ => Err("URL must use http, https, steam, or riotgames.".into()),
    }
}

fn favicon_for_url(u: &Url) -> Option<String> {
    let host = u.host_str()?;
    if host.is_empty() {
        return None;
    }
    Some(format!(
        "https://www.google.com/s2/favicons?domain={}&sz=256",
        host
    ))
}

fn validate_executable_category(c: &Category) -> Result<(), String> {
    match c {
        Category::Game | Category::App => Ok(()),
        Category::Media | Category::Bookmark => Err(
            "Games and desktop apps must use category Game or App.".into(),
        ),
    }
}

fn validate_web_category(c: &Category) -> Result<(), String> {
    match c {
        Category::Media | Category::Bookmark => Ok(()),
        Category::Game | Category::App => {
            Err("Web and streaming links must use category Media or Bookmark.".into())
        }
    }
}

#[cfg(target_os = "windows")]
fn canonical_target_path(target: &str) -> Result<PathBuf, String> {
    let p = Path::new(target.trim());
    if !p.exists() {
        return Err("File or shortcut does not exist. Check the path.".into());
    }
    let ext_ok = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let e = e.to_lowercase();
            e == "exe" || e == "lnk" || e == "url"
        })
        .unwrap_or(false);
    if !ext_ok {
        return Err("Desktop entries must be a .exe, .lnk, or .url file.".into());
    }
    p.canonicalize()
        .map_err(|_| "Could not resolve that path. It may be inaccessible.".into())
}

#[cfg(not(target_os = "windows"))]
fn canonical_target_path(target: &str) -> Result<PathBuf, String> {
    let p = Path::new(target.trim());
    if !p.exists() {
        return Err("Path does not exist.".into());
    }
    Ok(p.to_path_buf())
}

/// Stored `path` field matches game_scanner conventions (directory used by launch_game cwd logic).
fn path_fields_for_executable(target: &Path) -> Result<(String, String), String> {
    let executable = target.to_string_lossy().to_string();
    let parent = target.parent().ok_or("Invalid target path (no parent directory).")?;
    let path = parent.to_string_lossy().to_string();
    Ok((path, executable))
}

fn icon_for_target(app: &AppHandle, target: &Path) -> Option<String> {
    if target.extension().and_then(|s| s.to_str()).map(|e| e.eq_ignore_ascii_case("exe")) == Some(true)
        || target.extension().and_then(|s| s.to_str()).map(|e| e.eq_ignore_ascii_case("lnk")) == Some(true)
    {
        library_cache::ensure_cached_icon_png(app, target)
    } else {
        None
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
pub enum LibraryManualAdd {
    #[serde(rename = "executable")]
    Executable {
        name: String,
        category: Category,
        /// Full path to .exe, .lnk (shell shortcut), or .url (internet shortcut)
        #[serde(rename = "targetPath", alias = "target_path")]
        target_path: String,
    },
    #[serde(rename = "web")]
    Web {
        name: String,
        category: Category,
        url: String,
    },
}

fn insert_game(conn: &Connection, game: &Game) -> Result<(), String> {
    let json = serde_json::to_string(game).map_err(|e| e.to_string())?;
    conn.execute(
        &format!("INSERT INTO {TABLE} (id, json, created_at) VALUES (?1, ?2, ?3)"),
        params![game.id, json, now_secs()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn library_manual_add_impl(app: &AppHandle, add: LibraryManualAdd) -> Result<Game, String> {
    let conn = open_conn(app)?;

    let game = match add {
        LibraryManualAdd::Executable {
            name,
            category,
            target_path,
        } => {
            validate_executable_category(&category)?;
            let name = trim_nonempty_name(&name)?;
            let target = canonical_target_path(&target_path)?;
            let (path, executable) = path_fields_for_executable(&target)?;
            let icon = icon_for_target(app, &target);
            Game {
                id: new_manual_entry_id(),
                name,
                path,
                executable,
                cover_art: None,
                icon,
                platform: "Windows".to_string(),
                category,
                launch_type: LaunchType::Executable,
            }
        }
        LibraryManualAdd::Web {
            name,
            category,
            url,
        } => {
            validate_web_category(&category)?;
            let name = trim_nonempty_name(&name)?;
            let u = validate_url(&url)?;
            let href = u.as_str().trim().to_string();
            let icon = favicon_for_url(&u);
            Game {
                id: new_manual_entry_id(),
                name,
                path: href.clone(),
                executable: href,
                cover_art: None,
                icon,
                platform: "Web".to_string(),
                category,
                launch_type: LaunchType::Url,
            }
        }
    };

    insert_game(&conn, &game)?;
    Ok(game)
}

/// Rows persisted from “Add to library”; merged into `scan_games` so callers see one list.
pub fn load_manual_entries(app: &AppHandle) -> Result<Vec<Game>, String> {
    let conn = open_conn(app)?;
    let sql = format!("SELECT json FROM {TABLE} ORDER BY created_at ASC");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let j: String = row.get(0).map_err(|e| e.to_string())?;
        let g: Game = serde_json::from_str(&j).map_err(|e| e.to_string())?;
        out.push(g);
    }
    Ok(out)
}

#[tauri::command]
pub fn library_manual_add(app: AppHandle, add: LibraryManualAdd) -> Result<Game, String> {
    library_manual_add_impl(&app, add)
}
