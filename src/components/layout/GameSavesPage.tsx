import { useLayoutEffect, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { SaveGameExplorer } from "@/components/saves/SaveGameExplorer";
import { PlatformLabel } from "@/components/PlatformLabel";
import { getSafeImageSource } from "@/utils/imageUtils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play } from "lucide-react";
import { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";
import { cn } from "@/lib/utils";

export function GameSavesPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const sourceGames = useGameStore((s) => s.sourceGames);
  const isLoading = useGameStore((s) => s.isLoading);
  const launchGame = useGameStore((s) => s.launchGame);

  const game = useMemo(
    () => (gameId ? sourceGames.find((g) => g.id === gameId) ?? null : null),
    [gameId, sourceGames]
  );

  const cover = useMemo(
    () => (game ? getSafeImageSource(game.cover_art || game.icon) : null),
    [game]
  );

  useLayoutEffect(() => {
    useNavigationStore.getState().setDetailsMaxIndex(DETAILS_FOCUS_MAX_INDEX);
    useNavigationStore.getState().setFocusArea("details");
    return () => {
      useNavigationStore.getState().setFocusArea("games");
    };
  }, []);

  if (!gameId) return <Navigate to="/library/all" replace />;
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!game) return <Navigate to="/library/all" replace />;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 relative overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0 bg-gradient-to-r from-card via-card/95 to-card/80"
          aria-hidden
        />
        {cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm scale-105"
            aria-hidden
          />
        ) : null}
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={() => navigate(`/game/${encodeURIComponent(game.id)}`)}
              aria-label="Back to game details"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden />
            </Button>
            <div
              className={cn(
                "w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 ring-2 ring-border/60 shadow-lg"
              )}
            >
              {cover ? (
                <img src={cover} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl bg-muted">
                  🎮
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Save data
              </p>
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{game.name}</h1>
              <PlatformLabel game={game} size="sm" variant="badge" />
            </div>
          </div>
          <Button
            type="button"
            className="shrink-0 h-10 rounded-xl gap-2 shadow-lg shadow-primary/20 sm:ml-auto"
            onClick={() => void launchGame(game)}
          >
            <Play className="w-4 h-4 fill-current" aria-hidden />
            Launch
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <SaveGameExplorer
          filterGameId={game.id}
          title="Save locations"
          description="Folders Portal can back up or open on this PC. Use Open to jump into File Explorer."
          variant="library"
        />
      </div>
    </div>
  );
}
