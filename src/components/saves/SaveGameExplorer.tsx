import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { FrameKey } from "@/components/ui/frame-key";
import { Input, nativeSelectClassName } from "@/components/ui/input";
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
import { ChevronDown, ChevronUp, Cloud, HardDrive, RefreshCw, Search } from "lucide-react";
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {!isSettings ? (
            <div className="min-w-0 space-y-2">
              <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                <HardDrive className="h-5 w-5" aria-hidden />
                {title}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ) : (
            <div className="min-w-0" />
          )}
          {!filterGameId && cloudConnected && cloudEnabled ? (
            <div className="flex shrink-0 items-center gap-2 rounded-none border border-border px-3 py-2 text-xs text-foreground">
              <Cloud className="h-4 w-4 shrink-0" aria-hidden />
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="h-10 rounded-none"
            disabled={loading || isLibraryLoading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {loading ? "Scanning…" : "Rescan saves"}
          </Button>
          {!filterGameId ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-none"
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
              className="h-10 rounded-none"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="mr-1.5 h-4 w-4" />
                  Collapse all
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1.5 h-4 w-4" />
                  Expand all
                </>
              )}
            </Button>
          ) : null}
        </div>

        {!filterGameId ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative max-w-md flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games, paths…"
                className="pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SaveGroupSort)}
              className={cn(nativeSelectClassName, "min-w-[10rem]")}
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
              <FrameKey
                key={f.id}
                size="sm"
                role="tab"
                aria-selected={kindFilter === f.id}
                active={kindFilter === f.id}
                onClick={() => setKindFilter(f.id)}
              >
                {f.label}
              </FrameKey>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <SaveExplorerSkeleton rows={filterGameId ? 2 : 4} />
      ) : groups.length === 0 ? (
        <div className="space-y-4 rounded-none border border-dashed border-border px-6 py-12 text-center">
          <HardDrive className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <div className="mx-auto max-w-md space-y-2">
            <p className="text-base font-semibold text-foreground">No save data found</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {filterGameId
                ? "Play the game and create a save, then rescan. Portal checks Steam userdata, Documents / My Games, and install Saved folders."
                : "Scan your library first, then rescan saves. Titles need to be in your library for paths to match."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button type="button" className="rounded-none" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Rescan saves
            </Button>
            {!filterGameId ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => void scanGames().then(() => refresh())}
              >
                Scan library
              </Button>
            ) : null}
            {!cloudConnected && !filterGameId ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-none"
                onClick={() => appNavigate("/settings/game")}
              >
                <Cloud className="mr-2 h-4 w-4" />
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
