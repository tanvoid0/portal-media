import { useLayoutEffect, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Game } from "@/stores/gameStore";
import { useGameStore } from "@/stores/gameStore";
import { OVERRIDABLE_CATEGORIES, tabLabel } from "@/utils/libraryPrefs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function menuItemClass(extra?: string) {
  return cn(
    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
    "text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    extra
  );
}

export function GameCardContextMenu({
  open,
  anchor,
  game,
  onClose,
}: {
  open: boolean;
  anchor: { x: number; y: number } | null;
  game: Game | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const launchGame = useGameStore((s) => s.launchGame);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const archiveGame = useGameStore((s) => s.archiveGame);
  const setCategoryOverride = useGameStore((s) => s.setCategoryOverride);
  const getNativeCategory = useGameStore((s) => s.getNativeCategory);
  const categoryOverrides = useGameStore((s) => s.categoryOverrides);
  const favoriteIds = useGameStore((s) => s.favoriteIds);
  const hiddenFromCategories = useGameStore((s) => s.hiddenFromCategories);
  const hideFromCategoryTab = useGameStore((s) => s.hideFromCategoryTab);
  const unhideFromCategoryTab = useGameStore((s) => s.unhideFromCategoryTab);

  const runClose = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  useLayoutEffect(() => {
    if (!open || !anchor || !game || !menuRef.current) return;
    const node = menuRef.current;
    const rect = node.getBoundingClientRect();
    const margin = 8;
    let left = anchor.x;
    let top = anchor.y;
    if (left + rect.width > window.innerWidth - margin) {
      left = window.innerWidth - rect.width - margin;
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - rect.height - margin;
    }
    left = Math.max(margin, left);
    top = Math.max(margin, top);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }, [open, anchor, game]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose]);

  if (!open || !anchor || !game) return null;

  const isFavorite = favoriteIds.includes(game.id);
  const nativeCategory = getNativeCategory(game.id);
  const hasCategoryOverride = game.id in categoryOverrides;
  const hiddenTabs = hiddenFromCategories[game.id] ?? [];
  const canHideFromCurrentTab = !hiddenTabs.includes(game.category);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${game.name}`}
      className={cn(
        "fixed z-[200] min-w-[14rem] py-1.5 px-1 rounded-xl",
        "bg-card/95 backdrop-blur-xl border border-border/80 shadow-xl shadow-black/25"
      )}
      style={{ left: anchor.x, top: anchor.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className={menuItemClass()}
        onClick={() => runClose(() => void launchGame(game))}
      >
        {game.launch_type === "Url" ? "Open" : "Launch"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={menuItemClass()}
        onClick={() => runClose(() => toggleFavorite(game.id))}
      >
        {isFavorite ? "Remove from favourites" : "Add to favourites"}
      </button>

      <div className="my-1.5 h-px bg-border/70 mx-1" role="separator" />

      <p className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Move to sidebar tab
      </p>
      {OVERRIDABLE_CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          role="menuitem"
          className={menuItemClass(game.category === cat ? "bg-primary/15 text-primary font-medium" : undefined)}
          onClick={() => runClose(() => setCategoryOverride(game.id, cat))}
        >
          {cat === "Game" ? "Games" : cat === "App" ? "Apps" : "Media"}
          {game.category === cat ? " ✓" : ""}
        </button>
      ))}
      {hasCategoryOverride && nativeCategory ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClass("text-muted-foreground")}
          onClick={() => runClose(() => setCategoryOverride(game.id, null))}
        >
          Use library default ({nativeCategory})
        </button>
      ) : null}

      <div className="my-1.5 h-px bg-border/70 mx-1" role="separator" />

      <p className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Tab visibility
      </p>
      <p className="px-3 pb-1 text-[11px] text-muted-foreground leading-snug">
        Hides only from that sidebar tab; the item stays under All.
      </p>
      {canHideFromCurrentTab ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClass()}
          onClick={() =>
            runClose(() => {
              hideFromCategoryTab(game.id, game.category);
              toast.success(`Hidden from ${tabLabel(game.category)} tab`);
            })
          }
        >
          Hide from {tabLabel(game.category)} tab
        </button>
      ) : null}
      {hiddenTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="menuitem"
          className={menuItemClass("text-muted-foreground")}
          onClick={() =>
            runClose(() => {
              unhideFromCategoryTab(game.id, tab);
              toast.success(`Shown in ${tabLabel(tab)} tab again`);
            })
          }
        >
          Show in {tabLabel(tab)} tab again
        </button>
      ))}

      <div className="my-1.5 h-px bg-border/70 mx-1" role="separator" />

      <button
        type="button"
        role="menuitem"
        title="Removes the item from All and every tab until you restore it in Settings → Library."
        className={menuItemClass("text-destructive hover:bg-destructive/15 hover:text-destructive")}
        onClick={() =>
          runClose(() => {
            archiveGame(game.id);
            toast.success("Archived — restore from Library settings if needed");
          })
        }
      >
        Archive (remove from entire library)
      </button>
    </div>,
    document.body
  );
}
