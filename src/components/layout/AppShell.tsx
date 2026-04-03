import type { ThemeAppearance } from "@/types/theme";
import { Navigation } from "@/components/Navigation";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { FavoritesFilter } from "@/components/FavoritesFilter";
import { SortFilter } from "@/components/SortFilter";
import { ExitModal } from "@/components/ExitModal";
import { BrowserView } from "@/components/BrowserView";
import { BrowserMinimized } from "@/components/BrowserMinimized";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import {
  SidebarDivider,
  SidebarButton,
  TopBarChromeButtons,
  Home,
} from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";
import { SettingsSectionRail } from "./SettingsSectionRail";
import { appNavigate } from "@/nav/appNavigate";

export interface AppShellProps {
  showExitModal: boolean;
  setShowExitModal: (open: boolean) => void;
  appearance: ThemeAppearance;
  toggleAppearance: () => void;
  isMaximized: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onConfirmExit: () => void;
}

export function AppShell({
  showExitModal,
  setShowExitModal,
  appearance,
  toggleAppearance,
  isMaximized,
  isFullscreen,
  onToggleFullscreen,
  onConfirmExit,
}: AppShellProps) {
  const { pathname } = useLocation();
  const isSettingsRoute = pathname.startsWith("/settings");
  const isLibrary = !isSettingsRoute;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="fixed inset-0 bg-background z-0" />
      <AmbientBackgroundLayer active={isLibrary} appearance={appearance} />

      <Navigation />

      <div className="flex h-screen">
        <div className="w-20 flex-shrink-0 glass-ultra border-r border-border/80 flex flex-col items-center py-6 gap-3 z-50">
          <div
            className="w-full shrink-0 h-3 rounded-md cursor-default"
            data-tauri-drag-region
            aria-hidden
          />
          <SidebarDivider />
          {isLibrary && (
            <div className="flex flex-col items-center gap-3 w-full">
              <CategoryFilter orientation="compact" />
            </div>
          )}
          {isLibrary && <SidebarDivider />}
          <div className="flex-1 min-h-2" />
          {isSettingsRoute ? (
            <SettingsSectionRail />
          ) : (
            <SidebarButton
              index={0}
              isActive={isLibrary}
              onClick={() => appNavigate("/")}
              icon={Home}
              title="Library"
            />
          )}
          <div className="flex-1 min-h-2" />
        </div>

        <div className="flex-1 relative z-10 overflow-hidden flex flex-col min-h-0">
          <header
            className={cn(
              "flex items-center gap-4 shrink-0 pb-3 px-8 z-20",
              "border-b border-border/60"
            )}
          >
            <div
              className={cn(
                "flex-1 min-w-0 min-h-[2.25rem] flex items-center",
                isSettingsRoute && "cursor-default"
              )}
              {...(isSettingsRoute ? { "data-tauri-drag-region": true as const } : {})}
            >
              {isLibrary && (
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <FavoritesFilter />
                  <div className="h-9 w-px shrink-0 bg-border/70" aria-hidden />
                  <SortFilter className="px-0 pb-0 min-w-0" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isLibrary && (
                <>
                  <SearchBar variant="compact" compactPopupSide="right" />
                  <div className="h-9 w-px shrink-0 bg-border" aria-hidden />
                </>
              )}
              <TopBarChromeButtons
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
                  "w-14 h-14 rounded-2xl shrink-0",
                  "transition-all duration-ps5 spring-ease",
                  "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105"
                )}
                title={appearance === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {appearance === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </header>

          <Outlet />
        </div>
      </div>

      <ExitModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={onConfirmExit}
      />

      <BrowserView />
      <BrowserMinimized />
      <Toaster />
    </div>
  );
}
