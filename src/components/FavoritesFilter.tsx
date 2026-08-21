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
        "h-9 px-3 rounded-none whitespace-nowrap shrink-0 border-2 bg-transparent",
        "transition-[border-width,color] duration-150 font-hub",
        isSelected
          ? "border-border text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
        isFocusedItem && showFocusIndicator && "border-primary border-[3px] text-foreground",
        className
      )}
    >
      <Star
        className={cn("w-4 h-4 mr-2", isSelected && "fill-current")}
      />
      <span>{def.label}</span>
    </Button>
  );
}
