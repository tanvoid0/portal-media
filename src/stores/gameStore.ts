import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getDefaultBookmarks } from "@/utils/defaultBookmarks";
import type { Game, SortType } from "@/types/game";
import { FAVORITES_CATEGORY_ID } from "@/types/game";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";
import { useNavigationStore } from "./navigationStore";

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
  games: Game[];
  filteredGames: Game[];
  gamesByCategory: Record<string, Game[]>;
  searchQuery: string;
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
  scanGames: () => Promise<void>;
  launchGame: (game: Game) => Promise<void>;
  addManualGame: (name: string, path: string, executable: string) => Promise<void>;
  addBookmark: (name: string, url: string) => Promise<void>;
  setSelectedIndex: (index: number) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSortType: (sortType: SortType) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectRowUp: () => void;
  selectRowDown: () => void;
  setGridColumnCount: (count: number) => void;
  getLastOpenedTime: (gameId: string) => number;
  toggleFavorite: (gameId: string) => void;
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
        // Most recently opened first (higher timestamp = first)
        return timeB - timeA;
      });
    case "default":
    default:
      return sorted; // Keep original order
  }
};

function filterGamesByPrefs(
  games: Game[],
  searchQuery: string,
  selectedCategory: string | null,
  sortType: SortType,
  favoriteIds: string[],
  getLastOpenedTime: (gameId: string) => number
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
  } else if (selectedCategory) {
    filtered = filtered.filter((game) => game.category === selectedCategory);
  }
  return sortGames(filtered, sortType, getLastOpenedTime);
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  filteredGames: [],
  gamesByCategory: {},
  searchQuery: "",
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

  toggleFavorite: (gameId: string) => {
    set((state) => {
      const has = state.favoriteIds.includes(gameId);
      const favoriteIds = has
        ? state.favoriteIds.filter((id) => id !== gameId)
        : [...state.favoriteIds, gameId];
      persistFavoriteIds(favoriteIds);
      const filteredGames = filterGamesByPrefs(
        state.games,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        favoriteIds,
        state.getLastOpenedTime
      );
      return { favoriteIds, filteredGames };
    });
  },

  scanGames: async () => {
    set({ isLoading: true, error: null });
    try {
      const scannedGames = await invoke<Game[]>("scan_games");
      
      // Add default bookmarks (streaming services)
      const defaultBookmarks = getDefaultBookmarks();
      
      // Combine scanned games with default bookmarks
      const allGames = [...defaultBookmarks, ...scannedGames];
      
      // Group games by category
      const gamesByCategory: Record<string, Game[]> = {
        Game: [],
        App: [],
        Media: [],
        Bookmark: [],
      };
      
      allGames.forEach(game => {
        const category = game.category || "App";
        if (!gamesByCategory[category]) {
          gamesByCategory[category] = [];
        }
        gamesByCategory[category].push(game);
      });
      
      const prefs = loadGameUiPrefs();
      const getLo = (id: string) => {
        const times = getLastOpenedTimes();
        return times[id] || 0;
      };

      const favoriteIds = get().favoriteIds;
      const filtered = filterGamesByPrefs(
        allGames,
        prefs.searchQuery,
        prefs.selectedCategory,
        prefs.sortType,
        favoriteIds,
        getLo
      );

      syncCategoryIndexFromSelection(prefs.selectedCategory);

      set({
        games: allGames,
        filteredGames: filtered,
        gamesByCategory,
        isLoading: false,
        selectedIndex: 0,
        searchQuery: prefs.searchQuery,
        selectedCategory: prefs.selectedCategory,
        sortType: prefs.sortType,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to scan games",
        isLoading: false 
      });
    }
  },

  setSearchQuery: (query: string) => {
    const { games, selectedCategory, sortType, favoriteIds, getLastOpenedTime } = get();
    const filtered = filterGamesByPrefs(
      games,
      query,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    set({ searchQuery: query, filteredGames: filtered, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery: query, selectedCategory, sortType });
  },

  setSelectedCategory: (category: string | null) => {
    const { games, searchQuery, sortType, favoriteIds, getLastOpenedTime } = get();
    const filtered = filterGamesByPrefs(
      games,
      searchQuery,
      category,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    syncCategoryIndexFromSelection(category);
    set({ selectedCategory: category, filteredGames: filtered, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery, selectedCategory: category, sortType });
  },

  setSortType: (sortType: SortType) => {
    const { games, searchQuery, selectedCategory, favoriteIds, getLastOpenedTime } = get();
    const filtered = filterGamesByPrefs(
      games,
      searchQuery,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime
    );

    set({ sortType, filteredGames: filtered, selectedIndex: 0 });
    persistGameUiPrefs({ searchQuery, selectedCategory, sortType });
  },

  launchGame: async (game: Game) => {
    try {
      // Track last opened time
      setLastOpenedTime(game.id, Date.now());
      
      // If it's a URL, open in embedded browser
      if (game.launch_type === "Url") {
        // Import browser store dynamically to avoid circular dependency
        const { openBrowser } = await import("./browserStore").then(m => m.useBrowserStore.getState());
        openBrowser(game.executable);
      } else {
        set({
          launchOverlay: {
            label: game.name,
            hint: "Starting…",
          },
        });
        try {
          await invoke("launch_game", { game });
        } finally {
          set({ launchOverlay: null });
        }
      }
      
      // Re-apply sorting if sort type is "lastOpened"
      const { sortType } = get();
      if (sortType === "lastOpened") {
        const { games, searchQuery, selectedCategory, favoriteIds, getLastOpenedTime } = get();
        const filtered = filterGamesByPrefs(
          games,
          searchQuery,
          selectedCategory,
          sortType,
          favoriteIds,
          getLastOpenedTime
        );
        set({ filteredGames: filtered });
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
      const game = await invoke<Game>("add_manual_game", { name, path, executable });
      set((state) => {
        const games = [...state.games, game];
        const filteredGames = filterGamesByPrefs(
          games,
          state.searchQuery,
          state.selectedCategory,
          state.sortType,
          state.favoriteIds,
          state.getLastOpenedTime
        );
        return { games, filteredGames };
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to add game"
      });
    }
  },

  addBookmark: async (name: string, url: string) => {
    const bookmark: Game = {
      id: `bookmark_${Date.now()}`,
      name,
      path: url,
      executable: url,
      cover_art: undefined,
      icon: undefined,
      platform: "Web",
      category: "Bookmark",
      launch_type: "Url",
    };
    set((state) => {
      const newGames = [...state.games, bookmark];
      const newGamesByCategory = { ...state.gamesByCategory };
      if (!newGamesByCategory.Bookmark) {
        newGamesByCategory.Bookmark = [];
      }
      newGamesByCategory.Bookmark.push(bookmark);
      const filteredGames = filterGamesByPrefs(
        newGames,
        state.searchQuery,
        state.selectedCategory,
        state.sortType,
        state.favoriteIds,
        state.getLastOpenedTime
      );

      return {
        games: newGames,
        filteredGames,
        gamesByCategory: newGamesByCategory,
      };
    });
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
}));

