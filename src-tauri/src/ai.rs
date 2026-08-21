//! Optional AI assist backed by any OpenAI-compatible endpoint.
//!
//! Default target is a local Agent Platform host (`http://127.0.0.1:18410`), which exposes
//! `/v1/models` and `/v1/chat/completions`. The bearer token lives in the OS credential store
//! (same storage as the metadata keys); the frontend never sees it.

use crate::metadata::secrets;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:18410";

/// ponytail: the whole library goes into one prompt. Cap keeps local models responsive;
/// switch to embeddings (`/v1/embeddings`) if libraries routinely exceed this.
const MAX_ITEMS: usize = 400;

/// Local models are slow on a cold load; generous but bounded.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

const SYSTEM_PROMPT: &str = "You match library entries to a user's request. \
You are given a numbered list of games, apps and media a user owns, then a request. \
Reply with ONLY a JSON array of the numbers that match, best match first, at most 25 entries. \
No prose, no code fences. If nothing matches, reply with [].";

#[derive(Debug, Deserialize)]
pub struct AiGame {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub category: String,
}

#[derive(Debug, Serialize)]
pub struct AiSearchResult {
    /// Library ids, best match first.
    pub ids: Vec<String>,
    /// True when the library was truncated before being sent to the model.
    pub truncated: bool,
}

fn normalize_base(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        trimmed.to_string()
    }
}

fn token() -> Result<String, String> {
    secrets::get_ai_token()
        .filter(|t| !t.trim().is_empty())
        .ok_or_else(|| "No AI token saved. Add one in Settings → API.".to_string())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Could not create HTTP client: {e}"))
}

/// Turn a transport error into something a user can act on.
fn transport_error(base: &str, e: reqwest::Error) -> String {
    if e.is_connect() {
        format!("Could not reach {base}. Is the AI server running?")
    } else if e.is_timeout() {
        format!("{base} did not respond in time.")
    } else {
        format!("Request to {base} failed: {e}")
    }
}

fn status_error(status: reqwest::StatusCode, body: &str) -> String {
    match status.as_u16() {
        401 | 403 => "AI server rejected the token (401/403). Check the token in Settings → API.".to_string(),
        404 => "Endpoint not found (404). Check the base URL — it should be the host root, not a /v1 path.".to_string(),
        _ => {
            let snippet: String = body.chars().take(300).collect();
            format!("AI server returned {status}: {snippet}")
        }
    }
}

#[tauri::command]
pub fn ai_configured() -> bool {
    secrets::get_ai_token()
        .map(|t| !t.trim().is_empty())
        .unwrap_or(false)
}

#[tauri::command]
pub fn ai_save_token(token: String) -> Result<(), String> {
    let t = token.trim();
    if t.is_empty() {
        return Err("Enter a token.".into());
    }
    secrets::save_ai_token(t)
}

#[tauri::command]
pub fn ai_clear_token() -> Result<(), String> {
    secrets::clear_ai_token()
}

/// `GET /v1/models` — also serves as the connection test in Settings.
#[tauri::command]
pub async fn ai_list_models(base_url: String) -> Result<Vec<String>, String> {
    let base = normalize_base(&base_url);
    let token = token()?;
    let res = client()?
        .get(format!("{base}/v1/models"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| transport_error(&base, e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(status_error(status, &body));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Unexpected /v1/models response: {e}"))?;
    let mut ids: Vec<String> = parsed["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    ids.sort();
    if ids.is_empty() {
        return Err("Server returned no models.".into());
    }
    Ok(ids)
}

/// Natural-language library filter: "co-op games I haven't played", "something short and relaxing".
#[tauri::command]
pub async fn ai_library_search(
    base_url: String,
    model: String,
    query: String,
    games: Vec<AiGame>,
) -> Result<AiSearchResult, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("Enter a search request.".into());
    }
    if model.trim().is_empty() {
        return Err("Pick a model in Settings → API.".into());
    }
    if games.is_empty() {
        return Ok(AiSearchResult { ids: Vec::new(), truncated: false });
    }

    let base = normalize_base(&base_url);
    let token = token()?;

    let truncated = games.len() > MAX_ITEMS;
    let sent = &games[..games.len().min(MAX_ITEMS)];

    let mut catalog = String::new();
    for (i, g) in sent.iter().enumerate() {
        catalog.push_str(&format!(
            "{}. {} [{} · {}]\n",
            i + 1,
            g.name,
            if g.category.is_empty() { "?" } else { &g.category },
            if g.platform.is_empty() { "?" } else { &g.platform },
        ));
    }

    let user = format!("Library:\n{catalog}\nRequest: {q}\n\nJSON array of matching numbers:");

    let body = serde_json::json!({
        "model": model,
        "temperature": 0,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": user },
        ],
    });

    let res = client()?
        .post(format!("{base}/v1/chat/completions"))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| transport_error(&base, e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(status_error(status, &text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Unexpected chat response: {e}"))?;
    let content = parsed["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "Model returned no content.".to_string())?;

    let ids = extract_indices(content)
        .into_iter()
        .filter_map(|n| sent.get(n.checked_sub(1)?))
        .map(|g| g.id.clone())
        .collect();

    Ok(AiSearchResult { ids, truncated })
}

/// Pull 1-based indices out of a model reply. Tolerates code fences and stray prose around
/// the array; falls back to any bare numbers when no array is present.
fn extract_indices(content: &str) -> Vec<usize> {
    let slice = match (content.find('['), content.rfind(']')) {
        (Some(start), Some(end)) if end > start => &content[start + 1..end],
        _ => content,
    };
    let mut seen = std::collections::HashSet::new();
    slice
        .split(|c: char| !c.is_ascii_digit())
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<usize>().ok())
        .filter(|n| *n > 0 && seen.insert(*n))
        .take(25)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::extract_indices;

    #[test]
    fn parses_model_replies() {
        assert_eq!(extract_indices("[3, 1, 12]"), vec![3, 1, 12]);
        assert_eq!(extract_indices("```json\n[4,4,5]\n```"), vec![4, 5]);
        assert_eq!(extract_indices("Sure! Here you go: [7]"), vec![7]);
        assert_eq!(extract_indices("[]"), Vec::<usize>::new());
        assert_eq!(extract_indices("I think 2 and 9 fit."), vec![2, 9]);
        assert_eq!(extract_indices("[0, 3]"), vec![3]); // 0 is not a valid 1-based index
        assert_eq!(extract_indices("nothing matched"), Vec::<usize>::new());
    }
}
