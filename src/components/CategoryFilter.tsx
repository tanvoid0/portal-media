import { useGameStore } from "@/stores/gameStore";
import { DISCOVER_CATEGORY_ID } from "@/types/game";
import { useFocusable } from "@/hooks/useNavigationState";
import { useNavigationStore } from "@/stores/navigationStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clapperboard, Gamepad2, Monitor, Film, LayoutGrid, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import * as React from "react";
import { CATEGORY_NAV_ORDER, SIDEBAR_CATEGORY_NAV_ORDER } from "@/constants/categoryNav";
import { appNavigate } from "@/nav/appNavigate";
import { libraryPathForCategory } from "@/nav/libraryRoutes";

const SIDEBAR_ICONS: LucideIcon[] = [LayoutGrid, Gamepad2, Monitor, Film, Clapperboard];

const sidebarCategories = SIDEBAR_CATEGORY_NAV_ORDER.map((c, i) => ({
  ...c,
  icon: SIDEBAR_ICONS[i],
}));

function CategoryButton({ 
  category, 
  index, 
  isSelected, 
  count, 
  onSelect,
  compact = false,
}: { 
  category: (typeof sidebarCategories)[0]; 
  index: number; 
  isSelected: boolean;
  count: number | null;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { categoryIndex } = useNavigationStore();
  const { isFocused, showFocusIndicator } = useFocusable("category", index);
  const Icon = category.icon;
  const isFocusedItem = isFocused && categoryIndex === index;
  const [prevCount, setPrevCount] = React.useState(count);

  // Animate count badge when count changes
  React.useEffect(() => {
    if (count !== null && count !== prevCount) {
      setPrevCount(count);
    }
  }, [count, prevCount]);

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      title={count !== null ? `${category.label} (${count})` : category.label}
      className={cn(
        compact ? "w-14 h-14 rounded-card px-0" : "h-11 px-6 rounded-button whitespace-nowrap",
        "transition-all duration-panel spring-ease",
        "transform-gpu",
        isSelected
          ? "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-105"
          : "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105",
        isFocusedItem && showFocusIndicator && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background animate-focus-ring"
      )}
    >
      {Icon && (
        <Icon className={cn(
          compact ? "w-5 h-5" : "w-4 h-4 mr-2",
          "transition-all duration-panel-fast",
          (isSelected || isFocusedItem) && "scale-105"
        )} />
      )}
      {!compact && (
        <>
          <span className={cn(
            "font-medium text-sm transition-all duration-panel-fast"
          )}>
            {category.label}
          </span>
          {count !== null && (
            <span 
              key={count}
              className={cn(
                "ml-2 px-2 py-0.5 rounded-md text-xs font-medium",
                "transition-all duration-panel-fast",
                isSelected
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted/80 text-muted-foreground"
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </Button>
  );
}

export function CategoryFilter({
  orientation = "horizontal",
  embedded = false,
}: {
  orientation?: "horizontal" | "vertical" | "compact";
  embedded?: boolean;
}) {
  const { selectedCategory, gamesByCategory } = useGameStore();
  const { setFocusArea, setCategoryIndex } = useNavigationStore();
  const isVertical = orientation === "vertical";
  const isCompact = orientation === "compact";

  // Listen for category activation
  useEffect(() => {
    const handleActivateCategory = (e: CustomEvent) => {
      const index = e.detail;
      const item = CATEGORY_NAV_ORDER[index];
      if (item) {
        appNavigate(libraryPathForCategory(item.id));
      }
    };

    window.addEventListener("activateCategory", handleActivateCategory as EventListener);
    return () => window.removeEventListener("activateCategory", handleActivateCategory as EventListener);
  }, []);

  return (
    <div 
      className={cn(
        isCompact
          ? "flex flex-col gap-4 py-2"
          : isVertical
          ? "flex flex-col gap-3 px-3 py-3 overflow-y-auto scrollbar-hide"
          : embedded
          ? "flex gap-2 px-1 pb-1 overflow-x-auto scrollbar-hide"
          : "flex gap-3 px-8 pb-4 overflow-x-auto scrollbar-hide"
      )}
      style={{
        scrollBehavior: "smooth",
        scrollSnapType: isVertical ? "y proximity" : "x proximity",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {sidebarCategories.map((category, index) => {
        const count =
          category.id === null || category.id === DISCOVER_CATEGORY_ID
            ? null
            : gamesByCategory[category.id]?.length ?? 0;

        return (
          <div
            key={category.id || "all"}
            style={{
              scrollSnapAlign: "start",
            }}
          >
            <CategoryButton
              category={category}
              index={index}
              isSelected={selectedCategory === category.id}
              count={count}
              compact={isCompact}
              onSelect={() => {
                appNavigate(libraryPathForCategory(category.id));
                setCategoryIndex(index);
                setFocusArea("games");
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

