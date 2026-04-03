import { DISCOVER_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "@/types/game";

/**
 * Full category order for gamepad indices (favourites = last).
 * Bookmarks are not a dedicated route — bookmark items appear under All and relevant tabs.
 */
export const CATEGORY_NAV_ORDER = [
  { id: null as string | null, label: "All" },
  { id: "Game" as const, label: "Games" },
  { id: "App" as const, label: "Apps" },
  { id: "Media" as const, label: "Media" },
  { id: DISCOVER_CATEGORY_ID, label: "Discover" },
  { id: FAVORITES_CATEGORY_ID, label: "Favourites" },
] as const;

/** Category strip in header (excludes favourites — shown in the top bar). */
export const SIDEBAR_CATEGORY_NAV_ORDER = CATEGORY_NAV_ORDER.slice(0, -1);

export const FAVORITES_NAV_INDEX = CATEGORY_NAV_ORDER.length - 1;
