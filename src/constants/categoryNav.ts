import { FAVORITES_CATEGORY_ID } from "@/types/game";

/** Full category strip order for nav index 0..5 (sidebar = first five, favourites = last index). */
export const CATEGORY_NAV_ORDER = [
  { id: null as string | null, label: "All" },
  { id: "Game" as const, label: "Games" },
  { id: "App" as const, label: "Apps" },
  { id: "Media" as const, label: "Media" },
  { id: "Bookmark" as const, label: "Bookmarks" },
  { id: FAVORITES_CATEGORY_ID, label: "Favourites" },
] as const;

/** Left-rail compact category buttons (excludes favourites — shown in the top bar). */
export const SIDEBAR_CATEGORY_NAV_ORDER = CATEGORY_NAV_ORDER.slice(0, -1);

export const FAVORITES_NAV_INDEX = CATEGORY_NAV_ORDER.length - 1;
