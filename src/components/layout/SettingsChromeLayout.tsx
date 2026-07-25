import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { cn } from "@/lib/utils";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarRightCluster, topBarDragRegionProps } from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";
import { SettingsSectionTabs } from "./SettingsSectionTabs";

export function SettingsChromeLayout() {
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
            {!isFullscreen ? (
              <div
                className="flex-1 min-h-[2.25rem] shrink-0"
                {...topBarDragRegionProps(isFullscreen)}
              />
            ) : null}
          </div>
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

        <div className="border-t border-border/40 px-4 lg:px-6 pb-2 pt-1">
          <SettingsSectionTabs />
        </div>
      </header>

      <SettingsLayout />
    </div>
  );
}
