import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/stores/gameStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { OVERRIDABLE_CATEGORIES, tabLabel } from "@/utils/libraryPrefs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EXECUTE_GAME_CONTEXT_EVENT } from "@/types/app";

type MenuEntry = { label: string; dangerous?: boolean; run: () => void };

export default function GameOptionsMenu() {
  const gameContextMenuOpen = useShellOverlayStore((s) => s.gameContextMenuOpen);
  const contextMenuFocusIndex = useShellOverlayStore((s) => s.contextMenuFocusIndex);
  const setContextMenuItemCount = useShellOverlayStore((s) => s.setContextMenuItemCount);
  const setGameContextMenuOpen = useShellOverlayStore((s) => s.setGameContextMenuOpen);

  const filteredGames = useGameStore((s) => s.filteredGames);
  const selectedIndex = useGameStore((s) => s.selectedIndex);
  const launchGame = useGameStore((s) => s.launchGame);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const archiveGame = useGameStore((s) => s.archiveGame);
  const setCategoryOverride = useGameStore((s) => s.setCategoryOverride);
  const getNativeCategory = useGameStore((s) => s.getNativeCategory);
  const categoryOverrides = useGameStore((s) => s.categoryOverrides);
  const hiddenFromCategories = useGameStore((s) => s.hiddenFromCategories);
  const hideFromCategoryTab = useGameStore((s) => s.hideFromCategoryTab);
  const unhideFromCategoryTab = useGameStore((s) => s.unhideFromCategoryTab);
  const favoriteIds = useGameStore((s) => s.favoriteIds);

  const game = filteredGames[selectedIndex] ?? null;

  const close = useCallback(() => setGameContextMenuOpen(false), [setGameContextMenuOpen]);

  const entries = useMemo(() => {
    if (!game) return [] as MenuEntry[];
    const list: MenuEntry[] = [];
    list.push({
      label: game.launch_type === "Url" ? "Open" : "Launch",
      run: () => void launchGame(game),
    });
    const fav = favoriteIds.includes(game.id);
    list.push({
      label: fav ? "Remove from favourites" : "Add to favourites",
      run: () => toggleFavorite(game.id),
    });
    OVERRIDABLE_CATEGORIES.forEach((cat) => {
      list.push({
        label: `Move to ${cat === "Game" ? "Games" : cat === "App" ? "Apps" : "Media"}${game.category === cat ? " ✓" : ""}`,
        run: () => setCategoryOverride(game.id, cat),
      });
    });
    const nativeCategory = getNativeCategory(game.id);
    const hasCategoryOverride = game.id in categoryOverrides;
    if (hasCategoryOverride && nativeCategory) {
      list.push({
        label: `Use library default (${nativeCategory})`,
        run: () => setCategoryOverride(game.id, null),
      });
    }
    const hiddenTabs = hiddenFromCategories[game.id] ?? [];
    const canHideFromCurrentTab = !hiddenTabs.includes(game.category);
    if (canHideFromCurrentTab) {
      list.push({
        label: `Hide from ${tabLabel(game.category)} tab`,
        run: () => {
          hideFromCategoryTab(game.id, game.category);
          toast.success(`Hidden from ${tabLabel(game.category)} tab`);
        },
      });
    }
    hiddenTabs.forEach((tab) => {
      list.push({
        label: `Show in ${tabLabel(tab)} tab again`,
        run: () => {
          unhideFromCategoryTab(game.id, tab);
          toast.success(`Shown in ${tabLabel(tab)} tab again`);
        },
      });
    });
    list.push({
      label: "Archive (entire library)",
      dangerous: true,
      run: () => {
        archiveGame(game.id);
        toast.success("Archived — restore from Library settings if needed");
      },
    });
    return list;
  }, [
    game,
    favoriteIds,
    launchGame,
    toggleFavorite,
    setCategoryOverride,
    getNativeCategory,
    categoryOverrides,
    hiddenFromCategories,
    hideFromCategoryTab,
    unhideFromCategoryTab,
    archiveGame,
  ]);

  useEffect(() => {
    if (!gameContextMenuOpen) return;
    setContextMenuItemCount(entries.length);
  }, [gameContextMenuOpen, entries.length, setContextMenuItemCount]);

  useEffect(() => {
    if (!gameContextMenuOpen || !game) return;
    const onExec = (e: Event) => {
      const ce = e as CustomEvent<number>;
      const i = typeof ce.detail === "number" ? ce.detail : 0;
      const item = entries[i];
      if (item) {
        item.run();
        close();
      }
    };
    window.addEventListener(EXECUTE_GAME_CONTEXT_EVENT, onExec as EventListener);
    return () => window.removeEventListener(EXECUTE_GAME_CONTEXT_EVENT, onExec as EventListener);
  }, [gameContextMenuOpen, game, entries, close]);

  if (!gameContextMenuOpen || !game) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] border-0 cursor-default"
        aria-label="Close menu"
        onClick={close}
      />
      <div
        role="menu"
        aria-label={`Options for ${game.name}`}
        className={cn(
          "relative mx-auto mb-0 w-full max-w-lg rounded-t-3xl border border-white/10",
          "bg-card/98 backdrop-blur-2xl shadow-2xl shadow-black/50",
          "px-4 pt-5 pb-8 max-h-[min(70vh,520px)] flex flex-col gap-2",
          "animate-in slide-in-from-bottom-4 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          {game.name}
        </p>
        <div className="overflow-y-auto flex flex-col gap-1 min-h-0 pr-1">
          {entries.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              type="button"
              role="menuitem"
              className={cn(
                "w-full text-left rounded-xl px-4 py-3.5 text-sm font-medium transition-colors",
                item.dangerous
                  ? "text-destructive hover:bg-destructive/15"
                  : "hover:bg-muted/80 text-foreground",
                contextMenuFocusIndex === i &&
                  "ring-2 ring-primary/70 ring-offset-2 ring-offset-card bg-muted/40"
              )}
              onClick={() => {
                item.run();
                close();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
