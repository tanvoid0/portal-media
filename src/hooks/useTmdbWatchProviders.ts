import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TmdbProviderRow, TmdbWatchProvidersResult } from "@/types/metadata";

const cache = new Map<string, TmdbProviderRow[]>();
const inflight = new Map<string, Promise<TmdbProviderRow[]>>();

function cacheKey(mediaType: string, id: number): string {
  return `${mediaType}:${id}`;
}

async function fetchProviders(mediaType: string, id: number): Promise<TmdbProviderRow[]> {
  const key = cacheKey(mediaType, id);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const res = await invoke<TmdbWatchProvidersResult>("metadata_tmdb_fetch_watch_providers", {
        mediaType,
        id,
      });
      if (res.kind === "ok") {
        const rows = res.providers ?? [];
        cache.set(key, rows);
        return rows;
      }
      return [];
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** TMDB “where to watch” rows for discover/detail surfaces; deduped in-memory cache. */
export function useTmdbWatchProviders(mediaType: string | undefined, id: number | undefined, enabled: boolean) {
  const [providers, setProviders] = useState<TmdbProviderRow[]>([]);

  useEffect(() => {
    if (!enabled || !mediaType || id == null || id < 1) {
      setProviders([]);
      return;
    }
    let cancelled = false;
    const mt = mediaType.toLowerCase() === "tv" ? "tv" : "movie";
    void fetchProviders(mt, id).then((rows) => {
      if (!cancelled) setProviders(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, mediaType, id]);

  return providers;
}
