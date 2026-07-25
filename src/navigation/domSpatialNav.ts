/**
 * Generic DOM spatial navigation — controller/arrow-key focus movement over
 * ordinary focusable elements (settings, docs, any form-style surface).
 *
 * Unlike `focusRegistry` (index-based grids), this walks the live DOM: collect
 * visible focusables, score their rects with the same geometry solver, move
 * real DOM focus. Zero per-page wiring — same approach Steam Big Picture uses
 * for web-ish surfaces.
 */

import type { SpatialDirection } from "./universalNavCore";
import { spatialScore } from "./focusRegistry";
import { playUiSound } from "@/utils/uiSounds";

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Attribute used by CSS to render the console-style focus ring (see index.css). */
const FOCUS_ATTR = "data-console-focus";

const SCROLL_STEP_PX = 160;

function isNavigable(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  return true;
}

function collectFocusables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(isNavigable);
}

function markConsoleFocus(el: HTMLElement): void {
  el.setAttribute(FOCUS_ATTR, "");
  el.addEventListener("blur", () => el.removeAttribute(FOCUS_ATTR), { once: true });
}

function focusElement(el: HTMLElement): void {
  el.focus();
  markConsoleFocus(el);
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

/** Currently focused element if it is one of ours, else null. */
function currentFocusable(candidates: HTMLElement[]): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && candidates.includes(active) ? active : null;
}

export function isRangeInput(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === "range";
}

/**
 * Adjust a focused native range input from gamepad d-pad left/right,
 * firing the events React's onChange listens for.
 */
export function adjustFocusedRange(direction: "left" | "right"): boolean {
  const el = document.activeElement;
  if (!isRangeInput(el)) return false;
  const step = Number(el.step) || 1;
  const min = el.min === "" ? -Infinity : Number(el.min);
  const max = el.max === "" ? Infinity : Number(el.max);
  const next = Math.min(max, Math.max(min, Number(el.value) + (direction === "right" ? step : -step)));
  if (next === Number(el.value)) return true; // at bound — still "handled"
  // Native setter so controlled React inputs pick the change up via the input event.
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!setter) return false;
  setter.call(el, String(next));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/**
 * Move DOM focus in a direction. Returns true when focus moved (or was
 * established for the first time), false on boundary / nothing focusable.
 */
export function domSpatialMove(direction: SpatialDirection): boolean {
  const candidates = collectFocusables();
  if (candidates.length === 0) return false;

  const current = currentFocusable(candidates);
  if (!current) {
    // Nothing focused yet: start at the top-left-most visible control.
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.top < 0) continue; // prefer on-screen entries
      const score = r.top * 2 + r.left;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    const target = best ?? candidates[0];
    focusElement(target);
    return true;
  }

  const currentRect = current.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    if (el === current) continue;
    const score = spatialScore(currentRect, el.getBoundingClientRect(), direction);
    if (score !== null && score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return false;
  focusElement(best);
  return true;
}

/** Click whatever holds focus (gamepad primary). */
export function domActivateFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return false;
  el.click();
  return true;
}

/**
 * Boundary fallback: scroll the nearest scrollable ancestor of the focused
 * element (or the page) so long prose surfaces like docs stay reachable.
 */
export function domScrollFallback(direction: SpatialDirection): void {
  const from = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let node: HTMLElement | null = from;
  let scroller: Element | null = null;
  while (node) {
    const style = window.getComputedStyle(node);
    const scrollableY = node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(style.overflowY);
    const scrollableX = node.scrollWidth > node.clientWidth && /(auto|scroll)/.test(style.overflowX);
    if (scrollableY || scrollableX) {
      scroller = node;
      break;
    }
    node = node.parentElement;
  }
  scroller ??= document.scrollingElement;
  if (!scroller) return;
  const top = direction === "up" ? -SCROLL_STEP_PX : direction === "down" ? SCROLL_STEP_PX : 0;
  const left = direction === "left" ? -SCROLL_STEP_PX : direction === "right" ? SCROLL_STEP_PX : 0;
  scroller.scrollBy({ top, left, behavior: "smooth" });
}

/** Move, falling back to scroll on boundary. */
export function domSpatialMoveOrScroll(direction: SpatialDirection): void {
  playUiSound("move");
  if (!domSpatialMove(direction)) {
    domScrollFallback(direction);
  }
}
