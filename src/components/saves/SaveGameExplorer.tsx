import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { useSaveSyncStore } from "@/stores/saveSyncStore";
import { useGameStore } from "@/stores/gameStore";
import { SaveGameGroupCard } from "@/components/saves/SaveGameGroupCard";
import { SaveExplorerSkeleton } from "@/components/saves/SaveExplorerSkeleton";
import { SaveExplorerStatsBar } from "@/components/saves/SaveExplorerStatsBar";
import {
  explorerTotals,
  filterSaveGroups,
  filterSaveGroupsByKind,
  groupBundlesByGame,
  sortSaveGroups,
  type SaveGroupSort,
  type SaveLocationKind,
} from "@/utils/saveBundleDisplay";
import { appNavigate } from "@/nav/appNavigate";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  HardDrive,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { toastInvokeCatch } from "@/utils/invokeError";

const KIND_FILTERS: { id: SaveLocationKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "steam", label: "Steam" },
  { id: "documents", label: "Documents" },
  { id: "install", label: "Install" },
];

const SORT_OPTIONS: { id: SaveGroupSort; label: string }[] = [
  { id: "recent", label: "Recently updated" },
  { id: "name", label: "Game name" },
  { id: "size", label: "Total size" },
];

export function SaveGameExplorer({
  filterGameId,
  title = "Save data explorer",
  description = "Browse detected save folders on this PC. Open in File Explorer, copy paths, or jump to a game.",
  variant = "library",
}: {
  filterGameId?: string;
  title?: string;
  description?: string;
  variant?: "library" | "settings";
}) {
  const bundles = useSaveSyncStore((s) => s.bundles);
  const syncStatus = useSaveSyncStore((s) => s.status);
  const loading = useSaveSyncStore((s) => s.bundlesLoading);
  const loadAll = useSaveSyncStore((s) => s.loadAllBundles);
  const loadForGame = useSaveSyncStore((s) => s.loadBundlesForGame);
  const scanGames = useGameStore((s) => s.scanGames);
  const isLibraryLoading = useGameStore((s) => s.isLoading);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<SaveLocationKind | "all">("all");
  const [sort, setSort] = useState<SaveGroupSort>("recent");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isSettings = variant === "settings";

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      toast.error("Save explorer requires the desktop app.");
      return;
    }
    try {
      if (filterGameId) {
        await loadForGame(filterGameId);
      } else {
        await loadAll();
      }
    } catch (e) {
      toastInvokeCatch("Could not scan save locations", e);
    }
  }, [filterGameId, loadAll, loadForGame]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    let list = groupBundlesByGame(bundles);
    if (filterGameId) list = list.filter((g) => g.gameId === filterGameId);
    else list = filterSaveGroups(list, query);
    list = filterSaveGroupsByKind(list, kindFilter);
    return sortSaveGroups(list, sort);
  }, [bundles, filterGameId, query, kindFilter, sort]);

  const totals = useMemo(() => explorerTotals(bundles), [bundles]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (filterGameId || groups.length <= 6) {
      setExpandedIds(new Set(groups.map((g) => g.gameId)));
    }
  }, [groups, filterGameId]);

  const allExpanded = groups.length > 0 && groups.every((g) => expandedIds.has(g.gameId));

  const toggleGroup = (gameId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const setAllExpanded = (open: boolean) => {
    setExpandedIds(open ? new Set(groups.map((g) => g.gameId)) : new Set());
  };

  const cloudEnabled = syncStatus?.config.enabled;
  const cloudConnected = syncStatus?.connected;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <h2
              className={cn(
                "text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2.5",
                isSettings ? "text-white" : "text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                  isSettings
                    ? "bg-primary/20 ring-primary/40 text-primary"
                    : "bg-primary/15 ring-primary/25 text-primary"
                )}
              >
                <HardDrive className="w-5 h-5" aria-hidden />
              </span>
              {title}
            </h2>
            <p
              className={cn(
                "text-sm leading-relaxed max-w-2xl",
                isSettings ? "text-white/55" : "text-muted-foreground"
              )}
            >
              {description}
            </p>
          </div>
          {!filterGameId && cloudConnected && cloudEnabled ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shrink-0",
                isSettings
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200/90"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              )}
            >
              <Cloud className="w-4 h-4 shrink-0" aria-hidden />
              Google Drive backup on
            </div>
          ) : null}
        </div>

        {!loading && totals.locationCount > 0 ? (
          <SaveExplorerStatsBar
            gameCount={totals.gameCount}
            locationCount={totals.locationCount}
            totalBytes={totals.totalBytes}
            newestModified={totals.newestModified}
          />
        ) : null}
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            className={cn("h-10", isSettings && "bg-primary hover:bg-primary/90")}
            disabled={loading || isLibraryLoading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            {loading ? "Scanning…" : "Rescan saves"}
          </Button>
          {!filterGameId ? (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10",
                isSettings && "border-white/15 text-white hover:bg-white/10"
              )}
              disabled={isLibraryLoading}
              onClick={() => void scanGames().then(() => refresh())}
            >
              Scan library
            </Button>
          ) : null}
          {groups.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("h-10", isSettings && "text-white/70 hover:text-white")}
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1.5" />
                  Collapse all
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1.5" />
                  Expand all
                </>
              )}
            </Button>
          ) : null}
        </div>

        {!filterGameId ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  isSettings ? "text-white/40" : "text-muted-foreground"
                )}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games, paths…"
                className={cn(
                  "w-full h-10 pl-9 pr-3 rounded-xl border text-sm transition-colors",
                  isSettings
                    ? "border-white/15 bg-black/40 text-white placeholder:text-white/35 focus:border-primary/50"
                    : "border-border/60 bg-muted/20 focus:border-primary/40"
                )}
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SaveGroupSort)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm min-w-[10rem]",
                isSettings
                  ? "border-white/15 bg-black/40 text-white"
                  : "border-border/60 bg-muted/20"
              )}
              aria-label="Sort save groups"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!filterGameId ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by location type">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={kindFilter === f.id}
                onClick={() => setKindFilter(f.id)}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-medium transition-all duration-panel spring-ease",
                  kindFilter === f.id
                    ? isSettings
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-primary text-primary-foreground"
                    : isSettings
                      ? "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <SaveExplorerSkeleton rows={filterGameId ? 2 : 4} />
      ) : groups.length === 0 ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed px-6 py-12 text-center space-y-4",
            isSettings
              ? "border-white/15 bg-white/[0.03]"
              : "border-border/60 bg-muted/10"
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-1",
              isSettings ? "bg-white/5 ring-white/10" : "bg-muted/30 ring-border/50"
            )}
          >
            <Sparkles
              className={cn("w-8 h-8", isSettings ? "text-white/30" : "text-muted-foreground/50")}
              aria-hidden
            />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <p className={cn("text-base font-semibold", isSettings ? "text-white" : "text-foreground")}>
              No save data found
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed",
                isSettings ? "text-white/50" : "text-muted-foreground"
              )}
            >
              {filterGameId
                ? "Play the game and create a save, then rescan. Portal checks Steam userdata, Documents / My Games, and install Saved folders."
                : "Scan your library first, then rescan saves. Titles need to be in your library for paths to match."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button type="button" onClick={() => void refresh()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rescan saves
            </Button>
            {!filterGameId ? (
              <Button
                type="button"
                variant="outline"
                className={isSettings ? "border-white/15 text-white hover:bg-white/10" : undefined}
                onClick={() => void scanGames().then(() => refresh())}
              >
                Scan library
              </Button>
            ) : null}
            {!cloudConnected && !filterGameId ? (
              <Button
                type="button"
                variant="ghost"
                className={isSettings ? "text-white/70 hover:text-white" : undefined}
                onClick={() => appNavigate("/settings/game")}
              >
                <Cloud className="w-4 h-4 mr-2" />
                Set up cloud sync
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <SaveGameGroupCard
              key={g.gameId}
              group={g}
              expanded={expandedIds.has(g.gameId)}
              onToggle={() => toggleGroup(g.gameId)}
              showGameLink={!filterGameId}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
