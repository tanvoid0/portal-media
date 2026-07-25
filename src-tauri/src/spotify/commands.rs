use serde_json::Value;

use crate::metadata::secrets;
use crate::spotify::{api, auth};

// ─── Auth ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_start_auth(client_id: String) -> Result<String, String> {
    let id = client_id.trim();
    if id.is_empty() {
        return Err("Spotify Client ID is required".into());
    }
    auth::start_auth_flow(id).await
}

#[tauri::command]
pub async fn spotify_check_auth() -> Result<Option<api::SpotifyUser>, String> {
    if !auth::spotify_configured() {
        return Ok(None);
    }
    match api::get_me().await {
        Ok(user) => Ok(Some(user)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn spotify_disconnect() -> Result<(), String> {
    auth::disconnect()
}

#[tauri::command]
pub fn spotify_is_configured() -> bool {
    auth::spotify_configured()
}

#[tauri::command]
pub fn spotify_get_client_id() -> Option<String> {
    secrets::get_spotify_client_id()
}

#[tauri::command]
pub async fn spotify_get_access_token() -> Result<String, String> {
    auth::get_valid_token().await
}

// ─── Profile ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_get_me() -> Result<api::SpotifyUser, String> {
    api::get_me().await
}

// ─── Playback ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_get_playback_state() -> Result<Option<api::SpotifyPlaybackState>, String> {
    api::get_playback_state().await
}

#[tauri::command]
pub async fn spotify_play(
    context_uri: Option<String>,
    uris: Option<Vec<String>>,
    offset: Option<Value>,
    position_ms: Option<u64>,
    device_id: Option<String>,
) -> Result<(), String> {
    api::play(context_uri, uris, offset, position_ms, device_id).await
}

#[tauri::command]
pub async fn spotify_pause(device_id: Option<String>) -> Result<(), String> {
    api::pause(device_id).await
}

#[tauri::command]
pub async fn spotify_next(device_id: Option<String>) -> Result<(), String> {
    api::next(device_id).await
}

#[tauri::command]
pub async fn spotify_previous(device_id: Option<String>) -> Result<(), String> {
    api::previous(device_id).await
}

#[tauri::command]
pub async fn spotify_seek(position_ms: u64, device_id: Option<String>) -> Result<(), String> {
    api::seek(position_ms, device_id).await
}

#[tauri::command]
pub async fn spotify_set_volume(volume_percent: u8, device_id: Option<String>) -> Result<(), String> {
    api::set_volume(volume_percent, device_id).await
}

#[tauri::command]
pub async fn spotify_set_shuffle(state: bool, device_id: Option<String>) -> Result<(), String> {
    api::set_shuffle(state, device_id).await
}

#[tauri::command]
pub async fn spotify_set_repeat(state: String, device_id: Option<String>) -> Result<(), String> {
    api::set_repeat(&state, device_id).await
}

#[tauri::command]
pub async fn spotify_get_devices() -> Result<Vec<api::SpotifyDevice>, String> {
    api::get_devices().await
}

#[tauri::command]
pub async fn spotify_transfer_playback(device_id: String) -> Result<(), String> {
    api::transfer_playback(&device_id).await
}

// ─── Library ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_get_playlists(
    limit: u32,
    offset: u32,
) -> Result<api::SpotifyPaging<api::SpotifyPlaylist>, String> {
    api::get_playlists(limit, offset).await
}

#[tauri::command]
pub async fn spotify_get_playlist_tracks(
    playlist_id: String,
    limit: u32,
    offset: u32,
) -> Result<api::SpotifyPaging<api::SpotifyPlaylistTrack>, String> {
    api::get_playlist_tracks(&playlist_id, limit, offset).await
}

#[tauri::command]
pub async fn spotify_get_liked_songs(
    limit: u32,
    offset: u32,
) -> Result<api::SpotifyPaging<api::SpotifySavedTrack>, String> {
    api::get_liked_songs(limit, offset).await
}

#[tauri::command]
pub async fn spotify_get_saved_albums(
    limit: u32,
    offset: u32,
) -> Result<api::SpotifyPaging<api::SpotifySavedAlbum>, String> {
    api::get_saved_albums(limit, offset).await
}

#[tauri::command]
pub async fn spotify_get_followed_artists() -> Result<Vec<api::SpotifyArtist>, String> {
    api::get_followed_artists().await
}

#[tauri::command]
pub async fn spotify_get_top_tracks(
    time_range: String,
    limit: u32,
) -> Result<Vec<api::SpotifyTrack>, String> {
    api::get_top_tracks(&time_range, limit).await
}

#[tauri::command]
pub async fn spotify_get_top_artists(
    time_range: String,
    limit: u32,
) -> Result<Vec<api::SpotifyArtist>, String> {
    api::get_top_artists(&time_range, limit).await
}

#[tauri::command]
pub async fn spotify_get_recently_played(
    limit: u32,
) -> Result<Vec<api::SpotifyRecentlyPlayedItem>, String> {
    api::get_recently_played(limit).await
}

// ─── Browse ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_get_album(album_id: String) -> Result<api::SpotifyAlbum, String> {
    api::get_album(&album_id).await
}

#[tauri::command]
pub async fn spotify_get_artist(artist_id: String) -> Result<api::SpotifyArtist, String> {
    api::get_artist(&artist_id).await
}

#[tauri::command]
pub async fn spotify_get_artist_top_tracks(
    artist_id: String,
) -> Result<Vec<api::SpotifyTrack>, String> {
    api::get_artist_top_tracks(&artist_id).await
}

#[tauri::command]
pub async fn spotify_get_artist_albums(
    artist_id: String,
    limit: u32,
    offset: u32,
) -> Result<api::SpotifyPaging<api::SpotifyAlbum>, String> {
    api::get_artist_albums(&artist_id, limit, offset).await
}

// ─── Search ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_search(
    query: String,
    types: Vec<String>,
    limit: u32,
) -> Result<api::SpotifySearchResult, String> {
    let type_refs: Vec<&str> = types.iter().map(String::as_str).collect();
    api::search(&query, &type_refs, limit).await
}

// ─── Like / Save ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn spotify_like_track(track_id: String) -> Result<(), String> {
    api::like_track(&track_id).await
}

#[tauri::command]
pub async fn spotify_unlike_track(track_id: String) -> Result<(), String> {
    api::unlike_track(&track_id).await
}

#[tauri::command]
pub async fn spotify_check_liked_tracks(
    track_ids: Vec<String>,
) -> Result<Vec<bool>, String> {
    api::check_liked_tracks(&track_ids).await
}
