import type { Game, GameCategory, LaunchType } from "@/types/game";

const CATEGORIES: ReadonlySet<GameCategory> = new Set(["Game", "App", "Media", "Bookmark"]);
const LAUNCH: ReadonlySet<LaunchType> = new Set([
  "Executable",
  "Steam",
  "Epic",
  "Gog",
  "Ubisoft",
  "Xbox",
  "Url",
]);

function pickOptStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Maps a backend / JSON row into the canonical `Game` shape (accepts camelCase IPC keys). */
export function normalizeLibraryGame(raw: unknown): Game {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Invalid game row");
  }
  const r = raw as Record<string, unknown>;

  const catRaw = r.category;
  const category: GameCategory =
    typeof catRaw === "string" && CATEGORIES.has(catRaw as GameCategory)
      ? (catRaw as GameCategory)
      : "App";

  const ltRaw = r.launch_type ?? r.launchType;
  const launch_type: LaunchType =
    typeof ltRaw === "string" && LAUNCH.has(ltRaw as LaunchType)
      ? (ltRaw as LaunchType)
      : "Executable";

  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    path: String(r.path ?? ""),
    executable: String(r.executable ?? ""),
    cover_art: pickOptStr(r.cover_art ?? r.coverArt),
    icon: pickOptStr(r.icon),
    platform: String(r.platform ?? ""),
    category,
    launch_type,
  };
}

export function normalizeLibraryGames(raw: unknown): Game[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: Game[] = [];
  for (const row of raw) {
    try {
      out.push(normalizeLibraryGame(row));
    } catch {
      /* skip corrupt snapshot rows */
    }
  }
  return out;
}
