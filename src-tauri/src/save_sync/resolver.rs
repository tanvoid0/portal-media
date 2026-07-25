use super::types::{
    CloudManifest, ConflictPolicy, ManifestEntry, SaveBundle, SyncConflict, SyncPlanAction,
    SyncRecommendation,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedAction {
    Skip,
    Upload,
    Download,
    Conflict,
}

#[derive(Debug, Clone)]
pub struct PlanItem {
    pub bundle_id: String,
    pub game_name: String,
    pub label: String,
    pub action: PlannedAction,
    pub reason: String,
    pub recommendation: Option<SyncRecommendation>,
    pub local_modified_utc: Option<i64>,
    pub cloud_modified_utc: Option<i64>,
}

pub fn build_sync_plan(
    local: &[SaveBundle],
    cloud: &CloudManifest,
    baseline: &CloudManifest,
    policy: &ConflictPolicy,
) -> Vec<PlanItem> {
    let mut plan = Vec::new();
    let cloud_by_id: std::collections::HashMap<_, _> = cloud
        .entries
        .iter()
        .map(|e| (e.bundle_id.as_str(), e))
        .collect();
    let base_by_id: std::collections::HashMap<_, _> = baseline
        .entries
        .iter()
        .map(|e| (e.bundle_id.as_str(), e))
        .collect();

    for bundle in local {
        let cid = bundle.bundle_id.as_str();
        let cloud_e = cloud_by_id.get(cid).copied();
        let base_e = base_by_id.get(cid).copied();
        plan.push(decide_one(bundle, cloud_e, base_e, policy));
    }

    // Cloud-only entries (e.g. played on another PC)
    let local_ids: std::collections::HashSet<_> =
        local.iter().map(|b| b.bundle_id.as_str()).collect();
    for entry in &cloud.entries {
        if local_ids.contains(entry.bundle_id.as_str()) {
            continue;
        }
        plan.push(PlanItem {
            bundle_id: entry.bundle_id.clone(),
            game_name: entry.game_name.clone(),
            label: entry.label.clone(),
            action: PlannedAction::Download,
            reason: "Save exists in Google Drive but not on this PC".into(),
            recommendation: Some(SyncRecommendation::UseCloud),
            local_modified_utc: None,
            cloud_modified_utc: Some(entry.modified_utc),
        });
    }

    plan
}

fn decide_one(
    local: &SaveBundle,
    cloud: Option<&ManifestEntry>,
    baseline: Option<&ManifestEntry>,
    policy: &ConflictPolicy,
) -> PlanItem {
    match cloud {
        None => PlanItem {
            bundle_id: local.bundle_id.clone(),
            game_name: local.game_name.clone(),
            label: local.label.clone(),
            action: PlannedAction::Upload,
            reason: "New local save — not in cloud yet".into(),
            recommendation: Some(SyncRecommendation::UseLocal),
            local_modified_utc: Some(local.modified_utc),
            cloud_modified_utc: None,
        },
        Some(c) if local.sha256 == c.sha256 => PlanItem {
            bundle_id: local.bundle_id.clone(),
            game_name: local.game_name.clone(),
            label: local.label.clone(),
            action: PlannedAction::Skip,
            reason: "Already in sync".into(),
            recommendation: Some(SyncRecommendation::Skip),
            local_modified_utc: Some(local.modified_utc),
            cloud_modified_utc: Some(c.modified_utc),
        },
        Some(c) => {
            let local_changed = baseline
                .map(|b| b.sha256 != local.sha256)
                .unwrap_or(true);
            let cloud_changed = baseline
                .map(|b| b.sha256 != c.sha256)
                .unwrap_or(true);

            if local_changed && !cloud_changed {
                return item_upload(local, "Local save changed since last sync");
            }
            if !local_changed && cloud_changed {
                return item_download(local, c, "Cloud save is newer on another device");
            }

            let rec = if local.modified_utc >= c.modified_utc {
                SyncRecommendation::UseLocal
            } else {
                SyncRecommendation::UseCloud
            };
            let action = match (policy, &rec) {
                (ConflictPolicy::AutoNewer, SyncRecommendation::UseLocal) => PlannedAction::Upload,
                (ConflictPolicy::AutoNewer, SyncRecommendation::UseCloud) => PlannedAction::Download,
                (ConflictPolicy::AutoNewer, _) => PlannedAction::Skip,
                (ConflictPolicy::Ask, _) => PlannedAction::Conflict,
            };
            let reason = if action == PlannedAction::Conflict {
                "Both local and cloud saves changed — choose which to keep".into()
            } else if rec == SyncRecommendation::UseLocal {
                "Both changed — keeping the newer local copy".into()
            } else {
                "Both changed — keeping the newer cloud copy".into()
            };
            PlanItem {
                bundle_id: local.bundle_id.clone(),
                game_name: local.game_name.clone(),
                label: local.label.clone(),
                action,
                reason,
                recommendation: Some(rec),
                local_modified_utc: Some(local.modified_utc),
                cloud_modified_utc: Some(c.modified_utc),
            }
        }
    }
}

fn item_upload(local: &SaveBundle, reason: &str) -> PlanItem {
    PlanItem {
        bundle_id: local.bundle_id.clone(),
        game_name: local.game_name.clone(),
        label: local.label.clone(),
        action: PlannedAction::Upload,
        reason: reason.into(),
        recommendation: Some(SyncRecommendation::UseLocal),
        local_modified_utc: Some(local.modified_utc),
        cloud_modified_utc: None,
    }
}

fn item_download(local: &SaveBundle, cloud: &ManifestEntry, reason: &str) -> PlanItem {
    PlanItem {
        bundle_id: local.bundle_id.clone(),
        game_name: local.game_name.clone(),
        label: local.label.clone(),
        action: PlannedAction::Download,
        reason: reason.into(),
        recommendation: Some(SyncRecommendation::UseCloud),
        local_modified_utc: Some(local.modified_utc),
        cloud_modified_utc: Some(cloud.modified_utc),
    }
}

pub fn plan_to_actions(plan: &[PlanItem]) -> Vec<SyncPlanAction> {
    plan.iter()
        .map(|p| SyncPlanAction {
            bundle_id: p.bundle_id.clone(),
            game_name: p.game_name.clone(),
            label: p.label.clone(),
            action: match p.action {
                PlannedAction::Skip => "skip",
                PlannedAction::Upload => "upload",
                PlannedAction::Download => "download",
                PlannedAction::Conflict => "conflict",
            }
            .into(),
            reason: p.reason.clone(),
        })
        .collect()
}

pub fn conflicts_from_plan(plan: &[PlanItem]) -> Vec<SyncConflict> {
    plan.iter()
        .filter(|p| p.action == PlannedAction::Conflict)
        .map(|p| SyncConflict {
            bundle_id: p.bundle_id.clone(),
            game_name: p.game_name.clone(),
            label: p.label.clone(),
            recommendation: p.recommendation.clone().unwrap_or(SyncRecommendation::UseLocal),
            local_modified_utc: p.local_modified_utc.unwrap_or(0),
            cloud_modified_utc: p.cloud_modified_utc.unwrap_or(0),
        })
        .collect()
}
