import { type RefObject, useEffect } from "react";
import { countGridColumns } from "@/utils/countGridColumns";

export interface GridColumnSyncOptions {
  itemCount: number;
  enabled?: boolean;
  /** When this changes, column count is recomputed (e.g. loading flag, route). */
  layoutEpoch?: unknown;
}

/**
 * Keeps store navigation in sync with the visual CSS grid column count (D-pad / gamepad row moves).
 */
export function useGridColumnCountSync(
  containerRef: RefObject<HTMLElement | null>,
  setColumnCount: (columns: number) => void,
  options: GridColumnSyncOptions
): void {
  const { itemCount, enabled = true, layoutEpoch } = options;

  useEffect(() => {
    if (!enabled || itemCount <= 0) return;
    const el = containerRef.current;
    if (!el) return;

    const sync = () => setColumnCount(countGridColumns(el));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled, itemCount, layoutEpoch, setColumnCount]);
}
