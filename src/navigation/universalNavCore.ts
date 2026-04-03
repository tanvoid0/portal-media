/**
 * Single source of truth for spatial + primary + back actions (keyboard, gamepad, TV remote).
 * Add new focus surfaces or input devices by extending helpers here and routing in the hook.
 */
import type { FocusArea } from "@/types/navigation";
import { useAppShellStore } from "@/stores/appShellStore";
import { useBrowserStore } from "@/stores/browserStore";
import { useGameStore } from "@/stores/gameStore";
import { useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import { DISCOVER_CATEGORY_ID } from "@/types/game";
import { useNavigationStore } from "@/stores/navigationStore";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";
import {
  ACTIVATE_SIDEBAR_EVENT,
  CLOSE_SHELL_SEARCH_EVENT,
  EXECUTE_GAME_CONTEXT_EVENT,
  OPEN_SHELL_SEARCH_EVENT,
} from "@/types/app";
import { appNavigate } from "@/nav/appNavigate";
import { libraryPathForCategory } from "@/nav/libraryRoutes";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { getNavBinding, isNavActionKeyboardMatch, useNavBindingsStore } from "@/stores/navBindingsStore";
import { spatialDirectionFromKeyboard } from "@/utils/navBindingMatch";

export const EXECUTE_DETAILS_ACTION = "executeDetailsAction";
export const EXECUTE_TMDB_DETAILS_ACTION = "executeTmdbDetailsAction";
export const EXECUTE_IGDB_DETAILS_ACTION = "executeIgdbDetailsAction";

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
    appNavigate(libraryPathForCategory(row.id));
  }
}

/** Embedded browser fills the window — shell spatial nav must yield to it. */
export function isSpatialNavigationBlocked(): boolean {
  const bs = useBrowserStore.getState();
  if (bs.isOpen && !bs.isMinimized) return true;
  const sh = useShellOverlayStore.getState();
  /** Game context menu uses its own gamepad handling in `useUnifiedNavigation`. */
  return sh.quickAccessOpen || sh.appSwitcherOpen;
}

export function isGamesGridView(): boolean {
  return useAppShellStore.getState().currentView === "games";
}

export function isGameDetailsView(): boolean {
  return useAppShellStore.getState().currentView === "details";
}

export function isDiscoverLibraryView(): boolean {
  return typeof window !== "undefined" && window.location.pathname === "/library/discover";
}

export function isTmdbDetailsPath(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/tmdb/");
}

export function isIgdbDetailsPath(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/igdb/");
}

/** @deprecated Prefer isGamesGridView / isGameDetailsView */
export function isLibraryViewActive(): boolean {
  return isGamesGridView();
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
  useShellOverlayStore.getState().closeAllOverlays();
  const cat = useGameStore.getState().selectedCategory;
  appNavigate(libraryPathForCategory(cat));
  const nav = useNavigationStore.getState();
  nav.setFocusArea("games");
  nav.setSidebarIndex(0);
  window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
}

export function openDetailsForSelectedGame(): void {
  if (isDiscoverLibraryView()) {
    const ds = useTmdbDiscoverStore.getState();
    if (ds.feed === "popularGames") {
      const g = ds.igdbGames[ds.selectedIndex];
      if (g) appNavigate(`/igdb/${g.id}`);
      return;
    }
    const item = ds.getItems()[ds.selectedIndex] as { mediaType?: string; id?: number } | undefined;
    if (item && typeof item.mediaType === "string" && typeof item.id === "number") {
      appNavigate(`/tmdb/${item.mediaType}/${item.id}`);
    }
    return;
  }
  const gs = useGameStore.getState();
  const g = gs.filteredGames[gs.selectedIndex];
  if (!g) return;
  appNavigate(`/game/${encodeURIComponent(g.id)}`);
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
  if (
    isGamesGridView() &&
    nav.focusArea === "details" &&
    !gs.filteredGames[gs.selectedIndex]
  ) {
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
  return spatialDirectionFromKeyboard(
    (id) => {
      const b = getNavBinding(id);
      return { enabled: b.enabled, keyboard: b.keyboard };
    },
    event
  );
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
  if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
    return "unhandled";
  }
  if (isSpatialNavigationBlocked()) {
    return "unhandled";
  }
  if (isInsideShellModal(event.target)) {
    return "unhandled";
  }

  // Compact search popover: Escape / back closes it even while the input is focused
  // (shouldDelegateKeyboardToField would otherwise skip the global key pipeline).
  const shellEarly = useShellOverlayStore.getState();
  if (shellEarly.searchPopoverOpen && isNavActionKeyboardMatch("back", event)) {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
    return "handled";
  }

  if (shouldDelegateKeyboardToField(event)) {
    return "unhandled";
  }

  // Browser-style in-app history (works on library, details, settings — not the embedded webview).
  if (isNavActionKeyboardMatch("historyBack", event)) {
    event.preventDefault();
    try {
      window.history.back();
    } catch {
      /* no-op */
    }
    return "handled";
  }
  if (isNavActionKeyboardMatch("historyForward", event)) {
    event.preventDefault();
    try {
      window.history.forward();
    } catch {
      /* no-op */
    }
    return "handled";
  }

  const onSettings = isSettingsViewActive();

  const sh0 = useShellOverlayStore.getState();
  if (sh0.gameContextMenuOpen) {
    if (isNavActionKeyboardMatch("back", event)) {
      event.preventDefault();
      sh0.setGameContextMenuOpen(false);
      return "handled";
    }
    const max = Math.max(0, sh0.contextMenuItemCount - 1);
    if (isNavActionKeyboardMatch("spatialUp", event)) {
      event.preventDefault();
      sh0.setContextMenuFocusIndex(Math.max(0, sh0.contextMenuFocusIndex - 1));
      return "handled";
    }
    if (isNavActionKeyboardMatch("spatialDown", event)) {
      event.preventDefault();
      sh0.setContextMenuFocusIndex(Math.min(max, sh0.contextMenuFocusIndex + 1));
      return "handled";
    }
    if (isNavActionKeyboardMatch("primary", event)) {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent(EXECUTE_GAME_CONTEXT_EVENT, { detail: sh0.contextMenuFocusIndex })
      );
      return "handled";
    }
    event.preventDefault();
    return "handled";
  }

  if (isNavActionKeyboardMatch("quickAccessHome", event)) {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (
      (path === "/" ||
        path.startsWith("/library/") ||
        path.startsWith("/game/") ||
        path.startsWith("/tmdb/") ||
        path.startsWith("/igdb/")) &&
      !onSettings
    ) {
      event.preventDefault();
      useShellOverlayStore.getState().toggleQuickAccess();
      return "handled";
    }
    event.preventDefault();
    applyGoToLibraryView();
    return "handled";
  }

  if (isNavActionKeyboardMatch("gameMenu", event)) {
    event.preventDefault();
    if (isGamesGridView() && !onSettings) {
      const nav = useNavigationStore.getState();
      const gs = useGameStore.getState();
      if (nav.focusArea === "games" && gs.filteredGames[gs.selectedIndex]) {
        useShellOverlayStore.getState().toggleGameContextMenu();
        return "handled";
      }
    }
    applyFocusLeftRail(delayedFocus);
    return "handled";
  }

  if (onSettings) {
    if (isNavActionKeyboardMatch("back", event)) {
      event.preventDefault();
      applyBackOrEscape(delayedFocus);
      return "handled";
    }
    return "unhandled";
  }

  if (isNavActionKeyboardMatch("cycleShellTabReverse", event)) {
    event.preventDefault();
    cycleShellFocusTab(true);
    return "handled";
  }
  if (isNavActionKeyboardMatch("cycleShellTabForward", event)) {
    event.preventDefault();
    cycleShellFocusTab(false);
    return "handled";
  }

  if (isNavActionKeyboardMatch("openSearch", event)) {
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

  if (isNavActionKeyboardMatch("primary", event)) {
    event.preventDefault();
    applyPrimaryAction();
    return "handled";
  }

  if (isNavActionKeyboardMatch("back", event)) {
    event.preventDefault();
    applyBackOrEscape(delayedFocus);
    return "handled";
  }

  return "unhandled";
}

/** Horizontal move on the category strip (syncs filter with nav index). */
export function applyCategoryStripStep(direction: "left" | "right"): void {
  if (!isGamesGridView()) {
    return;
  }
  const nav = useNavigationStore.getState();
  const newIndex = nav.navigateCategory(direction);
  applyCategoryIndex(newIndex);
}

/**
 * D-pad / stick / arrow keys: one implementation shared by keyboard and gamepad.
 */
export function applySpatialNavigation(direction: SpatialDirection, delayedFocus: DelayedFocusArea): void {
  if (isSettingsViewActive()) {
    return;
  }
  if (isGameDetailsView()) {
    normalizeFocusAreaForContent();
    const nav = useNavigationStore.getState();
    const fa = nav.focusArea;
    if (fa === "details") {
      if (direction === "up") nav.navigateDetails("up");
      if (direction === "down") nav.navigateDetails("down");
    }
    return;
  }
  if (!isGamesGridView()) {
    return;
  }
  normalizeFocusAreaForContent();
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  const fa = nav.focusArea;

  switch (direction) {
    case "up": {
      if (fa === "games") {
        if (isDiscoverLibraryView()) {
          const ds = useTmdbDiscoverStore.getState();
          const cols = Math.max(1, ds.gridColumnCount);
          if (ds.selectedIndex >= cols) {
            ds.selectRowUp();
          } else {
            nav.setFocusArea("category");
          }
          return;
        }
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
        if (isDiscoverLibraryView()) {
          const ds = useTmdbDiscoverStore.getState();
          const cols = Math.max(1, ds.gridColumnCount);
          const items = ds.getItems();
          if (ds.selectedIndex + cols < items.length) {
            ds.selectRowDown();
          }
          return;
        }
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
        if (isDiscoverLibraryView()) {
          useTmdbDiscoverStore.getState().selectPrevious();
        } else {
          gs.selectPrevious();
        }
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
        if (isDiscoverLibraryView()) {
          useTmdbDiscoverStore.getState().selectNext();
        } else {
          gs.selectNext();
        }
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
  if (isGameDetailsView()) {
    normalizeFocusAreaForContent();
    const nav = useNavigationStore.getState();
    if (isTmdbDetailsPath()) {
      if (nav.focusArea === "details") {
        window.dispatchEvent(
          new CustomEvent(EXECUTE_TMDB_DETAILS_ACTION, { detail: nav.detailsIndex })
        );
      }
      return;
    }
    if (isIgdbDetailsPath()) {
      if (nav.focusArea === "details") {
        window.dispatchEvent(
          new CustomEvent(EXECUTE_IGDB_DETAILS_ACTION, { detail: nav.detailsIndex })
        );
      }
      return;
    }
    const gs = useGameStore.getState();
    const games = gs.filteredGames;
    const gi = gs.selectedIndex;
    if (nav.focusArea === "details" && games[gi]) {
      window.dispatchEvent(new CustomEvent(EXECUTE_DETAILS_ACTION, { detail: nav.detailsIndex }));
    }
    return;
  }

  if (!isGamesGridView()) {
    return;
  }

  normalizeFocusAreaForContent();
  const nav = useNavigationStore.getState();
  const gs = useGameStore.getState();
  const fa = nav.focusArea;
  const games = gs.filteredGames;
  const gi = gs.selectedIndex;

  if (isDiscoverLibraryView()) {
    const ds = useTmdbDiscoverStore.getState();
    if (ds.feed === "popularGames") {
      const g = ds.igdbGames[ds.selectedIndex];
      if (fa === "games" && g) {
        appNavigate(`/igdb/${g.id}`);
      }
      if (fa === "sidebar") {
        emitActivateSidebar(nav.sidebarIndex);
        return;
      }
      if (fa === "category") {
        window.dispatchEvent(new CustomEvent("activateCategory", { detail: nav.categoryIndex }));
      }
      return;
    }
    const item = ds.getItems()[ds.selectedIndex] as { mediaType?: string; id?: number } | undefined;
    if (fa === "games" && item && typeof item.mediaType === "string" && typeof item.id === "number") {
      appNavigate(`/tmdb/${item.mediaType}/${item.id}`);
      return;
    }
    if (fa === "details" && item && typeof item.mediaType === "string") {
      window.dispatchEvent(new CustomEvent(EXECUTE_TMDB_DETAILS_ACTION, { detail: nav.detailsIndex }));
      return;
    }
    if (fa === "sidebar") {
      emitActivateSidebar(nav.sidebarIndex);
      return;
    }
    if (fa === "category") {
      window.dispatchEvent(new CustomEvent("activateCategory", { detail: nav.categoryIndex }));
    }
    return;
  }

  if (fa === "games" && games[gi]) {
    appNavigate(`/game/${encodeURIComponent(games[gi].id)}`);
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
export function applyBackOrEscape(_delayedFocus: DelayedFocusArea): void {
  const gs = useGameStore.getState();
  if (gs.error) {
    gs.clearError();
    return;
  }
  window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
  if (isSettingsViewActive()) {
    applyGoToLibraryView();
    return;
  }

  if (isGameDetailsView()) {
    if (isTmdbDetailsPath() || isIgdbDetailsPath()) {
      appNavigate("/library/discover");
      gs.setSelectedCategory(DISCOVER_CATEGORY_ID);
      const discoverIdx = CATEGORY_NAV_ORDER.findIndex((row) => row.id === DISCOVER_CATEGORY_ID);
      if (discoverIdx >= 0) {
        useNavigationStore.getState().setCategoryIndex(discoverIdx);
      }
      useNavigationStore.getState().setFocusArea("games");
      return;
    }
    appNavigate(libraryPathForCategory(gs.selectedCategory));
    useNavigationStore.getState().setFocusArea("games");
    return;
  }

  const nav = useNavigationStore.getState();

  if (nav.focusArea === "details") {
    nav.setFocusArea("games");
    return;
  }
  if (nav.focusArea === "games") {
    nav.setFocusArea("category");
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
  if (!isGamesGridView()) {
    return;
  }
  delayedFocus("category");
  const nav = useNavigationStore.getState();
  const newIndex = nav.navigateCategory(direction);
  applyCategoryIndex(newIndex);
}

/** LT/RT from category row: move to grid then step selection after focus animation. */
export function applyShoulderScrollFromCategory(
  direction: "prev" | "next",
  delayedFocus: DelayedFocusArea,
  animationDelayMs: number = DEFAULT_FOCUS_ANIMATION_MS
): void {
  if (!isGamesGridView()) {
    return;
  }
  delayedFocus("games");
  window.setTimeout(() => {
    if (isDiscoverLibraryView()) {
      const d = useTmdbDiscoverStore.getState();
      if (direction === "prev") {
        d.selectPrevious();
      } else {
        d.selectNext();
      }
      return;
    }
    const g = useGameStore.getState();
    if (direction === "prev") {
      g.selectPrevious();
    } else {
      g.selectNext();
    }
  }, animationDelayMs);
}

export function applyGamepadMenuToggle(_delayedFocus: DelayedFocusArea): void {
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
  useShellOverlayStore.getState().toggleQuickAccess();
}
