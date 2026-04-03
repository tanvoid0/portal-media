use serde::Serialize;
use tauri::AppHandle;

use crate::commands::{Category, Game};
use crate::metadata::cache;
use crate::metadata::igdb::{self, IgdbDiscoverHit, IgdbGamePayload};
use crate::metadata::secrets;
use crate::metadata::tmdb::{self, TmdbDetailPayload, TmdbDiscoverPayload, TmdbProviderRow, TmdbSearchHit};

/// Reject oversized payloads from the UI (defense in depth; values should be short tokens).
const MAX_SECRET_UTF8_BYTES: usize = 8192;

fn ensure_secret_size(label: &str, value: &str) -> Result<(), String> {
    if value.len() > MAX_SECRET_UTF8_BYTES {
        return Err(format!(
            "{label} is too long (max {MAX_SECRET_UTF8_BYTES} UTF-8 bytes)."
        ));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub igdb_configured: bool,
    pub tmdb_configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum IgdbFetchResult {
    NotConfigured,
    Skipped { reason: String },
    Cached { payload: IgdbGamePayload },
    Fresh { payload: IgdbGamePayload },
    NotFound,
    Error { message: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub fn metadata_get_provider_status() -> ProviderStatus {
    ProviderStatus {
        igdb_configured: secrets::igdb_configured(),
        tmdb_configured: secrets::tmdb_configured(),
    }
}

#[tauri::command]
pub fn metadata_save_igdb_credentials(
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let id = client_id.trim();
    let secret = client_secret.trim();
    if id.is_empty() || secret.is_empty() {
        return Err(
            "Twitch Client ID and Secret must be non-empty. Paste again and save.".into(),
        );
    }
    ensure_secret_size("Twitch Client ID", id)?;
    ensure_secret_size("Twitch Client Secret", secret)?;
    secrets::save_igdb_credentials(id, secret)?;
    if !secrets::igdb_configured() {
        return Err(
            "Credentials were written but could not be read back. Check OS storage permissions."
                .into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn metadata_clear_igdb_credentials() -> Result<(), String> {
    secrets::clear_igdb_credentials()
}

#[tauri::command]
pub fn metadata_save_tmdb_api_key(api_key: String) -> Result<(), String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(
            "No TMDB API key was received (empty). Paste your v3 key and try Save again.".into(),
        );
    }
    ensure_secret_size("TMDB API key", key)?;
    secrets::save_tmdb_api_key(key)?;
    if !secrets::tmdb_configured() {
        secrets::diagnose_tmdb_entry_after_failed_verify(key.chars().count());
        return Err(
            "Saved the TMDB key but verification failed (nothing readable from the vault or app-data mirror). \
             Check writes to %APPDATA%\\com.tanvoid0.portal-media\\ and set PORTAL_MEDIA_DEBUG_SECRETS=1 \
             when launching from a terminal for logs."
                .into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn metadata_clear_tmdb_api_key() -> Result<(), String> {
    secrets::clear_tmdb_api_key()
}

#[tauri::command]
pub async fn metadata_test_igdb() -> Result<TestResult, String> {
    let Some((id, secret)) = secrets::get_igdb_credentials() else {
        return Ok(TestResult {
            ok: false,
            message: "IGDB is not configured (add Twitch Client ID and Secret).".into(),
        });
    };
    match igdb::test_igdb_connection(&id, &secret).await {
        Ok(msg) => Ok(TestResult { ok: true, message: msg }),
        Err(e) => Ok(TestResult { ok: false, message: e }),
    }
}

#[tauri::command]
pub async fn metadata_test_tmdb() -> Result<TestResult, String> {
    let Some(key) = secrets::get_tmdb_api_key() else {
        return Ok(TestResult {
            ok: false,
            message: "TMDB is not configured (add an API key).".into(),
        });
    };
    match tmdb::test_tmdb(&key).await {
        Ok(msg) => Ok(TestResult { ok: true, message: msg }),
        Err(e) => Ok(TestResult { ok: false, message: e }),
    }
}

/// Test the key from the settings input without persisting (or before Save).
#[tauri::command]
pub async fn metadata_test_tmdb_key(api_key: String) -> Result<TestResult, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Ok(TestResult {
            ok: false,
            message: "Paste your TMDB API v3 key in the field, then click Test or Save.".into(),
        });
    }
    if let Err(e) = ensure_secret_size("TMDB API key", key) {
        return Ok(TestResult {
            ok: false,
            message: e,
        });
    }
    match tmdb::test_tmdb(key).await {
        Ok(msg) => Ok(TestResult { ok: true, message: msg }),
        Err(e) => Ok(TestResult { ok: false, message: e }),
    }
}

/// Test Twitch/IGDB credentials from the form fields without saving.
#[tauri::command]
pub async fn metadata_test_igdb_credentials(
    client_id: String,
    client_secret: String,
) -> Result<TestResult, String> {
    let id = client_id.trim();
    let secret = client_secret.trim();
    if id.is_empty() || secret.is_empty() {
        return Ok(TestResult {
            ok: false,
            message: "Enter Twitch Client ID and Client Secret in the fields, or save them first."
                .into(),
        });
    }
    if let Err(e) = ensure_secret_size("Twitch Client ID", id) {
        return Ok(TestResult {
            ok: false,
            message: e,
        });
    }
    if let Err(e) = ensure_secret_size("Twitch Client Secret", secret) {
        return Ok(TestResult {
            ok: false,
            message: e,
        });
    }
    match igdb::test_igdb_connection(id, secret).await {
        Ok(msg) => Ok(TestResult { ok: true, message: msg }),
        Err(e) => Ok(TestResult { ok: false, message: e }),
    }
}

#[tauri::command]
pub fn metadata_clear_cache(app: AppHandle) -> Result<(), String> {
    let conn = cache::open_cache_db(&app)?;
    cache::cache_clear_all(&conn)
}

async fn igdb_fetch_impl(
    app: &AppHandle,
    game: Game,
    bypass_cache: bool,
) -> Result<IgdbFetchResult, String> {
    if !secrets::igdb_configured() {
        return Ok(IgdbFetchResult::NotConfigured);
    }

    if game.category != Category::Game {
        return Ok(IgdbFetchResult::Skipped {
            reason: "IGDB enrichment is for games only.".into(),
        });
    }

    let Some((client_id, client_secret)) = secrets::get_igdb_credentials() else {
        return Ok(IgdbFetchResult::NotConfigured);
    };

    let cache_key = cache::cache_key_igdb(&game);
    let conn = cache::open_cache_db(app)?;

    if !bypass_cache {
        if let Some((payload, fetched)) = cache::cache_get(&conn, &cache_key)? {
            if cache::cache_is_fresh(fetched) {
                if let Ok(p) = serde_json::from_str::<IgdbGamePayload>(&payload) {
                    return Ok(IgdbFetchResult::Cached { payload: p });
                }
            }
        }
    }

    match igdb::fetch_igdb_payload(&client_id, &client_secret, &game).await {
        Ok(payload) => {
            let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
            cache::cache_set(&conn, &cache_key, "igdb", &json)?;
            Ok(IgdbFetchResult::Fresh { payload })
        }
        Err(e) if e == "NOT_FOUND" => Ok(IgdbFetchResult::NotFound),
        Err(e) => Ok(IgdbFetchResult::Error { message: e }),
    }
}

#[tauri::command]
pub async fn metadata_fetch_igdb_for_game(app: AppHandle, game: Game) -> Result<IgdbFetchResult, String> {
    igdb_fetch_impl(&app, game, false).await
}

/// Reads IGDB cover URLs already stored in the metadata cache (SQLite) so the grid can hydrate
/// after restart without opening each game's details. Ignores TTL so stale rows still show art
/// until a detail fetch refreshes them.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IgdbCachedCoverHit {
    pub game_id: String,
    pub cover_url: String,
}

#[tauri::command]
pub fn metadata_peek_cached_igdb_covers(app: AppHandle, games: Vec<Game>) -> Result<Vec<IgdbCachedCoverHit>, String> {
    let conn = cache::open_cache_db(&app)?;
    let mut out = Vec::new();
    for game in games {
        if game.category != Category::Game {
            continue;
        }
        let cache_key = cache::cache_key_igdb(&game);
        let Some((payload, _fetched)) = cache::cache_get(&conn, &cache_key)? else {
            continue;
        };
        let Ok(p) = serde_json::from_str::<IgdbGamePayload>(&payload) else {
            continue;
        };
        let Some(url) = p
            .cover_url
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        out.push(IgdbCachedCoverHit {
            game_id: game.id,
            cover_url: url.to_string(),
        });
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TmdbSearchResult {
    NotConfigured,
    Ok { hits: Vec<TmdbSearchHit> },
    Error { message: String },
}

#[tauri::command]
pub async fn metadata_tmdb_search(query: String) -> Result<TmdbSearchResult, String> {
    if !secrets::tmdb_configured() {
        return Ok(TmdbSearchResult::NotConfigured);
    }
    let Some(key) = secrets::get_tmdb_api_key() else {
        return Ok(TmdbSearchResult::NotConfigured);
    };
    if query.trim().is_empty() {
        return Ok(TmdbSearchResult::Ok { hits: vec![] });
    }
    match tmdb::search_multi(&key, query.trim()).await {
        Ok(hits) => Ok(TmdbSearchResult::Ok { hits }),
        Err(e) => Ok(TmdbSearchResult::Error { message: e }),
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TmdbDetailResult {
    NotConfigured,
    Error { message: String },
    Ok { payload: TmdbDetailPayload },
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TmdbWatchProvidersResult {
    NotConfigured,
    Error { message: String },
    Ok { providers: Vec<TmdbProviderRow> },
}

#[tauri::command]
pub async fn metadata_tmdb_fetch_watch_providers(
    media_type: String,
    id: u64,
) -> Result<TmdbWatchProvidersResult, String> {
    if !secrets::tmdb_configured() {
        return Ok(TmdbWatchProvidersResult::NotConfigured);
    }
    let Some(key) = secrets::get_tmdb_api_key() else {
        return Ok(TmdbWatchProvidersResult::NotConfigured);
    };
    let mt = media_type.to_lowercase();
    let kind = if mt == "tv" { "tv" } else { "movie" };
    match tmdb::fetch_watch_providers(&key, kind, id).await {
        Ok(providers) => Ok(TmdbWatchProvidersResult::Ok { providers }),
        Err(e) => Ok(TmdbWatchProvidersResult::Error { message: e }),
    }
}

#[tauri::command]
pub async fn metadata_tmdb_fetch_detail(
    media_type: String,
    id: u64,
) -> Result<TmdbDetailResult, String> {
    if !secrets::tmdb_configured() {
        return Ok(TmdbDetailResult::NotConfigured);
    }
    let Some(key) = secrets::get_tmdb_api_key() else {
        return Ok(TmdbDetailResult::NotConfigured);
    };
    let res = match media_type.as_str() {
        "tv" => tmdb::fetch_tv(&key, id).await,
        _ => tmdb::fetch_movie(&key, id).await,
    };
    match res {
        Ok(p) => Ok(TmdbDetailResult::Ok { payload: p }),
        Err(e) => Ok(TmdbDetailResult::Error { message: e }),
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TmdbDiscoverResult {
    NotConfigured,
    Error { message: String },
    Ok { payload: TmdbDiscoverPayload },
}

#[tauri::command]
pub async fn metadata_tmdb_discover() -> Result<TmdbDiscoverResult, String> {
    if !secrets::tmdb_configured() {
        return Ok(TmdbDiscoverResult::NotConfigured);
    }
    let Some(key) = secrets::get_tmdb_api_key() else {
        return Ok(TmdbDiscoverResult::NotConfigured);
    };
    match tmdb::fetch_discover(&key).await {
        Ok(p) => Ok(TmdbDiscoverResult::Ok { payload: p }),
        Err(e) => Ok(TmdbDiscoverResult::Error { message: e }),
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum IgdbDiscoverResult {
    NotConfigured,
    Error { message: String },
    Ok { hits: Vec<IgdbDiscoverHit> },
}

#[tauri::command]
pub async fn metadata_igdb_discover_games() -> Result<IgdbDiscoverResult, String> {
    if !secrets::igdb_configured() {
        return Ok(IgdbDiscoverResult::NotConfigured);
    }
    let Some((client_id, client_secret)) = secrets::get_igdb_credentials() else {
        return Ok(IgdbDiscoverResult::NotConfigured);
    };
    match igdb::fetch_discover_games(&client_id, &client_secret).await {
        Ok(hits) => Ok(IgdbDiscoverResult::Ok { hits }),
        Err(e) => Ok(IgdbDiscoverResult::Error { message: e }),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichSummary {
    pub refreshed: usize,
    pub errors: usize,
    pub skipped: usize,
}

/// Re-fetches IGDB for every library game (ignores cache TTL so bad or stale matches can be corrected).
#[tauri::command]
pub async fn metadata_enrich_all_games(app: AppHandle, games: Vec<Game>) -> Result<EnrichSummary, String> {
    if !secrets::igdb_configured() {
        return Ok(EnrichSummary {
            refreshed: 0,
            errors: 0,
            skipped: games.len(),
        });
    }

    let mut refreshed = 0usize;
    let mut errors = 0usize;
    let mut skipped = 0usize;

    for game in games {
        if game.category != Category::Game {
            skipped += 1;
            continue;
        }
        let r = igdb_fetch_impl(&app, game, true).await?;
        match r {
            IgdbFetchResult::Fresh { .. } | IgdbFetchResult::Cached { .. } => refreshed += 1,
            IgdbFetchResult::Skipped { .. } | IgdbFetchResult::NotConfigured => skipped += 1,
            IgdbFetchResult::NotFound => skipped += 1,
            IgdbFetchResult::Error { .. } => errors += 1,
        }
    }

    Ok(EnrichSummary {
        refreshed,
        errors,
        skipped,
    })
}
