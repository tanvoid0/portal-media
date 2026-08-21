import { create } from "zustand";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useGameStore } from "./gameStore";

/** Default host: local Agent Platform (OpenAI-compatible surface under /v1). */
export const AI_DEFAULT_BASE_URL = "http://127.0.0.1:18410";

const PREFS_KEY = "portal_media_ai_prefs";

interface AiPrefs {
  baseUrl: string;
  model: string;
}

function loadPrefs(): AiPrefs {
  if (typeof window === "undefined") return { baseUrl: AI_DEFAULT_BASE_URL, model: "" };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { baseUrl: AI_DEFAULT_BASE_URL, model: "" };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl : AI_DEFAULT_BASE_URL,
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return { baseUrl: AI_DEFAULT_BASE_URL, model: "" };
  }
}

function persistPrefs(prefs: AiPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface AiSearchResult {
  ids: string[];
  truncated: boolean;
}

interface AiStore {
  baseUrl: string;
  model: string;
  /** A token is stored in the OS credential store. */
  configured: boolean;
  /** Available model ids from the last successful `/v1/models` call. */
  models: string[];
  busy: boolean;
  searching: boolean;
  /** Last search error — surfaced inline in the search bar, not as a toast. */
  searchError: string | null;
  /** True when the library was truncated before being sent to the model. */
  lastTruncated: boolean;
  /** Query behind the active AI filter (null when no AI filter is applied). */
  activeQuery: string | null;
  refreshStatus: () => Promise<void>;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  saveToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
  /** `GET /v1/models` — doubles as the connection test. */
  loadModels: () => Promise<string[]>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
}

/** Ready to run a search: desktop shell, token saved, model picked. */
export function aiSearchReady(s: Pick<AiStore, "configured" | "model">): boolean {
  return isTauri() && s.configured && s.model.trim().length > 0;
}

export const useAiStore = create<AiStore>((set, get) => {
  const initial = loadPrefs();

  return {
    baseUrl: initial.baseUrl,
    model: initial.model,
    configured: false,
    models: [],
    busy: false,
    searching: false,
    searchError: null,
    lastTruncated: false,
    activeQuery: null,

    refreshStatus: async () => {
      if (!isTauri()) return;
      try {
        set({ configured: await invoke<boolean>("ai_configured") });
      } catch {
        set({ configured: false });
      }
    },

    setBaseUrl: (url: string) => {
      set({ baseUrl: url, models: [] });
      persistPrefs({ baseUrl: url, model: get().model });
    },

    setModel: (model: string) => {
      set({ model });
      persistPrefs({ baseUrl: get().baseUrl, model });
    },

    saveToken: async (token: string) => {
      set({ busy: true });
      try {
        await invoke("ai_save_token", { token });
        await get().refreshStatus();
      } finally {
        set({ busy: false });
      }
    },

    clearToken: async () => {
      set({ busy: true });
      try {
        await invoke("ai_clear_token");
        set({ models: [] });
        await get().refreshStatus();
        get().clearSearch();
      } finally {
        set({ busy: false });
      }
    },

    loadModels: async () => {
      set({ busy: true });
      try {
        const models = await invoke<string[]>("ai_list_models", { baseUrl: get().baseUrl });
        set({ models });
        // Adopt the first model when none is chosen yet, so search works right after setup.
        if (!get().model.trim() && models.length > 0) {
          get().setModel(models[0]);
        }
        return models;
      } finally {
        set({ busy: false });
      }
    },

    search: async (query: string) => {
      const q = query.trim();
      const { baseUrl, model } = get();
      if (!q || !aiSearchReady(get())) return;

      set({ searching: true, searchError: null });
      try {
        const games = useGameStore.getState().games.map((g) => ({
          id: g.id,
          name: g.name,
          platform: g.platform,
          category: g.category,
        }));
        const result = await invoke<AiSearchResult>("ai_library_search", {
          baseUrl,
          model,
          query: q,
          games,
        });
        useGameStore.getState().setAiFilter(result.ids);
        set({ activeQuery: q, lastTruncated: result.truncated });
      } catch (e) {
        set({
          searchError: e instanceof Error ? e.message : typeof e === "string" ? e : "AI search failed",
        });
      } finally {
        set({ searching: false });
      }
    },

    clearSearch: () => {
      set({ activeQuery: null, searchError: null, lastTruncated: false });
      useGameStore.getState().setAiFilter(null);
    },
  };
});
