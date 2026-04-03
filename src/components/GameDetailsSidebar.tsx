import { useEffect, useCallback, type ReactNode } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useFocusable } from "@/hooks/useNavigationState";
import { EXECUTE_DETAILS_ACTION } from "@/navigation/universalNavCore";
import { Button } from "@/components/ui/button";
import { PlatformLabel } from "@/components/PlatformLabel";
import { getSafeImageSource } from "@/utils/imageUtils";
import {
  formatLastOpened,
  getLinkHostname,
  launchTypeLabel,
  truncateMiddle,
} from "@/utils/gameDisplay";
import { cn } from "@/lib/utils";
import { Copy, LayoutList, Play, Star } from "lucide-react";
import { toast } from "sonner";

function DetailsFocusControl({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const { detailsIndex } = useNavigationStore();
  const { isFocused, showFocusIndicator } = useFocusable("details", index);
  const isFocusedItem = isFocused && detailsIndex === index;

  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-ps5 spring-ease",
        isFocusedItem && showFocusIndicator && "ring-2 ring-primary/60 ring-offset-2 ring-offset-card animate-focus-ring",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GameDetailsSidebar() {
  const filteredGames = useGameStore((s) => s.filteredGames);
  const selectedIndex = useGameStore((s) => s.selectedIndex);
  const favoriteIds = useGameStore((s) => s.favoriteIds);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const launchGame = useGameStore((s) => s.launchGame);
  const getLastOpenedTime = useGameStore((s) => s.getLastOpenedTime);

  const game = filteredGames[selectedIndex] ?? null;
  const isFavorite = game ? favoriteIds.includes(game.id) : false;
  const cover = game ? getSafeImageSource(game.cover_art || game.icon) : null;
  const lastOpened = game ? getLastOpenedTime(game.id) : 0;
  const host = game ? getLinkHostname(game) : null;
  const pathLine = game
    ? game.launch_type === "Url"
      ? game.executable || game.path
      : game.path || game.executable
    : "";

  const copyPath = useCallback(async () => {
    if (!pathLine) return;
    try {
      await navigator.clipboard.writeText(pathLine);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [pathLine]);

  useEffect(() => {
    const onExecute = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (!game) return;
      if (idx === 0) toggleFavorite(game.id);
      if (idx === 1) void copyPath();
      if (idx === 2) void launchGame(game);
    };
    window.addEventListener(EXECUTE_DETAILS_ACTION, onExecute as EventListener);
    return () => window.removeEventListener(EXECUTE_DETAILS_ACTION, onExecute as EventListener);
  }, [game, toggleFavorite, copyPath, launchGame]);

  return (
    <aside
      className={cn(
        "h-full w-[min(100%,22rem)] sm:w-96 shrink-0 flex flex-col",
        "border-l border-border/60 bg-card/80 backdrop-blur-xl",
        "shadow-[inset_1px_0_0_0_hsl(var(--foreground)/0.06)]"
      )}
      aria-label="Item details"
    >
      {!game ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="rounded-2xl p-5 bg-muted/40 border border-border/50">
            <LayoutList className="w-10 h-10 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Details</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[14rem]">
              Select a game, app, or bookmark in the grid to see more info and actions here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="relative aspect-[16/10] w-full shrink-0 bg-muted/40 overflow-hidden">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSafeImageSource(null);
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">
                {game.category === "Media" ? "📺" : game.category === "Bookmark" ? "🔗" : "🎮"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <DetailsFocusControl index={0} className="absolute top-3 right-3 inline-flex">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-xl shadow-lg border border-border/60",
                  isFavorite && "bg-amber-500/15 text-amber-500 border-amber-500/40"
                )}
                onClick={() => toggleFavorite(game.id)}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
              </Button>
            </DetailsFocusControl>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground leading-tight tracking-tight">
                {game.name}
              </h2>
              <p
                className={cn(
                  "text-sm mt-1.5 truncate font-medium",
                  host ? "text-primary/90" : "text-muted-foreground"
                )}
                title={host ?? game.platform}
              >
                {host ?? game.platform}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <PlatformLabel game={game} size="sm" variant="badge" />
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted/80 text-muted-foreground border border-border/60">
                {game.category}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                {launchTypeLabel(game.launch_type)}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Last opened
              </p>
              <p className="text-sm text-foreground">{formatLastOpened(lastOpened)}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {game.launch_type === "Url" ? "URL" : "Install path"}
                </p>
                <DetailsFocusControl index={1} className="inline-flex rounded-lg">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void copyPath()}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                </DetailsFocusControl>
              </div>
              <p
                className="text-xs font-mono text-foreground/90 break-all leading-relaxed"
                title={pathLine}
              >
                {truncateMiddle(pathLine, 120)}
              </p>
            </div>

            <DetailsFocusControl index={2} className="block">
              <Button
                type="button"
                className="w-full h-12 rounded-xl text-base font-semibold gap-2 shadow-lg shadow-primary/20"
                onClick={() => void launchGame(game)}
              >
                <Play className="h-5 w-5 fill-current" />
                {game.launch_type === "Url" ? "Open" : "Launch"}
              </Button>
            </DetailsFocusControl>

            <p className="text-xs text-muted-foreground text-center pb-2">
              Escape or Back toggles the grid and this panel. F10 or the Menu key focuses the left
              rail. Enter / A activates the focused control.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
