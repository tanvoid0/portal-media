export type ConflictPolicy = "autoNewer" | "ask";

export interface SaveSyncConfig {
  enabled: boolean;
  autoSyncOnExit: boolean;
  conflictPolicy: ConflictPolicy;
  googleClientId: string;
}

export interface GoogleAccountInfo {
  email: string;
  displayName?: string;
}

export interface SaveSyncStatus {
  configured: boolean;
  connected: boolean;
  account: GoogleAccountInfo | null;
  config: SaveSyncConfig;
  lastSyncUtc: number | null;
  lastError: string | null;
  localBundleCount: number;
}

export interface SaveBundle {
  bundleId: string;
  gameId: string;
  gameName: string;
  platform: string;
  label: string;
  localPath: string;
  modifiedUtc: number;
  sizeBytes: number;
  sha256: string;
}

export interface SyncPlanAction {
  bundleId: string;
  gameName: string;
  label: string;
  action: string;
  reason: string;
}

export interface SyncConflict {
  bundleId: string;
  gameName: string;
  label: string;
  recommendation: "useLocal" | "useCloud" | "skip";
  localModifiedUtc: number;
  cloudModifiedUtc: number;
}

export interface SyncRunResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  skipped: number;
  conflicts: SyncConflict[];
  error: string | null;
}
