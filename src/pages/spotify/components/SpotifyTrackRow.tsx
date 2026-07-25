import { useState } from "react";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyTrack } from "@/types/spotify";
import { cn } from "@/lib/utils";
import { Heart, Play } from "lucide-react";

interface Props {
  track: SpotifyTrack;
  index?: number;
  contextUri?: string;
  showAlbum?: boolean;
  showArtwork?: boolean;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function SpotifyTrackRow({
  track,
  index,
  contextUri,
  showAlbum = true,
  showArtwork = false,
}: Props) {
  const { playback, play, toggleLike, likedIds } = useSpotifyStore();
  const [hovered, setHovered] = useState(false);

  const isCurrentTrack =
    playback?.item?.id === track.id;
  const isPlaying = isCurrentTrack && playback?.is_playing;
  const isLiked = likedIds.has(track.id);

  const handlePlay = () => {
    if (contextUri) {
      void play({ contextUri, offsetUri: track.uri });
    } else {
      void play({ uris: [track.uri] });
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        isCurrentTrack ? "bg-white/5" : "hover:bg-white/5"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={handlePlay}
    >
      {/* Index / play icon */}
      <div className="w-6 shrink-0 flex items-center justify-center">
        {hovered ? (
          <button onClick={handlePlay} className="text-white">
            <Play className="w-4 h-4 fill-white" />
          </button>
        ) : isPlaying ? (
          <span className="text-[#1db954] text-xs">▶</span>
        ) : (
          <span className={cn("text-xs tabular-nums", isCurrentTrack ? "text-[#1db954]" : "text-white/40")}>
            {index != null ? index + 1 : "·"}
          </span>
        )}
      </div>

      {/* Artwork */}
      {showArtwork && (
        <img
          src={track.album.images?.[0]?.url}
          alt=""
          className="w-9 h-9 rounded shrink-0 object-cover bg-white/5"
        />
      )}

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate font-medium",
            isCurrentTrack ? "text-[#1db954]" : "text-white"
          )}
        >
          {track.name}
        </p>
        <p className="text-xs text-white/45 truncate">
          {track.explicit && (
            <span className="mr-1 bg-white/10 text-white/60 text-[9px] px-1 rounded">E</span>
          )}
          {track.artists.map((a) => a.name).join(", ")}
        </p>
      </div>

      {/* Album */}
      {showAlbum && (
        <p className="hidden md:block text-xs text-white/40 truncate w-40 shrink-0">
          {track.album.name}
        </p>
      )}

      {/* Like */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          void toggleLike(track);
        }}
        className={cn(
          "shrink-0 transition-colors opacity-0 group-hover:opacity-100",
          isLiked ? "opacity-100 text-[#1db954]" : "text-white/30 hover:text-white"
        )}
      >
        <Heart className="w-3.5 h-3.5" fill={isLiked ? "currentColor" : "none"} />
      </button>

      {/* Duration */}
      <span className="text-white/40 text-xs tabular-nums w-10 text-right shrink-0">
        {formatMs(track.duration_ms)}
      </span>
    </div>
  );
}
