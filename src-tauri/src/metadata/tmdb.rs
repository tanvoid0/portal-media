use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

use crate::metadata::secrets;

const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p/w780";
const TMDB_IMAGE_LOGO: &str = "https://image.tmdb.org/t/p/w92";

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
pub struct TmdbProviderRow {
    pub provider_id: u64,
    pub provider_name: String,
    pub logo_url: Option<String>,
    /// `flatrate`, `rent`, or `buy`
    pub offer_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbDetailPayload {
    pub source: String,
    pub media_type: String,
    pub id: u64,
    /// IMDb `tt…` id when TMDB provides it; frontend may use it with an optional streaming-catalog add-on.
    pub imdb_id: Option<String>,
    pub title: String,
    pub overview: Option<String>,
    pub poster_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub release_label: Option<String>,
    pub homepage: Option<String>,
    pub tagline: Option<String>,
    pub genres: Vec<String>,
    pub runtime_minutes: Option<u32>,
    pub watch_region: Option<String>,
    pub watch_link: Option<String>,
    pub providers: Vec<TmdbProviderRow>,
}

fn poster_url(path: Option<&str>) -> Option<String> {
    path.map(|p| format!("{}{}", TMDB_IMAGE_BASE, p))
}

fn logo_url(path: Option<&str>) -> Option<String> {
    path.map(|p| format!("{}{}", TMDB_IMAGE_LOGO, p))
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
struct Genre {
    name: String,
}

#[derive(Clone, Deserialize)]
struct RawProvider {
    provider_id: u64,
    provider_name: String,
    logo_path: Option<String>,
}

#[derive(Clone, Deserialize)]
struct WatchRegion {
    link: Option<String>,
    flatrate: Option<Vec<RawProvider>>,
    rent: Option<Vec<RawProvider>>,
    buy: Option<Vec<RawProvider>>,
}

#[derive(Clone, Deserialize)]
struct WatchProvidersEnvelope {
    results: HashMap<String, WatchRegion>,
}

#[derive(Deserialize)]
struct WatchProvidersListBody {
    results: HashMap<String, WatchRegion>,
}

#[derive(Deserialize)]
struct MovieDetailResponse {
    title: Option<String>,
    imdb_id: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    release_date: Option<String>,
    homepage: Option<String>,
    tagline: Option<String>,
    runtime: Option<u64>,
    genres: Option<Vec<Genre>>,
    watch_providers: Option<WatchProvidersEnvelope>,
}

#[derive(Deserialize)]
struct TvExternalIds {
    imdb_id: Option<String>,
}

#[derive(Deserialize)]
struct TvDetailResponse {
    name: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    first_air_date: Option<String>,
    homepage: Option<String>,
    tagline: Option<String>,
    episode_run_time: Option<Vec<u64>>,
    genres: Option<Vec<Genre>>,
    watch_providers: Option<WatchProvidersEnvelope>,
    external_ids: Option<TvExternalIds>,
}

fn genre_names(g: Option<Vec<Genre>>) -> Vec<String> {
    g.map(|v| v.into_iter().map(|x| x.name).collect())
        .unwrap_or_default()
}

fn pick_region(envelope: &WatchProvidersEnvelope) -> Option<(String, WatchRegion)> {
    let keys: Vec<&String> = envelope.results.keys().collect();
    if keys.is_empty() {
        return None;
    }
    let preferred = ["US", "GB", "CA", "AU"];
    for p in preferred {
        if let Some(r) = envelope.results.get(p) {
            return Some((p.to_string(), r.clone()));
        }
    }
    let first = keys[0];
    envelope.results.get(first).map(|r| (first.clone(), r.clone()))
}

fn collect_providers(region: &WatchRegion) -> Vec<TmdbProviderRow> {
    let mut out: Vec<TmdbProviderRow> = Vec::new();
    let mut push_kind = |kind: &str, list: &Option<Vec<RawProvider>>| {
        let Some(items) = list else {
            return;
        };
        for p in items {
            out.push(TmdbProviderRow {
                provider_id: p.provider_id,
                provider_name: p.provider_name.clone(),
                logo_url: logo_url(p.logo_path.as_deref()),
                offer_kind: kind.into(),
            });
        }
    };
    push_kind("flatrate", &region.flatrate);
    push_kind("rent", &region.rent);
    push_kind("buy", &region.buy);
    out
}

pub async fn fetch_movie(api_key: &str, id: u64) -> Result<TmdbDetailPayload, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/movie/{}?api_key={}&language=en-US&append_to_response=watch_providers",
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
    let d: MovieDetailResponse = resp.json().await.map_err(|e| e.to_string())?;
    let (watch_region, watch_link, providers) = d
        .watch_providers
        .as_ref()
        .and_then(|w| pick_region(w))
        .map(|(code, r)| {
            let link = r.link.clone();
            let rows = collect_providers(&r);
            (Some(code), link, rows)
        })
        .unwrap_or((None, None, vec![]));

    let runtime_minutes = d.runtime.and_then(|n| u32::try_from(n).ok());

    Ok(TmdbDetailPayload {
        source: "tmdb".into(),
        media_type: "movie".into(),
        id,
        imdb_id: d.imdb_id,
        title: d.title.unwrap_or_else(|| "Unknown".into()),
        overview: d.overview,
        poster_url: poster_url(d.poster_path.as_deref()),
        backdrop_url: poster_url(d.backdrop_path.as_deref()),
        release_label: d.release_date,
        homepage: d.homepage,
        tagline: d.tagline,
        genres: genre_names(d.genres),
        runtime_minutes,
        watch_region,
        watch_link,
        providers,
    })
}

pub async fn fetch_tv(api_key: &str, id: u64) -> Result<TmdbDetailPayload, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://api.themoviedb.org/3/tv/{}?api_key={}&language=en-US&append_to_response=watch_providers,external_ids",
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
    let d: TvDetailResponse = resp.json().await.map_err(|e| e.to_string())?;
    let (watch_region, watch_link, providers) = d
        .watch_providers
        .as_ref()
        .and_then(|w| pick_region(w))
        .map(|(code, r)| {
            let link = r.link.clone();
            let rows = collect_providers(&r);
            (Some(code), link, rows)
        })
        .unwrap_or((None, None, vec![]));

    let runtime_minutes = d
        .episode_run_time
        .as_ref()
        .and_then(|v| v.first().copied())
        .and_then(|n| u32::try_from(n).ok());

    Ok(TmdbDetailPayload {
        source: "tmdb".into(),
        media_type: "tv".into(),
        id,
        imdb_id: d.external_ids.and_then(|e| e.imdb_id),
        title: d.name.unwrap_or_else(|| "Unknown".into()),
        overview: d.overview,
        poster_url: poster_url(d.poster_path.as_deref()),
        backdrop_url: poster_url(d.backdrop_path.as_deref()),
        release_label: d.first_air_date,
        homepage: d.homepage,
        tagline: d.tagline,
        genres: genre_names(d.genres),
        runtime_minutes,
        watch_region,
        watch_link,
        providers,
    })
}

#[derive(Deserialize)]
struct PagedMovieResults {
    results: Vec<MovieListItem>,
}

#[derive(Deserialize)]
struct MovieListItem {
    id: u64,
    title: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    release_date: Option<String>,
}

#[derive(Deserialize)]
struct PagedTvResults {
    results: Vec<TvListItem>,
}

#[derive(Deserialize)]
struct TvListItem {
    id: u64,
    name: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    first_air_date: Option<String>,
}

fn hit_from_movie_item(r: MovieListItem) -> TmdbSearchHit {
    TmdbSearchHit {
        media_type: "movie".into(),
        id: r.id,
        title: r.title,
        name: None,
        overview: r.overview,
        poster_path: r.poster_path,
        release_date: r.release_date,
        first_air_date: None,
    }
}

fn hit_from_tv_item(r: TvListItem) -> TmdbSearchHit {
    TmdbSearchHit {
        media_type: "tv".into(),
        id: r.id,
        title: None,
        name: r.name,
        overview: r.overview,
        poster_path: r.poster_path,
        release_date: None,
        first_air_date: r.first_air_date,
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbDiscoverPayload {
    pub now_playing: Vec<TmdbSearchHit>,
    pub trending_movies: Vec<TmdbSearchHit>,
    pub trending_tv: Vec<TmdbSearchHit>,
}

pub async fn fetch_discover(api_key: &str) -> Result<TmdbDiscoverPayload, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| e.to_string())?;

    let now_url = format!(
        "https://api.themoviedb.org/3/movie/now_playing?api_key={}&language=en-US&page=1&region=US",
        api_key
    );
    let trend_m_url = format!(
        "https://api.themoviedb.org/3/trending/movie/week?api_key={}&language=en-US",
        api_key
    );
    let trend_t_url = format!(
        "https://api.themoviedb.org/3/trending/tv/week?api_key={}&language=en-US",
        api_key
    );

    let now_resp = client
        .get(now_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !now_resp.status().is_success() {
        return Err(format!(
            "TMDB now_playing failed (HTTP {}).",
            now_resp.status().as_u16()
        ));
    }
    let tm_resp = client
        .get(trend_m_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !tm_resp.status().is_success() {
        return Err(format!(
            "TMDB trending movies failed (HTTP {}).",
            tm_resp.status().as_u16()
        ));
    }
    let tt_resp = client
        .get(trend_t_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !tt_resp.status().is_success() {
        return Err(format!(
            "TMDB trending TV failed (HTTP {}).",
            tt_resp.status().as_u16()
        ));
    }

    let now_body: PagedMovieResults = now_resp.json().await.map_err(|e| e.to_string())?;
    let tm_body: PagedMovieResults = tm_resp.json().await.map_err(|e| e.to_string())?;
    let tt_body: PagedTvResults = tt_resp.json().await.map_err(|e| e.to_string())?;

    let now_playing: Vec<TmdbSearchHit> = now_body
        .results
        .into_iter()
        .take(20)
        .map(hit_from_movie_item)
        .collect();
    let trending_movies: Vec<TmdbSearchHit> = tm_body
        .results
        .into_iter()
        .take(20)
        .map(hit_from_movie_item)
        .collect();
    let trending_tv: Vec<TmdbSearchHit> = tt_body
        .results
        .into_iter()
        .take(20)
        .map(hit_from_tv_item)
        .collect();

    Ok(TmdbDiscoverPayload {
        now_playing,
        trending_movies,
        trending_tv,
    })
}

/// Lightweight watch-provider list for grids (one HTTP call per title).
pub async fn fetch_watch_providers(api_key: &str, media_type: &str, id: u64) -> Result<Vec<TmdbProviderRow>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let url = match media_type {
        "tv" => format!(
            "https://api.themoviedb.org/3/tv/{}/watch/providers?api_key={}",
            id, api_key
        ),
        _ => format!(
            "https://api.themoviedb.org/3/movie/{}/watch/providers?api_key={}",
            id, api_key
        ),
    };
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(200).collect();
            eprintln!("[portal-media::tmdb] watch/providers HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "TMDB watch/providers failed (HTTP {}).",
            status.as_u16()
        ));
    }
    let body: WatchProvidersListBody = resp.json().await.map_err(|e| e.to_string())?;
    let envelope = WatchProvidersEnvelope {
        results: body.results,
    };
    Ok(pick_region(&envelope)
        .map(|(_, r)| collect_providers(&r))
        .unwrap_or_default())
}
