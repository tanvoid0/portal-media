import { useEffect, useRef, useState, useCallback } from "react";
import { useSpotifyStore } from "@/stores/spotifyStore";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
} from "lucide-react";

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function AlbumArt({ url, size = 56 }: { url?: string; size?: number }) {
  return (
    <div
      className="rounded-md bg-white/5 shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-white/10" />
      )}
    </div>
  );
}

export function SpotifyPlayerBar() {
  const { playback, play, pause, next, previous, seek, setVolume, setShuffle, setRepeat, toggleLike, likedIds, refreshPlayback } =
    useSpotifyStore();

  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const [volume, setVolumeLocal] = useState(100);
  const prevMuted = useRef(100);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll playback every 2s when playing
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void refreshPlayback();
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshPlayback]);

  // Sync local volume from playback
  useEffect(() => {
    if (playback?.device?.volume_percent != null) {
      setVolumeLocal(playback.device.volume_percent);
    }
  }, [playback?.device?.volume_percent]);

  // Progress ticker
  useEffect(() => {
    if (!playback?.is_playing) {
      setLocalProgress(null);
      return;
    }
    setLocalProgress(playback.progress_ms ?? 0);
    const interval = setInterval(() => {
      setLocalProgress((p) => (p != null ? p + 1000 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [playback?.is_playing, playback?.progress_ms, playback?.item?.id]);

  const track = playback?.item;
  const duration = track?.duration_ms ?? 1;
  const progress = localProgress ?? playback?.progress_ms ?? 0;
  const progressPct = Math.min((progress / duration) * 100, 100);
  const isPlaying = playback?.is_playing ?? false;
  const shuffle = playback?.shuffle_state ?? false;
  const repeat = playback?.repeat_state ?? "off";
  const isLiked = track ? likedIds.has(track.id) : false;
  const albumImg = track?.album?.images?.[0]?.url;

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const ms = Math.floor(pct * duration);
      void seek(ms);
    },
    [duration, seek]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setVolumeLocal(v);
      void setVolume(v);
    },
    [setVolume]
  );

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      prevMuted.current = volume;
      setVolumeLocal(0);
      void setVolume(0);
    } else {
      const restore = prevMuted.current || 100;
      setVolumeLocal(restore);
      void setVolume(restore);
    }
  }, [volume, setVolume]);

  const cycleRepeat = useCallback(() => {
    const next: ("off" | "context" | "track")[] = ["off", "context", "track"];
    const idx = next.indexOf(repeat);
    void setRepeat(next[(idx + 1) % 3]);
  }, [repeat, setRepeat]);

  if (!playback && !track) {
    return (
      <div className="h-20 border-t border-white/5 bg-black/60 backdrop-blur-xl flex items-center justify-center">
        <span className="text-white/25 text-sm">No active Spotify device</span>
      </div>
    );
  }

  return (
    <div className="h-20 border-t border-white/5 bg-black/60 backdrop-blur-xl flex items-center px-4 gap-4 shrink-0">
      {/* Track info */}
      <div className="flex items-center gap-3 w-64 min-w-0">
        <AlbumArt url={albumImg} />
        {track ? (
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{track.name}</p>
            <p className="text-white/50 text-xs truncate">
              {track.artists.map((a) => a.name).join(", ")}
            </p>
          </div>
        ) : (
          <p className="text-white/30 text-xs">Nothing playing</p>
        )}
        {track && (
          <button
            onClick={() => void toggleLike(track)}
            className={cn(
              "ml-auto shrink-0 transition-colors",
              isLiked ? "text-[#1db954]" : "text-white/30 hover:text-white/60"
            )}
            title={isLiked ? "Unlike" : "Like"}
          >
            <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Controls + progress */}
      <div className="flex-1 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-5">
          <button
            onClick={() => void setShuffle(!shuffle)}
            className={cn(
              "transition-colors",
              shuffle ? "text-[#1db954]" : "text-white/40 hover:text-white"
            )}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={() => void previous()}
            className="text-white/70 hover:text-white transition-colors"
            title="Previous"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={() => (isPlaying ? void pause() : void play({}))}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-black fill-black" />
            ) : (
              <Play className="w-5 h-5 text-black fill-black ml-0.5" />
            )}
          </button>
          <button
            onClick={() => void next()}
            className="text-white/70 hover:text-white transition-colors"
            title="Next"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={cycleRepeat}
            className={cn(
              "transition-colors relative",
              repeat !== "off" ? "text-[#1db954]" : "text-white/40 hover:text-white"
            )}
            title={`Repeat: ${repeat}`}
          >
            {repeat === "track" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-white/40 text-xs tabular-nums w-10 text-right shrink-0">
            {formatMs(progress)}
          </span>
          <div
            className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-white rounded-full group-hover:bg-[#1db954] transition-colors"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-white/40 text-xs tabular-nums w-10 shrink-0">
            {formatMs(duration)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-36 justify-end shrink-0">
        <button
          onClick={toggleMute}
          className="text-white/50 hover:text-white transition-colors shrink-0"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={handleVolume}
          className="w-20 accent-white hover:accent-[#1db954] cursor-pointer"
          style={{ accentColor: "#1db954" }}
        />
      </div>
    </div>
  );
}
