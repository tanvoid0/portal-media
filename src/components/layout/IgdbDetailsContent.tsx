import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "@/stores/navigationStore";
import { useBrowserStore } from "@/stores/browserStore";
import { useIntegrationsStore } from "@/stores/integrationsStore";
import { EXECUTE_IGDB_DETAILS_ACTION } from "@/navigation/universalNavCore";
import type { IgdbFetchResult, IgdbGamePayload } from "@/types/metadata";
import { isValidImageSource } from "@/utils/imageUtils";
import { appNavigate } from "@/nav/appNavigate";
import { Button } from "@/components/ui/button";
import { DetailsFocusControl } from "@/components/details/DetailsFocusControl";
import { DetailsHeroFrame } from "@/components/layout/DetailsHeroFrame";
import { DetailsPageShell } from "@/components/layout/DetailsPageShell";
import { IgdbPayloadPanel } from "@/components/details/IgdbPayloadPanel";
import { cn } from "@/lib/utils";
import { displayLabelForExternalUrl } from "@/utils/linkBrandFromUrl";
import { ExternalLinkGlyph } from "@/components/content/ExternalLinkGlyph";
import { Loader2 } from "lucide-react";

type BrowseAction =
  | { kind: "browser"; url: string; label: string }
  | { kind: "settings"; label: string }
  | { kind: "discover"; label: string };

type GamePanelState =
  | { kind: "loading" }
  | { kind: "gate"; message: string }
  | { kind: "note"; message: string }
  | { kind: "ok"; payload: IgdbGamePayload };

export function IgdbDetailsContent({ igdbId }: { igdbId: number }) {
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<GamePanelState>({ kind: "loading" });
  const openBrowser = useBrowserStore((s) => s.openBrowser);
  const setDetailsMaxIndex = useNavigationStore((s) => s.setDetailsMaxIndex);
  const setDetailsIndex = useNavigationStore((s) => s.setDetailsIndex);
  const refreshStatus = useIntegrationsStore((s) => s.refreshStatus);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    setPanel({ kind: "loading" });
    void invoke<IgdbFetchResult>("metadata_fetch_igdb_by_id", { igdbId }).then((r) => {
      if (cancelled) return;
      if (r.kind === "cached" || r.kind === "fresh") {
        setPanel({ kind: "ok", payload: r.payload });
        return;
      }
      if (r.kind === "notConfigured") {
        setPanel({
          kind: "gate",
          message:
            "IGDB is not configured. Open Settings → Metadata & APIs to add your Twitch Client ID and Secret.",
        });
        return;
      }
      if (r.kind === "notFound") {
        setPanel({
          kind: "note",
          message: "This game was not found on IGDB (it may have been removed).",
        });
        return;
      }
      if (r.kind === "skipped") {
        setPanel({ kind: "note", message: r.reason });
        return;
      }
      if (r.kind === "error") {
        setPanel({ kind: "note", message: r.message });
        return;
      }
      setPanel({ kind: "note", message: "Unexpected response from IGDB." });
    });
    return () => {
      cancelled = true;
    };
  }, [igdbId]);

  const actions = useMemo((): BrowseAction[] => {
    if (panel.kind === "gate") {
      return [{ kind: "settings", label: "Open metadata settings" }];
    }
    if (panel.kind === "note") {
      return [{ kind: "discover", label: "Back to Discover" }];
    }
    if (panel.kind !== "ok") return [];
    const p = panel.payload;
    const base = `https://www.igdb.com/games/${igdbId}`;
    const out: BrowseAction[] = [{ kind: "browser", url: base, label: "Open IGDB game page" }];
    for (const w of p.websiteLinks.slice(0, 10)) {
      out.push({ kind: "browser", url: w.url, label: w.label });
    }
    return out;
  }, [panel, igdbId]);

  useEffect(() => {
    const max = Math.max(0, actions.length - 1);
    setDetailsMaxIndex(max);
    setDetailsIndex(0);
  }, [actions.length, setDetailsIndex, setDetailsMaxIndex]);

  useEffect(() => {
    const onExecute = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      const a = actions[idx];
      if (!a) return;
      if (a.kind === "browser") openBrowser(a.url);
      if (a.kind === "settings") appNavigate("/settings/api");
      if (a.kind === "discover") appNavigate("/library/discover");
    };
    window.addEventListener(EXECUTE_IGDB_DETAILS_ACTION, onExecute as EventListener);
    return () => window.removeEventListener(EXECUTE_IGDB_DETAILS_ACTION, onExecute as EventListener);
  }, [actions, openBrowser]);

  if (panel.kind === "loading") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-card/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading game details…</p>
      </div>
    );
  }

  if (panel.kind === "gate") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/50 gap-4 max-w-md mx-auto">
        <p className="text-sm text-foreground/90 leading-relaxed">{panel.message}</p>
        <DetailsFocusControl index={0} className="w-full max-w-xs">
          <Button type="button" className="w-full rounded-xl" onClick={() => appNavigate("/settings/api")}>
            Open metadata settings
          </Button>
        </DetailsFocusControl>
      </div>
    );
  }

  if (panel.kind === "note") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/50 gap-4 max-w-md mx-auto">
        <p className="text-destructive font-medium">Could not load this game</p>
        <p className="text-sm text-muted-foreground max-w-sm">{panel.message}</p>
        <DetailsFocusControl index={0} className="w-full max-w-xs">
          <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => appNavigate("/library/discover")}>
            Back to Discover
          </Button>
        </DetailsFocusControl>
        <p className="text-[10px] text-muted-foreground/80">Enter activates · Escape also returns to Discover</p>
      </div>
    );
  }

  const p = panel.payload;
  const heroSrc = isValidImageSource(p.coverUrl ?? null) ? p.coverUrl : null;

  const mainColumn = (
    <div
      className={cn(
        "space-y-3.5 w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-5"
      )}
    >
      <header className="space-y-2">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight pr-2">{p.name}</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Discover · IGDB
          {p.releaseDate ? ` · ${p.releaseDate}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Not in your library — browse metadata and official links only.
        </p>
      </header>

      <section className="rounded-xl border border-border/50 bg-muted/15 p-2.5 sm:p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Links</p>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Opens in the built-in browser. Icons match the site when we recognize the URL.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {actions
            .filter((a): a is Extract<BrowseAction, { kind: "browser" }> => a.kind === "browser")
            .map((a, index) => {
              const label = displayLabelForExternalUrl(a.url, a.label);
              return (
                <DetailsFocusControl key={`${a.url}-${index}`} index={index} className="inline-flex min-w-0 max-w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    title={a.url}
                    className={cn(
                      "h-8 sm:h-9 rounded-lg gap-1.5 px-2 sm:px-2.5 border-border/60 shrink-0",
                      "max-w-[calc(50%-0.1875rem)] sm:max-w-[11.5rem]"
                    )}
                    onClick={() => openBrowser(a.url)}
                  >
                    <ExternalLinkGlyph url={a.url} labelHint={a.label} size="sm" />
                    <span className="text-left font-medium text-[11px] sm:text-xs truncate">{label}</span>
                  </Button>
                </DetailsFocusControl>
              );
            })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-0.5">
          Metadata
        </p>
        <IgdbPayloadPanel payload={p} websiteLinksMode="hidden" />
      </section>

      <p className="text-[10px] text-muted-foreground/80 text-center pb-2 pt-1">
        Escape · back to Discover · Enter opens the highlighted link in the browser panel
      </p>
    </div>
  );

  return (
    <DetailsPageShell
      scrollRef={pageScrollRef}
      scrollResetKey={`igdb-${igdbId}`}
      ariaLabel="Game details"
    >
      <DetailsHeroFrame variant="page" imageSrc={heroSrc} fallback="🎮" />
      {mainColumn}
    </DetailsPageShell>
  );
}
