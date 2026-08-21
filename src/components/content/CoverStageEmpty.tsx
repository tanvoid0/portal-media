import { Button } from "@/components/ui/button";
import {
  LIBRARY_COVER_ASPECT_CLASS,
  LIBRARY_COVER_WIDTH_CLASS,
} from "@/components/content/ShelfCard";
import { LIBRARY_GAMES_GRID_PRESET, buildContentGridContainerClassName, contentGridTemplateColumnsStyle } from "@/config/contentGridPresets";
import { cn } from "@/lib/utils";

const GHOST_COUNT = 6;

/** Empty library still occupies the cover wall — same composition as a populated hub. */
export function CoverStageEmpty({
  isSearch,
  searchQuery,
  onScan,
  onSettings,
}: {
  isSearch: boolean;
  searchQuery: string;
  onScan: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={buildContentGridContainerClassName(LIBRARY_GAMES_GRID_PRESET)}
        style={contentGridTemplateColumnsStyle(LIBRARY_GAMES_GRID_PRESET)}
        aria-hidden
      >
        {Array.from({ length: GHOST_COUNT }, (_, i) => (
          <div key={i} className={cn(LIBRARY_COVER_WIDTH_CLASS, "flex flex-col gap-3")}>
            <div
              className={cn(
                LIBRARY_COVER_ASPECT_CLASS,
                "w-full bg-muted/40",
                "border-2",
                i === 0 && !isSearch ? "border-[3px] border-primary" : "border-border"
              )}
            />
            <div className="mx-auto h-3 w-2/3 bg-muted" />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-background px-10 py-6">
        <div className="flex max-w-xl flex-col gap-3">
          <p className="text-xl font-semibold text-foreground">
            {isSearch ? "No results" : "Your library is empty"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isSearch
              ? `Nothing matched “${searchQuery}”. Try a different search.`
              : "Scan this PC for installed games and apps, or add titles manually in Settings."}
          </p>
          {!isSearch ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" className="min-w-[9rem] rounded-none" autoFocus onClick={onScan}>
                Scan this PC
              </Button>
              <Button type="button" variant="outline" className="min-w-[9rem] rounded-none" onClick={onSettings}>
                Open Settings
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
