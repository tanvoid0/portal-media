/**
 * Single source of truth for spatial + primary + back actions (keyboard, gamepad, TV remote).
 * Add new focus surfaces or input devices by extending helpers here and routing in the hook.
 */
import type { FocusArea } from "@/types/navigation";
import { useAppShellStore } from "@/stores/appShellStore";
import { useBrowserStore } from "@/stores/browserStore";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore, DETAILS_FOCUS_MAX_INDEX } from "@/stores/navigationStore";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";
import {
  ACTIVATE_SIDEBAR_EVENT,
  CLOSE_SHELL_SEARCH_EVENT,
  OPEN_SHELL_SEARCH_EVENT,
} from "@/types/app";

export const EXECUTE_DETAILS_ACTION = "executeDetailsAction";

export type SpatialDirection = "up" | "down" | "left" | "right";

const LAST_CATEGORY_INDEX = CATEGORY_NAV_ORDER.length - 1;

/** Main column + rail: Tab cycles these (details uses existing Back flow, not Tab). */
const SHELL_TAB_FOCUS_ORDER: FocusArea[] = ["sidebar", "category", "games"];

/** Focus transitions that should wait for layout (e.g. leaving sidebar rail). */
export type DelayedFocusArea = (area: FocusArea) => void;

/** Shared with the hook for delayed focus + shoulder-to-grid timing. */
export const UNIVERSAL_NAV_FOCUS_DELAY_MS = 150;

const DEFAULT_FOCUS_ANIMATION_MS = UNIVERSAL_NAV_FOCUS_DELAY_MS;

function emitActivateSidebar(index: number) {
  window.dispatchEvent(new CustomEvent(ACTIVATE_SIDEBAR_EVENT, { detail: index }));
}

function categoryRowAt(index: number) {
  return CATEGORY_NAV_ORDER[index];
}

function applyCategoryIndex(index: number) {
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  nav.setCategoryIndex(index);
  const row = categoryRowAt(index);
  if (row) {
    gs.setSelectedCategory(row.id);
  }
}

/** Embedded browser fills the window — shell spatial nav must yield to it. */
export function isSpatialNavigationBlocked(): boolean {
  const bs = useBrowserStore.getState();
  return bs.isOpen && !bs.isMinimized;
}

export function isLibraryViewActive(): boolean {
  return useAppShellStore.getState().currentView === "games";
}

/** Library (main grid): spatial + shell shortcuts apply. Settings uses native Tab and focused controls. */
export function isSettingsViewActive(): boolean {
  return useAppShellStore.getState().currentView === "settings";
}

function isInsideShellModal(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-shell-modal]"));
}

/** Go to library, reset shell focus, collapse search popup. */
export function applyGoToLibraryView(): void {
  useAppShellStore.getState().setCurrentView("games");
  const nav = useNavigationStore.getState();
  nav.setFocusArea("games");
  nav.setSidebarIndex(0);
  window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
}

export function openShellSearch(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SHELL_SEARCH_EVENT));
}

export function cycleShellFocusTab(reverse: boolean): void {
  const nav = useNavigationStore.getState();
  let fa = nav.focusArea;
  if (fa === "details") {
    fa = "games";
  }
  const i = SHELL_TAB_FOCUS_ORDER.indexOf(fa);
  const base = i === -1 ? 0 : i;
  const len = SHELL_TAB_FOCUS_ORDER.length;
  const next = SHELL_TAB_FOCUS_ORDER[(base + (reverse ? -1 : 1) + len) % len];
  nav.setFocusArea(next);
  if (next === "sidebar") {
    nav.setSidebarIndex(0);
  }
}

/**
 * Details panel requires a selected title; otherwise snap back to the grid.
 */
export function normalizeFocusAreaForContent(): void {
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  if (nav.focusArea === "details" && !gs.filteredGames[gs.selectedIndex]) {
    nav.setFocusArea("games");
  }
}

export function getEffectiveFocusArea(): FocusArea {
  normalizeFocusAreaForContent();
  return useNavigationStore.getState().focusArea;
}

/**
 * True when the event target is (or is inside) a field that should receive typing / native key behavior.
 */
export function shouldDelegateKeyboardToField(event: KeyboardEvent): boolean {
  const el = event.target;
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  if (el.isContentEditable) {
    return true;
  }
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (tag !== "INPUT") {
    return false;
  }
  const type = (el as HTMLInputElement).type;
  return !(
    type === "button" ||
    type === "submit" ||
    type === "reset" ||
    type === "checkbox" ||
    type === "radio" ||
    type === "range" ||
    type === "file"
  );
}

/**
 * Map arrow keys, `code`, and legacy remote `key` strings to a spatial direction.
 * Extend here when a new device reports odd `key`/`code` pairs.
 */
export function keyboardEventToSpatialDirection(event: KeyboardEvent): SpatialDirection | null {
  const k = event.key;
  const c = event.code;

  if (k === "ArrowUp" || k === "Up" || c === "ArrowUp" || c === "Numpad8") {
    return "up";
  }
  if (k === "ArrowDown" || k === "Down" || c === "ArrowDown" || c === "Numpad2") {
    return "down";
  }
  if (k === "ArrowLeft" || k === "Left" || c === "ArrowLeft" || c === "Numpad4") {
    return "left";
  }
  if (k === "ArrowRight" || k === "Right" || c === "ArrowRight" || c === "Numpad6") {
    return "right";
  }
  return null;
}

export type UniversalKeydownResult = "unhandled" | "handled";

/**
 * Single keyboard/remote pipeline: guards, spatial, primary, back, menu rail.
 * Call from `keydown` (capture optional). Sets nothing on stores except via apply* helpers.
 */
export function processUniversalKeydown(
  event: KeyboardEvent,
  delayedFocus: DelayedFocusArea
): UniversalKeydownResult {
  if (isSpatialNavigationBlocked()) {
    return "unhandled";
  }
  if (isInsideShellModal(event.target)) {
    return "unhandled";
  }
  if (shouldDelegateKeyboardToField(event)) {
    return "unhandled";
  }

  const onSettings = isSettingsViewActive();

  if (event.key === "Home") {
    event.preventDefault();
    applyGoToLibraryView();
    return "handled";
  }

  if (event.key === "ContextMenu" || event.key === "F10") {
    event.preventDefault();
    applyFocusLeftRail(delayedFocus);
    return "handled";
  }

  if (onSettings) {
    if (
      event.key === "Escape" ||
      event.key === "BrowserBack" ||
      event.key === "GoBack" ||
      event.code === "BrowserBack"
    ) {
      event.preventDefault();
      applyBackOrEscape(delayedFocus);
      return "handled";
    }
    return "unhandled";
  }

  if (event.key === "Tab") {
    event.preventDefault();
    cycleShellFocusTab(event.shiftKey);
    return "handled";
  }

  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    openShellSearch();
    return "handled";
  }

  const direction = keyboardEventToSpatialDirection(event);
  if (direction) {
    event.preventDefault();
    applySpatialNavigation(direction, delayedFocus);
    return "handled";
  }

  if (event.key === "Enter" || event.key === " " || event.code === "NumpadEnter") {
    event.preventDefault();
    applyPrimaryAction();
    return "handled";
  }

  if (
    event.key === "Escape" ||
    event.key === "BrowserBack" ||
    event.key === "GoBack" ||
    event.code === "BrowserBack"
  ) {
    event.preventDefault();
    applyBackOrEscape(delayedFocus);
    return "handled";
  }

  return "unhandled";
}

/** Horizontal move on the category strip (syncs filter with nav index). */
export function applyCategoryStripStep(direction: "left" | "right"): void {
  if (!isLibraryViewActive()) {
    return;
  }
  const nav = useNavigationStore.getState();
  const newIndex = nav.navigateCategory(direction);
  const row = categoryRowAt(newIndex);
  if (row) {
    useGameStore.getState().setSelectedCategory(row.id);
  }
}

/**
 * D-pad / stick / arrow keys: one implementation shared by keyboard and gamepad.
 */
export function applySpatialNavigation(direction: SpatialDirection, delayedFocus: DelayedFocusArea): void {
  if (!isLibraryViewActive()) {
    return;
  }
  normalizeFocusAreaForContent();
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  const fa = nav.focusArea;

  switch (direction) {
    case "up": {
      if (fa === "games") {
        const cols = Math.max(1, gs.gridColumnCount);
        if (gs.selectedIndex >= cols) {
          gs.selectRowUp();
        } else {
          nav.setFocusArea("category");
        }
        return;
      }
      if (fa === "details") {
        nav.navigateDetails("up");
        return;
      }
      if (fa === "category") {
        const ci = nav.categoryIndex;
        if (ci > 0) {
          applyCategoryIndex(ci - 1);
        }
        return;
      }
      if (fa === "sidebar") {
        const si = nav.sidebarIndex;
        if (si > 0) {
          const newIndex = nav.navigateSidebar("up");
          emitActivateSidebar(newIndex);
        } else {
          nav.setFocusArea("category");
          applyCategoryIndex(LAST_CATEGORY_INDEX);
        }
      }
      return;
    }
    case "down": {
      if (fa === "games") {
        const cols = Math.max(1, gs.gridColumnCount);
        if (gs.selectedIndex + cols < gs.filteredGames.length) {
          gs.selectRowDown();
        }
        return;
      }
      if (fa === "details") {
        nav.navigateDetails("down");
        return;
      }
      if (fa === "category") {
        const ci = nav.categoryIndex;
        if (ci < LAST_CATEGORY_INDEX) {
          applyCategoryIndex(ci + 1);
        } else {
          delayedFocus("sidebar");
          nav.setSidebarIndex(0);
          emitActivateSidebar(0);
        }
        return;
      }
      if (fa === "sidebar") {
        delayedFocus("games");
      }
      return;
    }
    case "left": {
      if (fa === "details") {
        return;
      }
      if (fa === "games") {
        gs.selectPrevious();
        return;
      }
      if (fa === "category") {
        applyCategoryStripStep("left");
        return;
      }
      if (fa === "sidebar") {
        delayedFocus("games");
      }
      return;
    }
    case "right": {
      if (fa === "details") {
        return;
      }
      if (fa === "games") {
        gs.selectNext();
        return;
      }
      if (fa === "category") {
        applyCategoryStripStep("right");
        return;
      }
      if (fa === "sidebar") {
        delayedFocus("games");
      }
      return;
    }
    default:
      return;
  }
}

/** Enter / OK / A — launch, activate row, or sidebar item. */
export function applyPrimaryAction(): void {
  const gs0 = useGameStore.getState();
  if (gs0.error) {
    gs0.clearError();
    return;
  }
  if (!isLibraryViewActive()) {
    return;
  }

  normalizeFocusAreaForContent();
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  const fa = nav.focusArea;
  const games = gs.filteredGames;
  const gi = gs.selectedIndex;

  if (fa === "games" && games[gi]) {
    void gs.launchGame(games[gi]);
    return;
  }
  if (fa === "details" && games[gi]) {
    window.dispatchEvent(new CustomEvent(EXECUTE_DETAILS_ACTION, { detail: nav.detailsIndex }));
    return;
  }
  if (fa === "sidebar") {
    emitActivateSidebar(nav.sidebarIndex);
    return;
  }
  if (fa === "category") {
    window.dispatchEvent(new CustomEvent("activateCategory", { detail: nav.categoryIndex }));
  }
}

/** Back / B / Escape hierarchy. */
export function applyBackOrEscape(delayedFocus: DelayedFocusArea): void {
  const gs = useGameStore.getState();
  if (gs.error) {
    gs.clearError();
    return;
  }
  if (isSettingsViewActive()) {
    applyGoToLibraryView();
    return;
  }

  const nav = useNavigationStore.getState();

  if (nav.focusArea === "details") {
    nav.setFocusArea("games");
    return;
  }
  if (nav.focusArea === "games") {
    const selected = gs.filteredGames[gs.selectedIndex];
    if (selected) {
      nav.setFocusArea("details");
      nav.setDetailsIndex(DETAILS_FOCUS_MAX_INDEX);
    } else {
      delayedFocus("sidebar");
      nav.setSidebarIndex(0);
    }
    return;
  }
  if (nav.focusArea === "category") {
    nav.setFocusArea("games");
    return;
  }
  if (nav.focusArea === "sidebar") {
    window.dispatchEvent(new CustomEvent("requestExit"));
  }
}

export function applyFocusLeftRail(delayedFocus: DelayedFocusArea): void {
  delayedFocus("sidebar");
  useNavigationStore.getState().setSidebarIndex(0);
}

/** LB/RB while on the grid: jump to category strip and step. */
export function applyCategoryBumperFromGames(direction: "left" | "right", delayedFocus: DelayedFocusArea): void {
  if (!isLibraryViewActive()) {
    return;
  }
  delayedFocus("category");
  const nav = useNavigationStore.getState();
  const newIndex = nav.navigateCategory(direction);
  const row = categoryRowAt(newIndex);
  if (row) {
    useGameStore.getState().setSelectedCategory(row.id);
  }
}

/** LT/RT from category row: move to grid then step selection after focus animation. */
export function applyShoulderScrollFromCategory(
  direction: "prev" | "next",
  delayedFocus: DelayedFocusArea,
  animationDelayMs: number = DEFAULT_FOCUS_ANIMATION_MS
): void {
  if (!isLibraryViewActive()) {
    return;
  }
  delayedFocus("games");
  window.setTimeout(() => {
    const g = useGameStore.getState();
    if (direction === "prev") {
      g.selectPrevious();
    } else {
      g.selectNext();
    }
  }, animationDelayMs);
}

export function applyGamepadMenuToggle(delayedFocus: DelayedFocusArea): void {
  const bs = useBrowserStore.getState();
  if (bs.isOpen) {
    bs.closeBrowser();
    useNavigationStore.getState().setFocusArea("games");
    return;
  }
  if (isSettingsViewActive()) {
    applyGoToLibraryView();
    return;
  }
  delayedFocus("sidebar");
  useNavigationStore.getState().setSidebarIndex(0);
}
