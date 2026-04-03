/**
 * Canonical brand keys parsed from external URLs (hosts / paths).
 * Used to pick consistent icons and labels across IGDB links and similar surfaces.
 */
export type ExternalLinkBrand =
  | "facebook"
  | "youtube"
  | "google"
  | "discord"
  | "epicgames"
  | "steam"
  | "gog"
  | "itch"
  | "twitch"
  | "xbox"
  | "playstation"
  | "nintendo"
  | "x"
  | "twitter"
  | "reddit"
  | "instagram"
  | "wikipedia"
  | "fandom"
  | "tiktok"
  | "linkedin"
  | "spotify"
  | "amazon"
  | "apple"
  | "igdb"
  | "rockstar"
  | "tmdb"
  | "netflix"
  | "primevideo"
  | "disneyplus"
  | "hulu"
  | "hbomax"
  | "paramountplus"
  | "peacock"
  | "unknown";

function hostKey(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

/**
 * Parses a URL and returns a stable brand key for icon/display heuristics.
 * Safe for invalid URLs — returns `"unknown"`.
 */
export function externalLinkBrandFromUrl(rawUrl: string): ExternalLinkBrand {
  const trimmed = rawUrl?.trim() ?? "";
  if (!trimmed) return "unknown";

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return "unknown";
  }

  const host = hostKey(url.hostname);
  const path = `${url.pathname}${url.search}`.toLowerCase();

  const hostEndsWith = (suffix: string) => host === suffix || host.endsWith(`.${suffix}`);

  if (hostEndsWith("igdb.com")) return "igdb";
  if (hostEndsWith("themoviedb.org") || hostEndsWith("tmdb.org")) return "tmdb";
  if (hostEndsWith("netflix.com")) return "netflix";
  if (hostEndsWith("primevideo.com")) return "primevideo";
  if (hostEndsWith("disneyplus.com")) return "disneyplus";
  if (hostEndsWith("hulu.com")) return "hulu";
  if (hostEndsWith("max.com") || hostEndsWith("hbomax.com")) return "hbomax";
  if (hostEndsWith("paramountplus.com")) return "paramountplus";
  if (hostEndsWith("peacocktv.com")) return "peacock";
  if (hostEndsWith("facebook.com") || host === "fb.com" || hostEndsWith("fb.com")) return "facebook";
  if (hostEndsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (hostEndsWith("google.com") || hostEndsWith("goo.gl")) return "google";
  if (host === "play.google.com" || (hostEndsWith("google.com") && path.includes("/store/apps"))) {
    return "google";
  }
  if (hostEndsWith("discord.com") || hostEndsWith("discord.gg")) return "discord";
  if (hostEndsWith("epicgames.com") || hostEndsWith("unrealengine.com")) return "epicgames";
  if (
    hostEndsWith("steampowered.com") ||
    hostEndsWith("steamcommunity.com") ||
    hostEndsWith("steamstatic.com")
  ) {
    return "steam";
  }
  if (hostEndsWith("gog.com")) return "gog";
  if (hostEndsWith("itch.io")) return "itch";
  if (hostEndsWith("twitch.tv")) return "twitch";
  if (hostEndsWith("xbox.com")) return "xbox";
  if (hostEndsWith("microsoft.com") && (path.includes("xbox") || path.includes("/store/games"))) {
    return "xbox";
  }
  if (hostEndsWith("playstation.com")) return "playstation";
  if (hostEndsWith("nintendo.com")) return "nintendo";
  if (host === "x.com" || hostEndsWith(".x.com")) return "x";
  if (hostEndsWith("twitter.com") || host === "t.co") return "twitter";
  if (hostEndsWith("reddit.com") || hostEndsWith("redd.it")) return "reddit";
  if (hostEndsWith("instagram.com")) return "instagram";
  if (hostEndsWith("wikipedia.org") || hostEndsWith("wikimedia.org")) return "wikipedia";
  if (hostEndsWith("fandom.com") || hostEndsWith("wikia.com")) return "fandom";
  if (hostEndsWith("tiktok.com")) return "tiktok";
  if (hostEndsWith("linkedin.com")) return "linkedin";
  if (hostEndsWith("spotify.com")) return "spotify";
  if (hostEndsWith("amazon.com") || hostEndsWith("amazon.co.uk") || host.endsWith(".amazon.")) {
    return "amazon";
  }
  if (hostEndsWith("apple.com")) return "apple";
  if (hostEndsWith("rockstargames.com")) return "rockstar";

  return "unknown";
}

const BRAND_DISPLAY_LABEL: Partial<Record<ExternalLinkBrand, string>> = {
  facebook: "Facebook",
  youtube: "YouTube",
  google: "Google",
  discord: "Discord",
  epicgames: "Epic Games",
  steam: "Steam",
  gog: "GOG",
  itch: "itch.io",
  twitch: "Twitch",
  xbox: "Xbox",
  playstation: "PlayStation",
  nintendo: "Nintendo",
  x: "X",
  twitter: "Twitter",
  reddit: "Reddit",
  instagram: "Instagram",
  wikipedia: "Wikipedia",
  fandom: "Fandom",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  spotify: "Spotify",
  amazon: "Amazon",
  apple: "Apple",
  igdb: "IGDB",
  rockstar: "Rockstar",
  tmdb: "TMDB",
  netflix: "Netflix",
  primevideo: "Prime Video",
  disneyplus: "Disney+",
  hulu: "Hulu",
  hbomax: "Max",
  paramountplus: "Paramount+",
  peacock: "Peacock",
};

/** Short UI label: known brands get a proper name; otherwise reuse IGDB’s label (title-cased lightly). */
export function displayLabelForExternalUrl(url: string, igdbFallbackLabel: string): string {
  const brand = externalLinkBrandFromUrl(url);
  const named = brand !== "unknown" ? BRAND_DISPLAY_LABEL[brand] : undefined;
  if (named) return named;
  const raw = igdbFallbackLabel.trim();
  if (!raw) return "Link";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Tailwind `text-*` classes for Lucide link glyphs (approximate brand colors).
 * Unknown / generic hosts use `neutralClass` so icons are not forced to theme primary.
 */
export function tailwindIconTextClassForExternalUrl(
  url: string,
  neutralClass: string = "text-muted-foreground"
): string {
  const brand = externalLinkBrandFromUrl(url);
  switch (brand) {
    case "facebook":
      return "text-[#1877F2]";
    case "youtube":
      return "text-[#FF0000]";
    case "google":
      return "text-[#4285F4]";
    case "discord":
      return "text-[#5865F2]";
    case "epicgames":
      return "text-[#E7D049]";
    case "steam":
      return "text-[#66C0F4]";
    case "gog":
      return "text-[#86328A]";
    case "itch":
      return "text-[#FA5C5C]";
    case "twitch":
      return "text-[#9146FF]";
    case "xbox":
      return "text-[#107C10]";
    case "playstation":
      return "text-[#0070D1]";
    case "nintendo":
      return "text-[#E60012]";
    case "x":
    case "twitter":
      return "text-foreground";
    case "reddit":
      return "text-[#FF4500]";
    case "instagram":
      return "text-[#E4405F]";
    case "wikipedia":
    case "fandom":
      return "text-foreground";
    case "tiktok":
      return "text-[#FE2C55]";
    case "linkedin":
      return "text-[#0A66C2]";
    case "spotify":
      return "text-[#1DB954]";
    case "amazon":
    case "primevideo":
      return "text-[#FF9900]";
    case "apple":
      return "text-foreground";
    case "igdb":
      return "text-[#9147FF]";
    case "rockstar":
      return "text-[#FCAF17]";
    case "tmdb":
      return "text-[#01D277]";
    case "netflix":
      return "text-[#E50914]";
    case "disneyplus":
      return "text-[#113CCF]";
    case "hulu":
      return "text-[#1CE783]";
    case "hbomax":
      return "text-[#B535F6]";
    case "paramountplus":
      return "text-[#0064FF]";
    case "peacock":
      return "text-[#C8102E]";
    case "unknown":
    default:
      return neutralClass;
  }
}
