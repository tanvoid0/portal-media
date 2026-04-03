import type { Dispatch, SetStateAction } from "react";
import type { ThemeAppearance } from "@/types/theme";
import type { AppView } from "@/types/app";
import { GameGrid } from "@/components/GameGrid";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar";
import { Navigation } from "@/components/Navigation";
import { Settings } from "@/components/Settings";
import { BookmarkManager } from "@/components/BookmarkManager";
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
import {
  SidebarDivider,
  SidebarButton,
  TopBarChromeButtons,
  Home,
} from "./shellChrome";
import { AmbientBackgroundLayer } from "./AmbientBackgroundLayer";

export interface AppShellProps {
  currentView: AppView;
  setCurrentView: Dispatch<SetStateAction<AppView>>;
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
  currentView,
  setCurrentView,
  showExitModal,
  setShowExitModal,
  appearance,
  toggleAppearance,
  isMaximized,
  isFullscreen,
  onToggleFullscreen,
  onConfirmExit,
}: AppShellProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="fixed inset-0 bg-background z-0" />
      <AmbientBackgroundLayer active={currentView === "games"} appearance={appearance} />

      <Navigation />

      <div className="flex h-screen">
        <div className="w-20 flex-shrink-0 glass-ultra border-r border-border/80 flex flex-col items-center py-6 gap-3 z-50">
          <div
            className="w-full shrink-0 h-3 rounded-md cursor-default"
            data-tauri-drag-region
            aria-hidden
          />
          <SidebarDivider />
          {currentView === "games" && (
            <div className="flex flex-col items-center gap-3 w-full">
              <CategoryFilter orientation="compact" />
            </div>
          )}
          {currentView === "games" && <SidebarDivider />}
          <div className="flex-1 min-h-2" />
          <SidebarButton
            index={0}
            isActive={currentView === "games"}
            onClick={() => setCurrentView("games")}
            icon={Home}
            title="Library"
          />
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
                currentView === "settings" && "cursor-default"
              )}
              {...(currentView === "settings"
                ? { "data-tauri-drag-region": true as const }
                : {})}
            >
              {currentView === "games" && (
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <FavoritesFilter />
                  <div className="h-9 w-px shrink-0 bg-border/70" aria-hidden />
                  <SortFilter className="px-0 pb-0 min-w-0" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {currentView === "games" && (
                <>
                  <SearchBar variant="compact" compactPopupSide="right" />
                  <div className="h-9 w-px shrink-0 bg-border" aria-hidden />
                </>
              )}
              <TopBarChromeButtons
                currentView={currentView}
                setCurrentView={setCurrentView}
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
                {appearance === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>
            </div>
          </header>

          {currentView === "games" && (
            <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
              <div className="flex-1 min-h-0 flex overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden relative">
                  <GameGrid />
                </div>
                <GameDetailsSidebar />
              </div>
            </div>
          )}

          {currentView === "settings" && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="container mx-auto p-8 space-y-8 max-w-5xl">
                <Settings />
                <BookmarkManager />
              </div>
            </div>
          )}
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
