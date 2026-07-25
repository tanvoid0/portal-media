import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small frosted badge for shelf tile corners (favorite, not installed, etc.). */
export function ShelfStatusBadge({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none flex h-8 w-8 items-center justify-center rounded-lg",
        "bg-black/50 text-foreground/90 backdrop-blur-md",
        "border border-white/12 shadow-md ring-1 ring-black/20",
        className
      )}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {children}
    </div>
  );
}
