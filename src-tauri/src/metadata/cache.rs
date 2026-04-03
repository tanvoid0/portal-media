use rusqlite::{params, Connection};
use tauri::AppHandle;
use tauri::Manager;

const CACHE_TTL_SECS: i64 = 30 * 86400;

pub fn open_cache_db(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db_path = dir.join("portal_metadata_cache.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS metadata_cache (
            cache_key TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            payload TEXT NOT NULL,
            fetched_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_metadata_cache_provider ON metadata_cache(provider);
        "#,
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn cache_get(
    conn: &Connection,
    cache_key: &str,
) -> Result<Option<(String, i64)>, String> {
    let mut stmt = conn
        .prepare("SELECT payload, fetched_at FROM metadata_cache WHERE cache_key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![cache_key], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(v)) => Ok(Some(v)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

pub fn cache_is_fresh(fetched_at: i64) -> bool {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    now - fetched_at < CACHE_TTL_SECS
}

pub fn cache_set(
    conn: &Connection,
    cache_key: &str,
    provider: &str,
    payload: &str,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    conn.execute(
        r#"INSERT INTO metadata_cache (cache_key, provider, payload, fetched_at)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(cache_key) DO UPDATE SET
             provider = excluded.provider,
             payload = excluded.payload,
             fetched_at = excluded.fetched_at"#,
        params![cache_key, provider, payload, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn cache_clear_all(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM metadata_cache", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn cache_key_igdb(game: &crate::commands::Game) -> String {
    use crate::commands::LaunchType;
    match game.launch_type {
        LaunchType::Steam => format!("igdb:steam:{}", game.id),
        LaunchType::Epic => format!("igdb:epic:{}", game.id),
        LaunchType::Gog => format!("igdb:gog:{}", game.id),
        _ => {
            let norm: String = game
                .name
                .chars()
                .filter(|c| !c.is_control())
                .collect::<String>()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .to_lowercase();
            format!(
                "igdb:search:{}:{}",
                game.platform.to_lowercase().replace(' ', "_"),
                norm
            )
        }
    }
}
