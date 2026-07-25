import type { Game } from "@/stores/gameStore";
import { getGameCardSubtitle } from "@/utils/gameDisplay";
import type { LibraryTileHeroVariant } from "@/utils/libraryTileLayout";

/** Platform chip in the caption band (corner badges are not used on library tiles). */
export function shouldShowLibraryFooterPlatformChip(
  game: Pick<Game, "category">,
  _hero: LibraryTileHeroVariant
): boolean {
  if (game.category === "App") return true;
  if (game.category === "Game") return true;
  if (game.category === "Bookmark") return true;
  return false;
}

/** Secondary line under the title — avoids repeating the platform chip alone. */
export function libraryCardSubtitle(
  game: Game,
  hero: LibraryTileHeroVariant
): string | null {
  const line = getGameCardSubtitle(game);
  if (game.category === "App" && shouldShowLibraryFooterPlatformChip(game, hero)) {
    return null;
  }
  if (game.category === "Game" && shouldShowLibraryFooterPlatformChip(game, hero)) {
    return line.includes("·") ? line : null;
  }
  return line;
}
