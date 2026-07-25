import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  SpotifyUser,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyView,
  SpotifyTrack,
} from "@/types/spotify";

interface SpotifyStore {
  // Auth
  user: SpotifyUser | null;
  authChecked: boolean;
  authLoading: boolean;

  // Playback
  playback: SpotifyPlaybackState | null;
  playbackLoading: boolean;

  // Library cache
  playlists: SpotifyPlaylist[];
  playlistsLoaded: boolean;

  // UI navigation
  view: SpotifyView;
  likedIds: Set<string>;

  // Actions
  checkAuth: () => Promise<void>;
  disconnect: () => Promise<void>;
  setView: (view: SpotifyView) => void;
  refreshPlayback: () => Promise<void>;
  play: (opts: {
    contextUri?: string;
    uris?: string[];
    offsetUri?: string;
    offsetPosition?: number;
    positionMs?: number;
    deviceId?: string;
  }) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (percent: number) => Promise<void>;
  setShuffle: (state: boolean) => Promise<void>;
  setRepeat: (state: "off" | "track" | "context") => Promise<void>;
  toggleLike: (track: SpotifyTrack) => Promise<void>;
  checkLiked: (trackIds: string[]) => Promise<void>;
  loadPlaylists: () => Promise<void>;
}

function activeDeviceId(playback: SpotifyPlaybackState | null): string | undefined {
  return playback?.device?.id ?? undefined;
}

export const useSpotifyStore = create<SpotifyStore>((set, get) => ({
  user: null,
  authChecked: false,
  authLoading: false,
  playback: null,
  playbackLoading: false,
  playlists: [],
  playlistsLoaded: false,
  view: { kind: "home" },
  likedIds: new Set(),

  checkAuth: async () => {
    set({ authLoading: true });
    try {
      const user = await invoke<SpotifyUser | null>("spotify_check_auth");
      set({ user, authChecked: true });
      if (user) {
        void get().refreshPlayback();
        void get().loadPlaylists();
      }
    } catch {
      set({ user: null, authChecked: true });
    } finally {
      set({ authLoading: false });
    }
  },

  disconnect: async () => {
    await invoke("spotify_disconnect");
    set({ user: null, playback: null, playlists: [], playlistsLoaded: false });
  },

  setView: (view) => set({ view }),

  refreshPlayback: async () => {
    set({ playbackLoading: true });
    try {
      const playback = await invoke<SpotifyPlaybackState | null>(
        "spotify_get_playback_state"
      );
      set({ playback });
      if (playback?.item) {
        void get().checkLiked([playback.item.id]);
      }
    } catch {
      // Ignore — no active device is normal
    } finally {
      set({ playbackLoading: false });
    }
  },

  play: async ({ contextUri, uris, offsetUri, offsetPosition, positionMs, deviceId }) => {
    const did = deviceId ?? activeDeviceId(get().playback);
    let offset: unknown = undefined;
    if (offsetUri != null) offset = { uri: offsetUri };
    else if (offsetPosition != null) offset = { position: offsetPosition };

    await invoke("spotify_play", {
      contextUri: contextUri ?? null,
      uris: uris ?? null,
      offset: offset ?? null,
      positionMs: positionMs ?? null,
      deviceId: did ?? null,
    });
    setTimeout(() => void get().refreshPlayback(), 500);
  },

  pause: async () => {
    await invoke("spotify_pause", { deviceId: activeDeviceId(get().playback) ?? null });
    setTimeout(() => void get().refreshPlayback(), 300);
  },

  next: async () => {
    await invoke("spotify_next", { deviceId: activeDeviceId(get().playback) ?? null });
    setTimeout(() => void get().refreshPlayback(), 700);
  },

  previous: async () => {
    await invoke("spotify_previous", { deviceId: activeDeviceId(get().playback) ?? null });
    setTimeout(() => void get().refreshPlayback(), 700);
  },

  seek: async (positionMs) => {
    const did = activeDeviceId(get().playback);
    await invoke("spotify_seek", { positionMs, deviceId: did ?? null });
    set((s) => ({
      playback: s.playback ? { ...s.playback, progress_ms: positionMs } : null,
    }));
  },

  setVolume: async (percent) => {
    const did = activeDeviceId(get().playback);
    await invoke("spotify_set_volume", {
      volumePercent: percent,
      deviceId: did ?? null,
    });
    set((s) => ({
      playback: s.playback?.device
        ? { ...s.playback, device: { ...s.playback.device, volume_percent: percent } }
        : s.playback,
    }));
  },

  setShuffle: async (state) => {
    const did = activeDeviceId(get().playback);
    await invoke("spotify_set_shuffle", { state, deviceId: did ?? null });
    set((s) => ({
      playback: s.playback ? { ...s.playback, shuffle_state: state } : null,
    }));
  },

  setRepeat: async (state) => {
    const did = activeDeviceId(get().playback);
    await invoke("spotify_set_repeat", { state, deviceId: did ?? null });
    set((s) => ({
      playback: s.playback ? { ...s.playback, repeat_state: state } : null,
    }));
  },

  toggleLike: async (track) => {
    const { likedIds } = get();
    const isLiked = likedIds.has(track.id);
    if (isLiked) {
      await invoke("spotify_unlike_track", { trackId: track.id });
      set((s) => {
        const next = new Set(s.likedIds);
        next.delete(track.id);
        return { likedIds: next };
      });
    } else {
      await invoke("spotify_like_track", { trackId: track.id });
      set((s) => {
        const next = new Set(s.likedIds);
        next.add(track.id);
        return { likedIds: next };
      });
    }
  },

  checkLiked: async (trackIds) => {
    if (!trackIds.length) return;
    try {
      const results = await invoke<boolean[]>("spotify_check_liked_tracks", { trackIds });
      set((s) => {
        const next = new Set(s.likedIds);
        trackIds.forEach((id, i) => {
          if (results[i]) next.add(id);
          else next.delete(id);
        });
        return { likedIds: next };
      });
    } catch {
      // ignore
    }
  },

  loadPlaylists: async () => {
    try {
      const data = await invoke<{ items: SpotifyPlaylist[] }>("spotify_get_playlists", {
        limit: 50,
        offset: 0,
      });
      set({ playlists: data.items, playlistsLoaded: true });
    } catch {
      // ignore
    }
  },
}));
