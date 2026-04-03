use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::metadata::secrets;

const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p/w780";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbSearchHit {
    pub media_type: String,
    pub id: u64,
    pub title: Option<String>,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub poster_path: Option<String>,
    pub release_date: Option<String>,
    pub first_air_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbDetailPayload {
    pub source: String,
    pub media_type: String,
    pub id: u64,
    pub title: String,
    pub overview: Option<String>,
    pub poster_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub release_label: Option<String>,
    pub homepage: Option<String>,
}

fn poster_url(path: Option<&str>) -> Option<String> {
    path.map(|p| format!("{}{}", TMDB_IMAGE_BASE, p))
}

pub async fn test_tmdb(api_key: &str) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/configuration?api_key={}",
        api_key
    );
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(300).collect();
            eprintln!("[portal-media::tmdb] TMDB error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "TMDB request failed (HTTP {}). Check the API key.",
            status.as_u16()
        ));
    }
    Ok("Connected to TMDB.".into())
}

#[derive(Deserialize)]
struct MultiResult {
    results: Vec<MultiItem>,
}

#[derive(Deserialize)]
struct MultiItem {
    media_type: Option<String>,
    id: Option<u64>,
    title: Option<String>,
    name: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    release_date: Option<String>,
    first_air_date: Option<String>,
}

pub async fn search_multi(api_key: &str, query: &str) -> Result<Vec<TmdbSearchHit>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/search/multi?api_key={}&query={}&include_adult=false&language=en-US",
        api_key,
        urlencoding::encode(query)
    );
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(300).collect();
            eprintln!("[portal-media::tmdb] TMDB error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "TMDB request failed (HTTP {}).",
            status.as_u16()
        ));
    }
    let body: MultiResult = resp.json().await.map_err(|e| e.to_string())?;
    let hits: Vec<TmdbSearchHit> = body
        .results
        .into_iter()
        .filter_map(|r| {
            let mt = r.media_type.unwrap_or_default();
            if mt != "movie" && mt != "tv" {
                return None;
            }
            let id = r.id?;
            Some(TmdbSearchHit {
                media_type: mt,
                id,
                title: r.title,
                name: r.name,
                overview: r.overview,
                poster_path: r.poster_path,
                release_date: r.release_date,
                first_air_date: r.first_air_date,
            })
        })
        .take(10)
        .collect();
    Ok(hits)
}

#[derive(Deserialize)]
struct MovieDetail {
    title: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    release_date: Option<String>,
    homepage: Option<String>,
}

#[derive(Deserialize)]
struct TvDetail {
    name: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    first_air_date: Option<String>,
    homepage: Option<String>,
}

pub async fn fetch_movie(api_key: &str, id: u64) -> Result<TmdbDetailPayload, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/movie/{}?api_key={}&language=en-US",
        id, api_key
    );
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(300).collect();
            eprintln!("[portal-media::tmdb] TMDB error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "TMDB request failed (HTTP {}).",
            status.as_u16()
        ));
    }
    let d: MovieDetail = resp.json().await.map_err(|e| e.to_string())?;
    Ok(TmdbDetailPayload {
        source: "tmdb".into(),
        media_type: "movie".into(),
        id,
        title: d.title.unwrap_or_else(|| "Unknown".into()),
        overview: d.overview,
        poster_url: poster_url(d.poster_path.as_deref()),
        backdrop_url: poster_url(d.backdrop_path.as_deref()),
        release_label: d.release_date,
        homepage: d.homepage,
    })
}

pub async fn fetch_tv(api_key: &str, id: u64) -> Result<TmdbDetailPayload, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/tv/{}?api_key={}&language=en-US",
        id, api_key
    );
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(300).collect();
            eprintln!("[portal-media::tmdb] TMDB error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "TMDB request failed (HTTP {}).",
            status.as_u16()
        ));
    }
    let d: TvDetail = resp.json().await.map_err(|e| e.to_string())?;
    Ok(TmdbDetailPayload {
        source: "tmdb".into(),
        media_type: "tv".into(),
        id,
        title: d.name.unwrap_or_else(|| "Unknown".into()),
        overview: d.overview,
        poster_url: poster_url(d.poster_path.as_deref()),
        backdrop_url: poster_url(d.backdrop_path.as_deref()),
        release_label: d.first_air_date,
        homepage: d.homepage,
    })
}
