export type Platform = "Steam" | "Epic Games" | "GOG" | "Ubisoft" | "Xbox";

export interface PlatformSyncStatus {
  platform: Platform;
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  gameCount: number;
  error: string | null;
}
