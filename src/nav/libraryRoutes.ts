import { DISCOVER_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "@/types/game";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";

export const LIBRARY_SECTIONS = ["all", "games", "apps", "media", "discover", "favorites"] as const;
export type LibrarySection = (typeof LIBRARY_SECTIONS)[number];

export function isValidLibrarySection(s: string | undefined): s is LibrarySection {
  return s !== undefined && (LIBRARY_SECTIONS as readonly string[]).includes(s);
}

export function categoryFromLibrarySection(section: LibrarySection): string | null {
  switch (section) {
    case "all":
      return null;
    case "games":
      return "Game";
    case "apps":
      return "App";
    case "media":
      return "Media";
    case "discover":
      return DISCOVER_CATEGORY_ID;
    case "favorites":
      return FAVORITES_CATEGORY_ID;
  }
}

export function librarySectionFromCategory(selectedCategory: string | null): LibrarySection {
  if (selectedCategory === null) return "all";
  if (selectedCategory === FAVORITES_CATEGORY_ID) return "favorites";
  if (selectedCategory === "Game") return "games";
  if (selectedCategory === "App") return "apps";
  if (selectedCategory === "Media") return "media";
  if (selectedCategory === DISCOVER_CATEGORY_ID) return "discover";
  return "all";
}

/** Library list/detail shell path for the current category filter. */
export function libraryPathForCategory(categoryId: string | null): string {
  return `/library/${librarySectionFromCategory(categoryId)}`;
}

export function categoryNavIndexForSection(section: LibrarySection): number {
  const id = categoryFromLibrarySection(section);
  const i = CATEGORY_NAV_ORDER.findIndex((row) => row.id === id);
  return i >= 0 ? i : 0;
}
