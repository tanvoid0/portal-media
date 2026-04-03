/** Loaded at runtime from `media-stream-addon.zip` (see Tauri `load_streaming_addon`). */

export type StreamingAddonSummary = {
  id: string;
  version: string;
  displayName: string;
  enabled: boolean;
  webOrigin: string;
  iconFaviconDomain: string;
  libraryBookmark: boolean;
  tmdbStreamButton: boolean;
  browserBrandRuleCount: number;
};

export type StreamingAddonListEntry = {
  path: string;
  discoverySources: string[];
  summary: StreamingAddonSummary | null;
  error: string | null;
  isActive: boolean;
  /** Excluded by app “turn off” (still listed; not eligible as active). */
  isUserDisabled: boolean;
};

export type StreamingAddonManifest = {
  id: string;
  version: string;
  enabled: boolean;
  displayName: string;
  webOrigin: string;
  icon: { faviconDomain: string };
  features: {
    libraryBookmark: boolean;
    tmdbStreamButton: boolean;
  };
  browserBrand?: {
    hostSuffixes: string[];
    accentColor?: string | null;
    nameIncludes: string[];
  };
};
