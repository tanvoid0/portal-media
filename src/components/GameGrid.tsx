import { useGameStore } from "@/stores/gameStore";
import { appNavigate } from "@/nav/appNavigate";
import { GameCard } from "./GameCard";
import { GameInfoPanel } from "./GameInfoPanel";
import { useRef, useEffect, useState, useCallback, type MouseEvent } from "react";
import type { Game } from "@/stores/gameStore";
import { GameCardContextMenu } from "./GameCardContextMenu";
import { InteractiveLaunchLoader } from "./ui/InteractiveLaunchLoader";
import { Button } from "./ui/button";
import {
  buildContentGridContainerClassName,
  contentGridTemplateColumnsStyle,
  LIBRARY_GAMES_GRID_PRESET,
} from "@/config/contentGridPresets";
import { useGridColumnCountSync } from "@/hooks/useGridColumnCountSync";
import { useKeepGridSelectionVisible } from "@/hooks/useKeepGridSelectionVisible";

export function GameGrid() {
  const {
    filteredGames: games,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    launchOverlay,
    error,
    clearError,
  } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const setGridColumnCount = useGameStore((s) => s.setGridColumnCount);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    game: Game;
  } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenu = useCallback((e: MouseEvent, game: Game) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  }, []);

  useGridColumnCountSync(containerRef, setGridColumnCount, {
    itemCount: games.length,
    layoutEpoch: isLoading,
  });

  useKeepGridSelectionVisible(containerRef, selectedCardRef, {
    selectedIndex,
    itemCount: games.length,
  });

  useEffect(() => {
    if (!error) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearError();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [error, clearError]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <InteractiveLaunchLoader
          title="Scanning your library"
          subtitle="Finding games and apps — this may take a few moments"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full pointer-events-auto">
        <div
          className="text-center glass-dark rounded-2xl p-8 max-w-md shadow-xl border border-border/60"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="launch-error-title"
          aria-describedby="launch-error-desc"
        >
          <p id="launch-error-title" className="text-destructive text-2xl font-bold mb-2">
            Error
          </p>
          <p id="launch-error-desc" className="text-white/70 mb-4">
            {error}
          </p>
          <p className="text-white/50 text-sm mb-6">
            Please check your game installations and try again
          </p>
          <Button
            type="button"
            variant="default"
            className="min-w-[10rem] rounded-xl"
            autoFocus
            onClick={() => clearError()}
          >
            Dismiss
          </Button>
          <p className="text-white/40 text-xs mt-4">Escape or Back also closes this message</p>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center glass-dark rounded-2xl p-12 max-w-md">
          <div className="text-6xl mb-6 opacity-50">🎮</div>
          <p className="text-white text-2xl font-bold mb-3">No games found</p>
          <p className="text-white/60 text-sm">
            Games will appear here after scanning. Go to Settings to scan for games.
          </p>
        </div>
      </div>
    );
  }

  const selectedGame = games[selectedIndex] || null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <GameCardContextMenu
        open={contextMenu !== null}
        anchor={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        game={contextMenu?.game ?? null}
        onClose={closeContextMenu}
      />
      {launchOverlay ? (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-md"
          aria-live="polite"
          aria-busy="true"
        >
          <InteractiveLaunchLoader
            title={launchOverlay.label}
            subtitle={launchOverlay.hint ?? "Launching…"}
          />
        </div>
      ) : null}

      {/* PS5-style background and info panel */}
      <GameInfoPanel game={selectedGame} />
      
      {/* Cards container - positioned at top with enhanced spacing and PS5-style scrolling */}
      <div
        ref={containerRef}
        className={buildContentGridContainerClassName(LIBRARY_GAMES_GRID_PRESET)}
        style={{
          ...contentGridTemplateColumnsStyle(LIBRARY_GAMES_GRID_PRESET),
          WebkitOverflowScrolling: "touch",
        }}
      >
        {games.map((game, index) => (
          <div
            key={game.id}
            ref={index === selectedIndex ? selectedCardRef : null}
            className="transition-transform duration-300"
          >
            <GameCard
              game={game}
              isSelected={index === selectedIndex}
              onClick={() => {
                setSelectedIndex(index);
                appNavigate(`/game/${encodeURIComponent(game.id)}`);
              }}
              onMouseEnter={() => {
                setSelectedIndex(index);
              }}
              onContextMenu={(e) => openContextMenu(e, game)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

