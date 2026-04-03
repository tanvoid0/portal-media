import { create } from "zustand";

/** In-memory IGDB art keyed by library game id (grid + ambient; details also read from IGDB payload). */
interface MetadataDisplayStore {
  igdbCoverUrlByGameId: Record<string, string>;
  setIgdbCoverForGame: (gameId: string, url: string | null | undefined) => void;
  mergeIgdbCoverUrls: (urlsByGameId: Record<string, string>) => void;
  clearIgdbArtCache: () => void;
}

export const useMetadataDisplayStore = create<MetadataDisplayStore>((set) => ({
  igdbCoverUrlByGameId: {},
  setIgdbCoverForGame: (gameId, url) =>
    set((s) => {
      const next = { ...s.igdbCoverUrlByGameId };
      if (!gameId || !url?.trim()) {
        delete next[gameId];
      } else {
        next[gameId] = url.trim();
      }
      return { igdbCoverUrlByGameId: next };
    }),
  mergeIgdbCoverUrls: (urlsByGameId) =>
    set((s) => {
      const next = { ...s.igdbCoverUrlByGameId };
      for (const [id, url] of Object.entries(urlsByGameId)) {
        const t = url?.trim();
        if (id && t) next[id] = t;
      }
      return { igdbCoverUrlByGameId: next };
    }),
  clearIgdbArtCache: () => set({ igdbCoverUrlByGameId: {} }),
}));
