import { create } from "zustand";
import { invoke, isTauri } from "@tauri-apps/api/core";
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

/** Per-category cursor memory (session-only) so tab switches don't snap to item 0. */
const lastIndexByCategory = new Map<string, number>();

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
  appSubcategoryFilter: string | null;
  showSystemApps: boolean;
} {
  if (typeof window === "undefined") {
    return {
      sortType: "default",
      selectedCategory: null,
      searchQuery: "",
      appSubcategoryFilter: null,
      showSystemApps: false,
    };
  }
  try {
    const raw = localStorage.getItem(GAME_UI_PREFS_KEY);
    if (!raw) {
      return {
        sortType: "default",
        selectedCategory: null,
        searchQuery: "",
        appSubcategoryFilter: null,
        showSystemApps: false,
      };
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
    const appSubcategoryFilter =
      typeof parsed.appSubcategoryFilter === "string" ? parsed.appSubcategoryFilter : null;
    const showSystemApps = parsed.showSystemApps === true;
    return { sortType, selectedCategory, searchQuery, appSubcategoryFilter, showSystemApps };
  } catch {
    return {
      sortType: "default",
      selectedCategory: null,
      searchQuery: "",
      appSubcategoryFilter: null,
      showSystemApps: false,
    };
  }
}

function persistGameUiPrefs(partial: {
  sortType: SortType;
  selectedCategory: string | null;
  searchQuery: string;
  appSubcategoryFilter: string | null;
  showSystemApps: boolean;
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
  installGame: (game: Game) => Promise<void>;
  uninstallGame: (game: Game) => Promise<void>;
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
  /** Active subcategory filter within the Apps tab (null = all). */
  appSubcategoryFilter: string | null;
  /** Whether to show System-subcategory apps (hidden by default). */
  showSystemApps: boolean;
  setAppSubcategoryFilter: (sub: string | null) => void;
  setShowSystemApps: (show: boolean) => void;
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

/** Canonical app subcategory keys / display order. "System" is hidden by default. */
export const APP_SUBCATEGORIES = [
  "Development",
  "Creative",
  "Productivity",
  "Communication",
  "Browser",
  "Utilities",
  "System",
  "Other",
] as const;
export type AppSubcategory = (typeof APP_SUBCATEGORIES)[number];
export const APP_SUBCATEGORY_SYSTEM: AppSubcategory = "System";

/** Resolve an app's subcategory, defaulting unknown / missing values to "Other". */
export function appSubcategoryOf(game: Game): AppSubcategory {
  const s = game.app_subcategory;
  return s && (APP_SUBCATEGORIES as readonly string[]).includes(s)
    ? (s as AppSubcategory)
    : "Other";
}

/** Identity key for collapsing duplicate app entries (e.g. same shortcut in multiple Start Menu folders). */
function appDedupeKey(game: Game): string {
  const exe = game.executable.trim().toLowerCase();
  // `.lnk` paths differ per Start Menu folder; fall back to name when only a shortcut is known.
  if (exe && !exe.endsWith(".lnk")) return `exe:${exe}`;
  return `name:${game.name.trim().toLowerCase()}|${game.platform.toLowerCase()}`;
}

/** Collapse duplicate App rows, preferring the entry that carries an icon. Non-App rows pass through. */
function dedupeApps(games: Game[]): Game[] {
  const seen = new Map<string, number>();
  const out: Game[] = [];
  for (const g of games) {
    if (g.category !== "App") {
      out.push(g);
      continue;
    }
    const key = appDedupeKey(g);
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, out.length);
      out.push(g);
    } else if (!out[idx].icon && g.icon) {
      // Replace the kept entry with the richer (icon-bearing) duplicate.
      out[idx] = g;
    }
  }
  return out;
}

export interface AppViewFilter {
  /** null = all subcategories. */
  subcategory: string | null;
  /** Whether System-classified apps are shown. */
  showSystem: boolean;
}

function filterGamesByPrefs(
  games: Game[],
  searchQuery: string,
  selectedCategory: string | null,
  sortType: SortType,
  favoriteIds: string[],
  getLastOpenedTime: (gameId: string) => number,
  hiddenFromCategories: Record<string, GameCategory[]>,
  appView: AppViewFilter
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
    const isAppTab = tab === "App";
    filtered = filtered.filter((game) => {
      if (game.category !== tab) return false;
      if (hiddenFromCategories[game.id]?.includes(tab)) return false;
      if (isAppTab) {
        const sub = appSubcategoryOf(game);
        // Hide System tools unless explicitly toggled on or actively selected.
        if (
          sub === APP_SUBCATEGORY_SYSTEM &&
          !appView.showSystem &&
          appView.subcategory !== APP_SUBCATEGORY_SYSTEM
        ) {
          return false;
        }
        if (appView.subcategory && sub !== appView.subcategory) return false;
      }
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
  getLastOpenedTime: GetLo,
  appView: AppViewFilter
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
    hiddenFromCategories,
    appView
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
    const fromDisk = dedupeApps(normalizeLibraryGames(scannedPortion));
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
      getLo,
      { subcategory: prefs.appSubcategoryFilter, showSystem: prefs.showSystemApps }
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
      appSubcategoryFilter: prefs.appSubcategoryFilter,
      showSystemApps: prefs.showSystemApps,
    });

    hydrateIgdbCoversFromMetadataCache(sourceGames);
  };

  /** Current Apps-tab view filter, read from live store state. */
  const appViewNow = (): AppViewFilter => ({
    subcategory: get().appSubcategoryFilter,
    showSystem: get().showSystemApps,
  });

  /** Persist the full UI-prefs blob, pulling app-view fields from live state. */
  const persistPrefs = (p: {
    searchQuery: string;
    selectedCategory: string | null;
    sortType: SortType;
  }) =>
    persistGameUiPrefs({
      ...p,
      appSubcategoryFilter: get().appSubcategoryFilter,
      showSystemApps: get().showSystemApps,
    });

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
  appSubcategoryFilter: loadGameUiPrefs().appSubcategoryFilter,
  showSystemApps: loadGameUiPrefs().showSystemApps,
  /** True until the first `loadCachedLibrary` / `scanGames` finishes so deep links (e.g. `/game/:id`) do not redirect before data exists. */
  isLoading: true,
  launchOverlay: null,
  error: null,

  clearError: () => set({ error: null }),

  setAppSubcategoryFilter: (sub: string | null) => {
    set({ appSubcategoryFilter: sub });
    const {
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
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
      searchQuery,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime,
      appViewNow()
    );
    set({ ...slice, selectedIndex: 0 });
    persistPrefs({ searchQuery, selectedCategory, sortType });
  },

  setShowSystemApps: (show: boolean) => {
    set({ showSystemApps: show });
    const {
      sourceGames,
      archivedIds,
      categoryOverrides,
      hiddenFromCategories,
      searchQuery,
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
      searchQuery,
      selectedCategory,
      sortType,
      favoriteIds,
      getLastOpenedTime,
      appViewNow()
    );
    set({ ...slice, selectedIndex: 0 });
    persistPrefs({ searchQuery, selectedCategory, sortType });
  },

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
        getLastOpenedTime,
        appViewNow()
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
        getLastOpenedTime,
        appViewNow()
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
        getLastOpenedTime,
        appViewNow()
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
        getLastOpenedTime,
        appViewNow()
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
        getLastOpenedTime,
        appViewNow()
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
        getLastOpenedTime,
        appViewNow()
      );
      return { hiddenFromCategories: nextHides, ...slice, selectedIndex: 0 };
    });
  },

  scanGames: async () => {
    if (!isTauri()) {
      set({ isLoading: false });
      return;
    }
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
    if (!isTauri()) {
      set({ isLoading: false });
      return;
    }
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
      getLastOpenedTime,
      appViewNow()
    );

    set({ searchQuery: query, searchInput: query, ...slice, selectedIndex: 0 });
    persistPrefs({ searchQuery: query, selectedCategory, sortType });
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
      selectedCategory: prevCategory,
      selectedIndex: prevIndex,
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
      getLastOpenedTime,
      appViewNow()
    );

    // Console-style focus memory: remember the cursor per tab, restore on return.
    lastIndexByCategory.set(String(prevCategory), prevIndex);
    const remembered = lastIndexByCategory.get(String(category)) ?? 0;
    const restoredIndex = Math.min(remembered, Math.max(0, slice.filteredGames.length - 1));

    syncCategoryIndexFromSelection(category);
    set({ selectedCategory: category, ...slice, selectedIndex: restoredIndex });
    persistPrefs({ searchQuery, selectedCategory: category, sortType });
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
      getLastOpenedTime,
      appViewNow()
    );

    set({ sortType, ...slice, selectedIndex: 0 });
    persistPrefs({ searchQuery, selectedCategory, sortType });
  },

  launchGame: async (game: Game) => {
    try {
      const { playUiSound, playHaptic } = await import("@/utils/uiSounds");
      playUiSound("launch");
      playHaptic(160, 0.5, 0.35);
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
          const { automationApplyLaunch, automationRegisterGamePid } = await import(
            "@/utils/automationApi"
          );
          await automationApplyLaunch(game.id).catch(console.error);
          const result = await invoke<{ pid?: number }>("launch_game", { game });
          if (result.pid) {
            await automationRegisterGamePid(result.pid, game.id).catch(console.error);
          }
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
          getLastOpenedTime,
          appViewNow()
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

  installGame: async (game: Game) => {
    try {
      await invoke("install_game", { game });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to trigger installation",
      });
    }
  },

  uninstallGame: async (game: Game) => {
    try {
      await invoke("uninstall_game", { game });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to trigger uninstallation",
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
