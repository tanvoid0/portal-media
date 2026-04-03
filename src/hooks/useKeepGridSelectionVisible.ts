import { type RefObject, useLayoutEffect } from "react";

export interface KeepGridSelectionVisibleOptions {
  /** Minimum space between focused tile and container edge before scrolling. */
  edgePadding?: number;
}

/**
 * Scrolls the focused grid item into the scrollable container when clipped (keyboard / gamepad / pointer).
 */
export function useKeepGridSelectionVisible(
  containerRef: RefObject<HTMLElement | null>,
  focusedElementRef: RefObject<HTMLElement | null>,
  deps: { selectedIndex: number; itemCount: number },
  options?: KeepGridSelectionVisibleOptions
): void {
  const edgePadding = options?.edgePadding ?? 12;

  useLayoutEffect(() => {
    if (deps.itemCount <= 0) return;
    const container = containerRef.current;
    const el = focusedElementRef.current;
    if (!container || !el) return;

    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const clippedTop = r.top < c.top + edgePadding;
    const clippedBottom = r.bottom > c.bottom - edgePadding;
    if (!clippedTop && !clippedBottom) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [deps.selectedIndex, deps.itemCount, edgePadding]);
}
