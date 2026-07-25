use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictPolicy {
    AutoNewer,
    Ask,
}

impl Default for ConflictPolicy {
    fn default() -> Self {
        ConflictPolicy::AutoNewer
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSyncConfig {
    pub enabled: bool,
    pub auto_sync_on_exit: bool,
    pub conflict_policy: ConflictPolicy,
    /// Google OAuth 2.0 client ID (Desktop app). Also reads PORTAL_GOOGLE_OAUTH_CLIENT_ID.
    pub google_client_id: String,
}

impl Default for SaveSyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_sync_on_exit: true,
            conflict_policy: ConflictPolicy::AutoNewer,
            google_client_id: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAccountInfo {
    pub email: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBundle {
    pub bundle_id: String,
    pub game_id: String,
    pub game_name: String,
    pub platform: String,
    pub label: String,
    pub local_path: String,
    pub modified_utc: i64,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub bundle_id: String,
    pub game_id: String,
    pub game_name: String,
    pub platform: String,
    pub label: String,
    pub modified_utc: i64,
    pub size_bytes: u64,
    pub sha256: String,
    pub drive_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudManifest {
    pub version: u32,
    pub updated_utc: i64,
    pub entries: Vec<ManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSyncStatus {
    pub configured: bool,
    pub connected: bool,
    pub account: Option<GoogleAccountInfo>,
    pub config: SaveSyncConfig,
    pub last_sync_utc: Option<i64>,
    pub last_error: Option<String>,
    pub local_bundle_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncRecommendation {
    UseLocal,
    UseCloud,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflict {
    pub bundle_id: String,
    pub game_name: String,
    pub label: String,
    pub recommendation: SyncRecommendation,
    pub local_modified_utc: i64,
    pub cloud_modified_utc: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlanAction {
    pub bundle_id: String,
    pub game_name: String,
    pub label: String,
    pub action: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRunResult {
    pub success: bool,
    pub uploaded: u32,
    pub downloaded: u32,
    pub skipped: u32,
    pub conflicts: Vec<SyncConflict>,
    pub error: Option<String>,
}
