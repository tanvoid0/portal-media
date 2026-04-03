/**
 * Declarative CSS grid preset for “remote first” item surfaces (library, discover, etc.).
 * Use {@link buildContentGridContainerClassName} plus {@link contentGridTemplateColumnsStyle}
 * (inline `grid-template-columns`) so Tailwind JIT does not omit dynamic grid classes.
 */
export interface ContentGridPreset {
  minTileWidthPx: number;
  gapClass: string;
  paddingClass: string;
  scrollPaddingClass: string;
  /** Extra classes on the scroll/grid container (z-index, auto-rows, …). */
  containerClassName?: string;
}
