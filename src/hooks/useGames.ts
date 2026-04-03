import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useStreamingAddonStore } from "@/stores/streamingAddonStore";

export function useGames() {
  const { loadCachedLibrary, scanGames, games, isLoading, error } = useGameStore();

  useEffect(() => {
    void (async () => {
      await useStreamingAddonStore.getState().load();
      await loadCachedLibrary();
    })();
  }, [loadCachedLibrary]);

  return { games, isLoading, error, refresh: scanGames };
}

