import type { ComponentType, SVGAttributes } from "react";
import {
  SiAppletv,
  SiCrunchyroll,
  SiEpicgames,
  SiGogdotcom,
  SiHbomax,
  SiMax,
  SiNetflix,
  SiParamountplus,
  SiSpotify,
  SiSteam,
  SiTwitch,
  SiUbisoft,
  SiYoutube,
} from "react-icons/si";
import { TbBrandAmazon, TbBrandDisney } from "react-icons/tb";
import { FaWindows, FaXbox } from "react-icons/fa6";
import { Globe, Monitor, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/stores/gameStore";

type SvgIcon = ComponentType<SVGAttributes<SVGElement> & { className?: string }>;

type ResolvedPlatform = {
  Icon: SvgIcon;
  label: string;
  /** Brand hex; omit to follow theme (primary / white). */
  brandColor?: string;
};

type PlatformLabelGame = Pick<
  Game,
  "platform" | "launch_type" | "name" | "path" | "executable"
>;

/** Approximate official / Simple Icons brand colors */
const STREAMING: Record<
  string,
  { Icon: SvgIcon; color: string }
> = {
  netflix: { Icon: SiNetflix, color: "#E50914" },
  disney: { Icon: TbBrandDisney, color: "#113CCF" },
  prime: { Icon: TbBrandAmazon, color: "#00A8E1" },
  youtube: { Icon: SiYoutube, color: "#FF0000" },
  hulu: { Icon: Tv, color: "#1CE783" },
  hbomax: { Icon: SiHbomax, color: "#B535F6" },
  max: { Icon: SiMax, color: "#002BE7" },
  paramount: { Icon: SiParamountplus, color: "#0064FF" },
  appletv: { Icon: SiAppletv, color: "#FA2D48" },
  crunchyroll: { Icon: SiCrunchyroll, color: "#F47521" },
  twitch: { Icon: SiTwitch, color: "#9146FF" },
  spotify: { Icon: SiSpotify, color: "#1DB954" },
};

function matchStreamingServiceHost(
  host: string,
  fullUrl: string
): Pick<ResolvedPlatform, "Icon" | "brandColor"> | null {
  const h = host.toLowerCase();
  const u = fullUrl.toLowerCase();

  if (h.endsWith("netflix.com") || h.includes("nflxso.net")) {
    const { Icon, color } = STREAMING.netflix;
    return { Icon, brandColor: color };
  }
  if (h.includes("disneyplus.") || h.includes("disney.com")) {
    const { Icon, color } = STREAMING.disney;
    return { Icon, brandColor: color };
  }
  if (h.includes("primevideo.") || (h.includes("amazon.") && u.includes("primevideo"))) {
    const { Icon, color } = STREAMING.prime;
    return { Icon, brandColor: color };
  }
  if (h.includes("youtube.") || h === "youtu.be") {
    const { Icon, color } = STREAMING.youtube;
    return { Icon, brandColor: color };
  }
  if (h.includes("hulu.")) {
    const { Icon, color } = STREAMING.hulu;
    return { Icon, brandColor: color };
  }
  if (h.includes("hbomax.")) {
    const { Icon, color } = STREAMING.hbomax;
    return { Icon, brandColor: color };
  }
  if (h === "max.com" || h.endsWith(".max.com")) {
    const { Icon, color } = STREAMING.max;
    return { Icon, brandColor: color };
  }
  if (h.includes("paramountplus.")) {
    const { Icon, color } = STREAMING.paramount;
    return { Icon, brandColor: color };
  }
  if (h === "tv.apple.com" || h.endsWith(".tv.apple.com")) {
    const { Icon, color } = STREAMING.appletv;
    return { Icon, brandColor: color };
  }
  if (h.includes("crunchyroll.")) {
    const { Icon, color } = STREAMING.crunchyroll;
    return { Icon, brandColor: color };
  }
  if (h.includes("twitch.")) {
    const { Icon, color } = STREAMING.twitch;
    return { Icon, brandColor: color };
  }
  if (h.includes("spotify.")) {
    const { Icon, color } = STREAMING.spotify;
    return { Icon, brandColor: color };
  }

  return null;
}

function resolveStreamingByName(
  name: string
): Pick<ResolvedPlatform, "Icon" | "brandColor"> | null {
  const n = name.toLowerCase();
  const pick = (key: keyof typeof STREAMING) => {
    const { Icon, color } = STREAMING[key];
    return { Icon, brandColor: color };
  };

  if (n.includes("netflix")) return pick("netflix");
  if (n.includes("disney")) return pick("disney");
  if (n.includes("prime video") || n.includes("primevideo")) return pick("prime");
  if (n.includes("youtube")) return pick("youtube");
  if (n.includes("hulu")) return pick("hulu");
  if (n.includes("hbo max") || n.includes("hbomax")) return pick("hbomax");
  if (n.trim() === "max") return pick("max");
  if (n.includes("paramount")) return pick("paramount");
  if (n.includes("apple tv")) return pick("appletv");
  if (n.includes("crunchyroll")) return pick("crunchyroll");
  if (n.includes("twitch")) return pick("twitch");
  if (n.includes("spotify")) return pick("spotify");
  return null;
}

function resolveWebLaunchIcon(game: PlatformLabelGame): ResolvedPlatform {
  const label = game.name || game.platform || "Web";
  const raw = (game.executable || game.path || "").trim();

  if (raw) {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, "");
      const matched = matchStreamingServiceHost(host, raw);
      if (matched) return { Icon: matched.Icon, brandColor: matched.brandColor, label };
    } catch {
      /* not a valid URL */
    }
  }

  const fromName = resolveStreamingByName(game.name || "");
  if (fromName)
    return { Icon: fromName.Icon, brandColor: fromName.brandColor, label };

  return { Icon: Globe, label };
}

function resolvePlatformIcon(game: PlatformLabelGame): ResolvedPlatform {
  const { platform, launch_type: launchType } = game;
  const p = platform.toLowerCase();

  if (launchType === "Url" || p === "web") {
    return resolveWebLaunchIcon(game);
  }

  switch (launchType) {
    case "Steam":
      return { Icon: SiSteam, label: platform, brandColor: "#66C0F4" };
    case "Epic":
      return { Icon: SiEpicgames, label: platform, brandColor: "#E7E7E7" };
    case "Gog":
      return { Icon: SiGogdotcom, label: platform, brandColor: "#86328A" };
    case "Ubisoft":
      return { Icon: SiUbisoft, label: platform, brandColor: "#0070D1" };
    case "Xbox":
      return { Icon: FaXbox, label: platform, brandColor: "#107C10" };
    case "Executable":
    default:
      if (p.includes("windows")) {
        return { Icon: FaWindows, label: platform, brandColor: "#0078D4" };
      }
      return { Icon: Monitor, label: platform };
  }
}

/** Brand accent used by platform / streaming tiles (fallback when image pixels are unavailable). */
// eslint-disable-next-line react-refresh/only-export-components -- used by ambient layer, same rules as PlatformLabel
export function getGameBrandAccentHex(game: PlatformLabelGame): string | null {
  return resolvePlatformIcon(game).brandColor ?? null;
}

const SIZES = {
  sm: { pad: "p-1.5", icon: "h-4 w-4" },
  md: { pad: "p-2.5 min-w-[2.5rem]", icon: "h-6 w-6" },
  lg: { pad: "p-3", icon: "h-8 w-8" },
} as const;

interface PlatformLabelProps {
  game: PlatformLabelGame;
  size?: keyof typeof SIZES;
  /** badge: inline chip; overlay: frosted pill for use on cover art */
  variant?: "badge" | "overlay";
  className?: string;
}

export function PlatformLabel({
  game,
  size = "sm",
  variant = "badge",
  className,
}: PlatformLabelProps) {
  const { Icon, label, brandColor } = resolvePlatformIcon(game);
  const { pad, icon: iconClass } = SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium",
        variant === "badge" && [
          "bg-primary/10 border border-primary/20",
          brandColor ? "text-foreground/90" : "text-primary",
          size === "sm" && "rounded-md",
        ],
        variant === "overlay" && [
          "bg-black/35 backdrop-blur-md backdrop-saturate-150",
          "border border-white/30 shadow-lg",
          "ring-1 ring-black/25",
          !brandColor && "text-white",
        ],
        pad,
        className
      )}
      title={label}
    >
      <Icon
        className={cn(iconClass, brandColor && "drop-shadow-sm")}
        style={brandColor ? { color: brandColor } : undefined}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
