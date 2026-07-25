use super::archive;
use super::types::{CloudManifest, ManifestEntry};
use super::oauth;
use reqwest::blocking::{Client, multipart};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

const ROOT_FOLDER_NAME: &str = "Portal Media Saves";
const MANIFEST_NAME: &str = "portal_save_manifest.json";
const SAVES_SUBFOLDER: &str = "saves";

#[derive(Debug, Deserialize)]
struct FileList {
    files: Option<Vec<DriveFile>>,
}

#[derive(Debug, Deserialize, Clone)]
struct DriveFile {
    id: String,
    name: String,
    #[serde(default)]
    modified_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UploadResponse {
    id: String,
}

pub struct DriveContext {
    pub client: Client,
    pub access_token: String,
    pub root_folder_id: String,
    pub saves_folder_id: String,
}

pub fn connect(client_id: &str) -> Result<DriveContext, String> {
    let token = oauth::access_token(client_id)?;
    let client = Client::new();
    let root_folder_id = ensure_folder(&client, &token, ROOT_FOLDER_NAME, None)?;
    let saves_folder_id = ensure_folder(&client, &token, SAVES_SUBFOLDER, Some(&root_folder_id))?;
    Ok(DriveContext {
        client,
        access_token: token,
        root_folder_id,
        saves_folder_id,
    })
}

fn ensure_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent: Option<&str>,
) -> Result<String, String> {
    let mut q = format!(
        "name='{}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        escape_query(name)
    );
    if let Some(p) = parent {
        q.push_str(&format!(" and '{p}' in parents"));
    } else {
        q.push_str(" and 'root' in parents");
    }
    if let Some(files) = list_files(client, token, &q)? {
        if let Some(first) = files.first() {
            return Ok(first.id.clone());
        }
    }
    create_folder(client, token, name, parent)
}

fn escape_query(s: &str) -> String {
    s.replace('\'', "\\'")
}

fn list_files(client: &Client, token: &str, q: &str) -> Result<Option<Vec<DriveFile>>, String> {
    let url = format!(
        "https://www.googleapis.com/drive/v3/files?q={}&fields=files(id,name,modifiedTime)",
        urlencoding::encode(q)
    );
    let res = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Drive list failed: {}", res.text().unwrap_or_default()));
    }
    let body: FileList = res.json().map_err(|e| e.to_string())?;
    Ok(body.files)
}

fn create_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent: Option<&str>,
) -> Result<String, String> {
    let mut meta = serde_json::json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    });
    if let Some(p) = parent {
        meta["parents"] = serde_json::json!([p]);
    }
    let res = client
        .post("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .json(&meta)
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Drive folder create failed: {}", res.text().unwrap_or_default()));
    }
    let file: DriveFile = res.json().map_err(|e| e.to_string())?;
    Ok(file.id)
}

pub fn download_manifest(ctx: &DriveContext) -> Result<CloudManifest, String> {
    let q = format!(
        "name='{MANIFEST_NAME}' and '{}' in parents and trashed=false",
        ctx.root_folder_id
    );
    let files = list_files(&ctx.client, &ctx.access_token, &q)?;
    let Some(file) = files.and_then(|f| f.into_iter().next()) else {
        return Ok(CloudManifest {
            version: 1,
            updated_utc: 0,
            entries: vec![],
        });
    };
    let bytes = download_bytes(&ctx.client, &ctx.access_token, &file.id)?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid cloud manifest: {e}"))
}

pub fn upload_manifest(ctx: &DriveContext, manifest: &CloudManifest) -> Result<(), String> {
    let q = format!(
        "name='{MANIFEST_NAME}' and '{}' in parents and trashed=false",
        ctx.root_folder_id
    );
    let existing = list_files(&ctx.client, &ctx.access_token, &q)?;
    let data = serde_json::to_vec_pretty(manifest).map_err(|e| e.to_string())?;
    if let Some(file) = existing.and_then(|f| f.into_iter().next()) {
        update_file(&ctx.client, &ctx.access_token, &file.id, &data, "application/json")?;
    } else {
        create_file_in_parent(
            &ctx.client,
            &ctx.access_token,
            MANIFEST_NAME,
            &ctx.root_folder_id,
            &data,
            "application/json",
        )?;
    }
    Ok(())
}

pub fn upload_bundle_zip(
    ctx: &DriveContext,
    bundle_id: &str,
    zip_path: &Path,
    existing_file_id: Option<&str>,
) -> Result<String, String> {
    let name = format!("{bundle_id}.zip");
    let data = std::fs::read(zip_path).map_err(|e| e.to_string())?;
    if let Some(id) = existing_file_id {
        update_file(&ctx.client, &ctx.access_token, id, &data, "application/zip")?;
        return Ok(id.to_string());
    }
    create_file_in_parent(
        &ctx.client,
        &ctx.access_token,
        &name,
        &ctx.saves_folder_id,
        &data,
        "application/zip",
    )
}

pub fn download_bundle_zip(ctx: &DriveContext, bundle_id: &str, dest: &Path) -> Result<(), String> {
    let name = format!("{bundle_id}.zip");
    let q = format!(
        "name='{}' and '{}' in parents and trashed=false",
        escape_query(&name),
        ctx.saves_folder_id
    );
    let files = list_files(&ctx.client, &ctx.access_token, &q)?;
    let file = files
        .and_then(|f| f.into_iter().next())
        .ok_or_else(|| format!("Cloud save not found for {bundle_id}"))?;
    let bytes = download_bytes(&ctx.client, &ctx.access_token, &file.id)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn download_bytes(client: &Client, token: &str, file_id: &str) -> Result<Vec<u8>, String> {
    let url = format!("https://www.googleapis.com/drive/v3/files/{file_id}?alt=media");
    let res = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Drive download failed: {}", res.text().unwrap_or_default()));
    }
    res.bytes().map(|b| b.to_vec()).map_err(|e| e.to_string())
}

fn create_file_in_parent(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
    data: &[u8],
    mime: &str,
) -> Result<String, String> {
    let meta = serde_json::json!({
        "name": name,
        "parents": [parent],
    });
    let part_meta = multipart::Part::text(meta.to_string())
        .mime_str("application/json; charset=UTF-8")
        .map_err(|e| e.to_string())?;
    let part_data = multipart::Part::bytes(data.to_vec())
        .mime_str(mime)
        .map_err(|e| e.to_string())?
        .file_name(name.to_string());
    let form = multipart::Form::new().part("metadata", part_meta).part("file", part_data);
    let res = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(token)
        .multipart(form)
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Drive upload failed: {}", res.text().unwrap_or_default()));
    }
    let body: UploadResponse = res.json().map_err(|e| e.to_string())?;
    Ok(body.id)
}

fn update_file(client: &Client, token: &str, file_id: &str, data: &[u8], mime: &str) -> Result<(), String> {
    let url = format!("https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=media");
    let res = client
        .patch(&url)
        .bearer_auth(token)
        .header("Content-Type", mime)
        .body(data.to_vec())
        .send()
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Drive update failed: {}", res.text().unwrap_or_default()));
    }
    Ok(())
}

pub fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let p = dir.join("save_sync_cache");
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}

pub fn apply_download_zip(zip_path: &Path, target_path: &Path) -> Result<(), String> {
    if target_path.exists() {
        if target_path.is_dir() {
            let backup = target_path.with_extension("portal_backup");
            let _ = std::fs::rename(target_path, &backup);
        } else {
            let _ = std::fs::remove_file(target_path);
        }
    }
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if target_path.extension().is_some() && !zip_path.exists() {
        return Err("Invalid download".into());
    }
    let staging = target_path.with_extension("portal_staging");
    if staging.exists() {
        if staging.is_dir() {
            let _ = std::fs::remove_dir_all(&staging);
        } else {
            let _ = std::fs::remove_file(&staging);
        }
    }
    archive::unzip_to(zip_path, &staging)?;
    if staging.is_dir() {
        let entries: Vec<_> = std::fs::read_dir(&staging)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .collect();
        if entries.len() == 1 && entries[0].path().is_dir() {
            std::fs::rename(entries[0].path(), target_path).map_err(|e| e.to_string())?;
        } else {
            std::fs::rename(&staging, target_path).map_err(|e| e.to_string())?;
        }
    } else {
        std::fs::rename(&staging, target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn manifest_entry_from_bundle(bundle: &super::types::SaveBundle, drive_file_id: Option<String>) -> ManifestEntry {
    ManifestEntry {
        bundle_id: bundle.bundle_id.clone(),
        game_id: bundle.game_id.clone(),
        game_name: bundle.game_name.clone(),
        platform: bundle.platform.clone(),
        label: bundle.label.clone(),
        modified_utc: bundle.modified_utc,
        size_bytes: bundle.size_bytes,
        sha256: bundle.sha256.clone(),
        drive_file_id,
    }
}
