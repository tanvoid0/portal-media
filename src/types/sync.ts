export type Platform = "Steam" | "Epic Games" | "GOG" | "Ubisoft" | "Xbox";

export interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PlatformSyncStatus {
  platform: Platform;
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  gameCount: number;
  error: string | null;
  userProfile?: UserProfile;
}
