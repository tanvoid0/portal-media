import type { ReactNode } from "react";
import { useNavigationStore } from "@/stores/navigationStore";
import { useFocusable } from "@/hooks/useNavigationState";
import { cn } from "@/lib/utils";

export function DetailsFocusControl({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const { detailsIndex } = useNavigationStore();
  const { isFocused, showFocusIndicator } = useFocusable("details", index);
  const isFocusedItem = isFocused && detailsIndex === index;

  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-panel spring-ease",
        isFocusedItem && showFocusIndicator && "ring-2 ring-primary/60 ring-offset-2 ring-offset-card animate-focus-ring",
        className
      )}
    >
      {children}
    </div>
  );
}
