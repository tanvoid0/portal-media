import { Game } from "@/stores/gameStore";
import { useGameStore } from "@/stores/gameStore";
import {
  getGameBrandAccentHex,
  hasLibraryBrandHeroIcon,
  LibraryBrandHeroIcon,
} from "@/components/PlatformLabel";
import { ShelfCard } from "@/components/content/ShelfCard";
import { LibraryCardFooterExtras } from "@/components/content/LibraryCardFooterExtras";
import { ShelfStatusBadge } from "@/components/content/ShelfStatusBadge";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import { useSessionStore } from "@/stores/sessionStore";
import { type MouseEvent } from "react";
import { AppWindow, Bookmark, Download, Gamepad2, Star, Tv } from "lucide-react";
import type { GameCategory } from "@/types/game";
import { libraryCardSubtitle } from "@/utils/libraryCardFooterMeta";
import {
  libraryTileMarkFrameKind,
  resolveLibraryTileHeroVariant,
} from "@/utils/libraryTileLayout";

function pickRecordStr(record: Record<string, unknown>, key: string): string | undefined {
  const v = record[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function LibraryPlaceholderIcon({ category }: { category: GameCategory }) {
  const cls = "h-16 w-16 opacity-75 text-muted-foreground shrink-0";
  switch (category) {
    case "Media":
      return <Tv className={cls} strokeWidth={1.25} aria-hidden />;
    case "App":
      return <AppWindow className={cls} strokeWidth={1.25} aria-hidden />;
    case "Bookmark":
      return <Bookmark className={cls} strokeWidth={1.25} aria-hidden />;
    default:
      return <Gamepad2 className={cls} strokeWidth={1.25} aria-hidden />;
  }
}

interface GameCardProps {
  game: Game;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onMouseEnter?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
}

export function GameCard({
  game,
  isSelected,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onContextMenu,
}: GameCardProps) {
  const isFavorite = useGameStore((s) => s.favoriteIds.includes(game.id));
  const lastOpened = useGameStore((s) => s.getLastOpenedTime(game.id));
  const isRunning = useSessionStore((s) => s.sessions.some((sess) => sess.gameId === game.id));
  const igdbCover = useMetadataDisplayStore((s) => s.igdbCoverUrlByGameId[game.id]);
  const r = game as unknown as Record<string, unknown>;
  const coverArt = game.cover_art ?? pickRecordStr(r, "coverArt");
  const iconArt = game.icon ?? pickRecordStr(r, "icon");

  const isApp = game.category === "App";
  const cardImage = isApp
    ? iconArt || null
    : coverArt || iconArt || igdbCover || null;

  const libraryHero = resolveLibraryTileHeroVariant(game, {
    cardImage,
    coverArt,
    igdbCover,
  });

  const useStreamingVectorBrand =
    libraryHero === "mark" &&
    !isApp &&
    (game.category === "Media" ||
      game.category === "Bookmark" ||
      game.launch_type === "Url") &&
    hasLibraryBrandHeroIcon(game);
  const usePlatformFallback =
    libraryHero === "mark" && !cardImage && hasLibraryBrandHeroIcon(game);

  const subtitle = libraryCardSubtitle(game, libraryHero);

  const brandAccentHex = getGameBrandAccentHex(game);

  return (
    <ShelfCard
      isSelected={isSelected}
      title={game.name}
      subtitle={subtitle}
      actionHint="Enter · Launch"
      artImageUrl={cardImage}
      libraryLayout={libraryHero}
      markFrameKind={libraryTileMarkFrameKind(game.category)}
      brandAccentHex={brandAccentHex}
      brandHero={
        useStreamingVectorBrand || usePlatformFallback ? (
          <LibraryBrandHeroIcon game={game} />
        ) : undefined
      }
      placeholder={<LibraryPlaceholderIcon category={game.category} />}
      topLeft={
        <div className="flex flex-col gap-1.5">
          {isFavorite ? (
            <ShelfStatusBadge className="text-amber-400">
              <Star className="h-3.5 w-3.5 fill-current" />
            </ShelfStatusBadge>
          ) : null}
          {game.is_installed === false ? (
            <ShelfStatusBadge className="text-muted-foreground" title="Not installed">
              <Download className="h-3.5 w-3.5" />
            </ShelfStatusBadge>
          ) : null}
        </div>
      }
      footerAccessory={
        <LibraryCardFooterExtras
          game={game}
          hero={libraryHero}
          isRunning={isRunning}
          lastOpened={lastOpened}
        />
      }
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
      onMouseEnter={() => {
        onMouseEnter?.();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
    />
  );
}
