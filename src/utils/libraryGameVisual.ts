import type { Game } from "@/stores/gameStore";

/**
 * Library tiles use caption-band platform chips; corner badges are discover-only.
 * @deprecated Library grid no longer uses corner badges — kept if referenced elsewhere.
 */
export function shouldShowLibraryGamePlatformCornerBadge(
  _game: Pick<Game, "launch_type" | "platform" | "category">,
  _art: { coverArt?: string; iconArt?: string; igdbCover?: string }
): boolean {
  return false;
}
