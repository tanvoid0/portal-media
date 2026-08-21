import { Outlet, useLocation } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { FavoritesFilter } from "@/components/FavoritesFilter";
import { SortFilter } from "@/components/SortFilter";
import { CategoryFilter } from "@/components/CategoryFilter";
import { cn } from "@/lib/utils";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarRightCluster, topBarDragRegionProps } from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";
import { FunctionDeck } from "./FunctionDeck";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";

function showLibrarySubnav(pathname: string) {
  return pathname.startsWith("/library/");
}

export function LibraryChromeLayout() {
  const { pathname } = useLocation();
  const {
    appearance,
    toggleAppearance,
    setShowExitModal,
    isMaximized,
    isFullscreen,
    onToggleFullscreen,
  } = useShellChrome();
  const findOpen = useShellOverlayStore((s) => s.searchPopoverOpen);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
      <AmbientBackgroundLayer active appearance={appearance} />

      <header className="shrink-0 z-20 border-b border-border">
        <div
          className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6 min-h-[6.25rem]",
            !isFullscreen && "cursor-default"
          )}
        >
          <div className="min-h-[2.25rem]" {...topBarDragRegionProps(isFullscreen)} />
          <FunctionDeck findOpen={findOpen} />
          <div className="flex items-center justify-end gap-1 min-w-0">
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

        {showLibrarySubnav(pathname) ? (
          <div className="flex items-center gap-2 border-t border-border px-4 py-1 lg:px-6">
            <CategoryFilter orientation="horizontal" embedded />
            <div className="h-6 w-px shrink-0 bg-border" aria-hidden />
            <FavoritesFilter />
            <div className="flex-1 min-w-0" />
            <SortFilter className="px-0 pb-0 min-w-0" />
          </div>
        ) : null}
      </header>

      <SearchBar variant="overlay" />

      <div key={pathname} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
