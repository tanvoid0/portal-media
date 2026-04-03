import type { NavigateFunction } from "react-router-dom";

let navigateRef: NavigateFunction | null = null;

export function setAppNavigate(fn: NavigateFunction): void {
  navigateRef = fn;
}

export function appNavigate(to: string, options?: { replace?: boolean }): void {
  navigateRef?.(to, options);
}
