import { useNavigationStore } from "@/stores/navigationStore";
import { useFocusable } from "@/hooks/useNavigationState";
import type { AppView } from "@/types/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  Home,
  Power,
  Maximize2,
  Minimize2,
  type LucideIcon,
} from "lucide-react";

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
        "w-14 h-14 rounded-2xl",
        "transition-all duration-ps5 spring-ease",
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
          "w-6 h-6 transition-all duration-ps5-fast spring-ease",
          (isActive || isFocusedItem) && "scale-105"
        )}
      />
    </Button>
  );
}

export function TopBarChromeButtons({
  currentView,
  setCurrentView,
  setShowExitModal,
  onToggleWindowSize,
  isFullscreen,
  isMaximized,
}: {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  setShowExitModal: (show: boolean) => void;
  onToggleWindowSize: () => void;
  isFullscreen: boolean;
  isMaximized: boolean;
}) {
  return (
    <>
      <SidebarButton
        index={1}
        isActive={currentView === "settings"}
        onClick={() => setCurrentView("settings")}
        icon={SettingsIcon}
        title="Settings"
      />
      <SidebarButton
        index={2}
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
        index={3}
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
