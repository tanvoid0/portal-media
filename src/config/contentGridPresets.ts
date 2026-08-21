import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { ContentGridPreset } from "@/types/contentGrid";

/** Games / apps / bookmarks — fixed portrait covers, not stretched 1fr cards. */
export const LIBRARY_GAMES_GRID_PRESET: ContentGridPreset = {
  minTileWidthPx: 256,
  gapClass: "gap-10",
  paddingClass: "px-10 pt-8 pb-12",
  scrollPaddingClass: "scroll-pt-6 scroll-pb-10",
  containerClassName: "relative z-10 auto-rows-max scroll-smooth justify-items-start",
};

/** Movie/TV/game posters — denser grid, horizontal padding matches discover header. */
export const DISCOVER_POSTERS_GRID_PRESET: ContentGridPreset = {
  /** Matches `ShelfCard` width (~w-56) + gutter */
  minTileWidthPx: 248,
  gapClass: "gap-6",
  paddingClass: "px-6 sm:px-10 pt-6 pb-8",
  scrollPaddingClass: "scroll-pt-4 scroll-pb-8",
};

/**
 * Inline grid tracks — Tailwind JIT cannot see `${px}` in template strings, so a dynamic
 * `grid-cols-[repeat(auto-fill,minmax(...))]` class often never lands in the CSS bundle
 * and the grid collapses to a single column.
 */
export function contentGridTemplateColumnsStyle(
  preset: Pick<ContentGridPreset, "minTileWidthPx">
): CSSProperties {
  return {
    gridTemplateColumns: `repeat(auto-fill, ${preset.minTileWidthPx}px)`,
  };
}

export function buildContentGridContainerClassName(preset: ContentGridPreset): string {
  return cn(
    "grid w-full min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide content-start flex-1 min-h-0",
    preset.gapClass,
    preset.paddingClass,
    preset.scrollPaddingClass,
    preset.containerClassName
  );
}

/** Named presets for new routes / experiments (`CONTENT_GRID_PRESETS.myShelf = { … }`). */
export const CONTENT_GRID_PRESETS = {
  libraryGames: LIBRARY_GAMES_GRID_PRESET,
  discoverPosters: DISCOVER_POSTERS_GRID_PRESET,
} as const;

export type ContentGridPresetId = keyof typeof CONTENT_GRID_PRESETS;

export function getContentGridPreset(id: ContentGridPresetId): ContentGridPreset {
  return CONTENT_GRID_PRESETS[id];
}
