import { useMemo } from "react";
import { RefreshCw, EyeOff, Eye } from "lucide-react";
import {
  useGameStore,
  appSubcategoryOf,
  APP_SUBCATEGORIES,
  APP_SUBCATEGORY_SYSTEM,
} from "@/stores/gameStore";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

/** Human labels for the canonical subcategory keys. */
const SUBCATEGORY_LABELS: Record<string, string> = {
  Development: "Software Development",
  Creative: "Creative",
  Productivity: "Productivity",
  Communication: "Communication",
  Browser: "Browsers",
  Utilities: "Utilities",
  System: "Computer Management",
  Other: "Other",
};

/**
 * Apps-tab toolbar: subcategory pill filter + system-tools toggle + rescan.
 * Counts come from `gamesByCategory["App"]` (all visible apps, pre subcategory filter).
 */
export function AppCategoryBar() {
  const appsAll = useGameStore((s) => s.gamesByCategory["App"] ?? []);
  const activeFilter = useGameStore((s) => s.appSubcategoryFilter);
  const showSystem = useGameStore((s) => s.showSystemApps);
  const setFilter = useGameStore((s) => s.setAppSubcategoryFilter);
  const setShowSystem = useGameStore((s) => s.setShowSystemApps);
  const scanGames = useGameStore((s) => s.scanGames);
  const isLoading = useGameStore((s) => s.isLoading);

  const { counts, total, systemCount } = useMemo(() => {
    const c: Record<string, number> = {};
    let sys = 0;
    for (const g of appsAll) {
      const sub = appSubcategoryOf(g);
      c[sub] = (c[sub] ?? 0) + 1;
      if (sub === APP_SUBCATEGORY_SYSTEM) sys += 1;
    }
    // "All" total respects the system-visibility toggle.
    const t = showSystem ? appsAll.length : appsAll.length - sys;
    return { counts: c, total: t, systemCount: sys };
  }, [appsAll, showSystem]);

  // Only render pills for subcategories that actually have apps.
  const visibleSubs = APP_SUBCATEGORIES.filter((sub) => {
    if (!counts[sub]) return false;
    if (sub === APP_SUBCATEGORY_SYSTEM && !showSystem) {
      // System pill only appears once tools are revealed.
      return false;
    }
    return true;
  });

  return (
    <div
      className={cn(
        "relative z-30 shrink-0 flex flex-col gap-2 px-6 lg:px-10 py-2.5",
        "border-b border-border/50 bg-background/85 backdrop-blur-md"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill
          label="All"
          count={total}
          active={activeFilter === null}
          onClick={() => setFilter(null)}
        />
        {visibleSubs.map((sub) => (
          <Pill
            key={sub}
            label={SUBCATEGORY_LABELS[sub] ?? sub}
            count={counts[sub] ?? 0}
            active={activeFilter === sub}
            onClick={() => setFilter(activeFilter === sub ? null : sub)}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          {systemCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant={showSystem ? "secondary" : "ghost"}
              className="rounded-xl h-8 gap-1.5 text-xs"
              onClick={() => {
                const next = !showSystem;
                setShowSystem(next);
                // Drop the System filter when hiding tools to avoid an empty view.
                if (!next && activeFilter === APP_SUBCATEGORY_SYSTEM) setFilter(null);
              }}
              title="System / management tools are hidden by default"
            >
              {showSystem ? (
                <Eye className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
              )}
              {showSystem ? "Hiding system tools" : `Show system tools (${systemCount})`}
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-xl h-8 gap-2 text-xs"
            disabled={isLoading}
            onClick={() => void scanGames()}
            title="Rescan Start Menu entries and rebuild cached icons"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} aria-hidden />
            {isLoading ? "Syncing…" : "Sync apps & icons"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function Pill({ label, count, active, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium transition-colors",
        "border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background/60 text-muted-foreground border-border/60 hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums",
          active ? "bg-primary-foreground/20" : "bg-muted/70"
        )}
      >
        {count}
      </span>
    </button>
  );
}
