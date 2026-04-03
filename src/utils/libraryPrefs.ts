import type { Game, GameCategory } from "@/types/game";

export const ARCHIVED_IDS_KEY = "portal_media_archived_ids";
export const CATEGORY_OVERRIDES_KEY = "portal_media_category_overrides";
export const CATEGORY_HIDES_KEY = "portal_media_category_hides";

/** Categories users can assign in the library UI (not Bookmark). */
export const OVERRIDABLE_CATEGORIES: readonly GameCategory[] = ["Game", "App", "Media"];

/** Sidebar / filter tabs (including Bookmarks). */
export const SIDEBAR_TAB_CATEGORIES: readonly GameCategory[] = ["Game", "App", "Media", "Bookmark"];

export function tabLabel(cat: GameCategory): string {
  switch (cat) {
    case "Game":
      return "Games";
    case "App":
      return "Apps";
    case "Media":
      return "Media";
    case "Bookmark":
      return "Bookmarks";
    default:
      return cat;
  }
}

const VALID_OVERRIDE: Set<GameCategory> = new Set(OVERRIDABLE_CATEGORIES);

function isGameCategory(v: unknown): v is GameCategory {
  return v === "Game" || v === "App" || v === "Media" || v === "Bookmark";
}

export function loadArchivedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARCHIVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function persistArchivedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ARCHIVED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadCategoryOverrides(): Record<string, GameCategory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CATEGORY_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, GameCategory> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== "string" || !isGameCategory(v) || !VALID_OVERRIDE.has(v)) continue;
      out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function persistCategoryOverrides(overrides: Record<string, GameCategory>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

const TAB_SET = new Set<GameCategory>(SIDEBAR_TAB_CATEGORIES);

export function loadCategoryHides(): Record<string, GameCategory[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CATEGORY_HIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, GameCategory[]> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (typeof id !== "string" || !Array.isArray(v)) continue;
      const tabs: GameCategory[] = [];
      for (const x of v) {
        if (typeof x === "string" && TAB_SET.has(x as GameCategory)) {
          tabs.push(x as GameCategory);
        }
      }
      if (tabs.length) out[id] = [...new Set(tabs)];
    }
    return out;
  } catch {
    return {};
  }
}

export function persistCategoryHides(hides: Record<string, GameCategory[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORY_HIDES_KEY, JSON.stringify(hides));
  } catch {
    // ignore
  }
}

export function applyCategoryOverrides(
  sourceGames: Game[],
  categoryOverrides: Record<string, GameCategory>
): Game[] {
  return sourceGames.map((g) => ({
    ...g,
    category: categoryOverrides[g.id] ?? g.category,
  }));
}

export function splitArchivedVisible(
  normalizedGames: Game[],
  archivedIds: string[]
): { visible: Game[]; archivedGames: Game[] } {
  const arch = new Set(archivedIds);
  return {
    visible: normalizedGames.filter((g) => !arch.has(g.id)),
    archivedGames: normalizedGames.filter((g) => arch.has(g.id)),
  };
}

/** Sidebar counts: omit items hidden from that tab (still listed under All). */
export function buildGamesByCategory(
  games: Game[],
  hiddenFromCategories: Record<string, GameCategory[]>
): Record<string, Game[]> {
  const gamesByCategory: Record<string, Game[]> = {
    Game: [],
    App: [],
    Media: [],
    Bookmark: [],
  };
  for (const game of games) {
    const category = game.category || "App";
    if (!gamesByCategory[category]) {
      gamesByCategory[category] = [];
    }
    if (hiddenFromCategories[game.id]?.includes(category)) continue;
    gamesByCategory[category].push(game);
  }
  return gamesByCategory;
}

/** Keep user-added entries from a previous library that are not in the new scan (manual games / URL bookmarks only). */
export function mergeScanWithCarry(base: Game[], previousSource: Game[]): Game[] {
  const baseIds = new Set(base.map((g) => g.id));
  const carry = previousSource.filter(
    (g) =>
      !baseIds.has(g.id) &&
      (g.id.startsWith("manual_") || g.id.startsWith("bookmark_"))
  );
  return [...base, ...carry];
}
