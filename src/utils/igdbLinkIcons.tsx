import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Facebook,
  Gamepad2,
  Globe,
  Instagram,
  MessageCircle,
  ShoppingBag,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react";

/** Pick a small icon from IGDB link label (from Twitch category) or URL host. */
export function igdbLinkIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("wikipedia")) return BookOpen;
  if (l.includes("fandom") || l.includes("wikia")) return BookOpen;
  if (l.includes("youtube")) return Youtube;
  if (l.includes("twitter")) return Twitter;
  if (l.includes("facebook")) return Facebook;
  if (l.includes("instagram")) return Instagram;
  if (l.includes("twitch")) return Twitch;
  if (l.includes("reddit")) return MessageCircle;
  if (l.includes("discord")) return MessageCircle;
  if (l.includes("steam") || l.includes("epic") || l.includes("gog") || l.includes("itch")) {
    return ShoppingBag;
  }
  if (l.includes("official")) return Gamepad2;
  return Globe;
}
