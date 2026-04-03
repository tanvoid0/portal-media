import type { Game } from "@/stores/gameStore";

export function getLinkHostname(game: Game): string | null {
  if (game.launch_type !== "Url") return null;
  const raw = (game.executable || game.path || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Secondary line for cards: streaming/site host for URLs, otherwise platform name. */
export function getGameCardSubtitle(game: Game): string {
  return getLinkHostname(game) ?? game.platform;
}

export function launchTypeLabel(launchType: Game["launch_type"]): string {
  switch (launchType) {
    case "Executable":
      return "Local app";
    case "Steam":
      return "Steam";
    case "Epic":
      return "Epic Games";
    case "Gog":
      return "GOG Galaxy";
    case "Ubisoft":
      return "Ubisoft Connect";
    case "Xbox":
      return "Xbox / Microsoft Store";
    case "Url":
      return "Web link";
    default:
      return launchType;
  }
}

export function truncateMiddle(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const edge = Math.max(4, Math.floor((maxLen - 1) / 2));
  return `${str.slice(0, edge)}…${str.slice(-edge)}`;
}

export function formatLastOpened(timestamp: number): string {
  if (!timestamp) return "Never opened";
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Opened just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Opened ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `Opened ${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 21) return `Opened ${days}d ago`;
  return `Opened ${new Date(timestamp).toLocaleDateString()}`;
}
