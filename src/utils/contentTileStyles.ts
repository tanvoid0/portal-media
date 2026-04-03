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
    "relative cursor-pointer border border-border/50 overflow-hidden group/card",
    "tile-surface-transition transform-gpu will-change-transform",
    "bg-card font-ui",
    showRemoteFocus
      ? "scale-[var(--tile-focus-scale)] z-10 translate-y-[var(--tile-lift-focus)] border-primary/60 card-glow"
      : hovered
        ? "scale-[var(--tile-hover-scale)] z-20 translate-y-[var(--tile-lift-hover)] shadow-card border-border hover:border-primary/30"
        : "scale-100 z-0 shadow-sm",
    mouseSelected &&
      "ring-2 ring-primary/40 shadow-md shadow-primary/15 border-primary/40 ring-offset-2 ring-offset-background",
    "hover:border-primary/30"
  );
}
