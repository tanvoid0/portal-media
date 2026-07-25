import type { NavigateFunction } from "react-router-dom";
import { playUiSound } from "@/utils/uiSounds";

let navigateRef: NavigateFunction | null = null;

export function setAppNavigate(fn: NavigateFunction): void {
  navigateRef = fn;
}

export function appNavigate(to: string, options?: { replace?: boolean }): void {
  // Route commits are "select" moments; playUiSound dedupes against the
  // controller path which already played via feedbackSelect.
  if (!options?.replace) playUiSound("select");
  navigateRef?.(to, options);
}
