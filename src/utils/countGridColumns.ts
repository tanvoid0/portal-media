/** Resolves column count from static `grid-template-columns` (from `repeat(auto-fill, …)`). */
export function countGridColumns(gridEl: HTMLElement): number {
  const raw = window.getComputedStyle(gridEl).gridTemplateColumns;
  if (!raw || raw === "none") return 1;
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, parts.length);
}
