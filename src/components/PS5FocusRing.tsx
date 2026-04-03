import { cn } from "@/lib/utils";

interface PS5FocusRingProps {
  isVisible: boolean;
  className?: string;
}

/**
 * PS5-style focus ring component with smooth glow animation
 */
export function PS5FocusRing({ isVisible, className }: PS5FocusRingProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 rounded-sm pointer-events-none",
        "border-2 border-primary",
        "animate-focus-ring",
        className
      )}
    />
  );
}

