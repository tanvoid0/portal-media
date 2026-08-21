import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarRightCluster, topBarDragRegionProps } from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";
import { SettingsSectionTabs } from "./SettingsSectionTabs";
import { FunctionDeck } from "./FunctionDeck";
import { SearchBar } from "@/components/SearchBar";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";

export function SettingsChromeLayout() {
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
      <AmbientBackgroundLayer active={false} appearance={appearance} />

      <header className="shrink-0 z-20 border-b border-border">
        <div
          className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6 min-h-[6.25rem]",
            !isFullscreen && "cursor-default"
          )}
        >
          <div
            className="min-h-[2.25rem]"
            {...topBarDragRegionProps(isFullscreen)}
          />
          <FunctionDeck findOpen={findOpen} />
          <div className="flex items-center justify-end">
            <TopBarRightCluster
              variant="settings"
              setShowExitModal={setShowExitModal}
              onToggleWindowSize={onToggleFullscreen}
              isFullscreen={isFullscreen}
              isMaximized={isMaximized}
              appearance={appearance}
              toggleAppearance={toggleAppearance}
            />
          </div>
        </div>

        <div className="border-t border-border px-4 lg:px-6 py-1.5">
          <SettingsSectionTabs />
        </div>
      </header>

      <SearchBar variant="overlay" />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
