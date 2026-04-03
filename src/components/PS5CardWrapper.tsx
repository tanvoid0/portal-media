import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PS5CardWrapperProps {
  children: ReactNode;
  isSelected: boolean;
  isHovered?: boolean;
  className?: string;
}

/**
 * PS5-style card wrapper with enhanced depth and glow effects
 */
export function PS5CardWrapper({ 
  children, 
  isSelected, 
  isHovered = false,
  className 
}: PS5CardWrapperProps) {
  return (
    <div
      className={cn(
        "relative transition-all duration-300 ease-out transform-gpu",
        isSelected 
          ? "scale-[1.08] z-10 translate-y-[-4px]" 
          : isHovered
          ? "scale-[1.02] z-20 translate-y-[-2px]"
          : "scale-100 z-0",
        className
      )}
    >
      {children}
    </div>
  );
}

