import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAppShellStore } from "@/stores/appShellStore";
import { useNavigationStore } from "@/stores/navigationStore";
import {
  isSpatialNavigationBlocked,
  getEffectiveFocusArea,
  processUniversalKeydown,
  applySpatialNavigation,
  applyPrimaryAction,
  applyBackOrEscape,
  applyCategoryBumperFromGames,
  applyCategoryStripStep,
  applyShoulderScrollFromCategory,
  applyGamepadMenuToggle,
  openShellSearch,
  openDetailsForSelectedGame,
  UNIVERSAL_NAV_FOCUS_DELAY_MS,
  type DelayedFocusArea,
} from "@/navigation/universalNavCore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import { isDiscoverLibraryView } from "@/navigation/universalNavCore";
import { EXECUTE_GAME_CONTEXT_EVENT } from "@/types/app";
import type { NavActionId } from "@/types/navBindings";
import {
  getNavBinding,
  leftStickForSpatialEffective,
  useNavBindingsStore,
} from "@/stores/navBindingsStore";
import { anyGamepadButtonJustPressed, snapshotGamepadButtons } from "@/utils/navBindingMatch";
import { getActiveGamepad } from "@/utils/getActiveGamepad";
import {
  adjustFocusedRange,
  domActivateFocused,
  domSpatialMoveOrScroll,
} from "@/navigation/domSpatialNav";

/** @deprecated Import from `@/navigation/universalNavCore` for non-hook modules. */
export { EXECUTE_DETAILS_ACTION } from "@/navigation/universalNavCore";

// Auto-repeat timing for held D-pad / analog stick directions.
// First repeat fires after INITIAL_MS, then every INTERVAL_MS while held.
const REPEAT_INITIAL_MS = 400;
const REPEAT_INTERVAL_MS = 80;

type RepeatState = { pressStart: number; lastFire: number };

/**
 * Routes pointer, keyboard, and gamepad into `universalNavCore.ts`.
 * Spatial / primary / back rules live in one place; this file only handles input modality and edge triggers.
 */
export function useUnifiedNavigation() {
  const inputMethod = useNavigationStore((state) => state.inputMethod);
  const setFocusArea = useNavigationStore((state) => state.setFocusArea);
  const setInputMethod = useNavigationStore((state) => state.setInputMethod);
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);

  // Auto-repeat tracking: one RepeatState per direction id, null when not held.
  const repeatRef = useRef<Record<string, RepeatState | null>>({});

  const prevGpButtonsRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpButtonsRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const lastMouseActivityRef = useRef<number>(Date.now());
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const delayedSetFocusArea = useCallback(
    (area: Parameters<DelayedFocusArea>[0], delay: number = UNIVERSAL_NAV_FOCUS_DELAY_MS) => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = setTimeout(() => {
        setFocusArea(area);
      }, delay);
    },
    [setFocusArea]
  );

  const delayedFocus: DelayedFocusArea = useCallback(
    (area) => {
      delayedSetFocusArea(area);
    },
    [delayedSetFocusArea]
  );

  // Cursor visibility
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (inputMethod === "gamepad") {
      root.classList.add("cursor-none");
      body.classList.add("cursor-none");
    } else {
      root.classList.remove("cursor-none");
      body.classList.remove("cursor-none");
      root.style.cursor = "";
      body.style.cursor = "";
    }

    return () => {
      root.classList.remove("cursor-none");
      body.classList.remove("cursor-none");
      root.style.cursor = "";
      body.style.cursor = "";
    };
  }, [inputMethod]);

  // Disable gamepad / keyboard if toggled off in settings
  useEffect(() => {
    if (!gamepadNavigationEnabled && inputMethod === "gamepad") {
      setInputMethod("keyboard");
    }
  }, [gamepadNavigationEnabled, inputMethod, setInputMethod]);

  useEffect(() => {
    if (!keyboardNavigationEnabled && inputMethod === "keyboard") {
      setInputMethod("mouse");
    }
  }, [keyboardNavigationEnabled, inputMethod, setInputMethod]);

  // Mouse activity tracking — used to avoid switching to gamepad on accidental input
  useEffect(() => {
    const handleMouseMove = () => {
      setInputMethod("mouse");
      lastMouseActivityRef.current = Date.now();
    };
    const handleMouseDown = () => setInputMethod("mouse");

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseDown);
    };
  }, [setInputMethod]);

  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
        return;
      }
      if (processUniversalKeydown(e, delayedFocus) === "handled") {
        setInputMethod("keyboard");
      }
    },
    [setInputMethod, delayedFocus]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleKeyboardNavigation);
  }, [handleKeyboardNavigation, keyboardNavigationEnabled]);

  const handleGamepadInput = useCallback(() => {
    if (isSpatialNavigationBlocked()) return;
    if (!useNavBindingsStore.getState().gamepadNavigationEnabled) return;

    const gamepad = getActiveGamepad();
    if (!gamepad) return;

    // Only switch to gamepad mode when there is real input — prevents stale gamepad
    // polling from fighting a mouse that was just used.
    const hasAnyInput =
      Array.from(gamepad.buttons).some((b) => b.pressed) ||
      Math.abs(gamepad.axes[0]) > 0.1 ||
      Math.abs(gamepad.axes[1]) > 0.1;
    if (hasAnyInput) setInputMethod("gamepad");

    const prev = prevGpButtonsRef.current;
    const curr = currGpButtonsRef.current;
    snapshotGamepadButtons(gamepad, curr, 31);

    const gpJust = (binding: ReturnType<typeof getNavBinding>): boolean =>
      binding.enabled &&
      binding.gamepadButtons.length > 0 &&
      anyGamepadButtonJustPressed(binding.gamepadButtons, prev, curr);

    const stickOn = leftStickForSpatialEffective();

    const dpadDownFor = (id: NavActionId, currBuf: boolean[]) => {
      const b = getNavBinding(id);
      return b.enabled && b.gamepadButtons.some((i) => currBuf[i]);
    };

    const leftStickX = gamepad.axes[0];
    const leftStickY = gamepad.axes[1];

    const bU = getNavBinding("spatialUp");
    const bD = getNavBinding("spatialDown");
    const bL = getNavBinding("spatialLeft");
    const bR = getNavBinding("spatialRight");

    const upPressed    = bU.enabled && (dpadDownFor("spatialUp",    curr) || (stickOn && leftStickY < -0.5));
    const downPressed  = bD.enabled && (dpadDownFor("spatialDown",  curr) || (stickOn && leftStickY >  0.5));
    const leftPressed  = bL.enabled && (dpadDownFor("spatialLeft",  curr) || (stickOn && leftStickX < -0.5));
    const rightPressed = bR.enabled && (dpadDownFor("spatialRight", curr) || (stickOn && leftStickX >  0.5));

    const now = performance.now();

    /**
     * Fire `action` on first press, then repeat after INITIAL_MS delay at INTERVAL_MS rate.
     * `id` must be unique per direction per context (use "ctx-up" vs "up" to isolate contexts).
     */
    const handleDir = (id: string, isPressed: boolean, action: () => void) => {
      const state = repeatRef.current[id] ?? null;
      if (isPressed) {
        if (!state) {
          repeatRef.current[id] = { pressStart: now, lastFire: now };
          action();
        } else {
          const elapsed = now - state.pressStart;
          if (elapsed >= REPEAT_INITIAL_MS && now - state.lastFire >= REPEAT_INTERVAL_MS) {
            state.lastFire = now;
            action();
          }
        }
      } else {
        if (state !== null) repeatRef.current[id] = null;
      }
    };

    try {
      if (useShellOverlayStore.getState().exitConfirmOpen) {
        // Power menu (ExitModal) self-polls the gamepad.
        return;
      }

      const currentAppView = useAppShellStore.getState().currentView;
      if (currentAppView === "settings" || currentAppView === "docs") {
        // Form surfaces: d-pad moves real DOM focus (domSpatialNav), A activates,
        // left/right adjust a focused slider instead of leaving it.
        handleDir("form-up",   upPressed,   () => domSpatialMoveOrScroll("up"));
        handleDir("form-down", downPressed, () => domSpatialMoveOrScroll("down"));
        handleDir("form-left", leftPressed, () => {
          if (!adjustFocusedRange("left")) domSpatialMoveOrScroll("left");
        });
        handleDir("form-right", rightPressed, () => {
          if (!adjustFocusedRange("right")) domSpatialMoveOrScroll("right");
        });
        if (gpJust(getNavBinding("primary"))) {
          domActivateFocused();
        }
        if (gpJust(getNavBinding("back"))) {
          applyBackOrEscape(delayedFocus);
        }
        if (gpJust(getNavBinding("gamepadSettingsMenu"))) {
          applyGamepadMenuToggle(delayedFocus);
        }
        return;
      }

      const sh = useShellOverlayStore.getState();
      if (sh.gameContextMenuOpen) {
        handleDir("ctx-up",   upPressed,   () => {
          const st = useShellOverlayStore.getState();
          st.setContextMenuFocusIndex(Math.max(0, st.contextMenuFocusIndex - 1));
        });
        handleDir("ctx-down", downPressed, () => {
          const st = useShellOverlayStore.getState();
          const max = Math.max(0, st.contextMenuItemCount - 1);
          st.setContextMenuFocusIndex(Math.min(max, st.contextMenuFocusIndex + 1));
        });
        if (gpJust(getNavBinding("back"))) {
          useShellOverlayStore.getState().setGameContextMenuOpen(false);
        }
        if (gpJust(getNavBinding("primary"))) {
          const st = useShellOverlayStore.getState();
          window.dispatchEvent(
            new CustomEvent(EXECUTE_GAME_CONTEXT_EVENT, { detail: st.contextMenuFocusIndex })
          );
        }
        return;
      }

      const fa = getEffectiveFocusArea();
      const gs0 = useGameStore.getState();
      const ds0 = useTmdbDiscoverStore.getState();
      const hasGameSelection = Boolean(gs0.filteredGames[gs0.selectedIndex]);
      const hasDiscoverSelection = isDiscoverLibraryView() && Boolean(ds0.getItems()[ds0.selectedIndex]);
      const hasPrimaryGridSelection = hasDiscoverSelection || hasGameSelection;

      if (
        currentAppView === "games" &&
        fa === "games" &&
        hasPrimaryGridSelection &&
        !isDiscoverLibraryView() &&
        hasGameSelection &&
        gpJust(getNavBinding("gameMenu"))
      ) {
        useShellOverlayStore.getState().toggleGameContextMenu();
      }

      if (
        (currentAppView === "games" || currentAppView === "details") &&
        gpJust(getNavBinding("gamepadQuickAccessOverlay"))
      ) {
        useShellOverlayStore.getState().toggleQuickAccess();
      }

      handleDir("up",    upPressed,    () => applySpatialNavigation("up",    delayedFocus));
      handleDir("down",  downPressed,  () => applySpatialNavigation("down",  delayedFocus));
      handleDir("left",  leftPressed,  () => applySpatialNavigation("left",  delayedFocus));
      handleDir("right", rightPressed, () => applySpatialNavigation("right", delayedFocus));

      if (gpJust(getNavBinding("primary"))) {
        applyPrimaryAction();
      }

      if (gpJust(getNavBinding("openSearch"))) {
        openShellSearch();
      }

      if (gpJust(getNavBinding("back"))) {
        applyBackOrEscape(delayedFocus);
      }

      if (
        currentAppView === "games" &&
        fa === "games" &&
        hasPrimaryGridSelection &&
        gpJust(getNavBinding("quickLaunch"))
      ) {
        if (isDiscoverLibraryView()) {
          openDetailsForSelectedGame();
        } else {
          const g = useGameStore.getState().filteredGames[useGameStore.getState().selectedIndex];
          if (g) void useGameStore.getState().launchGame(g);
        }
      }

      const catLeft = getNavBinding("categoryBumperLeft");
      if (
        catLeft.enabled &&
        catLeft.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(catLeft.gamepadButtons, prev, curr)
      ) {
        if (fa === "category") {
          applyCategoryStripStep("left");
        } else if (fa === "games") {
          applyCategoryBumperFromGames("left", delayedFocus);
        }
      }

      const catRight = getNavBinding("categoryBumperRight");
      if (
        catRight.enabled &&
        catRight.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(catRight.gamepadButtons, prev, curr)
      ) {
        if (fa === "category") {
          applyCategoryStripStep("right");
        } else if (fa === "games") {
          applyCategoryBumperFromGames("right", delayedFocus);
        }
      }

      const scrollPrev = getNavBinding("scrollSelectionPrev");
      if (
        scrollPrev.enabled &&
        scrollPrev.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(scrollPrev.gamepadButtons, prev, curr)
      ) {
        if (fa === "games") {
          if (isDiscoverLibraryView()) {
            useTmdbDiscoverStore.getState().selectPrevious();
          } else {
            useGameStore.getState().selectPrevious();
          }
        } else if (fa === "category") {
          applyShoulderScrollFromCategory("prev", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
        }
      }

      const scrollNext = getNavBinding("scrollSelectionNext");
      if (
        scrollNext.enabled &&
        scrollNext.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(scrollNext.gamepadButtons, prev, curr)
      ) {
        if (fa === "games") {
          if (isDiscoverLibraryView()) {
            useTmdbDiscoverStore.getState().selectNext();
          } else {
            useGameStore.getState().selectNext();
          }
        } else if (fa === "category") {
          applyShoulderScrollFromCategory("next", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
        }
      }
    } finally {
      for (let i = 0; i < 32; i++) {
        prev[i] = curr[i];
      }
    }
  }, [setInputMethod, delayedFocus]);

  // Gamepad polling at ~60 fps via rAF
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = 0;
    const throttleMs = 16;

    const pollGamepad = (currentTime: number) => {
      if (currentTime - lastTime >= throttleMs) {
        handleGamepadInput();
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    animationFrameId = requestAnimationFrame(pollGamepad);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [handleGamepadInput]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);
}
