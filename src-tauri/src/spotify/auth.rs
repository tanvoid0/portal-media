use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::metadata::secrets;

const SPOTIFY_AUTH_URL: &str = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const SPOTIFY_SCOPES: &str =
    "streaming user-read-email user-read-private \
     user-read-playback-state user-modify-playback-state user-read-currently-playing \
     user-library-read user-library-modify \
     playlist-read-private playlist-read-collaborative \
     user-follow-read user-top-read user-read-recently-played";

fn code_verifier() -> String {
    let mut bytes = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn code_challenge(verifier: &str) -> String {
    let mut h = Sha256::new();
    h.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(h.finalize())
}

fn random_state() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Start PKCE auth flow. Returns the auth URL. Spawns a background task that
/// waits for the OAuth callback, exchanges the code, and stores tokens.
pub async fn start_auth_flow(client_id: &str) -> Result<String, String> {
    let verifier = code_verifier();
    let challenge = code_challenge(&verifier);
    let state = random_state();

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Could not start auth server: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    secrets::save_spotify_client_id(client_id)?;

    let auth_url = format!(
        "{SPOTIFY_AUTH_URL}?client_id={}&response_type=code&redirect_uri={}&scope={}&code_challenge_method=S256&code_challenge={}&state={}",
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SPOTIFY_SCOPES),
        challenge,
        state,
    );

    let cid = client_id.to_string();
    let state_copy = state.clone();
    let verifier_copy = verifier.clone();
    let redir_copy = redirect_uri.clone();

    tokio::spawn(async move {
        match callback_server(listener, &state_copy).await {
            Ok(code) => {
                if let Err(e) =
                    exchange_code(&cid, &code, &verifier_copy, &redir_copy).await
                {
                    eprintln!("spotify: token exchange failed: {e}");
                }
            }
            Err(e) => eprintln!("spotify: callback failed: {e}"),
        }
    });

    Ok(auth_url)
}

async fn callback_server(
    listener: tokio::net::TcpListener,
    expected_state: &str,
) -> Result<String, String> {
    let (mut stream, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Accept failed: {e}"))?;

    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Read failed: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let path = request
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("");

    let query = path.splitn(2, '?').nth(1).unwrap_or("");
    let params: std::collections::HashMap<_, _> = query
        .split('&')
        .filter_map(|pair| {
            let mut kv = pair.splitn(2, '=');
            Some((kv.next()?, kv.next()?))
        })
        .collect();

    if params.get("state").copied() != Some(expected_state) {
        return Err("OAuth state mismatch".into());
    }

    let code = params
        .get("code")
        .copied()
        .filter(|c| !c.is_empty())
        .ok_or("No code in callback")?
        .to_string();

    let html = r#"<!DOCTYPE html><html><head><meta charset="utf-8"><title>Portal Media</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.wrap{padding:2rem}.logo{font-size:2rem;font-weight:700;color:#1db954;margin-bottom:1rem}p{color:#999;font-size:1rem}</style>
</head><body><div class="wrap"><div class="logo">Connected!</div><p>Return to Portal Media. You can close this tab.</p></div></body></html>"#;
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes()).await;

    Ok(code)
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

async fn exchange_code(
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<(), String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", client_id),
        ("code_verifier", verifier),
    ];

    let resp = client
        .post(SPOTIFY_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed ({status}): {body}"));
    }

    let token: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    store_tokens(&token)
}

fn store_tokens(token: &TokenResponse) -> Result<(), String> {
    let expiry = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + token.expires_in;

    secrets::save_spotify_access_token(&token.access_token)?;
    if let Some(r) = &token.refresh_token {
        secrets::save_spotify_refresh_token(r)?;
    }
    secrets::save_spotify_token_expiry(&expiry.to_string())?;
    Ok(())
}

/// Returns a valid access token, refreshing if needed.
pub async fn get_valid_token() -> Result<String, String> {
    let expiry: u64 = secrets::get_spotify_token_expiry()
        .and_then(|s: String| s.parse().ok())
        .unwrap_or(0);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if expiry > now + 60 {
        return secrets::get_spotify_access_token().ok_or_else(|| "No access token".into());
    }

    let client_id = secrets::get_spotify_client_id().ok_or("Spotify not configured")?;
    let refresh = secrets::get_spotify_refresh_token().ok_or("No refresh token; reconnect Spotify")?;
    refresh_token(&client_id, &refresh).await
}

async fn refresh_token(client_id: &str, refresh_token: &str) -> Result<String, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
    ];

    let resp = client
        .post(SPOTIFY_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed ({status}): {body}"));
    }

    let token: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    let access = token.access_token.clone();
    store_tokens(&token)?;
    Ok(access)
}

pub fn spotify_configured() -> bool {
    secrets::get_spotify_client_id()
        .map(|s: String| !s.trim().is_empty())
        .unwrap_or(false)
        && secrets::get_spotify_refresh_token()
            .map(|s: String| !s.trim().is_empty())
            .unwrap_or(false)
}

pub fn disconnect() -> Result<(), String> {
    secrets::clear_spotify_tokens()
}
