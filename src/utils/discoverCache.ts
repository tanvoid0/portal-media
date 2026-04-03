import type { IgdbDiscoverHit, ProviderStatus, TmdbDiscoverPayload } from "@/types/metadata";

const CACHE_KEY = "portal_media_discover_cache_v1";

/** How long cached TMDB + IGDB discover payloads stay fresh before background refetch is skipped. */
export const DISCOVER_CACHE_TTL_MS = 45 * 60 * 1000;

export type DiscoverCacheSnapshot = {
  v: 1;
  savedAt: number;
  tmdb: TmdbDiscoverPayload | null;
  igdb: IgdbDiscoverHit[];
  /** Whether credentials existed when this snapshot was written (newer builds only). */
  hadIgdbCredentials?: boolean;
  hadTmdbCredentials?: boolean;
};

function tmdbDiscoverPayloadEmpty(tmdb: TmdbDiscoverPayload | null): boolean {
  if (!tmdb) return true;
  const a = tmdb.nowPlaying;
  const b = tmdb.trendingMovies;
  const c = tmdb.trendingTv;
  const has =
    (Array.isArray(a) && a.length > 0) ||
    (Array.isArray(b) && b.length > 0) ||
    (Array.isArray(c) && c.length > 0);
  return !has;
}

/**
 * True when cached Discover data was fetched before the user configured a provider,
 * or legacy cache has empty IGDB/TMDB data while that provider is now configured.
 */
export function discoverCacheNeedsRefetchVersusCredentials(
  cached: DiscoverCacheSnapshot,
  status: ProviderStatus
): boolean {
  const { igdbConfigured, tmdbConfigured } = status;

  if (igdbConfigured && cached.hadIgdbCredentials === false) return true;
  if (tmdbConfigured && cached.hadTmdbCredentials === false) return true;

  if (cached.hadIgdbCredentials === undefined && igdbConfigured && cached.igdb.length === 0) return true;
  if (cached.hadTmdbCredentials === undefined && tmdbConfigured && tmdbDiscoverPayloadEmpty(cached.tmdb))
    return true;

  return false;
}

function isSnapshot(x: unknown): x is DiscoverCacheSnapshot {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.savedAt === "number" &&
    (o.tmdb === null || typeof o.tmdb === "object") &&
    Array.isArray(o.igdb)
  );
}

export function readDiscoverCache(): DiscoverCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiscoverCache(snapshot: Omit<DiscoverCacheSnapshot, "v"> & { v?: 1 }): void {
  if (typeof window === "undefined") return;
  try {
    const body: DiscoverCacheSnapshot = {
      v: 1,
      savedAt: snapshot.savedAt,
      tmdb: snapshot.tmdb,
      igdb: snapshot.igdb,
      ...(snapshot.hadIgdbCredentials !== undefined ? { hadIgdbCredentials: snapshot.hadIgdbCredentials } : {}),
      ...(snapshot.hadTmdbCredentials !== undefined ? { hadTmdbCredentials: snapshot.hadTmdbCredentials } : {}),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(body));
  } catch {
    // ignore quota / privacy mode
  }
}

export function discoverCacheAgeLabel(savedAt: number): string {
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
