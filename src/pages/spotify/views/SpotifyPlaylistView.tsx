import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyPaging, SpotifyPlaylistTrack } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";
import { Play, Shuffle } from "lucide-react";

interface Props {
  id: string;
}

export function SpotifyPlaylistView({ id }: Props) {
  const { play, setShuffle } = useSpotifyStore();
  const [tracks, setTracks] = useState<SpotifyPlaylistTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<SpotifyPaging<SpotifyPlaylistTrack>>("spotify_get_playlist_tracks", {
      playlistId: id,
      limit: 50,
      offset: 0,
    })
      .then((trackData) => {
        setTracks(trackData.items.filter((t) => t.track != null));
        setTotal(trackData.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const contextUri = `spotify:playlist:${id}`;

  const playAll = () => void play({ contextUri });
  const playShuffled = async () => {
    await setShuffle(true);
    void play({ contextUri });
  };

  const validTracks = tracks.filter((t) => t.track != null);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1db954]/20 to-transparent px-6 pt-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-44 h-44 rounded-xl bg-white/5 shrink-0 flex items-center justify-center">
            <span className="text-5xl text-white/20">♫</span>
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Playlist</p>
            <h1 className="text-3xl font-bold text-white mb-1 truncate">Playlist</h1>
            <p className="text-white/40 text-sm">{total} songs</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={playAll}
            className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] flex items-center justify-center transition-colors shadow-lg shadow-black/30"
          >
            <Play className="w-6 h-6 text-black fill-black ml-1" />
          </button>
          <button
            onClick={() => void playShuffled()}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
            title="Shuffle play"
          >
            <Shuffle className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Track list header */}
      <div className="px-6">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 text-white/30 text-xs uppercase tracking-wider mb-1">
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="w-10 text-right">Time</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/30 text-sm">Loading…</div>
        ) : (
          <div className="space-y-0.5 pb-6">
            {validTracks.map((item, i) => (
              <SpotifyTrackRow
                key={`${item.track!.id}-${i}`}
                track={item.track!}
                index={i}
                contextUri={contextUri}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
