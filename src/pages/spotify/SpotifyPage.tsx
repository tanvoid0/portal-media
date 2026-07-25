import { useEffect } from "react";
import { useSpotifyStore } from "@/stores/spotifyStore";
import { SpotifyNav } from "./components/SpotifyNav";
import { SpotifyPlayerBar } from "./components/SpotifyPlayerBar";
import { SpotifyConnect } from "./SpotifyConnect";
import { SpotifyHome } from "./views/SpotifyHome";
import { SpotifySearch } from "./views/SpotifySearch";
import { SpotifyLibraryView } from "./views/SpotifyLibraryView";
import { SpotifyPlaylistView } from "./views/SpotifyPlaylistView";
import { SpotifyAlbumView } from "./views/SpotifyAlbumView";
import { SpotifyArtistView } from "./views/SpotifyArtistView";
import { SpotifyLikedSongs } from "./views/SpotifyLikedSongs";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

function ViewContent() {
  const { view } = useSpotifyStore();
  switch (view.kind) {
    case "home":
      return <SpotifyHome />;
    case "search":
      return <SpotifySearch />;
    case "library":
      return <SpotifyLibraryView />;
    case "playlist":
      return <SpotifyPlaylistView id={view.id} />;
    case "album":
      return <SpotifyAlbumView id={view.id} />;
    case "artist":
      return <SpotifyArtistView id={view.id} />;
    case "liked":
      return <SpotifyLikedSongs />;
    default:
      return <SpotifyHome />;
  }
}

export function SpotifyPage() {
  const { user, authChecked, authLoading, checkAuth, disconnect } = useSpotifyStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authChecked) {
      void checkAuth();
    }
  }, [authChecked, checkAuth]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a] text-white">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-black/30 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1" />
        {user && (
          <div className="flex items-center gap-3">
            {user.images?.[0]?.url && (
              <img
                src={user.images[0].url}
                alt={user.display_name ?? ""}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
            <span className="text-white/60 text-sm hidden sm:block">{user.display_name}</span>
            {user.product && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase",
                  user.product === "premium"
                    ? "bg-[#1db954]/20 text-[#1db954]"
                    : "bg-white/10 text-white/50"
                )}
              >
                {user.product}
              </span>
            )}
            <button
              onClick={() => void disconnect()}
              className="text-white/30 hover:text-white/70 transition-colors"
              title="Disconnect Spotify"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {authLoading && !authChecked ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-[#1db954] rounded-full animate-spin" />
        </div>
      ) : !user ? (
        <SpotifyConnect />
      ) : (
        <>
          {/* Main layout */}
          <div className="flex-1 flex overflow-hidden">
            <SpotifyNav />
            <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#111] to-[#0a0a0a]">
              <ViewContent />
            </div>
          </div>

          {/* Player */}
          <SpotifyPlayerBar />
        </>
      )}
    </div>
  );
}
