/** Mirrors backend `IgdbGamePayload` / fetch result `kind` from Tauri. */

export interface IgdbWebsiteLink {
  url: string;
  label: string;
}

export interface IgdbGamePayload {
  source: string;
  igdbId: number | null;
  name: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  genres: string[];
  themes: string[];
  websiteLinks: IgdbWebsiteLink[];
}

export type IgdbFetchResult =
  | { kind: "notConfigured" }
  | { kind: "skipped"; reason: string }
  | { kind: "cached"; payload: IgdbGamePayload }
  | { kind: "fresh"; payload: IgdbGamePayload }
  | { kind: "notFound" }
  | { kind: "error"; message: string };

export interface ProviderStatus {
  igdbConfigured: boolean;
  tmdbConfigured: boolean;
}

export interface MetadataTestResult {
  ok: boolean;
  message: string;
}

export interface TmdbSearchHit {
  mediaType: string;
  id: number;
  title: string | null;
  name: string | null;
  overview: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
}

export type TmdbSearchResult =
  | { kind: "notConfigured" }
  | { kind: "ok"; hits: TmdbSearchHit[] }
  | { kind: "error"; message: string };

export interface TmdbDetailPayload {
  source: string;
  mediaType: string;
  id: number;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseLabel: string | null;
  homepage: string | null;
}

export type TmdbDetailResult =
  | { kind: "notConfigured" }
  | { kind: "error"; message: string }
  | { kind: "ok"; payload: TmdbDetailPayload };

export interface EnrichSummary {
  refreshed: number;
  errors: number;
  skipped: number;
}
