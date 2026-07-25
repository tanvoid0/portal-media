import { cn } from "@/lib/utils";
import type { ContentTileRemoteFocus } from "@/types/contentTile";

/**
 * Root surface for tall library cards (games, apps, bookmarks) with art + caption.
 */
export function contentTileLibraryCardClasses({
  showRemoteFocus,
  hovered,
  mouseSelected,
}: ContentTileRemoteFocus & { hovered: boolean }): string {
  return cn(
    "relative cursor-pointer border border-border/80 overflow-hidden group/card",
    "tile-surface-transition transform-gpu will-change-[transform,box-shadow]",
    "bg-card font-ui isolate shadow-[0_2px_8px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.12)]",
    showRemoteFocus
      ? "scale-[var(--tile-focus-scale)] z-10 translate-y-[var(--tile-lift-focus)] border-primary/60 card-glow brightness-[1.02]"
      : hovered
        ? "scale-[var(--tile-hover-scale)] z-20 translate-y-[var(--tile-lift-hover)] shadow-card border-primary/35"
        : "scale-100 z-0",
    mouseSelected &&
      "ring-2 ring-primary/45 shadow-md shadow-primary/20 border-primary/50 ring-offset-2 ring-offset-background",
    !showRemoteFocus && "hover:border-primary/35"
  );
}
