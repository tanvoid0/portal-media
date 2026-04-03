import { Game } from "@/stores/gameStore";

import { useGameStore } from "@/stores/gameStore";

import { PlatformLabel } from "@/components/PlatformLabel";

import { ShelfCard } from "@/components/content/ShelfCard";

import { getGameCardSubtitle } from "@/utils/gameDisplay";

import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";

import { type MouseEvent } from "react";

import { AppWindow, Bookmark, Gamepad2, Star, Tv } from "lucide-react";

import type { GameCategory } from "@/types/game";

import { shouldShowLibraryGamePlatformCornerBadge } from "@/utils/libraryGameVisual";



function pickRecordStr(record: Record<string, unknown>, key: string): string | undefined {

  const v = record[key];

  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

}



function LibraryPlaceholderIcon({ category }: { category: GameCategory }) {

  const cls =

    "h-14 w-14 mx-auto mb-3 opacity-70 text-muted-foreground shrink-0";

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

  const igdbCover = useMetadataDisplayStore((s) => s.igdbCoverUrlByGameId[game.id]);

  const r = game as unknown as Record<string, unknown>;

  const coverArt = game.cover_art ?? pickRecordStr(r, "coverArt");

  const iconArt = game.icon ?? pickRecordStr(r, "icon");

  const isApp = game.category === "App";
  const cardImage = isApp
    ? iconArt || null
    : coverArt || iconArt || igdbCover || null;

  const subtitle = getGameCardSubtitle(game);

  const artMode =
    isApp && cardImage
      ? "iconContain"
      : coverArt || igdbCover
        ? "posterCover"
        : "iconContain";

  const showPlatformCorner = shouldShowLibraryGamePlatformCornerBadge(game, {
    coverArt,
    iconArt,
    igdbCover,
  });



  return (

    <ShelfCard

      isSelected={isSelected}

      title={game.name}

      subtitle={subtitle}

      actionHint="Enter · Launch"

      artImageUrl={cardImage}

      artMode={artMode}

      skipFooterTint={isApp}

      placeholder={<LibraryPlaceholderIcon category={game.category} />}

      topLeft={

        isFavorite ? (

          <div

            className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-xl bg-black/45 text-amber-400 backdrop-blur-md border border-white/15 shadow-lg"

            aria-hidden

          >

            <Star className="h-4 w-4 fill-current" />

          </div>

        ) : null

      }

      topRight={

        showPlatformCorner ? <PlatformLabel game={game} size="lg" variant="overlay" /> : null

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

