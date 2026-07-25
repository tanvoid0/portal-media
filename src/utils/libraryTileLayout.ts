import type { Game } from "@/stores/gameStore";

/** How the hero region renders on unified library shelf tiles. */
export type LibraryTileHeroVariant = "poster" | "mark";

export function isLibraryPosterArt(art: {
  coverArt?: string;
  igdbCover?: string;
}): boolean {
  return Boolean(art.coverArt?.trim() || art.igdbCover?.trim());
}

/**
 * Unified library grid: every category shares one tile shell (hero + caption band).
 * Only the hero content differs — full poster vs centered mark.
 */
export function resolveLibraryTileHeroVariant(
  game: Pick<Game, "category" | "launch_type">,
  art: {
    cardImage?: string | null;
    coverArt?: string;
    igdbCover?: string;
  }
): LibraryTileHeroVariant {
  if (game.category === "App") {
    return "mark";
  }
  if (isLibraryPosterArt(art)) {
    return "poster";
  }
  if (
    game.category === "Media" ||
    game.category === "Bookmark" ||
    game.launch_type === "Url"
  ) {
    return "mark";
  }
  return "mark";
}

/** Frosted frame sizing: app shortcuts need a touch more padding for OS icons. */
export function libraryTileMarkFrameKind(
  category: Game["category"]
): "app" | "default" {
  return category === "App" ? "app" : "default";
}
