/**
 * TMDB returns watch-provider metadata but not per-title deep links into Netflix, etc.
 * These URLs open the service (or a search) in the in-app browser so playback is one or two clicks away.
 */
export function streamingUrlForProvider(
  providerId: number,
  providerName: string,
  title: string
): string {
  const q = encodeURIComponent(title);
  const plus = encodeURIComponent(`${title} ${providerName}`);

  switch (providerId) {
    case 8: // Netflix
      return `https://www.netflix.com/search?q=${q}`;
    case 9: // Prime Video
      return `https://www.amazon.com/s?k=${q}&i=instant-video`;
    case 337: // Disney+
      return `https://www.disneyplus.com/browse/search?q=${q}`;
    case 15: // Hulu
      return `https://www.hulu.com/search?q=${q}`;
    case 386: // Apple TV+
      return `https://tv.apple.com/search?term=${q}`;
    case 384: // HBO Max (legacy id; Max may redirect)
    case 1899: // Max
      return `https://www.max.com/search?q=${q}`;
    case 531: // Paramount+
      return `https://www.paramountplus.com/search/?q=${q}`;
    case 387: // Peacock
      return `https://www.peacocktv.com/search?q=${q}`;
    case 2: // Apple TV (iTunes)
      return `https://tv.apple.com/search?term=${q}`;
    case 350: // Apple TV Plus (alt)
      return `https://tv.apple.com/search?term=${q}`;
    default:
      return `https://www.google.com/search?q=${plus}+watch+online`;
  }
}

const STREAMING_PROVIDER_LABELS: Record<number, string> = {
  2: "Apple TV",
  8: "Netflix",
  9: "Prime Video",
  15: "Hulu",
  337: "Disney+",
  350: "Apple TV+",
  384: "Max",
  386: "Apple TV+",
  387: "Peacock",
  531: "Paramount+",
  1899: "Max",
};

/** Display name when a homepage matches a provider but TMDB did not return that row for the region. */
export function streamingProviderLabel(providerId: number): string {
  return STREAMING_PROVIDER_LABELS[providerId] ?? "Streaming";
}

/** Domain for high-res favicons when TMDB omits `logoUrl` (e.g. homepage-only Netflix link). */
const PROVIDER_LOGO_DOMAIN: Record<number, string> = {
  2: "tv.apple.com",
  8: "netflix.com",
  9: "primevideo.com",
  15: "hulu.com",
  337: "disneyplus.com",
  350: "tv.apple.com",
  384: "max.com",
  386: "tv.apple.com",
  387: "peacocktv.com",
  531: "paramountplus.com",
  1899: "max.com",
};

/**
 * Cheap brand mark when TMDB does not ship a `logo_path` for this provider in the user’s region.
 */
export function streamingProviderLogoFallbackUrl(providerId: number): string | null {
  const domain = PROVIDER_LOGO_DOMAIN[providerId];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

function normalizedHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * Map a title's official homepage URL to a TMDB watch-provider id when it is a known streaming domain.
 * Used to show streaming branding instead of a generic “official site” link.
 */

/** v1 behaviour when a manifest omits `deepLink` — Stremio-style hash routes. */
const DEFAULT_DETAIL_TEMPLATE = "{origin}/#/metadetails/{type}/{imdbId}";
const DEFAULT_SEARCH_TEMPLATE = "{origin}/#/search?search={query}";

export type AddonDeepLinkVars = {
  origin: string;
  mediaType: string;
  imdbId?: string | null;
  tmdbId?: string | number | null;
  title: string;
};

/**
 * Fill an add-on route template. Placeholders `{origin} {type} {imdbId} {tmdbId} {query}`; every
 * value except `{origin}` is percent-encoded so a title with `&` or `#` cannot break the route.
 */
export function renderAddonTemplate(template: string, vars: AddonDeepLinkVars): string {
  const origin = vars.origin.replace(/\/$/, "");
  const values: Record<string, string> = {
    origin,
    type: vars.mediaType === "tv" ? "series" : "movie",
    imdbId: vars.imdbId?.trim() ?? "",
    tmdbId: vars.tmdbId == null ? "" : String(vars.tmdbId),
    query: vars.title.trim() || " ",
  };
  return template.replace(/\{(origin|type|imdbId|tmdbId|query)\}/g, (_, key: string) =>
    key === "origin" ? values[key] : encodeURIComponent(values[key])
  );
}

/** Deep link for the optional catalog add-on; uses manifest `deepLink` templates when present. */
export function addonMetadetailsDeepLink(
  vars: AddonDeepLinkVars,
  templates?: { detail?: string | null; search?: string | null } | null
): string {
  const hasImdb = (vars.imdbId?.trim() ?? "").startsWith("tt");
  const template = hasImdb
    ? (templates?.detail ?? DEFAULT_DETAIL_TEMPLATE)
    : (templates?.search ?? DEFAULT_SEARCH_TEMPLATE);
  return renderAddonTemplate(template, vars);
}

export function faviconUrlFromDomain(domain: string, size: 128 | 256): string {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(domain)}`;
}

export function streamingProviderIdForHomepageUrl(homepageUrl: string): number | null {
  try {
    const { hostname } = new URL(homepageUrl);
    const h = normalizedHost(hostname);

    if (h.endsWith("netflix.com")) return 8;
    if (h.endsWith("primevideo.com")) return 9;
    if (
      h.endsWith("amazon.com") ||
      h.endsWith("amazon.co.uk") ||
      h.endsWith("amazon.de") ||
      h.endsWith("amazon.co.jp")
    ) {
      return 9;
    }
    if (h.endsWith("disneyplus.com")) return 337;
    if (h.endsWith("hulu.com")) return 15;
    if (h === "tv.apple.com" || h.endsWith(".tv.apple.com")) return 386;
    if (h.endsWith("max.com") || h.endsWith("hbomax.com")) return 1899;
    if (h.endsWith("paramountplus.com")) return 531;
    if (h.endsWith("peacocktv.com")) return 387;

    return null;
  } catch {
    return null;
  }
}
