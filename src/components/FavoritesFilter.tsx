import { useGameStore, FAVORITES_CATEGORY_ID } from "@/stores/gameStore";
import { useFocusable } from "@/hooks/useNavigationState";
import { useNavigationStore } from "@/stores/navigationStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { CATEGORY_NAV_ORDER, FAVORITES_NAV_INDEX } from "@/constants/categoryNav";
import { appNavigate } from "@/nav/appNavigate";
import { libraryPathForCategory } from "@/nav/libraryRoutes";

/**
 * Favourites lives in the top bar (not the sidebar) so it stays visible as a primary filter.
 */
export function FavoritesFilter({ className }: { className?: string }) {
  const { selectedCategory, favoriteIds, games } = useGameStore();
  const { setFocusArea, setCategoryIndex, categoryIndex } = useNavigationStore();
  const { isFocused, showFocusIndicator } = useFocusable("category", FAVORITES_NAV_INDEX);
  const isFocusedItem = isFocused && categoryIndex === FAVORITES_NAV_INDEX;
  const isSelected = selectedCategory === FAVORITES_CATEGORY_ID;
  const count = favoriteIds.filter((id) => games.some((g) => g.id === id)).length;

  const onSelect = () => {
    appNavigate(libraryPathForCategory(FAVORITES_CATEGORY_ID));
    setCategoryIndex(FAVORITES_NAV_INDEX);
    setFocusArea("games");
  };

  const def = CATEGORY_NAV_ORDER[FAVORITES_NAV_INDEX];

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      title={count > 0 ? `${def.label} (${count})` : def.label}
      className={cn(
        "h-9 px-4 rounded-xl whitespace-nowrap shrink-0",
        "transition-all duration-ps5 spring-ease",
        "text-xs font-semibold",
        isSelected
          ? "bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 scale-105"
          : "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105",
        isFocusedItem && showFocusIndicator && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background animate-focus-ring",
        className
      )}
    >
      <Star
        className={cn(
          "w-4 h-4 mr-2 transition-transform duration-ps5-fast",
          (isSelected || isFocusedItem) && "scale-105",
          isSelected && "fill-current"
        )}
      />
      <span>{def.label}</span>
      {count > 0 ? (
        <span
          className={cn(
            "ml-2 px-2 py-0.5 rounded-md text-[0.65rem] font-medium tabular-nums",
            "transition-all duration-ps5-fast",
            isSelected ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted/80 text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </Button>
  );
}
