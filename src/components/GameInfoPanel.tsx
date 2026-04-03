import { Game } from "@/stores/gameStore";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import { useNavigationState } from "@/hooks/useNavigationState";
import { getSafeImageSource } from "@/utils/imageUtils";
import { PlatformLabel } from "@/components/PlatformLabel";

interface GameInfoPanelProps {
  game: Game | null;
}

export function GameInfoPanel({ game }: GameInfoPanelProps) {
  const { isGamepadActive } = useNavigationState();

  // Only show when gamepad is active and we have a game
  if (!isGamepadActive || !game) {
    return null;
  }

  const igdbCover = useMetadataDisplayStore((s) => s.igdbCoverUrlByGameId[game.id]);
  const backgroundImage = getSafeImageSource(game.cover_art || game.icon || igdbCover);

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Enhanced blurred background image with smooth transitions */}
      {backgroundImage && (
        <div 
          key={game.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-out"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(80px) brightness(0.3) saturate(1.3)",
            transform: "scale(1.2)",
          }}
        />
      )}
      
      {/* Enhanced gradient overlay - stronger on bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/80" />
      
      {/* Info Panel - Enhanced PS5 style */}
      <div className="absolute bottom-0 left-0 right-0 p-10 pb-6 animate-slide-in-bottom">
        <div className="max-w-6xl">
          <div className="flex items-start gap-10 mb-6">
            {/* Game Icon/Thumbnail - Enhanced */}
            {backgroundImage && (
              <div className="relative w-40 h-52 flex-shrink-0 rounded-card overflow-hidden border-2 border-primary/50 shadow-card transition-all duration-500 group animate-scale-in">
                <img
                  src={backgroundImage}
                  alt={game.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getSafeImageSource(null);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                {/* Subtle glow on thumbnail */}
                <div className="absolute inset-0 border border-primary/20 rounded-card pointer-events-none" />
              </div>
            )}
            
            {/* Game Info - Enhanced layout */}
            <div className="flex-1 pt-1">
              <h2 className="text-6xl font-bold text-foreground mb-4 leading-tight tracking-tight">
                {game.name}
              </h2>
              <div className="flex items-center gap-3 mb-5">
                <PlatformLabel
                  game={game}
                  size="md"
                  className="rounded-xl bg-primary/25 border-primary/50 shadow-lg shadow-primary/20 backdrop-blur-md"
                />
                <span className="px-4 py-2 rounded-xl bg-muted/90 text-muted-foreground text-sm font-semibold backdrop-blur-md border border-border/50">
                  {game.category}
                </span>
              </div>
              <p className="text-foreground/85 text-lg leading-relaxed max-w-2xl font-normal mb-4">
                {game.category === "Game" && "Ready to play. Press Enter to launch this game and start your adventure."}
                {game.category === "App" && "Application ready to launch. Press Enter to start and begin using this application."}
                {game.category === "Media" && "Media content available. Press Enter to open and enjoy your media."}
                {game.category === "Bookmark" && "Web bookmark. Press Enter to open this link in your browser."}
              </p>
            </div>
          </div>
          
          {/* Action Hint - Enhanced */}
          <div className="flex items-center gap-4 text-foreground/75">
            <div className="px-4 py-2 rounded-xl bg-muted/70 backdrop-blur-md border border-border/60 shadow-md">
              <span className="font-mono text-sm font-bold">Enter</span>
            </div>
            <span className="text-base font-medium">to launch</span>
            <div className="ml-auto flex items-center gap-2 text-foreground/60 text-sm">
              <span>Use</span>
              <div className="px-2 py-1 rounded bg-muted/50 border border-border/50">
                <span className="font-mono text-xs">←</span>
              </div>
              <span>/</span>
              <div className="px-2 py-1 rounded bg-muted/50 border border-border/50">
                <span className="font-mono text-xs">→</span>
              </div>
              <span>to navigate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

