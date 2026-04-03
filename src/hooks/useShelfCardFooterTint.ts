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

/**
 * Footer wash derived from the same artwork as the shelf tile (matches library ambient logic).
 */
export function useShelfCardFooterTint(imageSampleUrl: string | null | undefined): {
  footerStyle: CSSProperties | undefined;
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
  };
}
