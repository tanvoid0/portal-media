//! Optional streaming catalog add-on loaded from a zip **outside** the repository (no Vite/build merge).
//! **Human documentation:** repository root [`docs/PLUGINS.md`](../../docs/PLUGINS.md) — manifest schema, packaging, discovery, roadmap.
//!
//! ## Zip layout
//! Archive must contain exactly one root entry named `manifest.json` (UTF-8 JSON, preferably without BOM):
//!
//! ```json
//! {
//!   "id": "my-addon",
//!   "version": "1",
//!   "enabled": true,
//!   "displayName": "…",
//!   "webOrigin": "https://…",
//!   "icon": { "faviconDomain": "…" },
//!   "features": {
//!     "libraryBookmark": true,
//!     "tmdbStreamButton": true
//!   },
//!   "browserBrand": {
//!     "hostSuffixes": ["example.com"],
//!     "accentColor": "#7c6cff",
//!     "nameIncludes": ["bookmark title substring"]
//!   }
//! }
//! ```
//!
//! `browserBrand` is optional; when set, the in-app browser tile can match those hosts / bookmark names.
//!
//! ## Where zips are looked up
//! When `load_streaming_addon` is called with a non-empty `override_zip_path` and that file exists, it wins.
//! Otherwise the first existing candidate wins, in order:
//! 1. `PORTAL_MEDIA_STREAMING_ADDON_ZIP`
//! 2. `{resolved_plugins}/media-stream-addon.zip` (default: `{app_data}/plugins/`, or a **saved custom plugins folder**)
//! 3. `{current_working_dir}/plugins/media-stream-addon.zip` (local dev; folder is gitignored in the repo)
//! 4. `{current_working_dir}/../media-stream-addon.zip`
//! 5. `{executable_parent}/../media-stream-addon.zip`
//!
//! `list_streaming_catalog_addons` also lists every `*.zip` under the **resolved** user plugins folder
//! (default `{app_data}/plugins/`, or a saved **custom folder** from settings) and `./plugins/` under the
//! process working directory.

use serde::Serialize;
use std::collections::{BTreeMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};

const ADDON_ZIP_NAME: &str = "media-stream-addon.zip";
const MANIFEST_ENTRY: &str = "manifest.json";
const PLUGINS_SUBDIR: &str = "plugins";

/// Same layout as `metadata::secrets::app_support_dir` / Tauri `app.path().app_data_dir()`.
fn portal_app_data_dir() -> Result<PathBuf, String> {
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
        Err("Unsupported platform for plugin storage.".into())
    }
}

fn default_user_plugins_dir() -> Option<PathBuf> {
    portal_app_data_dir().ok().map(|d| d.join(PLUGINS_SUBDIR))
}

/// When `plugins_dir_override` is non-empty after trim, that directory replaces the app-data `plugins`
/// folder for scanning, default zip resolution, and delete allowances. Empty / absent → app data.
fn resolved_user_plugins_dir(plugins_dir_override: Option<&str>) -> Option<PathBuf> {
    let trimmed = plugins_dir_override.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    match trimmed {
        None => default_user_plugins_dir(),
        Some(path_str) => {
            let p = PathBuf::from(path_str);
            if p.exists() && !p.is_dir() {
                eprintln!(
                    "[streaming_addon] plugins dir override is not a directory: {}",
                    p.display()
                );
                return default_user_plugins_dir();
            }
            Some(p)
        }
    }
}

fn ensure_user_plugins_dir_resolved(plugins_dir_override: Option<&str>) {
    if let Some(dir) = resolved_user_plugins_dir(plugins_dir_override) {
        let _ = std::fs::create_dir_all(&dir);
    }
}

fn sorted_zip_paths_in_dir(dir: &Path) -> Vec<PathBuf> {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut paths: Vec<PathBuf> = rd
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            (p.extension()?.to_str()? == "zip").then_some(p)
        })
        .collect();
    paths.sort();
    paths
}

fn push_zips_from_dir(map: &mut BTreeMap<String, (PathBuf, Vec<String>)>, dir: &Path, location_label: &str) {
    for p in sorted_zip_paths_in_dir(dir) {
        let name = p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let label = format!("{location_label} · {name}");
        push_candidate(map, p, &label);
    }
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonIcon {
    pub favicon_domain: String,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonFeatures {
    #[serde(default = "feat_default_bookmark")]
    pub library_bookmark: bool,
    #[serde(default = "feat_default_stream")]
    pub tmdb_stream_button: bool,
}

impl Default for StreamingAddonFeatures {
    fn default() -> Self {
        Self {
            library_bookmark: true,
            tmdb_stream_button: true,
        }
    }
}

fn feat_default_bookmark() -> bool {
    true
}
fn feat_default_stream() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonBrowserBrand {
    #[serde(default)]
    pub host_suffixes: Vec<String>,
    #[serde(default)]
    pub accent_color: Option<String>,
    #[serde(default)]
    pub name_includes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonManifest {
    pub id: String,
    pub version: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub display_name: String,
    pub web_origin: String,
    pub icon: StreamingAddonIcon,
    #[serde(default)]
    pub features: StreamingAddonFeatures,
    #[serde(default)]
    pub browser_brand: Option<StreamingAddonBrowserBrand>,
}

fn default_true() -> bool {
    true
}

fn normalize_origin(origin: &str) -> String {
    origin.trim().trim_end_matches('/').to_string()
}

fn path_if_file(p: PathBuf) -> Option<PathBuf> {
    if p.is_file() {
        std::fs::canonicalize(&p).ok().or(Some(p))
    } else {
        None
    }
}

fn disabled_path_set(paths: Option<Vec<String>>) -> HashSet<String> {
    let mut out = HashSet::new();
    for s in paths.into_iter().flatten() {
        let t = s.trim();
        if t.is_empty() {
            continue;
        }
        let p = PathBuf::from(t);
        if let Ok(c) = p.canonicalize() {
            out.insert(c.to_string_lossy().into_owned());
        } else {
            out.insert(t.to_string());
        }
    }
    out
}

fn path_key_in_disabled(canonical_display: &str, disabled: &HashSet<String>) -> bool {
    disabled.contains(canonical_display)
        || disabled.iter().any(|d| {
            PathBuf::from(d)
                .canonicalize()
                .ok()
                .is_some_and(|p| p.to_string_lossy() == canonical_display)
        })
}

fn streaming_addon_auto_candidates(plugins_dir_override: Option<&str>) -> Vec<PathBuf> {
    let mut chain = Vec::new();
    if let Ok(from_env) = std::env::var("PORTAL_MEDIA_STREAMING_ADDON_ZIP") {
        chain.push(PathBuf::from(from_env.trim()));
    }
    if let Some(dir) = resolved_user_plugins_dir(plugins_dir_override) {
        chain.push(dir.join(ADDON_ZIP_NAME));
    }
    if let Ok(cwd) = std::env::current_dir() {
        chain.push(cwd.join(PLUGINS_SUBDIR).join(ADDON_ZIP_NAME));
        if let Some(parent) = cwd.parent() {
            chain.push(parent.join(ADDON_ZIP_NAME));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            chain.push(dir.join("..").join(ADDON_ZIP_NAME));
        }
    }
    chain
}

fn first_existing_zip_in_chain(chain: &[PathBuf], disabled: &HashSet<String>) -> Option<PathBuf> {
    for raw in chain {
        if let Some(ok) = path_if_file(raw.clone()) {
            let key = ok.to_string_lossy().into_owned();
            if path_key_in_disabled(&key, disabled) {
                continue;
            }
            return Some(ok);
        }
    }
    None
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonSummary {
    pub id: String,
    pub version: String,
    pub display_name: String,
    pub enabled: bool,
    pub web_origin: String,
    pub icon_favicon_domain: String,
    pub library_bookmark: bool,
    pub tmdb_stream_button: bool,
    pub browser_brand_rule_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingAddonListEntry {
    pub path: String,
    pub discovery_sources: Vec<String>,
    pub summary: Option<StreamingAddonSummary>,
    pub error: Option<String>,
    pub is_active: bool,
    pub is_user_disabled: bool,
}

fn push_candidate(map: &mut BTreeMap<String, (PathBuf, Vec<String>)>, raw: PathBuf, label: &str) {
    let Some(canonical) = path_if_file(raw) else {
        return;
    };
    let key = canonical.to_string_lossy().to_string();
    map.entry(key)
        .and_modify(|(_, labels)| {
            let l = label.to_string();
            if !labels.contains(&l) {
                labels.push(l);
            }
        })
        .or_insert_with(|| (canonical, vec![label.to_string()]));
}

fn collect_addon_candidates(
    override_zip_path: Option<String>,
    preview_zip_path: Option<String>,
    plugins_dir_override: Option<&str>,
) -> Vec<(PathBuf, Vec<String>)> {
    ensure_user_plugins_dir_resolved(plugins_dir_override);
    let mut map: BTreeMap<String, (PathBuf, Vec<String>)> = BTreeMap::new();
    let using_custom_plugins_folder = plugins_dir_override
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    if let Some(s) = preview_zip_path {
        let t = s.trim();
        if !t.is_empty() {
            push_candidate(
                &mut map,
                PathBuf::from(t),
                "Path in settings field (save in Settings to persist)",
            );
        }
    }

    if let Some(s) = override_zip_path {
        let t = s.trim();
        if !t.is_empty() {
            push_candidate(
                &mut map,
                PathBuf::from(t),
                "Saved settings path",
            );
        }
    }

    if let Ok(from_env) = std::env::var("PORTAL_MEDIA_STREAMING_ADDON_ZIP") {
        push_candidate(
            &mut map,
            PathBuf::from(from_env.trim()),
            "Environment PORTAL_MEDIA_STREAMING_ADDON_ZIP",
        );
    }

    if let Some(dir) = resolved_user_plugins_dir(plugins_dir_override) {
        let label = if using_custom_plugins_folder {
            "Custom plugins folder"
        } else {
            "App data (plugins folder)"
        };
        push_zips_from_dir(&mut map, &dir, label);
    }

    if let Ok(cwd) = std::env::current_dir() {
        let repo_plugins = cwd.join(PLUGINS_SUBDIR);
        if repo_plugins.is_dir() {
            push_zips_from_dir(
                &mut map,
                &repo_plugins,
                "Project plugins/",
            );
        }
        if let Some(parent) = cwd.parent() {
            push_candidate(
                &mut map,
                parent.join(ADDON_ZIP_NAME),
                &format!("{ADDON_ZIP_NAME} next to working-directory parent"),
            );
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_candidate(
                &mut map,
                dir.join("..").join(ADDON_ZIP_NAME),
                &format!("{ADDON_ZIP_NAME} next to executable (..\\)"),
            );
        }
    }

    map.into_values().collect()
}

fn summary_from_manifest(m: StreamingAddonManifest) -> StreamingAddonSummary {
    let browser_brand_rule_count = m
        .browser_brand
        .as_ref()
        .map(|b| b.host_suffixes.len() + b.name_includes.len())
        .unwrap_or(0);
    StreamingAddonSummary {
        id: m.id,
        version: m.version,
        display_name: m.display_name,
        enabled: m.enabled,
        web_origin: m.web_origin.clone(),
        icon_favicon_domain: m.icon.favicon_domain,
        library_bookmark: m.features.library_bookmark,
        tmdb_stream_button: m.features.tmdb_stream_button,
        browser_brand_rule_count,
    }
}

#[tauri::command]
pub fn list_streaming_catalog_addons(
    override_zip_path: Option<String>,
    preview_zip_path: Option<String>,
    disabled_addon_paths: Option<Vec<String>>,
    plugins_dir_override: Option<String>,
) -> Vec<StreamingAddonListEntry> {
    let pd = plugins_dir_override.as_deref();
    let disabled = disabled_path_set(disabled_addon_paths);
    let active = resolve_zip_path_with_disabled(override_zip_path.clone(), &disabled, pd);
    let active_key = active.map(|p| p.to_string_lossy().to_string());

    let mut entries: Vec<StreamingAddonListEntry> = Vec::new();
    for (path, discovery_sources) in
        collect_addon_candidates(override_zip_path, preview_zip_path, pd)
    {
        let path_str = path.to_string_lossy().to_string();
        let is_user_disabled = path_key_in_disabled(&path_str, &disabled);
        let is_active = !is_user_disabled && active_key.as_ref() == Some(&path_str);
        match read_manifest_from_zip(&path) {
            Ok(m) => {
                let summary = summary_from_manifest(m);
                entries.push(StreamingAddonListEntry {
                    path: path_str,
                    discovery_sources,
                    summary: Some(summary),
                    error: None,
                    is_active,
                    is_user_disabled,
                });
            }
            Err(e) => entries.push(StreamingAddonListEntry {
                path: path_str,
                discovery_sources,
                summary: None,
                error: Some(e),
                is_active,
                is_user_disabled,
            }),
        }
    }

    entries.sort_by(|a, b| {
        b.is_active
            .cmp(&a.is_active)
            .then_with(|| {
                let an = a.summary.as_ref().map(|s| s.display_name.as_str()).unwrap_or("");
                let bn = b.summary.as_ref().map(|s| s.display_name.as_str()).unwrap_or("");
                an.cmp(bn)
            })
            .then_with(|| a.path.cmp(&b.path))
    });

    entries
}

fn resolve_zip_path_with_disabled(
    override_zip_path: Option<String>,
    disabled: &HashSet<String>,
    plugins_dir_override: Option<&str>,
) -> Option<PathBuf> {
    ensure_user_plugins_dir_resolved(plugins_dir_override);
    if let Some(s) = override_zip_path {
        let t = s.trim();
        if !t.is_empty() {
            let p = PathBuf::from(t);
            if let Some(ok) = path_if_file(p) {
                let key = ok.to_string_lossy().into_owned();
                if !path_key_in_disabled(&key, disabled) {
                    return Some(ok);
                }
            } else {
                eprintln!("[streaming_addon] override zip path missing or not a file: {t}");
                return None;
            }
        }
    }
    first_existing_zip_in_chain(
        &streaming_addon_auto_candidates(plugins_dir_override),
        disabled,
    )
}

fn read_manifest_from_zip(path: &std::path::Path) -> Result<StreamingAddonManifest, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Read zip: {e}"))?;

    let entry_count = archive.len();
    let mut raw = Vec::<u8>::new();
    let mut entry = archive.by_name(MANIFEST_ENTRY).map_err(|_| {
        format!(
            "Zip must contain `{MANIFEST_ENTRY}` at archive root (got {entry_count} entries)."
        )
    })?;
    entry
        .read_to_end(&mut raw)
        .map_err(|e| format!("Read {MANIFEST_ENTRY}: {e}"))?;

    let mut parsed: StreamingAddonManifest =
        serde_json::from_slice(&raw).map_err(|e| format!("manifest.json JSON: {e}"))?;
    parsed.web_origin = normalize_origin(&parsed.web_origin);
    Ok(parsed)
}

#[tauri::command]
pub fn load_streaming_addon(
    override_zip_path: Option<String>,
    disabled_addon_paths: Option<Vec<String>>,
    plugins_dir_override: Option<String>,
) -> Option<StreamingAddonManifest> {
    let disabled = disabled_path_set(disabled_addon_paths);
    let path = resolve_zip_path_with_disabled(
        override_zip_path,
        &disabled,
        plugins_dir_override.as_deref(),
    )?;
    match read_manifest_from_zip(&path) {
        Ok(m) if m.enabled => Some(m),
        Ok(_) => None,
        Err(e) => {
            eprintln!("[streaming_addon] {e} ({})", path.display());
            None
        }
    }
}

fn streaming_addon_deletion_roots(plugins_dir_override: Option<&str>) -> Result<Vec<PathBuf>, String> {
    let mut roots = Vec::new();
    if let Some(d) = resolved_user_plugins_dir(plugins_dir_override) {
        roots.push(std::fs::canonicalize(&d).unwrap_or(d));
    }
    if let Ok(cwd) = std::env::current_dir() {
        let rp = cwd.join(PLUGINS_SUBDIR);
        if rp.is_dir() {
            roots.push(std::fs::canonicalize(&rp).unwrap_or(rp));
        }
    }
    if roots.is_empty() {
        return Err("No allowed plugin roots.".into());
    }
    Ok(roots)
}

#[tauri::command]
pub fn delete_streaming_addon_zip(
    path: String,
    plugins_dir_override: Option<String>,
) -> Result<(), String> {
    let raw = path.trim();
    if raw.is_empty() {
        return Err("Path is empty.".into());
    }
    let target = PathBuf::from(raw);
    let target = target
        .canonicalize()
        .map_err(|e| format!("Could not resolve path: {e}"))?;
    if target.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("zip")) != Some(true) {
        return Err("Not a .zip file.".into());
    }
    if !target.is_file() {
        return Err("Not a file.".into());
    }
    let roots = streaming_addon_deletion_roots(plugins_dir_override.as_deref())?;
    let allowed = roots.iter().any(|root| target.starts_with(root));
    if !allowed {
        return Err(
            "Delete is only allowed for zips inside the resolved plugins folder (app data or your custom folder) or this project’s plugins folder."
                .into(),
        );
    }
    std::fs::remove_file(&target).map_err(|e| format!("Delete failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn streaming_addon_user_plugins_dir(
    plugins_dir_override: Option<String>,
) -> Result<String, String> {
    ensure_user_plugins_dir_resolved(plugins_dir_override.as_deref());
    let dir = resolved_user_plugins_dir(plugins_dir_override.as_deref())
        .ok_or_else(|| "Could not resolve user plugin directory.".to_string())?;
    let resolved = std::fs::canonicalize(&dir).unwrap_or(dir);
    Ok(resolved.to_string_lossy().into_owned())
}
