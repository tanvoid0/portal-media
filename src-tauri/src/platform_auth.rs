use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

use crate::platform_sync::UserProfile;

pub struct SteamLoginResult {
    pub steam_id: String,
    pub access_token: String,
    pub profile: UserProfile,
}

pub struct EpicLoginResult {
    pub account_id: String,
    pub display_name: String,
    pub access_token: String,
    pub refresh_token: String,
}

pub struct GogLoginResult {
    pub user_id: String,
    pub username: String,
}

// Runs on every page load. When the logged-in store page is detected, redirects
// to our sentinel domain which on_navigation intercepts before any DNS lookup.
const STEAM_INIT_SCRIPT: &str = r#"
(function() {
    function checkForSteamToken() {
        var html = document.documentElement.outerHTML;
        var idMatch = html.match(/&quot;steamid&quot;:&quot;(\d+)&quot;/);
        var tokenMatch = html.match(/&quot;webapi_token&quot;:&quot;([A-Za-z0-9_\-]+)&quot;/);
        if (idMatch && tokenMatch) {
            window.location.replace(
                'https://portal-steam-callback.invalid/?steamid=' + idMatch[1] +
                '&token=' + encodeURIComponent(tokenMatch[1])
            );
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(checkForSteamToken, 400); });
    } else {
        setTimeout(checkForSteamToken, 400);
    }
})();
"#;

// After Epic login the /id/api/redirect page returns JSON containing
// "authorizationCode". We extract it and redirect to our sentinel domain.
const EPIC_INIT_SCRIPT: &str = r#"
(function() {
    function checkForEpicCode() {
        var html = document.documentElement.outerHTML;
        var codeMatch = html.match(/"authorizationCode"\s*:\s*"([a-zA-Z0-9]+)"/);
        if (!codeMatch) {
            codeMatch = html.match(/launcher\/authorized\?code=([a-zA-Z0-9]+)/i);
        }
        if (codeMatch) {
            window.location.replace(
                'https://portal-epic-callback.invalid/?code=' + codeMatch[1]
            );
            return;
        }
        var url = window.location.href;
        var directMatch = url.match(/[?&]code=([a-zA-Z0-9]+)/);
        if (directMatch && (url.includes('redirect') || url.includes('authorized'))) {
            window.location.replace(
                'https://portal-epic-callback.invalid/?code=' + directMatch[1]
            );
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(checkForEpicCode, 400); });
    } else {
        setTimeout(checkForEpicCode, 400);
    }
})();
"#;

// After GOG login the page embeds user data in inline scripts.
const GOG_INIT_SCRIPT: &str = r#"
(function() {
    function checkGogLogin() {
        var url = window.location.href;
        if (!url.includes('gog.com')) return;
        if (url.includes('openlogin') || url.includes('#login')) return;

        var scripts = document.querySelectorAll('script');
        var username = null;
        var userId = '0';
        for (var i = 0; i < scripts.length; i++) {
            var text = scripts[i].textContent || '';
            var nameMatch = text.match(/"username"\s*:\s*"([^"]+)"/);
            var idMatch = text.match(/"userId"\s*:\s*"?(\d+)"?/);
            if (nameMatch) username = nameMatch[1];
            if (idMatch) userId = idMatch[1];
            if (username) break;
        }
        if (username) {
            window.location.replace(
                'https://portal-gog-callback.invalid/?username=' + encodeURIComponent(username) +
                '&userId=' + encodeURIComponent(userId)
            );
        }
    }
    window.addEventListener('load', function() { setTimeout(checkGogLogin, 800); });
})();
"#;

// ── Steam ─────────────────────────────────────────────────────────────────────

pub async fn steam_login(app: AppHandle) -> Result<SteamLoginResult, String> {
    type SteamCreds = Result<(String, String), String>;
    let (tx, rx) = oneshot::channel::<SteamCreds>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx.clone();
    let tx_close = tx.clone();
    let app_nav = app.clone();

    let window = WebviewWindowBuilder::new(
        &app,
        "steam-login",
        WebviewUrl::External(
            "https://store.steampowered.com/explore/"
                .parse()
                .map_err(|_| "Invalid Steam URL".to_string())?,
        ),
    )
    .title("Sign in to Steam")
    .inner_size(600.0, 760.0)
    .center()
    .initialization_script(STEAM_INIT_SCRIPT)
    .on_navigation(move |url| {
        if url.host_str() == Some("portal-steam-callback.invalid") {
            let params: HashMap<_, _> = url.query_pairs().collect();
            let result: SteamCreds = match (params.get("steamid"), params.get("token")) {
                (Some(id), Some(tok)) => Ok((id.to_string(), tok.to_string())),
                _ => Err("Could not extract Steam credentials from login page".to_string()),
            };
            if let Ok(mut guard) = tx_nav.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
            if let Some(w) = app_nav.get_webview_window("steam-login") {
                let _ = w.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to open Steam login window: {e}"))?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut guard) = tx_close.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(Err("Login cancelled".to_string()));
                }
            }
        }
    });

    let (steam_id, access_token) = rx
        .await
        .map_err(|_| "Steam login channel closed unexpectedly".to_string())??;

    let mut profile = UserProfile {
        user_id: steam_id.clone(),
        display_name: "Steam User".to_string(),
        avatar_url: None,
    };

    if let Some(fetched) = crate::game_scanner::get_steam_user_profile().await {
        profile.display_name = fetched.display_name;
        profile.avatar_url = fetched.avatar_url;
    } else if let Some(avatar) = crate::game_scanner::fetch_steam_avatar(&steam_id).await {
        profile.avatar_url = Some(avatar);
    }

    Ok(SteamLoginResult {
        steam_id,
        access_token,
        profile,
    })
}

// ── Epic Games ────────────────────────────────────────────────────────────────

pub async fn epic_login(app: AppHandle) -> Result<EpicLoginResult, String> {
    type CodeResult = Result<String, String>;
    let (tx, rx) = oneshot::channel::<CodeResult>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx.clone();
    let tx_close = tx.clone();
    let app_nav = app.clone();

    let window = WebviewWindowBuilder::new(
        &app,
        "epic-login",
        WebviewUrl::External(
            // Epic rejects responseType=code without a client_id. Route through
            // /id/api/redirect (the launcher's own flow) which carries the id.
            concat!(
                "https://www.epicgames.com/id/login?redirectUrl=",
                "https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fredirect",
                "%3FclientId%3D", "34a02cf8f4414e29b15921876da36f9a",
                "%26responseType%3Dcode"
            )
            .parse()
            .map_err(|_| "Invalid Epic URL".to_string())?,
        ),
    )
    .title("Sign in to Epic Games")
    .inner_size(580.0, 700.0)
    .center()
    .initialization_script(EPIC_INIT_SCRIPT)
    .on_navigation(move |url| {
        if url.host_str() == Some("portal-epic-callback.invalid") {
            let params: HashMap<_, _> = url.query_pairs().collect();
            let result: CodeResult = params
                .get("code")
                .map(|c| c.to_string())
                .ok_or_else(|| "No auth code found in Epic callback".to_string());
            if let Ok(mut guard) = tx_nav.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
            if let Some(w) = app_nav.get_webview_window("epic-login") {
                let _ = w.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to open Epic login window: {e}"))?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut guard) = tx_close.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(Err("Login cancelled".to_string()));
                }
            }
        }
    });

    let auth_code = rx
        .await
        .map_err(|_| "Epic login channel closed unexpectedly".to_string())??;

    exchange_epic_auth_code(&auth_code).await
}

async fn exchange_epic_auth_code(code: &str) -> Result<EpicLoginResult, String> {
    // Public Epic launcher client credentials — base64("clientId:clientSecret").
    // These are intentionally public; Epic embeds them in the launcher binary.
    const EPIC_BASIC_AUTH: &str =
        "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";
    const OAUTH_URL: &str =
        "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let resp = client
        .post(OAUTH_URL)
        .header("Authorization", format!("Basic {EPIC_BASIC_AUTH}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!("grant_type=authorization_code&code={code}"))
        .send()
        .await
        .map_err(|e| format!("Epic token exchange request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Epic OAuth error {status}: {body}"));
    }

    #[derive(Deserialize)]
    struct EpicTokenResponse {
        access_token: String,
        refresh_token: String,
        account_id: String,
        #[serde(rename = "displayName")]
        display_name: Option<String>,
    }

    let token: EpicTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Epic token parse error: {e}"))?;

    Ok(EpicLoginResult {
        display_name: token
            .display_name
            .unwrap_or_else(|| token.account_id.clone()),
        account_id: token.account_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
    })
}

// ── GOG ───────────────────────────────────────────────────────────────────────

pub async fn gog_login(app: AppHandle) -> Result<GogLoginResult, String> {
    type GogResult = Result<GogLoginResult, String>;
    let (tx, rx) = oneshot::channel::<GogResult>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx.clone();
    let tx_close = tx.clone();
    let app_nav = app.clone();

    let window = WebviewWindowBuilder::new(
        &app,
        "gog-login",
        WebviewUrl::External(
            "https://www.gog.com/account/"
                .parse()
                .map_err(|_| "Invalid GOG URL".to_string())?,
        ),
    )
    .title("Sign in to GOG")
    .inner_size(600.0, 760.0)
    .center()
    .initialization_script(GOG_INIT_SCRIPT)
    .on_navigation(move |url| {
        if url.host_str() == Some("portal-gog-callback.invalid") {
            let params: HashMap<_, _> = url.query_pairs().collect();
            let result: GogResult = match params.get("username") {
                Some(name) => Ok(GogLoginResult {
                    username: name.to_string(),
                    user_id: params
                        .get("userId")
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                }),
                None => Err("Could not detect GOG username after login".to_string()),
            };
            if let Ok(mut guard) = tx_nav.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
            if let Some(w) = app_nav.get_webview_window("gog-login") {
                let _ = w.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to open GOG login window: {e}"))?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut guard) = tx_close.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(Err("Login cancelled".to_string()));
                }
            }
        }
    });

    rx.await
        .map_err(|_| "GOG login channel closed unexpectedly".to_string())?
}

// ── Xbox ──────────────────────────────────────────────────────────────────────
//
// Flow (same as Playnite):
//   1. Open Microsoft Live login page in WebView
//   2. on_navigation intercepts redirect to oauth20_desktop.srf?code=XXX
//   3. Exchange code for Live access/refresh tokens
//   4. Exchange Live token for Xbox user token
//   5. Exchange Xbox token for XSTS token (contains xid, uhs)
//   6. Fetch gamertag from Xbox profile API
//   7. Store all credentials

pub struct XboxLoginResult {
    pub xid: String,
    pub uhs: String,
    pub xsts_token: String,
    pub refresh_token: String,
    pub gamertag: String,
}

const XBOX_CLIENT_ID: &str = "38cd2fa8-66fd-4760-afb2-405eb65d5b0c";
const XBOX_REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
const XBOX_SCOPE: &str = "Xboxlive.signin Xboxlive.offline_access";

pub async fn xbox_login(app: AppHandle) -> Result<XboxLoginResult, String> {
    type CodeResult = Result<String, String>;
    let (tx, rx) = oneshot::channel::<CodeResult>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx.clone();
    let tx_close = tx.clone();
    let app_nav = app.clone();

    let scope_enc = urlencoding::encode(XBOX_SCOPE);
    let redirect_enc = urlencoding::encode(XBOX_REDIRECT_URI);
    let login_url = format!(
        "https://login.live.com/oauth20_authorize.srf\
        ?client_id={XBOX_CLIENT_ID}\
        &response_type=code\
        &approval_prompt=auto\
        &scope={scope_enc}\
        &redirect_uri={redirect_enc}"
    );

    let window = WebviewWindowBuilder::new(
        &app,
        "xbox-login",
        WebviewUrl::External(
            login_url
                .parse()
                .map_err(|_| "Invalid Xbox login URL".to_string())?,
        ),
    )
    .title("Sign in to Xbox")
    .inner_size(490.0, 560.0)
    .center()
    // No init script needed — auth code is in the redirect URL itself
    .on_navigation(move |url| {
        let url_str = url.as_str();
        // Microsoft redirects to oauth20_desktop.srf with ?code= after login
        if url_str.contains("oauth20_desktop.srf") {
            let params: HashMap<_, _> = url.query_pairs().collect();
            let result: CodeResult = params
                .get("code")
                .map(|c| c.to_string())
                .ok_or_else(|| "No auth code in Xbox callback URL".to_string());
            if let Ok(mut guard) = tx_nav.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
            if let Some(w) = app_nav.get_webview_window("xbox-login") {
                let _ = w.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to open Xbox login window: {e}"))?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut guard) = tx_close.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(Err("Login cancelled".to_string()));
                }
            }
        }
    });

    let auth_code = rx
        .await
        .map_err(|_| "Xbox login channel closed unexpectedly".to_string())??;

    exchange_xbox_auth_code(&auth_code).await
}

async fn exchange_xbox_auth_code(code: &str) -> Result<XboxLoginResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    // Stage 1: code → Live OAuth tokens
    let live_body = format!(
        "grant_type=authorization_code&code={code}\
        &scope={}&client_id={XBOX_CLIENT_ID}\
        &redirect_uri={}",
        urlencoding::encode(XBOX_SCOPE),
        urlencoding::encode(XBOX_REDIRECT_URI),
    );

    let live_resp = client
        .post("https://login.live.com/oauth20_token.srf")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(live_body)
        .send()
        .await
        .map_err(|e| format!("Live token request failed: {e}"))?;

    if !live_resp.status().is_success() {
        let s = live_resp.status();
        let b = live_resp.text().await.unwrap_or_default();
        return Err(format!("Live OAuth error {s}: {b}"));
    }

    #[derive(Deserialize)]
    struct LiveTokenResponse {
        access_token: String,
        refresh_token: String,
    }

    let live: LiveTokenResponse = live_resp
        .json()
        .await
        .map_err(|e| format!("Live token parse error: {e}"))?;

    // Stage 2: Live token → Xbox user token
    let xbox_auth_body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", live.access_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let xbox_auth_resp = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("x-xbl-contract-version", "1")
        .json(&xbox_auth_body)
        .send()
        .await
        .map_err(|e| format!("Xbox authenticate request failed: {e}"))?;

    if !xbox_auth_resp.status().is_success() {
        let s = xbox_auth_resp.status();
        let b = xbox_auth_resp.text().await.unwrap_or_default();
        return Err(format!("Xbox authenticate error {s}: {b}"));
    }

    #[derive(Deserialize)]
    struct XboxAuthResponse {
        #[serde(rename = "Token")]
        token: String,
    }

    let xbox_auth: XboxAuthResponse = xbox_auth_resp
        .json()
        .await
        .map_err(|e| format!("Xbox auth token parse error: {e}"))?;

    // Stage 3: Xbox token → XSTS token
    let xsts_body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbox_auth.token]
        },
        "RelyingParty": "http://xboxlive.com",
        "TokenType": "JWT"
    });

    let xsts_resp = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Content-Type", "application/json")
        .header("x-xbl-contract-version", "1")
        .json(&xsts_body)
        .send()
        .await
        .map_err(|e| format!("XSTS authorize request failed: {e}"))?;

    if !xsts_resp.status().is_success() {
        let s = xsts_resp.status();
        let b = xsts_resp.text().await.unwrap_or_default();
        return Err(format!("XSTS authorize error {s}: {b}"));
    }

    #[derive(Deserialize)]
    struct XuiClaim {
        xid: String,
        uhs: String,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct DisplayClaims {
        xui: Vec<XuiClaim>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct XstsResponse {
        token: String,
        display_claims: DisplayClaims,
    }

    let xsts: XstsResponse = xsts_resp
        .json()
        .await
        .map_err(|e| format!("XSTS token parse error: {e}"))?;

    let claim = xsts
        .display_claims
        .xui
        .into_iter()
        .next()
        .ok_or_else(|| "No XUI claim in XSTS response".to_string())?;

    // Stage 4: fetch gamertag
    let gamertag = fetch_xbox_gamertag(&client, &claim.xid, &claim.uhs, &xsts.token)
        .await
        .unwrap_or_else(|| "Xbox User".to_string());

    Ok(XboxLoginResult {
        xid: claim.xid,
        uhs: claim.uhs,
        xsts_token: xsts.token,
        refresh_token: live.refresh_token,
        gamertag,
    })
}

async fn fetch_xbox_gamertag(
    client: &reqwest::Client,
    xid: &str,
    uhs: &str,
    xsts_token: &str,
) -> Option<String> {
    let url = format!(
        "https://profile.xboxlive.com/users/xuid({xid})/profile/settings?settings=Gamertag"
    );
    let auth_header = format!("XBL3.0 x={uhs};{xsts_token}");

    let resp = client
        .get(&url)
        .header("Authorization", auth_header)
        .header("x-xbl-contract-version", "2")
        .header("Accept-Language", "en-US")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    #[derive(Deserialize)]
    struct Setting {
        value: String,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ProfileUser {
        settings: Vec<Setting>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ProfileResponse {
        profile_users: Vec<ProfileUser>,
    }

    let data: ProfileResponse = resp.json().await.ok()?;
    data.profile_users
        .into_iter()
        .next()?
        .settings
        .into_iter()
        .next()
        .map(|s| s.value)
}

// ── Ubisoft Connect ───────────────────────────────────────────────────────────
//
// Ubisoft has no public OAuth flow. Like Playnite, we read local files
// written by the Ubisoft Connect client itself.
// Username lives in %LOCALAPPDATA%\Ubisoft Game Launcher\settings.yml

pub struct UbisoftLocalProfile {
    pub username: String,
    pub user_id: String,
}

pub fn ubisoft_read_local_profile() -> Option<UbisoftLocalProfile> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let settings_path = std::path::PathBuf::from(&local)
        .join("Ubisoft Game Launcher")
        .join("settings.yml");

    if !settings_path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&settings_path).ok()?;

    let mut username = None;
    let mut user_id = None;
    let mut in_user_section = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "user:" {
            in_user_section = true;
            continue;
        }
        // Leave user section on un-indented key
        if in_user_section && !line.starts_with(' ') && !line.starts_with('\t') && !trimmed.is_empty() {
            in_user_section = false;
        }
        if in_user_section {
            if let Some(rest) = trimmed.strip_prefix("username:") {
                username = Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
            }
            if let Some(rest) = trimmed.strip_prefix("userId:").or_else(|| trimmed.strip_prefix("user_id:")) {
                user_id = Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }

    Some(UbisoftLocalProfile {
        username: username.unwrap_or_else(|| "Ubisoft User".to_string()),
        user_id: user_id.unwrap_or_default(),
    })
}
