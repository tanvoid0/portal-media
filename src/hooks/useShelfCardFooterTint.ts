import { useEffect, useState, type CSSProperties } from "react";
import { extractVibrantDominantColorFromImageSource, type Rgb } from "@/utils/dominantColor";
import { isValidImageSource } from "@/utils/imageUtils";

function footerGradientFromRgb(rgb: Rgb): CSSProperties {
  const { r, g, b } = rgb;
  return {
    backgroundColor: "hsl(var(--card))",
    backgroundImage: `linear-gradient(180deg, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0.22) 38%, rgba(${r},${g},${b},0.07) 100%)`,
    borderTopColor: `rgba(${r},${g},${b},0.36)`,
  };
}

function parseHexColor(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Full-tile wash when only a platform / brand hex is known (e.g. Windows apps). */
export function brandCardWashFromHex(hex: string): CSSProperties | undefined {
  const rgb = parseHexColor(hex);
  return rgb ? brandCardWashFromRgb(rgb) : undefined;
}

/** Full-tile wash for icon-only streaming / bookmark tiles. */
export function brandCardWashFromRgb(rgb: Rgb): CSSProperties {
  const { r, g, b } = rgb;
  return {
    backgroundColor: "hsl(var(--card))",
    backgroundImage: `linear-gradient(
      165deg,
      rgba(${r},${g},${b},0.32) 0%,
      rgba(${r},${g},${b},0.14) 38%,
      hsl(var(--card)) 58%
    )`,
  };
}

/**
 * Footer wash derived from the same artwork as the shelf tile (matches library ambient logic).
 */
export function useShelfCardFooterTint(imageSampleUrl: string | null | undefined): {
  footerStyle: CSSProperties | undefined;
  brandCardStyle: CSSProperties | undefined;
  rgb: Rgb | null;
} {
  const [rgb, setRgb] = useState<Rgb | null>(null);

  useEffect(() => {
    if (!imageSampleUrl?.trim() || !isValidImageSource(imageSampleUrl)) {
      setRgb(null);
      return;
    }
    let cancelled = false;
    void extractVibrantDominantColorFromImageSource(imageSampleUrl).then((c) => {
      if (!cancelled) setRgb(c);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSampleUrl]);

  return {
    rgb,
    footerStyle: rgb ? footerGradientFromRgb(rgb) : undefined,
    brandCardStyle: rgb ? brandCardWashFromRgb(rgb) : undefined,
  };
}
