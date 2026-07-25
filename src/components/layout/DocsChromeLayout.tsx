import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarRightCluster, topBarDragRegionProps } from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";

export function DocsChromeLayout() {
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
      <AmbientBackgroundLayer active={false} appearance={appearance} />

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
            <div className="flex items-center gap-2 min-w-0" {...topBarDragRegionProps(isFullscreen)}>
              <BookOpen className="w-5 h-5 text-primary shrink-0" aria-hidden />
              <div className="min-w-0" {...topBarDragRegionProps(isFullscreen)}>
                <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
                  Documentation
                </h1>
                <p className="text-[11px] text-muted-foreground truncate">
                  Setup, features, and where to change things in the app
                </p>
              </div>
            </div>
            {!isFullscreen ? (
              <div
                className="flex-1 min-h-[2.25rem] shrink-0"
                {...topBarDragRegionProps(isFullscreen)}
              />
            ) : null}
          </div>
          <TopBarRightCluster
            variant="docs"
            setShowExitModal={setShowExitModal}
            onToggleWindowSize={onToggleFullscreen}
            isFullscreen={isFullscreen}
            isMaximized={isMaximized}
            appearance={appearance}
            toggleAppearance={toggleAppearance}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto px-5 py-6 sm:px-6 sm:py-8 max-w-3xl pb-16">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
