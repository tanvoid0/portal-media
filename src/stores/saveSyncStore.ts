import { create } from "zustand";
import type {
  ConflictPolicy,
  SaveBundle,
  SaveSyncConfig,
  SaveSyncStatus,
  SyncConflict,
  SyncPlanAction,
  SyncRunResult,
} from "@/types/saveSync";
import {
  saveSyncDiscover,
  saveSyncDiscoverForGame,
  saveSyncGetStatus,
  saveSyncPreviewPlan,
  saveSyncResolveConflict,
  saveSyncRun,
  saveSyncSaveConfig,
  saveSyncSignIn,
  saveSyncSignOut,
} from "@/utils/saveSyncApi";

const defaultConfig: SaveSyncConfig = {
  enabled: false,
  autoSyncOnExit: true,
  conflictPolicy: "autoNewer",
  googleClientId: "",
};

interface SaveSyncStore {
  status: SaveSyncStatus | null;
  bundles: SaveBundle[];
  bundlesLoading: boolean;
  plan: SyncPlanAction[];
  conflicts: SyncConflict[];
  busy: boolean;
  hydrated: boolean;
  refresh: () => Promise<void>;
  loadAllBundles: () => Promise<SaveBundle[]>;
  loadBundlesForGame: (gameId: string) => Promise<SaveBundle[]>;
  setConfig: (patch: Partial<SaveSyncConfig>) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  previewPlan: () => Promise<void>;
  runSync: () => Promise<SyncRunResult | null>;
  resolveConflict: (bundleId: string, useLocal: boolean) => Promise<void>;
  maybeSyncAfterGameExit: () => Promise<void>;
}

export const useSaveSyncStore = create<SaveSyncStore>((set, get) => ({
  status: null,
  bundles: [],
  bundlesLoading: false,
  plan: [],
  conflicts: [],
  busy: false,
  hydrated: false,

  loadAllBundles: async () => {
    set({ bundlesLoading: true });
    try {
      const bundles = await saveSyncDiscover();
      set({ bundles });
      return bundles;
    } catch {
      set({ bundles: [] });
      return [];
    } finally {
      set({ bundlesLoading: false });
    }
  },

  loadBundlesForGame: async (gameId) => {
    set({ bundlesLoading: true });
    try {
      const bundles = await saveSyncDiscoverForGame(gameId);
      set({ bundles });
      return bundles;
    } catch {
      set({ bundles: [] });
      return [];
    } finally {
      set({ bundlesLoading: false });
    }
  },

  refresh: async () => {
    try {
      const status = await saveSyncGetStatus();
      set({ status, hydrated: true, conflicts: [] });
    } catch {
      set({
        status: {
          configured: false,
          connected: false,
          account: null,
          config: defaultConfig,
          lastSyncUtc: null,
          lastError: null,
          localBundleCount: 0,
        },
        hydrated: true,
      });
    }
  },

  setConfig: async (patch) => {
    const current = get().status?.config ?? defaultConfig;
    const config: SaveSyncConfig = { ...current, ...patch };
    set({ busy: true });
    try {
      await saveSyncSaveConfig(config);
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  signIn: async () => {
    set({ busy: true });
    try {
      await saveSyncSignIn();
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  signOut: async () => {
    set({ busy: true });
    try {
      await saveSyncSignOut();
      set({ plan: [], conflicts: [] });
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  previewPlan: async () => {
    set({ busy: true });
    try {
      const plan = await saveSyncPreviewPlan();
      set({ plan });
    } finally {
      set({ busy: false });
    }
  },

  runSync: async () => {
    set({ busy: true });
    try {
      const result = await saveSyncRun();
      set({ conflicts: result.conflicts });
      await get().refresh();
      if (result.success && result.conflicts.length === 0) {
        try {
          const plan = await saveSyncPreviewPlan();
          set({ plan });
        } catch {
          set({ plan: [] });
        }
      }
      return result;
    } finally {
      set({ busy: false });
    }
  },

  resolveConflict: async (bundleId, useLocal) => {
    set({ busy: true });
    try {
      await saveSyncResolveConflict(bundleId, useLocal);
      set((s) => ({
        conflicts: s.conflicts.filter((c) => c.bundleId !== bundleId),
      }));
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  maybeSyncAfterGameExit: async () => {
    const { status, busy } = get();
    if (busy || !status?.config.enabled || !status.connected || !status.config.autoSyncOnExit) {
      return;
    }
    await get().runSync();
  },
}));

export function conflictPolicyLabel(policy: ConflictPolicy): string {
  return policy === "ask" ? "Ask me when both changed" : "Keep newer (PS5-style)";
}
