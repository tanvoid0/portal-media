import type { ReactNode } from "react";
import { getSafeImageSource } from "@/utils/imageUtils";
import { cn } from "@/lib/utils";

export function DetailsHeroFrame({
  variant,
  imageSrc,
  fallback,
  children,
}: {
  variant: "page" | "sidebar";
  imageSrc: string | null;
  fallback: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden bg-muted/40",
        variant === "page" &&
          "aspect-[21/9] max-h-[min(44vh,420px)] border-b border-border/35 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.45)]",
        variant === "sidebar" && "aspect-[16/10]"
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = getSafeImageSource(null);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">{fallback}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/35 to-transparent" />
      {children}
    </div>
  );
}
