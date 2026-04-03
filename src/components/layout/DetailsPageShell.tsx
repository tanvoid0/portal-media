import { useLayoutEffect, type RefObject, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DetailsPageShell({
  scrollRef,
  scrollResetKey,
  ariaLabel,
  className,
  children,
}: {
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollResetKey?: string | number;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    const el = scrollRef?.current;
    if (el) el.scrollTop = 0;
  }, [scrollResetKey, scrollRef]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-card/50 border-border/40",
        className
      )}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
