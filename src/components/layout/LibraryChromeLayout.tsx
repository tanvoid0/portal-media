import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { FavoritesFilter } from "@/components/FavoritesFilter";
import { SortFilter } from "@/components/SortFilter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Music2 } from "lucide-react";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarRightCluster, topBarDragRegionProps } from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";

export function LibraryChromeLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    appearance,
    toggleAppearance,
    setShowExitModal,
    isMaximized,
    isFullscreen,
    onToggleFullscreen,
  } = useShellChrome();

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <AmbientBackgroundLayer active appearance={appearance} />

      <header className={cn("shrink-0 z-20 border-b border-border/60")}>
        <div
          className={cn(
            "flex items-center gap-4 px-6 lg:px-8 pt-3 pb-2 min-h-[3.25rem]",
            !isFullscreen && "cursor-default"
          )}
        >
          <div
            className={cn(
              "flex-1 min-w-0 min-h-[2.25rem] flex items-center gap-3",
              !isFullscreen && "cursor-default"
            )}
            {...topBarDragRegionProps(isFullscreen)}
          >
            <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="History">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(-1)}
                aria-label="Back"
                title="Back"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(1)}
                aria-label="Forward"
                title="Forward"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="h-9 w-px shrink-0 bg-border/70" aria-hidden />
            <FavoritesFilter />
            <div className="h-9 w-px shrink-0 bg-border/70" aria-hidden />
            <SortFilter
              className={cn("px-0 pb-0 min-w-0", isFullscreen && "flex-1")}
            />
            {!isFullscreen ? (
              <div
                className="flex-1 min-h-[2.25rem] shrink-0"
                {...topBarDragRegionProps(isFullscreen)}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/spotify")}
              className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              title="Open Spotify"
            >
              <Music2 className="w-4 h-4" />
            </Button>
            <SearchBar variant="compact" compactPopupSide="right" />
            <div className="h-9 w-px shrink-0 bg-border/50" aria-hidden />
            <TopBarRightCluster
              variant="library"
              setShowExitModal={setShowExitModal}
              onToggleWindowSize={onToggleFullscreen}
              isFullscreen={isFullscreen}
              isMaximized={isMaximized}
              appearance={appearance}
              toggleAppearance={toggleAppearance}
            />
          </div>
        </div>

        <div className="border-t border-border/40 px-4 lg:px-6 pb-2 pt-1">
          <CategoryFilter orientation="horizontal" embedded />
        </div>
      </header>

      <div key={pathname} className="flex-1 min-h-0 flex flex-col overflow-hidden animate-page-in">
        <Outlet />
      </div>
    </div>
  );
}
