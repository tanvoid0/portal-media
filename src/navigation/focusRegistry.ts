/**
 * Spatial focus registry — geometry-based grid navigation.
 *
 * Each grid surface registers its container ref here. On directional input,
 * the spatial solver queries child bounding rects and picks the nearest
 * candidate in the requested direction — identical to how Steam, PS, and Xbox
 * OS shells handle D-pad / arrow-key navigation in grids.
 *
 * No column count tracking required. Works for any CSS grid layout,
 * including irregular column counts and mixed card sizes.
 */

import type { RefObject } from "react";
import type { SpatialDirection } from "./universalNavCore";

export type GridGroup = "games" | "discover";

// Stores the stable React ref object; .current is read at navigation time
// so conditional rendering is handled automatically.
const gridRefs = new Map<GridGroup, RefObject<HTMLElement | null>>();

export function registerGridContainer(
  group: GridGroup,
  ref: RefObject<HTMLElement | null>
): () => void {
  gridRefs.set(group, ref);
  return () => {
    if (gridRefs.get(group) === ref) gridRefs.delete(group);
  };
}

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Score a candidate rect relative to the current rect in a given direction.
 * Returns null when the candidate is in the wrong half-plane.
 * Lower score = better candidate.
 *
 * Perpendicular distance is weighted 2× so the algorithm strongly prefers
 * staying in the same column (up/down) or same row (left/right).
 */
export function spatialScore(
  current: DOMRect,
  candidate: DOMRect,
  direction: SpatialDirection
): number | null {
  const cc = centerOf(current);
  const tc = centerOf(candidate);
  const dx = tc.x - cc.x;
  const dy = tc.y - cc.y;

  switch (direction) {
    case "up":
      if (dy >= -1) return null;
      return Math.abs(dx) * 2 + Math.abs(dy);
    case "down":
      if (dy <= 1) return null;
      return Math.abs(dx) * 2 + Math.abs(dy);
    case "left":
      if (dx >= -1) return null;
      return Math.abs(dx) + Math.abs(dy) * 2;
    case "right":
      if (dx <= 1) return null;
      return Math.abs(dx) + Math.abs(dy) * 2;
  }
}

/**
 * Find the nearest grid item index in the given direction using bounding rects.
 * Returns null on boundary hit (no candidate in that direction).
 *
 * @param group     Which grid surface to query
 * @param currentIndex  Currently selected item index
 * @param direction     D-pad / arrow direction
 * @param itemCount     Logical item count (may be less than rendered children)
 */
export function spatialNavigateGrid(
  group: GridGroup,
  currentIndex: number,
  direction: SpatialDirection,
  itemCount: number
): number | null {
  const ref = gridRefs.get(group);
  const container = ref?.current;
  if (!container) return null;

  const children = container.children;
  const count = Math.min(children.length, itemCount);
  if (count === 0 || currentIndex < 0 || currentIndex >= count) return null;

  const currentEl = children[currentIndex];
  if (!currentEl) return null;

  const currentRect = currentEl.getBoundingClientRect();
  if (currentRect.width === 0 && currentRect.height === 0) return null;

  let bestIndex: number | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < count; i++) {
    if (i === currentIndex) continue;
    const el = children[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const score = spatialScore(currentRect, rect, direction);
    if (score !== null && score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
