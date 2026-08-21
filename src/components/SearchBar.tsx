import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useGameStore } from "@/stores/gameStore";
import { aiSearchReady, useAiStore } from "@/stores/aiStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CLOSE_SHELL_SEARCH_EVENT, OPEN_SHELL_SEARCH_EVENT } from "@/types/app";
import { appNavigate } from "@/nav/appNavigate";
import { Panel, PanelBody } from "@/components/ui/panel";

export function SearchBar({
  variant = "default",
}: {
  variant?: "default" | "compact" | "overlay";
}) {
  const {
    searchQuery,
    searchInput,
    setSearchQuery,
    setSelectedIndex,
    filteredGames,
    games,
  } = useGameStore();
  const ai = useAiStore();
  const aiReady = aiSearchReady(ai);
  const aiActive = Boolean(ai.activeQuery);
  const filterActive = Boolean(searchQuery.trim()) || aiActive;
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompact = variant === "compact" || variant === "overlay";

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const onOpen = () => {
      if (isCompact) {
        setIsOpen(true);
        if (!window.location.hash.includes("/library") && !window.location.pathname.startsWith("/library")) {
          appNavigate("/library/all");
        }
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

  useEffect(() => {
    void useAiStore.getState().refreshStatus();
  }, []);

  const runAiSearch = useCallback(() => {
    const query = searchInput.trim();
    if (!query || !aiReady) return;
    void useAiStore.getState().search(query);
  }, [searchInput, aiReady]);

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!aiReady || !searchInput.trim()) return;
      e.preventDefault();
      runAiSearch();
      return;
    }
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (isCompact) {
      if (isOpen) setIsOpen(false);
      window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
      return;
    }
    if (searchInput.trim() || filterActive) {
      useAiStore.getState().clearSearch();
      setSearchQuery("");
    }
  };

  const handleSearchChange = (value: string) => {
    // Typing starts a new query — drop the previous AI result set so the text filter applies again.
    if (useAiStore.getState().activeQuery) {
      useAiStore.getState().clearSearch();
    }
    setSearchQuery(value);
    if (value.trim() && filteredGames.length > 0) {
      setSelectedIndex(0);
    } else if (!value.trim()) {
      setSelectedIndex(0);
    }
  };

  const handleClearInput = () => {
    useAiStore.getState().clearSearch();
    setSearchQuery("");
    focusInput();
  };

  if (isCompact) {
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-[90] flex items-start justify-center bg-background/80 pt-[18vh] px-4"
        onClick={() => {
          setIsOpen(false);
          window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
        }}
      >
        <Panel
          className="w-full max-w-2xl shadow-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Find"
        >
          <PanelBody className="pt-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
              <Input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder={
                  aiReady
                    ? "Find a title, or describe it and press Enter…"
                    : "Find games, apps, and media…"
                }
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className={cn(aiReady ? "pr-16" : "pr-10", "pl-11 h-12 text-base")}
              />
              {searchInput.trim() ? (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-button p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
              {aiReady ? (
                <button
                  type="button"
                  onClick={runAiSearch}
                  disabled={ai.searching || !searchInput.trim()}
                  className={cn(
                    "absolute right-9 top-1/2 -translate-y-1/2 rounded-button p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40",
                    aiActive && "text-primary"
                  )}
                  aria-label="Ask AI to find matches"
                >
                  {ai.searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
              ) : null}
            </div>
            {ai.searchError ? (
              <p className="mt-3 text-sm text-destructive">{ai.searchError}</p>
            ) : filterActive ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {aiActive ? <Sparkles className="inline w-3.5 h-3.5 mr-1 text-primary" /> : null}
                <span className="text-foreground font-medium">{filteredGames.length}</span>
                {" of "}
                {games.length} in the library
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Type a name. Escape closes. Enter runs AI when it is set up.
              </p>
            )}
          </PanelBody>
        </Panel>
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
          placeholder={
            aiReady
              ? "Search, or describe what you want and press Enter…"
              : "Search games, apps, and media..."
          }
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className={cn(
            aiReady ? "pr-20" : "pr-12",
            "pl-14 h-14 text-base bg-background/95 backdrop-blur-md",
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
        {aiReady ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={runAiSearch}
            disabled={ai.searching || !searchInput.trim()}
            className={cn(
              "absolute right-12 top-1/2 -translate-y-1/2 rounded-lg p-1.5",
              "text-muted-foreground hover:text-primary hover:bg-primary/10",
              "transition-colors disabled:opacity-40 disabled:hover:bg-transparent",
              aiActive && "text-primary"
            )}
            aria-label="Ask AI to find matches"
            title="Ask AI (Enter)"
          >
            {ai.searching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </button>
        ) : null}
      </div>
      {ai.searchError ? (
        <div className="mt-3 text-center">
          <p className="text-destructive text-sm">{ai.searchError}</p>
        </div>
      ) : filterActive ? (
        <div className="mt-3 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            {aiActive ? <Sparkles className="inline w-3.5 h-3.5 mr-1.5 text-primary" /> : null}
            <span className="text-primary font-semibold">{filteredGames.length}</span>
            <span className="mx-1">of</span>
            <span className="font-semibold">{games.length}</span>
            <span className="ml-1">item{filteredGames.length !== 1 ? 's' : ''} found</span>
            {aiActive && ai.lastTruncated ? (
              <span className="ml-2 text-xs text-muted-foreground/70">
                (first 400 items searched)
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

