import { useEffect, useMemo, type CSSProperties } from "react";
import type { ThemeAppearance } from "@/types/theme";
import { useGameStore } from "@/stores/gameStore";
import { useAmbientStore } from "@/stores/ambientStore";
import {
  extractVibrantDominantColorFromImageSource,
  hexToRgb,
  type Rgb,
} from "@/utils/dominantColor";
import { isValidImageSource } from "@/utils/imageUtils";
import { getGameBrandAccentHex } from "@/components/PlatformLabel";
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

export function AmbientBackgroundLayer({
  active,
  appearance,
}: {
  active: boolean;
  appearance: ThemeAppearance;
}) {
  const dominant = useAmbientStore((s) => s.dominant);
  const setDominant = useAmbientStore((s) => s.setDominant);

  const imageKey = useGameStore((s) => {
    if (!active) return "";
    const game = s.filteredGames[s.selectedIndex];
    if (!game) return "";
    const src = game.cover_art || game.icon;
    return `${game.id}|${src ?? ""}`;
  });

  useEffect(() => {
    if (!active) {
      setDominant(null);
      return;
    }

    const game = useGameStore.getState().filteredGames[useGameStore.getState().selectedIndex];
    const raw = game?.cover_art || game?.icon;
    let cancelled = false;

    void (async () => {
      let rgb: Rgb | null = null;
      if (raw && isValidImageSource(raw)) {
        rgb = await extractVibrantDominantColorFromImageSource(raw);
      }
      if (!rgb && game) {
        const hex = getGameBrandAccentHex(game);
        if (hex) rgb = hexToRgb(hex);
      }
      if (!cancelled) setDominant(rgb);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, imageKey, setDominant]);

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
