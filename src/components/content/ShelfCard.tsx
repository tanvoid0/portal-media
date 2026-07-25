import { forwardRef, type MouseEventHandler, type ReactNode, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { contentTileLibraryCardClasses } from "@/utils/contentTileStyles";
import { useSelectable } from "@/hooks/useNavigationState";
import { ShelfFocusRing } from "@/components/ShelfFocusRing";
import { getSafeImageSource } from "@/utils/imageUtils";
import {
  brandCardWashFromHex,
  useShelfCardFooterTint,
} from "@/hooks/useShelfCardFooterTint";
import type { ShelfCardArtMode } from "@/utils/libraryCardArtMode";

const LIBRARY_TILE_CLASS = "relative h-[23rem] w-56 overflow-hidden group/card rounded-card";

export interface ShelfCardProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Card>, "children" | "onClick"> {
  onClick?: MouseEventHandler<HTMLDivElement>;
  isSelected: boolean;
  title: string;
  subtitle?: string | null;
  actionHint?: string | null;
  artImageUrl: string | null;
  /** Discover grids; library items should pass `libraryLayout` instead. */
  artMode?: ShelfCardArtMode;
  /** Unified library shell — same size/footer for games, apps, media, bookmarks. */
  libraryLayout?: "poster" | "mark";
  /** `app` uses a slightly roomier mark frame for OS icons. */
  markFrameKind?: "app" | "default";
  skipFooterTint?: boolean;
  placeholder?: ReactNode;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  footerAccessory?: ReactNode;
  brandHero?: ReactNode;
  brandAccentHex?: string | null;
}

/**
 * Unified shelf card footer. Handles three layout modes:
 * - `band` (library layout): fixed-height caption strip below art
 * - `overlay` (discover poster): absolute scrim over art bottom
 * - default (discover non-poster): border-top strip, no fixed height
 */
function ShelfCardFooter({
  title,
  subtitle,
  footerAccessory,
  actionHint,
  showSelection,
  footerStyle,
  overlay = false,
  band = false,
}: {
  title: string;
  subtitle?: string | null;
  footerAccessory?: ReactNode;
  actionHint?: string | null;
  showSelection: boolean;
  footerStyle?: React.CSSProperties;
  overlay?: boolean;
  band?: boolean;
}) {
  return (
    <div
      className={cn(
        overlay
          ? "absolute inset-x-0 bottom-0 z-20 px-3.5 pb-3.5 pt-12 pointer-events-none"
          : band
            ? "relative shrink-0 flex flex-col justify-end min-h-[6rem] px-3.5 pb-3.5 pt-3"
            : "px-3.5 py-3.5 border-t border-border/25",
        !overlay && !footerStyle && (
          band
            ? "bg-gradient-to-b from-card/95 via-card to-card border-t border-border/20"
            : "bg-gradient-to-b from-card/95 to-card"
        )
      )}
      style={footerStyle}
    >
      {overlay ? (
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none"
          aria-hidden
        />
      ) : null}
      <div className={cn(overlay && "relative")}>
        <h3
          className={cn(
            "font-semibold leading-snug tracking-tight text-foreground",
            overlay
              ? "text-[0.9375rem] line-clamp-2 drop-shadow-sm"
              : "text-[0.9375rem] line-clamp-2"
          )}
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/90 line-clamp-1 font-medium tracking-wide">
            {subtitle}
          </p>
        ) : null}
        {footerAccessory ? <div className="mt-2">{footerAccessory}</div> : null}
        {showSelection && actionHint ? (
          <div className={cn("flex justify-end", footerAccessory || subtitle ? "mt-2" : "mt-2")}>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5",
                "text-[10px] uppercase tracking-widest font-bold",
                "bg-primary/15 text-primary border border-primary/30",
                overlay && "backdrop-blur-sm"
              )}
            >
              {actionHint}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shared shelf tile. Library items use `libraryLayout` (unified hero + caption band).
 * Discover rows use `artMode` with overlay poster captions.
 */
export const ShelfCard = forwardRef<HTMLDivElement, ShelfCardProps>(function ShelfCard(
  {
    isSelected,
    title,
    subtitle,
    actionHint,
    artImageUrl,
    artMode = "posterCover",
    libraryLayout,
    markFrameKind = "default",
    skipFooterTint = false,
    placeholder,
    topLeft,
    topRight,
    footerAccessory,
    brandHero,
    brandAccentHex,
    className,
    onClick,
    onDoubleClick,
    onMouseEnter,
    onMouseLeave,
    onContextMenu,
    ...rest
  },
  ref
) {
  const { showSelection } = useSelectable(isSelected);
  const [isHovered, setIsHovered] = useState(false);
  const mouseSelected = isSelected && !showSelection;

  const placeholderArt = useMemo(() => getSafeImageSource(null), []);
  const safeArt = artImageUrl ? getSafeImageSource(artImageUrl) : null;
  const tintSampleUrl =
    skipFooterTint || !safeArt || safeArt === placeholderArt ? null : safeArt;
  const { footerStyle, brandCardStyle } = useShelfCardFooterTint(tintSampleUrl);

  const accentWash =
    libraryLayout && !brandCardStyle && brandAccentHex
      ? brandCardWashFromHex(brandAccentHex)
      : undefined;

  const cardSurfaceProps = {
    onClick,
    onDoubleClick,
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      onMouseLeave?.(e);
    },
    onContextMenu,
  };

  if (libraryLayout) {
    const posterHero = libraryLayout === "poster";
    const appFrame = markFrameKind === "app";
    const hasHeroVisual = Boolean(safeArt || brandHero);

    return (
      <Card
        ref={ref}
        className={cn(
          LIBRARY_TILE_CLASS,
          contentTileLibraryCardClasses({
            showRemoteFocus: showSelection,
            mouseSelected,
            hovered: isHovered,
          }),
          className
        )}
        style={brandCardStyle ?? accentWash}
        {...cardSurfaceProps}
        {...rest}
      >
        <CardContent className="p-0 h-full flex flex-col">
          {topLeft ? (
            <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none">{topLeft}</div>
          ) : null}
          {topRight ? (
            <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none">{topRight}</div>
          ) : null}

          <div
            className={cn(
              "relative flex-[1.2] min-h-0 overflow-hidden shelf-card-hero-shine",
              posterHero ? "bg-muted/20" : "flex items-center justify-center px-5 pt-5 pb-2"
            )}
          >
            {posterHero && safeArt ? (
              <>
                <img
                  src={safeArt}
                  alt={title}
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-300 ease-out",
                    showSelection && "brightness-[1.06] saturate-[1.05]",
                    isHovered && "scale-[1.03]"
                  )}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getSafeImageSource(null);
                  }}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-background/75 via-background/15 to-transparent pointer-events-none"
                  aria-hidden
                />
                <div
                  className="absolute inset-0 ring-1 ring-inset ring-white/5 pointer-events-none"
                  aria-hidden
                />
              </>
            ) : posterHero ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
                {placeholder}
              </div>
            ) : hasHeroVisual ? (
              <div
                className={cn(
                  "flex items-center justify-center rounded-2xl transition-transform duration-300 ease-out",
                  "backdrop-blur-sm border shadow-lg ring-1 ring-inset ring-white/5",
                  appFrame
                    ? "size-[11rem] bg-background/35 border-white/12 p-5"
                    : "size-[10.5rem] bg-background/25 border-white/10 p-4",
                  showSelection && "brightness-105",
                  isHovered && "scale-[1.02]"
                )}
              >
                {brandHero ? (
                  brandHero
                ) : safeArt ? (
                  <img
                    src={safeArt}
                    alt={title}
                    className={cn(
                      "object-contain drop-shadow-md",
                      appFrame
                        ? "size-[5.75rem] min-h-[4.5rem] min-w-[4.5rem]"
                        : "max-h-full max-w-full"
                    )}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getSafeImageSource(null);
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-2xl",
                  appFrame
                    ? "size-[11rem] bg-background/35 border border-white/12 p-6"
                    : "size-[10.5rem] bg-background/25 border border-white/10 p-5"
                )}
              >
                {placeholder}
              </div>
            )}
            {showSelection && <ShelfFocusRing isVisible={true} />}
          </div>

          <ShelfCardFooter
            title={title}
            subtitle={subtitle}
            footerAccessory={footerAccessory}
            actionHint={actionHint}
            showSelection={showSelection}
            footerStyle={footerStyle}
            band
          />
        </CardContent>
      </Card>
    );
  }

  const posterLike = artMode === "posterCover";
  const overlayFooter = posterLike && !!safeArt;

  const discoverFooter = (
    <ShelfCardFooter
      title={title}
      subtitle={subtitle}
      footerAccessory={footerAccessory}
      actionHint={actionHint}
      showSelection={showSelection}
      footerStyle={footerStyle}
      overlay={overlayFooter}
    />
  );

  return (
    <Card
      ref={ref}
      className={cn(
        "relative h-[26rem] w-56 overflow-hidden group/card rounded-card",
        contentTileLibraryCardClasses({
          showRemoteFocus: showSelection,
          mouseSelected,
          hovered: isHovered,
        }),
        className
      )}
      {...cardSurfaceProps}
      {...rest}
    >
      <CardContent className="p-0 h-full flex flex-col">
        <div
          className={cn(
            "relative flex-1 min-h-0 overflow-hidden",
            "bg-gradient-to-br from-muted/25 via-muted/15 to-muted/35",
            overlayFooter ? "flex flex-col" : ""
          )}
        >
          {topLeft ? (
            <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none">{topLeft}</div>
          ) : null}

          {safeArt ? (
            <div
              className={cn(
                "relative flex-1 min-h-0 w-full shelf-card-hero-shine",
                artMode === "iconContain" &&
                  "flex items-center justify-center bg-gradient-to-b from-muted/30 to-muted/50 p-7"
              )}
            >
              <img
                src={safeArt}
                alt={title}
                className={cn(
                  "transition-[transform,filter] duration-300 ease-out",
                  posterLike
                    ? "h-full w-full object-cover"
                    : "max-h-[13.5rem] max-w-[13.5rem] h-auto w-auto object-contain mx-auto drop-shadow-lg",
                  showSelection && posterLike && "brightness-[1.06] saturate-[1.05]",
                  showSelection && !posterLike && "brightness-105",
                  isHovered && posterLike && "scale-[1.04]",
                  isHovered && !posterLike && "scale-[1.03]"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSafeImageSource(null);
                }}
              />
              {posterLike ? (
                <>
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-background/5 pointer-events-none"
                    aria-hidden
                  />
                  <div
                    className="absolute inset-0 ring-1 ring-inset ring-white/5 pointer-events-none rounded-t-[inherit]"
                    aria-hidden
                  />
                </>
              ) : null}
              {topRight ? (
                <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none">{topRight}</div>
              ) : null}
              {overlayFooter ? discoverFooter : null}
            </div>
          ) : (
            <div className="relative flex-1 min-h-0 w-full flex items-center justify-center shelf-card-hero-shine">
              <div
                className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_at_50%_30%,hsl(var(--primary)/0.12),transparent_65%)]"
                aria-hidden
              />
              <div className="relative z-10 text-center flex flex-col items-center px-5">
                {placeholder}
                <p className="text-foreground/80 text-sm font-semibold mt-1 px-2 line-clamp-3 leading-snug text-center tracking-tight">
                  {title}
                </p>
                {subtitle ? (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 font-medium">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {topRight ? (
                <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none">{topRight}</div>
              ) : null}
            </div>
          )}

          {showSelection && <ShelfFocusRing isVisible={true} />}
        </div>

        {!overlayFooter && safeArt ? discoverFooter : null}
        {!safeArt && (footerAccessory || (showSelection && actionHint)) ? (
          <ShelfCardFooter
            title=""
            subtitle={undefined}
            footerAccessory={footerAccessory}
            actionHint={actionHint}
            showSelection={showSelection}
            footerStyle={undefined}
          />
        ) : null}
      </CardContent>
    </Card>
  );
});
