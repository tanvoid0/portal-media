import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSafeImageSource, isValidImageSource } from "@/utils/imageUtils";
import { linkIconFromUrl } from "@/utils/igdbLinkIcons";
import { tailwindIconTextClassForExternalUrl } from "@/utils/linkBrandFromUrl";

const SIZE = {
  sm: { icon: "h-3.5 w-3.5", img: "h-6 w-6" },
  md: { icon: "h-5 w-5", img: "h-7 w-7" },
  lg: { icon: "h-6 w-6", img: "h-8 w-8" },
} as const;

export type ExternalLinkGlyphSize = keyof typeof SIZE;

/**
 * Leading mark for a URL: shows `imageUrl` when it loads; otherwise a Lucide icon from
 * {@link linkIconFromUrl} (host/path + optional label hint).
 */
export function ExternalLinkGlyph({
  url,
  labelHint,
  imageUrl,
  size = "md",
  className,
  iconClassName,
  imgClassName,
  /** Applied when the URL does not match a known brand (default: muted, not theme primary). */
  neutralIconClassName,
}: {
  url: string;
  labelHint?: string;
  imageUrl?: string | null;
  size?: ExternalLinkGlyphSize;
  className?: string;
  iconClassName?: string;
  imgClassName?: string;
  neutralIconClassName?: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const s = SIZE[size];

  useEffect(() => {
    setImgBroken(false);
  }, [imageUrl]);

  const showImg = Boolean(imageUrl?.trim()) && isValidImageSource(imageUrl) && !imgBroken;

  if (showImg) {
    return (
      <img
        src={getSafeImageSource(imageUrl)}
        alt=""
        className={cn(
          s.img,
          "shrink-0 rounded-md object-contain bg-background/80 border border-border/35 p-0.5",
          imgClassName,
          className
        )}
        onError={() => setImgBroken(true)}
      />
    );
  }

  const Icon = linkIconFromUrl(url, labelHint);
  const brandTint = tailwindIconTextClassForExternalUrl(url, neutralIconClassName ?? "text-muted-foreground");
  return (
    <Icon
      className={cn(s.icon, "shrink-0 opacity-95", brandTint, iconClassName, className)}
      aria-hidden
    />
  );
}
