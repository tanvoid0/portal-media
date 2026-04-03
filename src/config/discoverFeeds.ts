import type { DiscoverFeedId } from "@/stores/tmdbDiscoverStore";
import type { TmdbSearchHit } from "@/types/metadata";

export const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";
export const TWITCH_APPS = "https://dev.twitch.tv/console/apps";

export const DISCOVER_FEED_TABS: { id: DiscoverFeedId; label: string }[] = [
  { id: "nowPlaying", label: "In theaters" },
  { id: "trendingMovies", label: "Trending movies" },
  { id: "trendingTv", label: "Trending TV" },
  { id: "popularGames", label: "Popular games" },
];

export function discoverTabNeedsTmdb(id: DiscoverFeedId): boolean {
  return id !== "popularGames";
}

export function discoverTabNeedsIgdb(id: DiscoverFeedId): boolean {
  return id === "popularGames";
}

export function posterUrlForTmdbHit(hit: TmdbSearchHit): string | null {
  const path = hit.posterPath;
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w342${path}`;
}
