import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  IgdbDiscoverGamesResult,
  IgdbDiscoverHit,
  TmdbDiscoverPayload,
  TmdbDiscoverResult,
  TmdbSearchHit,
} from "@/types/metadata";
import {
  DISCOVER_CACHE_TTL_MS,
  readDiscoverCache,
  writeDiscoverCache,
} from "@/utils/discoverCache";

export type DiscoverFeedId = "nowPlaying" | "trendingMovies" | "trendingTv" | "popularGames";

/** Stable empty lists — fresh `[]` breaks `useSyncExternalStore` snapshots. */
const EMPTY_TMDB_HITS: TmdbSearchHit[] = [];
const EMPTY_IGDB_HITS: IgdbDiscoverHit[] = [];

function itemsForTmdbFeed(
  tmdbPayload: TmdbDiscoverPayload | null,
  feed: Exclude<DiscoverFeedId, "popularGames">
): TmdbSearchHit[] {
  if (!tmdbPayload) return EMPTY_TMDB_HITS;
  switch (feed) {
    case "nowPlaying": {
      const v = tmdbPayload.nowPlaying;
      return Array.isArray(v) && v.length > 0 ? v : EMPTY_TMDB_HITS;
    }
    case "trendingMovies": {
      const v = tmdbPayload.trendingMovies;
      return Array.isArray(v) && v.length > 0 ? v : EMPTY_TMDB_HITS;
    }
    case "trendingTv": {
      const v = tmdbPayload.trendingTv;
      return Array.isArray(v) && v.length > 0 ? v : EMPTY_TMDB_HITS;
    }
    default:
      return EMPTY_TMDB_HITS;
  }
}

interface DiscoverState {
  loading: boolean;
  error: string | null;
  tmdbPayload: TmdbDiscoverPayload | null;
  igdbGames: IgdbDiscoverHit[];
  /** Unix ms from last successful network refresh or cache hydration. */
  lastFetchedAt: number | null;
  feed: DiscoverFeedId;
  selectedIndex: number;
  gridColumnCount: number;
  setFeed: (feed: DiscoverFeedId) => void;
  setGridColumnCount: (n: number) => void;
  setSelectedIndex: (i: number) => void;
  getItems: () => ReadonlyArray<TmdbSearchHit | IgdbDiscoverHit>;
  load: (opts?: { force?: boolean }) => Promise<void>;
  selectNext: () => void;
  selectPrevious: () => void;
  selectRowUp: () => void;
  selectRowDown: () => void;
}

function activeListLength(get: () => DiscoverState): number {
  const s = get();
  if (s.feed === "popularGames") {
    return s.igdbGames.length > 0 ? s.igdbGames.length : 0;
  }
  return itemsForTmdbFeed(s.tmdbPayload, s.feed).length;
}

export const useTmdbDiscoverStore = create<DiscoverState>((set, get) => ({
  loading: false,
  error: null,
  tmdbPayload: null,
  igdbGames: [],
  lastFetchedAt: null,
  feed: "nowPlaying",
  selectedIndex: 0,
  gridColumnCount: 1,

  setFeed: (feed) => {
    set({ feed, selectedIndex: 0 });
  },

  setGridColumnCount: (n) => set({ gridColumnCount: Math.max(1, n) }),

  setSelectedIndex: (i) => {
    const len = activeListLength(get);
    if (len === 0) {
      set({ selectedIndex: 0 });
      return;
    }
    const next = Math.max(0, Math.min(len - 1, i));
    set({ selectedIndex: next });
  },

  getItems: () => {
    const s = get();
    if (s.feed === "popularGames") {
      return s.igdbGames.length > 0 ? s.igdbGames : EMPTY_IGDB_HITS;
    }
    return itemsForTmdbFeed(s.tmdbPayload, s.feed);
  },

  load: async (opts) => {
    const force = Boolean(opts?.force);
    if (!force) {
      const cached = readDiscoverCache();
      if (cached && Date.now() - cached.savedAt < DISCOVER_CACHE_TTL_MS) {
        set({
          loading: false,
          error: null,
          tmdbPayload: cached.tmdb,
          igdbGames: Array.isArray(cached.igdb) ? cached.igdb : [],
          lastFetchedAt: cached.savedAt,
          selectedIndex: 0,
        });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const [tmdbR, igdbR] = await Promise.all([
        invoke<TmdbDiscoverResult>("metadata_tmdb_discover"),
        invoke<IgdbDiscoverGamesResult>("metadata_igdb_discover_games"),
      ]);

      const errors: string[] = [];
      let tmdbPayload: TmdbDiscoverPayload | null = null;
      if (tmdbR.kind === "ok") {
        tmdbPayload = tmdbR.payload;
      } else if (tmdbR.kind === "error") {
        errors.push(tmdbR.message);
      }

      let igdbGames: IgdbDiscoverHit[] = [];
      if (igdbR.kind === "ok") {
        igdbGames = Array.isArray(igdbR.hits) ? igdbR.hits : [];
      } else if (igdbR.kind === "error") {
        errors.push(igdbR.message);
      }

      const now = Date.now();
      set({
        loading: false,
        tmdbPayload,
        igdbGames,
        error: errors.length > 0 ? errors.join(" · ") : null,
        lastFetchedAt: now,
        selectedIndex: 0,
      });

      if (tmdbPayload || igdbGames.length > 0) {
        writeDiscoverCache({
          savedAt: now,
          tmdb: tmdbPayload,
          igdb: igdbGames,
        });
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Could not load Discover",
        lastFetchedAt: null,
      });
    }
  },

  selectNext: () => {
    const { selectedIndex } = get();
    const len = activeListLength(get);
    if (len === 0) return;
    set({ selectedIndex: Math.min(len - 1, selectedIndex + 1) });
  },

  selectPrevious: () => {
    const { selectedIndex } = get();
    set({ selectedIndex: Math.max(0, selectedIndex - 1) });
  },

  selectRowUp: () => {
    const { selectedIndex, gridColumnCount } = get();
    const cols = Math.max(1, gridColumnCount);
    const len = activeListLength(get);
    if (len === 0) return;
    set({ selectedIndex: Math.max(0, selectedIndex - cols) });
  },

  selectRowDown: () => {
    const { selectedIndex, gridColumnCount } = get();
    const cols = Math.max(1, gridColumnCount);
    const len = activeListLength(get);
    if (len === 0) return;
    set({ selectedIndex: Math.min(len - 1, selectedIndex + cols) });
  },
}));

export function discoverItemLabel(hit: TmdbSearchHit): string {
  return hit.title || hit.name || "Untitled";
}
