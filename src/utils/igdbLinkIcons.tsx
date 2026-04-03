import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Facebook,
  Film,
  Gamepad2,
  Globe,
  Instagram,
  Library,
  MessageCircle,
  Package,
  Search,
  Store,
  Tv,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react";
import { type ExternalLinkBrand, externalLinkBrandFromUrl } from "@/utils/linkBrandFromUrl";

/** Map parsed brand key → Lucide icon (no raw brand SVGs; recognizable silhouettes where available). */
export function lucideIconForExternalLinkBrand(brand: ExternalLinkBrand): LucideIcon {
  switch (brand) {
    case "facebook":
      return Facebook;
    case "youtube":
      return Youtube;
    case "google":
      return Search;
    case "instagram":
      return Instagram;
    case "twitch":
      return Twitch;
    case "twitter":
    case "x":
      return Twitter;
    case "discord":
    case "reddit":
      return MessageCircle;
    case "steam":
    case "epicgames":
    case "gog":
    case "itch":
      return Store;
    case "amazon":
    case "apple":
      return Package;
    case "xbox":
    case "playstation":
    case "nintendo":
    case "rockstar":
      return Gamepad2;
    case "wikipedia":
    case "fandom":
      return BookOpen;
    case "igdb":
      return Library;
    case "tmdb":
      return Film;
    case "netflix":
    case "primevideo":
    case "disneyplus":
    case "hulu":
    case "hbomax":
    case "paramountplus":
    case "peacock":
      return Tv;
    case "tiktok":
    case "linkedin":
    case "spotify":
      return Globe;
    default:
      return Globe;
  }
}

function iconFromLabelHint(label: string): LucideIcon | null {
  const l = label.toLowerCase();
  if (l.includes("wikipedia")) return BookOpen;
  if (l.includes("fandom") || l.includes("wikia")) return BookOpen;
  if (l.includes("youtube")) return Youtube;
  if (l.includes("twitter") || l === "x" || l.startsWith("x ")) return Twitter;
  if (l.includes("facebook")) return Facebook;
  if (l.includes("instagram")) return Instagram;
  if (l.includes("twitch")) return Twitch;
  if (l.includes("reddit")) return MessageCircle;
  if (l.includes("discord")) return MessageCircle;
  if (l.includes("xbox")) return Gamepad2;
  if (l.includes("playstation") || l.includes("psn")) return Gamepad2;
  if (l.includes("nintendo")) return Gamepad2;
  if (l.includes("steam")) return Store;
  if (l.includes("epic")) return Store;
  if (l.includes("gog")) return Store;
  if (l.includes("itch")) return Store;
  if (l.includes("google")) return Search;
  if (l.includes("amazon")) return Package;
  if (l.includes("apple") || l.includes("app store")) return Package;
  if (l.includes("spotify")) return Globe;
  if (l.includes("tiktok")) return Globe;
  if (l.includes("linkedin")) return Globe;
  if (l.includes("rockstar")) return Gamepad2;
  if (l.includes("official")) return Gamepad2;
  if (l.includes("netflix")) return Tv;
  if (l.includes("disney")) return Tv;
  if (l.includes("hulu")) return Tv;
  if (l.includes("prime video") || l.includes("primevideo")) return Tv;
  if (l.includes("paramount")) return Tv;
  if (l.includes("peacock")) return Tv;
  if (/\bhbo\b/.test(l) || /\bmax\b/.test(l)) return Tv;
  if (l.includes("tmdb")) return Film;
  return null;
}

/**
 * Icon for an external link: URL host/path first, then optional IGDB-style label hint.
 */
export function linkIconFromUrl(url: string, labelHint?: string): LucideIcon {
  const brand = externalLinkBrandFromUrl(url);
  if (brand !== "unknown") {
    return lucideIconForExternalLinkBrand(brand);
  }
  if (labelHint?.trim()) {
    const fromLabel = iconFromLabelHint(labelHint);
    if (fromLabel) return fromLabel;
  }
  return Globe;
}

