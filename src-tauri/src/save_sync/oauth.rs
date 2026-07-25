use super::types::GoogleAccountInfo;
use crate::metadata;
use rand::Rng;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

pub const REDIRECT_PORT: u16 = 38476;
const REDIRECT_PATH: &str = "/oauth/callback";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
pub const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at_utc: i64,
    pub account: GoogleAccountInfo,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Deserialize)]
struct UserInfo {
    email: String,
    name: Option<String>,
}

fn pkce_pair() -> (String, String) {
    let verifier: String = (0..64)
        .map(|_| {
            let idx = rand::thread_rng().gen_range(0..52);
            (b'A' + (idx % 26) as u8) as char
        })
        .collect();
    let challenge = base64_url_no_pad(&Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

fn base64_url_no_pad(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

pub fn load_tokens() -> Result<Option<StoredTokens>, String> {
    let Some(raw) = metadata::get_google_drive_tokens() else {
        return Ok(None);
    };
    serde_json::from_str(&raw).map_err(|e| format!("Invalid stored Google tokens: {e}"))
}

pub fn store_tokens(tokens: &StoredTokens) -> Result<(), String> {
    let raw = serde_json::to_string(tokens).map_err(|e| e.to_string())?;
    metadata::save_google_drive_tokens(&raw)
}

pub fn clear_tokens() -> Result<(), String> {
    metadata::clear_google_drive_tokens()
}

pub fn access_token(client_id: &str) -> Result<String, String> {
    let mut tokens = load_tokens()?.ok_or_else(|| "Not signed in to Google Drive.".to_string())?;
    let now = chrono::Utc::now().timestamp();
    if tokens.expires_at_utc > now + 60 {
        return Ok(tokens.access_token);
    }
    refresh_access_token(client_id, &mut tokens)?;
    Ok(tokens.access_token)
}

fn refresh_access_token(client_id: &str, tokens: &mut StoredTokens) -> Result<(), String> {
    let client = Client::new();
    let res = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("grant_type", "refresh_token"),
            ("refresh_token", tokens.refresh_token.as_str()),
        ])
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!(
            "Google token refresh failed ({}): {}",
            res.status(),
            res.text().unwrap_or_default()
        ));
    }
    let body: TokenResponse = res.json().map_err(|e| e.to_string())?;
    tokens.access_token = body.access_token;
    let ttl = body.expires_in.unwrap_or(3600);
    tokens.expires_at_utc = chrono::Utc::now().timestamp() + ttl;
    store_tokens(tokens)?;
    Ok(())
}

pub fn sign_in(client_id: &str) -> Result<StoredTokens, String> {
    let (verifier, challenge) = pkce_pair();
    let redirect_uri = format!("http://127.0.0.1:{REDIRECT_PORT}{REDIRECT_PATH}");
    let auth_url = format!(
        "{AUTH_URL}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256",
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(DRIVE_SCOPE),
        urlencoding::encode(&challenge),
    );

    open_browser(&auth_url)?;

    let code = wait_for_auth_code()?;
    exchange_code(client_id, &code, &verifier, &redirect_uri)
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("Could not open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Could not open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Could not open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", all(unix, not(target_os = "macos")))))]
    {
        Err("OAuth browser launch is not supported on this platform.".into())
    }
}

fn wait_for_auth_code() -> Result<String, String> {
    let listener =
        TcpListener::bind(("127.0.0.1", REDIRECT_PORT)).map_err(|e| format!("OAuth callback port in use ({REDIRECT_PORT}): {e}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(300);
    loop {
        if Instant::now() > deadline {
            return Err("Google sign-in timed out. Try again.".into());
        }
        if let Ok((mut stream, _)) = listener.accept() {
            let _ = stream.set_nonblocking(false);
            if let Some(code) = read_oauth_code(&mut stream)? {
                send_oauth_success(&mut stream);
                return Ok(code);
            }
        }
        std::thread::sleep(Duration::from_millis(80));
    }
}

fn read_oauth_code(stream: &mut TcpStream) -> Result<Option<String>, String> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");
    if !path.starts_with(REDIRECT_PATH) {
        return Ok(None);
    }
    let query = path.split('?').nth(1).unwrap_or("");
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if kv.next() == Some("code") {
            if let Some(v) = kv.next() {
                return Ok(Some(urlencoding::decode(v).unwrap_or_default().into_owned()));
            }
        }
    }
    if query.contains("error=") {
        return Err("Google sign-in was cancelled or denied.".into());
    }
    Ok(None)
}

fn send_oauth_success(stream: &mut TcpStream) {
    let body = "<html><body><h2>Signed in</h2><p>You can close this tab and return to Portal Media.</p></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
}

fn exchange_code(
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<StoredTokens, String> {
    let client = Client::new();
    let res = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", verifier),
        ])
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!(
            "Google token exchange failed ({}): {}",
            res.status(),
            res.text().unwrap_or_default()
        ));
    }
    let body: TokenResponse = res.json().map_err(|e| e.to_string())?;
    let refresh = body
        .refresh_token
        .ok_or_else(|| "Google did not return a refresh token. Revoke app access and sign in again.".to_string())?;
    let account = fetch_userinfo(&body.access_token)?;
    let ttl = body.expires_in.unwrap_or(3600);
    let tokens = StoredTokens {
        access_token: body.access_token,
        refresh_token: refresh,
        expires_at_utc: chrono::Utc::now().timestamp() + ttl,
        account,
    };
    store_tokens(&tokens)?;
    Ok(tokens)
}

fn fetch_userinfo(access_token: &str) -> Result<GoogleAccountInfo, String> {
    let client = Client::new();
    let res = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Ok(GoogleAccountInfo {
            email: "Google account".into(),
            display_name: None,
        });
    }
    let info: UserInfo = res.json().map_err(|e| e.to_string())?;
    Ok(GoogleAccountInfo {
        email: info.email,
        display_name: info.name,
    })
}
