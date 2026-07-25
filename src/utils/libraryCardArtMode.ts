import type { Game } from "@/stores/gameStore";
import {
  resolveLibraryTileHeroVariant,
  type LibraryTileHeroVariant,
} from "@/utils/libraryTileLayout";

/** Discover / legacy grids still use overlay poster mode. */
export type ShelfCardArtMode = "posterCover" | "iconContain" | "brandMark";

/** Maps unified library hero variant onto ShelfCard's library layout prop. */
export function libraryHeroToShelfLayout(
  hero: LibraryTileHeroVariant
): "poster" | "mark" {
  return hero;
}

/** Library grid tiles — always the unified shell. */
export function resolveLibraryShelfLayout(
  game: Pick<Game, "category" | "launch_type">,
  art: { cardImage?: string | null; coverArt?: string; igdbCover?: string }
): "poster" | "mark" {
  return libraryHeroToShelfLayout(resolveLibraryTileHeroVariant(game, art));
}

/** @deprecated Use resolveLibraryShelfLayout; kept for tests / gradual migration. */
export function resolveLibraryCardArtMode(
  game: Pick<Game, "category" | "launch_type">,
  art: { cardImage?: string | null; coverArt?: string; igdbCover?: string }
): ShelfCardArtMode {
  const hero = resolveLibraryTileHeroVariant(game, art);
  return hero === "poster" ? "posterCover" : "brandMark";
}
