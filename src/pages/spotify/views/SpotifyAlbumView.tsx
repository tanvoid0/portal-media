import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyAlbum } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";
import { Play, Shuffle } from "lucide-react";

interface Props {
  id: string;
}

export function SpotifyAlbumView({ id }: Props) {
  const { play, setShuffle, setView, checkLiked } = useSpotifyStore();
  const [album, setAlbum] = useState<SpotifyAlbum | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<SpotifyAlbum>("spotify_get_album", { albumId: id })
      .then((a) => {
        setAlbum(a);
        const ids = a.tracks?.items?.map((t) => t.id) ?? [];
        if (ids.length) void checkLiked(ids);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, checkLiked]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#1db954] rounded-full animate-spin" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30">Album not found</p>
      </div>
    );
  }

  const img = album.images?.[0]?.url;
  const year = album.release_date?.split("-")[0] ?? "";
  const contextUri = album.uri;
  const tracks = album.tracks?.items ?? [];

  const playAll = () => void play({ contextUri });
  const playShuffled = async () => {
    await setShuffle(true);
    void play({ contextUri });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1db954]/15 to-transparent px-6 pt-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-44 h-44 rounded-xl overflow-hidden bg-white/5 shrink-0 shadow-2xl shadow-black/50">
            {img ? (
              <img src={img} alt={album.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
              {album.album_type ?? "Album"}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2 truncate">{album.name}</h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              {album.artists.map((a, i) => (
                <span key={a.id}>
                  <button
                    onClick={() => setView({ kind: "artist", id: a.id })}
                    className="text-sm text-white/70 hover:text-white hover:underline transition-colors"
                  >
                    {a.name}
                  </button>
                  {i < album.artists.length - 1 && <span className="text-white/30">,</span>}
                </span>
              ))}
              {year && <span className="text-white/30 text-sm">· {year}</span>}
              {album.total_tracks && (
                <span className="text-white/30 text-sm">· {album.total_tracks} songs</span>
              )}
            </div>
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

      {/* Tracks */}
      <div className="px-6 pb-8">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 text-white/25 text-xs uppercase tracking-wider mb-1">
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="w-10 text-right">Time</span>
        </div>
        <div className="space-y-0.5">
          {tracks.map((track, i) => (
            <SpotifyTrackRow
              key={track.id}
              track={{ ...track, album: { id: album.id, name: album.name, images: album.images, artists: album.artists, uri: album.uri } }}
              index={i}
              contextUri={contextUri}
              showAlbum={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
