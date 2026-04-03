import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useGameStore } from "@/stores/gameStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CLOSE_SHELL_SEARCH_EVENT, OPEN_SHELL_SEARCH_EVENT } from "@/types/app";

export function SearchBar({
  variant = "default",
  /** When compact, popup opens toward the left (e.g. top-right toolbar). */
  compactPopupSide = "right",
}: {
  variant?: "default" | "compact";
  compactPopupSide?: "left" | "right";
}) {
  const {
    searchQuery,
    searchInput,
    setSearchQuery,
    clearSearchInput,
    setSelectedIndex,
    filteredGames,
    games,
  } = useGameStore();
  const filterActive = Boolean(searchQuery.trim());
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompact = variant === "compact";
  const popupTowardLeft = isCompact && compactPopupSide === "right";

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const onOpen = () => {
      if (isCompact) {
        setIsOpen(true);
      } else {
        focusInput();
      }
    };
    const onClose = () => {
      if (isCompact) {
        setIsOpen(false);
      }
    };
    window.addEventListener(OPEN_SHELL_SEARCH_EVENT, onOpen);
    window.addEventListener(CLOSE_SHELL_SEARCH_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_SHELL_SEARCH_EVENT, onOpen);
      window.removeEventListener(CLOSE_SHELL_SEARCH_EVENT, onClose);
    };
  }, [isCompact, focusInput]);

  useEffect(() => {
    if (isOpen && isCompact) {
      focusInput();
    }
  }, [isOpen, isCompact, focusInput]);

  useEffect(() => {
    const setSearchPopoverOpen = useShellOverlayStore.getState().setSearchPopoverOpen;
    if (!isCompact) {
      setSearchPopoverOpen(false);
      return;
    }
    setSearchPopoverOpen(isOpen);
  }, [isCompact, isOpen]);

  const dismissSearchKeyboard = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (isCompact) {
      if (isOpen) setIsOpen(false);
      window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
      return;
    }
    if (searchInput.trim() || filterActive) {
      setSearchQuery("");
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim() && filteredGames.length > 0) {
      setSelectedIndex(0);
    } else if (!value.trim()) {
      setSelectedIndex(0);
    }
  };

  const handleClearInput = () => {
    clearSearchInput();
    focusInput();
  };

  if (isCompact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            "transition-all duration-ps5 spring-ease",
            "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105",
            (isOpen || filterActive || searchInput) &&
              "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-105"
          )}
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {isOpen && (
          <div
            className={cn(
              "absolute top-0 w-80",
              popupTowardLeft ? "right-full mr-3" : "left-full ml-3"
            )}
          >
            <div className="bg-background/95 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  placeholder="Search games, apps, and media..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={dismissSearchKeyboard}
                  onBlur={() => setIsOpen(false)}
                  className={cn(
                    "pl-11 pr-10 h-11 text-sm bg-background/95 backdrop-blur-md",
                    "border border-border",
                    "text-foreground",
                    "placeholder:text-muted-foreground",
                    "focus:border-primary/60 focus:ring-2 focus:ring-primary/30",
                    "rounded-xl transition-all duration-300",
                    (searchInput || filterActive) && "border-primary/30"
                  )}
                />
                {searchInput.trim() ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClearInput}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1",
                      "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
                      "transition-colors"
                    )}
                    aria-label="Clear search text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
              {filterActive && (
                <p className="mt-2 text-center text-xs text-muted-foreground font-medium">
                  <span className="text-primary font-semibold">{filteredGames.length}</span>
                  <span className="mx-1">of</span>
                  <span className="font-semibold">{games.length}</span>
                  <span className="ml-1">found</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10 transition-colors duration-300" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search games, apps, and media..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={dismissSearchKeyboard}
          className={cn(
            "pl-14 pr-12 h-14 text-base bg-background/95 backdrop-blur-md",
            "border border-border",
            "text-foreground",
            "placeholder:text-muted-foreground",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30",
            "rounded-2xl transition-all duration-300",
            "shadow-lg shadow-black/10",
            (searchInput || filterActive) && "border-primary/30"
          )}
        />
        {searchInput.trim() ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearInput}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5",
              "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
              "transition-colors"
            )}
            aria-label="Clear search text"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>
      {filterActive && (
        <div className="mt-3 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            <span className="text-primary font-semibold">{filteredGames.length}</span>
            <span className="mx-1">of</span>
            <span className="font-semibold">{games.length}</span>
            <span className="ml-1">item{filteredGames.length !== 1 ? 's' : ''} found</span>
          </p>
        </div>
      )}
    </div>
  );
}

