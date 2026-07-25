mod archive;
mod config;
mod discovery;
mod drive;
mod oauth;
mod resolver;
mod types;

use crate::commands::Game;
use crate::library_cache;
use crate::library_store;
use resolver::{build_sync_plan, conflicts_from_plan, plan_to_actions, PlannedAction};
use types::*;
use tauri::command;
use tauri::AppHandle;

pub use types::SaveSyncConfig;

fn client_id_from_app(app: &AppHandle) -> Result<String, String> {
    let cfg = config::load_config(app)?;
    config::effective_client_id(&cfg)
        .ok_or_else(|| {
            "Set a Google OAuth Client ID in Save Cloud Sync settings (Desktop app type). \
             Create one at Google Cloud Console → APIs & Services → Credentials."
                .into()
        })
}

fn games_for_discovery(app: &AppHandle) -> Result<Vec<Game>, String> {
    if let Some(games) = library_cache::load_snapshot(app)? {
        if !games.is_empty() {
            return Ok(games);
        }
    }
    Ok(vec![])
}

#[command]
pub fn save_sync_get_status(app: AppHandle) -> Result<SaveSyncStatus, String> {
    let cfg = config::load_config(&app)?;
    let state = config::load_sync_state(&app)?;
    let connected = oauth::load_tokens()?.is_some();
    let account = oauth::load_tokens()?.map(|t| t.account);
    let games = games_for_discovery(&app)?;
    let bundles = discovery::discover_for_games(&games).unwrap_or_default();
    Ok(SaveSyncStatus {
        configured: secrets_configured(),
        connected,
        account,
        config: cfg,
        last_sync_utc: state.last_sync_utc,
        last_error: state.last_error,
        local_bundle_count: bundles.len(),
    })
}

fn secrets_configured() -> bool {
    crate::metadata::google_drive_configured()
}

#[command]
pub fn save_sync_save_config(app: AppHandle, config: SaveSyncConfig) -> Result<(), String> {
    config::save_config(&app, &config)
}

#[command]
pub fn save_sync_sign_in(app: AppHandle) -> Result<GoogleAccountInfo, String> {
    let client_id = client_id_from_app(&app)?;
    let tokens = oauth::sign_in(&client_id)?;
    config::save_sync_state(&app, None, None)?;
    Ok(tokens.account)
}

#[command]
pub fn save_sync_sign_out(app: AppHandle) -> Result<(), String> {
    oauth::clear_tokens()?;
    config::save_sync_state(&app, None, None)?;
    Ok(())
}

#[command]
pub fn save_sync_discover(app: AppHandle) -> Result<Vec<SaveBundle>, String> {
    let games = games_for_discovery(&app)?;
    discovery::discover_for_games(&games)
}

#[command]
pub fn save_sync_discover_for_game(app: AppHandle, game_id: String) -> Result<Vec<SaveBundle>, String> {
    if let Some(games) = library_cache::load_snapshot(&app)? {
        if let Some(g) = games.iter().find(|g| g.id == game_id) {
            return discovery::discover_for_games(std::slice::from_ref(g));
        }
    }
    let manual = library_store::load_manual_entries(&app)?;
    if let Some(g) = manual.iter().find(|g| g.id == game_id) {
        return discovery::discover_for_games(std::slice::from_ref(g));
    }
    Err(format!("Game not found in library: {game_id}"))
}

#[command]
pub fn save_sync_preview_plan(app: AppHandle) -> Result<Vec<SyncPlanAction>, String> {
    let cfg = config::load_config(&app)?;
    if !cfg.enabled {
        return Err("Enable Save Cloud Sync first.".into());
    }
    let client_id = client_id_from_app(&app)?;
    if oauth::load_tokens()?.is_none() {
        return Err("Sign in to Google Drive first.".into());
    }
    let games = games_for_discovery(&app)?;
    let local = discovery::discover_for_games(&games)?;
    let ctx = drive::connect(&client_id)?;
    let cloud = drive::download_manifest(&ctx)?;
    let baseline = config::load_baseline(&app)?;
    let plan = build_sync_plan(&local, &cloud, &baseline, &cfg.conflict_policy);
    Ok(plan_to_actions(&plan))
}

#[command]
pub fn save_sync_run(app: AppHandle) -> Result<SyncRunResult, String> {
    let cfg = config::load_config(&app)?;
    if !cfg.enabled {
        return Ok(SyncRunResult {
            success: false,
            uploaded: 0,
            downloaded: 0,
            skipped: 0,
            conflicts: vec![],
            error: Some("Save Cloud Sync is disabled.".into()),
        });
    }
    let client_id = client_id_from_app(&app)?;
    if oauth::load_tokens()?.is_none() {
        return Ok(SyncRunResult {
            success: false,
            uploaded: 0,
            downloaded: 0,
            skipped: 0,
            conflicts: vec![],
            error: Some("Sign in to Google Drive first.".into()),
        });
    }

    match run_sync_inner(&app, &client_id, &cfg) {
        Ok(result) => {
            let err = result.error.clone();
            config::save_sync_state(
                &app,
                if result.success {
                    Some(chrono::Utc::now().timestamp())
                } else {
                    config::load_sync_state(&app)?.last_sync_utc
                },
                err,
            )?;
            Ok(result)
        }
        Err(e) => {
            config::save_sync_state(&app, None, Some(e.clone()))?;
            Ok(SyncRunResult {
                success: false,
                uploaded: 0,
                downloaded: 0,
                skipped: 0,
                conflicts: vec![],
                error: Some(e),
            })
        }
    }
}

fn run_sync_inner(app: &AppHandle, client_id: &str, cfg: &SaveSyncConfig) -> Result<SyncRunResult, String> {
    let games = games_for_discovery(app)?;
    let local = discovery::discover_for_games(&games)?;
    let ctx = drive::connect(client_id)?;
    let mut cloud = drive::download_manifest(&ctx)?;
    let baseline = config::load_baseline(app)?;
    let plan = build_sync_plan(&local, &cloud, &baseline, &cfg.conflict_policy);
    let conflicts = conflicts_from_plan(&plan);

    if !conflicts.is_empty() && cfg.conflict_policy == ConflictPolicy::Ask {
        let n = conflicts.len();
        return Ok(SyncRunResult {
            success: false,
            uploaded: 0,
            downloaded: 0,
            skipped: 0,
            conflicts,
            error: Some(format!(
                "{n} save(s) need your choice — resolve conflicts in Settings, then sync again."
            )),
        });
    }

    let cache = drive::cache_dir(app)?;
    let local_by_id: std::collections::HashMap<_, _> =
        local.iter().map(|b| (b.bundle_id.as_str(), b)).collect();
    let cloud_by_id: std::collections::HashMap<_, _> = cloud
        .entries
        .iter()
        .map(|e| (e.bundle_id.as_str(), e))
        .collect();

    let mut uploaded = 0u32;
    let mut downloaded = 0u32;
    let mut skipped = 0u32;
    let mut new_entries: Vec<ManifestEntry> = cloud.entries.clone();

    for item in &plan {
        match item.action {
            PlannedAction::Skip => skipped += 1,
            PlannedAction::Conflict => skipped += 1,
            PlannedAction::Upload => {
                let bundle = local_by_id
                    .get(item.bundle_id.as_str())
                    .ok_or_else(|| format!("Missing local bundle {}", item.bundle_id))?;
                let zip_path = cache.join(format!("{}.zip", bundle.bundle_id));
                archive::zip_path(std::path::Path::new(&bundle.local_path), &zip_path)?;
                let existing = cloud_by_id
                    .get(bundle.bundle_id.as_str())
                    .and_then(|e| e.drive_file_id.as_deref());
                let file_id =
                    drive::upload_bundle_zip(&ctx, &bundle.bundle_id, &zip_path, existing)?;
                let entry = drive::manifest_entry_from_bundle(bundle, Some(file_id));
                upsert_manifest_entry(&mut new_entries, entry);
                uploaded += 1;
            }
            PlannedAction::Download => {
                if let Some(bundle) = local_by_id.get(item.bundle_id.as_str()) {
                    let zip_path = cache.join(format!("{}.zip", bundle.bundle_id));
                    drive::download_bundle_zip(&ctx, &bundle.bundle_id, &zip_path)?;
                    drive::apply_download_zip(&zip_path, std::path::Path::new(&bundle.local_path))?;
                    if let Ok((modified, size, sha)) =
                        discovery::file_meta_public(std::path::Path::new(&bundle.local_path))
                    {
                        let mut entry = drive::manifest_entry_from_bundle(bundle, None);
                        entry.modified_utc = modified;
                        entry.size_bytes = size;
                        entry.sha256 = sha;
                        if let Some(ce) = cloud_by_id.get(item.bundle_id.as_str()) {
                            entry.drive_file_id = ce.drive_file_id.clone();
                        }
                        upsert_manifest_entry(&mut new_entries, entry);
                    }
                    downloaded += 1;
                } else if let Some(ce) = cloud_by_id.get(item.bundle_id.as_str()) {
                    // Cloud-only: stash entry; user restores via re-scan after installing game
                    upsert_manifest_entry(&mut new_entries, (*ce).clone());
                    skipped += 1;
                }
            }
        }
    }

    cloud.entries = new_entries;
    cloud.updated_utc = chrono::Utc::now().timestamp();
    drive::upload_manifest(&ctx, &cloud)?;
    config::save_baseline(app, &cloud)?;

    Ok(SyncRunResult {
        success: true,
        uploaded,
        downloaded,
        skipped,
        conflicts: vec![],
        error: None,
    })
}

fn upsert_manifest_entry(entries: &mut Vec<ManifestEntry>, entry: ManifestEntry) {
    if let Some(idx) = entries.iter().position(|e| e.bundle_id == entry.bundle_id) {
        entries[idx] = entry;
    } else {
        entries.push(entry);
    }
}

#[command]
pub fn save_sync_resolve_conflict(
    app: AppHandle,
    bundle_id: String,
    use_local: bool,
) -> Result<(), String> {
    let client_id = client_id_from_app(&app)?;
    let games = games_for_discovery(&app)?;
    let local = discovery::discover_for_games(&games)?;
    let bundle = local
        .into_iter()
        .find(|b| b.bundle_id == bundle_id)
        .ok_or_else(|| "Save not found on this PC.".to_string())?;
    let ctx = drive::connect(&client_id)?;
    let mut cloud = drive::download_manifest(&ctx)?;
    let cache = drive::cache_dir(&app)?;

    if use_local {
        let zip_path = cache.join(format!("{}.zip", bundle.bundle_id));
        archive::zip_path(std::path::Path::new(&bundle.local_path), &zip_path)?;
        let existing = cloud
            .entries
            .iter()
            .find(|e| e.bundle_id == bundle_id)
            .and_then(|e| e.drive_file_id.as_deref());
        let file_id = drive::upload_bundle_zip(&ctx, &bundle.bundle_id, &zip_path, existing)?;
        let entry = drive::manifest_entry_from_bundle(&bundle, Some(file_id));
        upsert_manifest_entry(&mut cloud.entries, entry);
    } else {
        let zip_path = cache.join(format!("{}.zip", bundle.bundle_id));
        drive::download_bundle_zip(&ctx, &bundle_id, &zip_path)?;
        drive::apply_download_zip(&zip_path, std::path::Path::new(&bundle.local_path))?;
        if let Some(idx) = cloud.entries.iter().position(|e| e.bundle_id == bundle_id) {
            let mut entry = cloud.entries[idx].clone();
            if let Ok((modified, size, sha)) =
                discovery::file_meta_public(std::path::Path::new(&bundle.local_path))
            {
                entry.modified_utc = modified;
                entry.size_bytes = size;
                entry.sha256 = sha;
            }
            cloud.entries[idx] = entry;
        }
    }
    cloud.updated_utc = chrono::Utc::now().timestamp();
    drive::upload_manifest(&ctx, &cloud)?;
    config::save_baseline(&app, &cloud)?;
    Ok(())
}
