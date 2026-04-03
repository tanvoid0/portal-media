import { invoke } from "@tauri-apps/api/core";
import type { Game } from "@/types/game";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";

type IgdbCachedCoverHit = { gameId: string; coverUrl: string };

/** After library load, fill `metadataDisplayStore` from on-disk IGDB cache so grid / ambient art survive reload. */
export function hydrateIgdbCoversFromMetadataCache(sourceGames: Game[]): void {
  const games = sourceGames.filter((g) => g.category === "Game");
  if (games.length === 0) return;

  void invoke<IgdbCachedCoverHit[]>("metadata_peek_cached_igdb_covers", { games })
    .then((hits) => {
      if (!hits?.length) return;
      const batch: Record<string, string> = {};
      for (const h of hits) {
        const u = h.coverUrl?.trim();
        if (h.gameId && u) batch[h.gameId] = u;
      }
      if (Object.keys(batch).length > 0) {
        useMetadataDisplayStore.getState().mergeIgdbCoverUrls(batch);
      }
    })
    .catch(() => {
      // Missing command or cache DB — non-fatal
    });
}
