import { invoke } from "@tauri-apps/api/core";
import type {
  SaveBundle,
  SaveSyncConfig,
  SaveSyncStatus,
  SyncPlanAction,
  SyncRunResult,
} from "@/types/saveSync";

export async function saveSyncGetStatus(): Promise<SaveSyncStatus> {
  return invoke<SaveSyncStatus>("save_sync_get_status");
}

export async function saveSyncSaveConfig(config: SaveSyncConfig): Promise<void> {
  return invoke("save_sync_save_config", { config });
}

export async function saveSyncSignIn(): Promise<void> {
  await invoke("save_sync_sign_in");
}

export async function saveSyncSignOut(): Promise<void> {
  return invoke("save_sync_sign_out");
}

export async function saveSyncDiscover(): Promise<SaveBundle[]> {
  return invoke<SaveBundle[]>("save_sync_discover");
}

export async function saveSyncDiscoverForGame(gameId: string): Promise<SaveBundle[]> {
  return invoke<SaveBundle[]>("save_sync_discover_for_game", { gameId });
}

export async function saveSyncPreviewPlan(): Promise<SyncPlanAction[]> {
  return invoke<SyncPlanAction[]>("save_sync_preview_plan");
}

export async function saveSyncRun(): Promise<SyncRunResult> {
  return invoke<SyncRunResult>("save_sync_run");
}

export async function saveSyncResolveConflict(
  bundleId: string,
  useLocal: boolean
): Promise<void> {
  return invoke("save_sync_resolve_conflict", { bundleId, useLocal });
}
