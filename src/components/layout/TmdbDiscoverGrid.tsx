import { useEffect, useRef, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { appNavigate } from "@/nav/appNavigate";
import { Button } from "@/components/ui/button";
import { useIntegrationsStore } from "@/stores/integrationsStore";
import { discoverItemLabel, useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import { discoverCacheAgeLabel, DISCOVER_CACHE_TTL_MS } from "@/utils/discoverCache";
import type { IgdbDiscoverHit, TmdbSearchHit } from "@/types/metadata";
import { cn } from "@/lib/utils";
import { Loader2, Film, RefreshCw, Gamepad2 } from "lucide-react";
import { ShelfCard, StreamingProviderLogosRow } from "@/components/content";
import { useTmdbWatchProviders } from "@/hooks/useTmdbWatchProviders";
import {
  DISCOVER_FEED_TABS,
  discoverTabNeedsIgdb,
  discoverTabNeedsTmdb,
  posterUrlForTmdbHit,
  TMDB_API_SETTINGS,
  TWITCH_APPS,
} from "@/config/discoverFeeds";
import {
  buildContentGridContainerClassName,
  contentGridTemplateColumnsStyle,
  DISCOVER_POSTERS_GRID_PRESET,
} from "@/config/contentGridPresets";
import { useGridColumnCountSync } from "@/hooks/useGridColumnCountSync";
import { useKeepGridSelectionVisible } from "@/hooks/useKeepGridSelectionVisible";

function DiscoverTmdbShelfCard({
  hit,
  index,
  selected,
  tmdbReady,
  onActivate,
  onHover,
}: {
  hit: TmdbSearchHit;
  index: number;
  selected: boolean;
  tmdbReady: boolean;
  onActivate: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const providers = useTmdbWatchProviders(hit.mediaType, hit.id, tmdbReady);
  const title = discoverItemLabel(hit);
  const posterUrl = posterUrlForTmdbHit(hit);

  return (
    <ShelfCard
      isSelected={selected}
      title={title}
      subtitle={hit.mediaType === "tv" ? "TV" : "Movie"}
      actionHint="Enter · Details"
      artImageUrl={posterUrl}
      artMode="posterCover"
      placeholder={
        <Film
          className="h-14 w-14 mx-auto mb-3 opacity-70 text-muted-foreground shrink-0"
          strokeWidth={1.25}
          aria-hidden
        />
      }
      footerAccessory={<StreamingProviderLogosRow providers={providers} titleForDeepLink={title} />}
      onClick={() => onActivate(index)}
      onMouseEnter={() => onHover(index)}
    />
  );
}

function DiscoverIgdbShelfCard({
  hit,
  index,
  selected,
  onActivate,
  onHover,
}: {
  hit: IgdbDiscoverHit;
  index: number;
  selected: boolean;
  onActivate: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const posterRaw = hit.coverUrl ?? null;

  return (
    <ShelfCard
      isSelected={selected}
      title={hit.name}
      subtitle="Game"
      actionHint="Enter · Open"
      artImageUrl={posterRaw}
      artMode="posterCover"
      placeholder={
        <Gamepad2
          className="h-14 w-14 mx-auto mb-3 opacity-70 text-muted-foreground shrink-0"
          strokeWidth={1.25}
          aria-hidden
        />
      }
      onClick={() => onActivate(index)}
      onMouseEnter={() => onHover(index)}
    />
  );
}

export function TmdbDiscoverGrid() {
  const status = useIntegrationsStore((s) => s.status);
  const load = useTmdbDiscoverStore((s) => s.load);
  const loading = useTmdbDiscoverStore((s) => s.loading);
  const error = useTmdbDiscoverStore((s) => s.error);
  const tmdbPayload = useTmdbDiscoverStore((s) => s.tmdbPayload);
  const igdbGames = useTmdbDiscoverStore((s) => s.igdbGames);
  const lastFetchedAt = useTmdbDiscoverStore((s) => s.lastFetchedAt);
  const feed = useTmdbDiscoverStore((s) => s.feed);
  const setFeed = useTmdbDiscoverStore((s) => s.setFeed);
  const items = useTmdbDiscoverStore((s) => s.getItems());
  const selectedIndex = useTmdbDiscoverStore((s) => s.selectedIndex);
  const setSelectedIndex = useTmdbDiscoverStore((s) => s.setSelectedIndex);
  const setGridColumnCount = useTmdbDiscoverStore((s) => s.setGridColumnCount);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  const hasAnyApi = status.tmdbConfigured || status.igdbConfigured;
  const cacheHint =
    lastFetchedAt != null
      ? `Updated ${discoverCacheAgeLabel(lastFetchedAt)} · auto-refresh after ${Math.round(DISCOVER_CACHE_TTL_MS / 60000)}m`
      : null;

  useEffect(() => {
    void useIntegrationsStore.getState().refreshStatus();
  }, []);

  useEffect(() => {
    if (!hasAnyApi) return;
    void useTmdbDiscoverStore.getState().load();
  }, [hasAnyApi]);

  useGridColumnCountSync(containerRef, setGridColumnCount, {
    itemCount: items.length,
    layoutEpoch: loading,
  });

  useKeepGridSelectionVisible(containerRef, selectedCardRef, {
    selectedIndex,
    itemCount: items.length,
  });

  const openTmdbDetail = useCallback((hit: TmdbSearchHit) => {
    appNavigate(`/tmdb/${hit.mediaType}/${hit.id}`);
  }, []);

  const onCardClick = useCallback(
    (index: number) => {
      if (feed === "popularGames") {
        const g = igdbGames[index];
        if (!g) return;
        setSelectedIndex(index);
        appNavigate(`/igdb/${g.id}`);
        return;
      }
      const hit = items[index] as TmdbSearchHit;
      setSelectedIndex(index);
      openTmdbDetail(hit);
    },
    [feed, igdbGames, items, openTmdbDetail, setSelectedIndex]
  );

  const tabBlocked =
    (discoverTabNeedsTmdb(feed) && !status.tmdbConfigured) ||
    (discoverTabNeedsIgdb(feed) && !status.igdbConfigured);

  if (!hasAnyApi && !loading) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-8 bg-gradient-to-b from-card/35 via-background to-background">
        <div className="text-center glass-dark rounded-2xl p-10 max-w-md border border-border/50 space-y-4 text-foreground">
          <Film className="w-14 h-14 mx-auto text-primary/80" aria-hidden />
          <p className="text-xl font-semibold text-foreground">Discover needs an API</p>
          <p className="text-sm text-muted-foreground">
            Connect <span className="font-medium text-foreground">TMDB</span> for movies and TV, and/or{" "}
            <span className="font-medium text-foreground">Twitch + IGDB</span> for popular games — all
            under Settings → Metadata &amp; APIs.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button type="button" className="rounded-xl" onClick={() => appNavigate("/settings/api")}>
              Open API settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !tmdbPayload && igdbGames.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 bg-gradient-to-b from-card/35 via-background to-background text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading Discover…</p>
      </div>
    );
  }

  if (error && !tmdbPayload && igdbGames.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-8 bg-gradient-to-b from-card/35 via-background to-background">
        <div className="text-center glass-dark rounded-2xl p-8 max-w-md border border-destructive/40 text-foreground">
          <p className="text-destructive font-semibold mb-2">Could not load Discover</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void load({ force: true })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !tmdbPayload && igdbGames.length === 0 && !error) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-4 px-6 py-8 bg-gradient-to-b from-card/35 via-background to-background text-foreground">
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Discover has no cached data yet. Pull fresh lists from TMDB and IGDB.
        </p>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void load({ force: true })}>
          Load now
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gradient-to-b from-card/25 via-background/80 to-background text-foreground">
      <div className="shrink-0 px-6 sm:px-10 pt-6 pb-3 border-b border-border/50 bg-card/50 backdrop-blur-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {DISCOVER_FEED_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={feed === tab.id ? "default" : "ghost"}
                className={cn("rounded-full", feed === tab.id && "shadow-md")}
                onClick={() => setFeed(tab.id)}
              >
                {tab.id === "popularGames" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 opacity-90" aria-hidden />
                    {tab.label}
                  </span>
                ) : (
                  tab.label
                )}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {cacheHint ? (
              <p className="text-[10px] text-muted-foreground max-w-[14rem] sm:text-right leading-snug">{cacheHint}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full gap-2 shrink-0"
              disabled={loading}
              onClick={() => void load({ force: true })}
              title="Fetch latest from TMDB and IGDB"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        </div>
        {tabBlocked ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95 flex flex-wrap items-center gap-2">
            <span>
              {discoverTabNeedsTmdb(feed) && !status.tmdbConfigured
                ? "Add a TMDB API key in Settings → Metadata & APIs to load movie and TV lists."
                : null}
              {discoverTabNeedsIgdb(feed) && !status.igdbConfigured
                ? "Add Twitch (IGDB) credentials in Settings → Metadata & APIs to load popular games."
                : null}
            </span>
            <Button type="button" size="sm" variant="secondary" className="h-7 rounded-lg" onClick={() => appNavigate("/settings/api")}>
              Settings
            </Button>
            {discoverTabNeedsTmdb(feed) && !status.tmdbConfigured ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg text-amber-100/90"
                onClick={() => void openUrl(TMDB_API_SETTINGS).catch(() => {})}
              >
                Get TMDB key
              </Button>
            ) : null}
            {discoverTabNeedsIgdb(feed) && !status.igdbConfigured ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg text-amber-100/90"
                onClick={() => void openUrl(TWITCH_APPS).catch(() => {})}
              >
                Twitch dev console
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error && (tmdbPayload || igdbGames.length > 0) ? (
        <p className="px-6 sm:px-10 pt-2 text-[11px] text-amber-600 dark:text-amber-400/90 shrink-0">
          Some sources failed: {error}
        </p>
      ) : null}

      {tabBlocked ? (
        <div className="flex-1 min-h-[8rem] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Configure the API above to see titles in this tab.
        </div>
      ) : !loading && items.length === 0 ? (
        <div className="flex-1 min-h-[8rem] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Nothing in this list right now. Try another tab or Refresh.
        </div>
      ) : (
        <div
          ref={containerRef}
          className={buildContentGridContainerClassName(DISCOVER_POSTERS_GRID_PRESET)}
          style={contentGridTemplateColumnsStyle(DISCOVER_POSTERS_GRID_PRESET)}
        >
          {feed === "popularGames"
            ? (items as IgdbDiscoverHit[]).map((hit, index) => (
                <div
                  key={`igdb-${hit.id}`}
                  ref={index === selectedIndex ? selectedCardRef : null}
                  className="flex justify-center"
                >
                  <DiscoverIgdbShelfCard
                    hit={hit}
                    index={index}
                    selected={index === selectedIndex}
                    onActivate={onCardClick}
                    onHover={setSelectedIndex}
                  />
                </div>
              ))
            : (items as TmdbSearchHit[]).map((hit, index) => (
                <div
                  key={`${hit.mediaType}-${hit.id}`}
                  ref={index === selectedIndex ? selectedCardRef : null}
                  className="flex justify-center"
                >
                  <DiscoverTmdbShelfCard
                    hit={hit}
                    index={index}
                    selected={index === selectedIndex}
                    tmdbReady={status.tmdbConfigured}
                    onActivate={onCardClick}
                    onHover={setSelectedIndex}
                  />
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
