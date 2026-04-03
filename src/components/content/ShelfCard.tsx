import { forwardRef, type MouseEventHandler, type ReactNode, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { contentTileLibraryCardClasses } from "@/utils/contentTileStyles";
import { useSelectable } from "@/hooks/useNavigationState";
import { ShelfFocusRing } from "@/components/ShelfFocusRing";
import { getSafeImageSource } from "@/utils/imageUtils";
import { useShelfCardFooterTint } from "@/hooks/useShelfCardFooterTint";

export interface ShelfCardProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Card>, "children" | "onClick"> {
  onClick?: MouseEventHandler<HTMLDivElement>;
  isSelected: boolean;
  title: string;
  subtitle?: string | null;
  /** Shown when spatial (remote) selection is active, e.g. “Enter · Launch”. */
  actionHint?: string | null;
  /** Raw image URL (fed through `getSafeImageSource` for display + sampling). */
  artImageUrl: string | null;
  artMode: "posterCover" | "iconContain";
  /** Skip dominant-color footer tint (e.g. Windows app icons — show art without sampling). */
  skipFooterTint?: boolean;
  placeholder?: ReactNode;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  footerAccessory?: ReactNode;
}

/**
 * Shared “shelf” tile: poster or icon hero, dominant-tint footer, remote-first focus.
 * Used by library items and discover rows for consistent living-room UX.
 */
export const ShelfCard = forwardRef<HTMLDivElement, ShelfCardProps>(function ShelfCard(
  {
    isSelected,
    title,
    subtitle,
    actionHint,
    artImageUrl,
    artMode,
    skipFooterTint = false,
    placeholder,
    topLeft,
    topRight,
    footerAccessory,
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
  const { footerStyle } = useShelfCardFooterTint(tintSampleUrl);

  const posterLike = artMode === "posterCover";

  return (
    <Card
      ref={ref}
      className={cn(
        "relative h-[26rem] w-56 overflow-hidden group/card",
        contentTileLibraryCardClasses({
          showRemoteFocus: showSelection,
          mouseSelected,
          hovered: isHovered,
        }),
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        onMouseLeave?.(e);
      }}
      onContextMenu={onContextMenu}
      {...rest}
    >
      <CardContent className="p-0 h-full flex flex-col">
        <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-muted/20 to-muted/40">
          {topLeft ? <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">{topLeft}</div> : null}
          {safeArt ? (
            <div
              className={cn(
                "relative h-full w-full",
                artMode === "iconContain" && "flex items-center justify-center bg-muted/50 p-8"
              )}
            >
              <img
                src={safeArt}
                alt={title}
                className={cn(
                  "transition-all duration-300",
                  posterLike ? "h-full w-full object-cover" : "max-h-64 max-w-64 h-auto w-auto object-contain mx-auto drop-shadow-sm",
                  showSelection && "brightness-105",
                  isHovered && "brightness-[1.02] scale-[1.02]"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSafeImageSource(null);
                }}
              />
              {posterLike ? (
                <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent pointer-events-none" />
              ) : null}
              {topRight ? (
                <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">{topRight}</div>
              ) : null}
            </div>
          ) : (
            <div className="relative h-full w-full bg-muted/50 flex items-center justify-center">
              <div className="text-center flex flex-col items-center">
                {placeholder}
                <p className="text-foreground/70 text-sm font-medium px-4 line-clamp-4 leading-snug text-center">
                  {title}
                </p>
              </div>
              {topRight ? (
                <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">{topRight}</div>
              ) : null}
            </div>
          )}

          {showSelection && <ShelfFocusRing isVisible={true} />}
        </div>

        <div
          className={cn(
            "p-4 pt-3.5 border-t border-border/50",
            !footerStyle && "bg-gradient-to-b from-card to-muted/25"
          )}
          style={footerStyle}
        >
          <h3
            className={cn(
              "text-foreground font-semibold text-[0.95rem] leading-snug line-clamp-3",
              subtitle ? "mb-1" : showSelection ? "mb-2" : "mb-0"
            )}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="text-xs text-muted-foreground line-clamp-1 font-medium tracking-wide">{subtitle}</p>
          ) : null}
          {footerAccessory}
          {showSelection && actionHint ? (
            <div className="flex justify-end mt-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                {actionHint}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
});
