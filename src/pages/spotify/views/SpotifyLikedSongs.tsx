import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyPaging, SpotifySavedTrack } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";
import { Play, Shuffle } from "lucide-react";
import { Heart } from "lucide-react";

export function SpotifyLikedSongs() {
  const { play, setShuffle } = useSpotifyStore();
  const [tracks, setTracks] = useState<SpotifySavedTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<SpotifyPaging<SpotifySavedTrack>>("spotify_get_liked_songs", {
      limit: 50,
      offset: 0,
    })
      .then((d) => {
        setTracks(d.items);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const collectionUri = "spotify:collection:tracks";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-b from-indigo-900/40 to-transparent px-6 pt-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-44 h-44 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-900 shrink-0 flex items-center justify-center shadow-2xl shadow-black/40">
            <Heart className="w-20 h-20 text-white" fill="white" />
          </div>
          <div className="pb-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Playlist</p>
            <h1 className="text-3xl font-bold text-white mb-1">Liked Songs</h1>
            <p className="text-white/40 text-sm">{total} songs</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => void play({ contextUri: collectionUri })}
            className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] flex items-center justify-center transition-colors shadow-lg shadow-black/30"
          >
            <Play className="w-6 h-6 text-black fill-black ml-1" />
          </button>
          <button
            onClick={async () => {
              await setShuffle(true);
              void play({ contextUri: collectionUri });
            }}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
            title="Shuffle play"
          >
            <Shuffle className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 text-white/25 text-xs uppercase tracking-wider mb-1">
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="hidden md:block w-40">Album</span>
          <span className="w-10 text-right">Time</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/30 text-sm">Loading…</div>
        ) : (
          <div className="space-y-0.5">
            {tracks.map(({ track }, i) => (
              <SpotifyTrackRow
                key={`${track.id}-${i}`}
                track={track}
                index={i}
                contextUri={collectionUri}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
