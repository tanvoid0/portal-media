import { ReactNode, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SmoothScrollShelfProps {
  children: ReactNode;
  selectedIndex: number;
  isActive: boolean;
  className?: string;
  itemWidth?: number;
  gap?: number;
}

/** Horizontal shelf with smooth scroll-to-selection (TV-style row). */
export function SmoothScrollShelf({
  children,
  selectedIndex,
  isActive,
  className,
  itemWidth = 224, // w-56 = 224px
  gap = 24, // gap-6 = 24px
}: SmoothScrollShelfProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current || !selectedItemRef.current) {
      return;
    }

    const container = containerRef.current;
    const item = selectedItemRef.current;

    const itemLeft = item.offsetLeft;
    const itemWidth = item.offsetWidth;
    const containerWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;

    const itemCenter = itemLeft + itemWidth / 2;
    const containerCenter = scrollLeft + containerWidth / 2;
    const targetScroll = itemCenter - containerCenter;

    if (Math.abs(targetScroll) > 10) {
      container.scrollTo({
        left: scrollLeft + targetScroll * 0.3,
        behavior: "smooth",
      });
    }
  }, [selectedIndex, isActive, itemWidth, gap]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-x-auto overflow-y-hidden scrollbar-hide",
        "scroll-smooth",
        className
      )}
      style={{
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
