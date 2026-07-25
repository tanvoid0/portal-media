import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpotifyStore } from "@/stores/spotifyStore";
import type { SpotifyTrack, SpotifyArtist, SpotifyRecentlyPlayedItem } from "@/types/spotify";
import { SpotifyTrackRow } from "../components/SpotifyTrackRow";

function ArtistCard({ artist }: { artist: SpotifyArtist }) {
  const { setView } = useSpotifyStore();
  const img = artist.images?.[0]?.url;
  return (
    <button
      onClick={() => setView({ kind: "artist", id: artist.id })}
      className="flex flex-col items-center gap-2 group text-center"
    >
      <div className="w-28 h-28 rounded-full overflow-hidden bg-white/5 group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
        {img ? (
          <img src={img} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
        )}
      </div>
      <span className="text-xs text-white/70 group-hover:text-white truncate max-w-[7rem] transition-colors">
        {artist.name}
      </span>
    </button>
  );
}

export function SpotifyHome() {
  const { user, playback } = useSpotifyStore();
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [recent, setRecent] = useState<SpotifyRecentlyPlayedItem[]>([]);

  useEffect(() => {
    void invoke<SpotifyTrack[]>("spotify_get_top_tracks", {
      timeRange: "short_term",
      limit: 10,
    }).then(setTopTracks).catch(() => {});

    void invoke<SpotifyArtist[]>("spotify_get_top_artists", {
      timeRange: "short_term",
      limit: 12,
    }).then(setTopArtists).catch(() => {});

    void invoke<SpotifyRecentlyPlayedItem[]>("spotify_get_recently_played", {
      limit: 20,
    }).then(setRecent).catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const recentUnique = recent.reduce<SpotifyTrack[]>((acc, r) => {
    if (!acc.find((t) => t.id === r.track.id)) acc.push(r.track);
    return acc;
  }, []).slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">
          {greeting()}{user?.display_name ? `, ${user.display_name.split(" ")[0]}` : ""}
        </h1>
        {playback?.item && (
          <p className="text-white/40 text-sm mt-1">
            Currently {playback.is_playing ? "playing" : "paused"}: {playback.item.name} · {playback.item.artists[0]?.name}
          </p>
        )}
      </div>

      {recentUnique.length > 0 && (
        <section>
          <h2 className="text-white font-semibold text-lg mb-4">Recently played</h2>
          <div className="space-y-0.5">
            {recentUnique.map((track) => (
              <SpotifyTrackRow key={track.id} track={track} showArtwork />
            ))}
          </div>
        </section>
      )}

      {topArtists.length > 0 && (
        <section>
          <h2 className="text-white font-semibold text-lg mb-4">Your top artists</h2>
          <div className="flex gap-6 flex-wrap">
            {topArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {topTracks.length > 0 && (
        <section>
          <h2 className="text-white font-semibold text-lg mb-4">Your top tracks</h2>
          <div className="space-y-0.5">
            {topTracks.map((track, i) => (
              <SpotifyTrackRow key={track.id} track={track} index={i} showArtwork />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
