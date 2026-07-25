import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifySearchResult, SpotifyArtist, SpotifyAlbum } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

function ArtistPill({ artist }: { artist: SpotifyArtist }) {
  const { setView } = useSpotifyStore();
  const img = artist.images?.[0]?.url;
  return (
    <button
      onClick={() => setView({ kind: "artist", id: artist.id })}
      className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 rounded-full px-3 py-2 transition-colors text-sm text-white/80 hover:text-white"
    >
      {img && <img src={img} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />}
      {artist.name}
    </button>
  );
}

function AlbumCard({ album }: { album: SpotifyAlbum }) {
  const { setView } = useSpotifyStore();
  const img = album.images?.[0]?.url;
  return (
    <button
      onClick={() => setView({ kind: "album", id: album.id })}
      className="flex flex-col gap-2 group text-left"
    >
      <div className="w-36 h-36 rounded-lg overflow-hidden bg-white/5 group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
        {img ? <img src={img} alt={album.name} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="w-36">
        <p className="text-sm text-white/80 group-hover:text-white truncate transition-colors">{album.name}</p>
        <p className="text-xs text-white/40 truncate">{album.artists.map((a) => a.name).join(", ")}</p>
      </div>
    </button>
  );
}

export function SpotifySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await invoke<SpotifySearchResult>("spotify_search", {
        query: q,
        types: ["track", "artist", "album"],
        limit: 10,
      });
      setResults(res);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") void search(query);
    },
    [query, search]
  );

  const tracks = results?.tracks?.items ?? [];
  const artists = results?.artists?.items ?? [];
  const albums = results?.albums?.items ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Search input */}
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          type="text"
          placeholder="Search songs, artists, albums…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3",
            "text-white placeholder:text-white/25 text-sm",
            "focus:outline-none focus:border-[#1db954]/50 focus:bg-white/8",
            "transition-colors"
          )}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        )}
      </div>

      {!results && !loading && (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30 text-sm">Search for songs, artists, or albums</p>
        </div>
      )}

      {results && (
        <div className="space-y-8">
          {tracks.length > 0 && (
            <section>
              <h2 className="text-white font-semibold text-lg mb-3">Tracks</h2>
              <div className="space-y-0.5">
                {tracks.map((t, i) => (
                  <SpotifyTrackRow key={t.id} track={t} index={i} showArtwork />
                ))}
              </div>
            </section>
          )}

          {artists.length > 0 && (
            <section>
              <h2 className="text-white font-semibold text-lg mb-3">Artists</h2>
              <div className="flex flex-wrap gap-2">
                {artists.map((a) => (
                  <ArtistPill key={a.id} artist={a} />
                ))}
              </div>
            </section>
          )}

          {albums.length > 0 && (
            <section>
              <h2 className="text-white font-semibold text-lg mb-3">Albums</h2>
              <div className="flex gap-5 flex-wrap">
                {albums.map((al) => (
                  <AlbumCard key={al.id} album={al} />
                ))}
              </div>
            </section>
          )}

          {!tracks.length && !artists.length && !albums.length && (
            <p className="text-white/30 text-sm text-center py-12">No results for &ldquo;{query}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}
