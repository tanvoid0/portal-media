import type { SaveBundle } from "@/types/saveSync";

export type SaveLocationKind = "steam" | "documents" | "install" | "other";

export type SaveGroupSort = "name" | "recent" | "size";

export function formatSaveBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSaveModified(utcSecs: number): string {
  if (!utcSecs) return "Unknown";
  return new Date(utcSecs * 1000).toLocaleString();
}

export function formatSaveModifiedRelative(utcSecs: number): string {
  if (!utcSecs) return "Unknown";
  const diff = Date.now() - utcSecs * 1000;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(utcSecs * 1000).toLocaleDateString();
}

export function saveLocationKind(bundle: SaveBundle): SaveLocationKind {
  const label = bundle.label.toLowerCase();
  if (label.includes("steam")) return "steam";
  if (label.includes("documents") || label.includes("my games")) return "documents";
  if (label.includes("install")) return "install";
  return "other";
}

export function saveLocationKindLabel(kind: SaveLocationKind): string {
  switch (kind) {
    case "steam":
      return "Steam";
    case "documents":
      return "Documents";
    case "install":
      return "Install folder";
    default:
      return "Other";
  }
}

export interface GameSaveGroup {
  gameId: string;
  gameName: string;
  platform: string;
  bundles: SaveBundle[];
}

export function groupBundlesByGame(bundles: SaveBundle[]): GameSaveGroup[] {
  const map = new Map<string, GameSaveGroup>();
  for (const b of bundles) {
    let group = map.get(b.gameId);
    if (!group) {
      group = {
        gameId: b.gameId,
        gameName: b.gameName,
        platform: b.platform,
        bundles: [],
      };
      map.set(b.gameId, group);
    }
    group.bundles.push(b);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.bundles.sort((a, b) => b.modifiedUtc - a.modifiedUtc);
  }
  return groups;
}

export function groupTotalBytes(group: GameSaveGroup): number {
  return group.bundles.reduce((n, b) => n + b.sizeBytes, 0);
}

export function groupNewestModified(group: GameSaveGroup): number {
  return group.bundles.reduce((max, b) => Math.max(max, b.modifiedUtc), 0);
}

export function sortSaveGroups(groups: GameSaveGroup[], sort: SaveGroupSort): GameSaveGroup[] {
  const copy = [...groups];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => groupNewestModified(b) - groupNewestModified(a));
    case "size":
      return copy.sort((a, b) => groupTotalBytes(b) - groupTotalBytes(a));
    default:
      return copy.sort((a, b) => a.gameName.localeCompare(b.gameName));
  }
}

export function filterSaveGroups(
  groups: GameSaveGroup[],
  query: string
): GameSaveGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => {
      const hay = `${g.gameName} ${g.platform} ${g.bundles.map((b) => `${b.label} ${b.localPath}`).join(" ")}`.toLowerCase();
      if (hay.includes(q)) return g;
      const bundles = g.bundles.filter(
        (b) =>
          b.label.toLowerCase().includes(q) ||
          b.localPath.toLowerCase().includes(q) ||
          b.gameName.toLowerCase().includes(q)
      );
      if (bundles.length === 0) return null;
      return { ...g, bundles };
    })
    .filter((g): g is GameSaveGroup => g !== null);
}

export function filterSaveGroupsByKind(
  groups: GameSaveGroup[],
  kind: SaveLocationKind | "all"
): GameSaveGroup[] {
  if (kind === "all") return groups;
  return groups
    .map((g) => ({
      ...g,
      bundles: g.bundles.filter((b) => saveLocationKind(b) === kind),
    }))
    .filter((g) => g.bundles.length > 0);
}

export function explorerTotals(bundles: SaveBundle[]) {
  const games = new Set(bundles.map((b) => b.gameId));
  const bytes = bundles.reduce((n, b) => n + b.sizeBytes, 0);
  const newest = bundles.reduce((max, b) => Math.max(max, b.modifiedUtc), 0);
  return {
    gameCount: games.size,
    locationCount: bundles.length,
    totalBytes: bytes,
    newestModified: newest,
  };
}
