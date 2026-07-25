export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyFollowers {
  total: number;
}

export interface SpotifyUser {
  id: string;
  display_name?: string;
  email?: string;
  images?: SpotifyImage[];
  product?: string; // "premium" | "free" | "open"
  followers?: SpotifyFollowers;
  country?: string;
}

export interface SpotifySimpleArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifySimpleAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  album_type?: string;
  release_date?: string;
  artists: SpotifySimpleArtist[];
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifySimpleArtist[];
  album: SpotifySimpleAlbum;
  duration_ms: number;
  uri: string;
  is_local?: boolean;
  explicit?: boolean;
  popularity?: number;
  preview_url?: string;
  track_number?: number;
  disc_number?: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  followers?: SpotifyFollowers;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  album_type?: string;
  release_date?: string;
  total_tracks?: number;
  artists: SpotifySimpleArtist[];
  uri: string;
  label?: string;
  popularity?: number;
  genres?: string[];
  tracks?: SpotifyPaging<SpotifyTrack>;
}

export interface SpotifyPlaylistOwner {
  id: string;
  display_name?: string;
}

export interface SpotifyPlaylistTracksRef {
  total: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images?: SpotifyImage[];
  owner: SpotifyPlaylistOwner;
  tracks: SpotifyPlaylistTracksRef;
  public?: boolean;
  uri: string;
}

export interface SpotifyPlaylistTrack {
  added_at?: string;
  track?: SpotifyTrack;
}

export interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifySavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

export interface SpotifyPaging<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next?: string;
  previous?: string;
}

export interface SpotifyDevice {
  id?: string;
  name: string;
  device_type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  volume_percent?: number;
  supports_volume?: boolean;
}

export interface SpotifyContext {
  context_type: string;
  uri: string;
}

export interface SpotifyPlaybackState {
  device?: SpotifyDevice;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  timestamp?: number;
  progress_ms?: number;
  is_playing: boolean;
  item?: SpotifyTrack;
  context?: SpotifyContext;
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context?: SpotifyContext;
}

export interface SpotifySearchResult {
  tracks?: SpotifyPaging<SpotifyTrack>;
  artists?: SpotifyPaging<SpotifyArtist>;
  albums?: SpotifyPaging<SpotifyAlbum>;
  playlists?: SpotifyPaging<SpotifyPlaylist>;
}

// ─── View state ──────────────────────────────────────────────────────────────

export type SpotifyView =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: "library" }
  | { kind: "playlist"; id: string }
  | { kind: "album"; id: string }
  | { kind: "artist"; id: string }
  | { kind: "liked" };
