use crate::commands::{Game, LaunchType};
use crate::metadata::secrets;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgdbWebsiteLink {
    pub url: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgdbGamePayload {
    pub source: String,
    pub igdb_id: Option<u64>,
    pub name: String,
    pub summary: Option<String>,
    pub storyline: Option<String>,
    pub release_date: Option<String>,
    pub cover_url: Option<String>,
    pub genres: Vec<String>,
    pub themes: Vec<String>,
    pub website_links: Vec<IgdbWebsiteLink>,
}

struct TwitchToken {
    access_token: String,
    #[allow(dead_code)]
    client_id: String,
    expires_at: Instant,
}

static TOKEN: OnceLock<Mutex<Option<TwitchToken>>> = OnceLock::new();

fn token_cache() -> &'static Mutex<Option<TwitchToken>> {
    TOKEN.get_or_init(|| Mutex::new(None))
}

async fn twitch_app_token(client_id: &str, client_secret: &str) -> Result<TwitchToken, String> {
    {
        let guard = token_cache().lock().map_err(|e| e.to_string())?;
        if let Some(t) = guard.as_ref() {
            if t.expires_at > Instant::now() + Duration::from_secs(120) {
                return Ok(TwitchToken {
                    access_token: t.access_token.clone(),
                    client_id: t.client_id.clone(),
                    expires_at: t.expires_at,
                });
            }
        }
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post("https://id.twitch.tv/oauth2/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = body.chars().take(300).collect();
            eprintln!("[portal-media::igdb] Twitch token error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "Twitch token request failed (HTTP {}). Check Client ID and Client Secret.",
            status.as_u16()
        ));
    }

    #[derive(Deserialize)]
    struct TwitchOAuth {
        access_token: String,
        expires_in: u64,
    }

    let body: TwitchOAuth = resp.json().await.map_err(|e| e.to_string())?;
    let ttl = Duration::from_secs(body.expires_in.saturating_sub(60).max(300));
    let tok = TwitchToken {
        access_token: body.access_token,
        client_id: client_id.to_string(),
        expires_at: Instant::now() + ttl,
    };

    {
        let mut guard = token_cache().lock().map_err(|e| e.to_string())?;
        *guard = Some(TwitchToken {
            access_token: tok.access_token.clone(),
            client_id: tok.client_id.clone(),
            expires_at: tok.expires_at,
        });
    }

    Ok(tok)
}

fn igdb_image_cover_big(image_id: &str) -> String {
    format!(
        "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{}.jpg",
        image_id.trim()
    )
}

fn escape_apicalypse(s: &str) -> String {
    s.replace('"', " ")
        .replace('\n', " ")
        .chars()
        .take(200)
        .collect::<String>()
        .trim()
        .to_string()
}

fn fallback_link_label(url: &str) -> String {
    url::Url::parse(url.trim())
        .ok()
        .and_then(|u| {
            u.host_str().map(|h| {
                h.trim_start_matches("www.")
                    .split('.')
                    .next()
                    .unwrap_or(h)
                    .to_string()
            })
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Link".into())
}

fn website_category_rank(category: Option<u64>) -> u8 {
    match category {
        Some(1) => 0, // official
        Some(16) | Some(13) | Some(17) => 1, // storefronts
        Some(3) => 2,                         // wikipedia
        Some(9) | Some(6) | Some(8) | Some(4) | Some(5) | Some(14) | Some(18) => 3,
        Some(2) => 4, // wikia / fandom
        _ => 5,
    }
}

fn website_label(category: Option<u64>, url: &str) -> String {
    match category {
        Some(1) => "Official site".into(),
        Some(2) => "Fandom / Wikia".into(),
        Some(3) => "Wikipedia".into(),
        Some(4) => "Facebook".into(),
        Some(5) => "Twitter / X".into(),
        Some(6) => "Twitch".into(),
        Some(8) => "Instagram".into(),
        Some(9) => "YouTube".into(),
        Some(10) => "App Store (iPhone)".into(),
        Some(11) => "App Store (iPad)".into(),
        Some(12) => "Google Play".into(),
        Some(13) => "Steam".into(),
        Some(14) => "Reddit".into(),
        Some(15) => "itch.io".into(),
        Some(16) => "Epic Games Store".into(),
        Some(17) => "GOG".into(),
        Some(18) => "Discord".into(),
        _ => fallback_link_label(url),
    }
}

async fn igdb_cover_image_url_if_needed(
    client: &Client,
    access_token: &str,
    client_id: &str,
    game_row: &serde_json::Value,
    existing_cover: Option<String>,
) -> Option<String> {
    if existing_cover.is_some() {
        return existing_cover;
    }
    // IGDB sometimes returns `cover` as an unexpanded id instead of { image_id: ... }.
    let cover_entity_id = game_row["cover"]
        .as_u64()
        .or_else(|| game_row["cover"].as_i64().map(|x| x as u64))?;
    let body = format!(
        "fields image_id;\nwhere id = {};\nlimit 1;",
        cover_entity_id
    );
    let rows = igdb_post(client, access_token, client_id, "covers", &body)
        .await
        .ok()?;
    let raw = rows.first()?.get("image_id")?;
    let id = raw
        .as_str()
        .map(ToString::to_string)
        .or_else(|| raw.as_i64().map(|n| n.to_string()))
        .or_else(|| raw.as_u64().map(|n| n.to_string()))?;
    Some(igdb_image_cover_big(&id))
}

/// IGDB external_game category: Steam = 1, GOG = 5, Epic = 26
async fn resolve_igdb_game_id(
    client: &Client,
    access_token: &str,
    client_id: &str,
    game: &Game,
) -> Result<Option<u64>, String> {
    let query = match game.launch_type {
        LaunchType::Steam => {
            let uid = escape_apicalypse(&game.id);
            format!(
                "fields game;\nwhere category = 1 & uid = \"{}\";\nlimit 1;",
                uid
            )
        }
        LaunchType::Gog => {
            let uid = escape_apicalypse(&game.id);
            format!(
                "fields game;\nwhere category = 5 & uid = \"{}\";\nlimit 1;",
                uid
            )
        }
        LaunchType::Epic => {
            // IGDB uid may not match manifest `CatalogItemId` byte-for-byte; try a few normalizations.
            let base = game.id.trim();
            let compact: String = base.chars().filter(|c| *c != '-').collect();
            let mut variants: Vec<String> = Vec::new();
            for s in [base.to_string(), compact.clone(), base.to_lowercase(), compact.to_lowercase()] {
                if !s.is_empty() && !variants.contains(&s) {
                    variants.push(s);
                }
            }
            let conds: String = variants
                .iter()
                .map(|u| format!("uid = \"{}\"", escape_apicalypse(u)))
                .collect::<Vec<_>>()
                .join(" | ");
            format!("fields game;\nwhere category = 26 & ({});\nlimit 1;", conds)
        }
        _ => return Ok(None),
    };

    let rows: Vec<serde_json::Value> = igdb_post(client, access_token, client_id, "external_games", &query).await?;
    let id = rows
        .first()
        .and_then(|v| v["game"].as_u64())
        .or_else(|| rows.first().and_then(|v| v["game"].as_i64()).map(|x| x as u64));
    Ok(id)
}

async fn igdb_post(
    client: &Client,
    access_token: &str,
    client_id: &str,
    endpoint: &str,
    body: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!("https://api.igdb.com/v4/{}", endpoint);
    let resp = client
        .post(&url)
        .header("Client-ID", client_id)
        .header(
            "Authorization",
            format!("Bearer {}", access_token),
        )
        .header("Accept", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == 429 {
        return Err("IGDB rate limited. Try again later.".into());
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        if secrets::secrets_trace_enabled() {
            let preview: String = t.chars().take(300).collect();
            eprintln!("[portal-media::igdb] IGDB error HTTP {status} (truncated): {preview}");
        }
        return Err(format!(
            "IGDB request failed (HTTP {}).",
            status.as_u16()
        ));
    }

    let val: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(val)
}

fn score_igdb_name_candidate(row: &serde_json::Value, wanted: &str) -> i32 {
    let wanted = wanted.trim();
    let wanted_lower = wanted.to_lowercase();
    let name = row["name"].as_str().unwrap_or("");
    let name_lower = name.to_lowercase();
    let mut score = 0;
    if name == wanted {
        score += 2000;
    } else if name_lower == wanted_lower {
        score += 1500;
    } else if name_lower.starts_with(&wanted_lower) {
        score += 700;
    } else if name_lower.contains(&wanted_lower) {
        score += 400;
    }
    if row["parent_game"].is_null() {
        score += 250;
    }
    if wanted.len() <= 24 {
        let excess = name.len().saturating_sub(wanted.len()) as i32;
        score -= (excess * 4).min(200);
    }
    score
}

/// Picks the best match from IGDB search — `limit 1` often returns the wrong entity (DLC, events).
async fn search_game_id_by_name(
    client: &Client,
    access_token: &str,
    client_id: &str,
    name: &str,
) -> Result<Option<u64>, String> {
    let q = escape_apicalypse(name);
    let body = format!(
        "search \"{}\";\nfields id,name,parent_game;\nlimit 20;",
        q
    );
    let rows = igdb_post(client, access_token, client_id, "games", &body).await?;
    let best = rows
        .iter()
        .max_by_key(|row| score_igdb_name_candidate(row, name));
    Ok(best.and_then(|v| v["id"].as_u64()))
}

fn format_release_from_unix(ts: i64) -> String {
    let days = ts.div_euclid(86400);
    chrono::NaiveDate::from_num_days_from_ce_opt(719_163 + days as i32)
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| ts.to_string())
}

fn parse_game_row(v: &serde_json::Value) -> IgdbGamePayload {
    let id = v["id"].as_u64();
    let name = v["name"].as_str().unwrap_or("Unknown").to_string();
    let summary = v["summary"].as_str().map(String::from);
    let storyline = v["storyline"].as_str().map(String::from);

    let release_date = v["first_release_date"]
        .as_i64()
        .map(format_release_from_unix);

    let cover_url = v["cover"].as_object().and_then(|c| {
        let raw = c.get("image_id")?;
        let id = raw
            .as_str()
            .map(ToString::to_string)
            .or_else(|| raw.as_i64().map(|n| n.to_string()))
            .or_else(|| raw.as_u64().map(|n| n.to_string()))?;
        Some(igdb_image_cover_big(&id))
    });

    let genres: Vec<String> = v["genres"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|g| g["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let themes: Vec<String> = v["themes"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|g| g["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let mut site_items: Vec<(u8, IgdbWebsiteLink)> = v["websites"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|w| {
                    let url = w["url"].as_str()?.to_string();
                    let cat = w["category"]
                        .as_u64()
                        .or_else(|| w["category"].as_i64().map(|x| x as u64));
                    let rank = website_category_rank(cat);
                    let label = website_label(cat, &url);
                    Some((rank, IgdbWebsiteLink { url, label }))
                })
                .collect()
        })
        .unwrap_or_default();
    site_items.sort_by_key(|(r, _)| *r);
    let website_links: Vec<IgdbWebsiteLink> = site_items.into_iter().map(|(_, l)| l).collect();

    IgdbGamePayload {
        source: "igdb".into(),
        igdb_id: id,
        name,
        summary,
        storyline,
        release_date,
        cover_url,
        genres,
        themes,
        website_links,
    }
}

/// Fetch full IGDB metadata for a library game.
pub async fn fetch_igdb_payload(
    client_id: &str,
    client_secret: &str,
    game: &Game,
) -> Result<IgdbGamePayload, String> {
    let twitch = twitch_app_token(client_id, client_secret).await?;
    let http = Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| e.to_string())?;

    let mut gid = resolve_igdb_game_id(
        &http,
        &twitch.access_token,
        client_id,
        game,
    )
    .await?;

    if gid.is_none() {
        gid = search_game_id_by_name(
            &http,
            &twitch.access_token,
            client_id,
            &game.name,
        )
        .await?;
    }

    let Some(game_id) = gid else {
        return Err("NOT_FOUND".into());
    };

    let body = format!(
        "fields id,name,summary,storyline,first_release_date,cover.image_id,genres.name,themes.name,websites.url,websites.category;\nwhere id = {};\nlimit 1;",
        game_id
    );
    let rows = igdb_post(
        &http,
        &twitch.access_token,
        client_id,
        "games",
        &body,
    )
    .await?;

    let Some(row) = rows.first() else {
        return Err("NOT_FOUND".into());
    };

    let mut payload = parse_game_row(row);
    let resolved = igdb_cover_image_url_if_needed(
        &http,
        &twitch.access_token,
        client_id,
        row,
        payload.cover_url.clone(),
    )
    .await;
    if let Some(url) = resolved {
        payload.cover_url = Some(url);
    }
    Ok(payload)
}

pub async fn test_igdb_connection(client_id: &str, client_secret: &str) -> Result<String, String> {
    let twitch = twitch_app_token(client_id, client_secret).await?;
    let http = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let body = "fields id,name;\nlimit 1;\n";
    let rows = igdb_post(&http, &twitch.access_token, client_id, "games", body).await?;
    if rows.is_empty() {
        Ok("Connected; IGDB returned an empty sample (unexpected but OK).".into())
    } else {
        Ok("Connected to Twitch and IGDB.".into())
    }
}
