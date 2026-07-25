import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyArtist, SpotifyPaging, SpotifySavedAlbum } from "@/types/spotify";

function AlbumCard({ album }: { album: SpotifySavedAlbum["album"] }) {
  const { setView } = useSpotifyStore();
  const img = album.images?.[0]?.url;
  const year = album.release_date?.split("-")[0] ?? "";
  return (
    <button
      onClick={() => setView({ kind: "album", id: album.id })}
      className="flex flex-col gap-2 group text-left"
    >
      <div className="w-40 h-40 rounded-xl overflow-hidden bg-white/5 group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
        {img && <img src={img} alt={album.name} className="w-full h-full object-cover" />}
      </div>
      <div className="w-40">
        <p className="text-sm text-white/80 group-hover:text-white truncate transition-colors font-medium">
          {album.name}
        </p>
        <p className="text-xs text-white/35 truncate">
          {year}{year && album.artists.length ? " · " : ""}{album.artists.map((a) => a.name).join(", ")}
        </p>
      </div>
    </button>
  );
}

function ArtistCard({ artist }: { artist: SpotifyArtist }) {
  const { setView } = useSpotifyStore();
  const img = artist.images?.[0]?.url;
  return (
    <button
      onClick={() => setView({ kind: "artist", id: artist.id })}
      className="flex flex-col items-center gap-2 group text-center"
    >
      <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
        {img ? <img src={img} alt={artist.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />}
      </div>
      <span className="text-xs text-white/65 group-hover:text-white truncate max-w-[8rem] transition-colors">
        {artist.name}
      </span>
    </button>
  );
}

export function SpotifyLibraryView() {
  const [albums, setAlbums] = useState<SpotifySavedAlbum[]>([]);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [tab, setTab] = useState<"albums" | "artists">("albums");

  useEffect(() => {
    void invoke<SpotifyPaging<SpotifySavedAlbum>>("spotify_get_saved_albums", {
      limit: 50,
      offset: 0,
    }).then((d) => setAlbums(d.items)).catch(() => {});

    void invoke<SpotifyArtist[]>("spotify_get_followed_artists")
      .then(setArtists)
      .catch(() => {});
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your Library</h1>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(["albums", "artists"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-white/15 text-white" : "text-white/45 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "albums" && (
        <div className="flex flex-wrap gap-5">
          {albums.map((saved) => (
            <AlbumCard key={saved.album.id} album={saved.album} />
          ))}
          {albums.length === 0 && (
            <p className="text-white/30 text-sm py-12 text-center w-full">No saved albums</p>
          )}
        </div>
      )}

      {tab === "artists" && (
        <div className="flex flex-wrap gap-6">
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
          {artists.length === 0 && (
            <p className="text-white/30 text-sm py-12 text-center w-full">No followed artists</p>
          )}
        </div>
      )}
    </div>
  );
}
