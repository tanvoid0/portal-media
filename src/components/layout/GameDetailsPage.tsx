import { useLayoutEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { GameDetailsContent } from "@/components/GameDetailsContent";
import { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";

export function GameDetailsPage() {
  const { gameId } = useParams();
  const sourceGames = useGameStore((s) => s.sourceGames);
  const filteredGames = useGameStore((s) => s.filteredGames);
  const setSelectedIndex = useGameStore((s) => s.setSelectedIndex);

  const game = useMemo(
    () => (gameId ? sourceGames.find((g) => g.id === gameId) ?? null : null),
    [gameId, sourceGames]
  );

  useLayoutEffect(() => {
    useNavigationStore.getState().setDetailsMaxIndex(DETAILS_FOCUS_MAX_INDEX);
    useNavigationStore.getState().setFocusArea("details");
    return () => {
      useNavigationStore.getState().setDetailsMaxIndex(DETAILS_FOCUS_MAX_INDEX);
      useNavigationStore.getState().setFocusArea("games");
    };
  }, []);

  useLayoutEffect(() => {
    if (!gameId) return;
    const idx = filteredGames.findIndex((g) => g.id === gameId);
    if (idx >= 0) setSelectedIndex(idx);
  }, [gameId, filteredGames, setSelectedIndex]);

  if (!gameId) return <Navigate to="/library/all" replace />;
  if (!game) return <Navigate to="/library/all" replace />;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <GameDetailsContent game={game} layout="page" />
    </div>
  );
}
