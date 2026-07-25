import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SaveBundleListItem } from "@/components/saves/SaveBundleListItem";
import {
  formatSaveBytes,
  formatSaveModifiedRelative,
  groupNewestModified,
  groupTotalBytes,
  type GameSaveGroup,
} from "@/utils/saveBundleDisplay";
import { useGameStore } from "@/stores/gameStore";
import { getSafeImageSource } from "@/utils/imageUtils";
import { PlatformLabel } from "@/components/PlatformLabel";
import { appNavigate } from "@/nav/appNavigate";
import { cn } from "@/lib/utils";
import { ChevronDown, Layers } from "lucide-react";

export function SaveGameGroupCard({
  group,
  expanded,
  onToggle,
  showGameLink = true,
  variant = "library",
}: {
  group: GameSaveGroup;
  expanded: boolean;
  onToggle: () => void;
  showGameLink?: boolean;
  variant?: "library" | "settings";
}) {
  const game = useGameStore((s) => s.sourceGames.find((g) => g.id === group.gameId));
  const cover = useMemo(
    () => (game ? getSafeImageSource(game.cover_art || game.icon) : null),
    [game]
  );
  const totalBytes = groupTotalBytes(group);
  const newest = groupNewestModified(group);
  const isSettings = variant === "settings";

  return (
    <article
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-panel spring-ease",
        isSettings
          ? "border-white/10 bg-white/[0.04] hover:border-white/20"
          : "border-border/50 bg-card/50 hover:border-border/80 hover:shadow-md hover:shadow-black/10"
      )}
    >
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-colors",
          isSettings ? "hover:bg-white/[0.06]" : "hover:bg-muted/20"
        )}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div
          className={cn(
            "relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 ring-1",
            isSettings ? "ring-white/15 bg-black/40" : "ring-border/60 bg-muted/30"
          )}
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl opacity-60">
              🎮
            </span>
          )}
          <span
            className={cn(
              "absolute bottom-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums",
              isSettings ? "bg-black/70 text-white" : "bg-background/90 text-foreground"
            )}
          >
            {group.bundles.length}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "text-sm sm:text-base font-semibold truncate",
              isSettings ? "text-white" : "text-foreground"
            )}
          >
            {group.gameName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {game ? (
              <PlatformLabel game={game} size="sm" variant="badge" />
            ) : (
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md border",
                  isSettings
                    ? "border-white/15 text-white/55"
                    : "border-border/50 text-muted-foreground"
                )}
              >
                {group.platform}
              </span>
            )}
            <span
              className={cn(
                "text-[10px] tabular-nums",
                isSettings ? "text-white/45" : "text-muted-foreground"
              )}
            >
              {formatSaveBytes(totalBytes)}
              {newest > 0 ? ` · ${formatSaveModifiedRelative(newest)}` : ""}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showGameLink ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "hidden sm:inline-flex h-8 text-xs",
                isSettings && "text-white/70 hover:text-white hover:bg-white/10"
              )}
              onClick={(e) => {
                e.stopPropagation();
                appNavigate(`/game/${encodeURIComponent(group.gameId)}/saves`);
              }}
            >
              <Layers className="w-3.5 h-3.5 mr-1" aria-hidden />
              All saves
            </Button>
          ) : null}
          <ChevronDown
            className={cn(
              "w-5 h-5 shrink-0 transition-transform duration-panel spring-ease",
              isSettings ? "text-white/50" : "text-muted-foreground",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-panel spring-ease",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <ul className="overflow-hidden border-t border-border/40 px-3 pb-3 pt-2 space-y-2 min-h-0">
          {group.bundles.map((b, i) => (
            <SaveBundleListItem
              key={b.bundleId}
              bundle={b}
              showGameLink={false}
              variant={variant}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </ul>
      </div>
    </article>
  );
}
