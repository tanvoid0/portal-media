import { useEffect, useState } from "react";
import { useNavigationStore } from "@/stores/navigationStore";
import { useFocusable } from "@/hooks/useNavigationState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appNavigate } from "@/nav/appNavigate";
import { useLocation } from "react-router-dom";
import {
  BookOpen,
  Settings as SettingsIcon,
  Home,
  Power,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

/** Console-style status clock (top-right, like PS5 / SteamOS). */
export function ShellClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time
      className="px-2 text-sm font-semibold tabular-nums tracking-wide text-foreground/80 select-none shrink-0"
      aria-label="Current time"
    >
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

/** Shared right-side cluster: nav buttons, theme toggle, clock. */
export function TopBarRightCluster({
  variant,
  setShowExitModal,
  onToggleWindowSize,
  isFullscreen,
  isMaximized,
  appearance,
  toggleAppearance,
}: {
  variant: TopBarChromeVariant;
  setShowExitModal: (show: boolean) => void;
  onToggleWindowSize: () => void;
  isFullscreen: boolean;
  isMaximized: boolean;
  appearance: string;
  toggleAppearance: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <TopBarChromeButtons
        variant={variant}
        setShowExitModal={setShowExitModal}
        onToggleWindowSize={onToggleWindowSize}
        isFullscreen={isFullscreen}
        isMaximized={isMaximized}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleAppearance}
        className={cn(
          "w-11 h-11 rounded-card shrink-0",
          "transition-all duration-panel spring-ease",
          "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105"
        )}
        title={appearance === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {appearance === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </Button>
      <ShellClock />
    </div>
  );
}

export type TopBarChromeVariant = "library" | "settings" | "docs";

/** Borderless window: drag from chrome when not fullscreen (no OS title bar). */
export function topBarDragRegionProps(isFullscreen: boolean) {
  return isFullscreen ? {} : ({ "data-tauri-drag-region": true } as const);
}

export function SidebarDivider() {
  return (
    <div
      role="presentation"
      className={cn(
        "h-px w-11 shrink-0 rounded-full",
        "bg-gradient-to-r from-transparent via-foreground/12 to-transparent"
      )}
    />
  );
}

export function SidebarButton({
  index,
  isActive,
  onClick,
  icon: Icon,
  className,
  title,
}: {
  index: number;
  isActive: boolean;
  onClick: () => void;
  icon: LucideIcon;
  className?: string;
  title?: string;
}) {
  const { isFocused, showFocusIndicator } = useFocusable("sidebar", index);
  const { sidebarIndex } = useNavigationStore();
  const isFocusedItem = isFocused && sidebarIndex === index;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className={cn(
        "w-11 h-11 rounded-card",
        "transition-all duration-panel spring-ease",
        "transform-gpu",
        isActive
          ? "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-105"
          : "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105",
        isFocusedItem &&
          showFocusIndicator &&
          "ring-2 ring-primary/60 ring-offset-2 ring-offset-background animate-focus-ring",
        className
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 transition-all duration-panel-fast spring-ease",
          (isActive || isFocusedItem) && "scale-105"
        )}
      />
    </Button>
  );
}

export function TopBarChromeButtons({
  variant,
  setShowExitModal,
  onToggleWindowSize,
  isFullscreen,
  isMaximized,
}: {
  variant: TopBarChromeVariant;
  setShowExitModal: (show: boolean) => void;
  onToggleWindowSize: () => void;
  isFullscreen: boolean;
  isMaximized: boolean;
}) {
  const { pathname } = useLocation();
  const libraryActive =
    pathname.startsWith("/library") ||
    pathname.startsWith("/game/") ||
    pathname.startsWith("/tmdb/") ||
    pathname.startsWith("/igdb/");

  if (variant === "library") {
    return (
      <>
        <SidebarButton
          index={0}
          isActive={libraryActive}
          onClick={() => appNavigate("/library/all")}
          icon={Home}
          title="Library"
        />
        <SidebarButton
          index={1}
          isActive={false}
          onClick={() => appNavigate("/docs")}
          icon={BookOpen}
          title="Documentation"
        />
        <SidebarButton
          index={2}
          isActive={false}
          onClick={() => appNavigate("/settings/game")}
          icon={SettingsIcon}
          title="Settings"
        />
        <SidebarButton
          index={3}
          isActive={isFullscreen}
          onClick={onToggleWindowSize}
          icon={isFullscreen ? Minimize2 : Maximize2}
          title={
            isFullscreen
              ? "Exit fullscreen"
              : isMaximized
                ? "Big Picture — hide taskbar (fullscreen)"
                : "Big Picture — fullscreen (hides taskbar)"
          }
        />
        <SidebarButton
          index={4}
          isActive={false}
          onClick={() => setShowExitModal(true)}
          icon={Power}
          title="Exit"
          className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        />
      </>
    );
  }

  if (variant === "settings") {
    return (
      <>
        <SidebarButton
          index={0}
          isActive={true}
          onClick={() => appNavigate("/settings/game")}
          icon={SettingsIcon}
          title="Settings"
        />
        <SidebarButton
          index={1}
          isActive={false}
          onClick={() => appNavigate("/library/all")}
          icon={Home}
          title="Library"
        />
        <SidebarButton
          index={2}
          isActive={false}
          onClick={() => appNavigate("/docs")}
          icon={BookOpen}
          title="Documentation"
        />
        <SidebarButton
          index={3}
          isActive={isFullscreen}
          onClick={onToggleWindowSize}
          icon={isFullscreen ? Minimize2 : Maximize2}
          title={
            isFullscreen
              ? "Exit fullscreen"
              : isMaximized
                ? "Big Picture — hide taskbar (fullscreen)"
                : "Big Picture — fullscreen (hides taskbar)"
          }
        />
        <SidebarButton
          index={4}
          isActive={false}
          onClick={() => setShowExitModal(true)}
          icon={Power}
          title="Exit"
          className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        />
      </>
    );
  }

  // docs
  return (
    <>
      <SidebarButton
        index={0}
        isActive={true}
        onClick={() => appNavigate("/docs")}
        icon={BookOpen}
        title="Documentation"
      />
      <SidebarButton
        index={1}
        isActive={false}
        onClick={() => appNavigate("/library/all")}
        icon={Home}
        title="Library"
      />
      <SidebarButton
        index={2}
        isActive={false}
        onClick={() => appNavigate("/settings/game")}
        icon={SettingsIcon}
        title="Settings"
      />
      <SidebarButton
        index={3}
        isActive={isFullscreen}
        onClick={onToggleWindowSize}
        icon={isFullscreen ? Minimize2 : Maximize2}
        title={
          isFullscreen
            ? "Exit fullscreen"
            : isMaximized
              ? "Big Picture — hide taskbar (fullscreen)"
              : "Big Picture — fullscreen (hides taskbar)"
        }
      />
      <SidebarButton
        index={4}
        isActive={false}
        onClick={() => setShowExitModal(true)}
        icon={Power}
        title="Exit"
        className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
      />
    </>
  );
}

export { Home };
