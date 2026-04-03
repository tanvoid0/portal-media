import { useNavigationStore } from "@/stores/navigationStore";
import { useFocusable } from "@/hooks/useNavigationState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appNavigate } from "@/nav/appNavigate";
import { useLocation } from "react-router-dom";

export type TopBarChromeVariant = "library" | "settings";
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
        "w-14 h-14 rounded-card",
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
  const onLibrarySurface = variant === "library";

  return (
    <>
      {onLibrarySurface ? (
        <SidebarButton
          index={0}
          isActive={
            pathname.startsWith("/library") ||
            pathname.startsWith("/game/") ||
            pathname.startsWith("/tmdb/")
          }
          onClick={() => appNavigate("/library/all")}
          icon={Home}
          title="Library"
        />
      ) : null}
      <SidebarButton
        index={1}
        isActive={false}
        onClick={() =>
          variant === "settings" ? appNavigate("/library/all") : appNavigate("/settings/game")
        }
        icon={variant === "settings" ? Home : SettingsIcon}
        title={variant === "settings" ? "Library" : "Settings"}
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
