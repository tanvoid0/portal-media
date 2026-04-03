import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderStatus } from "@/types/metadata";

interface IntegrationsStore {
  status: ProviderStatus;
  statusLoaded: boolean;
  refreshStatus: () => Promise<void>;
}

const defaultStatus: ProviderStatus = {
  igdbConfigured: false,
  tmdbConfigured: false,
};

/** IPC / serde may yield camelCase or snake_case field names depending on Tauri + command wiring. */
function parseProviderStatus(raw: unknown): ProviderStatus {
  if (!raw || typeof raw !== "object") {
    return { ...defaultStatus };
  }
  const r = raw as Record<string, unknown>;
  return {
    igdbConfigured: Boolean(r.igdbConfigured ?? r.igdb_configured),
    tmdbConfigured: Boolean(r.tmdbConfigured ?? r.tmdb_configured),
  };
}

export const useIntegrationsStore = create<IntegrationsStore>((set) => ({
  status: defaultStatus,
  statusLoaded: false,
  refreshStatus: async () => {
    try {
      const raw = await invoke("metadata_get_provider_status");
      set({ status: parseProviderStatus(raw), statusLoaded: true });
    } catch (e) {
      console.error("metadata_get_provider_status failed", e, {
        rawMessage: String(e),
      });
      set({ status: defaultStatus, statusLoaded: true });
    }
  },
}));
