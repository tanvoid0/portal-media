import { create } from "zustand";

/** In-memory IGDB art keyed by library game id (grid + ambient; details also read from IGDB payload). */
interface MetadataDisplayStore {
  igdbCoverUrlByGameId: Record<string, string>;
  setIgdbCoverForGame: (gameId: string, url: string | null | undefined) => void;
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
  clearIgdbArtCache: () => set({ igdbCoverUrlByGameId: {} }),
}));
