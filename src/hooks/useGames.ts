import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";

export function useGames() {
  const { scanGames, games, isLoading, error } = useGameStore();

  useEffect(() => {
    // Auto-scan games on mount
    scanGames();
  }, [scanGames]);

  return { games, isLoading, error, refresh: scanGames };
}

