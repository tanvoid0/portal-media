import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyView } from "@/types/spotify";
import { cn } from "@/lib/utils";
import { Home, Search, Library, Heart, Music2 } from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  view: SpotifyView;
}

const TOP_NAV: NavItem[] = [
  { label: "Home", icon: Home, view: { kind: "home" } },
  { label: "Search", icon: Search, view: { kind: "search" } },
  { label: "Library", icon: Library, view: { kind: "library" } },
];

function viewKey(v: SpotifyView) {
  return v.kind === "playlist" || v.kind === "album" || v.kind === "artist"
    ? `${v.kind}:${v.id}`
    : v.kind;
}

function isActive(current: SpotifyView, target: SpotifyView) {
  return viewKey(current) === viewKey(target);
}

export function SpotifyNav() {
  const { view, setView, playlists, user } = useSpotifyStore();

  return (
    <nav className="flex flex-col h-full w-60 shrink-0 bg-black/40 border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1db954] flex items-center justify-center shrink-0">
          <Music2 className="w-4 h-4 text-black" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Spotify</p>
          {user?.display_name && (
            <p className="text-white/40 text-xs truncate max-w-[140px]">{user.display_name}</p>
          )}
        </div>
      </div>

      {/* Top nav */}
      <div className="px-3 space-y-0.5">
        {TOP_NAV.map((item) => {
          const active = isActive(view, item.view);
          return (
            <button
              key={item.label}
              onClick={() => setView(item.view)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active && "text-[#1db954]")} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mx-3 my-3 h-px bg-white/5" />

      {/* Liked songs */}
      <div className="px-3 mb-2">
        <button
          onClick={() => setView({ kind: "liked" })}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
            view.kind === "liked"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <Heart
            className={cn(
              "w-4 h-4 shrink-0",
              view.kind === "liked" ? "text-[#1db954]" : ""
            )}
            fill={view.kind === "liked" ? "currentColor" : "none"}
          />
          Liked Songs
        </button>
      </div>

      {/* Playlists */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
        {playlists.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-white/25 text-[10px] uppercase tracking-wider px-3 mb-2">Playlists</p>
            {playlists.map((pl) => {
              const active = view.kind === "playlist" && (view as { id: string }).id === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => setView({ kind: "playlist", id: pl.id })}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                  title={pl.name}
                >
                  {pl.images?.[0]?.url ? (
                    <img
                      src={pl.images[0].url}
                      alt=""
                      className="w-6 h-6 rounded shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-white/10 shrink-0" />
                  )}
                  <span className="truncate">{pl.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
