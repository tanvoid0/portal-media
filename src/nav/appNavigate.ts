import type { NavigateFunction } from "react-router-dom";
import { playUiSound } from "@/utils/uiSounds";

let navigateRef: NavigateFunction | null = null;

export function setAppNavigate(fn: NavigateFunction): void {
  navigateRef = fn;
}

export function appNavigate(to: string, options?: { replace?: boolean }): void {
  if (!options?.replace) playUiSound("select");
  navigateRef?.(to, options);
}
