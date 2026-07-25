import { cn } from "@/lib/utils";

interface ShelfFocusRingProps {
  isVisible: boolean;
  className?: string;
}

/** Animated focus ring for horizontal shelf tiles (large cards, soft pulse). */
export function ShelfFocusRing({ isVisible, className }: ShelfFocusRingProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none rounded-t-[var(--radius-card)] z-40",
        "border-2 border-primary/80",
        "shadow-[inset_0_0_24px_hsl(var(--primary)/0.12)]",
        "animate-focus-ring",
        className
      )}
    />
  );
}
