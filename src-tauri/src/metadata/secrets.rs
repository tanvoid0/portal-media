//! OS-backed secret storage (Credential Manager / Keychain / libsecret) plus a
//! JSON mirror under the app support directory.
//!
//! On Windows we have seen `set_password` + immediate read on the same handle succeed while a
//! fresh `Entry` cannot read the credential a moment later. After any successful keyring write we
//! always mirror to the JSON file so later reads (and `tmdb_configured`) stay consistent.

use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const SERVICE: &str = "com.tanvoid0.portal-media";

const IGDB_CLIENT_ID: &str = "metadata_igdb_client_id";
const IGDB_CLIENT_SECRET: &str = "metadata_igdb_client_secret";
const TMDB_API_KEY: &str = "metadata_tmdb_api_key";

const FALLBACK_FILE: &str = "metadata_keyring_fallback.json";

/// Set `PORTAL_MEDIA_DEBUG_SECRETS=1` (or `true` / `yes`) before launch, or run a **debug** build,
/// to print storage diagnostics to **stderr**. Secret values are never logged — only lengths and paths.
pub(crate) fn secrets_trace_enabled() -> bool {
    cfg!(debug_assertions)
        || std::env::var("PORTAL_MEDIA_DEBUG_SECRETS")
            .map(|v| {
                matches!(
                    v.to_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(false)
}

fn trace(line: impl std::fmt::Display) {
    if secrets_trace_enabled() {
        eprintln!("[portal-media::secrets] {line}");
    }
}

/// If save succeeded but `tmdb_configured()` is still false, log storage state (no secret values).
pub fn diagnose_tmdb_entry_after_failed_verify(expected_char_len: usize) {
    if !secrets_trace_enabled() {
        eprintln!(
            "[portal-media::secrets] TMDB save verify failed (~{expected_char_len} chars expected). \
             Set PORTAL_MEDIA_DEBUG_SECRETS=1 and launch from a terminal for details."
        );
        return;
    }

    trace(format_args!(
        "diagnose TMDB: service={SERVICE} key={TMDB_API_KEY} expected_chars={expected_char_len}"
    ));

    match (app_support_dir(), fallback_path()) {
        (Ok(dir), Ok(fp)) => trace(format_args!(
            "app_support_dir={} fallback_file={} exists={}",
            dir.display(),
            fp.display(),
            fp.exists()
        )),
        (Err(e), _) | (_, Err(e)) => trace(format_args!("path resolution: {e}")),
    }

    let kr_line = match Entry::new(SERVICE, TMDB_API_KEY) {
        Ok(entry) => match entry.get_password() {
            Ok(s) => format!("Ok chars={}", s.chars().count()),
            Err(e) => format!("Err {e}"),
        },
        Err(e) => format!("Entry::new Err {e}"),
    };
    trace(format_args!("keyring fresh read: {kr_line}"));

    let via_get = get_entry(TMDB_API_KEY);
    trace(format_args!(
        "get_entry: {}",
        via_get
            .as_ref()
            .map(|s| format!("Some(chars={})", s.chars().count()))
            .unwrap_or_else(|| "None".into())
    ));

    let keys: Vec<_> = fallback_load().0.entries.keys().cloned().collect();
    trace(format_args!("fallback JSON keys: {keys:?}"));
}

/// Matches Tauri `app.path().app_data_dir()` layout (see `identifier` in `tauri.conf.json`).
fn app_support_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let roaming =
            std::env::var("APPDATA").map_err(|_| "APPDATA is not set; cannot locate app data.")?;
        Ok(PathBuf::from(roaming).join("com.tanvoid0.portal-media"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME is not set.")?;
        Ok(PathBuf::from(home).join("Library/Application Support/com.tanvoid0.portal-media"))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME is not set.")?;
        let base = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| format!("{home}/.local/share"));
        Ok(PathBuf::from(base).join("com.tanvoid0.portal-media"))
    }
    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        all(unix, not(target_os = "macos"))
    )))]
    {
        Err("Unsupported platform for metadata secret storage.".into())
    }
}

fn fallback_path() -> Result<PathBuf, String> {
    Ok(app_support_dir()?.join(FALLBACK_FILE))
}

#[derive(Default, Serialize, Deserialize)]
struct FallbackFile {
    #[serde(default)]
    entries: HashMap<String, String>,
}

fn fallback_read_disk(path: &Path) -> FallbackFile {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn fallback_load() -> (FallbackFile, Option<PathBuf>) {
    match fallback_path() {
        Ok(path) if path.exists() => (fallback_read_disk(&path), Some(path)),
        Ok(path) => (FallbackFile::default(), Some(path)),
        Err(_) => (FallbackFile::default(), None),
    }
}

/// Best-effort: keep the plaintext mirror readable only by the owning user on Unix.
fn restrict_secret_file_permissions(path: &Path) {
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let ok = std::fs::metadata(path)
            .ok()
            .and_then(|meta| {
                let mut perms = meta.permissions();
                perms.set_mode(0o600);
                std::fs::set_permissions(path, perms).ok()
            })
            .is_some();
        if secrets_trace_enabled() {
            trace(format_args!(
                "restrict {} permissions (0600): {}",
                path.display(),
                if ok { "ok" } else { "skipped/failed" }
            ));
        }
    }
}

fn fallback_save(file: FallbackFile, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create app data dir failed: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("Write fallback credentials file failed: {e}"))?;
    restrict_secret_file_permissions(path);
    Ok(())
}

fn fallback_get(key: &str) -> Option<String> {
    let (file, _) = fallback_load();
    file.entries.get(key).cloned().filter(|s| !s.trim().is_empty())
}

fn fallback_set(key: &str, value: &str) -> Result<(), String> {
    let (mut file, path) = fallback_load();
    let path = path.ok_or_else(|| "Could not resolve app support path.".to_string())?;
    file.entries.insert(key.to_string(), value.to_string());
    fallback_save(file, &path)
}

fn fallback_delete(key: &str) -> Result<(), String> {
    let (mut file, path) = fallback_load();
    let Some(path) = path else {
        return Ok(());
    };
    if !path.exists() {
        return Ok(());
    }
    file.entries.remove(key);
    if file.entries.is_empty() {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    fallback_save(file, &path)
}

fn set_entry(key: &str, value: &str) -> Result<(), String> {
    let value_chars = value.chars().count();
    trace(format_args!(
        "set_entry: key_id={key} value_chars={value_chars} (value not logged)"
    ));

    let entry = Entry::new(SERVICE, key).map_err(|e| format!("Keyring: could not open entry — {e}"))?;

    match entry.set_password(value) {
        Ok(()) => {
            trace("set_password: Ok");
            let round_trip_ok = match entry.get_password() {
                Ok(got) => {
                    let empty = got.trim().is_empty();
                    let matches = got.trim() == value.trim();
                    trace(format_args!(
                        "round_trip (same Entry): got_chars={} empty={empty} matches={matches}",
                        got.chars().count()
                    ));
                    !empty && matches
                }
                Err(e) => {
                    trace(format_args!("round_trip (same Entry): Err {e}"));
                    false
                }
            };

            if !round_trip_ok {
                eprintln!(
                    "portal-media: keyring round-trip failed for {key} — mirroring to {FALLBACK_FILE}"
                );
            }

            // Always mirror after a successful keyring write; Windows often fails a fresh read
            // moments later, and `get_entry` falls back to this file.
            let r = fallback_set(key, value);
            trace(if r.is_ok() {
                "fallback mirror: Ok"
            } else {
                "fallback mirror: failed"
            });
            r
        }
        Err(ke) => {
            let kr_msg = ke.to_string();
            trace(format_args!("set_password: Err {kr_msg}"));
            match fallback_set(key, value) {
                Ok(()) => {
                    eprintln!(
                        "portal-media: keyring set_password failed ({kr_msg}); saved to {FALLBACK_FILE}."
                    );
                    Ok(())
                }
                Err(fe) => Err(format!(
                    "Could not save to OS credential store ({kr_msg}). \
                     File fallback also failed ({fe}). \
                     Check disk space, antivirus blocking writes to your app data folder, \
                     or try running once as your normal user account (not elevated)."
                )),
            }
        }
    }
}

fn get_entry(key: &str) -> Option<String> {
    if let Ok(entry) = Entry::new(SERVICE, key) {
        if let Ok(v) = entry.get_password() {
            if !v.trim().is_empty() {
                return Some(v);
            }
        }
    }
    fallback_get(key)
}

fn delete_entry(key: &str) -> Result<(), String> {
    if let Ok(entry) = Entry::new(SERVICE, key) {
        match entry.delete_credential() {
            Ok(()) => {}
            Err(keyring::Error::NoEntry) => {}
            Err(e) => {
                eprintln!("portal-media: keyring delete warning — {e}");
            }
        }
    }
    fallback_delete(key)
}

pub fn igdb_configured() -> bool {
    get_entry(IGDB_CLIENT_ID)
        .map(|id| !id.trim().is_empty())
        .unwrap_or(false)
        && get_entry(IGDB_CLIENT_SECRET)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
}

pub fn get_igdb_credentials() -> Option<(String, String)> {
    let id = get_entry(IGDB_CLIENT_ID)?;
    let secret = get_entry(IGDB_CLIENT_SECRET)?;
    if id.trim().is_empty() || secret.trim().is_empty() {
        return None;
    }
    Some((id, secret))
}

pub fn save_igdb_credentials(client_id: &str, client_secret: &str) -> Result<(), String> {
    set_entry(IGDB_CLIENT_ID, client_id)?;
    set_entry(IGDB_CLIENT_SECRET, client_secret)?;
    Ok(())
}

pub fn clear_igdb_credentials() -> Result<(), String> {
    delete_entry(IGDB_CLIENT_ID)?;
    delete_entry(IGDB_CLIENT_SECRET)?;
    Ok(())
}

pub fn tmdb_configured() -> bool {
    get_entry(TMDB_API_KEY)
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
}

pub fn get_tmdb_api_key() -> Option<String> {
    let k = get_entry(TMDB_API_KEY)?;
    if k.trim().is_empty() {
        return None;
    }
    Some(k)
}

pub fn save_tmdb_api_key(key: &str) -> Result<(), String> {
    set_entry(TMDB_API_KEY, key)
}

pub fn clear_tmdb_api_key() -> Result<(), String> {
    delete_entry(TMDB_API_KEY)
}
