import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { DetailsFocusControl } from "@/components/details/DetailsFocusControl";
import type { Game } from "@/types/game";
import type { SaveBundle } from "@/types/saveSync";
import { saveSyncDiscoverForGame } from "@/utils/saveSyncApi";
import { useSaveSyncStore } from "@/stores/saveSyncStore";
import { SaveBundleListItem } from "@/components/saves/SaveBundleListItem";
import { SaveLocationKindIcon } from "@/components/saves/SaveLocationKindIcon";
import {
  formatSaveBytes,
  formatSaveModifiedRelative,
  groupTotalBytes,
  saveLocationKind,
} from "@/utils/saveBundleDisplay";
import { appNavigate } from "@/nav/appNavigate";
import { Cloud, HardDrive, Loader2, Sparkles } from "lucide-react";
import { toastInvokeCatch } from "@/utils/invokeError";
import { cn } from "@/lib/utils";

const PREVIEW_MAX = 2;

export function GameSaveDataSection({ game }: { game: Game }) {
  const [bundles, setBundles] = useState<SaveBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const syncStatus = useSaveSyncStore((s) => s.status);

  const load = useCallback(async () => {
    if (!isTauri() || game.launch_type === "Url") {
      setBundles([]);
      return;
    }
    setLoading(true);
    try {
      const found = await saveSyncDiscoverForGame(game.id);
      setBundles(found);
    } catch (e) {
      toastInvokeCatch("Could not load save locations", e);
      setBundles([]);
    } finally {
      setLoading(false);
    }
  }, [game.id, game.launch_type]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalBytes = useMemo(() => groupTotalBytes({ gameId: game.id, gameName: game.name, platform: game.platform, bundles }), [bundles, game]);
  const newest = useMemo(
    () => bundles.reduce((m, b) => Math.max(m, b.modifiedUtc), 0),
    [bundles]
  );
  const kinds = useMemo(() => [...new Set(bundles.map((b) => saveLocationKind(b)))], [bundles]);

  if (game.launch_type === "Url") return null;

  const preview = bundles.slice(0, PREVIEW_MAX);
  const hasMore = bundles.length > PREVIEW_MAX;
  const showCloudHint = !syncStatus?.connected || !syncStatus?.config.enabled;

  return (
    <section
      className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/15 to-muted/5 overflow-hidden shadow-sm"
      aria-label="Save data"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 sm:px-3 border-b border-border/40 bg-muted/20">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-primary/80" aria-hidden />
          Save data
        </span>
        {bundles.length > 0 && !loading ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {bundles.length} · {formatSaveBytes(totalBytes)}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground hover:text-foreground -mr-1"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="px-2.5 py-2.5 sm:px-3 sm:py-3 space-y-3">
        {loading && bundles.length === 0 ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-14 rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-14 rounded-xl bg-muted/30 animate-pulse" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex gap-3 rounded-xl border border-dashed border-border/50 bg-muted/10 px-3 py-3">
            <Sparkles className="w-5 h-5 shrink-0 text-muted-foreground/40 mt-0.5" aria-hidden />
            <p className="text-xs text-muted-foreground leading-relaxed">
              No saves detected yet. After you play and save, hit Refresh — Portal scans Steam, Documents,
              and install folders.
            </p>
          </div>
        ) : (
          <>
            {kinds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {kinds.map((k) => (
                  <SaveLocationKindIcon key={k} kind={k} size="sm" showLabel />
                ))}
                {newest > 0 ? (
                  <span className="text-[10px] text-muted-foreground self-center ml-1">
                    Latest {formatSaveModifiedRelative(newest)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <ul className="space-y-2">
              {preview.map((b) => (
                <SaveBundleListItem key={b.bundleId} bundle={b} showGameLink={false} compact />
              ))}
            </ul>
          </>
        )}

        {showCloudHint && bundles.length > 0 ? (
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2",
              "text-left text-[11px] text-primary/90 hover:bg-primary/10 transition-colors"
            )}
            onClick={() => appNavigate("/settings/game")}
          >
            <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Back up these saves to Google Drive — set up cloud sync
          </button>
        ) : null}

        <DetailsFocusControl index={8} className="block">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 rounded-lg justify-center text-xs gap-1.5 border-primary/25 hover:bg-primary/10 hover:border-primary/40"
            onClick={() => appNavigate(`/game/${encodeURIComponent(game.id)}/saves`)}
          >
            <HardDrive className="w-3.5 h-3.5" aria-hidden />
            {bundles.length > 0
              ? hasMore
                ? `Explore all ${bundles.length} save locations`
                : "Open save explorer"
              : "Save data explorer"}
          </Button>
        </DetailsFocusControl>
      </div>
    </section>
  );
}
