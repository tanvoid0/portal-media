import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";
import { useShellChrome } from "@/context/ShellChromeContext";
import { TopBarChromeButtons } from "./shellChrome";
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
            "cursor-default"
          )}
        >
          <div
            className={cn("flex-1 min-w-0 min-h-[2.25rem] flex items-center gap-3", "cursor-default")}
            data-tauri-drag-region
          >
            <div className="flex-1 min-h-[2.25rem] shrink-0" data-tauri-drag-region />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TopBarChromeButtons
              variant="settings"
              setShowExitModal={setShowExitModal}
              onToggleWindowSize={onToggleFullscreen}
              isFullscreen={isFullscreen}
              isMaximized={isMaximized}
            />
            <div className="h-9 w-px shrink-0 bg-border mx-0.5" aria-hidden />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleAppearance}
              className={cn(
                "w-14 h-14 rounded-card shrink-0",
                "transition-all duration-panel spring-ease",
                "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105"
              )}
              title={appearance === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {appearance === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="border-t border-border/40 px-4 lg:px-6 pb-2 pt-1">
          <SettingsSectionTabs />
        </div>
      </header>

      <SettingsLayout />
    </div>
  );
}
