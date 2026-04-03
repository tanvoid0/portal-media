import type { Game } from "@/stores/gameStore";

/**
 * Hide the corner platform badge when the hero art is already the streaming/site icon
 * (avoids duplicating a streaming service mark already in the hero art).
 */
export function shouldShowLibraryGamePlatformCornerBadge(
  game: Pick<Game, "launch_type" | "platform" | "category">,
  art: { coverArt?: string; iconArt?: string; igdbCover?: string }
): boolean {
  const { coverArt, iconArt, igdbCover } = art;
  const iconHero = Boolean(iconArt?.trim()) && !coverArt?.trim() && !igdbCover?.trim();
  if (!iconHero) return true;

  if (game.launch_type === "Url") return false;
  if (game.platform?.toLowerCase() === "web") return false;
  if (game.category === "Bookmark") return false;

  return true;
}
