import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyArtist, SpotifyTrack, SpotifyPaging, SpotifyAlbum } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";
import { Play } from "lucide-react";

interface Props {
  id: string;
}

function AlbumCard({ album }: { album: SpotifyAlbum }) {
  const { setView } = useSpotifyStore();
  const img = album.images?.[0]?.url;
  const year = album.release_date?.split("-")[0] ?? "";
  return (
    <button
      onClick={() => setView({ kind: "album", id: album.id })}
      className="flex flex-col gap-2 group text-left shrink-0"
    >
      <div className="w-36 h-36 rounded-xl overflow-hidden bg-white/5 group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
        {img && <img src={img} alt={album.name} className="w-full h-full object-cover" />}
      </div>
      <div className="w-36">
        <p className="text-sm text-white/80 group-hover:text-white truncate transition-colors font-medium">
          {album.name}
        </p>
        <p className="text-xs text-white/35">{year}</p>
      </div>
    </button>
  );
}

export function SpotifyArtistView({ id }: Props) {
  const { play, checkLiked } = useSpotifyStore();
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      invoke<SpotifyArtist>("spotify_get_artist", { artistId: id }),
      invoke<SpotifyTrack[]>("spotify_get_artist_top_tracks", { artistId: id }),
      invoke<SpotifyPaging<SpotifyAlbum>>("spotify_get_artist_albums", {
        artistId: id,
        limit: 20,
        offset: 0,
      }),
    ])
      .then(([art, tracks, albumData]) => {
        setArtist(art);
        setTopTracks(tracks);
        setAlbums(albumData.items);
        if (tracks.length) void checkLiked(tracks.map((t) => t.id));
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

  if (!artist) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30">Artist not found</p>
      </div>
    );
  }

  const img = artist.images?.[0]?.url;
  const artistUri = artist.uri;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div className="relative h-56 overflow-hidden">
        {img && (
          <img
            src={img}
            alt={artist.name}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 px-6 pb-5">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">{artist.name}</h1>
          {artist.followers && (
            <p className="text-white/60 text-sm mt-1">
              {artist.followers.total.toLocaleString()} followers
            </p>
          )}
          {artist.genres && artist.genres.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {artist.genres.slice(0, 4).map((g) => (
                <span key={g} className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full capitalize">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Play button */}
      <div className="px-6 py-4">
        <button
          onClick={() => void play({ contextUri: artistUri })}
          className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] flex items-center justify-center transition-colors shadow-lg shadow-black/30"
        >
          <Play className="w-6 h-6 text-black fill-black ml-1" />
        </button>
      </div>

      <div className="px-6 space-y-8 pb-8">
        {/* Top tracks */}
        {topTracks.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Popular</h2>
            <div className="space-y-0.5">
              {topTracks.slice(0, 10).map((track, i) => (
                <SpotifyTrackRow key={track.id} track={track} index={i} contextUri={artistUri} />
              ))}
            </div>
          </section>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-lg mb-4">Discography</h2>
            <div className="flex gap-5 flex-wrap">
              {albums.map((al) => (
                <AlbumCard key={al.id} album={al} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
