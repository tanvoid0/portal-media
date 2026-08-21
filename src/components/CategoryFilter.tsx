import { useGameStore } from "@/stores/gameStore";
import { DISCOVER_CATEGORY_ID } from "@/types/game";
import { useFocusable } from "@/hooks/useNavigationState";
import { useNavigationStore } from "@/stores/navigationStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clapperboard, Gamepad2, Monitor, Film, LayoutGrid, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
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
  hideCount = false,
}: { 
  category: (typeof sidebarCategories)[0]; 
  index: number; 
  isSelected: boolean;
  count: number | null;
  onSelect: () => void;
  compact?: boolean;
  hideCount?: boolean;
}) {
  const { categoryIndex } = useNavigationStore();
  const { isFocused, showFocusIndicator } = useFocusable("category", index);
  const Icon = category.icon;
  const isFocusedItem = isFocused && categoryIndex === index;

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      title={count !== null ? `${category.label} (${count})` : category.label}
      className={cn(
        compact ? "w-14 h-14 rounded-none px-0" : "h-9 px-3 rounded-none whitespace-nowrap border-2",
        "transition-[border-width,color] duration-150 bg-transparent font-hub",
        isSelected
          ? "border-border text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
        isFocusedItem && showFocusIndicator && "border-primary border-[3px] text-foreground"
      )}
    >
      {Icon && (
        <Icon className={cn(
          compact ? "w-5 h-5" : "w-4 h-4 mr-2"
        )} />
      )}
      {!compact && (
        <>
          <span className="text-sm font-medium">
            {category.label}
          </span>
          {!hideCount && count !== null && (
            <span
              className={cn(
                "ml-2 text-xs font-medium tabular-nums",
                isSelected ? "text-foreground" : "text-muted-foreground"
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
              hideCount={embedded}
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

