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
import { ChevronDown, HardDrive, Layers } from "lucide-react";

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

  return (
    <article className="overflow-hidden rounded-none border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted sm:gap-4 sm:px-4 sm:py-3.5"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-none border border-border bg-muted sm:h-14 sm:w-14">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <HardDrive className="h-5 w-5" aria-hidden />
            </span>
          )}
          <span className="absolute bottom-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center bg-background px-1 text-xs font-bold tabular-nums text-foreground">
            {group.bundles.length}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">{group.gameName}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {game ? (
              <PlatformLabel game={game} size="sm" variant="badge" />
            ) : (
              <span className="rounded-none border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {group.platform}
              </span>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">
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
              className="hidden h-8 rounded-none text-xs sm:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                appNavigate(`/game/${encodeURIComponent(group.gameId)}/saves`);
              }}
            >
              <Layers className="mr-1 h-3.5 w-3.5" aria-hidden />
              All saves
            </Button>
          ) : null}
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-150",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <ul className="min-h-0 space-y-2 overflow-hidden border-t border-border px-3 pb-3 pt-2">
          {group.bundles.map((b) => (
            <SaveBundleListItem
              key={b.bundleId}
              bundle={b}
              showGameLink={false}
              variant={variant}
            />
          ))}
        </ul>
      </div>
    </article>
  );
}
