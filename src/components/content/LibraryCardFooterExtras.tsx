import { PlatformLabel } from "@/components/PlatformLabel";
import type { Game } from "@/stores/gameStore";
import { Clock } from "lucide-react";
import { formatLastOpenedShort } from "@/utils/gameDisplay";
import { shouldShowLibraryFooterPlatformChip } from "@/utils/libraryCardFooterMeta";
import type { LibraryTileHeroVariant } from "@/utils/libraryTileLayout";

export function LibraryCardFooterExtras({
  game,
  hero,
  isRunning,
  lastOpened,
}: {
  game: Game;
  hero: LibraryTileHeroVariant;
  isRunning: boolean;
  lastOpened: number;
}) {
  const showPlatform = shouldShowLibraryFooterPlatformChip(game, hero);

  if (isRunning) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary font-bold tracking-widest uppercase">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          Playing
        </span>
      </div>
    );
  }

  const hasMeta = showPlatform || lastOpened > 0;
  if (!hasMeta) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {showPlatform ? <PlatformLabel game={game} size="sm" variant="badge" /> : null}
      {showPlatform && lastOpened > 0 ? (
        <span className="text-muted-foreground/40 text-[10px] select-none">·</span>
      ) : null}
      {lastOpened > 0 ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 font-medium">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {formatLastOpenedShort(lastOpened)}
        </span>
      ) : null}
    </div>
  );
}
