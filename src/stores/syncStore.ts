import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Platform, PlatformSyncStatus } from "@/types/sync";

export type { Platform, PlatformSyncStatus } from "@/types/sync";

interface SyncStore {
  platforms: Record<Platform, PlatformSyncStatus>;
  connectPlatform: (platform: Platform) => Promise<void>;
  disconnectPlatform: (platform: Platform) => Promise<void>;
  syncPlatform: (platform: Platform) => Promise<void>;
  syncAllPlatforms: () => Promise<void>;
  getPlatformStatus: (platform: Platform) => PlatformSyncStatus;
}

const initialPlatforms: Record<Platform, PlatformSyncStatus> = {
  Steam: {
    platform: "Steam",
    isConnected: false,
    isSyncing: false,
    lastSync: null,
    gameCount: 0,
    error: null,
  },
  "Epic Games": {
    platform: "Epic Games",
    isConnected: false,
    isSyncing: false,
    lastSync: null,
    gameCount: 0,
    error: null,
  },
  GOG: {
    platform: "GOG",
    isConnected: false,
    isSyncing: false,
    lastSync: null,
    gameCount: 0,
    error: null,
  },
  Ubisoft: {
    platform: "Ubisoft",
    isConnected: false,
    isSyncing: false,
    lastSync: null,
    gameCount: 0,
    error: null,
  },
  Xbox: {
    platform: "Xbox",
    isConnected: false,
    isSyncing: false,
    lastSync: null,
    gameCount: 0,
    error: null,
  },
};

// Load saved sync status from localStorage
const loadSavedStatus = (): Record<Platform, PlatformSyncStatus> => {
  if (typeof window === "undefined") return initialPlatforms;
  
  try {
    const saved = localStorage.getItem("platformSyncStatus");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert lastSync strings back to Dates
      Object.keys(parsed).forEach((key) => {
        if (parsed[key].lastSync) {
          parsed[key].lastSync = new Date(parsed[key].lastSync);
        }
      });
      return { ...initialPlatforms, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load sync status:", e);
  }
  
  return initialPlatforms;
};

const saveStatus = (platforms: Record<Platform, PlatformSyncStatus>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("platformSyncStatus", JSON.stringify(platforms));
  } catch (e) {
    console.error("Failed to save sync status:", e);
  }
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  platforms: loadSavedStatus(),

  getPlatformStatus: (platform: Platform) => {
    return get().platforms[platform];
  },

  connectPlatform: async (platform: Platform) => {
    console.log(`Attempting to connect platform: ${platform}`);
    
    set((state) => ({
      platforms: {
        ...state.platforms,
        [platform]: {
          ...state.platforms[platform],
          isSyncing: true,
          error: null,
        },
      },
    }));

    try {
      console.log(`Invoking connect_platform_command for: ${platform}`);
      const result = await invoke<{ success: boolean; gameCount?: number; error?: string }>(
        "connect_platform_command",
        { platform }
      );

      console.log(`Platform connection result:`, result);

      if (result.success) {
        const gameCount = result.gameCount || 0;
        set((state) => {
          const updated = {
            ...state.platforms,
            [platform]: {
              ...state.platforms[platform],
              isConnected: true,
              isSyncing: false,
              lastSync: new Date(),
              gameCount,
              error: null, // Clear any previous errors
            },
          };
          saveStatus(updated);
          console.log(`Platform ${platform} connected successfully with ${gameCount} games`);
          return { platforms: updated };
        });
        
        if (gameCount > 0) {
          toast.success(`${platform} detected`, {
            description: `Found ${gameCount} locally installed game${gameCount !== 1 ? 's' : ''}`,
          });
        } else {
          toast.success(`${platform} detected`, {
            description: "Platform found. Click 'Sync Now' to scan for games.",
          });
        }
      } else {
        throw new Error(result.error || "Failed to connect");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      console.error(`Platform connection error for ${platform}:`, error);
      set((state) => {
        const updated = {
          ...state.platforms,
          [platform]: {
            ...state.platforms[platform],
            isConnected: false,
            isSyncing: false,
            error: errorMessage,
          },
        };
        saveStatus(updated);
        return { platforms: updated };
      });
      
      toast.error(`Failed to detect ${platform}`, {
        description: errorMessage,
      });
    }
  },

  disconnectPlatform: async (platform: Platform) => {
    try {
      await invoke("disconnect_platform_command", { platform });
      
      set((state) => {
        const updated = {
          ...state.platforms,
          [platform]: {
            ...initialPlatforms[platform],
            isConnected: false,
          },
        };
        saveStatus(updated);
        return { platforms: updated };
      });
      
      toast.success(`${platform} disconnected`, {
        description: "Platform detection has been disabled",
      });
    } catch (error) {
      console.error("Failed to disconnect platform:", error);
      toast.error(`Failed to disconnect ${platform}`, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  syncPlatform: async (platform: Platform) => {
    const status = get().platforms[platform];
    if (!status.isConnected) {
      throw new Error("Platform not connected");
    }

    set((state) => ({
      platforms: {
        ...state.platforms,
        [platform]: {
          ...state.platforms[platform],
          isSyncing: true,
          error: null,
        },
      },
    }));

    try {
      const result = await invoke<{ success: boolean; gameCount?: number; error?: string }>(
        "sync_platform_command",
        { platform }
      );

      if (!result.success) {
        throw new Error(result.error || "Sync failed");
      }

      const gameCount = result.gameCount || 0;
      set((state) => {
        const updated = {
          ...state.platforms,
          [platform]: {
            ...state.platforms[platform],
            isSyncing: false,
            lastSync: new Date(),
            gameCount,
            error: null,
          },
        };
        saveStatus(updated);
        return { platforms: updated };
      });

      toast.success(`${platform} sync completed`, {
        description: `Found ${gameCount} locally installed game${gameCount !== 1 ? 's' : ''}`,
      });

      // Trigger a game scan to include synced games
      const { scanGames } = await import("./gameStore").then((m) => m.useGameStore.getState());
      await scanGames();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      set((state) => {
        const updated = {
          ...state.platforms,
          [platform]: {
            ...state.platforms[platform],
            isSyncing: false,
            error: errorMessage,
          },
        };
        saveStatus(updated);
        return { platforms: updated };
      });
      
      console.error(`Sync error for ${platform}:`, error);
      toast.error(`Failed to sync ${platform}`, {
        description: errorMessage,
      });
    }
  },

  syncAllPlatforms: async () => {
    const { platforms } = get();
    const connectedPlatforms = Object.values(platforms).filter((p) => p.isConnected);
    
    if (connectedPlatforms.length === 0) {
      toast.info("No platforms connected", {
        description: "Please detect at least one platform first",
      });
      return;
    }
    
    toast.loading(`Syncing ${connectedPlatforms.length} platform${connectedPlatforms.length !== 1 ? 's' : ''}...`, {
      id: "sync-all",
    });
    
    try {
      await Promise.all(
        connectedPlatforms.map((platform) => get().syncPlatform(platform.platform))
      );
      
      toast.success("All platforms synced", {
        id: "sync-all",
        description: `Successfully synced ${connectedPlatforms.length} platform${connectedPlatforms.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast.error("Sync failed", {
        id: "sync-all",
        description: error instanceof Error ? error.message : "Some platforms failed to sync",
      });
    }
  },
}));

