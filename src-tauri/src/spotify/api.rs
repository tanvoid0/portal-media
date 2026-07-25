use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::spotify::auth::get_valid_token;

const BASE: &str = "https://api.spotify.com/v1";

fn client() -> Result<Client, String> {
    Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())
}

async fn authed_get(url: &str) -> Result<RequestBuilder, String> {
    let token = get_valid_token().await?;
    Ok(client()?.get(url).bearer_auth(token))
}

async fn authed_put(url: &str) -> Result<RequestBuilder, String> {
    let token = get_valid_token().await?;
    Ok(client()?.put(url).bearer_auth(token))
}

async fn authed_post(url: &str) -> Result<RequestBuilder, String> {
    let token = get_valid_token().await?;
    Ok(client()?.post(url).bearer_auth(token))
}

async fn handle_empty_response(resp: reqwest::Response) -> Result<(), String> {
    if resp.status().is_success() || resp.status().as_u16() == 204 {
        return Ok(());
    }
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    Err(format!("Spotify API error ({status}): {body}"))
}

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyImage {
    pub url: String,
    pub height: Option<u32>,
    pub width: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyFollowers {
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyUser {
    pub id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub images: Option<Vec<SpotifyImage>>,
    pub product: Option<String>,
    pub followers: Option<SpotifyFollowers>,
    pub country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifySimpleArtist {
    pub id: String,
    pub name: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifySimpleAlbum {
    pub id: String,
    pub name: String,
    pub images: Vec<SpotifyImage>,
    pub album_type: Option<String>,
    pub release_date: Option<String>,
    pub artists: Vec<SpotifySimpleArtist>,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyTrack {
    pub id: String,
    pub name: String,
    pub artists: Vec<SpotifySimpleArtist>,
    pub album: SpotifySimpleAlbum,
    pub duration_ms: u64,
    pub uri: String,
    pub is_local: Option<bool>,
    pub explicit: Option<bool>,
    pub popularity: Option<u32>,
    pub preview_url: Option<String>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyArtist {
    pub id: String,
    pub name: String,
    pub images: Option<Vec<SpotifyImage>>,
    pub genres: Option<Vec<String>>,
    pub popularity: Option<u32>,
    pub followers: Option<SpotifyFollowers>,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyAlbum {
    pub id: String,
    pub name: String,
    pub images: Vec<SpotifyImage>,
    pub album_type: Option<String>,
    pub release_date: Option<String>,
    pub total_tracks: Option<u32>,
    pub artists: Vec<SpotifySimpleArtist>,
    pub uri: String,
    pub label: Option<String>,
    pub popularity: Option<u32>,
    pub genres: Option<Vec<String>>,
    pub tracks: Option<SpotifyPaging<SpotifyTrack>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub images: Option<Vec<SpotifyImage>>,
    pub owner: SpotifyPlaylistOwner,
    pub tracks: SpotifyPlaylistTracksRef,
    pub public: Option<bool>,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylistOwner {
    pub id: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylistTracksRef {
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylistTrack {
    pub added_at: Option<String>,
    pub track: Option<SpotifyTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifySavedTrack {
    pub added_at: String,
    pub track: SpotifyTrack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifySavedAlbum {
    pub added_at: String,
    pub album: SpotifyAlbum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPaging<T> {
    pub items: Vec<T>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub next: Option<String>,
    pub previous: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyDevice {
    pub id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub is_active: bool,
    pub is_private_session: bool,
    pub is_restricted: bool,
    pub volume_percent: Option<u32>,
    pub supports_volume: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaybackState {
    pub device: Option<SpotifyDevice>,
    pub shuffle_state: bool,
    pub repeat_state: String,
    pub timestamp: Option<u64>,
    pub progress_ms: Option<u64>,
    pub is_playing: bool,
    pub item: Option<SpotifyTrack>,
    pub context: Option<SpotifyContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyContext {
    #[serde(rename = "type")]
    pub context_type: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyRecentlyPlayedItem {
    pub track: SpotifyTrack,
    pub played_at: String,
    pub context: Option<SpotifyContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifySearchResult {
    pub tracks: Option<SpotifyPaging<SpotifyTrack>>,
    pub artists: Option<SpotifyPaging<SpotifyArtist>>,
    pub albums: Option<SpotifyPaging<SpotifyAlbum>>,
    pub playlists: Option<SpotifyPaging<SpotifyPlaylist>>,
}

// ─── API calls ────────────────────────────────────────────────────────────────

pub async fn get_me() -> Result<SpotifyUser, String> {
    let resp = authed_get(&format!("{BASE}/me"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_me failed ({s}): {b}"));
    }
    resp.json::<SpotifyUser>().await.map_err(|e| e.to_string())
}

pub async fn get_playback_state() -> Result<Option<SpotifyPlaybackState>, String> {
    let resp = authed_get(&format!("{BASE}/me/player"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().as_u16() == 204 {
        return Ok(None);
    }
    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_playback_state failed ({s}): {b}"));
    }
    resp.json::<SpotifyPlaybackState>()
        .await
        .map(Some)
        .map_err(|e| e.to_string())
}

pub async fn play(
    context_uri: Option<String>,
    uris: Option<Vec<String>>,
    offset: Option<Value>,
    position_ms: Option<u64>,
    device_id: Option<String>,
) -> Result<(), String> {
    let url = if let Some(did) = &device_id {
        format!("{BASE}/me/player/play?device_id={did}")
    } else {
        format!("{BASE}/me/player/play")
    };

    let mut body = serde_json::Map::new();
    if let Some(cu) = context_uri {
        body.insert("context_uri".into(), Value::String(cu));
    }
    if let Some(u) = uris {
        body.insert(
            "uris".into(),
            Value::Array(u.into_iter().map(Value::String).collect()),
        );
    }
    if let Some(o) = offset {
        body.insert("offset".into(), o);
    }
    if let Some(p) = position_ms {
        body.insert("position_ms".into(), Value::Number(p.into()));
    }

    let resp = authed_put(&url)
        .await?
        .json(&Value::Object(body))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    handle_empty_response(resp).await
}

pub async fn pause(device_id: Option<String>) -> Result<(), String> {
    let url = device_id
        .map(|d| format!("{BASE}/me/player/pause?device_id={d}"))
        .unwrap_or_else(|| format!("{BASE}/me/player/pause"));

    let resp = authed_put(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn next(device_id: Option<String>) -> Result<(), String> {
    let url = device_id
        .map(|d| format!("{BASE}/me/player/next?device_id={d}"))
        .unwrap_or_else(|| format!("{BASE}/me/player/next"));

    let resp = authed_post(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn previous(device_id: Option<String>) -> Result<(), String> {
    let url = device_id
        .map(|d| format!("{BASE}/me/player/previous?device_id={d}"))
        .unwrap_or_else(|| format!("{BASE}/me/player/previous"));

    let resp = authed_post(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn seek(position_ms: u64, device_id: Option<String>) -> Result<(), String> {
    let mut url = format!("{BASE}/me/player/seek?position_ms={position_ms}");
    if let Some(d) = device_id {
        url.push_str(&format!("&device_id={d}"));
    }
    let resp = authed_put(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn set_volume(volume_percent: u8, device_id: Option<String>) -> Result<(), String> {
    let mut url = format!("{BASE}/me/player/volume?volume_percent={volume_percent}");
    if let Some(d) = device_id {
        url.push_str(&format!("&device_id={d}"));
    }
    let resp = authed_put(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn set_shuffle(state: bool, device_id: Option<String>) -> Result<(), String> {
    let mut url = format!("{BASE}/me/player/shuffle?state={state}");
    if let Some(d) = device_id {
        url.push_str(&format!("&device_id={d}"));
    }
    let resp = authed_put(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn set_repeat(state: &str, device_id: Option<String>) -> Result<(), String> {
    let mut url = format!("{BASE}/me/player/repeat?state={state}");
    if let Some(d) = device_id {
        url.push_str(&format!("&device_id={d}"));
    }
    let resp = authed_put(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn get_devices() -> Result<Vec<SpotifyDevice>, String> {
    #[derive(Deserialize)]
    struct Resp {
        devices: Vec<SpotifyDevice>,
    }

    let resp = authed_get(&format!("{BASE}/me/player/devices"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_devices failed ({s}): {b}"));
    }
    resp.json::<Resp>()
        .await
        .map(|r| r.devices)
        .map_err(|e| e.to_string())
}

pub async fn transfer_playback(device_id: &str) -> Result<(), String> {
    let body = serde_json::json!({ "device_ids": [device_id], "play": true });
    let resp = authed_put(&format!("{BASE}/me/player"))
        .await?
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn get_playlists(limit: u32, offset: u32) -> Result<SpotifyPaging<SpotifyPlaylist>, String> {
    let resp = authed_get(&format!("{BASE}/me/playlists?limit={limit}&offset={offset}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_playlists failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_playlist_tracks(
    playlist_id: &str,
    limit: u32,
    offset: u32,
) -> Result<SpotifyPaging<SpotifyPlaylistTrack>, String> {
    let url = format!(
        "{BASE}/playlists/{playlist_id}/tracks?limit={limit}&offset={offset}&fields=items(added_at,track(id,name,duration_ms,uri,explicit,is_local,preview_url,track_number,disc_number,artists(id,name,uri),album(id,name,uri,images,release_date,album_type,artists(id,name,uri)))),total,limit,offset,next,previous"
    );
    let resp = authed_get(&url)
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_playlist_tracks failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_liked_songs(limit: u32, offset: u32) -> Result<SpotifyPaging<SpotifySavedTrack>, String> {
    let resp = authed_get(&format!("{BASE}/me/tracks?limit={limit}&offset={offset}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_liked_songs failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_saved_albums(limit: u32, offset: u32) -> Result<SpotifyPaging<SpotifySavedAlbum>, String> {
    let resp = authed_get(&format!("{BASE}/me/albums?limit={limit}&offset={offset}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_saved_albums failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_followed_artists() -> Result<Vec<SpotifyArtist>, String> {
    #[derive(Deserialize)]
    struct Cursor {
        after: Option<String>,
    }
    #[derive(Deserialize)]
    struct ArtistsPaging {
        items: Vec<SpotifyArtist>,
        cursors: Option<Cursor>,
        next: Option<String>,
    }
    #[derive(Deserialize)]
    struct Resp {
        artists: ArtistsPaging,
    }

    let mut all = Vec::new();
    let mut after: Option<String> = None;

    loop {
        let url = if let Some(a) = &after {
            format!("{BASE}/me/following?type=artist&limit=50&after={a}")
        } else {
            format!("{BASE}/me/following?type=artist&limit=50")
        };

        let resp = authed_get(&url)
            .await?
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let s = resp.status();
            let b = resp.text().await.unwrap_or_default();
            return Err(format!("get_followed_artists failed ({s}): {b}"));
        }

        let data: Resp = resp.json().await.map_err(|e| e.to_string())?;
        let has_next = data.artists.next.is_some();
        let next_after = data.artists.cursors.as_ref().and_then(|c| c.after.clone());
        all.extend(data.artists.items);

        if !has_next {
            break;
        }
        after = next_after;
        if after.is_none() {
            break;
        }
    }

    Ok(all)
}

pub async fn get_top_tracks(time_range: &str, limit: u32) -> Result<Vec<SpotifyTrack>, String> {
    #[derive(Deserialize)]
    struct Resp {
        items: Vec<SpotifyTrack>,
    }

    let resp = authed_get(&format!(
        "{BASE}/me/top/tracks?time_range={time_range}&limit={limit}"
    ))
    .await?
    .send()
    .await
    .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_top_tracks failed ({s}): {b}"));
    }
    resp.json::<Resp>()
        .await
        .map(|r| r.items)
        .map_err(|e| e.to_string())
}

pub async fn get_top_artists(time_range: &str, limit: u32) -> Result<Vec<SpotifyArtist>, String> {
    #[derive(Deserialize)]
    struct Resp {
        items: Vec<SpotifyArtist>,
    }

    let resp = authed_get(&format!(
        "{BASE}/me/top/artists?time_range={time_range}&limit={limit}"
    ))
    .await?
    .send()
    .await
    .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_top_artists failed ({s}): {b}"));
    }
    resp.json::<Resp>()
        .await
        .map(|r| r.items)
        .map_err(|e| e.to_string())
}

pub async fn get_recently_played(limit: u32) -> Result<Vec<SpotifyRecentlyPlayedItem>, String> {
    #[derive(Deserialize)]
    struct Resp {
        items: Vec<SpotifyRecentlyPlayedItem>,
    }

    let resp = authed_get(&format!("{BASE}/me/player/recently-played?limit={limit}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_recently_played failed ({s}): {b}"));
    }
    resp.json::<Resp>()
        .await
        .map(|r| r.items)
        .map_err(|e| e.to_string())
}

pub async fn get_album(album_id: &str) -> Result<SpotifyAlbum, String> {
    let resp = authed_get(&format!("{BASE}/albums/{album_id}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_album failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_artist(artist_id: &str) -> Result<SpotifyArtist, String> {
    let resp = authed_get(&format!("{BASE}/artists/{artist_id}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_artist failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn get_artist_top_tracks(artist_id: &str) -> Result<Vec<SpotifyTrack>, String> {
    #[derive(Deserialize)]
    struct Resp {
        tracks: Vec<SpotifyTrack>,
    }

    let resp = authed_get(&format!("{BASE}/artists/{artist_id}/top-tracks"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_artist_top_tracks failed ({s}): {b}"));
    }
    resp.json::<Resp>()
        .await
        .map(|r| r.tracks)
        .map_err(|e| e.to_string())
}

pub async fn get_artist_albums(
    artist_id: &str,
    limit: u32,
    offset: u32,
) -> Result<SpotifyPaging<SpotifyAlbum>, String> {
    let resp = authed_get(&format!(
        "{BASE}/artists/{artist_id}/albums?limit={limit}&offset={offset}&include_groups=album,single"
    ))
    .await?
    .send()
    .await
    .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("get_artist_albums failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn search(
    query: &str,
    types: &[&str],
    limit: u32,
) -> Result<SpotifySearchResult, String> {
    let type_str = types.join(",");
    let q = urlencoding::encode(query);
    let resp = authed_get(&format!(
        "{BASE}/search?q={q}&type={type_str}&limit={limit}"
    ))
    .await?
    .send()
    .await
    .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("search failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

pub async fn like_track(track_id: &str) -> Result<(), String> {
    let body = serde_json::json!({ "ids": [track_id] });
    let resp = authed_put(&format!("{BASE}/me/tracks"))
        .await?
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn unlike_track(track_id: &str) -> Result<(), String> {
    let token = get_valid_token().await?;
    let body = serde_json::json!({ "ids": [track_id] });
    let resp = client()?
        .delete(&format!("{BASE}/me/tracks"))
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    handle_empty_response(resp).await
}

pub async fn check_liked_tracks(track_ids: &[String]) -> Result<Vec<bool>, String> {
    let ids = track_ids.join(",");
    let resp = authed_get(&format!("{BASE}/me/tracks/contains?ids={ids}"))
        .await?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("check_liked_tracks failed ({s}): {b}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}
