import { DeckKey } from "@/components/ui/deck-key";
import { OPEN_SHELL_SEARCH_EVENT } from "@/types/app";
import { appNavigate } from "@/nav/appNavigate";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { Clapperboard, Film, LayoutGrid, Search, Settings } from "lucide-react";

export type DeckSection = "find" | "library" | "discover" | "media" | "settings";

function activeSection(pathname: string, findOpen: boolean): DeckSection {
  if (findOpen) return "find";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/library/discover") || pathname.startsWith("/tmdb/") || pathname.startsWith("/igdb/")) {
    return "discover";
  }
  if (pathname.startsWith("/library/media")) return "media";
  return "library";
}

export function FunctionDeck({
  findOpen,
  className,
}: {
  findOpen?: boolean;
  className?: string;
}) {
  const { pathname } = useLocation();
  const active = activeSection(pathname, Boolean(findOpen));

  return (
    <nav
      className={cn("flex items-center justify-center gap-4", className)}
      aria-label="Main"
    >
      <DeckKey
        icon={<Search />}
        label="Find"
        active={active === "find"}
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SHELL_SEARCH_EVENT))}
      />
      <DeckKey
        icon={<LayoutGrid />}
        label="Library"
        active={active === "library"}
        onClick={() => appNavigate("/library/all")}
      />
      <DeckKey
        icon={<Clapperboard />}
        label="Discover"
        active={active === "discover"}
        onClick={() => appNavigate("/library/discover")}
      />
      <DeckKey
        icon={<Film />}
        label="Media"
        active={active === "media"}
        onClick={() => appNavigate("/library/media")}
      />
      <DeckKey
        icon={<Settings />}
        label="Settings"
        active={active === "settings"}
        onClick={() => appNavigate("/settings/game")}
      />
    </nav>
  );
}
