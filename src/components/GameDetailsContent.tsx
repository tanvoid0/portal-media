import { useEffect, useCallback, useRef } from "react";
import { useGameMetadata } from "@/hooks/useGameMetadata";
import { useGameStore } from "@/stores/gameStore";
import type { Game } from "@/types/game";
import { OVERRIDABLE_CATEGORIES, tabLabel } from "@/utils/libraryPrefs";
import { appNavigate } from "@/nav/appNavigate";
import { EXECUTE_DETAILS_ACTION } from "@/navigation/universalNavCore";
import { Button } from "@/components/ui/button";
import { PlatformLabel } from "@/components/PlatformLabel";
import { getSafeImageSource } from "@/utils/imageUtils";
import {
  formatLastOpened,
  getLinkHostname,
  launchTypeLabel,
  relativePathUnderBase,
} from "@/utils/gameDisplay";
import { igdbLinkIcon } from "@/utils/igdbLinkIcons";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import { cn } from "@/lib/utils";
import { openGameFilesystemLocation, canRevealGameInFileManager } from "@/utils/openGameLocation";
import {
  Archive,
  Copy,
  ExternalLink,
  FolderOpen,
  LayoutList,
  Link2,
  Loader2,
  Play,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { DetailsFocusControl } from "@/components/details/DetailsFocusControl";
import { DetailsPageShell } from "@/components/layout/DetailsPageShell";
import { DetailsHeroFrame } from "@/components/layout/DetailsHeroFrame";

export function GameDetailsContent({
  game,
  layout = "page",
}: {
  game: Game | null;
  layout?: "sidebar" | "page";
}) {
  const favoriteIds = useGameStore((s) => s.favoriteIds);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const launchGame = useGameStore((s) => s.launchGame);
  const getLastOpenedTime = useGameStore((s) => s.getLastOpenedTime);
  const archiveGame = useGameStore((s) => s.archiveGame);
  const setCategoryOverride = useGameStore((s) => s.setCategoryOverride);
  const getNativeCategory = useGameStore((s) => s.getNativeCategory);
  const categoryOverrides = useGameStore((s) => s.categoryOverrides);
  const hiddenFromCategories = useGameStore((s) => s.hiddenFromCategories);
  const hideFromCategoryTab = useGameStore((s) => s.hideFromCategoryTab);
  const unhideFromCategoryTab = useGameStore((s) => s.unhideFromCategoryTab);
  const metaPanel = useGameMetadata(game);
  const igdbGridCover = useMetadataDisplayStore((s) =>
    game ? s.igdbCoverUrlByGameId[game.id] : undefined
  );
  const isFavorite = game ? favoriteIds.includes(game.id) : false;
  const nativeCategory = game ? getNativeCategory(game.id) : undefined;
  const hasCategoryOverride = game ? game.id in categoryOverrides : false;
  const hiddenTabsForGame = game ? hiddenFromCategories[game.id] ?? [] : [];
  const canHideFromCurrentTab = game ? !hiddenTabsForGame.includes(game.category) : false;
  const cover = game
    ? getSafeImageSource(
        game.cover_art ||
          game.icon ||
          igdbGridCover ||
          (metaPanel.kind === "igdb" ? metaPanel.payload.coverUrl : undefined)
      )
    : null;
  const lastOpened = game ? getLastOpenedTime(game.id) : 0;
  const host = game ? getLinkHostname(game) : null;
  const pathLine = game
    ? game.launch_type === "Url"
      ? game.executable || game.path
      : game.path || game.executable
    : "";

  const openMetadataSettings = useCallback(() => {
    appNavigate("/settings/api");
  }, []);

  const copyPath = useCallback(async () => {
    if (!pathLine) return;
    try {
      await navigator.clipboard.writeText(pathLine);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [pathLine]);

  const openLocation = useCallback(async () => {
    if (!game) return;
    try {
      await openGameFilesystemLocation(game);
    } catch {
      toast.error("Could not open this location");
    }
  }, [game]);

  const showOpenLocationButton = game
    ? Boolean(pathLine) && (game.launch_type === "Url" || canRevealGameInFileManager(game))
    : false;

  const executableRelative =
    game && game.launch_type !== "Url" && game.path?.trim() && game.executable?.trim()
      ? relativePathUnderBase(game.path, game.executable)
      : null;

  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onExecute = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (!game) return;
      if (idx === 0) toggleFavorite(game.id);
      if (idx === 1) void copyPath();
      if (idx === 2 && showOpenLocationButton) void openLocation();
      if (idx === 3) void launchGame(game);
      if (idx === 4) {
        archiveGame(game.id);
        toast.success("Archived — restore from Library settings if needed");
      }
      if (idx === 5) setCategoryOverride(game.id, "Game");
      if (idx === 6) setCategoryOverride(game.id, "App");
      if (idx === 7) setCategoryOverride(game.id, "Media");
    };
    window.addEventListener(EXECUTE_DETAILS_ACTION, onExecute as EventListener);
    return () => window.removeEventListener(EXECUTE_DETAILS_ACTION, onExecute as EventListener);
  }, [
    game,
    showOpenLocationButton,
    toggleFavorite,
    copyPath,
    openLocation,
    launchGame,
    archiveGame,
    setCategoryOverride,
  ]);

  const emptyDetails = (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 min-h-[12rem]">
      <div className="rounded-2xl p-5 bg-muted/40 border border-border/50">
        <LayoutList className="w-10 h-10 text-muted-foreground" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">Details</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[14rem]">
          Select a game, app, or bookmark in the grid to see more info and actions here.
        </p>
      </div>
    </div>
  );

  const asideShellClass = cn(
    "h-full w-[min(100%,22rem)] sm:w-96 shrink-0 flex flex-col",
    "border-l border-border/60 bg-card/80 backdrop-blur-xl",
    "shadow-[inset_1px_0_0_0_hsl(var(--foreground)/0.06)]"
  );

  if (!game) {
    return layout === "page" ? (
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-card/50 border-border/40 flex flex-col"
        aria-label="Item details"
      >
        {emptyDetails}
      </div>
    ) : (
      <aside className={asideShellClass} aria-label="Item details">
        {emptyDetails}
      </aside>
    );
  }

  const heroBlock = (mode: "page" | "sidebar") => (
    <DetailsHeroFrame variant={mode} imageSrc={cover} fallback={game.category === "Media" ? "📺" : game.category === "Bookmark" ? "🔗" : "🎮"}>
      <DetailsFocusControl
        index={0}
        className={cn("absolute right-2.5 sm:right-3 inline-flex", mode === "page" ? "top-2 sm:top-3" : "top-3")}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(
            "h-10 w-10 rounded-xl shadow-lg border border-border/60",
            isFavorite && "bg-amber-500/15 text-amber-500 border-amber-500/40"
          )}
          onClick={() => toggleFavorite(game.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={cn("h-5 w-5", isFavorite && "fill-current")} />
        </Button>
      </DetailsFocusControl>
    </DetailsHeroFrame>
  );

  const detailsColumn = (
    <div
      className={cn(
        "space-y-3.5",
        layout === "page"
          ? "w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-5"
          : "flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 min-h-0"
      )}
    >
            <header className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight tracking-tight pr-10">
                {game.name}
              </h2>
              <p
                className={cn(
                  "text-xs sm:text-sm truncate font-medium",
                  host ? "text-primary/90" : "text-muted-foreground"
                )}
                title={host ?? game.platform}
              >
                {host ?? game.platform}
              </p>
              <div className="flex flex-wrap gap-1.5 items-center">
                <PlatformLabel game={game} size="sm" variant="badge" />
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-md border border-border/60",
                    hasCategoryOverride
                      ? "bg-primary/15 text-primary border-primary/35"
                      : "bg-muted/80 text-muted-foreground"
                  )}
                  title={
                    hasCategoryOverride && nativeCategory
                      ? `Library default category: ${nativeCategory}`
                      : undefined
                  }
                >
                  {game.category}
                  {hasCategoryOverride && nativeCategory ? (
                    <span className="text-muted-foreground font-normal"> ({nativeCategory})</span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  {launchTypeLabel(game.launch_type)}
                </span>
              </div>
            </header>

            <p className="text-[11px] text-muted-foreground" title="Last launch from this device">
              {formatLastOpened(lastOpened)}
            </p>

            <DetailsFocusControl index={3} className="block">
              <Button
                type="button"
                className="w-full h-11 sm:h-12 rounded-xl text-sm sm:text-base font-semibold gap-2 shadow-lg shadow-primary/20"
                onClick={() => void launchGame(game)}
              >
                <Play className="h-5 w-5 fill-current shrink-0" />
                {game.launch_type === "Url" ? "Open" : "Launch"}
              </Button>
            </DetailsFocusControl>

            <section
              className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden shadow-sm"
              aria-label={game.launch_type === "Url" ? "Link target" : "Install location"}
            >
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-border/40 bg-muted/25">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {game.launch_type === "Url" ? "Link" : "Install location"}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <DetailsFocusControl index={1} className="inline-flex rounded-md">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => void copyPath()}
                      disabled={!pathLine}
                      aria-label="Copy path"
                      title="Copy path"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </DetailsFocusControl>
                  <DetailsFocusControl index={2} className="inline-flex rounded-md">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => void openLocation()}
                      disabled={!showOpenLocationButton}
                      aria-label={
                        game.launch_type === "Url" ? "Open in browser" : "Show in file explorer"
                      }
                      title={
                        !showOpenLocationButton
                          ? "No file path available"
                          : game.launch_type === "Url"
                            ? "Open in browser"
                            : "Show in file explorer"
                      }
                    >
                      {game.launch_type === "Url" ? (
                        <Link2 className="h-3.5 w-3.5" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </DetailsFocusControl>
                </div>
              </div>
              <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-1.5">
                <div className="max-w-full rounded-md bg-background/35 dark:bg-black/20 border border-border/30 px-2 py-1.5">
                  <div
                    className="overflow-x-auto max-w-full [scrollbar-width:thin]"
                    title={pathLine}
                  >
                    <p className="text-[11px] font-mono text-foreground/90 leading-5 whitespace-nowrap select-text pr-1">
                      {pathLine || "—"}
                    </p>
                  </div>
                </div>
                {game.launch_type !== "Url" &&
                game.executable?.trim() &&
                game.path?.trim() &&
                game.executable !== game.path ? (
                  executableRelative ? (
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      <span className="font-sans not-italic text-muted-foreground/75">Launcher </span>
                      <span className="font-mono text-foreground/70" title={game.executable}>
                        {executableRelative}
                      </span>
                    </p>
                  ) : (
                    <div
                      className="rounded-md bg-background/20 border border-border/25 px-2 py-1 overflow-x-auto max-w-full [scrollbar-width:thin]"
                      title={game.executable}
                    >
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap font-mono select-text leading-5">
                        <span className="font-sans text-muted-foreground/75">Executable </span>
                        {game.executable}
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-muted/15 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Library
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Hide from a tab only removes it from that sidebar filter; it stays under{" "}
                <span className="font-medium text-foreground/80">All</span>. Archive removes it
                everywhere until restored in Settings.
              </p>
              {canHideFromCurrentTab ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 rounded-lg justify-center text-xs"
                  onClick={() => {
                    hideFromCategoryTab(game.id, game.category);
                    toast.success(`Hidden from ${tabLabel(game.category)} tab`);
                  }}
                >
                  Hide from {tabLabel(game.category)} tab
                </Button>
              ) : null}
              {hiddenTabsForGame.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {hiddenTabsForGame.map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 rounded-lg justify-center text-[11px] text-muted-foreground"
                      onClick={() => {
                        unhideFromCategoryTab(game.id, tab);
                        toast.success(`Shown in ${tabLabel(tab)} tab again`);
                      }}
                    >
                      Show in {tabLabel(tab)} tab again
                    </Button>
                  ))}
                </div>
              ) : null}
              <DetailsFocusControl index={4} className="block">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full h-9 rounded-lg gap-2 justify-center border-border/60 text-xs"
                  title="Removes from All and every tab until you restore in Settings → Library."
                  onClick={() => {
                    archiveGame(game.id);
                    toast.success("Archived — restore from Library settings if needed");
                  }}
                >
                  <Archive className="h-4 w-4 shrink-0" />
                  Archive (entire library)
                </Button>
              </DetailsFocusControl>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Move to sidebar tab</p>
                <div className="flex flex-wrap gap-1.5">
                  {OVERRIDABLE_CATEGORIES.map((cat, i) => (
                    <DetailsFocusControl key={cat} index={5 + i} className="inline-flex">
                      <Button
                        type="button"
                        variant={game.category === cat ? "default" : "outline"}
                        size="sm"
                        className="rounded-md text-[11px] min-w-[4rem] h-8"
                        onClick={() => setCategoryOverride(game.id, cat)}
                      >
                        {cat === "Game" ? "Games" : cat === "App" ? "Apps" : "Media"}
                      </Button>
                    </DetailsFocusControl>
                  ))}
                </div>
                {hasCategoryOverride && nativeCategory ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-7 px-2 text-[11px] text-muted-foreground"
                    onClick={() => setCategoryOverride(game.id, null)}
                  >
                    Reset to library default ({nativeCategory})
                  </Button>
                ) : null}
              </div>
            </section>

            {metaPanel.kind !== "idle" && metaPanel.kind !== "not_applicable" ? (
            <div className="border-t border-border/50 pt-3 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-0.5">
                Metadata
              </p>

              {metaPanel.kind === "loading" ? (
                <div
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground"
                  aria-busy
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                  Loading…
                </div>
              ) : null}

              {(metaPanel.kind === "igdb_gate" || metaPanel.kind === "tmdb_gate") && (
                <div className="rounded-lg border border-dashed border-primary/35 bg-primary/5 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
                    {metaPanel.kind === "igdb_gate" ? "Unlock IGDB" : "Unlock TMDB"}
                  </p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{metaPanel.message}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full rounded-lg h-8 text-xs"
                    onClick={openMetadataSettings}
                  >
                    Metadata settings
                  </Button>
                </div>
              )}

              {(metaPanel.kind === "igdb_note" || metaPanel.kind === "tmdb_note") && (
                <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">{metaPanel.message}</p>
                </div>
              )}

              {metaPanel.kind === "igdb" && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-full sm:w-auto sm:mr-2">
                      IGDB
                    </p>
                    {metaPanel.payload.releaseDate ? (
                      <p className="text-[11px] text-muted-foreground">{metaPanel.payload.releaseDate}</p>
                    ) : null}
                  </div>
                  {metaPanel.payload.genres.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {metaPanel.payload.genres.map((g) => (
                        <span
                          key={g}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/15"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {(metaPanel.payload.summary || metaPanel.payload.storyline) && (
                    <p className="text-xs text-foreground/90 leading-relaxed line-clamp-5">
                      {metaPanel.payload.summary || metaPanel.payload.storyline}
                    </p>
                  )}
                  {metaPanel.payload.websiteLinks.length > 0 ? (
                    <ul className="text-[11px] space-y-1">
                      {metaPanel.payload.websiteLinks.slice(0, 10).map((w) => {
                        const Icon = igdbLinkIcon(w.label);
                        return (
                          <li key={w.url} className="min-w-0">
                            <a
                              href={w.url}
                              target="_blank"
                              rel="noreferrer"
                              title={w.url}
                              className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-primary hover:bg-primary/10"
                            >
                              <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                              <span className="truncate font-medium">{w.label}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40 ml-auto" aria-hidden />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              )}

              {metaPanel.kind === "tmdb" && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    TMDB · {metaPanel.payload.mediaType === "tv" ? "TV" : "Film"}
                  </p>
                  {metaPanel.payload.releaseLabel ? (
                    <p className="text-[11px] text-muted-foreground">{metaPanel.payload.releaseLabel}</p>
                  ) : null}
                  {metaPanel.payload.runtimeMinutes != null ? (
                    <p className="text-[11px] text-muted-foreground">
                      ~{metaPanel.payload.runtimeMinutes} min
                    </p>
                  ) : null}
                  {metaPanel.payload.genres.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {metaPanel.payload.genres.map((g) => (
                        <span
                          key={g}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/15"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {metaPanel.payload.overview ? (
                    <p className="text-xs text-foreground/90 leading-relaxed line-clamp-6">
                      {metaPanel.payload.overview}
                    </p>
                  ) : null}
                  {metaPanel.payload.providers.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                      {metaPanel.payload.providers.length} streaming option
                      {metaPanel.payload.providers.length === 1 ? "" : "s"} in TMDB (region data)
                    </p>
                  ) : null}
                  {metaPanel.payload.homepage ? (
                    <a
                      href={metaPanel.payload.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Official site
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : null}
                </div>
              )}
            </div>
            ) : null}

            <p className="text-[10px] text-muted-foreground/80 text-center leading-snug pb-1 pt-0.5">
              Escape · back to grid · Enter activates focus
            </p>
    </div>
  );

  if (layout === "page") {
    return (
      <DetailsPageShell scrollRef={pageScrollRef} scrollResetKey={game.id} ariaLabel="Item details">
        {heroBlock("page")}
        {detailsColumn}
      </DetailsPageShell>
    );
  }

  return (
    <aside className={asideShellClass} aria-label="Item details">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        {heroBlock("sidebar")}
        {detailsColumn}
      </div>
    </aside>
  );
}
