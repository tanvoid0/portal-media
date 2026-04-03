import { Game } from "@/stores/gameStore";
import { useGameStore } from "@/stores/gameStore";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformLabel } from "@/components/PlatformLabel";
import { cn } from "@/lib/utils";
import { useSelectable } from "@/hooks/useNavigationState";
import { PS5FocusRing } from "./PS5FocusRing";
import { getSafeImageSource } from "@/utils/imageUtils";
import { getGameCardSubtitle } from "@/utils/gameDisplay";
import { useState } from "react";
import { Star } from "lucide-react";

interface GameCardProps {
  game: Game;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onMouseEnter?: () => void;
}

export function GameCard({
  game,
  isSelected,
  onClick,
  onDoubleClick,
  onMouseEnter,
}: GameCardProps) {
  const { showSelection } = useSelectable(isSelected);
  const [isHovered, setIsHovered] = useState(false);
  const isFavorite = useGameStore((s) => s.favoriteIds.includes(game.id));
  const mouseSelected = isSelected && !showSelection;
  const subtitle = getGameCardSubtitle(game);

  return (
    <Card
      className={cn(
        "relative h-[26rem] w-56 cursor-pointer border border-border/50 rounded-2xl",
        "transition-all duration-300 ease-out",
        "bg-card overflow-hidden group/card",
        showSelection
          ? "scale-[1.08] z-10 translate-y-[-4px] border-primary/60 card-glow"
          : isHovered
            ? "scale-[1.02] z-20 translate-y-[-2px] shadow-md border-border hover:border-primary/30"
            : "scale-100 z-0 shadow-sm",
        mouseSelected && "ring-2 ring-primary/40 shadow-md shadow-primary/15 border-primary/40",
        "hover:border-primary/30"
      )}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0 h-full flex flex-col">
        <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-muted/20 to-muted/40">
          {isFavorite && (
            <div
              className="absolute top-2.5 left-2.5 z-20 pointer-events-none flex h-9 w-9 items-center justify-center rounded-xl bg-black/45 text-amber-400 backdrop-blur-md border border-white/15 shadow-lg"
              aria-hidden
            >
              <Star className="h-4 w-4 fill-current" />
            </div>
          )}
          {game.cover_art || game.icon ? (
            <div
              className={cn(
                "relative h-full w-full",
                game.icon && !game.cover_art && "flex items-center justify-center bg-muted/50 p-8"
              )}
            >
              <img
                src={getSafeImageSource(game.cover_art || game.icon)}
                alt={game.name}
                className={cn(
                  "transition-all duration-300",
                  game.cover_art
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain max-h-48",
                  showSelection && "brightness-105",
                  isHovered && "brightness-[1.02] scale-[1.02]"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSafeImageSource(null);
                }}
              />
              {game.cover_art && (
                <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent pointer-events-none" />
              )}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                <PlatformLabel game={game} size="lg" variant="overlay" />
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full bg-muted/50 flex items-center justify-center">
              <div className="text-center">
                <div
                  className={cn(
                    "text-5xl mb-3 opacity-60",
                    game.category === "Media" && "text-4xl"
                  )}
                >
                  {game.category === "Media" ? "📺" : "🎮"}
                </div>
                <p className="text-foreground/70 text-sm font-medium px-4 line-clamp-4 leading-snug text-center">
                  {game.name}
                </p>
              </div>
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                <PlatformLabel game={game} size="lg" variant="overlay" />
              </div>
            </div>
          )}

          {showSelection && <PS5FocusRing isVisible={true} />}
        </div>

        <div className="p-4 pt-3.5 bg-gradient-to-b from-card to-muted/25 border-t border-border/50">
          <h3
            className={cn(
              "text-foreground font-semibold text-[0.95rem] leading-snug line-clamp-3",
              subtitle ? "mb-1" : showSelection ? "mb-2" : "mb-0"
            )}
          >
            {game.name}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-1 font-medium tracking-wide">
              {subtitle}
            </p>
          )}
          {showSelection && (
            <div className="flex justify-end mt-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Enter · Launch
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
