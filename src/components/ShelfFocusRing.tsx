import { cn } from "@/lib/utils";

interface ShelfFocusRingProps {
  isVisible: boolean;
  className?: string;
}

/** Hard inset frame — matches the control deck. No glow. */
export function ShelfFocusRing({ isVisible, className }: ShelfFocusRingProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none z-40 rounded-none border-[3px] border-primary",
        className
      )}
    />
  );
}
