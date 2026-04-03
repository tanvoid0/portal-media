export type SortType = "alphabetical" | "lastOpened" | "default";

export type GameCategory = "Game" | "App" | "Media" | "Bookmark";

export type LaunchType = "Executable" | "Steam" | "Epic" | "Gog" | "Ubisoft" | "Xbox" | "Url";

export interface Game {
  id: string;
  name: string;
  path: string;
  executable: string;
  cover_art?: string;
  icon?: string;
  platform: string;
  category: GameCategory;
  launch_type: LaunchType;
}

/** Virtual category: filter by `favoriteIds`, not `game.category`. */
export const FAVORITES_CATEGORY_ID = "Favorite" as const;
