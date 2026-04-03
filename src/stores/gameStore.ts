import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getDefaultBookmarks } from "@/utils/defaultBookmarks";
import type { Game, GameCategory, SortType } from "@/types/game";
import { DISCOVER_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "@/types/game";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";
import { useNavigationStore } from "./navigationStore";
import {
  applyCategoryOverrides,
  buildGamesByCategory,
  loadArchivedIds,
  loadCategoryHides,
  loadCategoryOverrides,
  persistArchivedIds,
  persistCategoryHides,
  persistCategoryOverrides,
  splitArchivedVisible,
} from "@/utils/libraryPrefs";
import { normalizeLibraryGames } from "@/utils/normalizeLibraryGame";
import { hydrateIgdbCoversFromMetadataCache } from "@/utils/hydrateIgdbCovers";

export type { Game, SortType } from "@/types/game";
export { FAVORITES_CATEGORY_ID } from "@/types/game";

const GAME_UI_PREFS_KEY = "portal_media_game_ui_prefs";
const FAVORITES_KEY = "portal_media_favorite_ids";

function loadFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

const SORT_TYPES: SortType[] = ["alphabetical", "lastOpened", "default"];

function loadGameUiPrefs(): {
  sortType: SortType;
  selectedCategory: string | null;
  searchQuery: string;
} {
  if (typeof window === "undefined") {
    return { sortType: "default", selectedCategory: null, searchQuery: "" };
  }
  try {
    const raw = localStorage.getItem(GAME_UI_PREFS_KEY);
    if (!raw) {
      return { sortType: "default", selectedCategory: null, searchQuery: "" };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sortType =
      typeof parsed.sortType === "string" && SORT_TYPES.includes(parsed.sortType as SortType)
        ? (parsed.sortType as SortType)
        : "default";
    const selectedCategory =
      parsed.selectedCategory === null || typeof parsed.selectedCategory === "string"
        ? (parsed.selectedCategory as string | null)
        : null;
    const searchQuery = typeof parsed.searchQuery === "string" ? parsed.searchQuery : "";
    return { sortType, selectedCategory, searchQuery };
  } catch {
    return { sortType: "default", selectedCategory: null, searchQuery: "" };
  }
}

function persistGameUiPrefs(partial: {
  sortType: SortType;
  selectedCategory: string | null;
  searchQuery: string;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GAME_UI_PREFS_KEY, JSON.stringify(partial));
  } catch {
    // ignore
  }
}

/** Category tab order — must match `CATEGORY_NAV_ORDER` / unified navigation */
const CATEGORY_ORDER: (string | null)[] = CATEGORY_NAV_ORDER.map((c) => c.id);

function syncCategoryIndexFromSelection(selectedCategory: string | null) {
  const idx = CATEGORY_ORDER.indexOf(selectedCategory);
  useNavigationStore.getState().setCategoryIndex(idx >= 0 ? idx : 0);
}

export interface LaunchOverlayState {
  label: string;
  hint?: string;
}

interface GameStore {
  /** Native categories from scanner / bookmarks — overrides are not applied here. */
  sourceGames: Game[];
  games: Game[];
  filteredGames: Game[];
  gamesByCategory: Record<string, Game[]>;
  archivedGames: Game[];
  archivedIds: string[];
  categoryOverrides: Record<string, GameCategory>;
  /** Per sidebar tab: item stays in All / other tabs, but not in this tab. */
  hiddenFromCategories: Record<string, GameCategory[]>;
  /** Text filter applied to the library (persisted). */
  searchQuery: string;
  /** Current search field value — may be empty while `searchQuery` still applies after "clear input". */
  searchInput: string;
  selectedCategory: string | null;
  sortType: SortType;
  selectedIndex: number;
  /** Resolved column count of the game grid (for up/down navigation). Updated by GameGrid on layout. */
  gridColumnCount: number;
  favoriteIds: string[];
  isLoading: boolean;
  /** Full-screen launch feedback while starting a local / platform game */
  launchOverlay: LaunchOverlayState | null;
  error: string | null;
  /** Full rescan + icon cache refresh + snapshot write (Settings / platform sync). */
  scanGames: () => Promise<void>;
  /** Restore last synced library from disk (no platform scan). */
  loadCachedLibrary: () => Promise<void>;
  launchGame: (game: Game) => Promise<void>;
  addManualGame: (name: string, path: string, executable: string) => Promise<void>;
  addBookmark: (name: string, url: string, category?: "Media" | "Bookmark") => Promise<void>;
  setSelectedIndex: (index: number) => void;
  setSearchQuery: (query: string) => void;
  clearSearchInput: () => void;
  setSelectedCategory: (category: string | null) => void;
  setSortType: (sortType: SortType) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectRowUp: () => void;
  selectRowDown: () => void;
  setGridColumnCount: (count: number) => void;
  getLastOpenedTime: (gameId: string) => number;
  getNativeCategory: (gameId: string) => GameCategory | undefined;
  toggleFavorite: (gameId: string) => void;
  archiveGame: (gameId: string) => void;
  unarchiveGame: (gameId: string) => void;
  setCategoryOverride: (gameId: string, category: GameCategory | null) => void;
  hideFromCategoryTab: (gameId: string, tab: GameCategory) => void;
  unhideFromCategoryTab: (gameId: string, tab: GameCategory) => void;
  clearError: () => void;
}

// Helper to get/set last opened times from localStorage
const getLastOpenedTimes = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("gameLastOpened");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setLastOpenedTime = (gameId: string, timestamp: number) => {
  if (typeof window === "undefined") return;
  try {
    const times = getLastOpenedTimes();
    times[gameId] = timestamp;
    localStorage.setItem("gameLastOpened", JSON.stringify(times));
  } catch {
    // Ignore localStorage errors
  }
};

// Helper to sort games
const sortGames = (games: Game[], sortType: SortType, getLastOpenedTime: (id: string) => number): Game[] => {
  const sorted = [...games];

  switch (sortType) {
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "lastOpened":
      return sorted.sort((a, b) => {
        const timeA = getLastOpenedTime(a.id);
        const timeB = getLastOpenedTime(b.id);
        return timeB - timeA;
      });
    case "default":
    default:
      return sorted;
  }
};

function filterGamesByPrefs(
  games: Game[],
  searchQuery: string,
  selectedCategory: string | null,
  sortType: SortType,
  favoriteIds: string[],
  getLastOpenedTime: (gameId: string) => number,
  hiddenFromCategories: Record<string, GameCategory[]>
): Game[] {
  let filtered = games;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (game) =>
        game.name.toLowerCase().includes(q) || game.platform.toLowerCase().includes(q)
    );
  }
  if (selectedCategory === FAVORITES_CATEGORY_ID) {
    const fav = new Set(favoriteIds);
    filtered = filtered.filter((game) => fav.has(game.id));
  } else if (selectedCategory === DISCOVER_CATEGORY_ID) {
    filtered = [];
  } else if (selectedCategory) {
    const tab = selectedCategory as GameCategory;
    filtered = filtered.filter((game) => {
      if (game.category !== tab) return false;
      if (hiddenFromCategories[game.id]?.includes(tab)) return false;
      return true;
    });
  }
  return sortGames(filtered, sortType, getLastOpenedTime);
}

type GetLo = (id: string) => number;

function deriveLibrarySlice(
  sourceGames: Game[],
  archivedIds: string[],
  categoryOverrides: Record<string, GameCategory>,
  hiddenFromCategories: Record<string, GameCategory[]>,
  searchQuery: string,
  selectedCategory: string | null,
  sortType: SortType,
  favoriteIds: string[],
  getLastOpenedTime: GetLo
) {
  const normalized = applyCategoryOverrides(sourceGames, categoryOverrides);
  const { visible, archivedGames } = splitArchivedVisible(normalized, archivedIds);
  const gamesByCategory = buildGamesByCategory(visible, hiddenFromCategories);
  const filteredGames = filterGamesByPrefs(
    visible,
    searchQuery,
    selectedCategory,
    sortType,
    favoriteIds,
    getLastOpenedTime,
    hiddenFromCategories
  );
  return {
    games: visible,
    archivedGames,
    gamesByCategory,
    filteredGames,
  };
}

export const useGameStore = create<GameStore>((set, get) => {
  const applyLibraryPayload = (scannedPortion: unknown) => {
    const defaultBookmarks = getDefaultBookmarks();
    const fromDisk = normalizeLibraryGames(scannedPortion);
    const sourceGames = [...defaultBookmarks, ...fromDisk];

    const prefs = loadGameUiPrefs();
    const getLo = (id: string) => getLastOpenedTimes()[id] || 0;

    const {
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      favoriteIds,
    } = get();

    const slice = deriveLibrarySlice(
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      prefs.searchQuery,
      prefs.selectedCategory,
      prefs.sortType,
      favoriteIds,
      getLo
    );

    syncCategoryIndexFromSelection(prefs.selectedCategory);

    set({
      sourceGames,
      ...slice,
      isLoading: false,
      selectedIndex: 0,
      searchQuery: prefs.searchQuery,
      searchInput: prefs.searchQuery,
      selectedCategory: prefs.selectedCategory,
      sortType: prefs.sortType,
    });

    hydrateIgdbCoversFromMetadataCache(sourceGames);
  };

  return {
  sourceGames: [],
  games: [],
  filteredGames: [],
  gamesByCategory: {},
  archivedGames: [],
  archivedIds: loadArchivedIds(),
  categoryOverrides: loadCategoryOverrides(),
  hiddenFromCategories: loadCategoryHides(),
  searchQuery: "",
  searchInput: "",
  selectedCategory: null,
  sortType: "default",
  selectedIndex: 0,
  gridColumnCount: 1,
  favoriteIds: loadFavoriteIds(),
  isLoading: false,
  launchOverlay: null,
  error: null,

  clearError: () => set({ error: null }),

  getLastOpenedTime: (gameId: string) => {
    const times = getLastOpenedTimes();
    return times[gameId] || 0;
  },

  getNativeCategory: (gameId: string) => {
    return get().sourceGames.find((g) => g.id === gameId)?.category;
  },

  toggleFavorite: (gameId: string) => {
    set((state) => {
      const has = state.favoriteIds.includes(gameId);
      const favoriteIds = has
        ? state.favoriteIds.filter((id) => id !== gameId)
        : [...state.favoriteIds, gameId];
      persistFavoriteIds(favoriteIds);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        state.archivedIds,
        state.categoryOverrides,
        state.hiddenFromCategories,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        favoriteIds,
        getLastOpenedTime
      );
      return { favoriteIds, ...slice };
    });
  },

  archiveGame: (gameId: string) => {
    set((state) => {
      if (state.archivedIds.includes(gameId)) return state;
      const archivedIds = [...state.archivedIds, gameId];
      persistArchivedIds(archivedIds);
      const favoriteIds = state.favoriteIds.filter((id) => id !== gameId);
      if (favoriteIds.length !== state.favoriteIds.length) {
        persistFavoriteIds(favoriteIds);
      }
      const nextHides = { ...state.hiddenFromCategories };
      delete nextHides[gameId];
      persistCategoryHides(nextHides);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        archivedIds,
        state.categoryOverrides,
        nextHides,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        favoriteIds,
        getLastOpenedTime
      );
      return {
        archivedIds,
        favoriteIds,
        hiddenFromCategories: nextHides,
        ...slice,
        selectedIndex: 0,
      };
    });
  },

  unarchiveGame: (gameId: string) => {
    set((state) => {
      if (!state.archivedIds.includes(gameId)) return state;
      const archivedIds = state.archivedIds.filter((id) => id !== gameId);
      persistArchivedIds(archivedIds);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        archivedIds,
        state.categoryOverrides,
        state.hiddenFromCategories,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        state.favoriteIds,
        getLastOpenedTime
      );
      return {
        archivedIds,
        ...slice,
        selectedIndex: 0,
      };
    });
  },

  setCategoryOverride: (gameId: string, category: GameCategory | null) => {
    set((state) => {
      const native = state.sourceGames.find((g) => g.id === gameId)?.category;
      const nextOverrides = { ...state.categoryOverrides };
      if (category === null || category === native) {
        delete nextOverrides[gameId];
      } else {
        nextOverrides[gameId] = category;
      }
      persistCategoryOverrides(nextOverrides);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        state.archivedIds,
        nextOverrides,
        state.hiddenFromCategories,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        state.favoriteIds,
        getLastOpenedTime
      );
      return {
        categoryOverrides: nextOverrides,
        ...slice,
        selectedIndex: 0,
      };
    });
  },

  hideFromCategoryTab: (gameId: string, tab: GameCategory) => {
    set((state) => {
      if (state.archivedIds.includes(gameId)) return state;
      const cur = state.hiddenFromCategories[gameId] ?? [];
      if (cur.includes(tab)) return state;
      const nextHides = { ...state.hiddenFromCategories, [gameId]: [...cur, tab] };
      persistCategoryHides(nextHides);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        state.archivedIds,
        state.categoryOverrides,
        nextHides,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        state.favoriteIds,
        getLastOpenedTime
      );
      return { hiddenFromCategories: nextHides, ...slice, selectedIndex: 0 };
    });
  },

  unhideFromCategoryTab: (gameId: string, tab: GameCategory) => {
    set((state) => {
      const cur = state.hiddenFromCategories[gameId] ?? [];
      if (!cur.includes(tab)) return state;
      const rest = cur.filter((t) => t !== tab);
      const nextHides = { ...state.hiddenFromCategories };
      if (rest.length === 0) delete nextHides[gameId];
      else nextHides[gameId] = rest;
      persistCategoryHides(nextHides);
      const { getLastOpenedTime } = state;
      const slice = deriveLibrarySlice(
        state.sourceGames,
        state.archivedIds,
        state.categoryOverrides,
        nextHides,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        state.favoriteIds,
        getLastOpenedTime
      );
      return { hiddenFromCategories: nextHides, ...slice, selectedIndex: 0 };
    });
  },

  scanGames: async () => {
    set({ isLoading: true, error: null });
    try {
      const scannedGames = await invoke<unknown>("scan_games");
      applyLibraryPayload(scannedGames);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to scan games",
        isLoading: false,
      });
    }
  },

  loadCachedLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const cached = await invoke<unknown>("load_cached_library");
      applyLibraryPayload(cached);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load cached library",
        isLoading: false,
      });
    }
  },

  setSearchQuery: (query: string) => {
    const {
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime,
    } = get();
    const slice = deriveLibrarySlice(
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      query,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    set({ searchQuery: query, searchInput: query, ...slice, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery: query, selectedCategory, sortType });
  },

  clearSearchInput: () => {
    set({ searchInput: "" });
  },

  setSelectedCategory: (category: string | null) => {
    const {
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
      sortType,
      favoriteIds,
      getLastOpenedTime,
    } = get();
    const slice = deriveLibrarySlice(
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
      category,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    syncCategoryIndexFromSelection(category);
    set({ selectedCategory: category, ...slice, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery, selectedCategory: category, sortType });
  },

  setSortType: (sortType: SortType) => {
    const {
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
      selectedCategory,
      favoriteIds,
      getLastOpenedTime,
    } = get();
    const slice = deriveLibrarySlice(
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    set({ sortType, ...slice, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery, selectedCategory, sortType });
  },

  launchGame: async (game: Game) => {
    try {
      setLastOpenedTime(game.id, Date.now());

      if (game.launch_type === "Url") {
        const { openBrowser } = await import("./browserStore").then((m) => m.useBrowserStore.getState());
        openBrowser(game.executable);
      } else {
        set({
          launchOverlay: {
            label: game.name,
            hint: "Starting…",
          },
        });
        try {
          const result = await invoke<{ pid?: number }>("launch_game", { game });
          const { useSessionStore } = await import("./sessionStore");
          useSessionStore.getState().pushExternalGameSession(
            game.id,
            game.name,
            result.pid
          );
        } finally {
          set({ launchOverlay: null });
        }
      }

      const { sortType } = get();
      if (sortType === "lastOpened") {
        const {
          sourceGames,
          archivedIds,
          categoryOverrides,
          hiddenFromCategories,
          searchQuery,
          selectedCategory,
          favoriteIds,
          getLastOpenedTime,
        } = get();
        const slice = deriveLibrarySlice(
          sourceGames,
          archivedIds,
          categoryOverrides,
          hiddenFromCategories,
          searchQuery,
          selectedCategory,
          sortType,
          favoriteIds,
          getLastOpenedTime
        );
        set({ filteredGames: slice.filteredGames });
      }
    } catch (error) {
      set({
        launchOverlay: null,
        error: error instanceof Error ? error.message : "Failed to launch game",
      });
    }
  },

  addManualGame: async (name: string, path: string, executable: string) => {
    try {
      await invoke<Game>("add_manual_game", { name, path, executable });
      await get().scanGames();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to add game",
      });
    }
  },

  addBookmark: async (name: string, url: string, category: "Media" | "Bookmark" = "Media") => {
    try {
      let href = url.trim();
      if (!/^[a-zA-Z][a-zA-Z\d+.+-]*:/.test(href)) {
        href = `https://${href}`;
      }
      // Reject obviously invalid input before hitting the shell / backend.
      new URL(href);
      await invoke<Game>("library_manual_add", {
        add: { kind: "web", name: name.trim(), category, url: href },
      });
      await get().scanGames();
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Failed to add bookmark",
      });
    }
  },

  setSelectedIndex: (index: number) => {
    const { filteredGames } = get();
    if (index >= 0 && index < filteredGames.length) {
      set({ selectedIndex: index });
    }
  },

  selectNext: () => {
    const { filteredGames, selectedIndex } = get();
    if (selectedIndex < filteredGames.length - 1) {
      set({ selectedIndex: selectedIndex + 1 });
    }
  },

  selectPrevious: () => {
    const { selectedIndex } = get();
    if (selectedIndex > 0) {
      set({ selectedIndex: selectedIndex - 1 });
    }
  },

  setGridColumnCount: (count: number) => {
    const n = Math.max(1, Math.floor(count));
    if (get().gridColumnCount !== n) {
      set({ gridColumnCount: n });
    }
  },

  selectRowUp: () => {
    const { selectedIndex, gridColumnCount } = get();
    const cols = Math.max(1, gridColumnCount);
    const next = selectedIndex - cols;
    if (next >= 0) {
      set({ selectedIndex: next });
    }
  },

  selectRowDown: () => {
    const { filteredGames, selectedIndex, gridColumnCount } = get();
    const cols = Math.max(1, gridColumnCount);
    const next = selectedIndex + cols;
    if (next < filteredGames.length) {
      set({ selectedIndex: next });
    }
  },
};
});
