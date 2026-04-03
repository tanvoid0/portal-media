import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "@/stores/navigationStore";
import { useBrowserStore } from "@/stores/browserStore";
import { EXECUTE_TMDB_DETAILS_ACTION } from "@/navigation/universalNavCore";
import type { TmdbDetailPayload, TmdbDetailResult } from "@/types/metadata";
import type { StreamingAddonManifest } from "@/types/streamingAddon";
import { getSafeImageSource, isValidImageSource } from "@/utils/imageUtils";
import { useStreamingAddonStore } from "@/stores/streamingAddonStore";
import {
  addonMetadetailsDeepLink,
  faviconUrlFromDomain,
  streamingProviderIdForHomepageUrl,
  streamingProviderLabel,
  streamingProviderLogoFallbackUrl,
  streamingUrlForProvider,
} from "@/utils/tmdbStreamLinks";
import { Button } from "@/components/ui/button";
import { DetailsFocusControl } from "@/components/details/DetailsFocusControl";
import { DetailsHeroFrame } from "@/components/layout/DetailsHeroFrame";
import { DetailsPageShell } from "@/components/layout/DetailsPageShell";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Play } from "lucide-react";

type StreamAction = {
  label: string;
  url: string;
  logoUrl: string | null;
  subtitle?: string;
  /** Generic “official site” / unknown destination — use link glyph instead of play. */
  useExternalGlyph: boolean;
};

function buildStreamActions(
  title: string,
  payload: TmdbDetailPayload,
  catalogAddon: StreamingAddonManifest | null
): StreamAction[] {
  const out: StreamAction[] = [];
  const seen = new Set<string>();
  const providerIdsIncluded = new Set<number>();

  if (
    catalogAddon?.enabled &&
    catalogAddon.features.tmdbStreamButton
  ) {
    const url = addonMetadetailsDeepLink(
      catalogAddon.webOrigin,
      payload.mediaType,
      payload.imdbId,
      title
    );
    out.push({
      label: catalogAddon.displayName,
      subtitle: payload.imdbId?.startsWith("tt") ? "Catalog" : "Search",
      url,
      logoUrl: faviconUrlFromDomain(catalogAddon.icon.faviconDomain, 128),
      useExternalGlyph: false,
    });
  }

  for (const p of payload.providers.slice(0, 12)) {
    const key = `${p.providerId}:${p.offerKind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    providerIdsIncluded.add(p.providerId);
    const offer =
      p.offerKind === "flatrate"
        ? "Subscription"
        : p.offerKind === "rent"
          ? "Rent"
          : p.offerKind === "buy"
            ? "Buy"
            : p.offerKind;
    out.push({
      label: p.providerName,
      subtitle: offer,
      url: streamingUrlForProvider(p.providerId, p.providerName, title),
      logoUrl: p.logoUrl ?? streamingProviderLogoFallbackUrl(p.providerId) ?? null,
      useExternalGlyph: false,
    });
  }

  if (payload.watchLink) {
    out.push({
      label: "TMDB watch options",
      subtitle: payload.watchRegion ? `Region ${payload.watchRegion}` : undefined,
      url: payload.watchLink,
      logoUrl: null,
      useExternalGlyph: false,
    });
  }

  if (payload.homepage?.trim()) {
    const url = payload.homepage.trim();
    const matchedId = streamingProviderIdForHomepageUrl(url);
    if (matchedId != null && providerIdsIncluded.has(matchedId)) {
      // Already listed under Watch providers for this region.
    } else if (matchedId != null) {
      const fromList = payload.providers.find((p) => p.providerId === matchedId);
      out.push({
        label: fromList?.providerName ?? streamingProviderLabel(matchedId),
        subtitle: undefined,
        url,
        logoUrl: fromList?.logoUrl ?? streamingProviderLogoFallbackUrl(matchedId) ?? null,
        useExternalGlyph: false,
      });
    } else {
      let host = "Site";
      try {
        host = new URL(url).hostname.replace(/^www\./i, "");
      } catch {
        /* keep fallback */
      }
      out.push({
        label: "Official website",
        subtitle: host,
        url,
        logoUrl: null,
        useExternalGlyph: true,
      });
    }
  }

  return out;
}

export function TmdbDetailsContent({
  mediaType,
  tmdbId,
}: {
  mediaType: string;
  tmdbId: number;
}) {
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<TmdbDetailPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const openBrowser = useBrowserStore((s) => s.openBrowser);
  const setDetailsMaxIndex = useNavigationStore((s) => s.setDetailsMaxIndex);
  const setDetailsIndex = useNavigationStore((s) => s.setDetailsIndex);
  const catalogAddon = useStreamingAddonStore((s) => s.manifest);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPayload(null);
    void (async () => {
      try {
        const r = await invoke<TmdbDetailResult>("metadata_tmdb_fetch_detail", {
          mediaType,
          id: tmdbId,
        });
        if (cancelled) return;
        if (r.kind === "ok") {
          setPayload(r.payload);
        } else if (r.kind === "notConfigured") {
          setLoadError("TMDB is not configured.");
        } else {
          setLoadError(r.message);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId]);

  const actions = useMemo(() => {
    if (!payload) return [];
    return buildStreamActions(payload.title, payload, catalogAddon);
  }, [payload, catalogAddon]);

  useEffect(() => {
    const max = Math.max(0, actions.length - 1);
    setDetailsMaxIndex(max);
    setDetailsIndex(0);
  }, [actions.length, setDetailsIndex, setDetailsMaxIndex]);

  useEffect(() => {
    const onExecute = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      const a = actions[idx];
      if (a?.url) openBrowser(a.url);
    };
    window.addEventListener(EXECUTE_TMDB_DETAILS_ACTION, onExecute as EventListener);
    return () => window.removeEventListener(EXECUTE_TMDB_DETAILS_ACTION, onExecute as EventListener);
  }, [actions, openBrowser]);

  const poster = getSafeImageSource(payload?.posterUrl ?? null);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-card/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading details…</p>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/50">
        <p className="text-destructive font-medium mb-2">Could not load title</p>
        <p className="text-sm text-muted-foreground max-w-sm">{loadError ?? "Unknown error"}</p>
      </div>
    );
  }

  const heroSrc = isValidImageSource(payload.backdropUrl)
    ? payload.backdropUrl
    : isValidImageSource(payload.posterUrl)
      ? payload.posterUrl
      : null;

  const mainColumn = (
    <div
      className={cn(
        "space-y-3.5 w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-5"
      )}
    >
      <header className="flex gap-4">
        <div className="shrink-0 w-24 sm:w-28 rounded-xl overflow-hidden border border-border/50 bg-muted aspect-[2/3]">
          {poster ? (
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-2xl opacity-40">🎬</div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{payload.title}</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {payload.mediaType === "tv" ? "TV series" : "Movie"}
            {payload.releaseLabel ? ` · ${payload.releaseLabel}` : ""}
            {payload.runtimeMinutes ? ` · ${payload.runtimeMinutes} min` : ""}
          </p>
          {payload.tagline ? (
            <p className="text-sm italic text-primary/90 line-clamp-2">{payload.tagline}</p>
          ) : null}
          {payload.genres.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {payload.genres.map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {payload.overview ? (
        <section className="rounded-xl border border-border/50 bg-muted/15 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Overview
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed">{payload.overview}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border/50 bg-muted/15 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Watch
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          TMDB lists where a title may stream by region; it does not provide direct play URLs. The
          buttons below open each service in Portal’s built-in browser, usually on a search page for
          this title so you can start playback from there.
        </p>

        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No streaming providers listed for your region in TMDB yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {actions.map((a, index) => (
              <DetailsFocusControl key={`${a.url}-${index}`} index={index} className="inline-flex max-w-full">
                <Button
                  type="button"
                  variant="secondary"
                  className={cn(
                    "h-11 rounded-xl justify-start gap-2.5 px-3 border-border/60 shrink-0",
                    "w-fit max-w-full sm:max-w-[17.5rem]"
                  )}
                  onClick={() => openBrowser(a.url)}
                >
                  {a.useExternalGlyph ? (
                    <ExternalLink className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  ) : a.logoUrl ? (
                    <img
                      src={a.logoUrl}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-md object-contain bg-background/80 border border-border/35 p-0.5"
                    />
                  ) : (
                    <Play className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  )}
                  <span className="text-left min-w-0">
                    <span className="block font-medium text-sm leading-tight truncate max-w-[12rem]">
                      {a.label}
                    </span>
                    {a.subtitle ? (
                      <span className="block text-[11px] text-muted-foreground truncate max-w-[12rem] mt-0.5">
                        {a.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40 ml-0.5" aria-hidden />
                </Button>
              </DetailsFocusControl>
            ))}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground/80 text-center pb-2 pt-1">
        Escape · back to Discover · Enter opens the highlighted option in the browser panel
      </p>
    </div>
  );

  return (
    <DetailsPageShell
      scrollRef={pageScrollRef}
      scrollResetKey={`${mediaType}-${tmdbId}`}
      ariaLabel="Title details"
    >
      <DetailsHeroFrame variant="page" imageSrc={heroSrc} fallback="🎬" />
      {mainColumn}
    </DetailsPageShell>
  );
}
