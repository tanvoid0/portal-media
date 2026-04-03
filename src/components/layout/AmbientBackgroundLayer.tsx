import { useEffect, useMemo, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import type { ThemeAppearance } from "@/types/theme";
import { useGameStore } from "@/stores/gameStore";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import { useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import { useAmbientStore } from "@/stores/ambientStore";
import {
  extractVibrantDominantColorFromImageSource,
  hexToRgb,
  type Rgb,
} from "@/utils/dominantColor";
import { getSafeImageSource, isValidImageSource } from "@/utils/imageUtils";
import { getGameBrandAccentHex } from "@/components/PlatformLabel";
import { posterUrlForTmdbHit } from "@/config/discoverFeeds";
import type { IgdbDiscoverHit, TmdbSearchHit } from "@/types/metadata";
import { cn } from "@/lib/utils";

function ambientStyles(rgb: { r: number; g: number; b: number }, appearance: ThemeAppearance) {
  const { r, g, b } = rgb;
  const dark = appearance === "dark";
  const top = dark ? 0.5 : 0.26;
  const corner = dark ? 0.26 : 0.14;
  const bottom = dark ? 0.16 : 0.09;
  return {
    background: `
      radial-gradient(ellipse 132% 88% at 74% -6%, rgba(${r},${g},${b},${top}) 0%, transparent 58%),
      radial-gradient(ellipse 92% 72% at 6% 90%, rgba(${r},${g},${b},${corner}) 0%, transparent 56%),
      radial-gradient(ellipse 105% 55% at 48% 108%, rgba(${r},${g},${b},${bottom}) 0%, transparent 46%)
    `,
  } as CSSProperties;
}

/** Discover grid with no poster / sampling failed */
const DISCOVER_FALLBACK_AMBIENT: Rgb = { r: 52, g: 76, b: 138 };
const TMDB_PAGE_AMBIENT: Rgb = { r: 72, g: 48, b: 118 };

function ambientImageSampleUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim() || !isValidImageSource(raw)) return null;
  const s = getSafeImageSource(raw);
  const ph = getSafeImageSource(null);
  return s !== ph ? s : null;
}

export function AmbientBackgroundLayer({
  active,
  appearance,
}: {
  active: boolean;
  appearance: ThemeAppearance;
}) {
  const { pathname } = useLocation();
  const dominant = useAmbientStore((s) => s.dominant);
  const setDominant = useAmbientStore((s) => s.setDominant);

  const game = useGameStore((s) => (active ? s.filteredGames[s.selectedIndex] : null));
  const igdbCover = useMetadataDisplayStore((s) =>
    game ? s.igdbCoverUrlByGameId[game.id] : undefined
  );
  const imageKey = game
    ? `${game.id}|${game.cover_art ?? ""}|${game.icon ?? ""}|${igdbCover ?? ""}`
    : "";

  const discoverAmbientKey = useTmdbDiscoverStore((s) => {
    const items = s.getItems();
    const i = s.selectedIndex;
    const feed = s.feed;
    if (i < 0 || i >= items.length) return `${feed}:${i}:none`;
    const item = items[i];
    if (feed === "popularGames") {
      const h = item as IgdbDiscoverHit;
      return `${feed}:${i}:igdb:${h.id}:${h.coverUrl ?? ""}`;
    }
    const h = item as TmdbSearchHit;
    return `${feed}:${i}:${h.mediaType}:${h.id}:${h.posterPath ?? ""}`;
  });

  useEffect(() => {
    if (!active) {
      setDominant(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      let rgb: Rgb | null = null;

      if (pathname.startsWith("/library/discover")) {
        const d = useTmdbDiscoverStore.getState();
        const items = d.getItems();
        const i = d.selectedIndex;
        const feed = d.feed;
        let rawPoster: string | null = null;
        if (i >= 0 && i < items.length) {
          const item = items[i];
          if (feed === "popularGames") {
            rawPoster = (item as IgdbDiscoverHit).coverUrl ?? null;
          } else {
            rawPoster = posterUrlForTmdbHit(item as TmdbSearchHit);
          }
        }
        const sample = ambientImageSampleUrl(rawPoster);
        if (sample) {
          rgb = await extractVibrantDominantColorFromImageSource(sample);
        }
        if (!rgb) {
          rgb = DISCOVER_FALLBACK_AMBIENT;
        }
      } else {
        const gameNow = useGameStore.getState().filteredGames[useGameStore.getState().selectedIndex];
        const igdb = gameNow
          ? useMetadataDisplayStore.getState().igdbCoverUrlByGameId[gameNow.id]
          : undefined;
        const raw = gameNow?.cover_art || gameNow?.icon || igdb;
        const sample = ambientImageSampleUrl(raw ?? null);
        if (sample) {
          rgb = await extractVibrantDominantColorFromImageSource(sample);
        }
        if (!rgb && gameNow) {
          const hex = getGameBrandAccentHex(gameNow);
          if (hex) rgb = hexToRgb(hex);
        }
        if (!rgb && pathname.startsWith("/tmdb/")) {
          rgb = TMDB_PAGE_AMBIENT;
        }
      }

      if (!cancelled) setDominant(rgb);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, imageKey, discoverAmbientKey, pathname, setDominant]);

  const style = useMemo(
    () => (dominant ? ambientStyles(dominant, appearance) : undefined),
    [appearance, dominant]
  );

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 pointer-events-none z-[1]",
        "transition-opacity duration-700 ease-out motion-reduce:transition-none",
        dominant ? "opacity-100" : "opacity-0"
      )}
      style={style}
    />
  );
}
