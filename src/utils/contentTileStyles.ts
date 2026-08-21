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
    "relative cursor-pointer border-2 border-border overflow-hidden group/card",
    "tile-surface-transition transform-gpu bg-card font-ui isolate",
    showRemoteFocus || mouseSelected
      ? "z-10 border-primary border-[3px]"
      : hovered
        ? "z-10 border-primary/70"
        : "z-0",
    !showRemoteFocus && "hover:border-primary/70"
  );
}
